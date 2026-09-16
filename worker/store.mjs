/** D1 adapter: all user input is bound; operations use atomic SQL/batches. */
export class Store {
  constructor(db) { this.db = db; }
  statement(sql, ...args) { return this.db.prepare(sql).bind(...args); }
  async one(sql, ...args) { return this.statement(sql, ...args).first(); }
  async run(sql, ...args) { return this.statement(sql, ...args).run(); }
  async all(sql, ...args) { return (await this.statement(sql, ...args).all()).results; }
  async reserve(key, cap, expires) {
    return !!await this.one(`INSERT INTO counters(key,count,expires) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`, key, expires, cap);
  }
  async lease(key, owner, now, seconds = 45) {
    return !!await this.one(`INSERT INTO leases(key,owner,expires) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expires=excluded.expires
      WHERE leases.expires<=? RETURNING key`, key, owner, now + seconds, now);
  }
  async release(key, owner) { await this.run('DELETE FROM leases WHERE key=? AND owner=?', key, owner); }
  async history(id) {
    return (await this.all('SELECT role,content FROM chat_messages WHERE session_id=? ORDER BY id DESC LIMIT 20', id)).reverse();
  }
  async saveChat(id, message, reply) {
    await this.db.batch([
      this.statement("INSERT INTO chat_messages(session_id,role,content) VALUES(?,'user',?)", id, message),
      this.statement("INSERT INTO chat_messages(session_id,role,content) VALUES(?,'assistant',?)", id, reply),
      this.statement('DELETE FROM chat_messages WHERE session_id=? AND id NOT IN (SELECT id FROM chat_messages WHERE session_id=? ORDER BY id DESC LIMIT 20)', id, id),
    ]);
  }
  async saveContact(data) {
    const {name, email, project_type, budget, message, request_id} = data;
    await this.db.batch([
      this.statement('INSERT INTO contacts(name,email,project_type,budget,message,request_id) VALUES(?,?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING', name, email, project_type, budget, message, request_id),
      ...['owner', 'visitor'].map(kind => this.statement(`INSERT INTO outbox(id,contact_id,kind)
        SELECT ?,id,? FROM contacts WHERE request_id=? ON CONFLICT(contact_id,kind) DO NOTHING`, `${request_id}:${kind}`, kind, request_id)),
    ]);
  }
  async cache(key) { return this.one('SELECT value,expires FROM cache WHERE key=?', key); }
  async putCache(key, value, expires) {
    await this.run('INSERT INTO cache(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires', key, JSON.stringify(value), expires);
  }
  async cleanup(now) {
    await this.db.batch([
      this.statement('DELETE FROM counters WHERE expires<?', now),
      this.statement('DELETE FROM leases WHERE expires<?', now),
      this.statement('DELETE FROM sessions WHERE expires<?', now),
      this.statement("DELETE FROM chat_messages WHERE created_at < datetime('now','-30 days')"),
    ]);
  }
}
