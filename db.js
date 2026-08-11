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

  const infoConversations = await client.execute(`PRAGMA table_info(conversations)`);
  if (!infoConversations.rows.some((r) => r.name === "menu_sent_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN menu_sent_at INTEGER`);
  }
  if (!infoConversations.rows.some((r) => r.name === "fluxo_passo")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN fluxo_passo TEXT`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN fluxo_passo_at INTEGER`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN fluxo_lembrete INTEGER DEFAULT 0`);
  }
  if (!infoConversations.rows.some((r) => r.name === "janela_lembrete_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN janela_lembrete_at INTEGER`);
  }
  if (!infoConversations.rows.some((r) => r.name === "status")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN status TEXT NOT NULL DEFAULT 'novo'`);
  }
  if (!infoConversations.rows.some((r) => r.name === "nota")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN nota TEXT`);
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS respostas_prontas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atalho TEXT NOT NULL,
    texto TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

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

  await client.execute(`DROP TABLE IF EXISTS linkedin_leads`);

  await client.execute(`CREATE TABLE IF NOT EXISTS cotacerta_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    nome TEXT,
    whatsapp TEXT,
    email TEXT,
    cpf TEXT,
    detalhes TEXT,
    origem TEXT,
    email_enviado INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);

  // Fila de Reels agendados (Publique IV → vídeos em massa do Google Drive).
  // status: pending | posted | error
  await client.execute(`CREATE TABLE IF NOT EXISTS reels_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT NOT NULL UNIQUE,
    nome_arquivo TEXT,
    posicao INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    legenda TEXT,
    resultado TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    posted_at INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_reels_queue_status ON reels_queue(status, posicao)`);

  const infoReelsQueue = await client.execute(`PRAGMA table_info(reels_queue)`);
  if (!infoReelsQueue.rows.some((r) => r.name === "arquivo_apagado")) {
    await client.execute(`ALTER TABLE reels_queue ADD COLUMN arquivo_apagado INTEGER NOT NULL DEFAULT 0`);
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS reels_config (
    chave TEXT PRIMARY KEY,
    valor TEXT
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

// Tenta "reservar" o direito de enviar o menu automático: só retorna true se o último
// envio foi há mais de `janelaMs` (ou nunca). O UPDATE condicional é atômico no banco,
// então mensagens chegando em paralelo não conseguem duplicar o menu.
async function tentarMarcarMenuEnviado(phone, businessNumberId, janelaMs) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `UPDATE conversations SET menu_sent_at = ?
          WHERE phone = ? AND business_number_id = ?
            AND (menu_sent_at IS NULL OR menu_sent_at < ?)`,
    args: [agora, phone, businessNumberId, agora - janelaMs],
  });
  return result.rowsAffected > 0;
}

// Registra em que passo do fluxo automático a conversa está aguardando resposta
// (passo = null limpa a marcação, ex.: quando o atendimento humano assume).
// Também reseta o lembrete de "manter a janela aberta" — cada novo passo merece
// sua própria chance de keep-alive perto das 24h, caso o cliente demore de novo.
async function setFluxoPasso(phone, businessNumberId, passo) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET fluxo_passo = ?, fluxo_passo_at = ?, fluxo_lembrete = 0, janela_lembrete_at = NULL
          WHERE phone = ? AND business_number_id = ?`,
    args: [passo, passo ? Date.now() : null, phone, businessNumberId],
  });
}

async function listarFluxosAguardando() {
  await ready;
  const result = await client.execute(
    `SELECT phone, business_number_id, fluxo_passo, fluxo_passo_at FROM conversations
     WHERE fluxo_passo IS NOT NULL AND fluxo_lembrete = 0`
  );
  return result.rows;
}

// Atômico: só o primeiro chamador consegue marcar (evita lembrete duplicado)
async function tentarMarcarLembreteEnviado(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `UPDATE conversations SET fluxo_lembrete = 1
          WHERE phone = ? AND business_number_id = ? AND fluxo_lembrete = 0 AND fluxo_passo IS NOT NULL`,
    args: [phone, businessNumberId],
  });
  return result.rowsAffected > 0;
}

