const { createClient } = require("@libsql/client");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Item travado em 'processing' por mais tempo que isso é considerado órfão (servidor caiu ou
// foi redeployado no meio da publicação) e pode ser reclamado de novo pelo agendador — senão
// ficaria pendurado pra sempre sem nunca sair nem aparecer como erro pra dar "Tentar de novo".
// Usado tanto pelo agendaProximoDevido (posts) quanto pelo reelsProximoAgendadoDevido (vídeos).
const PROCESSING_ORFAO_MS = 10 * 60 * 1000;

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
  // last_inbound_at (só mensagem DO CLIENTE, atualizado em insertMessage) vs last_read_at (só
  // quando um humano abre a conversa no painel, ver marcarConversaLida). "Não lida" é
  // last_inbound_at > last_read_at — nunca "a última mensagem é de entrada", porque isso
  // quebra assim que o fluxo automático responde sozinho logo em seguida (o bot manda uma
  // mensagem de saída e a mensagem do cliente que ninguém viu de verdade "some" da checagem).
  if (!infoConversations.rows.some((r) => r.name === "last_inbound_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN last_inbound_at INTEGER`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN last_read_at INTEGER`);
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
  if (!infoReelsQueue.rows.some((r) => r.name === "agendado_para")) {
    // Horário exato de publicação (opcional) — data+hora, não só data. Sem isso, o vídeo
    // publica na ordem normal da fila (piloto automático, N por dia).
    await client.execute(`ALTER TABLE reels_queue ADD COLUMN agendado_para INTEGER`);
  }
  if (!infoReelsQueue.rows.some((r) => r.name === "claimed_at")) {
    // Mesma trava anti-duplicata do posts_agendados (ver ali) — evita publicar o mesmo vídeo
    // duas vezes se dois ticks do setInterval se sobrepuserem.
    await client.execute(`ALTER TABLE reels_queue ADD COLUMN claimed_at INTEGER`);
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS reels_config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  )`);

  // Agenda de publicações (Publique IV → posts de texto/imagem multi-rede, agendados pelo
  // usuário um a um, cada um com seu próprio dia+hora — diferente da fila de Reels, aqui não
  // tem "piloto automático": todo item tem agendado_para definido na criação.
  await client.execute(`CREATE TABLE IF NOT EXISTS posts_agendados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id TEXT NOT NULL DEFAULT 'felizcred',
    texto TEXT,
    link TEXT,
    imagem_key TEXT,
    redes TEXT NOT NULL,
    agendado_para INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    resultado TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    posted_at INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_posts_agendados_status ON posts_agendados(status, agendado_para)`);

  // imagem_keys (JSON array) guarda o post agendado do tipo carrossel (2+ imagens) — imagem_key
  // (singular) continua existindo pra post de imagem única, os dois convivem no mesmo item.
  const colunasAgendados = (await client.execute(`PRAGMA table_info(posts_agendados)`)).rows.map((r) => r.name);
  if (!colunasAgendados.includes("imagem_keys")) {
    await client.execute(`ALTER TABLE posts_agendados ADD COLUMN imagem_keys TEXT`);
  }
  // imagem_por_rede_keys (JSON objeto { rede: key }) — versão da imagem ajustada manualmente
  // (reenquadrada/reposicionada no painel) pra uma rede específica, ex. Stories 9:16. Quando
  // existe pra uma rede, vence a imagem padrão só naquela rede na hora de publicar.
  if (!colunasAgendados.includes("imagem_por_rede_keys")) {
    await client.execute(`ALTER TABLE posts_agendados ADD COLUMN imagem_por_rede_keys TEXT`);
  }
  // claimed_at — marca quando o agendador "reservou" o post pra publicar (status vira
  // 'processing'). Sem isso, dois ticks do setInterval (a cada 60s) podiam pegar o MESMO post
  // ainda 'pending' se a publicação anterior (upload de carrossel + várias redes) demorasse
  // mais que 60s — resultado: post duplicado no Instagram. Ver agendaProximoDevido.
  if (!colunasAgendados.includes("claimed_at")) {
    await client.execute(`ALTER TABLE posts_agendados ADD COLUMN claimed_at INTEGER`);
  }
  // video_key — post agendado do tipo Reels (vídeo), mesmo bucket/prefixo "posts/" das
  // imagens. Convive com imagem_key/imagem_keys no mesmo item (cada post só usa um dos três).
  if (!colunasAgendados.includes("video_key")) {
    await client.execute(`ALTER TABLE posts_agendados ADD COLUMN video_key TEXT`);
  }

  // Eventos do funil de qualificação (CLT por enquanto) — 1 linha por contato+etapa, pra dar
  // pra contar "quantos passaram por aqui essa semana" sem depender do estado ATUAL da
  // conversa (que só guarda o passo de agora, não o histórico). Ver logFunil em server.js.
  await client.execute(`CREATE TABLE IF NOT EXISTS funil_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    etapa TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_funil_eventos_etapa ON funil_eventos(etapa, created_at)`);

  // Fila de envio em massa com intervalo entre mensagens (ex.: "manda uma a cada 35min") — o
  // 1º contato do broadcast sai na hora (rota original), os demais caem aqui com seu próprio
  // agendado_para e são processados pelo agendador (ver broadcastProximoDevido em server.js).
  // Mesma trava anti-duplicata (status 'processing' + claimed_at) do posts_agendados/reels_queue.
  await client.execute(`CREATE TABLE IF NOT EXISTS broadcast_agendado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    template TEXT NOT NULL,
    language TEXT NOT NULL,
    body_preview TEXT,
    agendado_para INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    erro TEXT,
    claimed_at INTEGER,
    sent_at INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_broadcast_agendado_status ON broadcast_agendado(status, agendado_para)`);

  // Mescla duplicatas causadas pelo "9º dígito" do celular brasileiro (mesmo contato virando
  // duas conversas — uma com 5X99XXXXXXXX, outra com 5X9XXXXXXXX — dependendo de qual formato
  // entrou primeiro). server.js agora normaliza tudo antes de gravar (normalizarTelefoneBR),
  // isso aqui só limpa quem já ficou duplicado antes dessa correção. Idempotente: roda toda
  // inicialização, só mexe se achar de fato um par duplicado.
  const todasConversas = await client.execute(`SELECT phone, business_number_id, name, last_message_at FROM conversations`);
  for (const row of todasConversas.rows) {
    const digitos = String(row.phone);
    if (!/^55\d{10}$/.test(digitos)) continue; // só o formato "sem o 9" (12 dígitos: 55+DDD+8)
    const canonico = `55${digitos.slice(2, 4)}9${digitos.slice(4)}`;
    const par = await client.execute({
      sql: `SELECT name, last_message_at FROM conversations WHERE phone = ? AND business_number_id = ?`,
      args: [canonico, row.business_number_id],
    });
    if (!par.rows.length) continue; // não existe o par canônico — número sem o 9 mesmo, deixa
    await client.execute({
      sql: `UPDATE messages SET phone = ? WHERE phone = ? AND business_number_id = ?`,
      args: [canonico, digitos, row.business_number_id],
    });
    await client.execute({
      sql: `UPDATE conversations SET name = COALESCE(name, ?), last_message_at = MAX(last_message_at, ?)
            WHERE phone = ? AND business_number_id = ?`,
      args: [row.name, row.last_message_at || 0, canonico, row.business_number_id],
    });
    await client.execute({
      sql: `DELETE FROM conversations WHERE phone = ? AND business_number_id = ?`,
      args: [digitos, row.business_number_id],
    });
  }
})();

async function upsertConversation(phone, businessNumberId, name, when) {
  await ready;
  await client.execute({
    sql: `INSERT INTO conversations (phone, business_number_id, name, last_message_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(phone, business_number_id) DO UPDATE SET
            name = COALESCE(excluded.name, conversations.name),
            last_message_at = MAX(excluded.last_message_at, COALESCE(conversations.last_message_at, 0))`,
    args: [phone, businessNumberId, name || null, when],
  });
}

// Mensagem com esse id externo (wa_message_id — nome herdado do WhatsApp, mas guarda o id
// nativo de qualquer canal) já foi gravada? Usado pra importar histórico sem duplicar quem
// já chegou por webhook antes da importação rodar (ver instagramImportarHistorico em server.js).
async function mensagemExistePorId(idExterno) {
  await ready;
  if (!idExterno) return false;
  const result = await client.execute({
    sql: `SELECT 1 FROM messages WHERE wa_message_id = ? LIMIT 1`,
    args: [idExterno],
  });
  return result.rows.length > 0;
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

// `fluxo_lembrete` é um CONTADOR (0, 1, 2...), não mais um flag booleano — permite mais de
// um toque de lembrete por passo (ver LEMBRETE_MINUTOS em server.js, que agora aceita um
// array de minutos por passo em vez de só um número). Sem filtro de contador aqui: quem já
// recebeu todos os toques configurados pro passo dele é descartado no lado do JS
// (server.js), que é quem sabe quantos toques cada passo tem.
async function listarFluxosAguardando() {
  await ready;
  const result = await client.execute(
    `SELECT phone, business_number_id, fluxo_passo, fluxo_passo_at, fluxo_lembrete FROM conversations
     WHERE fluxo_passo IS NOT NULL`
  );
  return result.rows;
}

// Atômico: incrementa de `esperado` pra `esperado + 1` — só quem lê o contador exatamente
// nesse valor consegue (evita dois ticks do setInterval mandarem o mesmo toque duas vezes).
async function tentarMarcarLembreteEnviado(phone, businessNumberId, esperado) {
  await ready;
  const result = await client.execute({
    sql: `UPDATE conversations SET fluxo_lembrete = ?
          WHERE phone = ? AND business_number_id = ? AND fluxo_lembrete = ? AND fluxo_passo IS NOT NULL`,
    args: [esperado + 1, phone, businessNumberId, esperado],
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

// Só a última mensagem RECEBIDA (direction='in') — diferente de conversations.last_message_at,
// que mistura envio e recebimento. Bug real (2026-08-19): mandar um template de campanha já
// atualiza last_message_at na hora do envio, então quando o cliente responde segundos depois,
// a checagem de "conversa inativa" (que decide se dispara o fluxo automático) via
// last_message_at achava que a conversa "já estava ativa" (por causa do PRÓPRIO envio nosso) e
// nunca disparava o fluxo pra quem respondia rápido — exatamente o caso mais comum. Usado só
// pra decidir se dispara o fluxo automático; last_message_at continua servindo pra tudo mais
// (ordenação da caixa de entrada, janela de 24h etc.).
async function getUltimaMensagemRecebida(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT MAX(created_at) AS ultimo FROM messages WHERE phone = ? AND business_number_id = ? AND direction = 'in'`,
    args: [phone, businessNumberId],
  });
  return result.rows[0]?.ultimo || null;
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
  if (direction === "in") {
    // Marca a hora da mensagem DO CLIENTE, separado de last_message_at (que conta qualquer
    // direção) — é contra isso que comparamos last_read_at pra saber se ficou não lida.
    await client.execute({
      sql: `UPDATE conversations SET last_inbound_at = MAX(COALESCE(last_inbound_at, 0), ?)
            WHERE phone = ? AND business_number_id = ?`,
      args: [created_at, phone, business_number_id],
    });
  }
  return result.lastInsertRowid;
}

// Chamado quando um humano abre a conversa no painel (GET .../messages) — é a ÚNICA coisa
// que conta como "li", nunca uma resposta automática do fluxo.
async function marcarConversaLida(phone, businessNumberId) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET last_read_at = ? WHERE phone = ? AND business_number_id = ?`,
    args: [Date.now(), phone, businessNumberId],
  });
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
        (SELECT direction FROM messages m WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id ORDER BY m.created_at DESC LIMIT 1) AS last_direction,
        (c.last_inbound_at IS NOT NULL AND (c.last_read_at IS NULL OR c.last_inbound_at > c.last_read_at)) AS nao_lida
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

// Só pega quem NÃO tem horário exato marcado — quem tem horário é publicado pelo caminho
// dedicado (reelsProximoAgendadoDevido), checado a cada minuto, pra sair na hora certa em
// vez de esperar o próximo horário automático do dia.
async function reelsProximosPendentes(quantidade) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM reels_queue WHERE status = 'pending' AND agendado_para IS NULL
          ORDER BY posicao ASC LIMIT ?`,
    args: [quantidade],
  });
  return result.rows;
}

