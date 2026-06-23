const https = require("https");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

function graphRequest(method, hostname, requestPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : null;
    const req = https.request(
      {
        method,
        hostname,
        path: requestPath,
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          ...(payload && !Buffer.isBuffer(body) ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, buffer: buf });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function sendText(fromPhoneNumberId, to, text) {
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar mensagem: ${JSON.stringify(json)}`);
  return json; // { messages: [{ id: "wamid..." }], ... }
}

async function getMediaInfo(mediaId) {
  const { status, buffer } = await graphRequest(
    "GET",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${mediaId}`
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao obter mídia: ${JSON.stringify(json)}`);
  return json; // { url, mime_type, sha256, file_size, id }
}

function downloadFromUrl(mediaUrl) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(mediaUrl);
    https
      .get(
        {
          hostname,
          path: pathname + search,
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        }
      )
      .on("error", reject);
  });
}

async function downloadMedia(mediaId) {
  const info = await getMediaInfo(mediaId);
  const buffer = await downloadFromUrl(info.url);
  return { buffer, mimeType: info.mime_type };
}

module.exports = { sendText, downloadMedia };
