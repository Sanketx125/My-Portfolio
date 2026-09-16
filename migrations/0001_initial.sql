CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL, project_type TEXT NOT NULL,
  budget TEXT, message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_id TEXT UNIQUE
);
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_contacts_created ON contacts(created_at);
CREATE INDEX ix_chat_session ON chat_messages(session_id,id);
CREATE INDEX ix_chat_created ON chat_messages(created_at);
CREATE TABLE counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX ix_counter_expires ON counters(expires);
CREATE TABLE leases (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, turns INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL);
CREATE TABLE outbox (
  id TEXT PRIMARY KEY, contact_id INTEGER NOT NULL REFERENCES contacts(id),
  kind TEXT NOT NULL CHECK(kind IN ('owner','visitor')),
  attempts INTEGER NOT NULL DEFAULT 0, due INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'pending', lease_until INTEGER NOT NULL DEFAULT 0,
  owner TEXT, sent_at TEXT,
  UNIQUE(contact_id,kind)
);
CREATE INDEX ix_outbox_due ON outbox(state,due,lease_until);
CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE migration_runs (id TEXT PRIMARY KEY, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
