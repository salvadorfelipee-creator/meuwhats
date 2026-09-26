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
    // Sem timeout, um socket travado prende o tick do verificador indefinidamente (achado na
    // revisão final) — 15s é generoso pra uma chamada de API, curto o bastante pra não travar o
    // verificador de 30 em 30s.
    req.setTimeout(15000, () => req.destroy(new Error("Timeout ao chamar a Unnotech")));
    if (payload) req.write(payload);
    req.end();
  });
}

// Cache em memória — renovado só quando falta menos de 1 minuto pro expires_in, nunca um token
// por requisição (pedido explícito da doc: "Reutilize o mesmo token até o expires_in").
let tokenCache = { accessToken: null, expiraEm: 0 };
// Coalesce chamadas concorrentes durante a renovação — achado na revisão final: sem isso, N
// chamadas simultâneas no exato momento em que o token expira cada uma buscava o seu próprio
// token novo (a Unnotech aceita, mas é desperdício e foge do "reutilize o mesmo token" da doc).
let tokenBuscaEmAndamento = null;

async function buscarNovoToken() {
  const clientId = process.env.UNNOTECH_CLIENT_ID;
  const clientSecret = process.env.UNNOTECH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("UNNOTECH_CLIENT_ID/UNNOTECH_CLIENT_SECRET não configurados nas variáveis de ambiente");
  }
  const { status, body } = await unnotechRequest("POST", "/api/v1/auth/token", {
    body: { client_id: clientId, client_secret: clientSecret },
  });
  if (status >= 400) throw new Error(`Falha ao autenticar na Unnotech: ${JSON.stringify(body)}`);
  tokenCache = { accessToken: body.access_token, expiraEm: Date.now() + body.expires_in * 1000 };
  return tokenCache.accessToken;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiraEm - 60_000) {
    return tokenCache.accessToken;
  }
  if (!tokenBuscaEmAndamento) {
    tokenBuscaEmAndamento = buscarNovoToken().finally(() => {
      tokenBuscaEmAndamento = null;
    });
  }
  return tokenBuscaEmAndamento;
}

// Invalida o cache — usado quando a própria API responde 401 no meio de uma chamada (token
// pode ter sido revogado antes do prazo), pra forçar uma renovação de verdade na próxima
// tentativa em vez de devolver o mesmo token já recusado.
function invalidarToken() {
  tokenCache = { accessToken: null, expiraEm: 0 };
}

// Wrapper usado por toda função de domínio abaixo: pega o token, chama, e se vier 401 renova o
// token 1x e tenta de novo (achado na revisão final: "401 persistente após 1 retry de token" era
// só uma frase no comentário da spec, nunca implementada de verdade).
async function chamarAutenticado(method, path, extras = {}) {
  const accessToken = await getAccessToken();
  const primeira = await unnotechRequest(method, path, { ...extras, accessToken });
  if (primeira.status !== 401) return primeira;
  invalidarToken();
  const novoToken = await getAccessToken();
  return unnotechRequest(method, path, { ...extras, accessToken: novoToken });
}

async function criarSolicitacao(cpf, idempotencyKey) {
  const { status, body } = await chamarAutenticado("POST", "/api/v1/fgts/applications", {
    idempotencyKey,
    body: { customer: { cpf } },
  });
  if (status >= 400) throw new Error(`Falha ao abrir solicitação FGTS: ${JSON.stringify(body)}`);
  return body;
}

// Versão otimizada (sem quotes/offers no corpo) — usada pelo polling frequente do verificador.
async function consultarStatus(applicationId) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/fgts/applications/${applicationId}/status`);
  if (status >= 400) throw new Error(`Falha ao consultar status: ${JSON.stringify(body)}`);
  return body;
}

// Recurso completo, com quotes[]/offers[] — usada só quando precisamos ler o motivo de recusa
// ou os detalhes de uma oferta específica (o /status não traz isso).
async function consultarSolicitacaoCompleta(applicationId) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/fgts/applications/${applicationId}`);
  if (status >= 400) throw new Error(`Falha ao consultar solicitação: ${JSON.stringify(body)}`);
  return body;
}

async function requotar(applicationId, idempotencyKey) {
  const { status, body } = await chamarAutenticado("POST", `/api/v1/fgts/applications/${applicationId}/requote`, {
    idempotencyKey,
  });
  if (status >= 400) throw new Error(`Falha ao repetir cotação: ${JSON.stringify(body)}`);
  return body;
}

