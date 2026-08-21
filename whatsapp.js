const https = require("https");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

// Números que nunca devem receber mensagem nossa (pedido explícito de bloqueio, ex.: reclamação
// ou pedido pra parar). Checado em TODA função de envio abaixo, então cobre broadcast, lembretes
// automáticos e respostas manuais do painel — não só um fluxo específico.
const NUMEROS_BLOQUEADOS = new Set(["5548999166487", "5548988802379"]);

function garantirNaoBloqueado(to) {
  const digitos = String(to || "").replace(/\D/g, "");
  if (NUMEROS_BLOQUEADOS.has(digitos)) {
    throw new Error(`Envio bloqueado: número ${digitos} está na lista de bloqueio`);
  }
}

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
  garantirNaoBloqueado(to);
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

// Envia uma imagem por link público (o WhatsApp busca a URL, não precisa subir binário pra
// Meta antes) — usado pelo anexo de imagem no painel. `caption` é opcional.
async function sendImage(fromPhoneNumberId, to, imageUrl, caption) {
  garantirNaoBloqueado(to);
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: imageUrl, ...(caption ? { caption } : {}) },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar imagem: ${JSON.stringify(json)}`);
  return json; // { messages: [{ id: "wamid..." }], ... }
}

async function sendButtons(fromPhoneNumberId, to, bodyText, buttons) {
  // buttons: [{ id, title }] — a API aceita no máximo 3 botões, título com até 20 caracteres
  garantirNaoBloqueado(to);
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
          },
        },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar mensagem com botões: ${JSON.stringify(json)}`);
  return json; // { messages: [{ id: "wamid..." }], ... }
}

async function sendList(fromPhoneNumberId, to, bodyText, buttonLabel, rows) {
  // Lista interativa: até 10 opções; título de linha com até 24 caracteres,
  // descrição opcional com até 72. buttonLabel (máx. 20) é o botão que abre a lista.
  garantirNaoBloqueado(to);
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: { button: buttonLabel, sections: [{ rows }] },
        },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar lista: ${JSON.stringify(json)}`);
  return json; // { messages: [{ id: "wamid..." }], ... }
}

// Botão único que abre um link externo (ex.: site). Diferente de sendButtons (respostas
// rápidas), a API não deixa misturar um botão de link com botões de resposta na mesma
// mensagem — por isso esse tipo sempre vem sozinho, em mensagem separada.
async function sendCtaUrl(fromPhoneNumberId, to, bodyText, buttonText, url) {
  garantirNaoBloqueado(to);
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: bodyText },
          action: { name: "cta_url", parameters: { display_text: buttonText, url } },
        },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar botão de link: ${JSON.stringify(json)}`);
  return json;
}

async function sendTemplate(fromPhoneNumberId, to, templateName, languageCode, components) {
  garantirNaoBloqueado(to);
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components ? { components } : {}),
        },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar template: ${JSON.stringify(json)}`);
  return json; // { messages: [{ id: "wamid..." }], ... }
}

// Registro único de um número novo na Cloud API — necessário depois de verificar o número
// por SMS/ligação no Business Manager (aquele passo confirma que o número é seu; este aqui
// ativa ele de fato pra mandar/receber mensagem pela API). `pin` é o PIN de verificação em
// duas etapas que você escolhe agora e vai precisar de novo se registrar esse número em outro
// lugar no futuro — guarde ele. Ação de uma vez só por número, não faz parte do fluxo normal
// de mensagens.
async function registerNumber(phoneNumberId, pin) {
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${phoneNumberId}/register`,
    {
      body: { messaging_product: "whatsapp", pin: String(pin) },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao registrar número: ${JSON.stringify(json)}`);
  return json;
}

// Marca uma mensagem recebida como lida (dois tiques azuis pro cliente) — não falha o
// processamento do webhook se der erro, só não fica marcado como lido pro cliente.
async function markAsRead(fromPhoneNumberId, messageId) {
  const { status, buffer } = await graphRequest(
    "POST",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${fromPhoneNumberId}/messages`,
    {
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao marcar como lida: ${JSON.stringify(json)}`);
  return json;
}

// Lista as contas do WhatsApp (WABA) visíveis pro Business Manager: as que ele É DONO
// (owned_whatsapp_business_accounts) + as que outro portfólio COMPARTILHOU com ele
// (client_whatsapp_business_accounts, caso do Ciahot). Usado pra descobrir automaticamente
// qual WABA cada número pertence, sem precisar cadastrar isso à mão em lugar nenhum.
async function listarWabasDoNegocio(businessId) {
  const [own, client] = await Promise.all([
    graphRequest("GET", "graph.facebook.com", `/${GRAPH_VERSION}/${businessId}/owned_whatsapp_business_accounts?fields=id,name`),
    graphRequest("GET", "graph.facebook.com", `/${GRAPH_VERSION}/${businessId}/client_whatsapp_business_accounts?fields=id,name`),
  ]);
  const parse = (r) => {
    const json = JSON.parse(r.buffer.toString("utf8") || "{}");
    if (r.status >= 400) throw new Error(`Falha ao listar WABAs: ${JSON.stringify(json)}`);
    return json.data || [];
  };
  return [...parse(own), ...parse(client)];
}

async function listarNumerosDaWaba(wabaId) {
  const { status, buffer } = await graphRequest(
    "GET",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number`
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao listar números da WABA: ${JSON.stringify(json)}`);
  return json.data || [];
}

// Templates de mensagem aprovados na WABA — usado pro painel montar a lista de templates
// disponíveis pra envio em massa, em vez da pessoa ter que digitar o nome de cabeça (e
// arriscar errar ou usar um nome que não existe/não está aprovado).
async function listarTemplates(wabaId) {
  const { status, buffer } = await graphRequest(
    "GET",
    "graph.facebook.com",
    `/${GRAPH_VERSION}/${wabaId}/message_templates?fields=name,status,language,category&limit=200`
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao listar templates: ${JSON.stringify(json)}`);
  return json.data || [];
}

// Checa se o App está inscrito nos webhooks dessa conta do WhatsApp (WABA) — sem essa
// inscrição, a Meta nunca avisa o servidor de mensagens novas (o número existe e manda
// mensagem normal, mas o /webhook daqui nunca é chamado, então o bot nunca "vê" nada chegar).
// Diferente do registro de número (POST .../register) — número novo pode estar registrado
// certinho e mesmo assim não ter essa inscrição, porque ela é por WABA, feita geralmente uma
// vez pelo fluxo padrão de onboarding, que números criados "no meio do caminho" podem pular.
async function checarInscricaoWebhook(wabaId) {
  const { status, buffer } = await graphRequest("GET", "graph.facebook.com", `/${GRAPH_VERSION}/${wabaId}/subscribed_apps`);
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao checar inscrição de webhook: ${JSON.stringify(json)}`);
  return json; // { data: [{ whatsapp_business_api_data: { id, name, ... } }] }
}

async function inscreverWebhook(wabaId) {
  const { status, buffer } = await graphRequest("POST", "graph.facebook.com", `/${GRAPH_VERSION}/${wabaId}/subscribed_apps`);
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao inscrever webhook: ${JSON.stringify(json)}`);
  return json; // { success: true }
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

module.exports = {
  sendText,
  sendImage,
  sendButtons,
  sendList,
  sendCtaUrl,
  sendTemplate,
  registerNumber,
  checarInscricaoWebhook,
  inscreverWebhook,
  listarWabasDoNegocio,
  listarNumerosDaWaba,
  listarTemplates,
  downloadMedia,
  markAsRead,
};
