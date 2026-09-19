import nunjucks from 'nunjucks/browser/nunjucks-slim.js';
import githubTemplate from '../.generated/github-template.mjs';
import portfolio from '../.generated/portfolio.json' with {type: 'json'};
import {Store} from './store.mjs';
import {AIService, MailService, validateContact} from './services.mjs';
import {GitHubService} from './github.mjs';
import {HttpError, checkOrigin, json, rateLimit, readJSON, session, verifyChallenge, budget, nowSeconds} from './security.mjs';

const templateEnv = new nunjucks.Environment([], {autoescape: true, throwOnUndefined: false});
templateEnv.addFilter('sliceFirst', (items, length) => (items || []).slice(0, length));
const githubView = new nunjucks.Template({type: 'code', obj: githubTemplate}, templateEnv, 'github', true);

// Workers reject fetch called with a foreign `this` (service.http(...)); wrap so any receiver works.
const defaultFetch = (...args) => fetch(...args);

async function handle(request, env, ctx, http = defaultFetch) {
  const url = new URL(request.url);
  const store = new Store(env.DB);
  if (request.method === 'POST' && url.pathname === '/api/chat') {
    checkOrigin(request, env);
    const data = await readJSON(request, 12000);
    await rateLimit(store, request, env, 'chat');
    await verifyChallenge(data, request, env, 'chat', http);
    const currentSession = await session(request, env);
    const result = await new AIService(store, env, http).reply(data, currentSession.id);
    const response = json(result);
    if (currentSession.cookie) response.headers.set('Set-Cookie', currentSession.cookie);
    return response;
  }
  if (request.method === 'POST' && url.pathname === '/api/contact') {
    checkOrigin(request, env);
    const data = await readJSON(request, 12000);
    await rateLimit(store, request, env, 'contact');
    if (typeof data.website === 'string' && data.website.trim()) return json({ok: true, message: 'Thanks — your message is on its way.'});
    await verifyChallenge(data, request, env, 'contact', http);
    const contact = validateContact(data);
    await budget(store, 'contact', Number(env.CONTACT_DAILY_BUDGET));
    await store.saveContact(contact);
    ctx.waitUntil(new MailService(store, env, http).flush(2));
    return json({ok: true, message: 'Thanks — your message is on its way.'});
  }
  if (request.method === 'GET' && url.pathname === '/api/github') {
    await rateLimit(store, request, env, 'github');
    let data;
    try { data = await new GitHubService(store, env, http).get(); }
    catch (error) { console.error('GitHub fetch failed', {name: error?.name, message: error?.message}); data = portfolio.fallback; }
    return json({...data, html: data.configured ? githubView.render({github: data, content: portfolio.content}) : undefined});
  }
  throw new HttpError(404, 'Not found.');
}

export {handle, defaultFetch};
export default {
  async fetch(request, env, ctx) {
    try { return await handle(request, env, ctx); }
    catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error('Portfolio API request failed', {status, path: new URL(request.url).pathname, name: error?.name, message: error?.message});
      return json({error: error instanceof HttpError ? error.message : 'The service is temporarily unavailable.', ...(error?.fields ? {fields: error.fields} : {})}, status);
    }
  },
  async scheduled(_event, env, ctx) {
    const store = new Store(env.DB);
    ctx.waitUntil(Promise.all([new MailService(store, env, defaultFetch).flush(8), store.cleanup(nowSeconds())]));
  },
};
