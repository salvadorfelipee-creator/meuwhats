const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function defaultBusinessNumberId() {
  if (process.env.PHONE_NUMBERS_JSON) {
    const list = JSON.parse(process.env.PHONE_NUMBERS_JSON);
    if (list[0]?.id) return list[0].id;
  }
  return process.env.PHONE_NUMBER_ID || "";
}

async function migrarTabelaLegada(tabela, colunasOriginais, criarNova, colunasParaCopiar) {
  const info = await client.execute(`PRAGMA table_info(${tabela})`);
  const colunas = info.rows.map((r) => r.name);
  if (colunas.length === 0 || colunas.includes("business_number_id")) return;

  const legada = `${tabela}_legado`;
  await client.execute(`ALTER TABLE ${tabela} RENAME TO ${legada}`);
  await client.execute(criarNova);
  await client.execute({
    sql: `INSERT INTO ${tabela} (${colunasParaCopiar.join(", ")})
          SELECT ${colunasParaCopiar.map((c) => (c === "business_number_id" ? "?" : c)).join(", ")}
          FROM ${legada}`,
    args: [defaultBusinessNumberId()],
  });
  await client.execute(`DROP TABLE ${legada}`);
}

const ready = (async () => {
  await client.execute(`CREATE TABLE IF NOT EXISTS conversations (
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    name TEXT,
    last_message_at INTEGER,
    PRIMARY KEY (phone, business_number_id)
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    type TEXT NOT NULL,
    body TEXT,
    media_path TEXT,
    media_mime TEXT,
    status TEXT,
    wa_message_id TEXT,
    created_at INTEGER NOT NULL
  )`);

  await migrarTabelaLegada(
    "conversations",
    [],
    `CREATE TABLE conversations (
      phone TEXT NOT NULL,
      business_number_id TEXT NOT NULL,
      name TEXT,
      last_message_at INTEGER,
      PRIMARY KEY (phone, business_number_id)
    )`,
    ["phone", "business_number_id", "name", "last_message_at"]
  );

  await migrarTabelaLegada(
    "messages",
    [],
    `CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      business_number_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      type TEXT NOT NULL,
      body TEXT,
      media_path TEXT,
      media_mime TEXT,
      status TEXT,
      wa_message_id TEXT,
      created_at INTEGER NOT NULL
    )`,
    ["phone", "business_number_id", "direction", "type", "body", "media_path", "media_mime", "status", "wa_message_id", "created_at"]
  );

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone, business_number_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id)`);
})();

async function upsertConversation(phone, businessNumberId, name, when) {
  await ready;
  await client.execute({
    sql: `INSERT INTO conversations (phone, business_number_id, name, last_message_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(phone, business_number_id) DO UPDATE SET
            name = COALESCE(excluded.name, conversations.name),
            last_message_at = excluded.last_message_at`,
    args: [phone, businessNumberId, name || null, when],
  });
}

async function insertMessage(msg) {
  await ready;
  const {
    phone,
    business_number_id,
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
    sql: `INSERT INTO messages (phone, business_number_id, direction, type, body, media_path, media_mime, status, wa_message_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [phone, business_number_id, direction, type, body, media_path, media_mime, status, wa_message_id, created_at],
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

async function listConversations(businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `
      SELECT c.*,
        (SELECT type FROM messages m WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id ORDER BY m.created_at DESC LIMIT 1) AS last_type,
        (SELECT body FROM messages m WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id ORDER BY m.created_at DESC LIMIT 1) AS last_body
      FROM conversations c
      WHERE c.business_number_id = ?
      ORDER BY c.last_message_at DESC
    `,
    args: [businessNumberId],
  });
  return result.rows;
}

async function listMessages(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM messages WHERE phone = ? AND business_number_id = ? ORDER BY created_at ASC`,
    args: [phone, businessNumberId],
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
