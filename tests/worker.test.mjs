import test from 'node:test';
import assert from 'node:assert/strict';
import nunjucks from 'nunjucks/browser/nunjucks-slim.js';
import templateData from '../.generated/github-template.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {AIService, MailService, validateCapabilityRegistry, validateContact} from '../worker/services.mjs';
import {GitHubService} from '../worker/github.mjs';
import {Store} from '../worker/store.mjs';
import {HttpError, checkOrigin, rateLimit, readJSON, session, verifyChallenge} from '../worker/security.mjs';
import worker, {handle, defaultFetch} from '../worker/index.mjs';

const response = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

class FakeStore {
  constructor() { this.saved = []; this.runs = []; this.cacheValue = null; }
  async reserve() { return true; }
  async lease() { return true; }
  async release() {}
  async run(sql) { this.runs.push(sql); return {}; }
  async one(sql) { return sql.startsWith('UPDATE sessions') ? {turns: 1} : null; }
  async history() { return [{role: 'assistant', content: 'Earlier reply'}]; }
  async saveChat(id, message, reply) { this.saved.push({id, message, reply}); }
  async cache() { return this.cacheValue; }
  async putCache(_key, value, expires) { this.cacheValue = {value: JSON.stringify(value), expires}; }
}

test('contact validation enforces the public contract', () => {
  const valid = validateContact({name: 'A Person', email: 'a@example.com', project_type: 'ai', budget: '', message: 'Detailed project request', request_id: crypto.randomUUID()});
  assert.equal(valid.email, 'a@example.com');
  assert.throws(() => validateContact({...valid, email: 'bad'}), error => error instanceof HttpError && error.status === 400);
  assert.throws(() => validateContact({...valid, message: 'x'.repeat(4001)}), error => Boolean(error.fields.message));
});

test('verified capability evidence identifiers fail closed', () => {
  assert.throws(
    () => validateCapabilityRegistry([{id: 'cap_fake', evidence_ids: ['fact_missing']}], ['fact_real']),
    /Invalid verified capability evidence/,
  );
});

