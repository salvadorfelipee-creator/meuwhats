// unnotech.js — cliente da API pública da Unnotech (originação de crédito FGTS/CLT). Só fala
// com a API deles; nenhuma lógica de WhatsApp aqui (fica em server.js). Mesmo papel que
// wa.js/r2.js já têm nesse projeto — https nativo, sem dependência nova.
const https = require("https");

const UNNOTECH_HOST = "gtw.unnotech.com.br";
const UNNOTECH_BASE_PATH = "/public";

function unnotechRequest(method, path, { body, accessToken, idempotencyKey, externalId } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    if (externalId) headers["X-Api-External-Id"] = externalId;
    const req = https.request(
      { hostname: UNNOTECH_HOST, path: `${UNNOTECH_BASE_PATH}${path}`, method, headers },
      (res) => {
        let buf = "";
        res.on("data", (chunk) => (buf += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = buf ? JSON.parse(buf) : null;
          } catch {
            parsed = { raw: buf };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Cache em memória — renovado só quando falta menos de 1 minuto pro expires_in, nunca um token
// por requisição (pedido explícito da doc: "Reutilize o mesmo token até o expires_in").
let tokenCache = { accessToken: null, expiraEm: 0 };

async function getAccessToken() {
  const agora = Date.now();
  if (tokenCache.accessToken && agora < tokenCache.expiraEm - 60_000) {
    return tokenCache.accessToken;
  }
  const clientId = process.env.UNNOTECH_CLIENT_ID;
  const clientSecret = process.env.UNNOTECH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("UNNOTECH_CLIENT_ID/UNNOTECH_CLIENT_SECRET não configurados nas variáveis de ambiente");
  }
  const { status, body } = await unnotechRequest("POST", "/api/v1/auth/token", {
    body: { client_id: clientId, client_secret: clientSecret },
  });
  if (status >= 400) throw new Error(`Falha ao autenticar na Unnotech: ${JSON.stringify(body)}`);
  tokenCache = { accessToken: body.access_token, expiraEm: agora + body.expires_in * 1000 };
  return tokenCache.accessToken;
}

async function criarSolicitacao(cpf, idempotencyKey) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("POST", "/api/v1/fgts/applications", {
    accessToken,
    idempotencyKey,
    body: { customer: { cpf } },
  });
  if (status >= 400) throw new Error(`Falha ao abrir solicitação FGTS: ${JSON.stringify(body)}`);
  return body;
}

// Versão otimizada (sem quotes/offers no corpo) — usada pelo polling frequente do verificador.
async function consultarStatus(applicationId) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("GET", `/api/v1/fgts/applications/${applicationId}/status`, {
    accessToken,
  });
  if (status >= 400) throw new Error(`Falha ao consultar status: ${JSON.stringify(body)}`);
  return body;
}

// Recurso completo, com quotes[]/offers[] — usada só quando precisamos ler o motivo de recusa
// ou os detalhes de uma oferta específica (o /status não traz isso).
async function consultarSolicitacaoCompleta(applicationId) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("GET", `/api/v1/fgts/applications/${applicationId}`, {
    accessToken,
  });
  if (status >= 400) throw new Error(`Falha ao consultar solicitação: ${JSON.stringify(body)}`);
  return body;
}

async function requotar(applicationId, idempotencyKey) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("POST", `/api/v1/fgts/applications/${applicationId}/requote`, {
    accessToken,
    idempotencyKey,
  });
  if (status >= 400) throw new Error(`Falha ao repetir cotação: ${JSON.stringify(body)}`);
  return body;
}

module.exports = {
  unnotechRequest,
  getAccessToken,
  criarSolicitacao,
  consultarStatus,
  consultarSolicitacaoCompleta,
  requotar,
};
