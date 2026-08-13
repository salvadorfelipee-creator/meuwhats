const https = require("https");

// Formato exigido pela LinkedIn-Version: AAAAMM. Testado ao vivo em 10/08/2026: o /rest/posts
// só aceitava o mês atual (426 NONEXISTENT_VERSION pra qualquer mês anterior). Mas testado de
// novo em 13/08/2026, o /rest/images (Images API, usada pra subir foto) recusou o mês atual
// com o MESMO erro e só aceitou de 1 a 3 meses atrás — cada recurso da API parece ativar a
// versão do mês corrente num momento diferente. Por isso `request()` abaixo não fixa um mês só:
// tenta o atual e recua mês a mês até achar uma versão ativa, em vez de quebrar de novo assim
// que o calendário virar (ou de precisar editar isso toda vez que um recurso novo entrar).
function versaoDoMes(offsetMeses) {
  const agora = new Date();
  agora.setMonth(agora.getMonth() - offsetMeses);
  return `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function requestComVersao(token, method, requestPath, body, versao) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "api.linkedin.com",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": versao,
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

async function request(token, method, requestPath, body) {
  for (let offset = 0; offset <= 3; offset++) {
    const resultado = await requestComVersao(token, method, requestPath, body, versaoDoMes(offset));
    if (!(resultado.status === 426 && resultado.json.code === "NONEXISTENT_VERSION")) return resultado;
  }
  return requestComVersao(token, method, requestPath, body, versaoDoMes(3));
}

function baixarBytes(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 400) return reject(new Error(`Falha ao baixar imagem pra subir no LinkedIn (status ${res.statusCode}).`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// A uploadUrl da Images API é assinada/temporária — recebe os bytes crus via PUT, não é uma
// chamada normal da Graph/Rest API (por isso não passa pelo request() genérico acima).
function putBytes(uploadUrl, buffer, token) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(uploadUrl);
    const req = https.request(
      {
        method: "PUT",
        hostname,
        path: pathname + search,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "Content-Length": buffer.length },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode >= 400) reject(new Error(`Falha ao enviar bytes da imagem pro LinkedIn: ${Buffer.concat(chunks)}`));
          else resolve();
        });
      }
    );
    req.on("error", reject);
    req.end(buffer);
  });
}

// Sobe uma imagem (a partir de uma URL pública, ex. R2) e devolve o URN dela (urn:li:image:...)
// pra referenciar no post — fluxo em 2 passos da Images API: registra o upload (ganha uma
// uploadUrl temporária + o URN final) e manda os bytes crus pra essa uploadUrl.
async function subirImagem(imagemUrl, { token, autorUrn }) {
  const { status, json } = await request(token, "POST", "/rest/images?action=initializeUpload", {
    initializeUploadRequest: { owner: autorUrn },
  });
  if (status >= 400) throw new Error(`Falha ao registrar upload de imagem no LinkedIn: ${JSON.stringify(json)}`);
  const { uploadUrl, image } = json.value;

  const bytes = await baixarBytes(imagemUrl);
  await putBytes(uploadUrl, bytes, token);
  return image;
}

// Publica no LinkedIn (usado pelo Publique IV — ver PUBLIQUE-IV.md).
// creds = { token, autorUrn } — autorUrn é "urn:li:person:XXX" (perfil pessoal) ou
// "urn:li:organization:XXX" (Página da empresa).
// Aceita imagemUrl (1 imagem, vira content.media) ou imagemUrls (2 a 20 imagens, vira
// content.multiImage — o equivalente do LinkedIn a um carrossel). Sem imagem mas com link,
// o próprio LinkedIn gera a prévia/thumbnail do site.
async function publicar({ texto, imagemUrl, imagemUrls, link }, { token, autorUrn }) {
  const body = {
    author: autorUrn,
    commentary: texto || "",
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imagemUrls && imagemUrls.length) {
    if (imagemUrls.length < 2) throw new Error("multiImage do LinkedIn exige ao menos 2 imagens.");
    if (imagemUrls.length > 20) throw new Error("LinkedIn aceita no máximo 20 imagens por post.");
    const urns = [];
    for (const url of imagemUrls) urns.push(await subirImagem(url, { token, autorUrn }));
    body.content = { multiImage: { images: urns.map((id) => ({ id })) } };
  } else if (imagemUrl) {
    const urn = await subirImagem(imagemUrl, { token, autorUrn });
    body.content = { media: { id: urn } };
  } else if (link) {
    body.content = { article: { source: link } };
  }

  const { status, json, headers } = await request(token, "POST", "/rest/posts", body);
  if (status >= 400) throw new Error(`Falha ao publicar no LinkedIn: ${JSON.stringify(json)}`);
  const id = headers["x-restli-id"];
  return { id, link: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
}

module.exports = { publicar };