test('request parsing and exact origin checks fail closed', async () => {
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{}'})), error => error.status === 415);
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{bad'})), error => error.status === 400);
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message: 'x'.repeat(13000)})})), error => error.status === 413);
  assert.throws(() => checkOrigin(new Request('https://site.test/api', {headers: {Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site'}}), {SITE_URL: 'https://site.test'}), error => error.status === 403);
  assert.throws(() => checkOrigin(new Request('https://site.test/api'), {SITE_URL: 'https://site.test'}), error => error.status === 403);
});

test('Turnstile hostname/action and rate limits fail closed', async () => {
  const request = new Request('https://site.test/api/chat', {headers: {'cf-connecting-ip': '192.0.2.1'}});
  const env = {SITE_URL: 'https://site.test', TURNSTILE_SECRET_KEY: 'turnstile-secret', SESSION_SECRET: 's'.repeat(32)};
  await verifyChallenge({turnstile_token: 'token'}, request, env, 'chat', async () => response({success: true, hostname: 'site.test', action: 'chat'}));
  await assert.rejects(verifyChallenge({turnstile_token: 'token'}, request, env, 'chat', async () => response({success: true, hostname: 'evil.test', action: 'chat'})), error => error.status === 403);
  await assert.rejects(rateLimit({reserve: async () => false}, request, env, 'chat'), error => error.status === 429);
});

test('signed session cookie is stable and tamper resistant', async () => {
  const env = {SESSION_SECRET: '0'.repeat(32)};
  const first = await session(new Request('https://site.test/api'), env);
  const value = first.cookie.split(';')[0];
  assert.match(first.cookie, /^__Host-portfolio=/);
  assert.match(first.cookie, /; Path=\/; HttpOnly; Secure; SameSite=Strict;/);
  assert.doesNotMatch(first.cookie, /Domain=/i);
  const second = await session(new Request('https://site.test/api', {headers: {Cookie: value}}), env);
  assert.equal(second.id, first.id);
  const tampered = await session(new Request('https://site.test/api', {headers: {Cookie: value.replace(first.id[0], first.id[0] === 'a' ? 'b' : 'a')}}), env);
  assert.notEqual(tampered.id, first.id);
});

test('AI adapter preserves prompt, history, limits, and hides server session id', async () => {
  const store = new FakeStore();
  const env = {LLM_API_KEY: 'private-test-value', LLM_MODEL: 'model', LLM_API_BASE: 'https://llm.test/v1', CHAT_DAILY_BUDGET: '50'};
  let outbound;
  const http = async (_url, options) => { outbound = options; return response({choices: [{message: {content: 'Useful reply'}}]}); };
  const result = await new AIService(store, env, http).reply({message: 'What did you build?', mode: 'recruiter'}, 'private-session');
  assert.deepEqual(result, {reply: 'Useful reply'});
  assert.equal(store.saved[0].id, 'private-session');
  const sent = JSON.parse(outbound.body);
  assert.equal(sent.max_tokens, 500);
  assert.match(sent.messages[0].content, /RECRUITER MODE/);
  assert.equal(outbound.headers.Authorization, 'Bearer private-test-value');
});

test('AI adapter in jd_match mode formats prompt and does not persist JD', async () => {
  const store = new FakeStore();
  const env = {LLM_API_KEY: 'private-test-value', LLM_MODEL: 'model', LLM_API_BASE: 'https://llm.test/v1', CHAT_DAILY_BUDGET: '50'};
  let outbound;
  const http = async (_url, options) => { outbound = options; return response({choices: [{message: {content: 'Fit assessment'}}]}); };
  const result = await new AIService(store, env, http).reply({message: 'Python and LiDAR skills', mode: 'jd_match'}, 'private-session');
  assert.deepEqual(result, {reply: 'Fit assessment'});
  assert.equal(store.saved.length, 0);
  const sent = JSON.parse(outbound.body);
  assert.match(sent.messages[0].content, /Fit Summary/);
  assert.match(sent.messages.at(-1).content, /Please evaluate/);
});

test('AI provider failure is bounded and releases its leases', async () => {
  const store = new FakeStore();
  const releases = [];
  store.release = async key => releases.push(key);
  const env = {LLM_API_KEY: 'private-test-value', LLM_MODEL: 'model', LLM_API_BASE: 'https://llm.test/v1', CHAT_DAILY_BUDGET: '50'};
  await assert.rejects(new AIService(store, env, async () => response({}, 503)).reply({message: 'Question', mode: 'default'}, 'private-session'), error => error.status === 502);
  assert.deepEqual(releases.sort(), ['chat:private-session', 'llm:0']);
});

test('mail outbox marks successful delivery and retains failed delivery', async () => {
  const makeStore = () => ({
    count: 0, updates: [], reserve: async () => true,
    one: async function (sql) {
      if (sql.startsWith('UPDATE outbox')) return this.count++ ? null : {id: 'mail-1', contact_id: 1, kind: 'owner', attempts: 1};
      return {name: 'A Person', email: 'a@example.com', project_type: 'ai', budget: '', message: 'Details'};
    },
    run: async function (sql, ...args) { this.updates.push([sql, args]); },
  });
  const env = {BREVO_API_KEY: 'secret', MAIL_FROM: 'sender@example.com', CONTACT_TO_EMAIL: 'owner@example.com'};
  const success = makeStore();
  await new MailService(success, env, async () => response({messageId: '1'})).flush(1);
  assert.match(success.updates[0][0], /state='sent'/);
  const failure = makeStore();
  await new MailService(failure, env, async () => response({}, 503)).flush(1);
  assert.match(failure.updates[0][0], /SET state=/);
  assert.equal(failure.updates[0][1][0], 'pending');
});

test('GitHub service normalizes, caches, and returns no token', async () => {
  const store = new FakeStore();
  const user = {login: 'person', followers: {totalCount: 2}, publicRepos: {totalCount: 1, nodes: [{name: 'repo', description: '<script>', url: 'https://github.com/person/repo', stargazerCount: 3, forkCount: 1, isFork: false, primaryLanguage: {name: 'Python', color: '#3572A5'}, repositoryTopics: {nodes: []}}]}, privateRepos: {totalCount: 4}, contributionsCollection: {totalCommitContributions: 1, totalPullRequestContributions: 2, totalIssueContributions: 0, contributionCalendar: {totalContributions: 1, weeks: [{contributionDays: [{date: '2026-09-17', contributionCount: 1}]}]}}};
  const env = {GITHUB_USERNAME: 'person', GITHUB_TOKEN: 'private-token'};
  const service = new GitHubService(store, env, async () => response({data: {user}}));
  const result = await service.get();
  assert.equal(result.totals.followers, 2);
  assert.equal('private_repos' in result.totals, false);
  assert.equal(result.featured[0].description, '<script>');
  assert.doesNotMatch(JSON.stringify(result), /private-token/);
  assert.ok(store.cacheValue);
  const cached = await new GitHubService(store, env, async () => { throw new Error('network should not run'); }).get();
  assert.deepEqual(cached, result);
});

test('D1 store binds user values instead of interpolating SQL', async () => {
  const calls = [];
  const db = {prepare(sql) { return {bind(...args) { calls.push({sql, args}); return {run: async () => ({})}; }}; }};
  await new Store(db).run('INSERT INTO example(value) VALUES(?)', "x'); DROP TABLE contacts;--");
  assert.equal(calls[0].sql, 'INSERT INTO example(value) VALUES(?)');
  assert.deepEqual(calls[0].args, ["x'); DROP TABLE contacts;--"]);
});

test('precompiled GitHub template autoescapes API text', () => {
  const env = new nunjucks.Environment([], {autoescape: true});
  env.addFilter('sliceFirst', (items, n) => items.slice(0, n));
  env.addFilter('format', (fmt, ...args) => {
    let idx = 0;
    return String(fmt).replace(/%(\.\d+)?f/g, (_, p) => {
      const v = Number(args[idx++]);
      return p ? v.toFixed(parseInt(p.slice(1), 10)) : String(v);
    }).replace(/%[sd]/g, () => String(args[idx++]));
  });
  const template = new nunjucks.Template({type: 'code', obj: templateData}, env, 'github', true);
  const html = template.render({github: {configured: false, featured: [{name: '<img src=x onerror=1>', description: '<script>', url: 'https://github.com/a/b'}]}, content: {socials: {}}});
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  const liveHtml = template.render({
    github: {
      configured: true,
      profile: {login: 'test', name: 'Test', avatar: 'https://avatar.test', bio: 'Bio'},
      totals: {public_repos: 1, stars: 2, followers: 3, contributions: 4},
      activity: {commits: 1, prs: 1, issues: 0},
      languages: [{name: 'JavaScript', color: '#f1e05a', count: 1, pct: 100}],
      featured: [],
      calendar: {total: 4, peak: 1, weeks: []},
      fetched_at: '2026-09-19T10:00:00Z',
    },
    content: {socials: {}},
  });
  assert.match(liveHtml, /Live/);
  assert.match(liveHtml, /stroke-dasharray="339.29 0.00"/);
});

test('production Worker source contains zero redirect: "error" for Cloudflare runtime compatibility', () => {
  const workerDir = path.resolve('worker');
  const files = fs.readdirSync(workerDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  assert.ok(files.length > 0, 'Worker directory must contain source files');
  for (const file of files) {
    const content = fs.readFileSync(path.join(workerDir, file), 'utf8');
    assert.doesNotMatch(content, /redirect:\s*['"]error['"]/i, `File ${file} must not contain redirect: 'error'`);
  }
});

test('external requests use redirect: "manual"', async () => {
  const store = new FakeStore();
  const env = {
    LLM_API_KEY: 'test-key', LLM_MODEL: 'model', LLM_API_BASE: 'https://llm.test/v1',
    CHAT_DAILY_BUDGET: '50', GITHUB_USERNAME: 'testuser', GITHUB_TOKEN: 'testtoken',
    BREVO_API_KEY: 'testkey', MAIL_FROM: 'from@test.com', CONTACT_TO_EMAIL: 'to@test.com',
    SITE_URL: 'https://site.test', TURNSTILE_SECRET_KEY: 'secret',
  };

  // 1. AI Service
  let aiOptions;
  const aiHttp = async (_url, options) => { aiOptions = options; return response({choices: [{message: {content: 'ok'}}]}); };
  await new AIService(store, env, aiHttp).reply({message: 'hi', mode: 'default'}, 's1');
  assert.equal(aiOptions.redirect, 'manual');

  // 2. GitHub Service
  let ghOptions;
  const ghHttp = async (_url, options) => { ghOptions = options; return response({data: {user: {publicRepos: {nodes: []}}}}); };
  await new GitHubService(store, env, ghHttp).fetchUser('testuser', 'testtoken');
  assert.equal(ghOptions.redirect, 'manual');

  // 3. Mail Service
  let mailOptions;
  const mailStore = {
    count: 0, updates: [], reserve: async () => true,
    one: async (sql) => sql.startsWith('UPDATE outbox') ? (mailStore.count++ ? null : {id: 'm1', contact_id: 1, kind: 'owner', attempts: 1}) : {name: 'A', email: 'a@a.com', project_type: 'ai', message: 'hello'},
    run: async () => ({}),
  };
  const mailHttp = async (_url, options) => { mailOptions = options; return response({messageId: '1'}); };
  await new MailService(mailStore, env, mailHttp).flush(1);
  assert.equal(mailOptions.redirect, 'manual');

  // 4. Turnstile verifyChallenge
  let turnstileOptions;
  const turnstileHttp = async (_url, options) => { turnstileOptions = options; return response({success: true, hostname: 'site.test', action: 'chat'}); };
  await verifyChallenge({turnstile_token: 'token'}, new Request('https://site.test', {headers: {'cf-connecting-ip': '1.2.3.4'}}), env, 'chat', turnstileHttp);
  assert.equal(turnstileOptions.redirect, 'manual');
});

test('AI provider redirects fail safely and release leases', async () => {
  const store = new FakeStore();
  const releases = [];
  store.release = async key => releases.push(key);
  const env = {LLM_API_KEY: 'test-key', LLM_MODEL: 'model', LLM_API_BASE: 'https://llm.test/v1', CHAT_DAILY_BUDGET: '50'};
  for (const status of [301, 302, 307, 308]) {
    const redirectResponse = async () => new Response('Moved', {status, headers: {Location: 'https://evil.test'}});
    await assert.rejects(
      new AIService(store, env, redirectResponse).reply({message: 'hi', mode: 'default'}, 's1'),
      error => error instanceof HttpError && error.status === 502,
    );
  }
  assert.deepEqual(releases.slice(0, 2).sort(), ['chat:s1', 'llm:0']);
});

test('GitHub redirects fall back safely and reject 3xx status', async () => {
  const store = new FakeStore();
  const env = {GITHUB_USERNAME: 'person', GITHUB_TOKEN: 'token'};
  for (const status of [301, 302, 307, 308]) {
    const redirectResponse = async () => new Response('Moved', {status, headers: {Location: 'https://evil.test'}});
    const service = new GitHubService(store, env, redirectResponse);
    await assert.rejects(service.fetchUser('person', 'token'), error => error instanceof HttpError && error.status === 502);
  }

  // Route-level fallback on GET /api/github
  const request = new Request('https://site.test/api/github', {headers: {'cf-connecting-ip': '127.0.0.1'}});
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({count: 1}),
          run: async () => ({}),
          all: async () => ({results: []}),
        }),
      }),
    },
    GITHUB_USERNAME: 'person',
    GITHUB_TOKEN: 'token',
    SESSION_SECRET: 'a'.repeat(32),
  };
  const redirectHttp = async () => new Response('Moved', {status: 301, headers: {Location: 'https://evil.test'}});
  const routeResponse = await handle(request, mockEnv, {}, redirectHttp);
  assert.equal(routeResponse.status, 200);
  const data = await routeResponse.json();
  assert.equal(data.configured, false);
});

