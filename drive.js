const https = require("https");
const crypto = require("crypto");

// Autenticação de Service Account do Google, feita na mão (mesmo padrão do twitter.js
// pro OAuth 1.0a) — sem SDK do Google, só https + crypto. Credenciais vêm do JSON baixado
// no Console do Google Cloud, colado inteiro em GOOGLE_SERVICE_ACCOUNT_JSON.
function credenciais() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
  return JSON.parse(raw);
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let tokenCache = { valor: null, expiraEm: 0 };

// Troca a chave privada da Service Account por um access token OAuth2 (JWT Bearer flow).
// Cacheia em memória até ~1min antes de expirar pra não assinar um JWT novo a cada chamada.
async function obterAccessToken() {
  if (tokenCache.valor && Date.now() < tokenCache.expiraEm) return tokenCache.valor;

  const { client_email, private_key } = credenciais();
  const agora = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: agora,
      exp: agora + 3600,
    })
  );
  const semAssinar = `${header}.${claims}`;
  const assinatura = crypto.createSign("RSA-SHA256").update(semAssinar).sign(private_key, "base64");
  const jwt = `${semAssinar}.${assinatura.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const body = `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`;
  const json = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "oauth2.googleapis.com",
        path: "/token",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  if (json.status >= 400) throw new Error(`Falha ao autenticar no Google Drive: ${JSON.stringify(json.json)}`);
  tokenCache = { valor: json.json.access_token, expiraEm: Date.now() + (json.json.expires_in - 60) * 1000 };
  return tokenCache.valor;
}

function driveRequest(path, { binary = false } = {}) {
  return obterAccessToken().then(
    (token) =>
      new Promise((resolve, reject) => {
        https
          .get(
            { hostname: "www.googleapis.com", path, headers: { Authorization: `Bearer ${token}` } },
            (res) => {
              const chunks = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => {
                const buf = Buffer.concat(chunks);
                if (res.statusCode >= 400) {
                  reject(new Error(`Falha na API do Drive (${res.statusCode}): ${buf.toString("utf8")}`));
                  return;
                }
                resolve(binary ? buf : JSON.parse(buf.toString("utf8") || "{}"));
              });
            }
          )
          .on("error", reject);
      })
  );
}

// Lista todos os arquivos de vídeo de uma pasta do Drive (paginado — o Drive devolve no
// máximo 1000 por página). Ordena por nome pra dar uma ordem estável e previsível de fila.
async function listarVideos(folderId) {
  const arquivos = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'video/'`);
    const params = `q=${q}&fields=nextPageToken,files(id,name,mimeType,createdTime)&pageSize=1000&orderBy=name` + (pageToken ? `&pageToken=${pageToken}` : "");
    const json = await driveRequest(`/drive/v3/files?${params}`);
    arquivos.push(...(json.files || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return arquivos;
}

async function baixarVideo(fileId) {
  return driveRequest(`/drive/v3/files/${fileId}?alt=media`, { binary: true });
}

module.exports = { listarVideos, baixarVideo };
