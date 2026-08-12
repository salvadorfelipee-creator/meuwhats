const https = require("https");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

function graphRequest(method, requestPath, body, tokenOverride) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "graph.instagram.com",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${tokenOverride || ACCESS_TOKEN}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, json: JSON.parse(buf.toString("utf8") || "{}") });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getPerfil() {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}?fields=username,account_type,profile_picture_url`
  );
  if (status >= 400) throw new Error(`Falha ao obter perfil do Instagram: ${JSON.stringify(json)}`);
  return json;
}

async function getInsightsUltimoPost() {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}/media?limit=1&fields=id,caption,permalink,timestamp`
  );
  if (status >= 400) throw new Error(`Falha ao listar publicações: ${JSON.stringify(json)}`);
  const post = json.data?.[0];
  if (!post) return null;

  const { status: s2, json: insights } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${post.id}/insights?metric=reach,total_interactions`
  );
  if (s2 >= 400) throw new Error(`Falha ao obter insights: ${JSON.stringify(insights)}`);

  const metricas = {};
  for (const m of insights.data || []) {
    metricas[m.name] = m.values?.[0]?.value;
  }
  return { ...post, ...metricas };
}

async function listarPublicacoes(limit = 25) {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}/media?limit=${limit}&fields=id,caption,permalink,timestamp,media_type,media_url`
  );
  if (status >= 400) throw new Error(`Falha ao listar publicações: ${JSON.stringify(json)}`);
  return json.data || [];
}

async function sendDM(recipientId, text) {
  const { status, json } = await graphRequest("POST", `/${GRAPH_VERSION}/${ACCOUNT_ID}/messages`, {
    recipient: { id: recipientId },
    message: { text },
  });
  if (status >= 400) throw new Error(`Falha ao enviar DM do Instagram: ${JSON.stringify(json)}`);
  return json;
}

async function getComentariosUltimoPost() {
  const { status, json } = await graphRequest("GET", `/${GRAPH_VERSION}/${ACCOUNT_ID}/media?limit=1&fields=id`);
  if (status >= 400) throw new Error(`Falha ao listar publicações: ${JSON.stringify(json)}`);
  const post = json.data?.[0];
  if (!post) return [];
  const { status: s2, json: comentarios } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${post.id}/comments?fields=text,username,timestamp`
  );
  if (s2 >= 400) throw new Error(`Falha ao ler comentários: ${JSON.stringify(comentarios)}`);
  return comentarios.data || [];
}

// Perfil de quem mandou uma DM (nome/username) — usado só pra mostrar um nome legível
// na caixa de entrada em vez do ID numérico. Best-effort: se a Meta não liberar (perfil
// fora da janela de mensageria, ou permissão insuficiente), quem chama trata o erro.
async function getPerfilUsuario(userId) {
  const { status, json } = await graphRequest("GET", `/${GRAPH_VERSION}/${userId}?fields=name,username`);
  if (status >= 400) throw new Error(`Falha ao obter perfil do remetente: ${JSON.stringify(json)}`);
  return json;
}

async function getConversas() {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}/conversations?fields=participants,updated_time`
  );
  if (status >= 400) throw new Error(`Falha ao ler conversas: ${JSON.stringify(json)}`);
  return json.data || [];
}