// Valida os 2 dígitos verificadores do CPF (algoritmo padrão) — achado na revisão final:
// REGEX_CPF (server.js) só confere 11 dígitos no formato certo, então qualquer sequência de 11
// dígitos (até um número de celular) abria solicitação de verdade na Unnotech, gastando cota
// (100/dia) à toa. Só usada antes de chamar criarSolicitacao, não mexe no resto dos fluxos que
// usam REGEX_CPF pra outros produtos (CLT, garantia, financiamento...).
function cpfValido(cpf) {
  const c = String(cpf || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false; // 11 dígitos iguais não é CPF real
  const digitos = c.split("").map(Number);
  const calcularDigito = (fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) soma += digitos[i] * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcularDigito(10) === digitos[9] && calcularDigito(11) === digitos[10];
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
// DatePicker do WhatsApp Flow (versão < 5.0, é o nosso caso, "3.1") devolve epoch em
// milissegundos como string, não "YYYY-MM-DD" — achado na revisão final. Converte só quando o
// valor for puramente numérico (já vem formatado do jeito certo, deixa passar sem mexer).
function normalizarDataFlow(valor) {
  const v = String(valor || "");
  if (!/^\d+$/.test(v)) return v;
  const d = new Date(Number(v));
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}

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
    birth_date: normalizarDataFlow(dados.data_nascimento),
    phone: String(dados.celular || "").replace(/\D/g, ""),
    email: dados.email,
    gender: dados.genero,
    civil_status: dados.estado_civil,
    scholarity: dados.escolaridade,
    mothers_name: dados.nome_mae,
    rg_number: dados.rg_numero,
    rg_organ: dados.rg_orgao,
    rg_uf: dados.rg_uf,
    address: {
      zip_code: String(dados.cep || "").replace(/\D/g, ""),
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

// Upsert — a doc confirma que não exige Idempotency-Key aqui (só as rotas de abertura/aceite
// exigem).
async function enviarKyc(applicationId, kyc) {
  const { status, body } = await chamarAutenticado("POST", `/api/v1/fgts/applications/${applicationId}/kyc`, {
    body: kyc,
  });
  if (status >= 400) throw new Error(`Falha ao enviar KYC: ${JSON.stringify(body)}`);
  return body;
}

async function aceitarOferta(applicationId, offerId, idempotencyKey) {
  const { status, body } = await chamarAutenticado(
    "POST",
    `/api/v1/fgts/applications/${applicationId}/offers/${offerId}/accept`,
    { idempotencyKey }
  );
  if (status >= 400) {
    const err = new Error(`Falha ao aceitar oferta: ${JSON.stringify(body)}`);
    err.codigo = body?.error?.code || null;
    throw err;
  }
  return body;
}

async function consultarProposta(proposalUuid) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/proposals/${proposalUuid}`);
  if (status >= 400) throw new Error(`Falha ao consultar proposta: ${JSON.stringify(body)}`);
  return body.data;
}

// ─── CLT (consignado privado) ───────────────────────────────────────────────
// Mesmo cliente HTTP/autenticação de cima — só endpoints diferentes. Ver
// docs/superpowers/specs/2026-09-26-clt-unnotech-design.md pro fluxo completo (tem 3 portões
// que o FGTS não tem: autorização do trabalhador, consulta de margem, escolha parcela x
// valor líquido).

async function criarSolicitacaoClt(cpf, phone, email, idempotencyKey) {
  const { status, body } = await chamarAutenticado("POST", "/api/v1/clt/applications", {
    idempotencyKey,
    body: { customer: { cpf, phone, email } },
  });
  if (status >= 400) throw new Error(`Falha ao abrir solicitação CLT: ${JSON.stringify(body)}`);
  return body;
}

async function consultarStatusClt(applicationId) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/clt/applications/${applicationId}/status`);
  if (status >= 400) throw new Error(`Falha ao consultar status CLT: ${JSON.stringify(body)}`);
  return body;
}

// Recurso completo — só tem offers[]/quotes[] completos aqui (o /status é enxuto de propósito
// pro polling barato, igual ao FGTS).
async function consultarSolicitacaoCompletaClt(applicationId) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/clt/applications/${applicationId}`);
  if (status >= 400) throw new Error(`Falha ao consultar solicitação CLT: ${JSON.stringify(body)}`);
  return body;
}

async function consultarMargemClt(applicationId) {
  const { status, body } = await chamarAutenticado("GET", `/api/v1/clt/applications/${applicationId}/margin`);
  if (status >= 400) throw new Error(`Falha ao consultar margem CLT: ${JSON.stringify(body)}`);
  return body;
}

async function forcarVerificacaoConsentimentoClt(applicationId) {
  const { status, body } = await chamarAutenticado("POST", `/api/v1/clt/applications/${applicationId}/authorization`);
  if (status >= 400) throw new Error(`Falha ao forçar verificação de consentimento: ${JSON.stringify(body)}`);
  return body;
}

// `basis` é "INSTALLMENT" (parcela) ou "NET_AMOUNT" (valor líquido) — só um dos dois valores é
// enviado, o outro fica de fora do corpo (a doc trata como campo condicional, não os dois).
async function simularClt(applicationId, { employmentId, basis, valor }, idempotencyKey) {
  const body = { employment_id: employmentId, basis };
  if (basis === "INSTALLMENT") body.installment_amount = valor;
  else body.net_amount = valor;
  const { status, body: resposta } = await chamarAutenticado(
    "POST",
    `/api/v1/clt/applications/${applicationId}/simulations`,
    { idempotencyKey, body }
  );
  if (status >= 400) {
    const err = new Error(`Falha ao simular CLT: ${JSON.stringify(resposta)}`);
    err.codigo = resposta?.error?.code || null;
    throw err;
  }
  return resposta;
}

// Upsert, sem Idempotency-Key (mesma regra do FGTS) — `dados.employer` é opcional (e-mail/
// telefone do RH), só entra no payload se pelo menos um dos dois vier preenchido.
function montarPayloadKycClt(cpf, dados) {
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
  const payload = {
    name: dados.nome,
    birth_date: normalizarDataFlow(dados.data_nascimento),
    phone: String(dados.celular || "").replace(/\D/g, ""),
    email: dados.email,
    gender: dados.genero,
    civil_status: dados.estado_civil,
    scholarity: dados.escolaridade,
    mothers_name: dados.nome_mae,
    rg_number: dados.rg_numero,
    rg_organ: dados.rg_orgao,
    rg_uf: dados.rg_uf,
    address: {
      zip_code: String(dados.cep || "").replace(/\D/g, ""),
      uf: dados.uf,
      city: dados.cidade,
      district: dados.bairro,
      street: dados.rua,
      number: dados.numero,
      complement: dados.complemento || null,
    },
    bank,
  };
  const emailRh = (dados.email_rh || "").trim();
  const telefoneRh = (dados.telefone_rh || "").trim();
  if (emailRh || telefoneRh) {
    payload.employer = {};
    if (emailRh) payload.employer.email = emailRh;
    if (telefoneRh) payload.employer.phone = telefoneRh.replace(/\D/g, "");
  }
  return payload;
}

async function enviarKycClt(applicationId, kyc) {
  const { status, body } = await chamarAutenticado("POST", `/api/v1/clt/applications/${applicationId}/kyc`, {
    body: kyc,
  });
  if (status >= 400) throw new Error(`Falha ao enviar KYC CLT: ${JSON.stringify(body)}`);
  return body;
}

// Sem corpo — os dados de desembolso que valem já são os do KYC (a doc é explícita: o bloco
// bank_account do aceite só existe pra quando a conta de crédito ainda não foi informada).
async function aceitarOfertaClt(applicationId, offerId, idempotencyKey) {
  const { status, body } = await chamarAutenticado(
    "POST",
    `/api/v1/clt/applications/${applicationId}/offers/${offerId}/accept`,
    { idempotencyKey }
  );
  if (status >= 400) {
    const err = new Error(`Falha ao aceitar oferta CLT: ${JSON.stringify(body)}`);
    err.codigo = body?.error?.code || null;
    throw err;
  }
  return body;
}

// `offers` já vem ordenada pela própria Unnotech (net_amount desc, installment_amount asc,
// recusadas no final — ver guia) — só filtra disponibilidade, validade e o que já foi tentado
// (usado na re-tentativa automática depois de CONTRACT_REJECTED).
function escolherMelhorOferta(offers, idsJaTentados = []) {
  const agora = Date.now();
  return (
    (offers || []).find(
      (o) =>
        o.status === "AVAILABLE" &&
        !idsJaTentados.includes(o.offer_id) &&
        (!o.expires_at || new Date(o.expires_at).getTime() > agora)
    ) || null
  );
}

module.exports = {
  unnotechRequest,
  getAccessToken,
  criarSolicitacao,
  consultarStatus,
  consultarSolicitacaoCompleta,
  requotar,
  cpfValido,
  filtrarOfertaJ17,
  classificarRecusa,
  BANCOS_COMPE,
  MAPA_TIPO_CONTA,
  montarPayloadKyc,
  enviarKyc,
  aceitarOferta,
  consultarProposta,
  criarSolicitacaoClt,
  consultarStatusClt,
  consultarSolicitacaoCompletaClt,
  consultarMargemClt,
  forcarVerificacaoConsentimentoClt,
  simularClt,
  montarPayloadKycClt,
  enviarKycClt,
  aceitarOfertaClt,
  escolherMelhorOferta,
};
