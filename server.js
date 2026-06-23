const http = require("http");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "meu_token_secreto";

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

function send(res, status, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

// ─── PROCESSAR MENSAGEM ───────────────────────────────────────────────────────
function processarMensagem(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      const mensagens = value.messages || [];

      for (const msg of mensagens) {
        const de = msg.from; // número do remetente
        const tipo = msg.type;

        if (tipo === "text") {
          console.log(`📩 [${new Date().toLocaleString("pt-BR")}]`);
          console.log(`   De:      ${de}`);
          console.log(`   Texto:   ${msg.text?.body}`);
          console.log("─".repeat(50));
        } else if (tipo === "image") {
          console.log(`🖼️  [${new Date().toLocaleString("pt-BR")}]`);
          console.log(`   De:      ${de}`);
          console.log(`   Imagem:  ${msg.image?.id}`);
          console.log("─".repeat(50));
        } else if (tipo === "audio") {
          console.log(`🎵 [${new Date().toLocaleString("pt-BR")}]`);
          console.log(`   De:      ${de}`);
          console.log(`   Áudio:   ${msg.audio?.id}`);
          console.log("─".repeat(50));
        } else {
          console.log(`📦 [${new Date().toLocaleString("pt-BR")}]`);
          console.log(`   De:      ${de}`);
          console.log(`   Tipo:    ${tipo}`);
          console.log("─".repeat(50));
        }
      }

      // Status de entrega (lido, entregue, etc.)
      for (const status of value.statuses || []) {
        console.log(`✅ Status: ${status.status} — para ${status.recipient_id}`);
      }
    }
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ── GET /webhook — verificação do Meta ──────────────────────────────────────
  if (req.method === "GET" && path === "/webhook") {
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

  // ── POST /webhook — mensagens recebidas ─────────────────────────────────────
  if (req.method === "POST" && path === "/webhook") {
    const body = await parseBody(req);

    if (body.object === "whatsapp_business_account") {
      processarMensagem(body.entry || []);
      return send(res, 200, "OK");
    }

    return send(res, 404, "Not found");
  }

  // ── Health check ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/") {
    return send(res, 200, { status: "ok", message: "WhatsApp Webhook rodando" });
  }

  send(res, 404, "Not found");
});

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: https://SEU_DOMINIO/webhook`);
  console.log(`   VERIFY_TOKEN: ${VERIFY_TOKEN}`);
  console.log("─".repeat(50));
});
