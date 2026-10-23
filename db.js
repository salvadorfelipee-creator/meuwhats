const { createClient } = require("@libsql/client");
const crypto = require("crypto");
const { cpfValido } = require("./cpf");

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
 try {
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
  // Cobre "achar a mensagem mais recente de uma conversa" (ver listConversations) sem varrer
  // o histórico inteiro do contato — sem esse índice, ORDER BY created_at DESC LIMIT 1 só
  // consegue filtrar por phone/business_number_id (índice acima) e ainda precisa ler/ordenar
  // TODAS as mensagens daquele contato pra achar a última. Com telas do painel consultando
  // isso a cada 5s pra toda conversa de todo canal, foi o que estourou a cota de leitura do
  // Turso (504M linhas lidas/mês) mesmo sem nenhum pico de tráfego incomum.
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_messages_phone_created ON messages(phone, business_number_id, created_at DESC)`);

  // Chat próprio do site FelizCred. Fica separado dos canais da Meta para que uma conversa web
  // não finja ser um telefone e possa evoluir depois com fluxos específicos do site.
  await client.execute(`CREATE TABLE IF NOT EXISTS site_chat_conversations (
    id TEXT PRIMARY KEY,
    visitor_token_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_visitor_at INTEGER,
    last_agent_at INTEGER,
    last_read_at INTEGER
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS site_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES site_chat_conversations(id) ON DELETE CASCADE
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_site_chat_updated ON site_chat_conversations(updated_at DESC)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_site_chat_messages ON site_chat_messages(conversation_id, created_at)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS site_chat_clt (
    conversation_id TEXT PRIMARY KEY,
    transaction_id TEXT,
    simulation_id TEXT,
    etapa TEXT NOT NULL DEFAULT 'inicio',
    status_novosaque TEXT,
    terms_link TEXT,
    contract_link TEXT,
    offers_json TEXT,
    phone TEXT,
    whatsapp_notified_at INTEGER,
    whatsapp_notify_attempt_at INTEGER,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES site_chat_conversations(id) ON DELETE CASCADE
  )`);
  const infoSiteChatClt = await client.execute(`PRAGMA table_info(site_chat_clt)`);
  const colunasSiteChatClt = [
    ["whatsapp_notified_at", "INTEGER"],
    ["whatsapp_notify_attempt_at", "INTEGER"],
    ["provider", "TEXT"],
    ["cpf", "TEXT"],
    ["margem_disponivel", "REAL"],
    ["offline_updated_at", "TEXT"],
    ["possui_alertas", "TEXT"],
    ["facta_worker_json", "TEXT"],
    ["facta_offer_json", "TEXT"],
    ["codigo_cliente", "TEXT"],
    ["codigo_proposta", "TEXT"],
    ["authorization_requested_at", "INTEGER"],
    ["authorization_checked_at", "INTEGER"],
    ["tracking_token", "TEXT"],
  ];
  for (const [nome, tipo] of colunasSiteChatClt) {
    if (!infoSiteChatClt.rows.some((r) => r.name === nome)) await client.execute(`ALTER TABLE site_chat_clt ADD COLUMN ${nome} ${tipo}`);
  }
  const infoSiteChat = await client.execute(`PRAGMA table_info(site_chat_conversations)`);
  if (!infoSiteChat.rows.some((r) => r.name === "pipeline_estagio")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN pipeline_estagio TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "pipeline_estagio_desde")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN pipeline_estagio_desde INTEGER`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "produto_tag")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN produto_tag TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "email")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN email TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "human_intent_count")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN human_intent_count INTEGER NOT NULL DEFAULT 0`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "human_handoff_requested_at")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN human_handoff_requested_at INTEGER`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "human_intent_stage")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN human_intent_stage TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "whatsapp_opt_in_at")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN whatsapp_opt_in_at INTEGER`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "whatsapp_opt_in_source")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN whatsapp_opt_in_source TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "whatsapp_opt_out_at")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN whatsapp_opt_out_at INTEGER`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "whatsapp_opt_in_version")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN whatsapp_opt_in_version TEXT`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "whatsapp_opt_in_text")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN whatsapp_opt_in_text TEXT`);
  }
  // Quando o e-mail de retomada (cliente parou no meio) e o de "o atendente respondeu" foram enviados pela última vez.
  if (!infoSiteChat.rows.some((r) => r.name === "email_retomada_at")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN email_retomada_at INTEGER`);
  }
  if (!infoSiteChat.rows.some((r) => r.name === "email_resposta_at")) {
    await client.execute(`ALTER TABLE site_chat_conversations ADD COLUMN email_resposta_at INTEGER`);
  }
  await client.execute(`CREATE TABLE IF NOT EXISTS site_chat_funnel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    step_id TEXT NOT NULL,
    provider_id TEXT,
    reason_code TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(conversation_id, event_name, step_id, provider_id),
    FOREIGN KEY (conversation_id) REFERENCES site_chat_conversations(id) ON DELETE CASCADE
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_site_chat_funnel_event
    ON site_chat_funnel_events(event_name, created_at)`);
  // Mantém conversas antigas do site visíveis no mesmo funil da FelizCred. Versões anteriores
  // gravavam nomes que não existem nas colunas do painel, deixando esses cards invisíveis.
  await client.execute(`UPDATE site_chat_conversations
    SET pipeline_estagio = CASE pipeline_estagio
      WHEN 'em_qualificacao' THEN 'qualificacao'
      WHEN 'documentos_enviados' THEN 'documentos'
      ELSE COALESCE(pipeline_estagio, 'novo_lead')
    END,
    pipeline_estagio_desde = COALESCE(pipeline_estagio_desde, created_at)`);
  const infoSiteMessages = await client.execute(`PRAGMA table_info(site_chat_messages)`);
  for (const [nome, tipo] of [["type", "TEXT"], ["media_url", "TEXT"], ["media_mime", "TEXT"], ["file_name", "TEXT"]]) {
    if (!infoSiteMessages.rows.some((r) => r.name === nome)) {
      await client.execute(`ALTER TABLE site_chat_messages ADD COLUMN ${nome} ${tipo}`);
    }
  }

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
  }
  if (!infoConversations.rows.some((r) => r.name === "last_read_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN last_read_at INTEGER`);
  }
  // last_seen_at = última vez que uma mensagem NOSSA (direction='out') virou status 'read' —
  // é o mais perto de "visto por último" que a API do WhatsApp permite saber (não existe
  // presença/online real pra nenhuma empresa, é limitação da própria Meta). Atualizado em
  // updateStatusByWaId. Usado só como indicativo no painel, nunca como "está online agora".
  if (!infoConversations.rows.some((r) => r.name === "last_seen_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN last_seen_at INTEGER`);
  }
  // email + contato_salvo_em: capturados quando o funil automático recebe o e-mail do cliente
  // (ver confirmarDadosRecebidos em server.js) — contato_salvo_em marca que já tentamos criar
  // o contato no Google/mandar o e-mail de boas-vindas, pra não duplicar se a pessoa passar por
  // mais de um funil.
  if (!infoConversations.rows.some((r) => r.name === "email")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN email TEXT`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN contato_salvo_em INTEGER`);
  }
  // Marca quando o lembrete "segue a gente no Instagram" (10h de silêncio, Felizcred/Cota
  // Certa) já foi mandado pra essa conversa — só 1 vez, nunca de novo, mesmo que fique quieta
  // outra vez depois.
  if (!infoConversations.rows.some((r) => r.name === "instagram_lembrete_at")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN instagram_lembrete_at INTEGER`);
  }
  // bot_pausado_ate = até quando os envios automáticos ficam parados nessa conversa (atendente humano
  // respondeu pelo painel — ver pausarBot). NULL/passado = bot ligado.
  if (!infoConversations.rows.some((r) => r.name === "bot_pausado_ate")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN bot_pausado_ate INTEGER`);
  }
  // resolvido_em = timestamp de quando o status virou 'resolvido' pela ÚLTIMA vez (ver
  // atualizarStatusConversa) — sem isso não dava pra medir "tempo até resolver" no Analytics,
  // só o status atual, sem saber quando ele mudou.
  if (!infoConversations.rows.some((r) => r.name === "resolvido_em")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN resolvido_em INTEGER`);
  }
  // Nota (01/10/2026): a coluna "email" já é criada lá em cima (contato_salvo_em) — esse era um
  // 2º ALTER redundante pro mesmo propósito ("email do contato, reusar pra campanha"), que
  // sempre existiu como dead code num banco já migrado (o guard via infoConversations.rows
  // nunca via o ALTER anterior rodar, por ser a mesma consulta PRAGMA de antes — não re-lida no
  // meio da função), mas quebrava com "duplicate column name" em qualquer banco NOVO rodando a
  // migração pela 1ª vez (achado testando a integração da Novo Saque contra um banco local do
  // zero). Removido — a coluna já existe desde o primeiro ALTER, nada mudou de comportamento.
  // pipeline_estagio = etapa atual da conversa no funil de atendimento/vendas (texto livre —
  // Felizcred usa PIPELINE_ESTAGIOS no painel, qualquer outro canal usa a lista genérica
  // PIPELINE_ESTAGIOS_GENERICO, ver pipelineEstagiosPara em painel-web) — separado do `status`
  // (que é só novo/andamento/resolvido). Liberado pra todo canal em 30/09/2026.
  if (!infoConversations.rows.some((r) => r.name === "pipeline_estagio")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN pipeline_estagio TEXT`);
  }
  // pipeline_estagio_desde = quando a conversa ENTROU na etapa atual (não quando a conversa foi
  // criada) — é o que permite alertar "estagnado há X" por etapa (ver pipeline_alertas_config
  // mais abaixo) sem confundir com tempo total de conversa.
  if (!infoConversations.rows.some((r) => r.name === "pipeline_estagio_desde")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN pipeline_estagio_desde INTEGER`);
  }
  // foto_url = foto de perfil definida manualmente pela equipe (a API do WhatsApp Cloud não
  // expõe a foto real de perfil de quem manda mensagem pra número de empresa) — servida em
  // /media/:filename como qualquer mídia recebida.
  if (!infoConversations.rows.some((r) => r.name === "foto_url")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN foto_url TEXT`);
  }
  // copiloto_* = sugestão de resposta da IA pré-computada em background (cron, ver server.js) e
  // cacheada na própria linha da conversa — cache só é considerado válido quando
  // copiloto_cache_em === last_message_at (ver sugestaoResposta em api.ts), senão a sugestão
  // apareceria desatualizada depois de mensagens novas. Pré-computar em vez de gerar na hora
  // que o painel abre a conversa é o que permite aparecer instantâneo, sem spinner.
  if (!infoConversations.rows.some((r) => r.name === "copiloto_texto")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN copiloto_texto TEXT`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN copiloto_insight TEXT`);
    await client.execute(`ALTER TABLE conversations ADD COLUMN copiloto_cache_em INTEGER`);
  }
  // pipeline_alerta_em = quando o alerta de "parado na etapa" já foi disparado pra essa conversa
  // (ver conversasEtapaParada/marcarAlertaEtapaEnviado) — evita repetir o mesmo alerta/nota toda
  // vez que o cron roda; é zerado de volta a NULL sempre que a etapa muda (ver atualização de
  // pipeline_estagio) pra poder alertar de novo se estagnar numa etapa diferente depois.
  if (!infoConversations.rows.some((r) => r.name === "pipeline_alerta_em")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN pipeline_alerta_em INTEGER`);
  }
  // google_contact_resource_name = id do contato já criado no Google Contacts (evita duplicar ao
  // importar/sincronizar de novo). brevo_contato_sync_em = última vez que o contato foi
  // sincronizado com o Brevo (envio de e-mail).
  if (!infoConversations.rows.some((r) => r.name === "google_contact_resource_name")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN google_contact_resource_name TEXT`);
  }
  if (!infoConversations.rows.some((r) => r.name === "brevo_contato_sync_em")) {
    await client.execute(`ALTER TABLE conversations ADD COLUMN brevo_contato_sync_em INTEGER`);
  }

  const infoMessagesOrigem = await client.execute(`PRAGMA table_info(messages)`);
  // origem = 'humano' só na mensagem que sai pelo reply do painel (ver POST .../reply em
  // server.js) — todo o resto (fluxo automático, templates de campanha) fica com origem NULL.
  // É o que permite medir "tempo até resposta humana" no Analytics sem confundir com a
  // resposta instantânea do bot.
  if (!infoMessagesOrigem.rows.some((r) => r.name === "origem")) {
    await client.execute(`ALTER TABLE messages ADD COLUMN origem TEXT`);
  }
  // context_wa_id = wa_message_id da mensagem CITADA ("reply" em cima de uma mensagem
  // específica, igual o app oficial do WhatsApp) — null na imensa maioria das mensagens.
  if (!infoMessagesOrigem.rows.some((r) => r.name === "context_wa_id")) {
    await client.execute(`ALTER TABLE messages ADD COLUMN context_wa_id TEXT`);
  }

  // Tags (etiquetas) — livres, criadas pelo time, várias por conversa. Só usadas hoje no
  // número principal da Felizcred, mas a tabela já é multi-canal (business_number_id) pra
  // não precisar migrar de novo se decidirmos usar em outro número depois.
  await client.execute(`CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_number_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    cor TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS conversation_tags (
    business_number_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (business_number_id, phone, tag_id)
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag ON conversation_tags(tag_id)`);

  // CRM do contato (30/09/2026) — campos personalizados (definidos por negócio, ex. "Convênio",
  // "Procedimento de interesse"), notas em lista (timestamped, substitui depender só do campo
  // único `conversations.nota`) e atividades (linha do tempo: tag/etapa/campo/retorno mudou,
  // quando e o quê — mesmo espírito do "Timeline" do Octadesk).
  await client.execute(`CREATE TABLE IF NOT EXISTS campos_personalizados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS conversation_campos_valores (
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    campo_id INTEGER NOT NULL,
    valor TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (business_id, phone, campo_id)
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS conversation_notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    texto TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_conversation_notas_conversa ON conversation_notas(business_id, phone, created_at)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS atividades_conversa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_atividades_conversa_conversa ON atividades_conversa(business_id, phone, created_at)`);
  // origem = quem fez a ação ('automatico' pra tag/etapa aplicada por automação, NULL pra ação
  // humana no painel) — deixa a timeline distinguir as duas coisas em vez de parecer tudo manual.
  const infoAtividades = await client.execute(`PRAGMA table_info(atividades_conversa)`);
  if (!infoAtividades.rows.some((r) => r.name === "origem")) {
    await client.execute(`ALTER TABLE atividades_conversa ADD COLUMN origem TEXT`);
  }

  // "Revisado" do ROTEADOR EM CÓDIGO — acompanha o roteador real que está no ar (os fluxos
  // hardcoded em server.js: FLUXO_FELIZCRED, FLUXO_COTACERTA, FLUXO_CIAHOT, FLUXO_CAMPANHA_CLT
  // etc.), que não tem representação nenhuma no banco. Chave livre definida só no frontend
  // (painel-web/src/lib/roteador-producao.ts) — esta tabela só guarda o status marcado
  // manualmente, é o selo da tela Fluxos.
  await client.execute(`CREATE TABLE IF NOT EXISTS roteador_revisado (
    chave TEXT PRIMARY KEY,
    revisado INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`);

  // Motor de fluxo dinâmico (dado no banco, não código) — usado só por número que NÃO tem
  // fluxo fixo escrito em server.js (ver getFluxo). V1: nó 'mensagem' (com botões via
  // fluxo_opcoes) e 'acao' (tag/pipeline); gatilho por palavra-chave ou primeiro contato.
  // SEM 'espera'/lembrete de inatividade ainda (gap conhecido, ver README).
  await client.execute(`CREATE TABLE IF NOT EXISTS fluxos_dinamicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 0,
    no_inicial_id INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_fluxos_dinamicos_business ON fluxos_dinamicos(business_id, ativo)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS fluxo_nos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fluxo_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    texto TEXT,
    acao_tipo TEXT,
    acao_valor TEXT,
    proximo_no_id INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_fluxo_nos_fluxo ON fluxo_nos(fluxo_id)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS fluxo_opcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_id INTEGER NOT NULL,
    botao_id TEXT NOT NULL,
    botao_titulo TEXT NOT NULL,
    proximo_no_id INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_fluxo_opcoes_no ON fluxo_opcoes(no_id)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS fluxo_gatilhos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor TEXT,
    fluxo_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_fluxo_gatilhos_business ON fluxo_gatilhos(business_id)`);

  // Onde cada contato está dentro de um fluxo dinâmico — separado do `conversations.fluxo_passo`
  // legado (esse continua sendo string livre, usado pelos fluxos fixos).
  await client.execute(`CREATE TABLE IF NOT EXISTS fluxo_estado_contato (
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    fluxo_id INTEGER NOT NULL,
    no_atual_id INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (business_id, phone)
  )`);

  // Templates de e-mail (assunto + HTML) guardados no NOSSO banco — não dependemos do usuário
  // criar template dentro do próprio painel do Brevo (que a gente só usa como motor de envio,
  // via email.js/enviarEmail).
  await client.execute(`CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    assunto TEXT NOT NULL,
    corpo_html TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // Fila de campanha de e-mail em massa — mesmo desenho do broadcast_agendado (WhatsApp),
  // processada por um setInterval próprio (ver server.js).
  await client.execute(`CREATE TABLE IF NOT EXISTS emails_agendados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    destinatario_email TEXT NOT NULL,
    destinatario_nome TEXT,
    template_id INTEGER NOT NULL,
    agendado_para INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    erro TEXT,
    claimed_at INTEGER,
    sent_at INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_emails_agendados_status ON emails_agendados(status, agendado_para)`);

  // Retorno/lembrete agendado por conversa (ex.: "voltar a falar em 6 meses", "aniversário",
  // "lembrete de reunião") — canal define o que dispara: 'whatsapp' (exige template aprovado,
  // fora da janela de 24h), 'email' (via email_templates) ou 'ambos'. Processado por um
  // setInterval próprio, separado do broadcast/email em massa (é por conversa, não por lote).
  await client.execute(`CREATE TABLE IF NOT EXISTS retornos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'retorno',
    data_agendada INTEGER NOT NULL,
    canal TEXT NOT NULL DEFAULT 'whatsapp',
    whatsapp_template TEXT,
    whatsapp_language TEXT,
    email_template_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    erro TEXT,
    claimed_at INTEGER,
    enviado_em INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_retornos_status ON retornos(status, data_agendada)`);

  // whatsapp_params = lista JSON de parâmetros do template, na ordem das variáveis {{1}},
  // {{2}}... do Meta (ex. ["{{nome}}", "{{data}}"]) — sem isso só dava pra preencher {{1}} com
  // o nome do contato (comportamento antigo de enviarUmBroadcast, mantido como padrão se
  // whatsapp_params vier vazio). fluxo_id = fluxo dinâmico que deve começar assim que o
  // contato responder esse retorno (qualquer resposta, não só palavra-chave — ver getFluxo
  // "aguardando_fluxo_"), pra retorno de venda/campanha "solta" tipo ManyChat.
  const infoRetornos = await client.execute(`PRAGMA table_info(retornos)`);
  if (!infoRetornos.rows.some((r) => r.name === "whatsapp_params")) {
    await client.execute(`ALTER TABLE retornos ADD COLUMN whatsapp_params TEXT`);
  }
  if (!infoRetornos.rows.some((r) => r.name === "fluxo_id")) {
    await client.execute(`ALTER TABLE retornos ADD COLUMN fluxo_id INTEGER`);
  }
  // reforco_criado = esse retorno de reativação (1º toque) já foi avaliado pro 2º toque (ver
  // retornosReativacaoElegiveisPara2Toque) — marca 1 sempre, respondendo ou não, pra nunca
  // reavaliar o mesmo envio duas vezes.
  if (!infoRetornos.rows.some((r) => r.name === "reforco_criado")) {
    await client.execute(`ALTER TABLE retornos ADD COLUMN reforco_criado INTEGER NOT NULL DEFAULT 0`);
  }

  await client.execute(`CREATE TABLE IF NOT EXISTS respostas_prontas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atalho TEXT NOT NULL,
    texto TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);
  // uso_count = quantas vezes o atalho foi efetivamente CLICADO pra usar o texto (não quando só
  // abre a lista) — alimenta ordenação "mais usados" no painel.
  const infoRespostasProntas = await client.execute(`PRAGMA table_info(respostas_prontas)`);
  if (!infoRespostasProntas.rows.some((r) => r.name === "uso_count")) {
    await client.execute(`ALTER TABLE respostas_prontas ADD COLUMN uso_count INTEGER NOT NULL DEFAULT 0`);
  }

  // Login por pessoa (ver seção "Usuários" mais abaixo) — substitui o login único
  // PAINEL_USER/PAINEL_PASS compartilhado por toda a equipe. Esse par de env vars continua
  // funcionando como fallback de bootstrap/recuperação mesmo depois de cadastrar usuários reais
  // (ver isAuthorized em server.js), nunca é removido.
  await client.execute(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'atendente',
    canais_padrao TEXT,
    etapas_notificacao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )`);
  const infoUsuarios = await client.execute(`PRAGMA table_info(usuarios)`);
  if (!infoUsuarios.rows.some((r) => r.name === "etapas_notificacao")) {
    await client.execute(`ALTER TABLE usuarios ADD COLUMN etapas_notificacao TEXT`);
  }

  // Limiar de alerta de "parado na etapa" por etapa do pipeline, editável pelo painel (cada
  // etapa pode ter um tempo-limite diferente antes de virar alerta — ex. "perdido" não precisa
  // alerta, "novo lead" pode ser rápido). Guardado em MINUTOS. Etapa sem linha aqui = alerta
  // desativado pra ela. Seed com os estágios do funil da Felizcred (PIPELINE_ESTAGIOS em
  // painel-web/src/lib/api.ts) — valores iniciais conservadores, ajustáveis depois em
  // Configurações.
  await client.execute(`CREATE TABLE IF NOT EXISTS pipeline_alertas_config (
    estagio_id TEXT PRIMARY KEY,
    minutos INTEGER NOT NULL
  )`);
  await client.execute(`INSERT OR IGNORE INTO pipeline_alertas_config (estagio_id, minutos) VALUES
    ('novo_lead', 1440), ('qualificacao', 2880), ('documentos', 1440), ('analise', 4320)`);

  // Feedback/aceitação da IA — pra medir se uma sugestão é útil de verdade (não só impressão).
  // `evento` ('mostrada'/'aceita'/'descartada'/'comentario') + `tipo`
  // ('copiloto_resposta'/'corretor'/'alerta_etapa_parada'/'comentario_livre') dá pra calcular taxa
  // de aceitação por funcionalidade (aceita/mostrada).
  await client.execute(`CREATE TABLE IF NOT EXISTS ia_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT,
    phone TEXT,
    tipo TEXT NOT NULL,
    evento TEXT NOT NULL,
    comentario TEXT,
    usuario TEXT,
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_ia_feedback_tipo ON ia_feedback(tipo, evento, created_at)`);

  // Sugestões de retorno pendentes — junta num lugar só (tela Retornos) tudo que o radar acha
  // que vale um retorno: etapa do pipeline parada demais, ou cliente inativo há muito tempo.
  // "Aprovar" NUNCA envia nada sozinho — só abre a conversa pra um humano decidir canal/texto.
  await client.execute(`CREATE TABLE IF NOT EXISTS sugestoes_retorno (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    tipo TEXT NOT NULL,
    motivo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at INTEGER NOT NULL
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sugestoes_retorno_status ON sugestoes_retorno(status, created_at)`);

  // Dedupe de campanha de aniversário (1x por pessoa por ano) — usado pelo assistente de
  // campanha do WhatsApp (segmentação "aniversário nos próximos N dias").
  await client.execute(`CREATE TABLE IF NOT EXISTS aniversarios_enviados (
    business_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    ano INTEGER NOT NULL,
    enviado_em INTEGER NOT NULL,
    PRIMARY KEY (business_id, phone, ano)
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

  // Mesmo padrão do reels_config acima — guarda o refresh_token do Google (Contacts) depois da
  // autorização OAuth (ver google.js e GET /painel/api/google/callback em server.js), pra não
  // precisar pedir pro usuário copiar/colar token nenhum.
  await client.execute(`CREATE TABLE IF NOT EXISTS google_config (
    chave TEXT PRIMARY KEY,
    valor TEXT
  )`);

  // E-mail que recebe o backup/exportação de conversa (botão "Exportar" no painel) — 1 por
  // negócio, configurado 1x e reusado depois, pra não precisar digitar toda vez.
  await client.execute(`CREATE TABLE IF NOT EXISTS email_backup_config (
    business_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // Expediente usado pelo agendamento de horário via Google Agenda (ver google.js
  // horariosDisponiveis/criarEvento e nó 'horarios' do fluxo dinâmico) — 1 por negócio (cada
  // número pode ter sua própria agenda/expediente, ex. 1 profissional por número).
  await client.execute(`CREATE TABLE IF NOT EXISTS agenda_calendario_config (
    business_id TEXT PRIMARY KEY,
    calendario_id TEXT NOT NULL DEFAULT 'primary',
    hora_inicio INTEGER NOT NULL DEFAULT 9,
    hora_fim INTEGER NOT NULL DEFAULT 18,
    duracao_minutos INTEGER NOT NULL DEFAULT 60,
    updated_at INTEGER NOT NULL
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

  // fluxo_id = mesmo conceito do retornos.fluxo_id (ver acima) — aplicado a campanha em massa:
  // quando alguém responde o template da campanha, cai direto nesse fluxo em vez do padrão do
  // número.
  const infoBroadcastAgendado = await client.execute(`PRAGMA table_info(broadcast_agendado)`);
  if (!infoBroadcastAgendado.rows.some((r) => r.name === "fluxo_id")) {
    await client.execute(`ALTER TABLE broadcast_agendado ADD COLUMN fluxo_id INTEGER`);
  }

  // Uma linha por solicitação de FGTS em andamento na Unnotech (ver PROJETO de originação
  // automática de FGTS) — etapa controla onde a conversa está, status_unnotech guarda o último
  // ApplicationStatus que a API devolveu, só pra debug/painel.
  await client.execute(`CREATE TABLE IF NOT EXISTS fgts_origination (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    application_id TEXT,
    cpf TEXT,
    offer_id TEXT,
    proposal_uuid TEXT,
    etapa TEXT NOT NULL DEFAULT 'abrindo',
    status_unnotech TEXT,
    idempotency_key_atual TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_fgts_origination_etapa ON fgts_origination(etapa, updated_at)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_fgts_origination_phone ON fgts_origination(phone, business_number_id)`
  );
  const infoFgtsOrigination = await client.execute(`PRAGMA table_info(fgts_origination)`);
  if (!infoFgtsOrigination.rows.some((r) => r.name === "link_assinatura_enviado_em")) {
    // Achado na revisão final: usar só "já tinha proposal_uuid salvo" como trava de "só manda o
    // link 1 vez" tem um bug — o proposal_uuid costuma aparecer ANTES do signature_link (a
    // geração do link é assíncrona), então na maioria dos ciclos o link nunca era mandado
    // (a trava já dava como "enviado" no tick em que só o proposal_uuid apareceu). Coluna própria,
    // marcada só depois do envio de verdade ter sido bem-sucedido.
    await client.execute(`ALTER TABLE fgts_origination ADD COLUMN link_assinatura_enviado_em INTEGER`);
  }
  if (!infoFgtsOrigination.rows.some((r) => r.name === "flow_token")) {
    // Token aleatório pro WhatsApp Flow, não o id sequencial da linha — achado na revisão
    // final: "fgtsorig_<id>" é adivinhável, e nada checava se quem mandou a submissão do Flow
    // era o mesmo contato da linha, então um POST forjado no webhook (que hoje não valida
    // assinatura da Meta) podia trocar os dados bancários de outra pessoa.
    await client.execute(`ALTER TABLE fgts_origination ADD COLUMN flow_token TEXT`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_fgts_origination_flow_token ON fgts_origination(flow_token)`);
  }

  // Uma linha por solicitação de consignado CLT em andamento na Unnotech (ver
  // docs/superpowers/specs/2026-09-26-clt-unnotech-design.md) — mesmo papel que
  // fgts_origination, mas com colunas extras pros 3 portões que o CLT tem e o FGTS não:
  // autorização do trabalhador, escolha de vínculo/base de valor, e a re-tentativa automática
  // de oferta depois de CONTRACT_REJECTED (offers_cache + tentativas_offer_ids).
  await client.execute(`CREATE TABLE IF NOT EXISTS clt_origination (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    application_id TEXT,
    cpf TEXT,
    employments_cache TEXT,
    employment_id TEXT,
    margem_disponivel REAL,
    basis TEXT,
    valor_desejado REAL,
    offer_id TEXT,
    offers_cache TEXT,
    tentativas_offer_ids TEXT,
    proposal_uuid TEXT,
    link_assinatura_enviado_em INTEGER,
    flow_token TEXT,
    consent_url TEXT,
    etapa TEXT NOT NULL DEFAULT 'aguardando_autorizacao',
    etapa_em INTEGER,
    status_unnotech TEXT,
    idempotency_key_atual TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_clt_origination_etapa ON clt_origination(etapa, updated_at)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_clt_origination_phone ON clt_origination(phone, business_number_id)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_clt_origination_flow_token ON clt_origination(flow_token)`
  );

  // Uma linha por solicitação de consignado CLT em andamento na Novo Saque (ver
  // docs/superpowers/specs/2026-10-01-novosaque-clt-design.md) — banco separado de
  // clt_origination (Unnotech) de propósito: são 2 integrações independentes, a Unnotech
  // continua em standby esperando a credencial dela, essa aqui é a nova. Mais enxuta que a da
  // Unnotech — o fluxo da Novo Saque não tem portão de "escolher vínculo" nem "escolher base de
  // simulação" (a 1ª simulação já sai pronta sozinha, confirmado testando contra o sandbox real).
  await client.execute(`CREATE TABLE IF NOT EXISTS novosaque_origination (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    business_number_id TEXT NOT NULL,
    transaction_id TEXT,
    cpf TEXT,
    terms_link TEXT,
    margem_disponivel REAL,
    simulation_id TEXT,
    valor_parcela REAL,
    oferta_cache TEXT,
    link_assinatura_enviado_em INTEGER,
    flow_token TEXT,
    etapa TEXT NOT NULL DEFAULT 'abrindo',
    etapa_em INTEGER,
    status_novosaque TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_novosaque_origination_etapa ON novosaque_origination(etapa, updated_at)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_novosaque_origination_phone ON novosaque_origination(phone, business_number_id)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_novosaque_origination_flow_token ON novosaque_origination(flow_token)`
  );

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
 } catch (err) {
   // Nunca deixa uma falha aqui derrubar o processo inteiro (era exatamente isso que
   // acontecia: erro sem catch numa IIFE assíncrona vira unhandled rejection, e o Node
   // dessa versão mata o processo — loop de crash-restart-crash a cada tentativa). Um
   // banco temporariamente indisponível (ex.: Turso bloqueando leitura por limite de
   // plano) agora só faz cada request individual falhar (500 com o erro real pra quem
   // está logado, ver isAuthorized no catch de server.js), sem tirar o servidor do ar.
   console.error("Erro ao inicializar/migrar banco de dados:", err.message);
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

// Pausa (ate = ms epoch) ou religa (ate = null) os envios automáticos de uma conversa.
async function pausarBot(phone, businessNumberId, ate) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET bot_pausado_ate = ? WHERE phone = ? AND business_number_id = ?`,
    args: [ate, phone, businessNumberId],
  });
}

async function botEstaPausado(phone, businessNumberId) {
  await ready;
  const r = await client.execute({
    sql: `SELECT bot_pausado_ate FROM conversations WHERE phone = ? AND business_number_id = ?`,
    args: [phone, businessNumberId],
  });
  return Number(r.rows[0]?.bot_pausado_ate || 0) > Date.now();
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

// Corpo da última mensagem NOSSA (saída) na conversa — usado pra nunca repetir a mesma resposta
// automática duas vezes seguidas (consome a janela gratuita à toa).
async function getUltimoCorpoEnviado(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT body FROM messages WHERE phone = ? AND business_number_id = ? AND direction = 'out'
          AND COALESCE(status, '') != 'failed' ORDER BY created_at DESC, id DESC LIMIT 1`,
    args: [phone, businessNumberId],
  });
  return result.rows[0]?.body || null;
}

// Já recebeu template de campanha (broadcast) desse número nos últimos `diasLimite` dias? —
// trava contra reenvio pra quem já foi contactado (ver DIAS_BLOQUEIO_REENVIO_TEMPLATE em
// server.js). Só mensagem de SAÍDA tipo 'template', não conta nada do fluxo automático.
// Envio que a Meta marcou como 'failed' (ex.: problema de pagamento) não chegou no cliente, então
// não conta como "já recebeu" — senão uma falha de cobrança bloquearia o reenvio por 30 dias.
async function jaRecebeuTemplateRecente(phone, businessNumberId, diasLimite) {
  await ready;
  const desde = Date.now() - diasLimite * 24 * 60 * 60 * 1000;
  const result = await client.execute({
    sql: `SELECT 1 FROM messages WHERE phone = ? AND business_number_id = ? AND direction = 'out'
          AND type = 'template' AND created_at > ? AND COALESCE(status, '') != 'failed' LIMIT 1`,
    args: [phone, businessNumberId, desde],
  });
  return result.rows.length > 0;
}

// Esse contato já recebeu ALGUMA VEZ um template com esse nome nesse número (sem limite de
// dias, "sticky" pra sempre) — usado por getFluxo (server.js) pra decidir se um número que
// também tem tráfego orgânico (ex.: Felizcred principal) deve entrar num fluxo de campanha
// específico em vez do menu padrão. Ignora falhas ('failed'), mesmo motivo de
// jaRecebeuTemplateRecente: envio que não chegou não deve contar como "recebeu".
async function recebeuTemplate(phone, businessNumberId, nomeTemplate) {
  await ready;
  const result = await client.execute({
    sql: `SELECT 1 FROM messages WHERE phone = ? AND business_number_id = ? AND direction = 'out'
          AND type = 'template' AND body LIKE ? AND COALESCE(status, '') != 'failed' LIMIT 1`,
    args: [phone, businessNumberId, `%${nomeTemplate}%`],
  });
  return result.rows.length > 0;
}

// Conversas abertas cuja ÚLTIMA mensagem é um template nosso (nomes em `nomes`) já lido pelo cliente
// há mais de `limiarMs` (e até `janelaMs` atrás), sem nenhuma resposta depois. Um único SELECT —
// a mensagem mais recente de cada conversa sai do índice (phone, business_number_id, created_at).
async function templatesLidosSemResposta(numeros, nomes, limiarMs, janelaMs) {
  await ready;
  if (!numeros.length || !nomes.length) return [];
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT c.phone, c.business_number_id, c.nota
          FROM conversations c
          JOIN messages m ON m.phone = c.phone AND m.business_number_id = c.business_number_id
          WHERE c.business_number_id IN (${numeros.map(() => "?").join(",")})
            AND COALESCE(c.status, 'novo') != 'resolvido'
            AND c.last_message_at < ? AND c.last_message_at > ?
            AND m.created_at = (SELECT MAX(x.created_at) FROM messages x WHERE x.phone = c.phone AND x.business_number_id = c.business_number_id)
            AND m.direction = 'out' AND m.type = 'template' AND m.status = 'read'
            AND (${nomes.map(() => "m.body LIKE ?").join(" OR ")})`,
    args: [...numeros, agora - limiarMs, agora - janelaMs, ...nomes.map((n) => `%${n}%`)],
  });
  return result.rows;
}

// Conversas do consignado CLT que passaram de "Desejo simular" (fluxo_passo consignado_* exceto oferta/
// encerrado) e ainda não têm a tag `nomeTag` — usado só para completar quem escolheu antes da tag existir.
async function conversasConsignadoSemTag(numeros, nomeTag) {
  await ready;
  if (!numeros.length) return [];
  const result = await client.execute({
    sql: `SELECT c.phone, c.business_number_id FROM conversations c
          WHERE c.business_number_id IN (${numeros.map(() => "?").join(",")})
            AND c.fluxo_passo LIKE 'consignado_%'
            AND c.fluxo_passo NOT LIKE 'consignado_oferta%' AND c.fluxo_passo NOT LIKE 'consignado_encerrado%'
            AND NOT EXISTS (
              SELECT 1 FROM conversation_tags ct JOIN tags t ON t.id = ct.tag_id
              WHERE ct.business_number_id = c.business_number_id AND ct.phone = c.phone AND t.nome = ? COLLATE NOCASE
            )`,
    args: [...numeros, nomeTag],
  });
  return result.rows;
}

const STATUS_VALIDOS = ["novo", "andamento", "resolvido"];

async function atualizarStatusConversa(phone, businessNumberId, status) {
  await ready;
  if (!STATUS_VALIDOS.includes(status)) throw new Error(`Status inválido: ${status}`);
  if (status === "resolvido") {
    await client.execute({
      sql: `UPDATE conversations SET status = ?, resolvido_em = ? WHERE phone = ? AND business_number_id = ?`,
      args: [status, Date.now(), phone, businessNumberId],
    });
  } else {
    await client.execute({
      sql: `UPDATE conversations SET status = ? WHERE phone = ? AND business_number_id = ?`,
      args: [status, phone, businessNumberId],
    });
  }
}

// Registra 1 linha na timeline de atividades de uma conversa (CRM) — chamado de dentro das
// próprias funções de mutação (tag/etapa/campo/retorno) pra nunca esquecer de logar não importa
// se quem chamou foi uma rota REST ou uma ferramenta MCP. Nunca derruba a mutação principal se
// o log falhar (é auxiliar, não crítico).
async function atividadeRegistrar({ businessId, phone, tipo, descricao, origem }) {
  try {
    await ready;
    await client.execute({
      sql: `INSERT INTO atividades_conversa (business_id, phone, tipo, descricao, created_at, origem) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [businessId, phone, tipo, descricao, Date.now(), origem || null],
    });
  } catch (err) {
    console.error("Erro ao registrar atividade:", err.message);
  }
}

async function atividadesDaConversa(businessId, phone, limite = 50) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM atividades_conversa WHERE business_id = ? AND phone = ? ORDER BY created_at DESC LIMIT ?`,
    args: [businessId, phone, limite],
  });
  return result.rows;
}

// ─── Campos personalizados (CRM) ──────────────────────────────────────────────────────────
async function campoPersonalizadoCriar(businessId, nome) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO campos_personalizados (business_id, nome, created_at) VALUES (?, ?, ?)`,
    args: [businessId, nome, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

// Usado pelo CSV de importação de contatos (coluna livre vira campo personalizado automático)
// e por qualquer automação que precisa garantir que um campo existe antes de gravar valor nele.
async function campoPersonalizadoEncontrarOuCriar(businessId, nome) {
  await ready;
  const existente = await client.execute({
    sql: `SELECT id FROM campos_personalizados WHERE business_id = ? AND nome = ? LIMIT 1`,
    args: [businessId, nome],
  });
  if (existente.rows[0]) return Number(existente.rows[0].id);
  return campoPersonalizadoCriar(businessId, nome);
}

async function camposPersonalizadosListar(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM campos_personalizados WHERE business_id = ? ORDER BY created_at ASC`,
    args: [businessId],
  });
  return result.rows;
}

async function campoPersonalizadoApagar(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM conversation_campos_valores WHERE campo_id = ?`, args: [id] });
  await client.execute({ sql: `DELETE FROM campos_personalizados WHERE id = ?`, args: [id] });
}

async function conversationCampoDefinir(businessId, phone, campoId, valor) {
  await ready;
  await client.execute({
    sql: `INSERT INTO conversation_campos_valores (business_id, phone, campo_id, valor, updated_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(business_id, phone, campo_id) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at`,
    args: [businessId, phone, campoId, valor, Date.now()],
  });
  const campo = await client.execute({ sql: `SELECT nome FROM campos_personalizados WHERE id = ?`, args: [campoId] });
  await atividadeRegistrar({
    businessId,
    phone,
    tipo: "campo",
    descricao: `"${campo.rows[0]?.nome || campoId}" definido como "${valor}"`,
  });
}

// Todos os campos personalizados do negócio + o valor dessa conversa (se já tiver sido
// preenchido) — pensado pra montar a lista inteira de campos no painel de detalhes de 1 vez.
async function conversationCamposObter(businessId, phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT cp.id AS campo_id, cp.nome, cv.valor
          FROM campos_personalizados cp
          LEFT JOIN conversation_campos_valores cv
            ON cv.campo_id = cp.id AND cv.business_id = cp.business_id AND cv.phone = ?
          WHERE cp.business_id = ?
          ORDER BY cp.created_at ASC`,
    args: [phone, businessId],
  });
  return result.rows;
}

// ─── Notas em lista (CRM) — histórico, diferente do campo único `conversations.nota` legado ──
async function notaAdicionar(businessId, phone, texto) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO conversation_notas (business_id, phone, texto, created_at) VALUES (?, ?, ?, ?)`,
    args: [businessId, phone, texto, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

async function notasDaConversa(businessId, phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM conversation_notas WHERE business_id = ? AND phone = ? ORDER BY created_at DESC`,
    args: [businessId, phone],
  });
  return result.rows;
}