// Vídeo com horário exato marcado cuja hora já chegou — checado a cada minuto pelo
// agendador, furando a fila automática pra sair no horário certo (não só "algum dia depois
// dessa data" — é o horário mesmo, com ~1min de margem). Reserva o vídeo (status vira
// 'processing') com a mesma trava anti-duplicata do agendaProximoDevido (ver ali) — sem isso,
// se a publicação de um vídeo demorasse mais que o intervalo de 60s do agendador, o próximo
// tick pegava o MESMO vídeo ainda 'pending' e postava de novo.
async function reelsProximoAgendadoDevido() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT * FROM reels_queue
          WHERE (status = 'pending' AND agendado_para IS NOT NULL AND agendado_para <= ?)
             OR (status = 'processing' AND agendado_para IS NOT NULL AND claimed_at <= ?)
          ORDER BY agendado_para ASC LIMIT 1`,
    args: [agora, agora - PROCESSING_ORFAO_MS],
  });
  const item = result.rows[0];
  if (!item) return null;

  const claim = await client.execute({
    sql: `UPDATE reels_queue SET status = 'processing', claimed_at = ? WHERE id = ? AND status = ?`,
    args: [agora, item.id, item.status],
  });
  if (claim.rowsAffected === 0) return null; // outro tick já reservou esse vídeo primeiro

  return item;
}

// Fila inteira de pendentes (não só os elegíveis agora) — pra mostrar no painel com data
// prevista de cada um, mesmo os que ainda estão esperando a data mínima chegar.
async function reelsFilaCompleta() {
  await ready;
  const result = await client.execute(
    `SELECT * FROM reels_queue WHERE status = 'pending' ORDER BY posicao ASC`
  );
  return result.rows;
}

async function reelsBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM reels_queue WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function reelsBuscarPorDriveFileId(driveFileId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM reels_queue WHERE drive_file_id = ?`, args: [driveFileId] });
  return result.rows[0] || null;
}

