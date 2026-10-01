// novosaque.js — cliente da API pública da Novo Saque (originação de crédito consignado CLT/
// FGTS/CARD). Só fala com a API deles; nenhuma lógica de WhatsApp aqui (fica em server.js).
// Mesmo papel que unnotech.js/wa.js/r2.js já têm nesse projeto — https nativo, sem dependência
// nova.
//
// Autenticação bem mais simples que a Unnotech: um único header `X-Api-Key`, sem troca de
// token OAuth2 nem Idempotency-Key documentado (ver docs.novosaque.com.br, página
// "Autenticação e Credenciais" — lida em 01/10/2026). A chave sandbox já veio pronta por
// e-mail do parceiro; a de produção só é liberada depois da validação em sandbox.
//
// Achados confirmados contra a API real de sandbox em 01/10/2026 (não só a doc, que diverge
// da API real em 2 pontos — ver comentários abaixo): abrir simulação, aguardar autorização,
// assinar o termo (formulário hospedado pela própria Novo Saque), consultar margem, ver a
// oferta, formalizar com employer_email/employer_phone (a doc dizia "não especificado", a API
// real exige), tudo testado ponta a ponta até a formalização aceita (202).
const https = require("https");
const { cpfValido } = require("./cpf");

const NOVOSAQUE_HOST = process.env.NOVOSAQUE_BASE_HOST || "api.novosaque.dev.br";
const NOVOSAQUE_BASE_PATH = "/partners-api/contracts";

