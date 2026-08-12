const https = require("https");

// API do Threads (Meta) — mesmo App usado pro Instagram/Facebook (ver CHAVES-LOCAL.md),
// mas host e token são próprios do Threads (não reaproveita o token do Instagram).
const GRAPH_VERSION = "v1.0";

function graphRequest(method, requestPath, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "graph.threads.net",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json = {};
          try {
            json = JSON.parse(buf.toString("utf8") || "{}");
          } catch {
            json = { raw: buf.toString("utf8") };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Igual ao Instagram: o Threads processa o container em segundo plano — publicar direto na
// sequência de criar às vezes falha com "media not ready". Espera FINISHED antes de tentar.
async function aguardarContainerPronto(token, containerId, tentativas = 10, intervaloMs = 1500) {
  for (let i = 0; i < tentativas; i++) {
    const { status, json } = await graphRequest("GET", `/${GRAPH_VERSION}/${containerId}?fields=status`, null, token);
    if (status >= 400) throw new Error(`Falha ao checar status da publicação: ${JSON.stringify(json)}`);
    if (json.status === "FINISHED") return;
    if (json.status === "ERROR" || json.status === "EXPIRED") {
      throw new Error(`Threads não conseguiu processar a publicação (status: ${json.status}).`);
    }
    await sleep(intervaloMs);
  }
  // Não travou em ERROR — segue e tenta publicar mesmo assim (texto puro geralmente nem chega
  // a ficar "em processamento" de verdade).
}

// Publica um post de texto (opcionalmente com imagem) — usado pelo Publique IV.
// credenciais = { accessToken, userId } — userId é o ID do usuário do Threads (obtido via
// getPerfil(), diferente do ID do Instagram mesmo sendo a mesma conta).
async function publicar({ texto, imagemUrl }, credenciais) {
  const { accessToken, userId } = credenciais;
  let textoFinal = texto || "";
  const truncado = textoFinal.length > 500;
  if (truncado) textoFinal = textoFinal.slice(0, 497) + "...";

  const corpo = imagemUrl
    ? { media_type: "IMAGE", image_url: imagemUrl, text: textoFinal }
    : { media_type: "TEXT", text: textoFinal };

  const { status, json: container } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${userId}/threads`,
    corpo,
    accessToken
  );
  if (status >= 400) throw new Error(`Falha ao criar publicação no Threads: ${JSON.stringify(container)}`);

  if (imagemUrl) await aguardarContainerPronto(accessToken, container.id);

  const { status: s2, json: publicado } = await graphRequest(
    "POST",
    `/${GRAPH_VERSION}/${userId}/threads_publish`,
    { creation_id: container.id },
    accessToken
  );
  if (s2 >= 400) throw new Error(`Falha ao publicar no Threads: ${JSON.stringify(publicado)}`);

  let link = null;
  try {
    const { status: s3, json: dados } = await graphRequest(
      "GET",
      `/${GRAPH_VERSION}/${publicado.id}?fields=permalink`,
      null,
      accessToken
    );
    if (s3 < 400) link = dados.permalink;
  } catch {
    // publicação já existe mesmo se essa busca falhar — só não teremos o link pro painel
  }
  return { id: publicado.id, link, truncado };
}

// Confirma que o token funciona e devolve o ID do usuário do Threads (precisa pra montar as
// credenciais em publique.js — ver CHAVES-LOCAL.md pra como gerar o token).
async function getPerfil(accessToken) {
  const { status, json } = await graphRequest("GET", `/${GRAPH_VERSION}/me?fields=id,username,threads_profile_picture_url`, null, accessToken);
  if (status >= 400) throw new Error(`Falha ao obter perfil do Threads: ${JSON.stringify(json)}`);
  return json;
}

module.exports = { publicar, getPerfil };
