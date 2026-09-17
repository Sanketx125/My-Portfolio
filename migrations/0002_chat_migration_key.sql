ALTER TABLE chat_messages ADD COLUMN source_key TEXT;
CREATE UNIQUE INDEX ix_chat_source_key ON chat_messages(source_key) WHERE source_key IS NOT NULL;
