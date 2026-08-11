const https = require("https");

// Formato exigido pela LinkedIn-Version: AAAAMM. Testado ao vivo em 10/08/2026: a LinkedIn
// rejeitou versões de meses anteriores (426 NONEXISTENT_VERSION) e só aceitou o mês atual —
// diferente da maioria das APIs versionadas, aqui não dá margem de alguns meses pra trás.
// Por isso calcula na hora em vez de um valor fixo (evitaria essa mesma quebra de novo).
function versaoAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

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
          "LinkedIn-Version": versaoAtual(),
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
  const id = headers["x-restli-id"];
  return { id, link: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
}

module.exports = { publicar };
