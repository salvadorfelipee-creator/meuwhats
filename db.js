const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const ready = client.batch(
  [
    `CREATE TABLE IF NOT EXISTS conversations (
      phone TEXT PRIMARY KEY,
      name TEXT,
      last_message_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      type TEXT NOT NULL,
      body TEXT,
      media_path TEXT,
      media_mime TEXT,
      status TEXT,
      wa_message_id TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id)`,
  ],
  "write"
);

async function upsertConversation(phone, name, when) {
  await ready;
  await client.execute({
    sql: `INSERT INTO conversations (phone, name, last_message_at)
          VALUES (?, ?, ?)
          ON CONFLICT(phone) DO UPDATE SET
            name = COALESCE(excluded.name, conversations.name),
            last_message_at = excluded.last_message_at`,
    args: [phone, name || null, when],
  });
}

async function insertMessage(msg) {
  await ready;
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
  const result = await client.execute({
    sql: `INSERT INTO messages (phone, direction, type, body, media_path, media_mime, status, wa_message_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [phone, direction, type, body, media_path, media_mime, status, wa_message_id, created_at],
  });
  return result.lastInsertRowid;
}

async function updateStatusByWaId(waMessageId, status) {
  await ready;
  await client.execute({
    sql: `UPDATE messages SET status = ? WHERE wa_message_id = ?`,
    args: [status, waMessageId],
  });
}

async function listConversations() {
  await ready;
  const result = await client.execute(`SELECT * FROM conversations ORDER BY last_message_at DESC`);
  return result.rows;
}

async function listMessages(phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM messages WHERE phone = ? ORDER BY created_at ASC`,
    args: [phone],
  });
  return result.rows;
}

module.exports = {
  upsertConversation,
  insertMessage,
  updateStatusByWaId,
  listConversations,
  listMessages,
};