async function reelsDefinirData(id, timestampMs) {
  await ready;
  await client.execute({ sql: `UPDATE reels_queue SET agendado_para = ? WHERE id = ?`, args: [timestampMs, id] });
}

// Some com o item da fila (usado pelo botão "Remover") — o arquivo no R2 é apagado por
// quem chamar isso (reels.js), aqui só cuida da linha no banco.
async function reelsRemover(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM reels_queue WHERE id = ?`, args: [id] });
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

async function agendaCriar({ contaId, texto, link, imagemKey, imagemKeys, imagemPorRedeKeys, videoKey, redes, agendadoPara }) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO posts_agendados (conta_id, texto, link, imagem_key, imagem_keys, imagem_por_rede_keys, video_key, redes, agendado_para, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      contaId,
      texto || null,
      link || null,
      imagemKey || null,
      imagemKeys && imagemKeys.length ? JSON.stringify(imagemKeys) : null,
      imagemPorRedeKeys && Object.keys(imagemPorRedeKeys).length ? JSON.stringify(imagemPorRedeKeys) : null,
      videoKey || null,
      JSON.stringify(redes),
      agendadoPara,
      Date.now(),
    ],
  });
  return Number(result.lastInsertRowid); // vem como BigInt do driver — JSON.stringify não serializa BigInt
}

// Próximo post cuja hora já chegou — checado a cada minuto pelo agendador (mesmo
// mecanismo do reelsProximoAgendadoDevido, ver server.js). Reserva o post (status vira
// 'processing') numa segunda query condicionada a `status ainda igual ao que a gente leu` —
// isso garante que, mesmo se dois ticks do setInterval se sobrepuserem (publicação anterior
// demorou mais que os 60s do intervalo), só um dos dois consegue reservar o mesmo post; o
// outro recebe rowsAffected = 0 e desiste. Sem essa trava o mesmo post saía duplicado nas
// redes (viu isso acontecer no Instagram em 2026-08-14).
async function agendaProximoDevido() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT * FROM posts_agendados
          WHERE (status = 'pending' AND agendado_para <= ?)
             OR (status = 'processing' AND claimed_at <= ?)
          ORDER BY agendado_para ASC LIMIT 1`,
    args: [agora, agora - PROCESSING_ORFAO_MS],
  });
  const item = result.rows[0];
  if (!item) return null;

  const claim = await client.execute({
    sql: `UPDATE posts_agendados SET status = 'processing', claimed_at = ?
          WHERE id = ? AND status = ?`,
    args: [agora, item.id, item.status],
  });
  if (claim.rowsAffected === 0) return null; // outro tick já reservou esse post primeiro

  return item;
}