// Conversas com fluxo em aberto há quase 24h (janela do WhatsApp pra mensagem
// livre) que ainda não receberam o aviso de "continua aí?" — manda-se UM só,
// entre 20h e 24h de silêncio, pra tentar reabrir a janela antes que feche.
async function listarJanelasParaManter() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT phone, business_number_id, fluxo_passo FROM conversations
          WHERE fluxo_passo IS NOT NULL AND janela_lembrete_at IS NULL
            AND last_message_at <= ? AND last_message_at > ?`,
    args: [agora - 20 * 60 * 60 * 1000, agora - 24 * 60 * 60 * 1000],
  });
  return result.rows;
}

// Atômico: só o primeiro chamador consegue marcar (evita keep-alive duplicado)
async function tentarMarcarJanelaLembreteEnviado(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `UPDATE conversations SET janela_lembrete_at = ?
          WHERE phone = ? AND business_number_id = ? AND janela_lembrete_at IS NULL`,
    args: [Date.now(), phone, businessNumberId],
  });
  return result.rowsAffected > 0;
}

async function getConversation(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM conversations WHERE phone = ? AND business_number_id = ?`,
    args: [phone, businessNumberId],
  });
  return result.rows[0] || null;
}

const STATUS_VALIDOS = ["novo", "andamento", "resolvido"];

async function atualizarStatusConversa(phone, businessNumberId, status) {
  await ready;
  if (!STATUS_VALIDOS.includes(status)) throw new Error(`Status inválido: ${status}`);
  await client.execute({
    sql: `UPDATE conversations SET status = ? WHERE phone = ? AND business_number_id = ?`,
    args: [status, phone, businessNumberId],
  });
}

async function atualizarNotaConversa(phone, businessNumberId, nota) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET nota = ? WHERE phone = ? AND business_number_id = ?`,
    args: [nota || null, phone, businessNumberId],
  });
}

// Busca por texto dentro do corpo das mensagens (não só nome/telefone, que já é filtrado
// no cliente) — devolve 1 linha por conversa que tem alguma mensagem batendo, com o texto
// que bateu, pra usar como resultado de busca "estilo Chatwoot".
async function buscarMensagens(businessNumberId, termo) {
  await ready;
  const result = await client.execute({
    sql: `SELECT phone, body, created_at FROM messages
          WHERE business_number_id = ? AND body LIKE ? AND type = 'text'
          ORDER BY created_at DESC LIMIT 100`,
    args: [businessNumberId, `%${termo}%`],
  });
  const porTelefone = new Map();
  for (const row of result.rows) {
    if (!porTelefone.has(row.phone)) porTelefone.set(row.phone, row); // mais recente primeiro
  }
  return Array.from(porTelefone.values());
}

async function respostasProntasListar() {
  await ready;
  const result = await client.execute(`SELECT * FROM respostas_prontas ORDER BY atalho ASC`);
  return result.rows;
}

async function respostaProntaCriar(atalho, texto) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO respostas_prontas (atalho, texto, created_at) VALUES (?, ?, ?)`,
    args: [atalho, texto, Date.now()],
  });
  return result.lastInsertRowid;
}

async function respostaProntaExcluir(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM respostas_prontas WHERE id = ?`, args: [id] });
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
        (SELECT body FROM messages m WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
        (SELECT direction FROM messages m WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id ORDER BY m.created_at DESC LIMIT 1) AS last_direction
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

async function salvarLeadCotaCerta(lead) {
  await ready;
  const { tipo, nome, whatsapp, email, cpf, detalhes, origem, emailEnviado } = lead;
  const result = await client.execute({
    sql: `INSERT INTO cotacerta_leads (tipo, nome, whatsapp, email, cpf, detalhes, origem, email_enviado, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      tipo || null,
      nome || null,
      whatsapp || null,
      email || null,
      cpf || null,
      detalhes || null,
      origem || null,
      emailEnviado ? 1 : 0,
      Date.now(),
    ],
  });
  return result.lastInsertRowid;
}

async function listarLeadsCotaCerta() {
  await ready;
  const result = await client.execute(`SELECT * FROM cotacerta_leads ORDER BY created_at DESC`);
  return result.rows;
}

// Adiciona à fila os arquivos do Drive que ainda não estão nela (idempotente — pode
// rodar de novo a qualquer momento pra pegar vídeos novos que você jogar na pasta).
// Mantém a ordem de chegada: novos entram sempre no fim da fila.
async function reelsSincronizarFila(arquivos) {
  await ready;
  const maxAtual = await client.execute(`SELECT COALESCE(MAX(posicao), 0) AS m FROM reels_queue`);
  let proxima = (maxAtual.rows[0]?.m || 0) + 1;
  let adicionados = 0;
  for (const arq of arquivos) {
    const result = await client.execute({
      sql: `INSERT INTO reels_queue (drive_file_id, nome_arquivo, posicao, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(drive_file_id) DO NOTHING`,
      args: [arq.id, arq.name, proxima, Date.now()],
    });
    if (result.rowsAffected > 0) {
      proxima++;
      adicionados++;
    }
  }
  return adicionados;
}