async function notaApagar(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM conversation_notas WHERE id = ?`, args: [id] });
}

async function atualizarPipelineConversa(phone, businessNumberId, estagio, origem) {
  await ready;
  // pipeline_alerta_em volta a NULL aqui — mudou de etapa (manual ou automático), então o
  // "tempo parado" começa a contar do zero de novo, e o alerta de etapa parada (ver
  // conversasEtapaParada) pode disparar outra vez se ficar parada na etapa nova.
  await client.execute({
    sql: `UPDATE conversations SET pipeline_estagio = ?, pipeline_estagio_desde = ?, pipeline_alerta_em = NULL WHERE phone = ? AND business_number_id = ?`,
    args: [estagio || null, Date.now(), phone, businessNumberId],
  });
  await atividadeRegistrar({
    businessId: businessNumberId,
    phone,
    tipo: "etapa",
    descricao: estagio ? `Etapa alterada para "${estagio}"` : "Etapa removida",
    origem,
  });
}

async function listarTags(businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM tags WHERE business_number_id = ? ORDER BY nome COLLATE NOCASE`,
    args: [businessNumberId],
  });
  return result.rows;
}

async function criarTag(businessNumberId, nome, cor) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO tags (business_number_id, nome, cor, created_at) VALUES (?, ?, ?, ?)`,
    args: [businessNumberId, nome.trim(), cor, Date.now()],
  });
  return Number(result.lastInsertRowid); // vem como BigInt do driver — JSON.stringify não serializa BigInt
}

async function apagarTag(businessNumberId, tagId) {
  await ready;
  await client.execute({
    sql: `DELETE FROM conversation_tags WHERE business_number_id = ? AND tag_id = ?`,
    args: [businessNumberId, tagId],
  });
  await client.execute({
    sql: `DELETE FROM tags WHERE business_number_id = ? AND id = ?`,
    args: [businessNumberId, tagId],
  });
}

// Acha a tag pelo nome (sem diferenciar maiúsculas) ou cria — usado pra marcar automaticamente
// de qual anúncio/campanha um lead veio, onde o mesmo gatilho gera várias conversas e não pode
// criar uma tag duplicada por vez.
async function tagEncontrarOuCriar(businessNumberId, nome, cor) {
  await ready;
  const existente = await client.execute({
    sql: `SELECT id FROM tags WHERE business_number_id = ? AND nome = ? COLLATE NOCASE LIMIT 1`,
    args: [businessNumberId, nome.trim()],
  });
  if (existente.rows[0]) return existente.rows[0].id;
  return criarTag(businessNumberId, nome, cor);
}

// Quando (ms) a conversa recebeu a tag de nome `nome`, ou null se não tem.
async function tagDaConversaDesde(businessNumberId, phone, nome) {
  await ready;
  const r = await client.execute({
    sql: `SELECT ct.created_at FROM conversation_tags ct JOIN tags t ON t.id = ct.tag_id
          WHERE ct.business_number_id = ? AND ct.phone = ? AND t.nome = ? COLLATE NOCASE ORDER BY ct.created_at DESC LIMIT 1`,
    args: [businessNumberId, phone, nome],
  });
  return r.rows[0] ? Number(r.rows[0].created_at) : null;
}

async function adicionarTagConversa(businessNumberId, phone, tagId, origem) {
  await ready;
  await client.execute({
    sql: `INSERT OR IGNORE INTO conversation_tags (business_number_id, phone, tag_id, created_at) VALUES (?, ?, ?, ?)`,
    args: [businessNumberId, phone, tagId, Date.now()],
  });
  const tag = await client.execute({ sql: `SELECT nome FROM tags WHERE id = ?`, args: [tagId] });
  await atividadeRegistrar({ businessId: businessNumberId, phone, tipo: "tag_add", descricao: `Tag "${tag.rows[0]?.nome || tagId}" adicionada`, origem });
}

// Aplica a tag só se a conversa ainda não tem (adicionarTagConversa registra atividade a cada chamada).
async function adicionarTagConversaSeAusente(businessNumberId, phone, tagId, origem) {
  await ready;
  const ja = await client.execute({
    sql: `SELECT 1 FROM conversation_tags WHERE business_number_id = ? AND phone = ? AND tag_id = ?`,
    args: [businessNumberId, phone, tagId],
  });
  if (ja.rows[0]) return false;
  await adicionarTagConversa(businessNumberId, phone, tagId, origem);
  return true;
}

async function removerTagConversa(businessNumberId, phone, tagId) {
  await ready;
  const tag = await client.execute({ sql: `SELECT nome FROM tags WHERE id = ?`, args: [tagId] });
  await client.execute({
    sql: `DELETE FROM conversation_tags WHERE business_number_id = ? AND phone = ? AND tag_id = ?`,
    args: [businessNumberId, phone, tagId],
  });
  await atividadeRegistrar({ businessId: businessNumberId, phone, tipo: "tag_remove", descricao: `Tag "${tag.rows[0]?.nome || tagId}" removida` });
}

// Tags de UMA conversa (usado no painel de detalhes do contato).
async function tagsDaConversa(businessNumberId, phone) {
  await ready;
  const result = await client.execute({
    sql: `
      SELECT t.* FROM tags t
      JOIN conversation_tags ct ON ct.tag_id = t.id
      WHERE ct.business_number_id = ? AND ct.phone = ?
      ORDER BY t.nome COLLATE NOCASE
    `,
    args: [businessNumberId, phone],
  });
  return result.rows;
}

// ─── Motor de fluxo dinâmico (ver mcp.js/getFluxo em server.js) ────────────────────────────
async function fluxoDinamicoCriar(businessId, nome) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO fluxos_dinamicos (business_id, nome, ativo, created_at) VALUES (?, ?, 0, ?)`,
    args: [businessId, nome, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

async function fluxoDinamicoAtivo(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fluxos_dinamicos WHERE business_id = ? AND ativo = 1 LIMIT 1`,
    args: [businessId],
  });
  return result.rows[0] || null;
}

async function fluxoDinamicoListar(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fluxos_dinamicos WHERE business_id = ? ORDER BY created_at DESC`,
    args: [businessId],
  });
  return result.rows;
}

