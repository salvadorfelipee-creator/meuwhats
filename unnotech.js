// unnotech.js — cliente da API pública da Unnotech (originação de crédito FGTS/CLT). Só fala
// com a API deles; nenhuma lógica de WhatsApp aqui (fica em server.js). Mesmo papel que
// wa.js/r2.js já têm nesse projeto — https nativo, sem dependência nova.
const https = require("https");

const UNNOTECH_HOST = "gtw.unnotech.com.br";
const UNNOTECH_BASE_PATH = "/public";

function unnotechRequest(method, path, { body, accessToken, idempotencyKey, externalId } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    if (externalId) headers["X-Api-External-Id"] = externalId;
    const req = https.request(
      { hostname: UNNOTECH_HOST, path: `${UNNOTECH_BASE_PATH}${path}`, method, headers },
      (res) => {
        let buf = "";
        res.on("data", (chunk) => (buf += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = buf ? JSON.parse(buf) : null;
          } catch {
            parsed = { raw: buf };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Cache em memória — renovado só quando falta menos de 1 minuto pro expires_in, nunca um token
// por requisição (pedido explícito da doc: "Reutilize o mesmo token até o expires_in").
let tokenCache = { accessToken: null, expiraEm: 0 };

async function getAccessToken() {
  const agora = Date.now();
  if (tokenCache.accessToken && agora < tokenCache.expiraEm - 60_000) {
    return tokenCache.accessToken;
  }
  const clientId = process.env.UNNOTECH_CLIENT_ID;
  const clientSecret = process.env.UNNOTECH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("UNNOTECH_CLIENT_ID/UNNOTECH_CLIENT_SECRET não configurados nas variáveis de ambiente");
  }
  const { status, body } = await unnotechRequest("POST", "/api/v1/auth/token", {
    body: { client_id: clientId, client_secret: clientSecret },
  });
  if (status >= 400) throw new Error(`Falha ao autenticar na Unnotech: ${JSON.stringify(body)}`);
  tokenCache = { accessToken: body.access_token, expiraEm: agora + body.expires_in * 1000 };
  return tokenCache.accessToken;
}

async function criarSolicitacao(cpf, idempotencyKey) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("POST", "/api/v1/fgts/applications", {
    accessToken,
    idempotencyKey,
    body: { customer: { cpf } },
  });
  if (status >= 400) throw new Error(`Falha ao abrir solicitação FGTS: ${JSON.stringify(body)}`);
  return body;
}

// Versão otimizada (sem quotes/offers no corpo) — usada pelo polling frequente do verificador.
async function consultarStatus(applicationId) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("GET", `/api/v1/fgts/applications/${applicationId}/status`, {
    accessToken,
  });
  if (status >= 400) throw new Error(`Falha ao consultar status: ${JSON.stringify(body)}`);
  return body;
}

// Recurso completo, com quotes[]/offers[] — usada só quando precisamos ler o motivo de recusa
// ou os detalhes de uma oferta específica (o /status não traz isso).
async function consultarSolicitacaoCompleta(applicationId) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("GET", `/api/v1/fgts/applications/${applicationId}`, {
    accessToken,
  });
  if (status >= 400) throw new Error(`Falha ao consultar solicitação: ${JSON.stringify(body)}`);
  return body;
}

async function requotar(applicationId, idempotencyKey) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("POST", `/api/v1/fgts/applications/${applicationId}/requote`, {
    accessToken,
    idempotencyKey,
  });
  if (status >= 400) throw new Error(`Falha ao repetir cotação: ${JSON.stringify(body)}`);
  return body;
}

// Só a tabela J17 (ÔNIX) interessa — pedido explícito do usuário: se vier oferta de outro
// banco na cotação, ignorar.
function filtrarOfertaJ17(offers) {
  return (offers || []).find((o) => o.source === "J17") || null;
}

// A API não documenta uma lista fechada de códigos de recusa — classifica pelo texto (reason da
// quote, ou rejection_reason.message da oferta). Ajustar as palavras-chave assim que virmos
// respostas reais (ver spec, seção "Itens em aberto").
function classificarRecusa(texto) {
  const t = (texto || "").toLowerCase();
  // Raiz "autoriz" (não "autoriza") pra pegar qualquer conjugação: autorizou, autorizado,
  // autorizar, autorização — "autoriza" sozinho não bate com "autorizou" (ver ledger da Task 4).
  if (t.includes("autoriz")) return "autorizacao";
  if (t.includes("saldo") || t.includes("sem valor") || t.includes("indispon")) return "sem_saldo";
  return "desconhecido";
}

// Nomes que aparecem no dropdown do Flow → código COMPE que a Unnotech espera. Lista inicial
// pelos bancos mais comuns — expandir durante o uso real (ver spec).
const BANCOS_COMPE = {
  "Banco do Brasil": "001",
  Santander: "033",
  "Caixa Econômica Federal": "104",
  Bradesco: "237",
  Itaú: "341",
  Nubank: "260",
  Inter: "077",
  "C6 Bank": "336",
  PagBank: "290",
  "Mercado Pago": "323",
  PicPay: "380",
  "Banco Original": "212",
  Sicoob: "756",
  Sicredi: "748",
  Safra: "422",
  "BTG Pactual": "208",
};

const MAPA_TIPO_CONTA = {
  Corrente: "CHECKING_ACCOUNT",
  Poupança: "SAVINGS_ACCOUNT",
  Salário: "SALARY_ACCOUNT",
};

// `dados` vem da resposta do WhatsApp Flow (ver Task 9) — chaves em snake_case batendo com os
// nomes dos campos do formulário (mesmos nomes usados no flow_json da Task 8). `cpf` é o que já
// temos desde a simulação (não vem do formulário) — usado como chave PIX quando for o caso, já
// que a Unnotech só aceita PIX = CPF do próprio tomador.
function montarPayloadKyc(cpf, dados) {
  const bank =
    dados.forma_desembolso === "PIX"
      ? { disbursement_method: "PIX", pix_key: cpf, pix_type: "CPF" }
      : {
          disbursement_method: "BANK_ACCOUNT",
          bank_code: BANCOS_COMPE[dados.banco] || null,
          account_type: MAPA_TIPO_CONTA[dados.tipo_conta] || null,
          agency: dados.agencia,
          agency_digit: "0",
          account_number: dados.conta,
          account_digit: dados.digito_conta,
        };
  return {
    name: dados.nome,
    birth_date: dados.data_nascimento,
    phone: dados.celular,
    email: dados.email,
    gender: dados.genero,
    civil_status: dados.estado_civil,
    scholarity: dados.escolaridade,
    mothers_name: dados.nome_mae,
    rg_number: dados.rg_numero,
    rg_organ: dados.rg_orgao,
    rg_uf: dados.rg_uf,
    address: {
      zip_code: dados.cep,
      uf: dados.uf,
      city: dados.cidade,
      district: dados.bairro,
      street: dados.rua,
      number: dados.numero,
      complement: dados.complemento || null,
    },
    bank,
  };
}

module.exports = {
  unnotechRequest,
  getAccessToken,
  criarSolicitacao,
  consultarStatus,
  consultarSolicitacaoCompleta,
  requotar,
  filtrarOfertaJ17,
  classificarRecusa,
  BANCOS_COMPE,
  MAPA_TIPO_CONTA,
  montarPayloadKyc,
};
