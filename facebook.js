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
    return { id: json.post_id || json.id };
  }

  const { status, json } = await graphRequest(token, "POST", `/${GRAPH_VERSION}/${paginaId}/feed`, {
    message: texto || "",
    ...(link ? { link } : {}),
  });
  if (status >= 400) throw new Error(`Falha ao publicar no Facebook: ${JSON.stringify(json)}`);
  return { id: json.id };
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

module.exports = { publicar, atualizarCapa, atualizarFotoPerfil, atualizarSobre };