async function fluxoDinamicoDefinirNoInicial(fluxoId, noId) {
  await ready;
  await client.execute({ sql: `UPDATE fluxos_dinamicos SET no_inicial_id = ? WHERE id = ?`, args: [noId, fluxoId] });
}

// Só um fluxo ativo por número por vez — ativar este desativa qualquer outro do mesmo negócio.
async function fluxoDinamicoAtivar(fluxoId, businessId) {
  await ready;
  await client.execute({ sql: `UPDATE fluxos_dinamicos SET ativo = 0 WHERE business_id = ?`, args: [businessId] });
  await client.execute({ sql: `UPDATE fluxos_dinamicos SET ativo = 1 WHERE id = ?`, args: [fluxoId] });
}

async function fluxoDinamicoDesativar(fluxoId) {
  await ready;
  await client.execute({ sql: `UPDATE fluxos_dinamicos SET ativo = 0 WHERE id = ?`, args: [fluxoId] });
}

async function fluxoDinamicoObter(fluxoId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fluxos_dinamicos WHERE id = ?`, args: [fluxoId] });
  return result.rows[0] || null;
}

// Apaga o fluxo inteiro (nós + botões, em cascata manual — sem FK/CASCADE configurado nessas
// tabelas). Bloqueia se estiver ativo, pra não sumir de baixo do número que o usa sem querer —
// precisa desativar primeiro (fluxo_desativar).
async function fluxoDinamicoApagar(fluxoId) {
  await ready;
  const fluxo = await fluxoDinamicoObter(fluxoId);
  if (!fluxo) return { ok: false, motivo: "não encontrado" };
  if (fluxo.ativo) return { ok: false, motivo: "está ativo — desative antes de apagar" };
  await client.execute({
    sql: `DELETE FROM fluxo_opcoes WHERE no_id IN (SELECT id FROM fluxo_nos WHERE fluxo_id = ?)`,
    args: [fluxoId],
  });
  await client.execute({ sql: `DELETE FROM fluxo_nos WHERE fluxo_id = ?`, args: [fluxoId] });
  await client.execute({ sql: `DELETE FROM fluxos_dinamicos WHERE id = ?`, args: [fluxoId] });
  return { ok: true };
}

async function fluxoNoCriar({ fluxoId, tipo, texto, acaoTipo, acaoValor, proximoNoId }) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO fluxo_nos (fluxo_id, tipo, texto, acao_tipo, acao_valor, proximo_no_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [fluxoId, tipo, texto || null, acaoTipo || null, acaoValor || null, proximoNoId || null, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

async function fluxoNosDoFluxo(fluxoId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fluxo_nos WHERE fluxo_id = ? ORDER BY id ASC`, args: [fluxoId] });
  return result.rows;
}

async function fluxoNoObter(noId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fluxo_nos WHERE id = ?`, args: [noId] });
  return result.rows[0] || null;
}

async function fluxoOpcaoAdicionar({ noId, botaoId, botaoTitulo, proximoNoId }) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO fluxo_opcoes (no_id, botao_id, botao_titulo, proximo_no_id) VALUES (?, ?, ?, ?)`,
    args: [noId, botaoId, botaoTitulo, proximoNoId],
  });
  return Number(result.lastInsertRowid);
}

async function fluxoOpcoesDoNo(noId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fluxo_opcoes WHERE no_id = ?`, args: [noId] });
  return result.rows;
}

// Todos os botões de TODOS os nós do fluxo, de uma vez — usado pra montar o roteador
// fluxoBotoes inteiro num único carregamento (ver getFluxo em server.js).
async function fluxoOpcoesDoFluxo(fluxoId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT fo.* FROM fluxo_opcoes fo JOIN fluxo_nos fn ON fn.id = fo.no_id WHERE fn.fluxo_id = ?`,
    args: [fluxoId],
  });
  return result.rows;
}

async function fluxoGatilhoCriar({ businessId, tipo, valor, fluxoId }) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO fluxo_gatilhos (business_id, tipo, valor, fluxo_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [businessId, tipo, valor || null, fluxoId, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

async function fluxoGatilhosDoNegocio(businessId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fluxo_gatilhos WHERE business_id = ?`, args: [businessId] });
  return result.rows;
}

async function fluxoGatilhoApagar(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM fluxo_gatilhos WHERE id = ?`, args: [id] });
}

async function fluxoEstadoContatoObter(businessId, phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fluxo_estado_contato WHERE business_id = ? AND phone = ?`,
    args: [businessId, phone],
  });
  return result.rows[0] || null;
}

async function fluxoEstadoContatoDefinir(businessId, phone, fluxoId, noId) {
  await ready;
  await client.execute({
    sql: `INSERT INTO fluxo_estado_contato (business_id, phone, fluxo_id, no_atual_id, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (business_id, phone) DO UPDATE SET fluxo_id = excluded.fluxo_id,
            no_atual_id = excluded.no_atual_id, updated_at = excluded.updated_at`,
    args: [businessId, phone, fluxoId, noId, Date.now()],
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
  return Number(result.lastInsertRowid);
}

async function respostaProntaExcluir(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM respostas_prontas WHERE id = ?`, args: [id] });
}

// Edição direta (em vez de apagar e recriar, que perdia o id).
async function respostaProntaAtualizar(id, atalho, texto) {
  await ready;
  await client.execute({
    sql: `UPDATE respostas_prontas SET atalho = ?, texto = ? WHERE id = ?`,
    args: [atalho, texto, id],
  });
}

// Chamada toda vez que a pessoa CLICA num atalho pra usar o texto (não quando só abre a lista)
// — alimenta a ordenação "mais usados" dos chips acima do campo de digitar.
async function respostaProntaRegistrarUso(id) {
  await ready;
  await client.execute({ sql: `UPDATE respostas_prontas SET uso_count = uso_count + 1 WHERE id = ?`, args: [id] });
}

