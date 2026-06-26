const https = require("https");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function apiRequest(method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const req = https.request(
      {
        method: "POST",
        hostname: "api.telegram.org",
        path: `/bot${TOKEN}/${method}`,
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const json = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function sendMessage(chatId, text, replyMarkup) {
  const { json } = await apiRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
  if (!json.ok) throw new Error(`Falha ao enviar mensagem no Telegram: ${JSON.stringify(json)}`);
  return json.result;
}

function botaoCompartilharContato(texto) {
  return {
    keyboard: [[{ text: texto, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removerTeclado() {
  return { remove_keyboard: true };
}

module.exports = { sendMessage, botaoCompartilharContato, removerTeclado };