test('Brevo redirect does not mark mail as sent and leaves outbox pending', async () => {
  const updates = [];
  const mailStore = {
    count: 0, reserve: async () => true,
    one: async (sql) => sql.startsWith('UPDATE outbox') ? (mailStore.count++ ? null : {id: 'm1', contact_id: 1, kind: 'owner', attempts: 1}) : {name: 'A', email: 'a@a.com', project_type: 'ai', message: 'hello'},
    run: async (sql, ...args) => { updates.push([sql, args]); },
  };
  const env = {BREVO_API_KEY: 'key', MAIL_FROM: 'from@test.com', CONTACT_TO_EMAIL: 'to@test.com'};
  for (const status of [301, 302]) {
    updates.length = 0;
    mailStore.count = 0;
    const redirectHttp = async () => new Response('Redirect', {status, headers: {Location: 'https://evil.test'}});
    await new MailService(mailStore, env, redirectHttp).flush(1);
    assert.equal(updates.length, 1);
    assert.match(updates[0][0], /SET state=/);
    assert.equal(updates[0][1][0], 'pending');
    assert.doesNotMatch(updates[0][0], /state='sent'/);
  }
});

test('Turnstile redirect cannot pass verification', async () => {
  const request = new Request('https://site.test/api/chat', {headers: {'cf-connecting-ip': '192.0.2.1'}});
  const env = {SITE_URL: 'https://site.test', TURNSTILE_SECRET_KEY: 'secret'};
  for (const status of [301, 302]) {
    const redirectHttp = async () => new Response('Redirect', {status, headers: {Location: 'https://evil.test'}});
    await assert.rejects(
      verifyChallenge({turnstile_token: 'token'}, request, env, 'chat', redirectHttp),
      error => error instanceof HttpError && error.status === 503,
    );
  }
});