// ─── Usuários (login por pessoa) ──────────────────────────────────────────────────────────
// Formato do hash: "scrypt:<salt-hex>:<hash-hex>" — autodescritivo (facilita trocar o algoritmo
// no futuro sem migrar senha antiga), usa só crypto nativo do Node (sem dependência nova).
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(senha), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

// Cache de verificação de senha (achado real de performance): sem isso, scryptSync (CPU-bound,
// proposital lento) rodava a cada chamada autenticada da API — o painel reenvia a mesma
// credencial (Basic Auth) em toda requisição, inclusive o poll de alguns segundos — então trocar
// de aba/abrir conversa disparava várias chamadas em paralelo, cada uma pagando esse custo em
// série (Node é single-thread). Chave inclui o HASH (não só o usuário): quando a senha é trocada,
// o hash muda, a chave muda, e as entradas antigas simplesmente nunca mais são lidas — não
// precisa de invalidação manual nenhuma. TTL curto (30s) cobre o caso comum (mesma pessoa
// navegando) sem guardar nada por muito tempo.
const CACHE_SENHA_TTL_MS = 30 * 1000;
const cacheVerificacaoSenha = new Map(); // chave: `${senhaHash}:${senha}` -> { ok, expira }
setInterval(() => {
  const agora = Date.now();
  for (const [chave, v] of cacheVerificacaoSenha) {
    if (v.expira <= agora) cacheVerificacaoSenha.delete(chave);
  }
}, 5 * 60 * 1000);

// Sem `await ready` de propósito — não toca o banco, só compara bytes. Isso deixa quem chama
// (isAuthorized em server.js, que PRECISA ser síncrono) usar essa função direto em cima do array
// em memória, sem depender de Promise nenhuma.
function verificarSenha(senha, senhaHash) {
  if (!senhaHash || typeof senhaHash !== "string") return false;
  const partes = senhaHash.split(":");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const chaveCache = `${senhaHash}:${senha}`;
  const agora = Date.now();
  const cache = cacheVerificacaoSenha.get(chaveCache);
  if (cache && cache.expira > agora) return cache.ok;
  const [, salt, hashHex] = partes;
  let ok = false;
  try {
    const esperado = Buffer.from(hashHex, "hex");
    const recebido = crypto.scryptSync(String(senha || ""), salt, esperado.length);
    ok = esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
  } catch {
    ok = false;
  }
  cacheVerificacaoSenha.set(chaveCache, { ok, expira: agora + CACHE_SENHA_TTL_MS });
  return ok;
}

async function usuarioCriar({ nome, usuario, senha, papel = "atendente", canaisPadrao = null, etapasNotificacao = null }) {
  await ready;
  const ja = await client.execute({ sql: `SELECT id FROM usuarios WHERE usuario = ?`, args: [usuario] });
  if (ja.rows.length) throw new Error("Já existe um usuário com esse login.");
  const result = await client.execute({
    sql: `INSERT INTO usuarios (nome, usuario, senha_hash, papel, canais_padrao, etapas_notificacao, ativo, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      nome,
      usuario,
      hashSenha(senha),
      papel,
      canaisPadrao && canaisPadrao.length ? JSON.stringify(canaisPadrao) : null,
      etapasNotificacao && etapasNotificacao.length ? JSON.stringify(etapasNotificacao) : null,
      Date.now(),
    ],
  });
  return Number(result.lastInsertRowid);
}

// Todos os usuários (ativos e inativos) — usado tanto pela tela de administração (Equipe) quanto
// pra recarregar o cache em memória que o server.js usa pra autenticar de forma síncrona (ver
// isAuthorized). Inclui senha_hash de propósito (o cache precisa dele pra conferir senha sem
// voltar ao banco) — quem expõe isso pro frontend (rota /painel/api/usuarios) tira o campo antes.
async function usuarioListar() {
  await ready;
  const result = await client.execute(`SELECT * FROM usuarios ORDER BY nome ASC`);
  return result.rows;
}

async function usuarioObterPorUsuario(usuario) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM usuarios WHERE usuario = ?`, args: [usuario] });
  return result.rows[0] || null;
}

async function usuarioObterPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM usuarios WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function usuarioAtualizar(id, { nome, papel, canaisPadrao, etapasNotificacao, ativo }) {
  await ready;
  await client.execute({
    sql: `UPDATE usuarios SET nome = ?, papel = ?, canais_padrao = ?, etapas_notificacao = ?, ativo = ? WHERE id = ?`,
    args: [
      nome,
      papel,
      canaisPadrao && canaisPadrao.length ? JSON.stringify(canaisPadrao) : null,
      etapasNotificacao && etapasNotificacao.length ? JSON.stringify(etapasNotificacao) : null,
      ativo ? 1 : 0,
      id,
    ],
  });
}

async function usuarioRedefinirSenha(id, novaSenha) {
  await ready;
  await client.execute({ sql: `UPDATE usuarios SET senha_hash = ? WHERE id = ?`, args: [hashSenha(novaSenha), id] });
}

async function usuarioDesativar(id) {
  await ready;
  await client.execute({ sql: `UPDATE usuarios SET ativo = 0 WHERE id = ?`, args: [id] });
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
    origem = null,
    context_wa_id = null,
    created_at,
  } = msg;
  const result = await client.execute({
    sql: `INSERT INTO messages (phone, business_number_id, direction, type, body, media_path, media_mime, status, wa_message_id, origem, context_wa_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [phone, business_number_id, direction, type, body, media_path, media_mime, status, wa_message_id, origem, context_wa_id, created_at],
  });
  if (direction === "in") {
    // Marca a hora da mensagem DO CLIENTE, separado de last_message_at (que conta qualquer
    // direção) — é contra isso que comparamos last_read_at pra saber se ficou não lida.
    await client.execute({
      sql: `UPDATE conversations SET last_inbound_at = MAX(COALESCE(last_inbound_at, 0), ?)
            WHERE phone = ? AND business_number_id = ?`,
      args: [created_at, phone, business_number_id],
    });
    // Conversa finalizada que o cliente escreveu de novo reabre sozinha — senão ela ficaria
    // escondida da lista/checagens pra sempre (ver listConversations), mesmo com mensagem
    // nova esperando resposta.
    await client.execute({
      sql: `UPDATE conversations SET status = 'novo' WHERE phone = ? AND business_number_id = ? AND status = 'resolvido'`,
      args: [phone, business_number_id],
    });
  }
  return Number(result.lastInsertRowid);
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

// Conversas do Felizcred/Cota Certa (businessNumberIds) paradas há mais de `horasSilencio`
// (last_message_at, qualquer direção) que ainda não receberam o lembrete de seguir no
// Instagram — instagram_lembrete_at IS NULL garante que é só 1 vez por conversa pra sempre.
async function listarParaLembreteInstagram(businessNumberIds, horasSilencio) {
  await ready;
  const limite = Date.now() - horasSilencio * 60 * 60 * 1000;
  const placeholders = businessNumberIds.map(() => "?").join(",");
  const result = await client.execute({
    sql: `SELECT phone, business_number_id FROM conversations
          WHERE business_number_id IN (${placeholders})
            AND instagram_lembrete_at IS NULL
            AND last_message_at IS NOT NULL AND last_message_at < ?`,
    args: [...businessNumberIds, limite],
  });
  return result.rows;
}

// Atômico (só marca se ainda tava NULL) — evita 2 voltas do setInterval mandarem o lembrete 2x
// pro mesmo contato.
async function tentarMarcarInstagramLembreteEnviado(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `UPDATE conversations SET instagram_lembrete_at = ?
          WHERE phone = ? AND business_number_id = ? AND instagram_lembrete_at IS NULL`,
    args: [Date.now(), phone, businessNumberId],
  });
  return result.rowsAffected > 0;
}

async function updateStatusByWaId(waMessageId, status, errorMessage = null) {
  await ready;
  await client.execute({
    sql: `UPDATE messages SET status = ?, error_message = COALESCE(?, error_message) WHERE wa_message_id = ?`,
    args: [status, errorMessage, waMessageId],
  });
  // status 'read' numa mensagem NOSSA = o cliente abriu o WhatsApp e viu — grava em
  // conversations.last_seen_at pro painel mostrar "visto às ..." (ver comentário na migração).
  if (status === "read") {
    const msg = await getMensagemPorWaId(waMessageId);
    if (msg && msg.direction === "out") {
      await client.execute({
        sql: `UPDATE conversations SET last_seen_at = ? WHERE phone = ? AND business_number_id = ?`,
        args: [Date.now(), msg.phone, msg.business_number_id],
      });
    }
  }
}

// Usado só quando um status 'failed' chega (ver processarEntry) pra decidir se a conversa pode
// ser apagada: precisa saber se ERA um template de campanha (não conta resposta de fluxo normal).
async function getMensagemPorWaId(waMessageId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT phone, business_number_id, type, direction FROM messages WHERE wa_message_id = ? ORDER BY id DESC LIMIT 1`,
    args: [waMessageId],
  });
  return result.rows[0] || null;
}

// Apaga uma conversa inteira (mensagens + o registro em conversations) — só chamado quando um
// template de campanha (broadcast frio) chega como 'failed' e a pessoa nunca respondeu nada:
// não é uma conversa de verdade, é lixo de número inválido/inexistente sujando o histórico do
// painel. Quem chama já garante essa checagem antes (ver limparBroadcastNuncaRespondido).
async function apagarConversa(phone, businessNumberId) {
  await ready;
  await client.execute({
    sql: `DELETE FROM messages WHERE phone = ? AND business_number_id = ?`,
    args: [phone, businessNumberId],
  });
  await client.execute({
    sql: `DELETE FROM conversations WHERE phone = ? AND business_number_id = ?`,
    args: [phone, businessNumberId],
  });
}

// incluirFinalizadas=false (padrão) exclui status='resolvido' — tanto da lista visível do
// painel quanto da checagem automática de 5s (ver /painel/api/inbox), que é a maior parte do
// consumo de leitura do banco. Uma conversa finalizada só reaparece aqui se o cliente
// escrever de novo (ver insertMessage, que reabre sozinho) ou se pedirem explicitamente com
// incluirFinalizadas=true (ver GET /painel/api/conversations/:businessId?finalizadas=1).
async function listConversations(businessNumberId, { incluirFinalizadas = false } = {}) {
  await ready;
  // Antes eram 3 sub-consultas correlacionadas por conversa (tipo/corpo/direção, cada uma
  // repetindo o mesmo "ache a última mensagem"). Agora é 1 só (o id), com JOIN de volta pra
  // pegar os 3 campos — junto com o índice idx_messages_phone_created (ver migração acima),
  // isso é a correção do consumo de leitura que estourou a cota do Turso.
  const result = await client.execute({
    sql: `
      SELECT c.*,
        lm.type AS last_type,
        lm.body AS last_body,
        lm.direction AS last_direction,
        lm.origem AS last_origem,
        (c.last_inbound_at IS NOT NULL AND (c.last_read_at IS NULL OR c.last_inbound_at > c.last_read_at)) AS nao_lida,
        tg.tags_json AS tags_json,
        cf.campos_json AS campos_json
      FROM conversations c
      LEFT JOIN messages lm ON lm.id = (
        SELECT m.id FROM messages m
        WHERE m.phone = c.phone AND m.business_number_id = c.business_number_id
        ORDER BY m.created_at DESC LIMIT 1
      )
      LEFT JOIN (
        SELECT ct.business_number_id, ct.phone,
          '[' || GROUP_CONCAT('{"id":' || t.id || ',"nome":"' || REPLACE(t.nome, '"', '\\"') || '","cor":"' || t.cor || '"}') || ']' AS tags_json
        FROM conversation_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE ct.business_number_id = ?
        GROUP BY ct.business_number_id, ct.phone
      ) tg ON tg.business_number_id = c.business_number_id AND tg.phone = c.phone
      LEFT JOIN (
        SELECT cv.business_id, cv.phone,
          '{' || GROUP_CONCAT('"' || REPLACE(cp.nome, '"', '\\"') || '":"' || REPLACE(cv.valor, '"', '\\"') || '"') || '}' AS campos_json
        FROM conversation_campos_valores cv
        JOIN campos_personalizados cp ON cp.id = cv.campo_id
        WHERE cv.business_id = ? AND cv.valor IS NOT NULL AND cv.valor != ''
        GROUP BY cv.business_id, cv.phone
      ) cf ON cf.business_id = c.business_number_id AND cf.phone = c.phone
      WHERE c.business_number_id = ? ${incluirFinalizadas ? "" : "AND c.status != 'resolvido'"}
      ORDER BY c.last_message_at DESC
    `,
    args: [businessNumberId, businessNumberId, businessNumberId],
  });
  return result.rows;
}

// `desde`/`ate` (epoch ms, opcionais) — carregamento por janela de dias no painel: sem eles,
// continua devolvendo o histórico inteiro (usado por /exportar, que precisa de tudo). Com eles,
// limita a consulta a um intervalo — evita reler e retransmitir a conversa inteira a cada
// abertura/poll pra contato com meses de histórico.
async function listMessages(phone, businessNumberId, { desde, ate } = {}) {
  await ready;
  const condicoes = ["phone = ?", "business_number_id = ?"];
  const args = [phone, businessNumberId];
  if (desde != null) {
    condicoes.push("created_at >= ?");
    args.push(desde);
  }
  if (ate != null) {
    condicoes.push("created_at < ?");
    args.push(ate);
  }
  const result = await client.execute({
    sql: `SELECT * FROM messages WHERE ${condicoes.join(" AND ")} ORDER BY created_at ASC`,
    args,
  });
  return result.rows;
}

// Últimas N mensagens em ordem cronológica — usado pra montar o contexto enviado à IA na
// sugestão de pipeline (ver gemini.js). Separado de listMessages (que traz tudo, pro painel
// renderizar a conversa inteira) pra não jogar histórico enorme inteiro pro prompt.
async function ultimasMensagens(phone, businessNumberId, limite = 30) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM messages WHERE phone = ? AND business_number_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [phone, businessNumberId, limite],
  });
  return result.rows.reverse();
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

async function googleConfigGet(chave) {
  await ready;
  const result = await client.execute({ sql: `SELECT valor FROM google_config WHERE chave = ?`, args: [chave] });
  return result.rows[0]?.valor ?? null;
}

async function googleConfigSet(chave, valor) {
  await ready;
  await client.execute({
    sql: `INSERT INTO google_config (chave, valor) VALUES (?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    args: [chave, valor],
  });
}

async function emailBackupObter(businessId) {
  await ready;
  const result = await client.execute({ sql: `SELECT email FROM email_backup_config WHERE business_id = ?`, args: [businessId] });
  return result.rows[0]?.email ?? null;
}

async function emailBackupDefinir(businessId, email) {
  await ready;
  await client.execute({
    sql: `INSERT INTO email_backup_config (business_id, email, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(business_id) DO UPDATE SET email = excluded.email, updated_at = excluded.updated_at`,
    args: [businessId, email, Date.now()],
  });
}

async function agendaCalendarioConfigObter(businessId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM agenda_calendario_config WHERE business_id = ?`, args: [businessId] });
  return result.rows[0] || null;
}

async function agendaCalendarioConfigDefinir(businessId, { calendarioId = "primary", horaInicio = 9, horaFim = 18, duracaoMinutos = 60 }) {
  await ready;
  await client.execute({
    sql: `INSERT INTO agenda_calendario_config (business_id, calendario_id, hora_inicio, hora_fim, duracao_minutos, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(business_id) DO UPDATE SET
            calendario_id = excluded.calendario_id, hora_inicio = excluded.hora_inicio,
            hora_fim = excluded.hora_fim, duracao_minutos = excluded.duracao_minutos, updated_at = excluded.updated_at`,
    args: [businessId, calendarioId, horaInicio, horaFim, duracaoMinutos, Date.now()],
  });
}

// Marca que já tentamos criar o contato (Google) e mandar o e-mail de boas-vindas (Brevo) pra
// essa conversa — chamado antes das chamadas externas em capturarContatoEBoasVindas (server.js)
// pra não duplicar se a pessoa completar outro funil depois.
async function marcarContatoSalvo(phone, businessNumberId, email) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET email = ?, contato_salvo_em = ? WHERE phone = ? AND business_number_id = ?`,
    args: [email, Date.now(), phone, businessNumberId],
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

// contaId opcional: sem ele, o LIMIT é aplicado somando todas as contas — com muitos posts
// na fila, uma conta específica pode ficar de fora do recorte inteiro (já causou um bug no
// painel, ver commit "Corrige painel Agenda: pendentes de uma conta somem do detalhe do dia").
// Passando contaId, o filtro entra ANTES do LIMIT, então a conta sempre aparece.
async function agendaListarRecentes(limit = 30, contaId = null) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM posts_agendados
          ${contaId ? "WHERE conta_id = ?" : ""}
          ORDER BY
            CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
            agendado_para DESC
          LIMIT ?`,
    args: contaId ? [contaId, limit] : [limit],
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

// Uma linha por solicitação de FGTS em andamento na Unnotech — etapa controla onde a conversa
// está (ver as funções `processarEtapa*` em server.js), status_unnotech guarda o último
// ApplicationStatus que a API devolveu, só pra debug/painel.
async function fgtsOriginationCriar(phone, businessNumberId, applicationId, cpf, idempotencyKey) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `INSERT INTO fgts_origination
            (phone, business_number_id, application_id, cpf, etapa, idempotency_key_atual, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'abrindo', ?, ?, ?)`,
    args: [phone, businessNumberId, applicationId, cpf, idempotencyKey, agora, agora],
  });
  return Number(result.lastInsertRowid);
}

// Etapas terminais não contam como "aberta" — evita abrir uma segunda solicitação em cima de
// uma já concluída/sem oferta/com erro, se o cliente mandar "fgts" de novo no meio do caminho.
const FGTS_ORIGINATION_ETAPAS_TERMINAIS = ["concluido", "sem_oferta", "erro"];