// Fila inteira de pendentes, mais próximos primeiro — pra mostrar no painel como um
// calendário/lista de tudo que ainda vai sair.
async function agendaFilaCompleta() {
  await ready;
  const result = await client.execute(`SELECT * FROM posts_agendados WHERE status = 'pending' ORDER BY agendado_para ASC`);
  return result.rows;
}

async function agendaBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM posts_agendados WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function agendaDefinirData(id, timestampMs) {
  await ready;
  await client.execute({ sql: `UPDATE posts_agendados SET agendado_para = ? WHERE id = ?`, args: [timestampMs, id] });
}

async function agendaRemover(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM posts_agendados WHERE id = ?`, args: [id] });
}

async function agendaMarcarPostado(id, resultado) {
  await ready;
  await client.execute({
    sql: `UPDATE posts_agendados SET status = 'posted', resultado = ?, posted_at = ? WHERE id = ?`,
    args: [JSON.stringify(resultado || {}), Date.now(), id],
  });
}

async function agendaMarcarErro(id, mensagem) {
  await ready;
  await client.execute({
    sql: `UPDATE posts_agendados SET status = 'error', resultado = ?, tentativas = tentativas + 1 WHERE id = ?`,
    args: [JSON.stringify({ erro: mensagem }), id],
  });
}

async function agendaReenfileirar(id) {
  await ready;
  await client.execute({ sql: `UPDATE posts_agendados SET status = 'pending' WHERE id = ?`, args: [id] });
}

// Posts já publicados há mais de X ms cuja imagem ainda não foi apagada do R2 — mesma lógica
// de limpeza dos Reels, pra não acumular espaço no bucket (posts sem imagem não entram aqui).
async function agendaPostadosParaLimpar(idadeMinimaMs) {
  await ready;
  const result = await client.execute({
    sql: `SELECT id, imagem_key, imagem_keys, imagem_por_rede_keys FROM posts_agendados
          WHERE status = 'posted'
            AND (imagem_key IS NOT NULL OR imagem_keys IS NOT NULL OR imagem_por_rede_keys IS NOT NULL)
            AND posted_at <= ?`,
    args: [Date.now() - idadeMinimaMs],
  });
  return result.rows;
}

async function agendaMarcarImagemApagada(id) {
  await ready;
  await client.execute({
    sql: `UPDATE posts_agendados SET imagem_key = NULL, imagem_keys = NULL, imagem_por_rede_keys = NULL WHERE id = ?`,
    args: [id],
  });
}

async function agendaResumo() {
  await ready;
  const result = await client.execute(`SELECT status, COUNT(*) AS total FROM posts_agendados GROUP BY status`);
  const resumo = { pending: 0, posted: 0, error: 0, total: 0 };
  for (const row of result.rows) {
    resumo[row.status] = row.total;
    resumo.total += row.total;
  }
  return resumo;
}

async function agendaListarRecentes(limit = 30) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM posts_agendados ORDER BY
            CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
            agendado_para DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows;
}

// Registra 1 evento do funil (ver logFunil em server.js, chamado nos pontos exatos de
// transição — ex. escolheu CLT no menu, confirmou 3+ meses, completou os dados). Não é
// "1 por contato": se a mesma pessoa passar pela etapa de novo (ex. reabriu o funil), conta
// de novo — é intencional, mede eventos, não estado.
async function funilRegistrarEvento(phone, businessNumberId, etapa) {
  await ready;
  await client.execute({
    sql: `INSERT INTO funil_eventos (phone, business_number_id, etapa, created_at) VALUES (?, ?, ?, ?)`,
    args: [phone, businessNumberId, etapa, Date.now()],
  });
}

// Contagem de eventos ÚNICOS por telefone (uma pessoa que bateu na mesma etapa 2x não conta
// 2x aqui — é isso que faz sentido pra ler como funil de conversão), por etapa, dentro da
// janela de tempo pedida.
async function funilResumo(desdeMs) {
  await ready;
  const result = await client.execute({
    sql: `SELECT etapa, COUNT(DISTINCT phone || '|' || business_number_id) AS total
          FROM funil_eventos WHERE created_at >= ? GROUP BY etapa`,
    args: [desdeMs],
  });
  const resumo = {};
  for (const row of result.rows) resumo[row.etapa] = row.total;
  return resumo;
}

// Agenda os contatos 2+ de um broadcast com intervalo — cada item já vem com seu
// agendado_para calculado pelo chamador (server.js: agora + i * intervaloSegundos).
async function broadcastAgendarLote(businessId, itens) {
  await ready;
  const agora = Date.now();
  for (const item of itens) {
    await client.execute({
      sql: `INSERT INTO broadcast_agendado
              (business_id, phone, name, template, language, body_preview, agendado_para, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [businessId, item.phone, item.name || null, item.template, item.language, item.bodyPreview || null, item.agendadoPara, agora],
    });
  }
  return itens.length;
}