test('existing fetch receiver regression remains covered', async () => {
  assert.equal(typeof defaultFetch, 'function');
  const serviceLikeObject = {
    http: defaultFetch,
    async ping() {
      return this.http('data:text/plain,receiver-ok');
    },
  };
  const res = await serviceLikeObject.ping();
  assert.equal(await res.text(), 'receiver-ok');
});


const PROD = 'https://sanket-portfolio.studystock105.workers.dev';
const PROD_HOST = 'sanket-portfolio.studystock105.workers.dev';
const okDb = {batch: async () => [], prepare: () => ({bind: () => ({first: async () => ({turns: 1, count: 1, key: 'k'}), run: async () => ({}), all: async () => ({results: []})})})};
// Full Worker entry (error mapping included) with the injected outbound http.
const serve = (request, env, http) => worker.fetch(request, env, {}, http);
const chatEnv = (over = {}) => ({
  SITE_URL: PROD, SESSION_SECRET: 'k'.repeat(32), TURNSTILE_SECRET_KEY: 'ts-secret-value', LLM_API_KEY: 'llm-secret-value',
  LLM_MODEL: 'gemini-model', LLM_API_BASE: 'https://generativelanguage.googleapis.com/v1beta/openai', CHAT_DAILY_BUDGET: '50',
  DB: okDb, ...over,
});
const chatRequest = (headers = {}) => new Request(`${PROD}/api/chat`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Origin: PROD, 'Sec-Fetch-Site': 'same-origin', 'CF-Connecting-IP': '203.0.113.9', ...headers},
  body: JSON.stringify({message: 'Tell me about Sanket', mode: 'default', turnstile_token: 'fresh-token'}),
});
function routedHttp({turnstile = {success: true, hostname: PROD_HOST, action: 'chat'}, llm = () => response({choices: [{message: {content: 'AI answer'}}]})} = {}) {
  const calls = {turnstile: 0, llm: 0, options: []};
  const http = async (url, options) => {
    calls.options.push(options);
    if (String(url).includes('siteverify')) { calls.turnstile++; return response(turnstile); }
    calls.llm++;
    assert.equal(String(url), 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    return llm();
  };
  return {http, calls};
}
async function captureLogs(fn) {
  const logs = [];
  const originals = ['error', 'warn', 'info', 'log'].map(k => [k, console[k]]);
  for (const [k] of originals) console[k] = (...a) => logs.push(JSON.stringify(a));
  try { return {result: await fn(), logs: logs.join('\n')}; } finally { for (const [k, f] of originals) console[k] = f; }
}

test('production chat: exact workers.dev origin succeeds, sets a __Host- session cookie, reaches LLM once', async () => {
  const {http, calls} = routedHttp();
  const res = await serve(chatRequest(), chatEnv(), http);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {reply: 'AI answer'});
  assert.equal(calls.turnstile, 1);
  assert.equal(calls.llm, 1);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^__Host-portfolio=.*; Path=\/; HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(cookie, /Domain=/i);
  const llmCall = calls.options.at(-1);
  assert.deepEqual(Object.keys(JSON.parse(llmCall.body)).sort(), ['max_tokens', 'messages', 'model', 'temperature']);
  assert.equal(llmCall.headers.Authorization, 'Bearer llm-secret-value');
});

