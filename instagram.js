const https = require("https");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

function graphRequest(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "graph.instagram.com",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
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
    `/${GRAPH_VERSION}/${ACCOUNT_ID}/media?limit=${limit}&fields=id,caption,permalink,timestamp,media_type`
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

async function getConversas() {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}/conversations?fields=participants,updated_time`
  );
  if (status >= 400) throw new Error(`Falha ao ler conversas: ${JSON.stringify(json)}`);
  return json.data || [];
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

module.exports = {
  sendDM,
  getPerfil,
  getInsightsUltimoPost,
  listarPublicacoes,
  getComentariosUltimoPost,
  getConversas,
  diagnostico,
};
