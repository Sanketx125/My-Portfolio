import portfolio from '../.generated/portfolio.json' with {type: 'json'};
import {HttpError, nowSeconds, budget} from './security.mjs';

export function validateCapabilityRegistry(capabilities = portfolio.verifiedCapabilities, factIds = portfolio.verifiedFactIds) {
  const known = new Set(factIds);
  for (const capability of capabilities) {
    if (!capability.id || !capability.evidence_ids?.length || capability.evidence_ids.some(id => !known.has(id))) {
      throw new Error('Invalid verified capability evidence');
    }
  }
  return capabilities;
}

validateCapabilityRegistry();

export function validateContact(data) {
  const fields = {};
  const result = {};
  for (const [key, limit] of Object.entries(portfolio.contactLimits)) {
    if (typeof (data[key] ?? '') !== 'string') { fields[key] = 'Enter text.'; continue; }
    result[key] = (data[key] || '').trim();
    if (result[key].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result[key])) fields[key] = 'Invalid or too long.';
  }
  if (!result.name || /[\r\n]/.test(result.name)) fields.name = 'Please enter your name.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(result.email || '')) fields.email = 'Please enter a valid email address.';
  if (!portfolio.projectTypes.includes(result.project_type)) fields.project_type = 'Please choose a project type.';
  if ((result.message || '').length < 10) fields.message = 'Please add a few details about your project.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Please fix the highlighted fields.', fields);
  if (typeof data.request_id !== 'string' || !/^[a-f0-9-]{36}$/.test(data.request_id)) throw new HttpError(400, 'Invalid submission identifier.');
  return {...result, request_id: data.request_id};
}

/** Provider-neutral application service; HTTP/DB are injected for testability. */
export class AIService {
  constructor(store, env, http) { this.store = store; this.env = env; this.http = http; }
  async reply(data, id) {
    let message = data.message ?? '';
    const mode = data.mode ?? 'default';
    if (typeof message !== 'string' || !['default', 'recruiter', 'jd_match'].includes(mode) || typeof (data.role ?? '') !== 'string') throw new HttpError(400, 'Invalid chat request.');
    if (message.length > portfolio.chatLimit || (data.role || '').length > 80) throw new HttpError(400, 'Message is too long.');
    message = message.trim();
    if (message.startsWith('__pitch__') || (mode === 'recruiter' && !message)) {
      const target = message.replace('__pitch__', '').trim() || data.role;
      message = `Give me a confident 60-second pitch for ${portfolio.name}${target ? ` for a ${target} role` : ' as a candidate'}. Lead with fit, back it with concrete evidence, and close with why a team should hire them.`;
    } else if (mode === 'jd_match' && message && !message.startsWith('Please evaluate')) {
      message = `Please evaluate ${portfolio.name} for the following job description / role requirements:\n\n${message}`;
    }
    if (!message) throw new HttpError(400, "Message can't be empty.");
    if (!this.env.LLM_API_KEY || !this.env.LLM_MODEL) throw new HttpError(503, 'The assistant is unavailable. Please use the contact form.');
    const endpoint = new URL(this.env.LLM_API_BASE);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new HttpError(503, 'The assistant is unavailable.');
    const now = nowSeconds();
    const owner = crypto.randomUUID();
    if (!await this.store.lease(`chat:${id}`, owner, now)) throw new HttpError(429, 'Please wait for the current answer.');
    let slot;
    try {
      for (let i = 0; i < 3; i++) {
        if (await this.store.lease(`llm:${i}`, owner, now)) { slot = `llm:${i}`; break; }
      }
      if (!slot) throw new HttpError(429, 'The assistant is busy. Please retry shortly.');
      await this.store.run('INSERT INTO sessions(id,turns,expires) VALUES(?,0,?) ON CONFLICT(id) DO NOTHING', id, now + 86400);
      if (!await this.store.one('UPDATE sessions SET turns=turns+1 WHERE id=? AND turns<20 RETURNING turns', id)) throw new HttpError(429, 'Conversation limit reached. Please use the contact form.');
      await budget(this.store, 'chat', Number(this.env.CHAT_DAILY_BUDGET));
      const messages = [{role: 'system', content: portfolio.prompts[mode]}, ...await this.store.history(id), {role: 'user', content: message}];
      const response = await this.http(endpoint.href.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${this.env.LLM_API_KEY}`},
        body: JSON.stringify({model: this.env.LLM_MODEL, messages, max_tokens: 500, temperature: 0.5}),
      });
      if (!response.ok) {
        // Log provider detail server-side only; client still gets the generic message.
        console.error('LLM provider error', {status: response.status, model: this.env.LLM_MODEL, body: (await response.text().catch(() => '')).slice(0, 500)});
        throw new HttpError(502, 'The assistant provider is unavailable. Please try later.');
      }
      const result = await response.json();
      const reply = result.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) throw new HttpError(502, 'The assistant provider is unavailable. Please try later.');
      if (mode !== 'jd_match') {
        await this.store.saveChat(id, message, reply.trim());
      }
      return {reply: reply.trim()};
    } finally {
      await this.store.release(`chat:${id}`, owner);
      if (slot) await this.store.release(slot, owner);
    }
  }
}

/** Durable outbox: provider failure never discards an accepted contact. */
export class MailService {
  constructor(store, env, http) { this.store = store; this.env = env; this.http = http; }
  async flush(limit = 4) {
    if (!this.env.BREVO_API_KEY || !this.env.MAIL_FROM || !this.env.CONTACT_TO_EMAIL) return;
    for (let i = 0; i < limit; i++) {
      const now = nowSeconds();
      const owner = crypto.randomUUID();
      const row = await this.store.one(`UPDATE outbox SET owner=?,lease_until=?,attempts=attempts+1
        WHERE id=(SELECT id FROM outbox WHERE state='pending' AND due<=? AND lease_until<=? AND attempts<8 ORDER BY due LIMIT 1)
        RETURNING *`, owner, now + 60, now, now);
      if (!row) return;
      try {
        // Shared cap includes retries; reserve before every external send.
        await budget(this.store, 'email', 100);
        const contact = await this.store.one('SELECT * FROM contacts WHERE id=?', row.contact_id);
        const visitor = row.kind === 'visitor';
        const body = {
          sender: {email: this.env.MAIL_FROM, name: portfolio.name},
          to: [{email: visitor ? contact.email : this.env.CONTACT_TO_EMAIL}],
          subject: visitor ? 'Thanks for reaching out' : 'New portfolio inquiry',
          textContent: visitor
            ? `Hi ${contact.name},\n\nThanks for your message. ${portfolio.name} has received it and will get back to you soon.`
            : `Name: ${contact.name}\nEmail: ${contact.email}\nProject: ${contact.project_type}\nBudget: ${contact.budget || 'Not specified'}\n\n${contact.message}`,
          ...(visitor ? {} : {replyTo: {email: contact.email}}),
        };
        const response = await this.http('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
          headers: {'api-key': this.env.BREVO_API_KEY, 'Content-Type': 'application/json'}, body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Mail provider failure');
        await this.store.run("UPDATE outbox SET state='sent',sent_at=CURRENT_TIMESTAMP,lease_until=0 WHERE id=? AND owner=?", row.id, owner);
      } catch {
        await this.store.run("UPDATE outbox SET state=?,due=?,lease_until=0 WHERE id=? AND owner=?",
          row.attempts >= 8 ? 'failed' : 'pending', now + Math.min(86400, 600 * 2 ** row.attempts), row.id, owner);
      }
    }
  }
}
