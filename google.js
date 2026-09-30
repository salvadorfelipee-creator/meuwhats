const https = require("https");
const db = require("./db");

// Mesmo padrão de r2.js/email.js: https puro, sem instalar o SDK oficial do Google (o projeto
// inteiro evita SDK pesado — ver README "Stack"). Usado pra criar contato no Google Contacts
// (People API) quando um funil do WhatsApp termina de coletar e-mail do cliente (ver
// capturarContatoEBoasVindas em server.js) e, desde 30/09/2026, pra consultar/criar horário no
// Google Agenda (Calendar API) — ver horariosDisponiveis/criarEvento mais abaixo.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Quem já autorizou só com o escopo de Contacts precisa reautorizar em
// /painel/api/google/autorizar (prompt=consent força a tela de novo) pra ganhar o escopo de
// Calendar — sem isso, horariosDisponiveis/criarEvento falham com 403 até reautorizar.
const SCOPE = "https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar";

function redirectUri(host) {
  return `https://${host}/painel/api/google/callback`;
}

// Monta a URL de consentimento — o usuário abre isso 1x logado no painel (ver
// GET /painel/api/google/autorizar em server.js). access_type=offline + prompt=consent
// garantem que a resposta traga um refresh_token mesmo se ele já tiver autorizado antes.
function urlAutorizacao(host) {
  if (!CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID não configurado.");
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(host),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function postFormJson(hostname, path, form) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString();
    const req = https.request(
      {
        method: "POST",
        hostname,
        path,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
          } catch {
            json = {};
          }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
          reject(new Error(`Google respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Troca o "code" que o Google manda no callback por um refresh_token — salva no banco (ver
// db.googleConfigSet) pra nunca mais precisar repetir a autorização manual.
async function trocarCodigoPorToken(code, host) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.");
  const json = await postFormJson("oauth2.googleapis.com", "/token", {
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri(host),
    grant_type: "authorization_code",
  });
  if (!json.refresh_token) {
    throw new Error("Google não devolveu refresh_token — revogue o acesso em myaccount.google.com/permissions e tente autorizar de novo.");
  }
  await db.googleConfigSet("refresh_token", json.refresh_token);
}

// Access token expira rápido (1h) — troca pelo refresh token salvo a cada chamada, igual
// qualquer integração OAuth server-to-server.
async function obterAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados.");
  const refreshToken = await db.googleConfigGet("refresh_token");
  if (!refreshToken) throw new Error("Google Contacts ainda não autorizado (ver /painel/api/google/autorizar).");
  const json = await postFormJson("oauth2.googleapis.com", "/token", {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return json.access_token;
}

// Cria o contato no Google Contacts da conta autorizada. `telefone` já vem no formato
// internacional (mesmo dígitos usados como `phone` em conversations, ex. "5511999999999").
async function criarContato({ nome, telefone, email }) {
  const accessToken = await obterAccessToken();
  const body = JSON.stringify({
    names: nome ? [{ givenName: nome }] : undefined,
    phoneNumbers: telefone ? [{ value: `+${telefone}`, type: "mobile" }] : undefined,
    emailAddresses: email ? [{ value: email, type: "home" }] : undefined,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "people.googleapis.com",
        path: "/v1/people:createContact",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
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
          reject(new Error(`People API respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Helper genérico pra chamada JSON autenticada (usado pelas funções de Calendar abaixo —
// criarContato acima já tinha o padrão próprio antes disso existir, não vale a pena arriscar
// mexer nele só por DRY).
function requestJson(method, hostname, path, { accessToken, bodyObj } = {}) {
  const body = bodyObj ? JSON.stringify(bodyObj) : null;
  return new Promise((resolve, reject) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (body) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = https.request({ method, hostname, path, headers }, (res) => {
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
        reject(new Error(`Google Calendar respondeu ${res.statusCode}: ${JSON.stringify(json)}`));
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Google Calendar (agenda de horários disponíveis) ───────────────────────────────────────
// Mesma conta/autorização do Google Contacts (mesmo refresh_token, escopo do Calendar
// adicionado no SCOPE) — usado pelo motor de fluxo dinâmico (nó tipo 'horarios', ver server.js)
// e pelas ferramentas MCP agenda_calendar_* pra oferecer horário real de atendimento dentro da
// conversa de WhatsApp, sem inventar horário que na verdade já está ocupado.

// Lista os próximos horários livres dentro do expediente configurado (pula sábado/domingo) —
// 1 única chamada de freebusy pro período inteiro, depois gera os slots de `duracaoMinutos` em
// `duracaoMinutos` e descarta os que caem em cima de um período ocupado.
async function horariosDisponiveis({
  calendarioId = "primary",
  horaInicio = 9,
  horaFim = 18,
  duracaoMinutos = 60,
  diasAFrente = 14,
  maxResultados = 10,
}) {
  const accessToken = await obterAccessToken();
  const agoraMs = Date.now();
  const fimJanelaMs = agoraMs + diasAFrente * 24 * 60 * 60 * 1000;
  const freebusy = await requestJson("POST", "www.googleapis.com", "/calendar/v3/freeBusy", {
    accessToken,
    bodyObj: { timeMin: new Date(agoraMs).toISOString(), timeMax: new Date(fimJanelaMs).toISOString(), items: [{ id: calendarioId }] },
  });
  if (freebusy.calendars?.[calendarioId]?.errors?.length) {
    throw new Error(`Agenda '${calendarioId}' inacessível: ${JSON.stringify(freebusy.calendars[calendarioId].errors)}`);
  }
  const ocupados = (freebusy.calendars?.[calendarioId]?.busy || []).map((b) => ({
    inicio: new Date(b.start).getTime(),
    fim: new Date(b.end).getTime(),
  }));

  // Trabalha em horário de Brasília via o mesmo truque de timestampDeDataHora (agenda.js):
  // desloca -3h e lê os campos UTC do resultado — dá o "relógio de Brasília" sem depender do
  // fuso do processo Node (Render roda em UTC, mas isso funcionaria igual em qualquer fuso).
  const agoraBrt = new Date(agoraMs - 3 * 60 * 60 * 1000);
  const anoBase = agoraBrt.getUTCFullYear();
  const mesBase = agoraBrt.getUTCMonth();
  const diaBase = agoraBrt.getUTCDate();

  const slots = [];
  for (let dia = 0; dia < diasAFrente && slots.length < maxResultados; dia++) {
    const diaSemanaBrt = new Date(Date.UTC(anoBase, mesBase, diaBase + dia)).getUTCDay();
    if (diaSemanaBrt === 0 || diaSemanaBrt === 6) continue; // pula sábado/domingo (horário de Brasília)
    for (let minutosDoDia = horaInicio * 60; minutosDoDia < horaFim * 60 && slots.length < maxResultados; minutosDoDia += duracaoMinutos) {
      const horaSlot = Math.floor(minutosDoDia / 60);
      const minSlot = minutosDoDia % 60;
      const inicioMs = Date.UTC(anoBase, mesBase, diaBase + dia, horaSlot + 3, minSlot); // +3 = BRT → UTC
      if (inicioMs < agoraMs) continue;
      const fimMs = inicioMs + duracaoMinutos * 60 * 1000;
      const conflita = ocupados.some((o) => inicioMs < o.fim && fimMs > o.inicio);
      if (!conflita) slots.push({ inicio: new Date(inicioMs).toISOString(), fim: new Date(fimMs).toISOString() });
    }
  }
  return slots;
}

// Cria o evento de verdade na agenda — chamado depois que a pessoa escolhe um dos horários
// devolvidos por horariosDisponiveis.
async function criarEvento({ calendarioId = "primary", titulo, descricao, inicioISO, fimISO, attendeeEmail }) {
  const accessToken = await obterAccessToken();
  const bodyObj = {
    summary: titulo,
    description: descricao,
    start: { dateTime: inicioISO },
    end: { dateTime: fimISO },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
  };
  return requestJson("POST", "www.googleapis.com", `/calendar/v3/calendars/${encodeURIComponent(calendarioId)}/events`, {
    accessToken,
    bodyObj,
  });
}

module.exports = { urlAutorizacao, trocarCodigoPorToken, criarContato, horariosDisponiveis, criarEvento };