async function reelsDefinirLegenda(driveFileId, legenda) {
  await ready;
  await client.execute({
    sql: `UPDATE reels_queue SET legenda = ? WHERE drive_file_id = ?`,
    args: [legenda || null, driveFileId],
  });
}

async function reelsProximosPendentes(quantidade) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM reels_queue WHERE status = 'pending' ORDER BY posicao ASC LIMIT ?`,
    args: [quantidade],
  });
  return result.rows;
}

async function reelsMarcarPostado(id, resultado) {
  await ready;
  await client.execute({
    sql: `UPDATE reels_queue SET status = 'posted', resultado = ?, posted_at = ? WHERE id = ?`,
    args: [JSON.stringify(resultado || {}), Date.now(), id],
  });
}

async function reelsMarcarErro(id, mensagem) {
  await ready;
  await client.execute({
    sql: `UPDATE reels_queue SET status = 'error', resultado = ?, tentativas = tentativas + 1 WHERE id = ?`,
    args: [JSON.stringify({ erro: mensagem }), id],
  });
}

// Devolve um erro pra fila de novo (status volta pra pending) — usado quando o usuário
// pede pra tentar de novo um vídeo que falhou.
async function reelsReenfileirar(id) {
  await ready;
  await client.execute({ sql: `UPDATE reels_queue SET status = 'pending' WHERE id = ?`, args: [id] });
}

// Itens já publicados há mais de X ms cujo arquivo ainda não foi apagado do R2 — usado pela
// limpeza automática (não quer acumular espaço, mas dá uma folga de 24h antes de apagar).
async function reelsPostadosParaLimpar(idadeMinimaMs) {
  await ready;
  const result = await client.execute({
    sql: `SELECT id, drive_file_id FROM reels_queue
          WHERE status = 'posted' AND arquivo_apagado = 0 AND posted_at <= ?`,
    args: [Date.now() - idadeMinimaMs],
  });
  return result.rows;
}

async function reelsMarcarArquivoApagado(id) {
  await ready;
  await client.execute({ sql: `UPDATE reels_queue SET arquivo_apagado = 1 WHERE id = ?`, args: [id] });
}

async function reelsResumo() {
  await ready;
  const result = await client.execute(
    `SELECT status, COUNT(*) AS total FROM reels_queue GROUP BY status`
  );
  const resumo = { pending: 0, posted: 0, error: 0, total: 0 };
  for (const row of result.rows) {
    resumo[row.status] = row.total;
    resumo.total += row.total;
  }
  return resumo;
}

async function reelsListarRecentes(limit = 30) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM reels_queue ORDER BY
            CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
            posicao ASC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows;
}

async function reelsConfigGet(chave) {
  await ready;
  const result = await client.execute({ sql: `SELECT valor FROM reels_config WHERE chave = ?`, args: [chave] });
  return result.rows[0]?.valor ?? null;
}

async function reelsConfigSet(chave, valor) {
  await ready;
  await client.execute({
    sql: `INSERT INTO reels_config (chave, valor) VALUES (?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    args: [chave, valor],
  });
}

module.exports = {
  upsertConversation,
  getConversation,
  tentarMarcarMenuEnviado,
  setFluxoPasso,
  listarFluxosAguardando,
  tentarMarcarLembreteEnviado,
  listarJanelasParaManter,
  tentarMarcarJanelaLembreteEnviado,
  insertMessage,
  updateStatusByWaId,
  listConversations,
  listMessages,
  instagramJaFoiSaudado,
  instagramMarcarSaudado,
  instagramLimparSaudados,
  telegramUpsertContact,
  telegramListContacts,
  salvarLeadCotaCerta,
  listarLeadsCotaCerta,
  reelsSincronizarFila,
  reelsDefinirLegenda,
  reelsProximosPendentes,
  reelsMarcarPostado,
  reelsMarcarErro,
  reelsReenfileirar,
  reelsPostadosParaLimpar,
  reelsMarcarArquivoApagado,
  reelsResumo,
  reelsListarRecentes,
  reelsConfigGet,
  reelsConfigSet,
  atualizarStatusConversa,
  atualizarNotaConversa,
  buscarMensagens,
  respostasProntasListar,
  respostaProntaCriar,
  respostaProntaExcluir,
};