async function fgtsOriginationBuscarAberta(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fgts_origination WHERE phone = ? AND business_number_id = ?
          AND etapa NOT IN (${FGTS_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY id DESC LIMIT 1`,
    args: [phone, businessNumberId, ...FGTS_ORIGINATION_ETAPAS_TERMINAIS],
  });
  return result.rows[0] || null;
}

async function fgtsOriginationBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fgts_origination WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

// `campos` é um objeto { coluna: valor } — só atualiza o que for passado, sempre toca
// `updated_at` (é o que o verificador usa pra saber quando reconsultar).
async function fgtsOriginationAtualizar(id, campos) {
  await ready;
  const colunas = Object.keys(campos);
  if (!colunas.length) return;
  const sets = colunas.map((c) => `${c} = ?`).join(", ");
  await client.execute({
    sql: `UPDATE fgts_origination SET ${sets}, updated_at = ? WHERE id = ?`,
    args: [...colunas.map((c) => campos[c]), Date.now(), id],
  });
}

async function fgtsOriginationListarAbertas() {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fgts_origination
          WHERE etapa NOT IN (${FGTS_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY updated_at ASC`,
    args: FGTS_ORIGINATION_ETAPAS_TERMINAIS,
  });
  return result.rows;
}

async function fgtsOriginationBuscarPorFlowToken(token) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fgts_origination WHERE flow_token = ?`, args: [token] });
  return result.rows[0] || null;
}

// Atômico: só quem lê a linha exatamente na `etapaEsperada` consegue mudar pra `etapaNova` —
// evita processar a MESMA submissão de Flow duas vezes se a Meta reentregar o webhook (mesmo
// espírito do claim de broadcastProximoDevido).
async function fgtsOriginationReivindicar(id, etapaEsperada, etapaNova) {
  await ready;
  const result = await client.execute({
    sql: `UPDATE fgts_origination SET etapa = ?, updated_at = ? WHERE id = ? AND etapa = ?`,
    args: [etapaNova, Date.now(), id, etapaEsperada],
  });
  return result.rowsAffected > 0;
}

// ─── clt_origination — mesmo padrão de fgts_origination acima ──────────────────────────────
// Rascunho criado ao capturar o CPF, antes de existir application_id de verdade (o CLT ainda
// precisa do e-mail antes de poder abrir a solicitação na Unnotech — ver
// docs/superpowers/specs/2026-09-26-clt-unnotech-design.md). Etapa própria ('aguardando_email')
// pra já contar como "solicitação aberta" (evita abrir 2 rascunhos se o cliente mandar o CPF de
// novo antes de mandar o e-mail).
async function cltOriginationCriarRascunho(phone, businessNumberId, cpf) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `INSERT INTO clt_origination (phone, business_number_id, cpf, etapa, etapa_em, created_at, updated_at)
          VALUES (?, ?, ?, 'aguardando_email', ?, ?, ?)`,
    args: [phone, businessNumberId, cpf, agora, agora, agora],
  });
  return Number(result.lastInsertRowid);
}

const CLT_ORIGINATION_ETAPAS_TERMINAIS = ["concluido", "sem_oferta", "erro"];

async function cltOriginationBuscarAberta(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM clt_origination WHERE phone = ? AND business_number_id = ?
          AND etapa NOT IN (${CLT_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY id DESC LIMIT 1`,
    args: [phone, businessNumberId, ...CLT_ORIGINATION_ETAPAS_TERMINAIS],
  });
  return result.rows[0] || null;
}

async function cltOriginationBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM clt_origination WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

// Toda vez que `campos.etapa` muda, também marca `etapa_em` — diferente do FGTS (que só tem
// 'abrindo'/'oferta_apresentada'/etc. e usa created_at como base do prazo de cotação travada),
// o CLT passa por vários portões de duração muito diferente (autorização pode levar dias,
// simulação alguns segundos); sem um relógio por etapa, o prazo de "travado" de qualquer etapa
// teria que usar created_at (a hora em que a solicitação inteira foi aberta) e dispararia falso
// positivo pra quem só demorou pra autorizar antes de chegar na etapa seguinte.
async function cltOriginationAtualizar(id, campos) {
  await ready;
  const colunas = Object.keys(campos);
  if (!colunas.length) return;
  const agora = Date.now();
  const sets = colunas.map((c) => `${c} = ?`).join(", ");
  const valores = colunas.map((c) => campos[c]);
  const setaEtapaEm = "etapa" in campos;
  await client.execute({
    sql: `UPDATE clt_origination SET ${sets}${setaEtapaEm ? ", etapa_em = ?" : ""}, updated_at = ? WHERE id = ?`,
    args: setaEtapaEm ? [...valores, agora, agora, id] : [...valores, agora, id],
  });
}

async function cltOriginationListarAbertas() {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM clt_origination
          WHERE etapa NOT IN (${CLT_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY updated_at ASC`,
    args: CLT_ORIGINATION_ETAPAS_TERMINAIS,
  });
  return result.rows;
}

async function cltOriginationBuscarPorFlowToken(token) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM clt_origination WHERE flow_token = ?`, args: [token] });
  return result.rows[0] || null;
}

// Também marca etapa_em (achado na revisão final: cltOriginationAtualizar já faz isso quando
// `etapa` está entre os campos, mas essa função tem seu próprio UPDATE — sem espelhar aqui, uma
// reivindicação (ex.: 'aguardando_valor' -> 'simulando_pendente') não resetava o relógio do
// prazo por etapa, quebrando a invariante que o resto do código conta com).
async function cltOriginationReivindicar(id, etapaEsperada, etapaNova) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `UPDATE clt_origination SET etapa = ?, etapa_em = ?, updated_at = ? WHERE id = ? AND etapa = ?`,
    args: [etapaNova, agora, agora, id, etapaEsperada],
  });
  return result.rowsAffected > 0;
}

// ─── novosaque_origination — mesmo padrão de clt_origination acima ────────────────────────
// Rascunho SEM transaction_id (etapa 'abrindo') — achado na revisão final: a API da Novo Saque
// não documenta Idempotency-Key, e abrir direto (chamar a API antes de ter qualquer linha no
// banco) deixava uma janela real de corrida — 2 mensagens de CPF em paralelo, ou uma reentrega
// do mesmo webhook pela Meta, podiam abrir 2 transações de verdade na Novo Saque pra mesma
// pessoa. Agora insere o rascunho PRIMEIRO; novosaqueOriginationEhOMaisAntigoAberto (abaixo)
// decide quem "ganha" se mais de um rascunho for criado ao mesmo tempo.
async function novosaqueOriginationCriarRascunho(phone, businessNumberId, cpf) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `INSERT INTO novosaque_origination (phone, business_number_id, cpf, etapa, etapa_em, created_at, updated_at)
          VALUES (?, ?, ?, 'abrindo', ?, ?, ?)`,
    args: [phone, businessNumberId, cpf, agora, agora, agora],
  });
  return Number(result.lastInsertRowid);
}

const NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS = ["concluido", "sem_oferta", "erro"];

// true só pra quem tem o MENOR id entre as linhas abertas desse contato — critério determinístico
// pra decidir quem "ganha" quando 2 rascunhos nascem quase juntos (ver comentário acima). Cada
// chamador re-lê o estado JÁ COM o próprio insert feito, então o MIN() reflete corretamente
// qualquer concorrente que também já tenha inserido (garantia de escritor único do SQLite).
async function novosaqueOriginationEhOMaisAntigoAberto(phone, businessNumberId, id) {
  await ready;
  const result = await client.execute({
    sql: `SELECT MIN(id) as menor FROM novosaque_origination WHERE phone = ? AND business_number_id = ?
          AND etapa NOT IN (${NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})`,
    args: [phone, businessNumberId, ...NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS],
  });
  return Number(result.rows[0]?.menor) === id;
}

async function novosaqueOriginationBuscarAberta(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM novosaque_origination WHERE phone = ? AND business_number_id = ?
          AND etapa NOT IN (${NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY id DESC LIMIT 1`,
    args: [phone, businessNumberId, ...NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS],
  });
  return result.rows[0] || null;
}

async function novosaqueOriginationBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM novosaque_origination WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function novosaqueOriginationAtualizar(id, campos) {
  await ready;
  const colunas = Object.keys(campos);
  if (!colunas.length) return;
  const agora = Date.now();
  const sets = colunas.map((c) => `${c} = ?`).join(", ");
  const valores = colunas.map((c) => campos[c]);
  const setaEtapaEm = "etapa" in campos;
  await client.execute({
    sql: `UPDATE novosaque_origination SET ${sets}${setaEtapaEm ? ", etapa_em = ?" : ""}, updated_at = ? WHERE id = ?`,
    args: setaEtapaEm ? [...valores, agora, agora, id] : [...valores, agora, id],
  });
}

async function novosaqueOriginationListarAbertas() {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM novosaque_origination
          WHERE etapa NOT IN (${NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY updated_at ASC`,
    args: NOVOSAQUE_ORIGINATION_ETAPAS_TERMINAIS,
  });
  return result.rows;
}

async function novosaqueOriginationBuscarPorFlowToken(token) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM novosaque_origination WHERE flow_token = ?`, args: [token] });
  return result.rows[0] || null;
}

async function novosaqueOriginationReivindicar(id, etapaEsperada, etapaNova) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `UPDATE novosaque_origination SET etapa = ?, etapa_em = ?, updated_at = ? WHERE id = ? AND etapa = ?`,
    args: [etapaNova, agora, agora, id, etapaEsperada],
  });
  return result.rowsAffected > 0;
}

// Agenda os contatos 2+ de um broadcast com intervalo — cada item já vem com seu
// agendado_para calculado pelo chamador (server.js: agora + i * intervaloSegundos).
async function broadcastAgendarLote(businessId, itens, fluxoId) {
  await ready;
  const agora = Date.now();
  for (const item of itens) {
    await client.execute({
      sql: `INSERT INTO broadcast_agendado
              (business_id, phone, name, template, language, body_preview, agendado_para, fluxo_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        businessId,
        item.phone,
        item.name || null,
        item.template,
        item.language,
        item.bodyPreview || null,
        item.agendadoPara,
        fluxoId || null,
        agora,
      ],
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

// ─── E-mail (Brevo) — templates, campanha em massa e persistência do e-mail do contato ─────
async function atualizarEmailConversa(phone, businessNumberId, email) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET email = ? WHERE phone = ? AND business_number_id = ?`,
    args: [email || null, phone, businessNumberId],
  });
}

async function emailTemplateCriar({ businessId, nome, assunto, corpoHtml }) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO email_templates (business_id, nome, assunto, corpo_html, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [businessId, nome, assunto, corpoHtml, Date.now()],
  });
  return Number(result.lastInsertRowid);
}

async function emailTemplatesListar(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM email_templates WHERE business_id = ? ORDER BY nome COLLATE NOCASE`,
    args: [businessId],
  });
  return result.rows;
}

async function emailTemplateObter(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM email_templates WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function emailTemplateApagar(id) {
  await ready;
  await client.execute({ sql: `DELETE FROM email_templates WHERE id = ?`, args: [id] });
}

async function emailAgendarLote(businessId, itens) {
  await ready;
  const agora = Date.now();
  for (const item of itens) {
    await client.execute({
      sql: `INSERT INTO emails_agendados (business_id, destinatario_email, destinatario_nome, template_id, agendado_para, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [businessId, item.email, item.nome || null, item.templateId, item.agendadoPara, agora],
    });
  }
  return itens.length;
}

// Mesma trava anti-corrida de broadcastProximoDevido/agendaProximoDevido — marca 'processing'
// com claimed_at antes de mandar, pra dois ticks do setInterval não mandarem o mesmo e-mail
// duas vezes se o envio anterior demorar mais que o intervalo do agendador.
async function emailProximoDevido() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT * FROM emails_agendados
          WHERE (status = 'pending' AND agendado_para <= ?)
             OR (status = 'processing' AND claimed_at <= ?)
          ORDER BY agendado_para ASC LIMIT 1`,
    args: [agora, agora - PROCESSING_ORFAO_MS],
  });
  const item = result.rows[0];
  if (!item) return null;
  const claim = await client.execute({
    sql: `UPDATE emails_agendados SET status = 'processing', claimed_at = ? WHERE id = ? AND status = ?`,
    args: [agora, item.id, item.status],
  });
  if (claim.rowsAffected === 0) return null;
  return item;
}

async function emailMarcarEnviado(id) {
  await ready;
  await client.execute({ sql: `UPDATE emails_agendados SET status = 'sent', sent_at = ? WHERE id = ?`, args: [Date.now(), id] });
}

async function emailMarcarErro(id, mensagem) {
  await ready;
  await client.execute({ sql: `UPDATE emails_agendados SET status = 'error', erro = ? WHERE id = ?`, args: [mensagem, id] });
}

async function emailListarPendentes(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT ea.id, ea.destinatario_email, ea.destinatario_nome, ea.agendado_para, et.nome AS template_nome
          FROM emails_agendados ea JOIN email_templates et ON et.id = ea.template_id
          WHERE ea.business_id = ? AND ea.status = 'pending' ORDER BY ea.agendado_para ASC`,
    args: [businessId],
  });
  return result.rows;
}

async function emailCancelar(id) {
  await ready;
  const result = await client.execute({ sql: `DELETE FROM emails_agendados WHERE id = ? AND status = 'pending'`, args: [id] });
  return result.rowsAffected > 0;
}

// ─── Retornos (lembrete agendado por conversa — WhatsApp e/ou e-mail) ──────────────────────
async function retornoCriar({
  businessId,
  phone,
  tipo,
  dataAgendada,
  canal,
  whatsappTemplate,
  whatsappLanguage,
  whatsappParams,
  fluxoId,
  emailTemplateId,
}) {
  await ready;
  const result = await client.execute({
    sql: `INSERT INTO retornos
            (business_id, phone, tipo, data_agendada, canal, whatsapp_template, whatsapp_language, whatsapp_params, fluxo_id, email_template_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      businessId,
      phone,
      tipo || "retorno",
      dataAgendada,
      canal || "whatsapp",
      whatsappTemplate || null,
      whatsappLanguage || "pt_BR",
      whatsappParams && whatsappParams.length ? JSON.stringify(whatsappParams) : null,
      fluxoId || null,
      emailTemplateId || null,
      Date.now(),
    ],
  });
  await atividadeRegistrar({
    businessId,
    phone,
    tipo: "retorno",
    descricao: `Retorno agendado (${canal || "whatsapp"}) para ${new Date(dataAgendada).toLocaleString("pt-BR")}`,
  });
  return Number(result.lastInsertRowid);
}

async function retornoProximoDevido() {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `SELECT * FROM retornos
          WHERE (status = 'pending' AND data_agendada <= ?)
             OR (status = 'processing' AND claimed_at <= ?)
          ORDER BY data_agendada ASC LIMIT 1`,
    args: [agora, agora - PROCESSING_ORFAO_MS],
  });
  const item = result.rows[0];
  if (!item) return null;
  const claim = await client.execute({
    sql: `UPDATE retornos SET status = 'processing', claimed_at = ? WHERE id = ? AND status = ?`,
    args: [agora, item.id, item.status],
  });
  if (claim.rowsAffected === 0) return null;
  return item;
}

async function retornoMarcarEnviado(id) {
  await ready;
  await client.execute({ sql: `UPDATE retornos SET status = 'sent', enviado_em = ? WHERE id = ?`, args: [Date.now(), id] });
}

async function retornoMarcarErro(id, mensagem) {
  await ready;
  await client.execute({ sql: `UPDATE retornos SET status = 'error', erro = ? WHERE id = ?`, args: [mensagem, id] });
}

async function retornoListarPendentes(businessId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM retornos WHERE business_id = ? AND status = 'pending' ORDER BY data_agendada ASC`,
    args: [businessId],
  });
  return result.rows;
}

async function retornoListarPorConversa(businessId, phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM retornos WHERE business_id = ? AND phone = ? ORDER BY data_agendada ASC`,
    args: [businessId, phone],
  });
  return result.rows;
}

async function retornoCancelar(id) {
  await ready;
  const result = await client.execute({ sql: `DELETE FROM retornos WHERE id = ? AND status = 'pending'`, args: [id] });
  return result.rowsAffected > 0;
}

// Ajusta pro fuso de Brasília (UTC-3, sem horário de verão hoje em dia) antes de agrupar por
// dia — sem isso, mensagem de madrugada/fim de dia migra pro dia errado no gráfico (mesmo bug
// de fuso já visto no agendador do Publique IV).
const TZ_BRASIL_OFFSET_SEGUNDOS = 3 * 60 * 60;

