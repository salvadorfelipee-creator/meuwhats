const https = require("https");
const crypto = require("crypto");

// A API do X (Twitter) só aceita postar via OAuth 1.0a, mesmo no plano gratuito
// (v2 exige OAuth 1.0a pra escrita — não tem exceção). Por isso a assinatura manual abaixo,
// em vez de um Bearer token simples como nos outros módulos.

function pctEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function oauthHeader({ method, url, apiKey, apiSecret, accessToken, accessSecret }) {
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };
  const baseParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(oauthParams[k])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${pctEncode(url)}&${pctEncode(baseParams)}`;
  const signingKey = `${pctEncode(apiSecret)}&${pctEncode(accessSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  return (
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(oauthParams[k])}"`)
      .join(", ")
  );
}

function httpsRequest({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
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
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function baixarBytes(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 400) return reject(new Error(`Falha ao baixar imagem (${res.statusCode})`));
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function subirMidia(imagemUrl, creds) {
  const bytes = await baixarBytes(imagemUrl);
  const boundary = "----publiqueIV" + crypto.randomBytes(8).toString("hex");
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const auth = oauthHeader({ method: "POST", url, ...creds });

  const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="imagem.jpg"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const closing = `\r\n--${boundary}--\r\n`;
  const body = Buffer.concat([Buffer.from(preamble, "utf8"), bytes, Buffer.from(closing, "utf8")]);

  const { status, json } = await httpsRequest({
    hostname: "upload.twitter.com",
    path: "/1.1/media/upload.json",
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
    },
    body,
  });
  if (status >= 400) throw new Error(`Falha ao subir mídia no X/Twitter: ${JSON.stringify(json)}`);
  return json.media_id_string;
}

// Publica um tweet (usado pelo Publique IV — ver PUBLIQUE-IV.md).
// creds = { apiKey, apiSecret, accessToken, accessSecret } — credenciais do app + da conta.
async function publicar({ texto, imagemUrl }, creds) {
  let textoFinal = texto || "";
  if (textoFinal.length > 280) textoFinal = textoFinal.slice(0, 277) + "...";

  const payload = { text: textoFinal };
  if (imagemUrl) {
    const mediaId = await subirMidia(imagemUrl, creds);
    payload.media = { media_ids: [mediaId] };
  }

  const url = "https://api.twitter.com/2/tweets";
  const auth = oauthHeader({ method: "POST", url, ...creds });
  const body = JSON.stringify(payload);

  const { status, json } = await httpsRequest({
    hostname: "api.twitter.com",
    path: "/2/tweets",
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });
  if (status >= 400) throw new Error(`Falha ao publicar no X/Twitter: ${JSON.stringify(json)}`);
  const id = json.data?.id;
  return { id, link: id ? `https://x.com/i/web/status/${id}` : null, truncado: textoFinal !== (texto || "") };
}

module.exports = { publicar };
