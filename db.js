const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "data.db"));
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT PRIMARY KEY,
    name TEXT,
    last_message_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL,      -- 'in' | 'out'
    type TEXT NOT NULL,           -- text | image | audio | document | other
    body TEXT,                    -- texto da mensagem
    media_path TEXT,              -- caminho local servido em /media/...
    media_mime TEXT,
    status TEXT,                  -- received | sent | delivered | read | failed
    wa_message_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
  CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
`);

function upsertConversation(phone, name, when) {
  db.prepare(
    `INSERT INTO conversations (phone, name, last_message_at)
     VALUES (?, ?, ?)
     ON CONFLICT(phone) DO UPDATE SET
       name = COALESCE(excluded.name, conversations.name),
       last_message_at = excluded.last_message_at`
  ).run(phone, name || null, when);
}

function insertMessage(msg) {
  const {
    phone,
    direction,
    type,
    body = null,
    media_path = null,
    media_mime = null,
    status = null,
    wa_message_id = null,
    created_at,
  } = msg;
  const result = db
    .prepare(
      `INSERT INTO messages (phone, direction, type, body, media_path, media_mime, status, wa_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(phone, direction, type, body, media_path, media_mime, status, wa_message_id, created_at);
  return result.lastInsertRowid;
}

function updateStatusByWaId(waMessageId, status) {
  db.prepare(`UPDATE messages SET status = ? WHERE wa_message_id = ?`).run(status, waMessageId);
}

function listConversations() {
  return db.prepare(`SELECT * FROM conversations ORDER BY last_message_at DESC`).all();
}

function listMessages(phone) {
  return db
    .prepare(`SELECT * FROM messages WHERE phone = ? ORDER BY created_at ASC`)
    .all(phone);
}

module.exports = {
  db,
  upsertConversation,
  insertMessage,
  updateStatusByWaId,
  listConversations,
  listMessages,
};