// Painel de métricas do Analytics — genérica por business_number_id, liberada pra qualquer
// canal no painel desde 30/09/2026 (antes só a Felizcred principal via CANAL_ANALYTICS_LABEL).
// `desde`/`ate` em milissegundos (epoch). Cada consulta é independente (sem transação) — é
// leitura, não tem risco de inconsistência entre elas que importe pra uma tela de métricas.
async function analyticsResumo(businessNumberId, desde, ate) {
  await ready;

  const totalConversasQ = await client.execute({
    sql: `SELECT COUNT(DISTINCT phone) AS total FROM messages WHERE business_number_id = ? AND created_at BETWEEN ? AND ?`,
    args: [businessNumberId, desde, ate],
  });

  const novasConversasQ = await client.execute({
    sql: `
      SELECT COUNT(*) AS total FROM (
        SELECT phone, MIN(created_at) AS primeira FROM messages
        WHERE business_number_id = ? GROUP BY phone
      ) WHERE primeira BETWEEN ? AND ?
    `,
    args: [businessNumberId, desde, ate],
  });

  // COALESCE com last_message_at: conversas marcadas 'resolvido' ANTES da coluna resolvido_em
  // existir ficam com ela NULL pra sempre (nunca foi/será preenchida retroativamente) — sem o
  // COALESCE, `NULL BETWEEN ? AND ?` é falso e essas conversas somem da contagem por período,
  // mesmo aparecendo em porStatus (que conta status bruto, sem olhar data nenhuma). Achado
  // 2026-09-29 num teste real via MCP: porStatus mostrava 1 resolvida, conversasResolvidas
  // mostrava 0, pro mesmo período.
  const resolvidasQ = await client.execute({
    sql: `SELECT COUNT(*) AS total FROM conversations
          WHERE business_number_id = ? AND status = 'resolvido' AND COALESCE(resolvido_em, last_message_at) BETWEEN ? AND ?`,
    args: [businessNumberId, desde, ate],
  });

  const tempoRespostaHumanaQ = await client.execute({
    sql: `
      SELECT AVG(resp.diff) AS media, COUNT(*) AS amostras FROM (
        SELECT m_in.phone, MIN(m_out.created_at) - m_in.primeira_in AS diff
        FROM (
          SELECT phone, MIN(created_at) AS primeira_in FROM messages
          WHERE business_number_id = ? AND direction = 'in' AND created_at BETWEEN ? AND ?
          GROUP BY phone
        ) m_in
        JOIN messages m_out
          ON m_out.phone = m_in.phone AND m_out.business_number_id = ?
          AND m_out.direction = 'out' AND m_out.origem = 'humano'
          AND m_out.created_at > m_in.primeira_in
        GROUP BY m_in.phone, m_in.primeira_in
      ) resp
    `,
    args: [businessNumberId, desde, ate, businessNumberId],
  });

  const tempoResolucaoQ = await client.execute({
    sql: `
      SELECT AVG(c.resolvido_em - pm.primeira) AS media, COUNT(*) AS amostras
      FROM conversations c
      JOIN (SELECT phone, MIN(created_at) AS primeira FROM messages WHERE business_number_id = ? GROUP BY phone) pm
        ON pm.phone = c.phone
      WHERE c.business_number_id = ? AND c.status = 'resolvido' AND c.resolvido_em BETWEEN ? AND ?
    `,
    args: [businessNumberId, businessNumberId, desde, ate],
  });

  const porStatusQ = await client.execute({
    sql: `SELECT status, COUNT(*) AS total FROM conversations WHERE business_number_id = ? GROUP BY status`,
    args: [businessNumberId],
  });

  const porTagQ = await client.execute({
    sql: `
      SELECT t.id, t.nome, t.cor, COUNT(*) AS total
      FROM conversation_tags ct
      JOIN tags t ON t.id = ct.tag_id
      WHERE ct.business_number_id = ?
      GROUP BY t.id ORDER BY total DESC
    `,
    args: [businessNumberId],
  });

  const porEstagioQ = await client.execute({
    sql: `
      SELECT pipeline_estagio AS estagio, COUNT(*) AS total FROM conversations
      WHERE business_number_id = ? AND pipeline_estagio IS NOT NULL
      GROUP BY pipeline_estagio
    `,
    args: [businessNumberId],
  });

  const porDiaQ = await client.execute({
    sql: `
      SELECT strftime('%Y-%m-%d', (created_at / 1000) - ${TZ_BRASIL_OFFSET_SEGUNDOS}, 'unixepoch') AS dia,
        COUNT(*) AS mensagens, COUNT(DISTINCT phone) AS conversas
      FROM messages
      WHERE business_number_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY dia ORDER BY dia
    `,
    args: [businessNumberId, desde, ate],
  });

  const porDirecaoQ = await client.execute({
    sql: `SELECT direction, COUNT(*) AS total FROM messages WHERE business_number_id = ? AND created_at BETWEEN ? AND ? GROUP BY direction`,
    args: [businessNumberId, desde, ate],
  });

  // Histograma de hora do dia (0-23h, horário de Brasília) — pra decisão de plantão/escala:
  // em que horas o movimento de mensagem é maior.
  const porHoraQ = await client.execute({
    sql: `
      SELECT CAST(strftime('%H', (created_at / 1000) - ${TZ_BRASIL_OFFSET_SEGUNDOS}, 'unixepoch') AS INTEGER) AS hora,
        COUNT(*) AS total
      FROM messages
      WHERE business_number_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY hora ORDER BY hora
    `,
    args: [businessNumberId, desde, ate],
  });

  // Mensagens enviadas por atendente (messages.origem = nome de quem respondeu pelo painel, ver
  // POST .../reply) — precisa do login por pessoa pra fazer sentido; quem usa só o login único
  // antigo aparece agrupado como "humano".
  const porAtendenteQ = await client.execute({
    sql: `
      SELECT origem AS atendente, COUNT(*) AS mensagens, COUNT(DISTINCT phone) AS conversas
      FROM messages
      WHERE business_number_id = ? AND direction = 'out' AND origem IS NOT NULL AND created_at BETWEEN ? AND ?
      GROUP BY origem ORDER BY mensagens DESC
    `,
    args: [businessNumberId, desde, ate],
  });

  const totalConversas = totalConversasQ.rows[0]?.total || 0;
  const resolvidas = resolvidasQ.rows[0]?.total || 0;

  return {
    totalConversas,
    novasConversas: novasConversasQ.rows[0]?.total || 0,
    conversasResolvidas: resolvidas,
    taxaResolucao: totalConversas > 0 ? resolvidas / totalConversas : null,
    tempoMedioRespostaHumanaMs: tempoRespostaHumanaQ.rows[0]?.media ?? null,
    amostrasRespostaHumana: tempoRespostaHumanaQ.rows[0]?.amostras || 0,
    tempoMedioResolucaoMs: tempoResolucaoQ.rows[0]?.media ?? null,
    amostrasResolucao: tempoResolucaoQ.rows[0]?.amostras || 0,
    porStatus: porStatusQ.rows,
    porTag: porTagQ.rows,
    porEstagio: porEstagioQ.rows,
    porDia: porDiaQ.rows,
    porDirecao: porDirecaoQ.rows,
    porHora: porHoraQ.rows,
    porAtendente: porAtendenteQ.rows,
  };
}

// Usado pra diagnosticar "mensagem não entregue": agrupa as falhas recentes de um número por
// texto de erro e conta contatos distintos afetados — se for 1 contato só, o problema é do
// telefone dele; se forem vários, o problema é do número/WABA (ver feedback-whatsapp-business-
// payment-eligibility na memória).
async function whatsappFalhasRecentes(businessNumberId, desdeMs) {
  await ready;
  const [agrupado, detalhe] = await Promise.all([
    client.execute({
      sql: `
        SELECT error_message, COUNT(*) AS total, COUNT(DISTINCT phone) AS contatos,
          MAX(created_at) AS ultima
        FROM messages
        WHERE business_number_id = ? AND direction = 'out' AND status = 'failed' AND created_at >= ?
        GROUP BY error_message ORDER BY total DESC
      `,
      args: [businessNumberId, desdeMs],
    }),
    // por mensagem: dá pra ver se a falha é sempre logo na 1a resposta a um contato novo
    // (sinal de WABA ainda em "aquecimento") ou espalhada em contatos já conhecidos.
    client.execute({
      sql: `
        SELECT m.phone, m.type, m.created_at, m.error_message,
          (SELECT MIN(created_at) FROM messages m2 WHERE m2.phone = m.phone AND m2.business_number_id = m.business_number_id) AS primeira_msg_geral
        FROM messages m
        WHERE m.business_number_id = ? AND m.direction = 'out' AND m.status = 'failed' AND m.created_at >= ?
        ORDER BY m.created_at DESC LIMIT 30
      `,
      args: [businessNumberId, desdeMs],
    }),
  ]);
  return { agrupado: agrupado.rows, detalhe: detalhe.rows };
}

// ─── CRM/IA/Retornos (portado do painel da Especitá, partes gerais — ver README) ────────────

// Conversas de WhatsApp (exclui Instagram/e-mail) pra sincronização em massa com o Google
// Contatos — só as que o cliente já escreveu alguma vez (campanha sem resposta não vira contato).
async function conversasParaSincronizarGoogle() {
  await ready;
  const result = await client.execute(
    `SELECT phone, business_number_id, name, last_inbound_at FROM conversations
     WHERE business_number_id GLOB '[0-9]*' AND phone GLOB '[0-9]*'`
  );
  return result.rows.map((r) => ({
    phone: String(r.phone),
    businessNumberId: String(r.business_number_id),
    name: r.name ? String(r.name) : null,
    jaEscreveu: r.last_inbound_at != null,
  }));
}

async function renomearConversa(phone, businessNumberId, nome) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET name = ? WHERE phone = ? AND business_number_id = ?`,
    args: [nome || null, phone, businessNumberId],
  });
}

// Foto do contato, escolhida manualmente no painel ("Salvar contato") — fotoUrl já vem como
// caminho persistente (/media/:filename), igual qualquer outra mídia recebida.
async function definirFotoContato(phone, businessNumberId, fotoUrl) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET foto_url = ? WHERE phone = ? AND business_number_id = ?`,
    args: [fotoUrl || null, phone, businessNumberId],
  });
}

// Propaga nome/foto pros OUTROS canais que tiverem o mesmo telefone (o mesmo contato pode
// escrever pro número Principal E pro de outra campanha) — só identidade (nome/foto);
// pipeline/tags/notas/e-mail continuam por canal de propósito (pode ser um funil diferente em
// cada número). `businessNumberId` passado é excluído (já foi gravado direto na própria ação).
async function propagarIdentidadeContato(phone, businessNumberId, { nome, fotoUrl } = {}) {
  await ready;
  if (nome === undefined && fotoUrl === undefined) return;
  const sets = [];
  const args = [];
  if (nome !== undefined) {
    sets.push("name = ?");
    args.push(nome || null);
  }
  if (fotoUrl !== undefined) {
    sets.push("foto_url = ?");
    args.push(fotoUrl || null);
  }
  args.push(phone, businessNumberId);
  await client.execute({
    sql: `UPDATE conversations SET ${sets.join(", ")} WHERE phone = ? AND business_number_id != ?`,
    args,
  });
}

async function salvarGoogleContactResourceName(phone, businessNumberId, resourceName) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET google_contact_resource_name = ? WHERE phone = ? AND business_number_id = ?`,
    args: [resourceName, phone, businessNumberId],
  });
}

// Dedup de contato Google por TELEFONE — o mesmo telefone pode ter mais de uma linha em
// `conversations` (1 por número de WhatsApp — cada canal mantém sua própria thread, não mescla
// no CRM), mas o Google Contatos é 1 contato só por pessoa de verdade. Antes de criar um contato
// novo, quem sincroniza usa isto pra achar se ALGUMA OUTRA linha desse telefone já tem um
// google_contact_resource_name pra reaproveitar em vez de duplicar.
async function googleContactResourceNamePorTelefone(phone, excluirBusinessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT google_contact_resource_name FROM conversations
          WHERE phone = ? AND business_number_id != ? AND google_contact_resource_name IS NOT NULL
          LIMIT 1`,
    args: [phone, excluirBusinessNumberId],
  });
  return result.rows[0]?.google_contact_resource_name || null;
}

async function marcarBrevoContatoSync(phone, businessNumberId) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET brevo_contato_sync_em = ? WHERE phone = ? AND business_number_id = ?`,
    args: [Date.now(), phone, businessNumberId],
  });
}

// Mesmo telefone, canal(is) DIFERENTE(S) — pra um atendente notar (sem precisar adivinhar) que
// esse contato também tem conversa aberta em outro número/canal, e poder saltar pra lá.
// Puramente informativo (não mescla nada) — devolve só o essencial pra montar o link.
async function conversasDoTelefoneEmOutrosCanais(phone, excluirBusinessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT business_number_id, name, last_message_at FROM conversations
          WHERE phone = ? AND business_number_id != ? ORDER BY last_message_at DESC`,
    args: [phone, excluirBusinessNumberId],
  });
  return result.rows;
}

// Cria/atualiza um contato SEM mandar mensagem (importação CSV/Google Contacts) — de propósito
// não mexe em last_message_at (ficaria parecendo "conversa recente" sem nunca ter conversado).
async function importarContato(phone, businessNumberId, { nome, email, googleResourceName } = {}) {
  await ready;
  await client.execute({
    sql: `INSERT INTO conversations (phone, business_number_id, name, email, google_contact_resource_name)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(phone, business_number_id) DO UPDATE SET
            name = COALESCE(excluded.name, conversations.name),
            email = COALESCE(excluded.email, conversations.email),
            google_contact_resource_name = COALESCE(excluded.google_contact_resource_name, conversations.google_contact_resource_name)`,
    args: [phone, businessNumberId, nome || null, email || null, googleResourceName || null],
  });
}

// Só mídia (imagem/vídeo) da conversa inteira, sem limite de janela — alimenta a Galeria do
// painel, que precisa ver tudo mesmo quando o histórico de texto carrega por partes (ver
// listMessages com desde/até). Colunas enxutas de propósito (sem `body`, que não interessa aqui).
async function listMidiasDaConversa(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT id, type, media_path, media_mime, created_at FROM messages
          WHERE phone = ? AND business_number_id = ? AND media_path IS NOT NULL AND type IN ('image', 'video')
          ORDER BY created_at ASC`,
    args: [phone, businessNumberId],
  });
  return result.rows;
}

// ─── Alerta de "parado na etapa" do pipeline (ver pipeline_alertas_config) ──────────────────
async function conversasEtapaParada() {
  await ready;
  const result = await client.execute(
    `SELECT phone, business_number_id, pipeline_estagio, pipeline_estagio_desde
     FROM conversations
     WHERE status != 'resolvido'
       AND pipeline_estagio IS NOT NULL
       AND pipeline_estagio_desde IS NOT NULL
       AND pipeline_alerta_em IS NULL`,
  );
  return result.rows;
}

async function marcarAlertaEtapaEnviado(phone, businessNumberId) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET pipeline_alerta_em = ? WHERE phone = ? AND business_number_id = ?`,
    args: [Date.now(), phone, businessNumberId],
  });
}

async function pipelineAlertasConfigListar() {
  await ready;
  const result = await client.execute(`SELECT estagio_id, minutos FROM pipeline_alertas_config`);
  const mapa = {};
  for (const row of result.rows) mapa[row.estagio_id] = Number(row.minutos);
  return mapa;
}

// minutos null/0 remove a linha (desativa o alerta pra essa etapa); valor positivo cria/atualiza.
async function pipelineAlertaConfigDefinir(estagioId, minutos) {
  await ready;
  if (!minutos) {
    await client.execute({ sql: `DELETE FROM pipeline_alertas_config WHERE estagio_id = ?`, args: [estagioId] });
    return;
  }
  await client.execute({
    sql: `INSERT INTO pipeline_alertas_config (estagio_id, minutos) VALUES (?, ?)
          ON CONFLICT(estagio_id) DO UPDATE SET minutos = excluded.minutos`,
    args: [estagioId, minutos],
  });
}

// ─── Copiloto de vendas pré-calculado ────────────────────────────────────────────────────────
// Candidatas: conversa aberta (não finalizada), cuja ÚLTIMA mensagem de verdade é do cliente
// (last_inbound_at = last_message_at — mesma lógica de last_direction === "in" sem precisar de
// JOIN em messages), SEM fluxo automático esperando resposta dela agora (fluxo_passo IS NULL —
// nesse caso é o bot, não um humano, que vai responder em seguida) e com cache ausente ou
// desatualizado (mensagem nova chegou depois do último cálculo). LIMIT baixo de propósito: cada
// candidata custa 1 chamada à IA (cota diária compartilhada com corretor/alerta de etapa) — ritmo
// suficiente pra acompanhar tráfego real sem estourar limite de requisições por minuto da API
// gratuita. Se sobrar backlog, a rodada seguinte pega o resto — nunca processa a mesma conversa 2x
// ao mesmo tempo (guard no lado do server.js).
async function conversasParaPrecomputarCopiloto() {
  await ready;
  // Sem filtro de fluxo_passo: se o robô respondeu, a última mensagem já é nossa e a conversa
  // sai sozinha daqui. Os 45s dão tempo do robô responder antes de gastar uma chamada de IA;
  // só conversas dos últimos 3 dias (backlog antigo não consome a cota).
  const result = await client.execute({
    sql: `SELECT phone, business_number_id, last_message_at
     FROM conversations
     WHERE status != 'resolvido'
       AND last_inbound_at IS NOT NULL
       AND last_inbound_at = last_message_at
       AND last_message_at < ?
       AND last_message_at > ?
       AND (copiloto_cache_em IS NULL OR copiloto_cache_em != last_message_at)
     ORDER BY last_message_at DESC
     LIMIT 15`,
    args: [Date.now() - 45 * 1000, Date.now() - 3 * 24 * 60 * 60 * 1000],
  });
  return result.rows;
}

async function copilotoCacheSalvar(phone, businessNumberId, texto, insight, lastMessageAt) {
  await ready;
  await client.execute({
    sql: `UPDATE conversations SET copiloto_texto = ?, copiloto_insight = ?, copiloto_cache_em = ? WHERE phone = ? AND business_number_id = ?`,
    args: [texto || null, insight || null, lastMessageAt, phone, businessNumberId],
  });
}

// ─── Feedback/aceitação da IA ────────────────────────────────────────────────────────────────
async function iaFeedbackRegistrar({ businessId, phone, tipo, evento, comentario, usuario }) {
  await ready;
  await client.execute({
    sql: `INSERT INTO ia_feedback (business_id, phone, tipo, evento, comentario, usuario, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [businessId || null, phone || null, tipo, evento, comentario || null, usuario || null, Date.now()],
  });
}

async function iaFeedbackListarComentarios(limite = 50) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM ia_feedback WHERE evento = 'comentario' ORDER BY created_at DESC LIMIT ?`,
    args: [limite],
  });
  return result.rows;
}

