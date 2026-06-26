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

  const infoMessages = await client.execute(`PRAGMA table_info(messages)`);
  if (!infoMessages.rows.some((r) => r.name === "error_message")) {
    await client.execute(`ALTER TABLE messages ADD COLUMN error_message TEXT`);
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS instagram_dm_contacts (
    instagram_user_id TEXT PRIMARY KEY,
    welcomed_at INTEGER
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS telegram_contacts (
    chat_id TEXT PRIMARY KEY,
    telegram_user_id TEXT,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    phone TEXT,
    start_param TEXT,
    created_at INTEGER NOT NULL
  )`);
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

async function updateStatusByWaId(waMessageId, status, errorMessage = null) {
  await ready;
  await client.execute({
    sql: `UPDATE messages SET status = ?, error_message = COALESCE(?, error_message) WHERE wa_message_id = ?`,
    args: [status, errorMessage, waMessageId],
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

async function instagramJaFoiSaudado(userId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT 1 FROM instagram_dm_contacts WHERE instagram_user_id = ?`,
    args: [userId],
  });
  return result.rows.length > 0;
}

async function instagramMarcarSaudado(userId) {
  await ready;
  await client.execute({
    sql: `INSERT INTO instagram_dm_contacts (instagram_user_id, welcomed_at) VALUES (?, ?)
          ON CONFLICT(instagram_user_id) DO NOTHING`,
    args: [userId, Date.now()],
  });
}

async function instagramLimparSaudados() {
  await ready;
  const result = await client.execute(`DELETE FROM instagram_dm_contacts`);
  return result.rowsAffected;
}

async function telegramUpsertContact(c) {
  await ready;
  await client.execute({
    sql: `INSERT INTO telegram_contacts (chat_id, telegram_user_id, first_name, last_name, username, phone, start_param, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chat_id) DO UPDATE SET
            telegram_user_id = excluded.telegram_user_id,
            first_name = COALESCE(excluded.first_name, telegram_contacts.first_name),
            last_name = COALESCE(excluded.last_name, telegram_contacts.last_name),
            username = COALESCE(excluded.username, telegram_contacts.username),
            phone = COALESCE(excluded.phone, telegram_contacts.phone),
            start_param = COALESCE(excluded.start_param, telegram_contacts.start_param)`,
    args: [
      c.chat_id,
      c.telegram_user_id || null,
      c.first_name || null,
      c.last_name || null,
      c.username || null,
      c.phone || null,
      c.start_param || null,
      c.created_at,
    ],
  });
}

async function telegramListContacts() {
  await ready;
  const result = await client.execute(`SELECT * FROM telegram_contacts ORDER BY created_at DESC`);
  return result.rows;
}

module.exports = {
  upsertConversation,
  insertMessage,
  updateStatusByWaId,
  listConversations,
  listMessages,
  instagramJaFoiSaudado,
  instagramMarcarSaudado,
  instagramLimparSaudados,
  telegramUpsertContact,
  telegramListContacts,
};
