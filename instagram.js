const https = require("https");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

function graphRequest(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        hostname: "graph.instagram.com",
        path: requestPath,
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({ status: res.statusCode, json: JSON.parse(buf.toString("utf8") || "{}") });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getPerfil() {
  const { status, json } = await graphRequest(
    "GET",
    `/${GRAPH_VERSION}/${ACCOUNT_ID}?fields=username,account_type,profile_picture_url`
  );
  if (status >= 400) throw new Error(`Falha ao obter perfil do Instagram: ${JSON.stringify(json)}`);
  return json;
}

async function sendDM(recipientId, text) {
  const { status, json } = await graphRequest("POST", `/${GRAPH_VERSION}/${ACCOUNT_ID}/messages`, {
    recipient: { id: recipientId },
    message: { text },
  });
  if (status >= 400) throw new Error(`Falha ao enviar DM do Instagram: ${JSON.stringify(json)}`);
  return json;
}

module.exports = { sendDM, getPerfil };