// Taxa de aceitação por tipo — agrupa mostrada/aceita/descartada, usado na tela de IA pra
// responder com número em vez de impressão "a IA é útil?".
async function iaFeedbackResumoPorTipo() {
  await ready;
  const result = await client.execute(
    `SELECT tipo, evento, COUNT(*) as total FROM ia_feedback WHERE evento != 'comentario' GROUP BY tipo, evento`,
  );
  return result.rows;
}

// ─── Sugestões de retorno pendentes (radar: etapa parada / cliente inativo) ─────────────────
// Junta num lugar só (tela Retornos) tudo que o radar acha que vale um retorno. "Aprovar" NUNCA
// envia nada sozinho — só abre a conversa pra um humano decidir canal/texto.
async function sugestaoRetornoCriar({ businessId, phone, tipo, motivo }) {
  await ready;
  await client.execute({
    sql: `INSERT INTO sugestoes_retorno (business_id, phone, tipo, motivo, status, created_at) VALUES (?, ?, ?, ?, 'pendente', ?)`,
    args: [businessId, phone, tipo, motivo, Date.now()],
  });
}

async function sugestaoRetornoPendenteExiste(businessId, phone) {
  await ready;
  const result = await client.execute({
    sql: `SELECT 1 FROM sugestoes_retorno WHERE business_id = ? AND phone = ? AND status = 'pendente'`,
    args: [businessId, phone],
  });
  return result.rows.length > 0;
}

async function sugestoesRetornoPendentes() {
  await ready;
  const result = await client.execute(
    `SELECT sr.*, c.name FROM sugestoes_retorno sr
     LEFT JOIN conversations c ON c.business_number_id = sr.business_id AND c.phone = sr.phone
     WHERE sr.status = 'pendente' ORDER BY sr.created_at ASC`,
  );
  return result.rows;
}

async function sugestaoRetornoMarcarStatus(id, status) {
  await ready;
  await client.execute({ sql: `UPDATE sugestoes_retorno SET status = ? WHERE id = ?`, args: [status, id] });
}

// Candidatos a sugestão de "cliente inativo há muito tempo" (radar de reativação) — exclui quem
// já está "perdido" no pipeline, quem já tem a tag "Não enviar campanha" e quem já tem uma
// sugestão pendente pra não duplicar.
async function conversasInativas(limiarMs) {
  await ready;
  const result = await client.execute({
    sql: `SELECT c.phone, c.business_number_id, c.name, c.last_message_at
          FROM conversations c
          WHERE c.last_message_at IS NOT NULL
            AND c.last_message_at < ?
            AND (c.pipeline_estagio IS NULL OR c.pipeline_estagio != 'perdido')
            AND NOT EXISTS (
              SELECT 1 FROM conversation_tags ctx
              JOIN tags tx ON tx.id = ctx.tag_id
              WHERE ctx.business_number_id = c.business_number_id AND ctx.phone = c.phone
                AND tx.nome = ? COLLATE NOCASE
            )
            AND NOT EXISTS (
              SELECT 1 FROM sugestoes_retorno sr
              WHERE sr.business_id = c.business_number_id AND sr.phone = c.phone AND sr.status = 'pendente'
            )`,
    args: [Date.now() - limiarMs, TAG_NAO_ENVIAR_CAMPANHA],
  });
  return result.rows;
}

// ─── Reativação — 2º toque ───────────────────────────────────────────────────────────────────
// Candidatos: retorno de reativação (1º toque) já ENVIADO de verdade há `diasAntesMs` ou mais,
// ainda não avaliado pro 2º toque (reforco_criado = 0) — quem chama decide, pra cada um, se a
// pessoa respondeu desde então (não precisa de 2º toque) ou não (cria sugestão), e sempre marca
// reforco_criado = 1 no final pra nunca reavaliar o mesmo retorno de novo. `templateNome` é o
// nome do template de WhatsApp usado no 1º toque (configurável por quem chama, não fixo aqui).
async function retornosReativacaoElegiveisPara2Toque(templateNome, antesDe) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM retornos
          WHERE whatsapp_template = ? AND status = 'sent'
            AND enviado_em IS NOT NULL AND enviado_em <= ?
            AND reforco_criado = 0`,
    args: [templateNome, antesDe],
  });
  return result.rows;
}

async function retornoMarcarReforcoCriado(id) {
  await ready;
  await client.execute({ sql: `UPDATE retornos SET reforco_criado = 1 WHERE id = ?`, args: [id] });
}

// ─── Segmentação pra campanha de WhatsApp (assistente de 3 passos) ──────────────────────────
// Combina em E (AND) só os filtros informados: etapa exata do pipeline, 1 tag, e/ou aniversário
// nos próximos N dias. Sempre exclui conversa finalizada, mesmo critério do listConversations.
// Sem nenhum filtro, devolve todo contato ativo do número (equivalente a "selecionar todos").
// Nome EXATO da tag que marca "nunca mais incluir esse contato numa campanha" — SEMPRE exclui,
// não é opcional (risco de reputação/LGPD, não só detalhe de UX).
const TAG_NAO_ENVIAR_CAMPANHA = "Não enviar campanha";

// Verdadeiro se a Data de nascimento (string ISO "YYYY-MM-DD...") cai dentro dos próximos `dias`
// dias, comparando só dia-mês (o ano de nascimento não importa) — cobre virada de ano.
function aniversarioNosProximosDias(nascimentoIso, dias, agora = new Date()) {
  if (!nascimentoIso) return false;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(nascimentoIso));
  if (!m) return false;
  const mes = Number(m[1]);
  const dia = Number(m[2]);
  if (!mes || !dia || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  let alvo = new Date(hoje.getFullYear(), mes - 1, dia);
  if (alvo < hoje) alvo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  const diffDias = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  return diffDias >= 0 && diffDias <= dias;
}

async function conversasParaCampanha(businessId, { estagio, tagId, aniversarioDias } = {}) {
  await ready;
  const condicoes = [
    "c.business_number_id = ?",
    "c.status != 'resolvido'",
    `NOT EXISTS (
      SELECT 1 FROM conversation_tags ctx
      JOIN tags tx ON tx.id = ctx.tag_id
      WHERE ctx.business_number_id = c.business_number_id AND ctx.phone = c.phone
        AND tx.nome = ? COLLATE NOCASE
    )`,
  ];
  const args = [businessId, TAG_NAO_ENVIAR_CAMPANHA];
  let joins = "";
  if (estagio) {
    condicoes.push("c.pipeline_estagio = ?");
    args.push(estagio);
  }
  if (tagId) {
    joins +=
      " JOIN conversation_tags ct ON ct.business_number_id = c.business_number_id AND ct.phone = c.phone AND ct.tag_id = ?";
    args.push(Number(tagId));
  }
  if (aniversarioDias != null) {
    joins += ` LEFT JOIN conversation_campos_valores cvn
      ON cvn.business_id = c.business_number_id AND cvn.phone = c.phone
      AND cvn.campo_id = (SELECT id FROM campos_personalizados WHERE business_id = c.business_number_id AND nome = 'Data de nascimento' LIMIT 1)`;
  }
  const sql = `
    SELECT c.phone, c.name${aniversarioDias != null ? ", cvn.valor AS nascimento" : ""}
    FROM conversations c
    ${joins}
    WHERE ${condicoes.join(" AND ")}
    ORDER BY c.last_message_at DESC
  `;
  const result = await client.execute({ sql, args });
  let linhas = result.rows;
  if (aniversarioDias != null) {
    linhas = linhas.filter((r) => aniversarioNosProximosDias(r.nascimento, Number(aniversarioDias)));
  }
  return linhas.map((r) => ({ phone: r.phone, name: r.name || null }));
}

// ─── Aniversário do contato (campanha automática) ───────────────────────────────────────────
// `mmdd` = "MM-DD" de hoje (calculado em BRT por quem chama) — substr(valor, 6, 5) pega o
// "MM-DD" de dentro de um "YYYY-MM-DD" guardado pelo <input type="date">.
async function aniversariantesHoje(mmdd) {
  await ready;
  const result = await client.execute({
    sql: `SELECT c.business_number_id AS business_id, c.phone, c.name
          FROM conversation_campos_valores cv
          JOIN campos_personalizados cp ON cp.id = cv.campo_id AND cp.nome = 'Data de nascimento'
          JOIN conversations c ON c.business_number_id = cv.business_id AND c.phone = cv.phone
          WHERE cv.valor IS NOT NULL AND cv.valor != '' AND substr(cv.valor, 6, 5) = ?`,
    args: [mmdd],
  });
  return result.rows;
}

async function aniversarioJaEnviado(businessId, phone, ano) {
  await ready;
  const result = await client.execute({
    sql: `SELECT 1 FROM aniversarios_enviados WHERE business_id = ? AND phone = ? AND ano = ?`,
    args: [businessId, phone, ano],
  });
  return result.rows.length > 0;
}

async function aniversarioMarcarEnviado(businessId, phone, ano) {
  await ready;
  await client.execute({
    sql: `INSERT OR IGNORE INTO aniversarios_enviados (business_id, phone, ano, enviado_em) VALUES (?, ?, ?, ?)`,
    args: [businessId, phone, ano, Date.now()],
  });
}

// Status de revisão do ROTEADOR EM CÓDIGO — mapa { chave: boolean }, só com as chaves que já
// foram tocadas alguma vez (chave nunca marcada ainda não aparece aqui; o frontend trata isso
// como "pendente" por padrão).
async function roteadorRevisadoListar() {
  await ready;
  const result = await client.execute(`SELECT chave, revisado FROM roteador_revisado`);
  const mapa = {};
  for (const r of result.rows) mapa[r.chave] = Boolean(r.revisado);
  return mapa;
}

async function roteadorRevisadoDefinir(chave, revisado) {
  await ready;
  await client.execute({
    sql: `INSERT INTO roteador_revisado (chave, revisado, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(chave) DO UPDATE SET revisado = excluded.revisado, updated_at = excluded.updated_at`,
    args: [chave, revisado ? 1 : 0, Date.now()],
  });
}

async function siteChatCriar({ id, tokenHash, name, contact, email, pageUrl, message, produtoTag, whatsappOptIn, whatsappOptInVersion, whatsappOptInText }) {
  await ready;
  const now = Date.now();
  await client.batch([
    {
      sql: `INSERT INTO site_chat_conversations
            (id, visitor_token_hash, name, contact, email, page_url, status, created_at, updated_at, last_visitor_at,
             produto_tag, pipeline_estagio, pipeline_estagio_desde, whatsapp_opt_in_at, whatsapp_opt_in_source,
             whatsapp_opt_in_version, whatsapp_opt_in_text)
            VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 'novo_lead', ?, ?, ?, ?, ?)`,
      args: [id, tokenHash, name, contact || null, email || null, pageUrl || null, now, now, now, produtoTag || null, now, whatsappOptIn ? now : null, whatsappOptIn ? "site_chat" : null, whatsappOptIn ? whatsappOptInVersion : null, whatsappOptIn ? whatsappOptInText : null],
    },
    {
      sql: `INSERT INTO site_chat_messages (conversation_id, direction, body, sender_name, created_at)
            VALUES (?, 'visitor', ?, ?, ?)`,
      args: [id, message, name, now],
    },
  ]);
  return { id, status: "open", created_at: now, updated_at: now };
}

// Mantém a prova do aceite original e registra separadamente quando o mesmo telefone pede
// para não receber mais mensagens. O contato do site pode estar formatado e o webhook chega
// com DDI; por isso a comparação usa os 10/11 dígitos nacionais.
async function siteChatRegistrarOptOut(phone) {
  await ready;
  const digits = String(phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length < 10) return 0;
  const now = Date.now();
  const result = await client.execute({
    sql: `UPDATE site_chat_conversations
          SET whatsapp_opt_out_at = ?, updated_at = ?
          WHERE whatsapp_opt_in_at IS NOT NULL
            AND whatsapp_opt_out_at IS NULL
            AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(contact, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '') LIKE ?`,
    args: [now, now, `%${digits}`],
  });
  return result.rowsAffected;
}

async function siteChatObter(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM site_chat_conversations WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

async function siteChatRecuperarClt(cpf, referencia) {
  await ready;
  const digits = String(referencia || "").replace(/\D/g, "");
  const phoneDigits = /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
  const result = await client.execute({
    sql: `SELECT conversation_id FROM site_chat_clt
          WHERE cpf = ? AND (codigo_proposta = ? OR phone LIKE ?)
          ORDER BY updated_at DESC LIMIT 1`,
    args: [String(cpf || "").replace(/\D/g, ""), digits, `%${phoneDigits}`],
  });
  const id = result.rows[0]?.conversation_id;
  if (!id) return null;
  return { conversation: await siteChatObter(id), clt: await siteChatCltObter(id) };
}

async function siteChatRenovarToken(id, tokenHash) {
  await ready;
  await client.execute({
    sql: `UPDATE site_chat_conversations SET visitor_token_hash = ?, status = 'open', updated_at = ? WHERE id = ?`,
    args: [tokenHash, Date.now(), id],
  });
  return siteChatObter(id);
}

async function siteChatMensagens(id) {
  await ready;
  const result = await client.execute({
    sql: `SELECT id, conversation_id, direction, body, sender_name, created_at,
                 COALESCE(type, 'text') AS type, media_url, media_mime, file_name
          FROM site_chat_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`,
    args: [id],
  });
  return result.rows;
}

async function siteChatMensagemVisitante(id, name, body, media = {}) {
  await ready;
  const now = Date.now();
  await client.batch([
    {
      sql: `INSERT INTO site_chat_messages
            (conversation_id, direction, body, sender_name, created_at, type, media_url, media_mime, file_name)
            VALUES (?, 'visitor', ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body || "", name, now, media.type || "text", media.url || null, media.mime || null, media.fileName || null],
    },
    {
      sql: `UPDATE site_chat_conversations SET status = 'open', updated_at = ?, last_visitor_at = ? WHERE id = ?`,
      args: [now, now, id],
    },
  ]);
}

