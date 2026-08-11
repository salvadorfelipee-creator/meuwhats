const https = require("https");

const GRAPH_VERSION = "v21.0";

function graphRequest(token, method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "graph.facebook.com",
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

// Busca o link permanente de um post já publicado — não falha a publicação se der erro
// (o post já existe, só não teríamos o link pra mostrar no painel).
async function buscarLink(token, postId) {
  try {
    const { status, json } = await graphRequest(token, "GET", `/${GRAPH_VERSION}/${postId}?fields=permalink_url`);
    return status < 400 ? json.permalink_url : null;
  } catch {
    return null;
  }
}

// Publica na Página do Facebook (usado pelo Publique IV — ver PUBLIQUE-IV.md).
// Com imagem vai por /photos (legenda = texto); sem imagem vai por /feed (message + link,
// a própria Página gera a prévia do link).
async function publicar({ texto, imagemUrl, link }, { token, paginaId }) {
  if (imagemUrl) {
    const { status, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/photos`, {
      url: imagemUrl,
      caption: texto || "",
    });
    if (status >= 400) throw new Error(`Falha ao publicar foto no Facebook: ${JSON.stringify(json)}`);
    const postId = json.post_id || json.id;
    return { id: postId, link: await buscarLink(token, postId) };
  }

  const { status, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/feed`, {
    message: texto || "",
    ...(link ? { link } : {}),
  });
  if (status >= 400) throw new Error(`Falha ao publicar no Facebook: ${JSON.stringify(json)}`);
  return { id: json.id, link: await buscarLink(token, json.id) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Publica um Reels na Página do Facebook (usado pela fila de agendamento — ver
// PUBLIQUE-IV.md). Fluxo oficial "hosted file" da API de Reels do Facebook: diferente do
// Instagram, aqui é em 3 chamadas (start → aponta a URL do vídeo → finish), com polling do
// status do vídeo no meio. videoUrl precisa ser pública (mesma pasta /publicar-media/ já
// usada pro resto do Publique IV).
async function publicarReels({ videoUrl, legenda }, { token, paginaId }) {
  const { status: s1, json: inicio } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/video_reels`, {
    upload_phase: "start",
  });
  if (s1 >= 400) throw new Error(`Falha ao iniciar Reels no Facebook: ${JSON.stringify(inicio)}`);
  const { video_id: videoId, upload_url: uploadUrl } = inicio;

  // Aponta a URL pública do vídeo pro Facebook buscar (não precisamos subir os bytes) —
  // é uma chamada direta na upload_url devolvida acima, com header próprio, não pela
  // graphRequest genérica (hostname/formato diferentes).
  await new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(uploadUrl);
    const req = https.request(
      { method: "POST", hostname, path: pathname + search, headers: { Authorization: `OAuth ${token}`, file_url: videoUrl } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode >= 400) reject(new Error(`Falha ao enviar vídeo do Reels ao Facebook: ${Buffer.concat(chunks)}`));
          else resolve();
        });
      }
    );
    req.on("error", reject);
    req.end();
  });

  // Espera o Facebook terminar de baixar/processar o vídeo antes de publicar — mesmo
  // motivo do polling que já existe no Instagram (instagram.js: aguardarContainerPronto).
  let pronto = false;
  for (let i = 0; i < 40 && !pronto; i++) {
    await sleep(5000);
    const { json: statusJson } = await graphRequest(token, "GET", `/${GRAPH_VERSION}/${videoId}?fields=status`);
    const estado = statusJson.status?.video_status;
    if (estado === "ready") pronto = true;
    else if (estado === "error") throw new Error(`Facebook não conseguiu processar o Reels: ${JSON.stringify(statusJson)}`);
  }
  if (!pronto) throw new Error("Facebook demorou demais pra processar o Reels — tente publicar de novo em alguns instantes.");

  const { status: s2, json: publicado } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/video_reels`, {
    video_id: videoId,
    upload_phase: "finish",
    video_state: "PUBLISHED",
    description: legenda || "",
  });
  if (s2 >= 400) throw new Error(`Falha ao publicar Reels no Facebook: ${JSON.stringify(publicado)}`);

  return { id: videoId, link: `https://www.facebook.com/reel/${videoId}` };
}

// Troca a foto de capa da Página (usado pelo Publique IV). Sobe a imagem primeiro
// (published:true — fica também como uma foto normal do álbum da Página, é assim que o
// Graph API funciona) e depois define ela como capa.
async function atualizarCapa(imagemUrl, { token, paginaId }) {
  const { status: s1, json: foto } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/photos`, {
    url: imagemUrl,
    published: true,
  });
  if (s1 >= 400) throw new Error(`Falha ao subir a foto de capa no Facebook: ${JSON.stringify(foto)}`);

  const { status: s2, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}`, {
    cover: foto.id,
  });
  if (s2 >= 400) throw new Error(`Falha ao definir a capa no Facebook: ${JSON.stringify(json)}`);
  return { id: foto.id };
}

// Troca a foto de perfil da Página.
async function atualizarFotoPerfil(imagemUrl, { token, paginaId }) {
  const { status, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/picture`, {
    picture: imagemUrl,
  });
  if (status >= 400) throw new Error(`Falha ao trocar a foto de perfil no Facebook: ${JSON.stringify(json)}`);
  return json;
}

// Atualiza o texto "Sobre"/bio da Página.
async function atualizarSobre(texto, { token, paginaId }) {
  const { status, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}`, {
    about: texto,
  });
  if (status >= 400) throw new Error(`Falha ao atualizar o "Sobre" da Página no Facebook: ${JSON.stringify(json)}`);
  return json;
}

module.exports = { publicar, publicarReels, atualizarCapa, atualizarFotoPerfil, atualizarSobre };