function novoSaqueRequest(method, path, { query, body, apiKey } = {}) {
  return new Promise((resolve, reject) => {
    const qs = query
      ? "?" +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&")
      : "";
    const payload = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["X-Api-Key"] = apiKey;
    const req = https.request(
      { hostname: NOVOSAQUE_HOST, path: `${path}${qs}`, method, headers },
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
    // Mesmo cuidado do unnotech.js: sem timeout, um socket travado prende o verificador de 30s
    // indefinidamente.
    req.setTimeout(15000, () => req.destroy(new Error("Timeout ao chamar a Novo Saque")));
    if (payload) req.write(payload);
    req.end();
  });
}

function getApiKey() {
  const key = process.env.NOVOSAQUE_API_KEY;
  if (!key) throw new Error("NOVOSAQUE_API_KEY não configurada nas variáveis de ambiente");
  return key;
}

// Lança um erro com .invalidFields anexado (quando a API manda detalhe de validação) — mesmo
// padrão de .codigo no unnotech.js, pra quem chama poder tratar sem fazer parsing de mensagem.
function erroComDetalhe(prefixo, body) {
  const err = new Error(`${prefixo}: ${JSON.stringify(body)}`);
  err.invalidFields = body?.invalid_fields || null;
  err.novoSaqueError = body?.error || null;
  return err;
}

// Abre a simulação pro CPF informado — único campo exigido (achado em teste real: a primeira
// simulação, sem installment_value, já volta com uma condição default; não é preciso simular a
// margem máxima manualmente como na Unnotech).
async function criarSimulacaoClt(cpf) {
  const { status, body } = await novoSaqueRequest("GET", `${NOVOSAQUE_BASE_PATH}/CLT/simulation`, {
    query: { document: cpf },
    apiKey: getApiKey(),
  });
  if (status >= 400 || !body?.success) throw erroComDetalhe("Falha ao abrir simulação CLT (Novo Saque)", body);
  // Achado em teste real: o campo que a API devolve é "contract", não "transaction_id" como a
  // doc descreve — aceita os dois nomes por segurança, sem travar se corrigirem a API depois.
  const transactionId = body.contract || body.transaction_id;
  if (!transactionId) throw erroComDetalhe("Resposta sem id de transação (Novo Saque)", body);
  return transactionId;
}

// Re-simula com um installment_value (parcela) específico — usado quando o cliente pede um
// valor de parcela mais baixo que o default. `installments` fica de fora de propósito: não
// pedimos prazo ao cliente, deixamos o motor de crédito deles escolher (mesmo comportamento da
// simulação inicial).
async function resimularClt(transactionId, installmentValue) {
  const { status, body } = await novoSaqueRequest("PUT", `${NOVOSAQUE_BASE_PATH}/CLT/simulation/${transactionId}`, {
    query: { installment_value: installmentValue },
    apiKey: getApiKey(),
  });
  if (status >= 400 || !body?.success) throw erroComDetalhe("Falha ao re-simular CLT (Novo Saque)", body);
  return body.contract || body.transaction_id || transactionId;
}

async function consultarContratoClt(transactionId) {
  const { status, body } = await novoSaqueRequest("GET", `${NOVOSAQUE_BASE_PATH}/CLT/contract/${transactionId}`, {
    apiKey: getApiKey(),
  });
  if (status >= 400 || !body?.success) throw erroComDetalhe("Falha ao consultar contrato CLT (Novo Saque)", body);
  return body.contract;
}

async function enviarFormalizacaoClt(transactionId, simulationId, customerData) {
  const { status, body } = await novoSaqueRequest(
    "POST",
    `${NOVOSAQUE_BASE_PATH}/CLT/contract/${transactionId}/formalization`,
    {
      apiKey: getApiKey(),
      body: { transaction_id: transactionId, simulation_id: simulationId, customer_data: customerData },
    }
  );
  if (status >= 400 || !body?.success) throw erroComDetalhe("Falha ao enviar formalização CLT (Novo Saque)", body);
  return body;
}

// Melhor oferta do "cardápio" de simulation_results — maior disbursed_amount primeiro. Achado
// em teste real: ao contrário da Unnotech (várias ofertas por PRAZO diferente pra uma mesma
// parcela fixa), aqui normalmente vem só 1 tabela (a da própria Novo Saque); a função já lida
// com N tabelas (mesmo critério "pega a melhor") caso produção algum dia tenha mais de uma.
function escolherMelhorOferta(simulationResults) {
  const validas = (simulationResults || []).filter((o) => o.success !== false);
  if (!validas.length) return null;
  return [...validas].sort((a, b) => Number(b.disbursed_amount || 0) - Number(a.disbursed_amount || 0))[0];
}

// DatePicker do WhatsApp Flow (versão < 5.0, é o nosso caso) devolve epoch em milissegundos
// como string, não "YYYY-MM-DD" — mesmo achado já corrigido no unnotech.js (duplicado aqui de
// propósito: é uma função pura de 5 linhas, não vale o acoplamento entre os 2 clientes de API
// só pra não repetir isso).
function normalizarDataFlow(valor) {
  const v = String(valor || "");
  if (!/^\d+$/.test(v)) return v;
  const d = new Date(Number(v));
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}

// `dados` vem da resposta do WhatsApp Flow — mesmos nomes de campo usados no flow_json
// (ver flows/novosaque-clt-cadastro.json). `cpf` já temos desde a abertura da simulação.
function montarCustomerData(cpf, dados) {
  const customerData = {
    name: dados.nome,
    birth_date: normalizarDataFlow(dados.data_nascimento),
    gender: dados.genero,
    nationality: "Brasileiro",
    occupation: dados.profissao,
    politically_exposed_person: false,
    email: dados.email,
    phone_country_code: "55",
    phone_area_code: String(dados.celular || "").replace(/\D/g, "").slice(0, 2),
    phone_number: String(dados.celular || "").replace(/\D/g, "").slice(2),
    country_code: "BRA",
    street_name: dados.rua,
    number: dados.numero,
    district: dados.bairro,
    city: dados.cidade,
    state: dados.uf,
    postal_code: String(dados.cep || "").replace(/\D/g, ""),
    employer_email: dados.email_rh,
    employer_phone: String(dados.telefone_rh || "").replace(/\D/g, ""),
  };
  if (dados.forma_desembolso === "PIX") {
    // Diferente da Unnotech (PIX só aceita chave = CPF do próprio tomador, regra explícita
    // deles), a doc da Novo Saque lista 4 tipos de chave sem nenhuma restrição desse tipo —
    // deixa o cliente escolher qual chave usar, em vez de travar em CPF por analogia errada.
    const tipo = MAPA_PIX_TYPE_NOVOSAQUE[dados.pix_tipo] || "cpf";
    customerData.pix_key_type = tipo;
    customerData.pix_key = tipo === "cpf" ? cpf : dados.pix_chave;
  } else {
    customerData.bank_code = BANCOS_COMPE[dados.banco] || null;
    customerData.bank_branch = dados.agencia;
    customerData.bank_account = dados.conta;
    customerData.bank_account_digit = dados.digito_conta;
    customerData.bank_account_type = MAPA_TIPO_CONTA_NOVOSAQUE[dados.tipo_conta] || null;
  }
  return customerData;
}

// Mesma lista de bancos já usada no unnotech.js — nomes que aparecem no dropdown do Flow →
// código COMPE que a API espera.
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

// CAC = conta corrente, SVG = poupança, SLRY = conta salário (valores confirmados na doc da
// Novo Saque — nomenclatura própria deles, diferente da Unnotech).
const MAPA_TIPO_CONTA_NOVOSAQUE = {
  Corrente: "CAC",
  Poupança: "SVG",
  Salário: "SLRY",
};

// Valores aceitos de pix_key_type confirmados na doc: aleatory_key, email, phone_number, cpf.
const MAPA_PIX_TYPE_NOVOSAQUE = {
  "CPF (o meu)": "cpf",
  "E-mail": "email",
  Telefone: "phone_number",
  "Chave aleatória": "aleatory_key",
};

module.exports = {
  cpfValido,
  criarSimulacaoClt,
  resimularClt,
  consultarContratoClt,
  enviarFormalizacaoClt,
  escolherMelhorOferta,
  montarCustomerData,
  BANCOS_COMPE,
  MAPA_TIPO_CONTA_NOVOSAQUE,
};