// Mesma trava anti-duplicata de agendaProximoDevido/reelsProximoAgendadoDevido: marca
// 'processing' com claimed_at antes de enviar, pra dois ticks do setInterval não mandarem a
// mesma mensagem duas vezes se o envio anterior demorar mais que o intervalo do agendador.
async function broadcastProximoDevido() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT * FROM broadcast_agendado
          WHERE (status = 'pending' AND agendado_para <= ?)
             OR (status = 'processing' AND claimed_at <= ?)
          ORDER BY agendado_para ASC LIMIT 1`,
    args: [agora, agora - PROCESSING_ORFAO_MS],
  });
  const item = result.rows[0];
  if (!item) return null;

  const claim = await client.execute({
    sql: `UPDATE broadcast_agendado SET status = 'processing', claimed_at = ? WHERE id = ? AND status = ?`,
    args: [agora, item.id, item.status],
  });
  if (claim.rowsAffected === 0) return null; // outro tick já reservou esse envio primeiro

  return item;
}

async function broadcastMarcarEnviado(id) {
  await ready;
  await client.execute({
    sql: `UPDATE broadcast_agendado SET status = 'sent', sent_at = ? WHERE id = ?`,
    args: [Date.now(), id],
  });
}

async function broadcastMarcarErro(id, mensagem) {
  await ready;
  await client.execute({
    sql: `UPDATE broadcast_agendado SET status = 'error', erro = ? WHERE id = ?`,
    args: [mensagem, id],
  });
}

// Pendentes por conta — pro painel mostrar "N mensagens agendadas" no diálogo de campanha.
async function broadcastPendentesResumo(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT COUNT(*) AS total, MAX(agendado_para) AS ultimo
          FROM broadcast_agendado WHERE business_id = ? AND status = 'pending'`,
    args: [businessId],
  });
  return { pendentes: Number(result.rows[0]?.total || 0), ultimo: result.rows[0]?.ultimo || null };
}

