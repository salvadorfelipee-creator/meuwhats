const https = require("https");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.BREVO_EMAIL_FROM || "contato@cotacertaseguros.com.br";
const EMAIL_FROM_NOME = process.env.BREVO_EMAIL_FROM_NOME || "Cota Certa Seguros";
const EMAIL_PARA = process.env.LEAD_EMAIL_TO;

const FELIZCRED_EMAIL_FROM = process.env.FELIZCRED_EMAIL_FROM || "contato@felizcred.com.br";
const FELIZCRED_EMAIL_FROM_NOME = process.env.FELIZCRED_EMAIL_FROM_NOME || "Felizcred";

function enviarEmail({ to, toNome, subject, html, from, fromNome }) {
  return new Promise((resolve, reject) => {
    if (!BREVO_API_KEY) return reject(new Error("BREVO_API_KEY não configurada"));
    if (!to) return reject(new Error("Destinatário do e-mail não informado"));

    const body = JSON.stringify({
      sender: { email: from || EMAIL_FROM, name: fromNome || EMAIL_FROM_NOME },
      to: [{ email: to, name: toNome || to }],
      subject,
      htmlContent: html,
    });

    const req = https.request(
      {
        method: "POST",
        hostname: "api.brevo.com",
        path: "/v3/smtp/email",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json;
          try {
            json = JSON.parse(buf.toString("utf8") || "{}");
          } catch {
            json = { raw: buf.toString("utf8") };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
          reject(new Error(`Brevo respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function notificarLeadCotaCerta(lead) {
  const { tipo, nome, whatsapp, email, cpf, detalhes, origem } = lead;
  const linhas = [
    ["Tipo", tipo],
    ["Nome", nome],
    ["WhatsApp", whatsapp],
    ["E-mail", email],
    ["CPF", cpf],
    ["Origem", origem === "callback" ? "Pediu retorno em 10 min" : "Formulário de cotação"],
    ["Detalhes", detalhes],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#666;font-weight:600">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#0066FF;margin:0 0 12px">Novo lead — Cota Certa Seguros</h2>
      <p style="color:#333">Alguém preencheu o formulário do site. Se possível, entre em contato mesmo que a pessoa não chame no WhatsApp.</p>
      <table style="border-collapse:collapse">${linhas}</table>
    </div>`;

  await enviarEmail({
    to: EMAIL_PARA,
    subject: `Novo lead: ${nome || "sem nome"} — ${tipo || "seguro"}`,
    html,
  });
}

// Disparado quando um funil automático do WhatsApp termina de coletar o e-mail do cliente (ver
// capturarContatoEBoasVindas em server.js) — mesmo momento em que o contato é criado no Google
// Contacts. Remetente próprio da Felizcred, não o da Cota Certa (marca diferente).
async function enviarBoasVindasFelizcred({ nome, email }) {
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#0066FF;margin:0 0 12px">Bem-vindo(a) à Felizcred!</h2>
      <p style="color:#333">${saudacao} Recebemos seus dados e já estamos com o seu atendimento em mãos.</p>
      <p style="color:#333">Em breve o Felipe continua a conversa com você diretamente pelo WhatsApp pra seguir com a
      sua simulação — fique de olho por lá.</p>
      <p style="color:#333">Obrigado por confiar na Felizcred! 🙌</p>
    </div>`;

  await enviarEmail({
    to: email,
    toNome: nome || email,
    from: FELIZCRED_EMAIL_FROM,
    fromNome: FELIZCRED_EMAIL_FROM_NOME,
    subject: `Bem-vindo(a) à Felizcred${primeiroNome ? `, ${primeiroNome}` : ""}!`,
    html,
  });
}

module.exports = { enviarEmail, notificarLeadCotaCerta, enviarBoasVindasFelizcred };
