import {test, expect} from '@playwright/test';

async function useLocalApi(page) {
  await page.route('**/static/js/runtime-config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.PORTFOLIO_CONFIG=Object.freeze({apiBaseUrl:"",production:false,turnstileSiteKey:""});',
  }));
  await page.route('**/api/contact', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ok: true, message: 'Test contact accepted.'}),
  }));
  await page.route('**/api/chat', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({reply: 'Test assistant reply.'}),
  }));
}

test('static build preserves assets and primary interactions', async ({page, request}) => {
  await useLocalApi(page);
  const failedLocal = [];
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4173') && response.status() >= 400) {
      failedLocal.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto('/');

  await expect(page.locator('#project-map')).toHaveClass(/leaflet-container/);
  expect(await page.evaluate(() => ({gsap: !!window.gsap, trigger: !!window.ScrollTrigger, leaflet: !!window.L})))
    .toEqual({gsap: true, trigger: true, leaflet: true});

  const publicAssets = await page.locator('[src^="/static/"], [href^="/static/"]').evaluateAll(nodes =>
    [...new Set(nodes.map(node => node.getAttribute('src') || node.getAttribute('href')))]);
  for (const asset of publicAssets) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBeTruthy();
  }

  const hrefs = await page.locator('a[href^="#"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  for (const href of hrefs) {
    if (href.length > 1) await expect(page.locator(href).first(), href).toBeAttached();
  }

  await page.locator('.filter-btn[data-filter="ai"]').click();
  await expect(page.locator('.filter-btn[data-filter="ai"]')).toHaveClass(/is-active/);
  const visibleCategories = await page.locator('.project-card:not(.is-hidden)').evaluateAll(cards => cards.map(card => card.dataset.category));
  expect(visibleCategories.length).toBeGreaterThan(0);
  expect(visibleCategories.every(category => category === 'ai')).toBeTruthy();

  await page.keyboard.press('Control+K');
  await expect(page.locator('#palette')).toBeVisible();
  await expect(page.locator('#palette-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#palette')).toBeHidden();

  await page.locator('#theme-toggle').click();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(failedLocal).toEqual([]);
});

test('mobile, contact, chat, recruiter, and resume flows remain wired', async ({page, request}) => {
  await useLocalApi(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await expect(page.locator('.hero__photo-frame')).toBeVisible();
  await expect(page.locator('.hero__name')).toBeVisible();
  const photoBox = await page.locator('.hero__photo-frame').boundingBox();
  const nameBox = await page.locator('.hero__name').boundingBox();
  expect(photoBox.y).toBeLessThan(844);
  expect(nameBox.y).toBeLessThan(844);
  await expect(page.locator('.hero__photo-frame')).toHaveCSS('opacity', '1');
  await expect(page.locator('.hero__name')).toHaveCSS('opacity', '1');

  await page.locator('#nav-burger').click();
  await expect(page.locator('#mobile-menu')).toBeVisible();

  await page.locator('#name').fill('Test Person');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#project_type').selectOption('ai');
  await page.locator('#message').fill('A valid automated browser test message.');
  await page.locator('#contact-submit').click();
  await expect(page.locator('#form-status')).toContainText('Test contact accepted.');

  await page.locator('#chat-launcher').click();
  await page.locator('#chat-input').fill('What did you build?');
  await page.locator('#chat-form').press('Enter');
  await expect(page.locator('.chat-bubble--assistant').last()).toContainText('Test assistant reply.');
  await page.locator('[data-chat-mode="recruiter"]').click();
  await expect(page.locator('[data-chat-mode="recruiter"]')).toHaveAttribute('aria-pressed', 'true');

  const resume = await page.locator('a[href$="resume.pdf"]').first().getAttribute('href');
  expect((await request.get(resume)).ok()).toBeTruthy();
});

test('production client obtains a Turnstile token before a write request', async ({page}) => {
  await page.route('**/static/js/runtime-config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.PORTFOLIO_CONFIG=Object.freeze({apiBaseUrl:"",production:true,turnstileSiteKey:"public-test-key"});',
  }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile={ready:function(cb){cb();},render:function(_el,opts){setTimeout(function(){opts.callback('verified-test-token');},0);return 1;},remove:function(){}};`,
  }));
  let submitted;
  await page.route('**/api/contact', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({contentType: 'application/json', body: JSON.stringify({ok: true, message: 'Verified.'})});
  });
  await page.route('**/api/github?format=html', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({configured: false}),
  }));
  await page.goto('/');
  await page.locator('#name').fill('Test Person');
  await page.locator('#email').fill('test@example.com');
  await page.locator('#project_type').selectOption('software');
  await page.locator('#message').fill('A production challenge browser test message.');
  await page.locator('#contact-submit').click();
  await expect(page.locator('#form-status')).toContainText('Verified.');
  expect(submitted.turnstile_token).toBe('verified-test-token');
});