test('production chat: bad origins are rejected before Turnstile or LLM', async () => {
  for (const origin of ['https://evil.test', `${PROD}/`, 'http://' + PROD_HOST, null]) {
    const {http, calls} = routedHttp();
    const request = chatRequest();
    if (origin === null) request.headers.delete('origin'); else request.headers.set('origin', origin);
    const res = await serve(request, chatEnv(), http);
    assert.equal(res.status, 403, String(origin));
    assert.equal(calls.turnstile + calls.llm, 0);
  }
});

test('production chat: Turnstile failure never reaches the LLM and logs only result fields', async () => {
  const {http, calls} = routedHttp({turnstile: {success: false, 'error-codes': ['timeout-or-duplicate']}});
  const {result, logs} = await captureLogs(() => serve(chatRequest(), chatEnv(), http));
  assert.equal(result.status, 403);
  assert.equal(calls.llm, 0);
  assert.match(logs, /timeout-or-duplicate/);
  assert.doesNotMatch(logs, /fresh-token|ts-secret-value/);
  const wrongAction = routedHttp({turnstile: {success: true, hostname: PROD_HOST, action: 'contact'}});
  assert.equal((await captureLogs(() => serve(chatRequest(), chatEnv(), wrongAction.http))).result.status, 403);
  assert.equal(wrongAction.calls.llm, 0);
});

