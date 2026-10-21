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

// Salva/atualiza o contato na lista de contatos do Brevo (o envio de e-mail sozinho não cadastra
// ninguém). updateEnabled evita erro quando o e-mail já existe.
function salvarContatoBrevo({ email, nome, telefone, origem, listIds }) {
  return new Promise((resolve, reject) => {
    if (!BREVO_API_KEY) return reject(new Error("BREVO_API_KEY não configurada"));
    if (!email) return reject(new Error("E-mail não informado"));
    const digitos = String(telefone || "").replace(/\D/g, "");
    const attributes = { FIRSTNAME: String(nome || "").split(" ")[0] || undefined, LASTNAME: String(nome || "").split(" ").slice(1).join(" ") || undefined, ORIGEM: origem || undefined };
    if (digitos.length >= 10) attributes.SMS = digitos.startsWith("55") ? `+${digitos}` : `+55${digitos}`;
    const body = JSON.stringify({ email, attributes, updateEnabled: true, ...(listIds && listIds.length ? { listIds } : {}) });
    const req = https.request(
      {
        method: "POST",
        hostname: "api.brevo.com",
        path: "/v3/contacts",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const texto = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(texto);
          reject(new Error(`Brevo respondeu ${res.statusCode}: ${texto.slice(0, 300)}`));
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

async function enviarInicioChatFelizcred({ nome, email }) {
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeiroNome ? `Olá, ${escapeHtml(primeiroNome)}.` : "Olá.";
  const html = `
    <div style="background:#f2f7f4;padding:32px 16px;font-family:Arial,sans-serif;color:#10243b">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;color:#087a47;font-size:12px;font-weight:700">FELIZCRED</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">Seu atendimento começou pelo chat</h1>
        <p style="margin:0 0 12px;line-height:1.6">${saudacao} Recebemos seu contato e sua conversa já está disponível no site.</p>
        <p style="margin:0 0 20px;line-height:1.6">O chat é o canal principal para acompanhar a simulação. Volte pelo mesmo navegador nas próximas 6 horas para continuar de onde parou. Usaremos o WhatsApp somente quando a etapa bancária precisar de autorização ou aviso importante.</p>
        <a href="https://www.felizcred.com.br/?chat=abrir&utm_source=email&utm_medium=transacional" style="display:inline-block;background:#071a2f;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">Voltar ao chat da FelizCred</a>
        <p style="margin:22px 0 0;color:#647386;font-size:12px;line-height:1.5">Se você não iniciou este atendimento, ignore esta mensagem.</p>
      </div>
    </div>`;
  await enviarEmail({ to: email, toNome: nome || email, from: FELIZCRED_EMAIL_FROM, fromNome: FELIZCRED_EMAIL_FROM_NOME, subject: "Seu atendimento no chat da FelizCred começou", html });
}

async function enviarAtualizacaoChatFelizcred({ nome, email, titulo, mensagem }) {
  const html = `
    <div style="background:#f2f7f4;padding:32px 16px;font-family:Arial,sans-serif;color:#10243b">
      <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;color:#087a47;font-size:12px;font-weight:700">ATUALIZAÇÃO DO SEU ATENDIMENTO</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${escapeHtml(titulo)}</h1>
        <p style="margin:0 0 20px;line-height:1.6">${escapeHtml(mensagem)}</p>
        <a href="https://www.felizcred.com.br/?chat=abrir&utm_source=email&utm_medium=transacional" style="display:inline-block;background:#071a2f;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">Conversar pelo chat</a>
      </div>
    </div>`;
  await enviarEmail({ to: email, toNome: nome || email, from: FELIZCRED_EMAIL_FROM, fromNome: FELIZCRED_EMAIL_FROM_NOME, subject: titulo, html });
}

// ─── Lista de transmissão e modelos de e-mail da FelizCred no Brevo ──────────────────────────────────────────────
async function brevoApi(metodo, caminho, corpo) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY não configurada");
  const resposta = await fetch(`https://api.brevo.com/v3${caminho}`, {
    method: metodo,
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await resposta.text();
  let json = {};
  try { json = texto ? JSON.parse(texto) : {}; } catch { json = { raw: texto.slice(0, 300) }; }
  if (!resposta.ok) throw new Error(`Brevo ${metodo} ${caminho} respondeu ${resposta.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

const LISTA_SITE_FELIZCRED = "Site FelizCred";
let listaSiteId = null;

// Acha a lista pelo nome ou cria (dentro da primeira pasta de contatos).
async function garantirListaBrevo(nome = LISTA_SITE_FELIZCRED) {
  if (nome === LISTA_SITE_FELIZCRED && listaSiteId) return listaSiteId;
  const listas = (await brevoApi("GET", "/contacts/lists?limit=50&offset=0")).lists || [];
  let lista = listas.find((l) => String(l.name).trim().toLowerCase() === nome.toLowerCase());
  if (!lista) {
    const pastas = (await brevoApi("GET", "/contacts/folders?limit=50&offset=0")).folders || [];
    if (!pastas.length) throw new Error("Nenhuma pasta de contatos no Brevo");
    const criada = await brevoApi("POST", "/contacts/lists", { name: nome, folderId: pastas[0].id });
    lista = { id: criada.id, name: nome };
  }
  if (nome === LISTA_SITE_FELIZCRED) listaSiteId = lista.id;
  return lista.id;
}

const LINK_CHAT = "https://www.felizcred.com.br/?chat=abrir&utm_source=email&utm_medium=retomada";
const LINK_WHATSAPP = "https://wa.me/554792747368?text=Ol%C3%A1%2C%20vim%20pelo%20chat%20do%20site%20e%20preciso%20continuar%20meu%20atendimento";

function layoutEmailFelizcred({ etiqueta, titulo, paragrafos, botao, linkBotao, rodape }) {
  const ps = paragrafos.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p}</p>`).join("");
  return `<div style="background:#f2f7f4;padding:32px 16px;font-family:Arial,sans-serif;color:#10243b">
  <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">
    <p style="margin:0 0 8px;color:#087a47;font-size:12px;font-weight:700">${etiqueta}</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${titulo}</h1>
    ${ps}
    <a href="${linkBotao}" style="display:inline-block;background:#071a2f;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">${botao}</a>
    <p style="margin:22px 0 0;color:#647386;font-size:12px;line-height:1.5">${rodape || "Se você não iniciou este atendimento, ignore esta mensagem."}</p>
  </div>
</div>`;
}

// Modelos (variáveis do Brevo: {{ params.NOME }} e {{ params.MENSAGEM }}). Ficam editáveis no painel do Brevo.
const MODELOS_EMAIL_FELIZCRED = {
  "felizcred-retomar-simulacao": {
    subject: "{{ params.NOME }}, sua simulação continua salva",
    html: layoutEmailFelizcred({
      etiqueta: "FELIZCRED", titulo: "Sua simulação continua salva",
      paragrafos: ["Olá, {{ params.NOME }}. Vimos que você começou seu atendimento no chat da FelizCred e não conseguiu terminar.", "Está tudo guardado: é só voltar e continuar de onde parou. Se preferir, fale com o Felipe direto pelo WhatsApp."],
      botao: "Continuar no chat", linkBotao: LINK_CHAT,
      rodape: `Prefere o WhatsApp? <a href="${LINK_WHATSAPP}" style="color:#087a47">Fale com a gente</a>. Se você não iniciou este atendimento, ignore esta mensagem.`,
    }),
  },
  "felizcred-autorizacao-pendente": {
    subject: "{{ params.NOME }}, falta só autorizar a consulta",
    html: layoutEmailFelizcred({
      etiqueta: "FELIZCRED", titulo: "Falta só autorizar a consulta",
      paragrafos: ["Olá, {{ params.NOME }}. Enviamos para o seu WhatsApp uma mensagem com o link de autorização da Facta. Ele permite consultar seu vínculo e margem para a simulação e não cria nenhum empréstimo.", "Abra o WhatsApp, toque no link e autorize. Depois volte ao chat e toque em <b>Já autorizei</b>: sua simulação fica salva na mesma tela."],
      botao: "Voltar ao chat", linkBotao: LINK_CHAT,
      rodape: `Não recebeu o link? <a href="${LINK_WHATSAPP}" style="color:#087a47">Chame a gente no WhatsApp</a> que reenviamos.`,
    }),
  },
  "felizcred-problema-na-consulta": {
    subject: "{{ params.NOME }}, tivemos um problema na sua consulta",
    html: layoutEmailFelizcred({
      etiqueta: "FELIZCRED", titulo: "Tivemos um problema na sua consulta",
      paragrafos: ["Olá, {{ params.NOME }}. A consulta da sua simulação não foi concluída por uma instabilidade ou por um dado do cadastro, e nenhum contrato foi criado.", "Nossa equipe já pode continuar com você pelo WhatsApp, sem você precisar começar de novo. Se o celular informado já estiver ligado a outro CPF, podemos usar outro número."],
      botao: "Falar com o Felipe no WhatsApp", linkBotao: LINK_WHATSAPP,
    }),
  },
  "felizcred-resposta-atendente": {
    subject: "O Felipe respondeu você no chat da FelizCred",
    html: layoutEmailFelizcred({
      etiqueta: "RESPOSTA DO ATENDIMENTO", titulo: "O Felipe respondeu você",
      paragrafos: ["Olá, {{ params.NOME }}. Você estava no chat da FelizCred e já respondemos:", `<span style="display:block;background:#f2f7f4;border-left:4px solid #087a47;padding:12px 14px;border-radius:8px">{{ params.MENSAGEM }}</span>`],
      botao: "Responder no chat", linkBotao: LINK_CHAT,
      rodape: `Prefere o WhatsApp? <a href="${LINK_WHATSAPP}" style="color:#087a47">Fale com a gente</a>.`,
    }),
  },
};

// Cria no Brevo os modelos que ainda não existem (pelo nome). Devolve { nome: id }.
async function garantirModelosBrevo() {
  const existentes = (await brevoApi("GET", "/smtp/templates?limit=100&offset=0")).templates || [];
  const ids = {};
  for (const [nome, modelo] of Object.entries(MODELOS_EMAIL_FELIZCRED)) {
    const achado = existentes.find((t) => t.name === nome);
    if (achado) { ids[nome] = achado.id; continue; }
    const criado = await brevoApi("POST", "/smtp/templates", {
      templateName: nome, subject: modelo.subject, htmlContent: modelo.html, isActive: true,
      sender: { name: FELIZCRED_EMAIL_FROM_NOME, email: FELIZCRED_EMAIL_FROM },
    });
    ids[nome] = criado.id;
  }
  return ids;
}

const idsModelos = {};
// Envia um dos modelos acima para o cliente. `mensagem` entra escapada.
async function enviarModeloFelizcred({ modelo, email, nome, mensagem }) {
  if (!idsModelos[modelo]) Object.assign(idsModelos, await garantirModelosBrevo());
  const primeiroNome = String(nome || "").trim().split(/\s+/)[0] || "tudo bem";
  await brevoApi("POST", "/smtp/email", {
    to: [{ email, name: nome || email }],
    templateId: idsModelos[modelo],
    params: { NOME: primeiroNome, MENSAGEM: escapeHtml(mensagem || "").slice(0, 1500).replace(/\n/g, "<br>") },
  });
}

module.exports = { garantirListaBrevo, garantirModelosBrevo, enviarModeloFelizcred, LISTA_SITE_FELIZCRED, salvarContatoBrevo, enviarEmail, notificarLeadCotaCerta, enviarBoasVindasFelizcred, enviarInicioChatFelizcred, enviarAtualizacaoChatFelizcred };
