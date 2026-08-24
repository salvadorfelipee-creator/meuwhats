const https = require("https");
const db = require("./db");

// Mesmo padrão de r2.js/email.js: https puro, sem instalar o SDK oficial do Google (o projeto
// inteiro evita SDK pesado — ver README "Stack"). Usado só pra criar contato no Google
// Contacts (People API) quando um funil do WhatsApp termina de coletar e-mail do cliente (ver
// capturarContatoEBoasVindas em server.js).

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SCOPE = "https://www.googleapis.com/auth/contacts";

function redirectUri(host) {
  return `https://${host}/painel/api/google/callback`;
}

// Monta a URL de consentimento — o usuário abre isso 1x logado no painel (ver
// GET /painel/api/google/autorizar em server.js). access_type=offline + prompt=consent
// garantem que a resposta traga um refresh_token mesmo se ele já tiver autorizado antes.
function urlAutorizacao(host) {
  if (!CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID não configurado.");
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(host),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function postFormJson(hostname, path, form) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString();
    const req = https.request(
      {
        method: "POST",
        hostname,
        path,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            json = {};
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
          reject(new Error(`Google respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Troca o "code" que o Google manda no callback por um refresh_token — salva no banco (ver
// db.googleConfigSet) pra nunca mais precisar repetir a autorização manual.
async function trocarCodigoPorToken(code, host) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.");
  const json = await postFormJson("oauth2.googleapis.com", "/token", {
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri(host),
    grant_type: "authorization_code",
  });
  if (!json.refresh_token) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e tente autorizar de novo.");
  }
  await db.googleConfigSet("refresh_token", json.refresh_token);
}

// Access token expira rápido (1h) — troca pelo refresh token salvo a cada chamada, igual
// qualquer integração OAuth server-to-server.
async function obterAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.");
  const refreshToken = await db.googleConfigGet("refresh_token");
  if (!refreshToken) throw new Error("Google Contacts ainda não autorizado (ver /painel/api/google/autorizar).");
  const json = await postFormJson("oauth2.googleapis.com", "/token", {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return json.access_token;
}

// Cria o contato no Google Contacts da conta autorizada. `telefone` já vem no formato
// internacional (mesmo dígitos usados como `phone` em conversations, ex. "5511999999999").
async function criarContato({ nome, telefone, email }) {
  const accessToken = await obterAccessToken();
  const body = JSON.stringify({
    names: nome ? [{ givenName: nome }] : undefined,
    phoneNumbers: telefone ? [{ value: `+${telefone}`, type: "mobile" }] : undefined,
    emailAddresses: email ? [{ value: email, type: "home" }] : undefined,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "people.googleapis.com",
        path: "/v1/people:createContact",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json;
          try {
            json = JSON.parse(buf.toString("utf8") || "{}");
          } catch {
            json = { raw: buf.toString("utf8") };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
          reject(new Error(`People API respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { urlAutorizacao, trocarCodigoPorToken, criarContato };