test('production chat: rate limit rejection is 429 and skips Turnstile', async () => {
  const {http, calls} = routedHttp();
  const db = {prepare: () => ({bind: () => ({first: async () => null, run: async () => ({}), all: async () => ({results: []})})})};
  const res = await serve(chatRequest(), chatEnv({DB: db}), http);
  assert.equal(res.status, 429);
  assert.equal(calls.turnstile + calls.llm, 0);
});

test('production chat: provider errors, redirects, bad schema and missing key fail safely without leaking secrets', async () => {
  const cases = [
    ...[400, 401, 403, 404, 429, 500].map(status => ({status, llm: () => new Response('provider echoed Bearer llm-secret-value', {status})})),
    ...[301, 302, 307, 308].map(status => ({status, llm: () => new Response('', {status, headers: {Location: 'https://evil.test'}})})),
    {status: 200, llm: () => response({})},
    {status: 200, llm: () => response({choices: [{message: {content: '   '}}]})},
    {status: 200, llm: () => response({choices: [{message: {content: 42}}]})},
  ];
  for (const c of cases) {
    const {http} = routedHttp({llm: c.llm});
    const {result, logs} = await captureLogs(() => serve(chatRequest(), chatEnv(), http));
    assert.equal(result.status, 502, `provider status ${c.status}`);
    const body = await result.text();
    for (const secret of ['ts-secret-value', 'fresh-token', 'k'.repeat(32)]) {
      assert.ok(!body.includes(secret) && !logs.includes(secret), `secret leaked: ${secret.slice(0, 4)}`);
    }
    assert.ok(!body.includes('llm-secret-value'));
  }
  const {http, calls} = routedHttp();
  const res = await serve(chatRequest(), chatEnv({LLM_API_KEY: undefined}), http);
  assert.equal(res.status, 503);
  assert.equal(calls.llm, 0);
});

test('production Worker config keeps observability logs enabled', () => {
  assert.match(fs.readFileSync('wrangler.jsonc', 'utf8'), /"observability":\s*\{"enabled":\s*true/);
});

test('browser Turnstile client never calls turnstile.ready() (throws for injected async scripts)', () => {
  assert.doesNotMatch(fs.readFileSync('static/js/api-client.js', 'utf8'), /turnstile\.ready\(/);
});
