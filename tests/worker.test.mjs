import test from 'node:test';
import assert from 'node:assert/strict';
import nunjucks from 'nunjucks/browser/nunjucks-slim.js';
import templateData from '../.generated/github-template.mjs';
import {AIService, MailService, validateContact} from '../worker/services.mjs';
import {GitHubService} from '../worker/github.mjs';
import {HttpError, checkOrigin, rateLimit, readJSON, session, verifyChallenge} from '../worker/security.mjs';

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

test('request parsing and exact origin checks fail closed', async () => {
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{}'})), error => error.status === 415);
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{bad'})), error => error.status === 400);
  await assert.rejects(readJSON(new Request('https://site.test/api', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({message: 'x'.repeat(13000)})})), error => error.status === 413);
  assert.throws(() => checkOrigin(new Request('https://site.test/api', {headers: {Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site'}}), {SITE_URL: 'https://site.test'}), error => error.status === 403);
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
  assert.equal(result.totals.private_repos, 4);
  assert.equal(result.featured[0].description, '<script>');
  assert.doesNotMatch(JSON.stringify(result), /private-token/);
  assert.ok(store.cacheValue);
  const cached = await new GitHubService(store, env, async () => { throw new Error('network should not run'); }).get();
  assert.deepEqual(cached, result);
});

test('precompiled GitHub template autoescapes API text', () => {
  const env = new nunjucks.Environment([], {autoescape: true});
  env.addFilter('sliceFirst', (items, n) => items.slice(0, n));
  const template = new nunjucks.Template({type: 'code', obj: templateData}, env, 'github', true);
  const html = template.render({github: {configured: false, featured: [{name: '<img src=x onerror=1>', description: '<script>', url: 'https://github.com/a/b'}]}, content: {socials: {}}});
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
