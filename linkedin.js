const https = require("https");

// Formato exigido pela LinkedIn-Version: AAAAMM. Atualizar de vez em quando (LinkedIn
// costuma aceitar versões de alguns meses atrás sem quebrar).
const LINKEDIN_VERSION = "202506";

function request(token, method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "api.linkedin.com",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": LINKEDIN_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json = {};
          try {
            json = buf.length ? JSON.parse(buf.toString("utf8")) : {};
          } catch {
            json = { raw: buf.toString("utf8") };
          }
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Publica no LinkedIn (usado pelo Publique IV — ver PUBLIQUE-IV.md).
// creds = { token, autorUrn } — autorUrn é "urn:li:person:XXX" (perfil pessoal) ou
// "urn:li:organization:XXX" (Página da empresa).
// Limitação conhecida: não sobe imagem própria (exigiria o fluxo de registro de upload da
// LinkedIn, mais complexo) — com link, o próprio LinkedIn gera a prévia/thumbnail do site.
async function publicar({ texto, link }, { token, autorUrn }) {
  const body = {
    author: autorUrn,
    commentary: texto || "",
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (link) body.content = { article: { source: link } };

  const { status, json, headers } = await request(token, "POST", "/rest/posts", body);
  if (status >= 400) throw new Error(`Falha ao publicar no LinkedIn: ${JSON.stringify(json)}`);
  return { id: headers["x-restli-id"] };
}

module.exports = { publicar };
