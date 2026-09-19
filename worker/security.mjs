export class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}
export const nowSeconds = () => Math.floor(Date.now() / 1000);
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000',
    ...(status === 429 ? {'Retry-After': '60'} : {}),
  }});
}
export async function readJSON(request, limit = 12000) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Use JSON.');
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'JSON object required.');
  let size = 0;
  const chunks = [];
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    return data;
  } catch { throw new HttpError(400, 'JSON object required.'); }
}
export function checkOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!env.SITE_URL || origin !== env.SITE_URL || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'Request origin is not allowed.');
  }
}
async function key(secret) {
  if (!secret || secret.length < 32) throw new HttpError(503, 'Service is not configured.');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
export async function digest(secret, value) {
  return hex(await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(value)));
}
export async function session(request, env) {
  const token = /(?:^|;\s*)__Host-portfolio=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
  if (token && /^[a-f0-9-]{36}\.\d{10}\.[a-f0-9]{64}$/.test(token)) {
    const [id, expires, signature] = token.split('.');
    const bytes = new Uint8Array(signature.match(/../g).map(x => parseInt(x, 16)));
    const valid = await crypto.subtle.verify('HMAC', await key(env.SESSION_SECRET), bytes, new TextEncoder().encode(`${id}.${expires}`));
    if (valid && Number(expires) > nowSeconds()) return {id, cookie: null};
  }
  const id = crypto.randomUUID();
  const value = `${id}.${nowSeconds() + 86400}`;
  return {id, cookie: `__Host-portfolio=${value}.${await digest(env.SESSION_SECRET, value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`};
}
export async function rateLimit(store, request, env, action) {
  const now = nowSeconds();
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) throw new HttpError(503, 'Client verification unavailable.');
  const hash = await digest(env.SESSION_SECRET, `${Math.floor(now / 86400)}:${ip}`);
  const perMinute = action === 'chat' ? 6 : action === 'contact' ? 3 : 20;
  if (!await store.reserve(`ip:${action}:${hash}:${Math.floor(now / 60)}`, perMinute, now + 120)) throw new HttpError(429, 'Too many requests. Please wait.');
  if (action !== 'github' && !await store.reserve(`day:${action}:${hash}`, action === 'chat' ? 20 : 5, now + 86400)) throw new HttpError(429, 'Daily request limit reached.');
}
export async function verifyChallenge(data, request, env, action, http) {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, 'Verification is not configured.');
  if (typeof data.turnstile_token !== 'string' || data.turnstile_token.length > 2048 || !data.turnstile_token) throw new HttpError(403, 'Please complete verification.');
  const response = await http('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({secret: env.TURNSTILE_SECRET_KEY, response: data.turnstile_token, remoteip: request.headers.get('cf-connecting-ip')}),
    signal: AbortSignal.timeout(8000), redirect: 'manual',
  });
  if (!response.ok) throw new HttpError(503, 'Verification unavailable.');
  const result = await response.json();
  if (!result.success || result.hostname !== new URL(env.SITE_URL).hostname || result.action !== action) throw new HttpError(403, 'Verification failed. Please retry.');
}
export async function budget(store, action, cap) {
  const now = nowSeconds();
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) throw new HttpError(503, 'Service budget is not configured.');
  if (!await store.reserve(`global:${action}:${Math.floor(now / 86400)}`, cap, now + 172800)) throw new HttpError(429, 'Daily service limit reached. Please try tomorrow.');
}