async function siteChatMensagemAtendente(id, senderName, body, media = {}) {
  await ready;
  const now = Date.now();
  await client.batch([
    {
      sql: `INSERT INTO site_chat_messages
            (conversation_id, direction, body, sender_name, created_at, type, media_url, media_mime, file_name)
            VALUES (?, 'agent', ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body || "", senderName, now, media.type || "text", media.url || null, media.mime || null, media.fileName || null],
    },
    {
      sql: `UPDATE site_chat_conversations SET status = 'open', updated_at = ?, last_agent_at = ? WHERE id = ?`,
      args: [now, now, id],
    },
  ]);
}

async function siteChatListar() {
  await ready;
  const result = await client.execute(`
    SELECT c.*,
      (SELECT body FROM site_chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
      CASE WHEN c.last_visitor_at IS NOT NULL AND c.last_visitor_at > COALESCE(c.last_read_at, 0) THEN 1 ELSE 0 END AS unread
    FROM site_chat_conversations c
    ORDER BY CASE WHEN c.status = 'open' THEN 0 ELSE 1 END, c.updated_at DESC
  `);
  return result.rows;
}

// Finaliza as conversas abertas do chat do site sem atividade desde `desde` (ms) — mesmo corte da limpeza de
// conversas do WhatsApp. Só fecha (não apaga): se o visitante voltar a escrever, a conversa reabre sozinha.
async function siteChatFinalizarAntigas(desde) {
  await ready;
  const r = await client.execute({ sql: `UPDATE site_chat_conversations SET status = 'closed' WHERE status = 'open' AND updated_at < ?`, args: [desde] });
  return Number(r.rowsAffected || 0);
}

async function siteChatDefinirNome(id, name) {
  await ready;
  await client.execute({ sql: `UPDATE site_chat_conversations SET name = ? WHERE id = ?`, args: [name, id] });
}

// Conversas abertas do site com e-mail, cujo cliente parou de escrever entre `desde` e `ate` (ms) e que ainda não
// receberam o e-mail de retomada. Junta a etapa da consulta CLT (pode ser nula).
async function siteChatParaRetomada(desde, ate) {
  await ready;
  const r = await client.execute({
    sql: `SELECT c.id, c.name, c.email, c.produto_tag, t.etapa
          FROM site_chat_conversations c LEFT JOIN site_chat_clt t ON t.conversation_id = c.id
          WHERE c.status = 'open' AND c.email IS NOT NULL AND c.email != ''
            AND c.email_retomada_at IS NULL AND c.last_visitor_at BETWEEN ? AND ?`,
    args: [desde, ate],
  });
  return r.rows.map((x) => ({ ...x }));
}

async function siteChatEmailMarcar(id, campo, ts) {
  await ready;
  if (!["email_retomada_at", "email_resposta_at"].includes(campo)) throw new Error("campo inválido");
  await client.execute({ sql: `UPDATE site_chat_conversations SET ${campo} = ? WHERE id = ?`, args: [ts, id] });
}

async function siteChatMarcarLida(id) {
  await ready;
  await client.execute({ sql: `UPDATE site_chat_conversations SET last_read_at = ? WHERE id = ?`, args: [Date.now(), id] });
}

async function siteChatDefinirStatus(id, status) {
  await ready;
  await client.execute({ sql: `UPDATE site_chat_conversations SET status = ?, updated_at = ? WHERE id = ?`, args: [status, Date.now(), id] });
}

async function siteChatDefinirPipeline(id, estagio) {
  await ready;
  await client.execute({
    sql: `UPDATE site_chat_conversations SET pipeline_estagio = ?, pipeline_estagio_desde = ? WHERE id = ?`,
    args: [estagio, Date.now(), id],
  });
}

async function siteChatDefinirProduto(id, produtoTag) {
  await ready;
  await client.execute({
    sql: `UPDATE site_chat_conversations SET produto_tag = ? WHERE id = ?`,
    args: [produtoTag || null, id],
  });
}

async function siteChatFunilEvento(conversationId, eventName, stepId, providerId = null, reasonCode = null) {
  await ready;
  await client.execute({
    sql: `INSERT OR IGNORE INTO site_chat_funnel_events
          (conversation_id, event_name, step_id, provider_id, reason_code, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [conversationId, eventName, stepId, providerId, reasonCode, Date.now()],
  });
}

async function siteChatSolicitarHumano(id) {
  await ready;
  const now = Date.now();
  await client.execute({
    sql: `UPDATE site_chat_conversations
          SET human_intent_count = COALESCE(human_intent_count, 0) + 1,
              human_handoff_requested_at = CASE WHEN COALESCE(human_intent_count, 0) >= 1 THEN ? ELSE human_handoff_requested_at END,
              updated_at = ? WHERE id = ?`,
    args: [now, now, id],
  });
  return siteChatObter(id);
}

async function siteChatDefinirIntencaoHumano(id, stage) {
  await ready;
  await client.execute({
    sql: `UPDATE site_chat_conversations SET human_intent_stage = ?, updated_at = ? WHERE id = ?`,
    args: [stage || null, Date.now(), id],
  });
  return siteChatObter(id);
}

async function siteChatConfirmarHumano(id) {
  await ready;
  const now = Date.now();
  await client.execute({
    sql: `UPDATE site_chat_conversations
          SET human_intent_count = COALESCE(human_intent_count, 0) + 1,
              human_intent_stage = 'requested', human_handoff_requested_at = ?,
              status = 'open', updated_at = ? WHERE id = ?`,
    args: [now, now, id],
  });
  return siteChatObter(id);
}

async function siteChatLimparHumano(id) {
  await ready;
  await client.execute({ sql: `UPDATE site_chat_conversations SET human_intent_stage = NULL WHERE id = ?`, args: [id] });
}

async function siteChatFunilResumo(desdeMs) {
  await ready;
  const [eventos, paradas, motivos] = await Promise.all([
    client.execute({
      sql: `SELECT event_name, COUNT(DISTINCT conversation_id) AS total
            FROM site_chat_funnel_events WHERE created_at >= ? GROUP BY event_name`,
      args: [desdeMs],
    }),
    client.execute({
      sql: `SELECT COALESCE(clt.etapa, 'entrada') AS etapa,
                   COUNT(*) AS total,
                   SUM(CASE WHEN c.status = 'open' AND c.updated_at <= ? THEN 1 ELSE 0 END) AS silenciosos
            FROM site_chat_conversations c
            LEFT JOIN site_chat_clt clt ON clt.conversation_id = c.id
            WHERE c.created_at >= ? AND c.produto_tag = 'Empréstimo CLT'
            GROUP BY COALESCE(clt.etapa, 'entrada') ORDER BY total DESC`,
      args: [Date.now() - 30 * 60 * 1000, desdeMs],
    }),
    client.execute({
      sql: `SELECT reason_code AS motivo, COUNT(DISTINCT conversation_id) AS total
            FROM site_chat_funnel_events
            WHERE created_at >= ? AND reason_code IS NOT NULL
            GROUP BY reason_code ORDER BY total DESC`,
      args: [desdeMs],
    }),
  ]);
  return {
    etapas: Object.fromEntries(eventos.rows.map((r) => [r.event_name, Number(r.total || 0)])),
    paradas: paradas.rows.map((r) => ({ etapa: r.etapa, total: Number(r.total || 0), silenciosos: Number(r.silenciosos || 0) })),
    motivos: motivos.rows.map((r) => ({ motivo: r.motivo, total: Number(r.total || 0) })),
  };
}

async function siteChatCltObter(conversationId) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM site_chat_clt WHERE conversation_id = ?`, args: [conversationId] });
  return result.rows[0] || null;
}

async function siteChatCltObterPorTrackingToken(token) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM site_chat_clt WHERE tracking_token = ? LIMIT 1`,
    args: [String(token || "")],
  });
  return result.rows[0] || null;
}

async function siteChatFactaListarEmAcompanhamento() {
  await ready;
  const result = await client.execute(`
    SELECT * FROM site_chat_clt
    WHERE provider = 'facta'
      AND codigo_proposta IS NOT NULL
      AND etapa IN ('aguardando_assinatura_facta', 'proposta_em_analise')
    ORDER BY updated_at ASC
  `);
  return result.rows;
}

async function siteChatCltCriar(conversationId, transactionId, phone) {
  await ready;
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO site_chat_clt (conversation_id, transaction_id, phone, etapa, created_at, updated_at)
          VALUES (?, ?, ?, 'aguardando_autorizacao', ?, ?)
          ON CONFLICT(conversation_id) DO UPDATE SET transaction_id = excluded.transaction_id,
            phone = excluded.phone, etapa = 'aguardando_autorizacao', error_message = NULL, updated_at = excluded.updated_at`,
    args: [conversationId, transactionId, phone || null, now, now],
  });
  return siteChatCltObter(conversationId);
}

async function siteChatFactaCriar(conversationId, dados) {
  await ready;
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO site_chat_clt
            (conversation_id, provider, cpf, phone, margem_disponivel, offline_updated_at, possui_alertas, etapa, status_novosaque, tracking_token, created_at, updated_at)
          VALUES (?, 'facta', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(conversation_id) DO UPDATE SET
            provider = 'facta', cpf = excluded.cpf, phone = excluded.phone,
            margem_disponivel = excluded.margem_disponivel,
            offline_updated_at = excluded.offline_updated_at,
            possui_alertas = excluded.possui_alertas, etapa = excluded.etapa,
            status_novosaque = excluded.status_novosaque, transaction_id = NULL,
            tracking_token = COALESCE(site_chat_clt.tracking_token, excluded.tracking_token),
            terms_link = NULL, contract_link = NULL, offers_json = NULL,
            error_message = NULL, updated_at = excluded.updated_at`,
    args: [
      conversationId,
      dados.cpf,
      dados.phone || null,
      dados.margemDisponivel ?? null,
      dados.offlineUpdatedAt || null,
      dados.possuiAlertas || null,
      dados.etapa,
      dados.status || null,
      dados.trackingToken || null,
      now,
      now,
    ],
  });
  return siteChatCltObter(conversationId);
}

async function siteChatCltAtualizar(conversationId, campos) {
  await ready;
  const permitidos = ["transaction_id", "simulation_id", "etapa", "status_novosaque", "terms_link", "contract_link", "offers_json", "phone", "whatsapp_notified_at", "whatsapp_notify_attempt_at", "error_message", "provider", "cpf", "margem_disponivel", "offline_updated_at", "possui_alertas", "facta_worker_json", "facta_offer_json", "codigo_cliente", "codigo_proposta", "authorization_requested_at", "authorization_checked_at", "tracking_token"];
  const entradas = Object.entries(campos).filter(([k]) => permitidos.includes(k));
  if (!entradas.length) return siteChatCltObter(conversationId);
  const sets = entradas.map(([k]) => `${k} = ?`).join(", ");
  await client.execute({
    sql: `UPDATE site_chat_clt SET ${sets}, updated_at = ? WHERE conversation_id = ?`,
    args: [...entradas.map(([, v]) => v), Date.now(), conversationId],
  });
  return siteChatCltObter(conversationId);
}

// Limpeza das conversas do WhatsApp (painel). Só lê no plano: quem tem CPF válido em alguma mensagem
// recebida vira "comCpf" (para salvar no Google Contatos antes de apagar). Não apaga nada aqui.
// Mantém fora da limpeza: o número excluído (CiaHot) e as conversas com atividade desde `desde` (ms).
async function planoLimpezaConversas({ excetoBusinessNumberId, desde }) {
  await ready;
  const convs = (await client.execute({
    sql: `SELECT phone, business_number_id, name, last_message_at FROM conversations WHERE business_number_id != ?`,
    args: [excetoBusinessNumberId],
  })).rows;
  const msgs = (await client.execute(
    `SELECT phone, business_number_id, body FROM messages WHERE direction = 'in' AND body IS NOT NULL`
  )).rows;
  const cpfPorConversa = new Map();
  for (const m of msgs) {
    const chave = `${m.business_number_id}|${m.phone}`;
    if (cpfPorConversa.has(chave)) continue;
    const candidatos = String(m.body).match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/g) || [];
    const cpf = candidatos.map((c) => c.replace(/\D/g, "")).find((c) => cpfValido(c));
    if (cpf) cpfPorConversa.set(chave, cpf);
  }
  const plano = { apagar: [], comCpf: [], preservadas: 0 };
  for (const c of convs) {
    const chave = `${c.business_number_id}|${c.phone}`;
    if (Number(c.last_message_at || 0) >= desde) { plano.preservadas++; continue; }
    const item = { phone: String(c.phone), businessNumberId: String(c.business_number_id), name: c.name ? String(c.name) : null };
    plano.apagar.push(item);
    if (cpfPorConversa.has(chave)) plano.comCpf.push({ ...item, cpf: cpfPorConversa.get(chave) });
  }
  return plano;
}

async function apagarConversasLimpeza(itens) {
  await ready;
  for (const it of itens) {
    await client.execute({ sql: `DELETE FROM messages WHERE phone = ? AND business_number_id = ?`, args: [it.phone, it.businessNumberId] });
    await client.execute({ sql: `DELETE FROM conversations WHERE phone = ? AND business_number_id = ?`, args: [it.phone, it.businessNumberId] });
  }
  return itens.length;
}

// Diagnóstico somente leitura da fila de broadcast de um número: contagem por status, erros agrupados
// e os próximos itens pendentes. Não altera nada.
async function broadcastDiagnostico(businessId) {
  await ready;
  const porStatus = (await client.execute({
    sql: `SELECT status, COUNT(*) AS n FROM broadcast_agendado WHERE business_id = ? GROUP BY status`,
    args: [businessId],
  })).rows.map((r) => ({ status: r.status, n: Number(r.n) }));
  const erros = (await client.execute({
    sql: `SELECT erro, COUNT(*) AS n FROM broadcast_agendado WHERE business_id = ? AND status = 'error' GROUP BY erro ORDER BY n DESC LIMIT 10`,
    args: [businessId],
  })).rows.map((r) => ({ erro: r.erro, n: Number(r.n) }));
  const proximos = (await client.execute({
    sql: `SELECT id, phone, template, agendado_para, status, claimed_at FROM broadcast_agendado
          WHERE business_id = ? AND status IN ('pending', 'processing') ORDER BY agendado_para ASC LIMIT 5`,
    args: [businessId],
  })).rows.map((r) => ({ ...r, agendado_para: Number(r.agendado_para), claimed_at: r.claimed_at == null ? null : Number(r.claimed_at) }));
  return { agora: Date.now(), porStatus, erros, proximos };
}

// Devolve à fila os envios com erro que contêm `trecho` (ex.: "132000"), um a cada `espacoMs`, a partir de `agora`.
async function broadcastReenfileirarErro(businessId, trecho, agora, espacoMs) {
  await ready;
  const itens = (await client.execute({
    sql: `SELECT id FROM broadcast_agendado WHERE business_id = ? AND status = 'error' AND erro LIKE ? ORDER BY id ASC`,
    args: [businessId, `%${trecho}%`],
  })).rows;
  for (let i = 0; i < itens.length; i++) {
    await client.execute({
      sql: `UPDATE broadcast_agendado SET status = 'pending', erro = NULL, claimed_at = NULL, agendado_para = ? WHERE id = ?`,
      args: [agora + (i + 1) * espacoMs, itens[i].id],
    });
  }
  return itens.length;
}

module.exports = {
  hashSenha,
  verificarSenha,
  usuarioCriar,
  usuarioListar,
  usuarioObterPorUsuario,
  usuarioObterPorId,
  usuarioAtualizar,
  usuarioRedefinirSenha,
  usuarioDesativar,
  respostaProntaAtualizar,
  respostaProntaRegistrarUso,
  tagEncontrarOuCriar,
  tagDaConversaDesde,
  campoPersonalizadoEncontrarOuCriar,
  renomearConversa,
  conversasParaSincronizarGoogle,
  definirFotoContato,
  propagarIdentidadeContato,
  salvarGoogleContactResourceName,
  googleContactResourceNamePorTelefone,
  marcarBrevoContatoSync,
  conversasDoTelefoneEmOutrosCanais,
  importarContato,
  listMidiasDaConversa,
  conversasEtapaParada,
  marcarAlertaEtapaEnviado,
  pipelineAlertasConfigListar,
  pipelineAlertaConfigDefinir,
  conversasParaPrecomputarCopiloto,
  copilotoCacheSalvar,
  iaFeedbackRegistrar,
  iaFeedbackListarComentarios,
  iaFeedbackResumoPorTipo,
  sugestaoRetornoCriar,
  sugestaoRetornoPendenteExiste,
  sugestoesRetornoPendentes,
  sugestaoRetornoMarcarStatus,
  conversasInativas,
  retornosReativacaoElegiveisPara2Toque,
  retornoMarcarReforcoCriado,
  conversasParaCampanha,
  aniversariantesHoje,
  aniversarioJaEnviado,
  aniversarioMarcarEnviado,
  roteadorRevisadoListar,
  roteadorRevisadoDefinir,
  siteChatCriar,
  siteChatRegistrarOptOut,
  siteChatObter,
  siteChatRecuperarClt,
  siteChatRenovarToken,
  siteChatMensagens,
  siteChatMensagemVisitante,
  siteChatMensagemAtendente,
  siteChatListar,
  siteChatMarcarLida,
  siteChatDefinirStatus,
  siteChatDefinirPipeline,
  siteChatDefinirProduto,
  siteChatFunilEvento,
  siteChatSolicitarHumano,
  siteChatDefinirIntencaoHumano,
  siteChatConfirmarHumano,
  siteChatLimparHumano,
  siteChatFunilResumo,
  siteChatCltObter,
  siteChatCltObterPorTrackingToken,
  siteChatFactaListarEmAcompanhamento,
  siteChatCltCriar,
  siteChatFactaCriar,
  siteChatCltAtualizar,
  fluxoDinamicoCriar,
  fluxoDinamicoAtivo,
  fluxoDinamicoListar,
  fluxoDinamicoDefinirNoInicial,
  fluxoDinamicoAtivar,
  fluxoDinamicoDesativar,
  fluxoDinamicoObter,
  fluxoDinamicoApagar,
  atualizarEmailConversa,
  emailTemplateCriar,
  emailTemplatesListar,
  emailTemplateObter,
  emailTemplateApagar,
  emailAgendarLote,
  emailProximoDevido,
  emailMarcarEnviado,
  emailMarcarErro,
  emailListarPendentes,
  emailCancelar,
  retornoCriar,
  retornoProximoDevido,
  retornoMarcarEnviado,
  retornoMarcarErro,
  retornoListarPendentes,
  retornoListarPorConversa,
  retornoCancelar,
  fluxoNoCriar,
  fluxoNosDoFluxo,
  fluxoNoObter,
  fluxoOpcaoAdicionar,
  fluxoOpcoesDoNo,
  fluxoOpcoesDoFluxo,
  fluxoGatilhoCriar,
  fluxoGatilhosDoNegocio,
  fluxoGatilhoApagar,
  fluxoEstadoContatoObter,
  fluxoEstadoContatoDefinir,
  upsertConversation,
  getConversation,
  getUltimaMensagemRecebida,
  getUltimoCorpoEnviado,
  jaRecebeuTemplateRecente,
  recebeuTemplate,
  templatesLidosSemResposta,
  conversasConsignadoSemTag,
  getMensagemPorWaId,
  apagarConversa,
  planoLimpezaConversas,
  broadcastDiagnostico,
  siteChatDefinirNome,
  siteChatParaRetomada,
  siteChatEmailMarcar,
  pausarBot,
  botEstaPausado,
  siteChatFinalizarAntigas,
  broadcastReenfileirarErro,
  apagarConversasLimpeza,
  listarParaLembreteInstagram,
  tentarMarcarInstagramLembreteEnviado,
  fgtsOriginationCriar,
  fgtsOriginationBuscarAberta,
  fgtsOriginationBuscarPorId,
  fgtsOriginationBuscarPorFlowToken,
  fgtsOriginationAtualizar,
  fgtsOriginationReivindicar,
  fgtsOriginationListarAbertas,
  cltOriginationCriarRascunho,
  cltOriginationBuscarAberta,
  cltOriginationBuscarPorId,
  cltOriginationBuscarPorFlowToken,
  cltOriginationAtualizar,
  cltOriginationReivindicar,
  cltOriginationListarAbertas,
  novosaqueOriginationCriarRascunho,
  novosaqueOriginationEhOMaisAntigoAberto,
  novosaqueOriginationBuscarAberta,
  novosaqueOriginationBuscarPorId,
  novosaqueOriginationAtualizar,
  novosaqueOriginationListarAbertas,
  novosaqueOriginationBuscarPorFlowToken,
  novosaqueOriginationReivindicar,
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
  ultimasMensagens,
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
  googleConfigGet,
  googleConfigSet,
  emailBackupObter,
  emailBackupDefinir,
  agendaCalendarioConfigObter,
  agendaCalendarioConfigDefinir,
  atividadesDaConversa,
  campoPersonalizadoCriar,
  camposPersonalizadosListar,
  campoPersonalizadoApagar,
  conversationCampoDefinir,
  conversationCamposObter,
  notaAdicionar,
  notasDaConversa,
  notaApagar,
  marcarContatoSalvo,
  atualizarStatusConversa,
  atualizarPipelineConversa,
  listarTags,
  criarTag,
  apagarTag,
  adicionarTagConversa,
  adicionarTagConversaSeAusente,
  removerTagConversa,
  tagsDaConversa,
  analyticsResumo,
  whatsappFalhasRecentes,
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
