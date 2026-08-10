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

module.exports = { publicar };
