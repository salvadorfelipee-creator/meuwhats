const http = require("http");
const fs = require("fs");
const path = require("path");

const db = require("./db");
const wa = require("./whatsapp");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "meu_token_secreto";
const PAINEL_USER = process.env.PAINEL_USER || "admin";
const PAINEL_PASS = process.env.PAINEL_PASS || "admin";

const MEDIA_DIR = path.join(__dirname, "media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, headers);
    return res.end(body);
  }
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const [user, pass] = Buffer.from(encoded, "base64").toString("utf8").split(":");
  return user === PAINEL_USER && pass === PAINEL_PASS;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="painel"' });
  res.end("Authorization required");
  return false;
}

function safeFilename(waMessageId, ext) {
  const safe = waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safe}.${ext}`;
}

// ─── PROCESSAR MENSAGENS RECEBIDAS ───────────────────────────────────────────
async function processarEntry(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      const contatos = value.contacts || [];
      const mensagens = value.messages || [];

      for (const msg of mensagens) {
        const de = msg.from;
        const tipo = msg.type;
        const nome = contatos.find((c) => c.wa_id === de)?.profile?.name;
        const quando = Number(msg.timestamp) * 1000 || Date.now();

        db.upsertConversation(de, nome, quando);

        const base = {
          phone: de,
          direction: "in",
          wa_message_id: msg.id,
          created_at: quando,
          status: "received",
        };

        if (tipo === "text") {
          db.insertMessage({ ...base, type: "text", body: msg.text?.body });
        } else if (tipo === "image" || tipo === "audio" || tipo === "video" || tipo === "document") {
          const media = msg[tipo];
          try {
            const { buffer, mimeType } = await wa.downloadMedia(media.id);
            const ext = EXT_BY_MIME[mimeType] || "bin";
            const filename = safeFilename(msg.id, ext);
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            db.insertMessage({
              ...base,
              type: tipo,
              body: media.caption || null,
              media_path: `/media/${filename}`,
              media_mime: mimeType,
            });
          } catch (err) {
            console.error("Erro ao baixar mídia:", err.message);
            db.insertMessage({ ...base, type: tipo, body: "[mídia indisponível]" });
          }
        } else {
          db.insertMessage({ ...base, type: tipo, body: `[mensagem do tipo ${tipo}]` });
        }

        console.log(`📩 [${new Date(quando).toLocaleString("pt-BR")}] ${de} (${tipo})`);
      }

      for (const status of value.statuses || []) {
        db.updateStatusByWaId(status.id, status.status);
        console.log(`✅ Status: ${status.status} — para ${status.recipient_id}`);
      }
    }
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path_ = url.pathname;

  try {
    // GET /webhook — verificação do Meta
    if (req.method === "GET" && path_ === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verificado pelo Meta!");
        return send(res, 200, challenge);
      }
      console.warn("❌ Verificação falhou — token incorreto");
      return send(res, 403, "Forbidden");
    }

    // POST /webhook — mensagens recebidas
    if (req.method === "POST" && path_ === "/webhook") {
      const body = await parseBody(req);
      if (body.object === "whatsapp_business_account") {
        await processarEntry(body.entry || []);
        return send(res, 200, "OK");
      }
      return send(res, 404, "Not found");
    }

    // GET /painel — página do painel
    if (req.method === "GET" && path_ === "/painel") {
      if (!requireAuth(req, res)) return;
      const html = fs.readFileSync(path.join(__dirname, "public", "painel.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /painel/api/conversations — lista de conversas
    if (req.method === "GET" && path_ === "/painel/api/conversations") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, db.listConversations());
    }

    // GET /painel/api/conversations/:phone/messages — mensagens de uma conversa
    const matchMessages = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/messages$/);
    if (req.method === "GET" && matchMessages) {
      if (!requireAuth(req, res)) return;
      const phone = decodeURIComponent(matchMessages[1]);
      return send(res, 200, db.listMessages(phone));
    }

    // POST /painel/api/conversations/:phone/reply — responder uma conversa
    const matchReply = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/reply$/);
    if (req.method === "POST" && matchReply) {
      if (!requireAuth(req, res)) return;
      const phone = decodeURIComponent(matchReply[1]);
      const body = await parseBody(req);
      if (!body.text || !body.text.trim()) return send(res, 400, { error: "Texto vazio" });

      const result = await wa.sendText(phone, body.text);
      const waId = result.messages?.[0]?.id || null;
      const now = Date.now();
      db.upsertConversation(phone, null, now);
      db.insertMessage({
        phone,
        direction: "out",
        type: "text",
        body: body.text,
        wa_message_id: waId,
        status: "sent",
        created_at: now,
      });
      return send(res, 200, { ok: true });
    }

    // GET /media/:filename — servir arquivo de mídia
    const matchMedia = path_.match(/^\/media\/([a-zA-Z0-9_.-]+)$/);
    if (req.method === "GET" && matchMedia) {
      if (!requireAuth(req, res)) return;
      const filePath = path.join(MEDIA_DIR, matchMedia[1]);
      if (!filePath.startsWith(MEDIA_DIR) || !fs.existsSync(filePath)) {
        return send(res, 404, "Not found");
      }
      return send(res, 200, fs.readFileSync(filePath));
    }

    // Health check
    if (req.method === "GET" && path_ === "/") {
      return send(res, 200, { status: "ok", message: "WhatsApp Webhook rodando" });
    }

    send(res, 404, "Not found");
  } catch (err) {
    console.error("Erro no request:", err);
    send(res, 500, { error: "Erro interno" });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: https://SEU_DOMINIO/webhook`);
  console.log(`   Painel:      https://SEU_DOMINIO/painel`);
  console.log("─".repeat(50));
});