// Mensagens de UMA conversa (thread) — usado só pra importar o histórico que já existia
// antes da gravação automática via webhook começar (ver instagramImportarHistorico em
// server.js). getConversas() acima só traz participantes/data, não o texto das mensagens.
async function getMensagensConversa(conversationId, limit = 100) {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${conversationId}?fields=messages.limit(${limit}){id,from,to,message,created_time}`
  );
  if (status >= 400) throw new Error(`Falha ao ler mensagens da conversa: ${JSON.stringify(json)}`);
  return json.messages?.data || [];
}

// Testa, com o token já configurado no servidor, se cada permissão do Instagram
// está liberada de verdade (Acesso Avançado) — sem precisar de telas da Meta nem
// de repassar token nenhum. Usado pela rota /painel/api/instagram/diagnostico.
async function diagnostico() {
  const resultado = {};
  try {
    const perfil = await getPerfil();
    resultado.basic = { ok: true, detalhe: `@${perfil.username}` };
  } catch (err) {
    resultado.basic = { ok: false, detalhe: err.message };
  }
  try {
    const comentarios = await getComentariosUltimoPost();
    resultado.manage_comments = { ok: true, detalhe: `${comentarios.length} comentário(s) lido(s) no último post` };
  } catch (err) {
    resultado.manage_comments = { ok: false, detalhe: err.message };
  }
  try {
    const conversas = await getConversas();
    resultado.manage_messages = { ok: true, detalhe: `${conversas.length} conversa(s) lida(s)` };
  } catch (err) {
    resultado.manage_messages = { ok: false, detalhe: err.message };
  }
  return resultado;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Instagram baixa/processa a imagem em segundo plano depois de criar o container —
// publicar direto na sequência falha com "media is not ready for publishing" se a Meta
// ainda não terminou. Espera até o status virar FINISHED (ou desiste em ~30s).
async function aguardarContainerPronto(token, containerId, tentativas = 15, intervaloMs = 2000) {
  for (let i = 0; i < tentativas; i++) {
    const { status, json } = await graphRequest(
      "GET",
      `/${GRAPH_VERSION}/${containerId}?fields=status_code`,
      null,
      token
    );
    if (status >= 400) throw new Error(`Falha ao checar status da publicação: ${JSON.stringify(json)}`);
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR" || json.status_code === "EXPIRED") {
      throw new Error(`Instagram não conseguiu processar a imagem (status: ${json.status_code}).`);
    }
    await sleep(intervaloMs);
  }
  throw new Error("Instagram demorou demais pra processar a imagem — tente publicar de novo em alguns instantes.");
}

// Publica uma imagem no feed (usado pelo Publique IV — ver PUBLIQUE-IV.md).
// accessToken/accountId são opcionais: se não vierem, cai no token/conta padrão (Felizcred,
// via env). Passar os dois explicitamente é o jeito de publicar em outra conta de Instagram.
async function publicarImagem({ imagemUrl, legenda, accessToken, accountId }) {
  const token = accessToken || ACCESS_TOKEN;
  const conta = accountId || ACCOUNT_ID;
  const { status, json: container } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${conta}/media`,
    { image_url: imagemUrl, caption: legenda || "" },
    token
  );
  if (status >= 400) throw new Error(`Falha ao criar publicação no Instagram: ${JSON.stringify(container)}`);

  await aguardarContainerPronto(token, container.id);

  const { status: s2, json: publicado } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${conta}/media_publish`,
    { creation_id: container.id },
    token
  );
  if (s2 >= 400) throw new Error(`Falha ao publicar no Instagram: ${JSON.stringify(publicado)}`);

  let link = null;
  try {
    const { status: s3, json: dados } = await graphRequest(
      "GET",
      `/${GRAPH_VERSION}/${publicado.id}?fields=permalink`,
      null,
      token
    );
    if (s3 < 400) link = dados.permalink;
  } catch {
    // publicação já existe mesmo se essa busca falhar — só não teremos o link pro painel
  }
  return { id: publicado.id, link };
}

// Publica um Reels (vídeo) no feed — usado pela fila de agendamento em massa (ver
// PUBLIQUE-IV.md, seção Reels). Igual à publicação de imagem, mas com media_type REELS
// e um tempo de espera bem maior no polling: processar vídeo demora bem mais que imagem.
async function publicarReels({ videoUrl, legenda, accessToken, accountId }) {
  const token = accessToken || ACCESS_TOKEN;
  const conta = accountId || ACCOUNT_ID;
  const { status, json: container } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${conta}/media`,
    { media_type: "REELS", video_url: videoUrl, caption: legenda || "", share_to_feed: true },
    token
  );
  if (status >= 400) throw new Error(`Falha ao criar publicação de Reels no Instagram: ${JSON.stringify(container)}`);

  await aguardarContainerPronto(token, container.id, 40, 5000); // até ~3min de processamento

  const { status: s2, json: publicado } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${conta}/media_publish`,
    { creation_id: container.id },
    token
  );
  if (s2 >= 400) throw new Error(`Falha ao publicar Reels no Instagram: ${JSON.stringify(publicado)}`);

  let link = null;
  try {
    const { status: s3, json: dados } = await graphRequest(
      "GET",
      `/${GRAPH_VERSION}/${publicado.id}?fields=permalink`,
      null,
      token
    );
    if (s3 < 400) link = dados.permalink;
  } catch {
    // publicação já existe mesmo se essa busca falhar — só não teremos o link pro painel
  }
  return { id: publicado.id, link };
}

module.exports = {
  ACCOUNT_ID,
  sendDM,
  getPerfil,
  getPerfilUsuario,
  getInsightsUltimoPost,
  listarPublicacoes,
  getComentariosUltimoPost,
  getConversas,
  getMensagensConversa,
  diagnostico,
  publicarImagem,
  publicarReels,
};
