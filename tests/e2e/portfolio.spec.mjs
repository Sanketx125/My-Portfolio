import {test, expect} from '@playwright/test';

async function useLocalApi(page) {
  // Keep browser checks deterministic in restricted/offline environments.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType: 'text/css', body: ''}));
  await page.route('https://fonts.gstatic.com/**', route => route.fulfill({status: 204, body: ''}));
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwN8WQAAAABJRU5ErkJggg==', 'base64'),
  }));
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

  await expect(page.locator('body')).toHaveCSS('user-select', 'none');
  expect(await page.locator('[data-nav-link]').evaluateAll(links => links.map(link => link.getAttribute('href'))))
    .toEqual(['#about', '#projects', '#portfolio-intelligence', '#social-proof', '#career', '#contact']);

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

  await expect(page.locator('#theme-toggle')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBeFalsy();
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
  await expect(page.locator('.chat-bubble--assistant').last()).toHaveCSS('user-select', 'text');
  await expect(page.locator('#chat-input')).toHaveCSS('user-select', 'text');
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
    body: `window.turnstile={ready:function(){throw new Error("Remove async/defer from the Turnstile api.js script tag before using turnstile.ready().");},render:function(_el,opts){setTimeout(function(){opts.callback('verified-test-token');},0);return 1;},remove:function(){}};`,
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

test('comprehensive content integrity, interactions, and visual review across desktop and mobile', async ({page}) => {
  test.setTimeout(60000);
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  await useLocalApi(page);
  await page.route('**/api/github?format=html', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({configured: false}),
  }));

  // 1. Desktop Viewport
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('/');

  // Career section verification
  await expect(page.locator('#career')).toBeVisible();
  await expect(page.locator('#recognition-code-catalyst')).toBeVisible();
  await expect(page.locator('#recognition-code-catalyst')).toContainText('Code Catalyst Award');
  await expect(page.locator('#recognition-code-catalyst')).toContainText('Nakshatech');
  await expect(page.locator('#recognition-code-catalyst')).toContainText('14th Anniversary Day');

  // Social Proof section verification
  await expect(page.locator('#social-proof')).toBeVisible();
  await expect(page.locator('.impact-item')).toHaveCount(4);

  // Portfolio Intelligence Hub: Tab 1 (Ask)
  await expect(page.locator('#portfolio-intelligence')).toBeVisible();
  await expect(page.locator('#pi-tab-ask')).toHaveClass(/is-active/);
  await expect(page.locator('#pi-panel-ask')).toBeVisible();
  await page.locator('[data-sample-prompt]').first().click();
  await expect(page.locator('#chat-panel')).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveValue('What geospatial AI work have you done?');
  await page.locator('#chat-close').click();

  // Portfolio Intelligence Hub: Tab 2 (Recruiter & JD Matcher)
  await page.locator('#pi-tab-recruiter').click();
  await expect(page.locator('#pi-panel-recruiter')).toBeVisible();
  await expect(page.locator('#pi-profile-text')).toContainText('Nakshatech');
  await expect(page.locator('#pi-profile-text')).toContainText('Code Catalyst Award');

  // Test JD Matcher with preset
  await page.locator('.pi-sample-jd-btn').first().click();
  await page.locator('#pi-analyze-jd-btn').click();
  await expect(page.locator('#pi-jd-results')).toBeVisible();
  await expect(page.locator('#pi-score-badge')).toBeVisible();
  expect(await page.locator('#pi-matched-skills li').count()).toBeGreaterThan(0);

  // Test unsupported skill detection: "Not demonstrated in current portfolio"
  await page.locator('#pi-jd-textarea').fill('Terraform, Kafka, Azure DevOps, Scala, React Native');
  await page.locator('#pi-analyze-jd-btn').click();
  await expect(page.locator('#pi-unmatched-container')).toBeVisible();
  for (const skill of ['Terraform', 'Kafka', 'Azure DevOps', 'Scala', 'React Native']) {
    await expect(page.locator('#pi-unmatched-skills')).toContainText('Not demonstrated in current portfolio: ' + skill);
  }

  // Portfolio Intelligence Hub: Tab 3 (Tech Dive)
  await page.locator('#pi-tab-tech-dive').click();
  await expect(page.locator('#pi-panel-tech-dive')).toBeVisible();
  await expect(page.locator('#td-sub-architecture')).toBeVisible();

  // Switch to Engineering Decisions subtab
  await page.locator('[data-td-sub="decisions"]').click();
  await expect(page.locator('#td-sub-decisions')).toBeVisible();
  await expect(page.locator('.pi-decisions-grid .card')).toHaveCount(4);
  await expect(page.locator('#td-sub-decisions')).toContainText('Cloth Simulation Filter (CSF)');
  await expect(page.locator('#td-sub-decisions')).toContainText('PointNet++ Direct Point Processing');

  // Command Palette
  await page.keyboard.press('Control+K');
  await expect(page.locator('#palette')).toBeVisible();
  await page.locator('#palette-input').fill('code catalyst');
  await page.locator('.palette__item').first().click();
  await expect(page.locator('#recognition-code-catalyst')).toBeVisible();

  // Test chat markdown parsing with simulated complex markdown (testing formatting and preventing constraints**: bug)
  await page.unroute('**/api/chat');
  await page.route('**/api/chat', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      reply: '### Fit Summary\n**Key constraints**: low latency.\n- [bad](javascript:alert(1))\n- [bad](data:text/html,bad)\n- [bad](vbscript:msgbox(1))\n- [bad](file:///etc/passwd)\n- [broken](javascript:alert(1)\n- [good](https://example.com)\n- [internal](#projects)\n```python\nprint("secure")\n```\n<script>window.xss=true;</script>\n<img src=x onerror="window.imgXss=true">'
    }),
  }));
  await page.locator('#chat-launcher').click();
  await page.locator('#chat-input').fill('Evaluate fit');
  await page.locator('#chat-form').press('Enter');
  const animatedReply = page.locator('.chat-bubble--assistant').last();
  await expect(animatedReply).toContainText('Fit Summary');
  await expect(animatedReply).not.toHaveAttribute('aria-busy', 'true');
  const lastBubbleHtml = await animatedReply.innerHTML();
  expect(lastBubbleHtml).toContain('<h4 class="chat-heading">Fit Summary</h4>');
  expect(lastBubbleHtml).toContain('<strong>Key constraints</strong>:');
  expect(lastBubbleHtml).not.toContain('constraints**:');
  expect(lastBubbleHtml).not.toContain('<script>');
  expect(lastBubbleHtml).not.toContain('<img');
  expect(lastBubbleHtml).not.toMatch(/href="(?:javascript|data|vbscript|file):/i);
  expect(lastBubbleHtml).toContain('href="https://example.com"');
  expect(lastBubbleHtml).toContain('href="#projects"');
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
  expect(await page.evaluate(() => window.imgXss)).toBeUndefined();
  await page.locator('#chat-close').click();

  // Visual Screenshots: Desktop
  await page.locator('#career').screenshot({path: '.artifacts/screenshots/desktop-career.png'});
  await page.locator('#social-proof').screenshot({path: '.artifacts/screenshots/desktop-social-proof.png'});
  await page.locator('#recognition-code-catalyst').screenshot({path: '.artifacts/screenshots/desktop-code-catalyst.png'});

  // Switch to Ask tab and screenshot
  await page.locator('#pi-tab-ask').click();
  await page.locator('#pi-panel-ask').screenshot({path: '.artifacts/screenshots/desktop-pi-ask.png'});

  // Switch to Recruiter tab and screenshot
  await page.locator('#pi-tab-recruiter').click();
  await page.locator('#pi-panel-recruiter').screenshot({path: '.artifacts/screenshots/desktop-pi-recruiter.png'});
  await page.locator('#pi-jd-results').screenshot({path: '.artifacts/screenshots/desktop-jd-analysis.png'});

  // Switch to Tech Dive tab and screenshot
  await page.locator('#pi-tab-tech-dive').click();
  await page.locator('[data-td-sub="decisions"]').click();
  await page.locator('#td-sub-decisions').screenshot({path: '.artifacts/screenshots/desktop-pi-tech-dive.png'});

  // 2. Mobile Viewport (390x844)
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');

  // Recruiter panel on mobile
  await page.locator('#pi-tab-recruiter').click();
  await expect(page.locator('#pi-panel-recruiter')).toBeVisible();
  await page.locator('#pi-panel-recruiter').screenshot({path: '.artifacts/screenshots/mobile-recruiter.png'});

  // JD Analyzer on mobile
  await page.locator('.pi-sample-jd-btn').first().click();
  await page.locator('#pi-analyze-jd-btn').click();
  await expect(page.locator('#pi-jd-results')).toBeVisible();
  await page.locator('#pi-jd-results').screenshot({path: '.artifacts/screenshots/mobile-jd.png'});

  // Tech dive on mobile
  await page.locator('#pi-tab-tech-dive').click();
  await page.locator('[data-td-sub="decisions"]').click();
  await expect(page.locator('#td-sub-decisions')).toBeVisible();
  await page.locator('#td-sub-decisions').screenshot({path: '.artifacts/screenshots/mobile-tech-dive.png'});

  // Verify zero console errors throughout the entire suite
  expect(consoleErrors).toEqual([]);
});