// Lista os itens ainda não enviados de um broadcast com intervalo — pro painel mostrar a fila
// e deixar cancelar individualmente (ver broadcastCancelar).
async function broadcastListarPendentes(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT id, phone, name, template, agendado_para FROM broadcast_agendado
          WHERE business_id = ? AND status = 'pending' ORDER BY agendado_para ASC`,
    args: [businessId],
  });
  return result.rows;
}

// Só cancela quem ainda está 'pending' — se já estiver 'processing' (o agendador pegou pra
// enviar agora mesmo) ou 'sent', é tarde demais, não reverte um envio já em andamento/feito.
async function broadcastCancelar(id) {
  await ready;
  const result = await client.execute({
    sql: `DELETE FROM broadcast_agendado WHERE id = ? AND status = 'pending'`,
    args: [id],
  });
  return result.rowsAffected > 0;
}

module.exports = {
  upsertConversation,
  getConversation,
  getUltimaMensagemRecebida,
  tentarMarcarMenuEnviado,
  setFluxoPasso,
  listarFluxosAguardando,
  tentarMarcarLembreteEnviado,
  listarJanelasParaManter,
  tentarMarcarJanelaLembreteEnviado,
  insertMessage,
  marcarConversaLida,
  mensagemExistePorId,
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
  reelsProximoAgendadoDevido,
  reelsFilaCompleta,
  reelsBuscarPorId,
  reelsBuscarPorDriveFileId,
  reelsDefinirData,
  reelsRemover,
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
  agendaCriar,
  agendaProximoDevido,
  agendaFilaCompleta,
  agendaBuscarPorId,
  agendaDefinirData,
  agendaRemover,
  agendaMarcarPostado,
  agendaMarcarErro,
  agendaReenfileirar,
  agendaPostadosParaLimpar,
  agendaMarcarImagemApagada,
  agendaResumo,
  agendaListarRecentes,
  funilRegistrarEvento,
  funilResumo,
  broadcastAgendarLote,
  broadcastProximoDevido,
  broadcastMarcarEnviado,
  broadcastMarcarErro,
  broadcastPendentesResumo,
  broadcastListarPendentes,
  broadcastCancelar,
};
