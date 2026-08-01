const https = require("https");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.BREVO_EMAIL_FROM || "contato@cotacertaseguros.com.br";
const EMAIL_FROM_NOME = process.env.BREVO_EMAIL_FROM_NOME || "Cota Certa Seguros";
const EMAIL_PARA = process.env.LEAD_EMAIL_TO;

function enviarEmail({ to, toNome, subject, html }) {
  return new Promise((resolve, reject) => {
    if (!BREVO_API_KEY) return reject(new Error("BREVO_API_KEY não configurada"));
    if (!to) return reject(new Error("Destinatário do e-mail não configurado (LEAD_EMAIL_TO)"));

    const body = JSON.stringify({
      sender: { email: EMAIL_FROM, name: EMAIL_FROM_NOME },
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

module.exports = { enviarEmail, notificarLeadCotaCerta };
