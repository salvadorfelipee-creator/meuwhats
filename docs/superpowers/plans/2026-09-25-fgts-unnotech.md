# Originação automática de FGTS via Unnotech — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o "aguarde atendimento" genérico do fluxo de FGTS por uma integração real com a
Unnotech (tabela J17/ÔNIX) — simulação, coleta de dados via WhatsApp Flow, aceite, assinatura e
acompanhamento até o pagamento, 100% automático.

**Architecture:** Módulo novo `unnotech.js` (cliente HTTP puro, `https` nativo, sem dependência
nova) fala com a API da Unnotech. Tabela nova `fgts_origination` guarda cada solicitação em
andamento. Um `setInterval` novo em `server.js` (mesmo padrão dos verificadores já existentes —
broadcast agendado, lembretes de fluxo parado) consulta o status periodicamente e avança a
conversa. Coleta de dados via **WhatsApp Flow** (formulário nativo), começando estático (fase 3)
e ganhando autopreenchimento de CEP via endpoint criptografado só na última tarefa (fase 5).

**Tech Stack:** Node.js puro (sem framework novo), `https` nativo (igual `whatsapp.js`),
`@libsql/client` (banco, já em uso), `crypto` nativo do Node (RSA/AES da tarefa 13).

**Spec:** `docs/superpowers/specs/2026-09-25-fgts-unnotech-design.md`

## Global Constraints

- Sem framework de teste novo (Jest/Mocha) — esse projeto é "vanilla Node" de propósito. Cada
  tarefa verifica com `node --check <arquivo>` (sintaxe), um script `node -e` descartável pra
  lógica pura (mesmo padrão já usado nesse repositório pra bugs de regex/unicode), e `curl`
  contra o servidor local (`node server.js` com as env vars do `.claude/settings.local.json`) ou
  contra o Render pra fluxo end-to-end — mesma prática usada nessa sessão inteira.
- **Só a tabela J17 (ÔNIX)** — qualquer outra oferta que a cotação trouxer é ignorada.
- **Nunca commitar `UNNOTECH_CLIENT_ID`/`UNNOTECH_CLIENT_SECRET`/chave privada do Flow** — só
  variável de ambiente no Render, igual `ACCESS_TOKEN` da Meta já é tratado.
- Toda escrita na Unnotech leva `Idempotency-Key` (UUID via `crypto.randomUUID()`, nativo do
  Node ≥18 — já é o mínimo exigido em `package.json`). Retry da MESMA operação reusa a mesma
  chave (guardada na linha de `fgts_origination`); uma operação nova gera outra.
- PIX só aceita chave = CPF do próprio tomador (regra da Unnotech, não nossa) — nunca perguntar
  chave PIX separada.
- Dígito da agência nunca é perguntado ao cliente — vai sempre fixo `"0"`.
- Estado civil/escolaridade/órgão emissor vêm pré-preenchidos no Flow (Solteiro/Ensino
  Médio/SSP) e editáveis — decisão explícita do usuário, não simplificar mais que isso nem
  menos.

## Review Focus

- **Cliente manda "fgts" de novo enquanto já tem uma solicitação aberta** — não deve abrir uma
  segunda `fgts_origination` duplicada nem travar; deve reconhecer a que já está em andamento.
- **A oferta expira (1h) antes do cliente terminar o Flow** — o aceite tem que lidar com
  `409 OFFER_EXPIRED` sem deixar a conversa travada num "só um instante" pra sempre.
- **Cotação não traz NENHUMA oferta J17 (só de outro banco, ou nenhuma)** — tem que resultar
  numa mensagem clara pro cliente, nunca em silêncio.
- **Token da Unnotech expira no meio de uma sequência de chamadas** — `getAccessToken` tem que
  renovar sozinho, sem exigir que cada função chamadora saiba disso.
- **Servidor reinicia/reploya no meio de uma solicitação em andamento** — o estado tem que estar
  todo no banco (`fgts_origination`), nunca em variável de memória/`setTimeout`, pra o
  verificador retomar sozinho depois do restart (mesmo cuidado que `broadcast_agendado` já tem).

---

## Task 1: Tabela `fgts_origination` + funções de banco

**Files:**
- Modify: `db.js` (bloco de criação de tabelas, perto de `broadcast_agendado`; exports no final)

**Interfaces:**
- Produces: `db.fgtsOriginationCriar(phone, businessNumberId, applicationId, cpf, idempotencyKey) → Promise<number>` (id da linha)
  `db.fgtsOriginationBuscarAberta(phone, businessNumberId) → Promise<row|null>`
  `db.fgtsOriginationBuscarPorId(id) → Promise<row|null>`
  `db.fgtsOriginationAtualizar(id, campos: object) → Promise<void>`
  `db.fgtsOriginationListarAbertas() → Promise<row[]>`

- [ ] **Step 1: Criar a tabela e os índices**

No bloco de inicialização do banco em `db.js` (mesmo lugar onde `broadcast_agendado` é criada),
adicionar:

```js
await client.execute(`CREATE TABLE IF NOT EXISTS fgts_origination (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  business_number_id TEXT NOT NULL,
  application_id TEXT,
  cpf TEXT,
  offer_id TEXT,
  proposal_uuid TEXT,
  etapa TEXT NOT NULL DEFAULT 'abrindo',
  status_unnotech TEXT,
  idempotency_key_atual TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);
await client.execute(
  `CREATE INDEX IF NOT EXISTS idx_fgts_origination_etapa ON fgts_origination(etapa, updated_at)`
);
await client.execute(
  `CREATE INDEX IF NOT EXISTS idx_fgts_origination_phone ON fgts_origination(phone, business_number_id)`
);
```

- [ ] **Step 2: Adicionar as funções de acesso**

Perto das funções de `broadcast_agendado` em `db.js`:

```js
// Uma linha por solicitação de FGTS em andamento na Unnotech — etapa controla onde a conversa
// está (ver FLUXO_ORIGINACAO_FGTS_ETAPAS em server.js), status_unnotech guarda o último
// ApplicationStatus que a API devolveu, só pra debug/painel.
async function fgtsOriginationCriar(phone, businessNumberId, applicationId, cpf, idempotencyKey) {
  await ready;
  const agora = Date.now();
  const result = await client.execute({
    sql: `INSERT INTO fgts_origination
            (phone, business_number_id, application_id, cpf, etapa, idempotency_key_atual, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'abrindo', ?, ?, ?)`,
    args: [phone, businessNumberId, applicationId, cpf, idempotencyKey, agora, agora],
  });
  return Number(result.lastInsertRowid);
}

// Etapas terminais não contam como "aberta" — evita abrir uma segunda solicitação em cima de
// uma já concluída/sem oferta/com erro (ver Review Focus: "fgts" de novo com pedido em andamento).
const FGTS_ORIGINATION_ETAPAS_TERMINAIS = ["concluido", "sem_oferta", "erro"];

async function fgtsOriginationBuscarAberta(phone, businessNumberId) {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fgts_origination WHERE phone = ? AND business_number_id = ?
          AND etapa NOT IN (${FGTS_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY id DESC LIMIT 1`,
    args: [phone, businessNumberId, ...FGTS_ORIGINATION_ETAPAS_TERMINAIS],
  });
  return result.rows[0] || null;
}

async function fgtsOriginationBuscarPorId(id) {
  await ready;
  const result = await client.execute({ sql: `SELECT * FROM fgts_origination WHERE id = ?`, args: [id] });
  return result.rows[0] || null;
}

// `campos` é um objeto { coluna: valor } — só atualiza o que for passado, sempre toca
// `updated_at` (é o que o verificador usa pra saber quando reconsultar).
async function fgtsOriginationAtualizar(id, campos) {
  await ready;
  const colunas = Object.keys(campos);
  if (!colunas.length) return;
  const sets = colunas.map((c) => `${c} = ?`).join(", ");
  await client.execute({
    sql: `UPDATE fgts_origination SET ${sets}, updated_at = ? WHERE id = ?`,
    args: [...colunas.map((c) => campos[c]), Date.now(), id],
  });
}

async function fgtsOriginationListarAbertas() {
  await ready;
  const result = await client.execute({
    sql: `SELECT * FROM fgts_origination
          WHERE etapa NOT IN (${FGTS_ORIGINATION_ETAPAS_TERMINAIS.map(() => "?").join(",")})
          ORDER BY updated_at ASC`,
    args: FGTS_ORIGINATION_ETAPAS_TERMINAIS,
  });
  return result.rows;
}
```

- [ ] **Step 3: Exportar as funções novas**

No `module.exports` de `db.js`, perto de `broadcastAgendarLote`:

```js
  fgtsOriginationCriar,
  fgtsOriginationBuscarAberta,
  fgtsOriginationBuscarPorId,
  fgtsOriginationAtualizar,
  fgtsOriginationListarAbertas,
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check db.js`
Expected: sem saída (sucesso)

- [ ] **Step 5: Testar as funções contra um banco local**

```bash
TURSO_DATABASE_URL="file:./scratch-test.db" node -e "
const db = require('./db.js');
(async () => {
  const id = await db.fgtsOriginationCriar('5547999999999', '123', 'app_teste', '12345678909', 'idem_teste');
  console.log('criado id=', id);
  const aberta = await db.fgtsOriginationBuscarAberta('5547999999999', '123');
  console.log('aberta:', aberta.etapa, aberta.application_id);
  await db.fgtsOriginationAtualizar(id, { etapa: 'concluido' });
  const depois = await db.fgtsOriginationBuscarAberta('5547999999999', '123');
  console.log('depois de concluir, aberta =', depois); // deve ser null
  process.exit(0);
})();
"
rm -f scratch-test.db
```

Expected: imprime `criado id= 1`, `aberta: abrindo app_teste`, `depois de concluir, aberta = null`

- [ ] **Step 6: Commit**

```bash
git add db.js
git commit -m "FGTS/Unnotech: tabela fgts_origination + funcoes de banco"
```

---

## Task 2: `unnotech.js` — requisição base e autenticação

**Files:**
- Create: `unnotech.js`

**Interfaces:**
- Consumes: `process.env.UNNOTECH_CLIENT_ID`, `process.env.UNNOTECH_CLIENT_SECRET`
- Produces: `unnotech.getAccessToken() → Promise<string>`

- [ ] **Step 1: Criar o arquivo com o helper de requisição e a autenticação**

```js
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

module.exports = {
  unnotechRequest,
  getAccessToken,
};
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check unnotech.js`
Expected: sem saída

- [ ] **Step 3: Testar sem credenciais (deve falhar com mensagem clara, não travar)**

```bash
node -e "
const unnotech = require('./unnotech.js');
unnotech.getAccessToken().catch((err) => console.log('Erro esperado:', err.message));
"
```

Expected: `Erro esperado: UNNOTECH_CLIENT_ID/UNNOTECH_CLIENT_SECRET não configurados nas variáveis de ambiente`

- [ ] **Step 4: Se já tiver `client_id`/`client_secret` reais, testar de verdade**

```bash
UNNOTECH_CLIENT_ID="..." UNNOTECH_CLIENT_SECRET="..." node -e "
const unnotech = require('./unnotech.js');
unnotech.getAccessToken().then((t) => console.log('Token OK, começa com:', t.slice(0, 20)));
"
```

Expected: imprime o começo de um JWT (`eyJ...`). Se não tiver as credenciais ainda, pular esse
step e seguir — as próximas tarefas continuam testáveis com `node --check` até a credencial
chegar.

- [ ] **Step 5: Commit**

```bash
git add unnotech.js
git commit -m "FGTS/Unnotech: modulo unnotech.js com autenticacao (getAccessToken)"
```

---

## Task 3: `unnotech.js` — abrir solicitação, status, requote

**Files:**
- Modify: `unnotech.js`

**Interfaces:**
- Consumes: `getAccessToken()` (Task 2)
- Produces:
  `criarSolicitacao(cpf, idempotencyKey) → Promise<{application_id, status, ...}>`
  `consultarStatus(applicationId) → Promise<{status, quotes_pending, ...}>`
  `consultarSolicitacaoCompleta(applicationId) → Promise<{status, quotes[], offers[], proposal_uuid, ...}>`
  `requotar(applicationId, idempotencyKey) → Promise<object>`

- [ ] **Step 1: Adicionar as funções**

```js
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
```

Adicionar ao `module.exports`: `criarSolicitacao, consultarStatus, consultarSolicitacaoCompleta, requotar`.

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check unnotech.js`

- [ ] **Step 3: Testar com credencial real (se disponível)**

```bash
UNNOTECH_CLIENT_ID="..." UNNOTECH_CLIENT_SECRET="..." node -e "
const { randomUUID } = require('crypto');
const unnotech = require('./unnotech.js');
(async () => {
  const cpf = '12345678909'; // CPF de teste — trocar por um real de teste se a Unnotech pedir
  const app = await unnotech.criarSolicitacao(cpf, randomUUID());
  console.log('Aberto:', app.application_id, app.status);
  const status = await unnotech.consultarStatus(app.application_id);
  console.log('Status agora:', status.status, 'quotes_pending:', status.quotes_pending);
})();
"
```

Expected: `Aberto: <uuid> QUOTING`, depois `Status agora: QUOTING` ou já `OFFERS_AVAILABLE`/`NO_OFFERS`
dependendo de quão rápido a cotação roda. Sem credencial ainda, pular e seguir com `node --check`.

- [ ] **Step 4: Commit**

```bash
git add unnotech.js
git commit -m "FGTS/Unnotech: criar solicitacao, consultar status, requote"
```

---

## Task 4: `unnotech.js` — filtro J17, classificador de recusa, mapa de bancos, montagem do KYC

**Files:**
- Modify: `unnotech.js`

**Interfaces:**
- Produces:
  `filtrarOfertaJ17(offers) → offer|null`
  `classificarRecusa(texto) → "autorizacao"|"sem_saldo"|"desconhecido"`
  `BANCOS_COMPE` (object, nome→código)
  `MAPA_TIPO_CONTA` (object, rótulo pt-BR→enum da API)
  `montarPayloadKyc(cpf, dadosFormulario) → object` (formato `FgtsKyc` da Unnotech)

- [ ] **Step 1: Escrever o filtro e o classificador**

```js
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
  if (t.includes("autoriza")) return "autorizacao";
  if (t.includes("saldo") || t.includes("sem valor") || t.includes("indispon")) return "sem_saldo";
  return "desconhecido";
}
```

- [ ] **Step 2: Testar o classificador isoladamente**

```bash
node -e "
const { classificarRecusa } = require('./unnotech.js');
console.log(classificarRecusa('Cliente não autorizou a consulta'));      // autorizacao
console.log(classificarRecusa('Não foi possível autorizar o parceiro')); // autorizacao
console.log(classificarRecusa('Saldo indisponível para saque'));         // sem_saldo
console.log(classificarRecusa('Sem valor disponível este período'));     // sem_saldo
console.log(classificarRecusa('Erro genérico qualquer'));                // desconhecido
console.log(classificarRecusa(''));                                      // desconhecido
"
```

Expected: `autorizacao`, `autorizacao`, `sem_saldo`, `sem_saldo`, `desconhecido`, `desconhecido`

- [ ] **Step 3: Mapa de bancos e tipos de conta**

```js
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
```

- [ ] **Step 4: Montagem do payload de KYC a partir da resposta do Flow**

```js
// `dados` vem da resposta do WhatsApp Flow (ver Task 9) — chaves em snake_case batendo com os
// nomes dos campos do formulário (mesmos nomes usados no flow_json da Task 8). `cpf` é o que já
// temos desde a simulação (não vem do formulário) — usado como chave PIX quando for o caso,
// já que a Unnotech só aceita PIX = CPF do próprio tomador.
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
```

Adicionar ao `module.exports`: `filtrarOfertaJ17, classificarRecusa, BANCOS_COMPE, MAPA_TIPO_CONTA, montarPayloadKyc`.

- [ ] **Step 5: Testar a montagem do KYC com os dois casos (PIX e conta bancária)**

```bash
node -e "
const { montarPayloadKyc } = require('./unnotech.js');
const base = {
  nome: 'Maria Souza', data_nascimento: '1988-04-17', celular: '47999998888',
  email: 'maria@example.com', genero: 'FEMALE', estado_civil: 'SINGLE',
  escolaridade: 'Ensino Médio', nome_mae: 'Joana Souza', rg_numero: '123456789',
  rg_orgao: 'SSP', rg_uf: 'SC', cep: '01310100', uf: 'SP', cidade: 'São Paulo',
  bairro: 'Bela Vista', rua: 'Avenida Paulista', numero: '1578', complemento: 'Apto 42',
};
const comPix = montarPayloadKyc('12345678909', { ...base, forma_desembolso: 'PIX' });
console.log('PIX:', JSON.stringify(comPix.bank));
const comConta = montarPayloadKyc('12345678909', {
  ...base, forma_desembolso: 'CONTA', banco: 'Nubank', tipo_conta: 'Corrente',
  agencia: '0001', conta: '123456', digito_conta: '7',
});
console.log('Conta:', JSON.stringify(comConta.bank));
"
```

Expected:
`PIX: {"disbursement_method":"PIX","pix_key":"12345678909","pix_type":"CPF"}`
`Conta: {"disbursement_method":"BANK_ACCOUNT","bank_code":"260","account_type":"CHECKING_ACCOUNT","agency":"0001","agency_digit":"0","account_number":"123456","account_digit":"7"}`

- [ ] **Step 6: Commit**

```bash
git add unnotech.js
git commit -m "FGTS/Unnotech: filtro J17, classificador de recusa, mapa de bancos, montagem do KYC"
```

---

## Task 5: `unnotech.js` — enviar KYC e aceitar oferta + consultar proposta

**Files:**
- Modify: `unnotech.js`

**Interfaces:**
- Produces:
  `enviarKyc(applicationId, kyc) → Promise<object>`
  `aceitarOferta(applicationId, offerId, idempotencyKey) → Promise<object>` (lança erro com `.codigo` preenchido em falha de negócio)
  `consultarProposta(proposalUuid) → Promise<{proposal_uuid, signature_link, status, ...}>`

- [ ] **Step 1: Adicionar as funções**

```js
// Upsert — a doc confirma que não exige Idempotency-Key aqui (só as rotas de abertura/aceite
// exigem).
async function enviarKyc(applicationId, kyc) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("POST", `/api/v1/fgts/applications/${applicationId}/kyc`, {
    accessToken,
    body: kyc,
  });
  if (status >= 400) throw new Error(`Falha ao enviar KYC: ${JSON.stringify(body)}`);
  return body;
}

async function aceitarOferta(applicationId, offerId, idempotencyKey) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest(
    "POST",
    `/api/v1/fgts/applications/${applicationId}/offers/${offerId}/accept`,
    { accessToken, idempotencyKey }
  );
  if (status >= 400) {
    const err = new Error(`Falha ao aceitar oferta: ${JSON.stringify(body)}`);
    err.codigo = body?.error?.code || null;
    throw err;
  }
  return body;
}

async function consultarProposta(proposalUuid) {
  const accessToken = await getAccessToken();
  const { status, body } = await unnotechRequest("GET", `/api/v1/proposals/${proposalUuid}`, { accessToken });
  if (status >= 400) throw new Error(`Falha ao consultar proposta: ${JSON.stringify(body)}`);
  return body.data;
}
```

Adicionar ao `module.exports`: `enviarKyc, aceitarOferta, consultarProposta`.

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check unnotech.js`

- [ ] **Step 3: Commit**

```bash
git add unnotech.js
git commit -m "FGTS/Unnotech: enviar KYC, aceitar oferta, consultar proposta"
```

---

## Task 6: Ligar as 3 entradas de FGTS pra abrir a solicitação

**Files:**
- Modify: `server.js` (`handlerCapturaDadosFgts`, `handlerFgtsAnuncioCapturaCpf`, e um novo `iniciarOriginacaoFgts`)

**Interfaces:**
- Consumes: `unnotech.criarSolicitacao`, `db.fgtsOriginationBuscarAberta`, `db.fgtsOriginationCriar`
- Produces: `iniciarOriginacaoFgts(de, businessNumberId, cpf) → Promise<void>` (chamado pelas 3 entradas)

- [ ] **Step 1: Adicionar o `require` do módulo novo no topo de `server.js`**

Perto de `const r2 = require("./r2");`:

```js
const unnotech = require("./unnotech");
```

- [ ] **Step 2: Escrever `iniciarOriginacaoFgts`**

Colocar perto de `handlerCapturaDadosFgts` (linha ~977 hoje):

```js
// Ponto de entrada único pras 3 origens que coletam CPF pra FGTS (menu padrão, Instagram —
// que converge pro mesmo handlerCapturaDadosFgts —, e o fluxo do anúncio). Se já existir uma
// solicitação aberta pra esse contato, não abre outra (ver Review Focus do plano) — só confirma
// que já está em andamento.
async function iniciarOriginacaoFgts(de, businessNumberId, cpf) {
  const existente = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  if (existente) {
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Você já tem uma simulação em andamento — já já eu te aviso por aqui assim que tiver novidade. 😊"
    );
    return;
  }
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Já estou consultando seu FGTS, isso leva só um minutinho ⏳");
  try {
    const idempotencyKey = crypto.randomUUID();
    const app = await unnotech.criarSolicitacao(cpf, idempotencyKey);
    await db.fgtsOriginationCriar(de, businessNumberId, app.application_id, cpf, idempotencyKey);
  } catch (err) {
    console.error("Erro ao abrir solicitação FGTS na Unnotech:", err.message);
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}
```

- [ ] **Step 3: Garantir que `crypto` está importado**

No topo de `server.js`, confirmar se já existe `const crypto = require("crypto");` — se não
existir, adicionar perto dos outros `require` nativos (`https`, `fs`, `path`).

- [ ] **Step 4: Trocar o corpo de `handlerCapturaDadosFgts` (menu padrão + Instagram, que converge aqui)**

Hoje essa função termina chamando `confirmarDadosRecebidos` só com o CPF. Trocar pra chamar
`iniciarOriginacaoFgts` no lugar, extraindo o CPF com `REGEX_CPF`:

```js
async function handlerCapturaDadosFgts(de, businessNumberId, corpo) {
  const cpf = (corpo.match(REGEX_CPF) || [])[0]?.replace(/\D/g, "");
  if (!cpf) return;
  logFunil(businessNumberId, de, "fgts_dados_completos");
  await db.setFluxoPasso(de, businessNumberId, null);
  await iniciarOriginacaoFgts(de, businessNumberId, cpf);
}
```

(Mantém o mesmo `logFunil` que já existia, se já existir uma chamada assim no código atual —
conferir a versão presente da função antes de substituir, ela pode ter uma linha de log que
precisa ser preservada.)

- [ ] **Step 5: Trocar `handlerFgtsAnuncioCapturaCpf` (fluxo do anúncio) do mesmo jeito**

```js
async function handlerFgtsAnuncioCapturaCpf(de, businessNumberId, corpo) {
  const cpf = (corpo.match(REGEX_CPF) || [])[0]?.replace(/\D/g, "");
  if (!cpf) return;
  await db.setFluxoPasso(de, businessNumberId, null);
  await iniciarOriginacaoFgts(de, businessNumberId, cpf);
}
```

Isso substitui o `FGTSAD_TEXTO_CONFIRMACAO` ("Agora é só aguardar o atendimento, por favor.")
que existia antes — a mensagem nova de `iniciarOriginacaoFgts` toma esse lugar.

- [ ] **Step 6: Verificar sintaxe**

Run: `node --check server.js`

- [ ] **Step 7: Testar localmente com credencial real (ou só validar que não quebra sem credencial)**

```bash
TURSO_DATABASE_URL="file:./scratch-test.db" PORT=3991 PAINEL_USER=teste PAINEL_PASS=teste123 \
  PHONE_NUMBERS_JSON='[{"id":"1265497659990803","label":"Felizcred (principal)"}]' \
  UNNOTECH_CLIENT_ID="..." UNNOTECH_CLIENT_SECRET="..." \
  node server.js &
sleep 2
curl -s -u teste:teste123 -X POST -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{
    "metadata":{"phone_number_id":"1265497659990803"},
    "contacts":[{"wa_id":"5547999999999","profile":{"name":"Teste"}}],
    "messages":[{"from":"5547999999999","id":"wamid.teste1","timestamp":"1700000000","type":"text","text":{"body":"05847307993"}}]
  }}]}]}' http://localhost:3991/webhook
kill %1
rm -f scratch-test.db
```

Expected: sem erro 500; nos logs do servidor deve aparecer a tentativa de abrir solicitação
(ou o erro de credencial, se ainda não tiver uma real — nesse caso confirma que cai no
`confirmarEncaminhamentoHumano` sem travar o processo).

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "FGTS/Unnotech: liga as 3 entradas de FGTS pra abrir solicitacao na Unnotech"
```

---

## Task 7: Verificador — detectar oferta disponível ou sem oferta

**Files:**
- Modify: `server.js` (novo `setInterval`, perto do verificador de broadcast; novo `processarEtapaAbrindo`)

**Interfaces:**
- Consumes: `db.fgtsOriginationListarAbertas`, `db.fgtsOriginationAtualizar`, `unnotech.consultarStatus`, `unnotech.consultarSolicitacaoCompleta`, `unnotech.filtrarOfertaJ17`, `unnotech.classificarRecusa`
- Produces: mensagens ao cliente quando a etapa muda

- [ ] **Step 1: Textos de recusa**

Perto das outras constantes de texto do FGTS:

```js
const FGTSORIG_TEXTO_SEM_OFERTA = {
  autorizacao:
    "Não encontrei oferta disponível agora — provavelmente falta autorizar a J17 no app Meu " +
    "FGTS (Autorizações). Autoriza lá e manda 'menu' que eu tento de novo.",
  sem_saldo:
    "Pelo que vi, você já usou o saque-aniversário nos últimos 12 meses — a regra só permite " +
    "1 vez nesse período. Pode tentar de novo depois desse prazo.",
  desconhecido:
    "No momento não encontrei condições disponíveis pro seu FGTS. Se quiser, tenta de novo " +
    "mais tarde.",
};
```

- [ ] **Step 2: Função que processa a etapa "abrindo"**

```js
// Chamada pelo verificador (Step 3) pra cada linha em etapa 'abrindo'. Consulta o status; se
// tiver oferta J17, apresenta valor/condições; se não tiver (ou só de outro banco), classifica
// o motivo e avisa o cliente, fechando a solicitação.
async function processarEtapaAbrindo(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (status.status === "OFFERS_AVAILABLE") {
    const completa = await unnotech.consultarSolicitacaoCompleta(row.application_id);
    const oferta = unnotech.filtrarOfertaJ17(completa.offers);
    if (!oferta) {
      await finalizarSemOferta(row, completa);
      return;
    }
    const parcela = oferta.installments?.[0]?.amount;
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      `Simulação pronta! 🎉 Você tem *R$ ${oferta.net_amount.toFixed(2)}* liberado, em ` +
        `${oferta.installments?.length || 0}x de R$ ${parcela ? parcela.toFixed(2) : "-"}, taxa de ` +
        `${oferta.monthly_interest_rate}% ao mês. Quer contratar?`,
      [
        { id: "fgtsorig_contratar", title: "QUERO CONTRATAR" },
        { id: "fgtsorig_agora_nao", title: "AGORA NÃO" },
      ]
    );
    await db.fgtsOriginationAtualizar(row.id, {
      etapa: "oferta_apresentada",
      offer_id: oferta.offer_id,
      status_unnotech: status.status,
    });
    await db.setFluxoPasso(row.phone, row.business_number_id, "fgtsorig_oferta_apresentada");
  } else if (status.status === "NO_OFFERS" || status.status === "EXPIRED") {
    const completa = await unnotech.consultarSolicitacaoCompleta(row.application_id);
    await finalizarSemOferta(row, completa);
  } else {
    // Ainda QUOTING (ou outro estado intermediário) — só atualiza o status guardado, o
    // verificador tenta de novo no próximo ciclo.
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}

async function finalizarSemOferta(row, completa) {
  const motivoTexto =
    completa.quotes?.find((q) => q.reason)?.reason ||
    completa.offers?.find((o) => o.rejection_reason)?.rejection_reason?.message ||
    "";
  const categoria = unnotech.classificarRecusa(motivoTexto);
  await enviarRespostaAutomatica(row.business_number_id, row.phone, FGTSORIG_TEXTO_SEM_OFERTA[categoria]);
  await db.fgtsOriginationAtualizar(row.id, { etapa: "sem_oferta" });
  await db.setFluxoPasso(row.phone, row.business_number_id, null);
}
```

- [ ] **Step 3: O verificador (`setInterval`)**

Perto do verificador de broadcast intercalado (`setInterval(... , 20 * 1000)`):

```js
// ─── VERIFICADOR DE ORIGINAÇÃO FGTS (Unnotech) ──────────────────────────────
// A cada 30s: consulta o status de cada solicitação aberta e avança a conversa quando o estado
// mudar de um jeito que importa. Todo o estado fica no banco (fgts_origination), não em
// memória — sobrevive a redeploy/reinício no meio de uma solicitação (ver Review Focus).
setInterval(async () => {
  try {
    const abertas = await db.fgtsOriginationListarAbertas();
    for (const row of abertas) {
      try {
        if (row.etapa === "abrindo") await processarEtapaAbrindo(row);
        // Etapas seguintes (aguardando_assinatura, aguardando_pagamento) entram na Task 10.
      } catch (err) {
        console.error(`Erro ao processar originação FGTS #${row.id} (etapa ${row.etapa}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de originação FGTS:", err.message);
  }
}, 30 * 1000);
```

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check server.js`

- [ ] **Step 5: Testar isoladamente com uma linha fake no banco local**

```bash
TURSO_DATABASE_URL="file:./scratch-test.db" node -e "
const db = require('./db.js');
(async () => {
  await db.fgtsOriginationCriar('5547999999999', '1265497659990803', 'app_fake_sem_credencial', 'idem1');
  console.log('linha criada, rode o server.js com essa env var e veja o verificador tentar processar (vai falhar na consulta sem credencial real, e é isso que confirma que o loop está rodando e tratando erro sem travar)');
  process.exit(0);
})();
"
rm -f scratch-test.db
```

Expected: confirma que a lógica está no lugar certo; teste completo (oferta de verdade
aparecendo) só é possível com `client_id`/`client_secret` reais e um CPF de teste.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "FGTS/Unnotech: verificador detecta oferta J17 disponivel ou sem oferta"
```

---

## Task 8: Botões QUERO CONTRATAR / AGORA NÃO

**Files:**
- Modify: `server.js` (registrar os ids `fgtsorig_contratar`/`fgtsorig_agora_nao` no roteamento de botão)

**Interfaces:**
- Consumes: os `id`s de botão mandados na Task 7
- Produces: `handlerFgtsOrigContratar`, entrada `fgtsorig_agora_nao` como resposta estática

- [ ] **Step 1: Localizar onde os cliques de botão interativo são roteados**

Em `processarEntry`, blocos `tipo === "interactive"` usam `fluxo.fluxoBotoes[reply.id]`. Como o
fluxo ativo pra esse contato nesse momento é `FLUXO_FELIZCRED` (fluxo padrão, é onde `fgts_cpf`
já vive), os novos botões entram no `FLUXO_BOTOES` desse fluxo — localizar a constante que
`FLUXO_FELIZCRED.fluxoBotoes` referencia e adicionar as duas entradas novas nela.

- [ ] **Step 2: Handler de "QUERO CONTRATAR" (placeholder até a Task 9 ter o Flow pronto)**

```js
// Envia o WhatsApp Flow de coleta de dados (implementado de verdade na Task 9 — aqui só
// prepara o estado; se essa task rodar antes da 9, o Flow ainda não existe e a chamada abaixo
// fica marcada c/ TODO explícito removido assim que a Task 9 acontecer no mesmo PR/branch).
async function handlerFgtsOrigContratar(de, businessNumberId) {
  const row = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  if (!row) return; // sem solicitação aberta, ignora clique órfão
  await enviarFormularioFgts(de, businessNumberId, row); // definida na Task 9
  await db.fgtsOriginationAtualizar(row.id, { etapa: "formulario" });
  await db.setFluxoPasso(de, businessNumberId, "fgtsorig_formulario");
}
```

- [ ] **Step 3: Registrar no `FLUXO_BOTOES` do fluxo padrão**

```js
  fgtsorig_contratar: handlerFgtsOrigContratar,
  fgtsorig_agora_nao: { texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia." },
```

(Ao adicionar `fgtsorig_agora_nao` como objeto `{texto}` em vez de função, o roteador padrão já
limpa o `fluxo_passo` sozinho — mesmo comportamento de outros botões "não" desse arquivo. Também
marcar a linha de `fgts_origination` correspondente como encerrada: adicionar, logo depois do
registro do botão OU dentro de um handler dedicado se o padrão `{texto}` não permitir side-effect
— nesse caso, usar uma função em vez do objeto:)

```js
async function handlerFgtsOrigAgoraNao(de, businessNumberId) {
  const row = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  await enviarRespostaAutomatica(businessNumberId, de, "Sem problemas! 😊 Fico à disposição se mudar de ideia.");
  await db.setFluxoPasso(de, businessNumberId, null);
  if (row) await db.fgtsOriginationAtualizar(row.id, { etapa: "sem_oferta" });
}
```

E trocar o registro pra `fgtsorig_agora_nao: handlerFgtsOrigAgoraNao,`.

- [ ] **Step 4: Verificar sintaxe**

Run: `node --check server.js`
Expected: vai falhar aqui porque `enviarFormularioFgts` ainda não existe — **esperado**, essa
task e a Task 9 devem ser implementadas juntas antes de rodar esse check com sucesso. Se estiver
executando task por task com revisão entre elas, deixe uma versão mínima de
`enviarFormularioFgts` só de placeholder testável:

```js
async function enviarFormularioFgts(de, businessNumberId, row) {
  await enviarRespostaAutomatica(businessNumberId, de, "(placeholder — Flow chega na próxima tarefa)");
}
```

E substituir pela versão real na Task 9.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "FGTS/Unnotech: botoes QUERO CONTRATAR / AGORA NAO"
```

---

## Task 9: WhatsApp Flow estático (sem autopreenchimento de CEP) — criar, registrar, enviar

**Files:**
- Create: `flows/fgts-cadastro.json` (definição do Flow)
- Modify: `whatsapp.js` (nova função `sendFlow`)
- Modify: `server.js` (`enviarFormularioFgts` de verdade, substituindo o placeholder da Task 8)

**Interfaces:**
- Consumes: `process.env.FGTS_FLOW_ID`
- Produces: `wa.sendFlow(fromPhoneNumberId, to, opts) → Promise<object>`

- [ ] **Step 1: Escrever o `flow_json`**

```json
{
  "version": "3.1",
  "screens": [
    {
      "id": "DADOS_PESSOAIS",
      "title": "Dados pessoais",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "form_dados",
            "children": [
              { "type": "TextInput", "name": "nome", "label": "Nome completo", "required": true },
              { "type": "DatePicker", "name": "data_nascimento", "label": "Data de nascimento", "required": true },
              {
                "type": "Dropdown", "name": "genero", "label": "Gênero", "required": true,
                "data-source": [
                  { "id": "MALE", "title": "Masculino" },
                  { "id": "FEMALE", "title": "Feminino" },
                  { "id": "OTHER", "title": "Outro" }
                ]
              },
              { "type": "TextInput", "name": "email", "label": "E-mail", "input-type": "email", "required": true },
              { "type": "TextInput", "name": "celular", "label": "Celular (DDD + número)", "input-type": "phone", "required": true },
              {
                "type": "Dropdown", "name": "estado_civil", "label": "Estado civil", "required": true,
                "init-value": "SINGLE",
                "data-source": [
                  { "id": "SINGLE", "title": "Solteiro(a)" },
                  { "id": "MARRIED", "title": "Casado(a)" },
                  { "id": "DIVORCED", "title": "Divorciado(a)" },
                  { "id": "WIDOWED", "title": "Viúvo(a)" },
                  { "id": "SEPARATED", "title": "Separado(a)" },
                  { "id": "OTHER", "title": "Outro" }
                ]
              },
              {
                "type": "Dropdown", "name": "escolaridade", "label": "Escolaridade", "required": true,
                "init-value": "Ensino Médio",
                "data-source": [
                  { "id": "Fundamental", "title": "Ensino Fundamental" },
                  { "id": "Ensino Médio", "title": "Ensino Médio" },
                  { "id": "Superior", "title": "Ensino Superior" },
                  { "id": "Pós-graduação", "title": "Pós-graduação" }
                ]
              },
              { "type": "TextInput", "name": "nome_mae", "label": "Nome completo da mãe", "required": true },
              {
                "type": "Footer", "label": "Continuar",
                "on-click-action": { "name": "navigate", "next": { "type": "screen", "name": "DOCUMENTO" }, "payload": {} }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "DOCUMENTO",
      "title": "Documento (RG)",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form", "name": "form_documento",
            "children": [
              { "type": "TextInput", "name": "rg_numero", "label": "Número do RG", "required": true },
              {
                "type": "Dropdown", "name": "rg_orgao", "label": "Órgão emissor", "required": true,
                "init-value": "SSP",
                "data-source": [
                  { "id": "SSP", "title": "SSP" },
                  { "id": "DETRAN", "title": "DETRAN" },
                  { "id": "PC", "title": "Polícia Civil" },
                  { "id": "IFP", "title": "IFP" }
                ]
              },
              {
                "type": "Dropdown", "name": "rg_uf", "label": "Estado emissor", "required": true,
                "data-source": [
                  { "id": "AC", "title": "AC" }, { "id": "AL", "title": "AL" }, { "id": "AM", "title": "AM" },
                  { "id": "AP", "title": "AP" }, { "id": "BA", "title": "BA" }, { "id": "CE", "title": "CE" },
                  { "id": "DF", "title": "DF" }, { "id": "ES", "title": "ES" }, { "id": "GO", "title": "GO" },
                  { "id": "MA", "title": "MA" }, { "id": "MG", "title": "MG" }, { "id": "MS", "title": "MS" },
                  { "id": "MT", "title": "MT" }, { "id": "PA", "title": "PA" }, { "id": "PB", "title": "PB" },
                  { "id": "PE", "title": "PE" }, { "id": "PI", "title": "PI" }, { "id": "PR", "title": "PR" },
                  { "id": "RJ", "title": "RJ" }, { "id": "RN", "title": "RN" }, { "id": "RO", "title": "RO" },
                  { "id": "RR", "title": "RR" }, { "id": "RS", "title": "RS" }, { "id": "SC", "title": "SC" },
                  { "id": "SE", "title": "SE" }, { "id": "SP", "title": "SP" }, { "id": "TO", "title": "TO" }
                ]
              },
              {
                "type": "Footer", "label": "Continuar",
                "on-click-action": { "name": "navigate", "next": { "type": "screen", "name": "ENDERECO" }, "payload": {} }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "ENDERECO",
      "title": "Endereço",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form", "name": "form_endereco",
            "children": [
              { "type": "TextInput", "name": "cep", "label": "CEP", "required": true },
              { "type": "TextInput", "name": "rua", "label": "Rua/Logradouro", "required": true },
              { "type": "TextInput", "name": "bairro", "label": "Bairro", "required": true },
              { "type": "TextInput", "name": "cidade", "label": "Cidade", "required": true },
              {
                "type": "Dropdown", "name": "uf", "label": "Estado", "required": true,
                "data-source": [
                  { "id": "AC", "title": "AC" }, { "id": "AL", "title": "AL" }, { "id": "AM", "title": "AM" },
                  { "id": "AP", "title": "AP" }, { "id": "BA", "title": "BA" }, { "id": "CE", "title": "CE" },
                  { "id": "DF", "title": "DF" }, { "id": "ES", "title": "ES" }, { "id": "GO", "title": "GO" },
                  { "id": "MA", "title": "MA" }, { "id": "MG", "title": "MG" }, { "id": "MS", "title": "MS" },
                  { "id": "MT", "title": "MT" }, { "id": "PA", "title": "PA" }, { "id": "PB", "title": "PB" },
                  { "id": "PE", "title": "PE" }, { "id": "PI", "title": "PI" }, { "id": "PR", "title": "PR" },
                  { "id": "RJ", "title": "RJ" }, { "id": "RN", "title": "RN" }, { "id": "RO", "title": "RO" },
                  { "id": "RR", "title": "RR" }, { "id": "RS", "title": "RS" }, { "id": "SC", "title": "SC" },
                  { "id": "SE", "title": "SE" }, { "id": "SP", "title": "SP" }, { "id": "TO", "title": "TO" }
                ]
              },
              { "type": "TextInput", "name": "numero", "label": "Número", "required": true },
              { "type": "TextInput", "name": "complemento", "label": "Complemento (opcional)", "required": false },
              {
                "type": "Footer", "label": "Continuar",
                "on-click-action": { "name": "navigate", "next": { "type": "screen", "name": "DESEMBOLSO" }, "payload": {} }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "DESEMBOLSO",
      "title": "Como receber",
      "terminal": true,
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form", "name": "form_desembolso",
            "children": [
              {
                "type": "RadioButtonsGroup", "name": "forma_desembolso", "label": "Como você quer receber o valor?",
                "required": true,
                "data-source": [
                  { "id": "PIX", "title": "PIX (com a chave do seu CPF)" },
                  { "id": "CONTA", "title": "Conta bancária" }
                ]
              },
              {
                "type": "Dropdown", "name": "banco", "label": "Banco", "required": false,
                "visible": "${form.forma_desembolso} == 'CONTA'",
                "data-source": [
                  { "id": "Banco do Brasil", "title": "Banco do Brasil" },
                  { "id": "Santander", "title": "Santander" },
                  { "id": "Caixa Econômica Federal", "title": "Caixa Econômica Federal" },
                  { "id": "Bradesco", "title": "Bradesco" },
                  { "id": "Itaú", "title": "Itaú" },
                  { "id": "Nubank", "title": "Nubank" },
                  { "id": "Inter", "title": "Inter" },
                  { "id": "C6 Bank", "title": "C6 Bank" },
                  { "id": "PagBank", "title": "PagBank" },
                  { "id": "Mercado Pago", "title": "Mercado Pago" },
                  { "id": "PicPay", "title": "PicPay" },
                  { "id": "Banco Original", "title": "Banco Original" },
                  { "id": "Sicoob", "title": "Sicoob" },
                  { "id": "Sicredi", "title": "Sicredi" },
                  { "id": "Safra", "title": "Safra" },
                  { "id": "BTG Pactual", "title": "BTG Pactual" }
                ]
              },
              {
                "type": "Dropdown", "name": "tipo_conta", "label": "Tipo de conta", "required": false,
                "visible": "${form.forma_desembolso} == 'CONTA'",
                "data-source": [
                  { "id": "Corrente", "title": "Corrente" },
                  { "id": "Poupança", "title": "Poupança" },
                  { "id": "Salário", "title": "Salário" }
                ]
              },
              { "type": "TextInput", "name": "agencia", "label": "Agência", "required": false, "visible": "${form.forma_desembolso} == 'CONTA'" },
              { "type": "TextInput", "name": "conta", "label": "Número da conta", "required": false, "visible": "${form.forma_desembolso} == 'CONTA'" },
              { "type": "TextInput", "name": "digito_conta", "label": "Dígito da conta", "required": false, "visible": "${form.forma_desembolso} == 'CONTA'" },
              {
                "type": "Footer", "label": "Enviar",
                "on-click-action": { "name": "complete", "payload": {} }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**Nota de implementação:** a sintaxe exata de `visible`/condicionais e de `data-source` pode
mudar ligeiramente entre versões do Flow JSON — antes de publicar, colar esse JSON no **Flow
Builder** (WhatsApp Manager → Flows → Criar Flow → modo código) e corrigir o que o validador
apontar. É esperado precisar de pequenos ajustes ali — o validador é a fonte de verdade, não
esse arquivo.

- [ ] **Step 2: Registrar o Flow na Meta (manual, uma vez)**

No WhatsApp Manager → Flows → Criar Flow → colar o JSON acima → Publicar. Copiar o `Flow ID`
gerado e configurar como variável de ambiente `FGTS_FLOW_ID` no Render.

- [ ] **Step 3: `sendFlow` em `whatsapp.js`**

Perto das outras funções `send*`:

```js
async function sendFlow(fromPhoneNumberId, to, { flowId, flowToken, bodyText, ctaText, screenId }) {
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
          type: "flow",
          body: { text: bodyText },
          action: {
            name: "flow",
            parameters: {
              flow_message_version: "3",
              flow_token: flowToken,
              flow_id: flowId,
              flow_cta: ctaText,
              flow_action: "navigate",
              flow_action_payload: { screen: screenId, data: {} },
            },
          },
        },
      },
    }
  );
  const json = JSON.parse(buffer.toString("utf8") || "{}");
  if (status >= 400) throw new Error(`Falha ao enviar Flow: ${JSON.stringify(json)}`);
  return json;
}
```

Adicionar `sendFlow,` ao `module.exports` de `whatsapp.js`.

- [ ] **Step 4: `enviarFormularioFgts` de verdade em `server.js`** (substitui o placeholder da Task 8)

```js
async function enviarFormularioFgts(de, businessNumberId, row) {
  await wa.sendFlow(businessNumberId, de, {
    flowId: process.env.FGTS_FLOW_ID,
    flowToken: `fgtsorig_${row.id}`,
    bodyText: "Show! Só preciso de mais alguns dados pra fechar a contratação. Toca no botão abaixo:",
    ctaText: "Preencher dados",
    screenId: "DADOS_PESSOAIS",
  });
}
```

- [ ] **Step 5: Verificar sintaxe**

Run: `node --check server.js && node --check whatsapp.js`

- [ ] **Step 6: Testar o envio (com `FGTS_FLOW_ID` real já publicado)**

```bash
curl -s -m 60 -u admin:admin -X POST -H "Content-Type: application/json" \
  -d '{"template":"boa_tarde","language":"pt_BR","contacts":[{"phone":"SEU_NUMERO_TESTE"}]}' \
  https://meuwhats.onrender.com/painel/api/broadcast/1265497659990803
```

(esse curl é só um exemplo de como confirmar que o número de teste está acessível — o teste real
do Flow em si é abrir uma simulação de verdade pelo WhatsApp no celular, chegar na etapa
"QUERO CONTRATAR" e ver o formulário nativo abrir corretamente, com os 3 campos pré-preenchidos
e os campos de conta bancária aparecendo só quando "Conta bancária" é escolhido.)

- [ ] **Step 7: Commit**

```bash
git add flows/fgts-cadastro.json whatsapp.js server.js
git commit -m "FGTS/Unnotech: WhatsApp Flow estatico de coleta de dados (sem autopreenchimento de CEP)"
```

---

## Task 10: Receber a submissão do Flow → montar KYC → enviar → aceitar oferta

**Files:**
- Modify: `server.js` (tratar `msg.interactive.nfm_reply` no roteamento de mensagens recebidas)

**Interfaces:**
- Consumes: `unnotech.montarPayloadKyc`, `unnotech.enviarKyc`, `unnotech.aceitarOferta`, `db.fgtsOriginationBuscarPorId`

- [ ] **Step 1: Detectar a submissão do Flow no webhook**

Em `processarEntry`, dentro do bloco `tipo === "interactive"`, antes do tratamento de
`button_reply`/`list_reply` existente, adicionar a checagem de `nfm_reply` (é como a Meta manda
a resposta de um Flow **estático**, sem endpoint, direto no webhook normal — diferente do Flow
com endpoint da Task 13, que responde por outro caminho):

```js
if (msg.interactive?.nfm_reply) {
  const dados = JSON.parse(msg.interactive.nfm_reply.response_json);
  const flowToken = msg.interactive.nfm_reply.flow_token || "";
  const originationId = Number(flowToken.replace("fgtsorig_", ""));
  await db.insertMessage({ ...base, type: "button", body: "[formulário FGTS preenchido]" });
  if (originationId) {
    try {
      await processarSubmissaoFormularioFgts(originationId, dados);
    } catch (err) {
      console.error("Erro ao processar formulário FGTS:", err.message);
    }
  }
  continue; // não passa pelo roteamento normal de botão/lista
}
```

(Ajustar a sintaxe do `continue`/estrutura de laço conforme o formato real do `for` em
`processarEntry` — o objetivo é: tratado esse caso, pular o resto do processamento de mensagem
pra essa iteração, do mesmo jeito que `mensagemJaTratada = true` faz nos outros branches.)

- [ ] **Step 2: `processarSubmissaoFormularioFgts`**

```js
async function processarSubmissaoFormularioFgts(originationId, dados) {
  const row = await db.fgtsOriginationBuscarPorId(originationId);
  if (!row || row.etapa !== "formulario") return; // submissão órfã/duplicada, ignora
  const kyc = unnotech.montarPayloadKyc(row.cpf, dados);
  await unnotech.enviarKyc(row.application_id, kyc);
  const idempotencyKey = crypto.randomUUID();
  try {
    await unnotech.aceitarOferta(row.application_id, row.offer_id, idempotencyKey);
  } catch (err) {
    if (err.codigo === "OFFER_EXPIRED") {
      await unnotech.requotar(row.application_id, crypto.randomUUID());
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "A oferta expirou enquanto você preenchia — já busquei uma nova simulação, só um instante..."
      );
      await db.fgtsOriginationAtualizar(row.id, { etapa: "abrindo", offer_id: null, idempotency_key_atual: idempotencyKey });
      return;
    }
    throw err;
  }
  await enviarRespostaAutomatica(row.business_number_id, row.phone, "Perfeito, só um instante que já preparo seu contrato...");
  await db.fgtsOriginationAtualizar(row.id, { etapa: "aguardando_assinatura", idempotency_key_atual: idempotencyKey });
}
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check server.js`

- [ ] **Step 4: Testar a montagem ponta a ponta com um payload de Flow simulado**

```bash
node -e "
const unnotech = require('./unnotech.js');
const dadosFlow = {
  nome: 'Maria Souza', data_nascimento: '1988-04-17', genero: 'FEMALE', email: 'maria@ex.com',
  celular: '47999998888', estado_civil: 'SINGLE', escolaridade: 'Ensino Médio', nome_mae: 'Joana',
  rg_numero: '123456789', rg_orgao: 'SSP', rg_uf: 'SC',
  cep: '88000000', rua: 'Rua X', bairro: 'Centro', cidade: 'Florianópolis', uf: 'SC', numero: '10',
  forma_desembolso: 'PIX',
};
console.log(JSON.stringify(unnotech.montarPayloadKyc('12345678909', dadosFlow), null, 2));
"
```

Expected: JSON válido no formato `FgtsKyc` esperado pela Unnotech, com `bank.pix_key ===
"12345678909"`.

- [ ] **Step 5: Commit**

```bash
git add db.js server.js unnotech.js
git commit -m "FGTS/Unnotech: recebe submissao do Flow, envia KYC e aceita a oferta"
```

---

## Task 11: Verificador — assinatura e pagamento

**Files:**
- Modify: `server.js` (`processarEtapaAguardandoAssinatura`, `processarEtapaAguardandoPagamento`, ligar no `setInterval` da Task 7)

**Interfaces:**
- Consumes: `unnotech.consultarProposta`, `unnotech.consultarStatus`

- [ ] **Step 1: Processar a etapa "aguardando_assinatura"**

```js
// Depois do aceite, o proposal_uuid pode demorar um pouco pra aparecer no status — só busca a
// proposta quando ele já estiver lá. Manda o botão de assinatura assim que o signature_link
// vier preenchido (só 1 vez — controla isso checando se já tinha proposal_uuid salvo antes).
async function processarEtapaAguardandoAssinatura(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (!status.proposal_uuid) {
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
    return;
  }
  const jaTinhaProposta = Boolean(row.proposal_uuid);
  if (!jaTinhaProposta) {
    await db.fgtsOriginationAtualizar(row.id, { proposal_uuid: status.proposal_uuid, status_unnotech: status.status });
  }
  if (status.status === "SIGNED" || status.status === "ENDORSED") {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Contrato assinado! 🎉 Agora é só aguardar o depósito — te aviso assim que cair na sua conta."
    );
    await db.fgtsOriginationAtualizar(row.id, { etapa: "aguardando_pagamento", status_unnotech: status.status });
    return;
  }
  if (["CONTRACT_REJECTED", "FAILED", "REJECTED", "CANCELLED"].includes(status.status)) {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Tivemos um problema pra finalizar essa contratação. Vou te colocar com um atendente pra ver o que aconteceu."
    );
    await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    await db.fgtsOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    return;
  }
  const proposta = await unnotech.consultarProposta(status.proposal_uuid);
  if (proposta.signature_link && !jaTinhaProposta) {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Seu contrato está pronto! ✍️ Assim que você assinar, eu te aviso por aqui."
    );
    await enviarRespostaAutomatica(row.business_number_id, row.phone, null, null, null, {
      buttonText: "Assinar contrato",
      url: proposta.signature_link,
    });
  }
}

async function processarEtapaAguardandoPagamento(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (status.status === "DISBURSED") {
    await enviarRespostaAutomatica(row.business_number_id, row.phone, "O valor já caiu! 💰 Qualquer coisa, é só me chamar.");
    await db.fgtsOriginationAtualizar(row.id, { etapa: "concluido", status_unnotech: status.status });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
  } else {
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}
```

- [ ] **Step 2: Ligar as duas funções no `setInterval` da Task 7**

```js
        if (row.etapa === "abrindo") await processarEtapaAbrindo(row);
        else if (row.etapa === "aguardando_assinatura") await processarEtapaAguardandoAssinatura(row);
        else if (row.etapa === "aguardando_pagamento") await processarEtapaAguardandoPagamento(row);
```

- [ ] **Step 3: Verificar sintaxe**

Run: `node --check server.js`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "FGTS/Unnotech: verificador acompanha assinatura e pagamento ate DISBURSED"
```

---

## Task 12: Credenciais no Render + checklist de segurança

**Files:**
- Modify: `README.md` (documentar as variáveis novas, sem valores)

**Interfaces:** nenhuma nova — task de configuração/documentação.

- [ ] **Step 1: Adicionar no Render → Environment**

`UNNOTECH_CLIENT_ID`, `UNNOTECH_CLIENT_SECRET`, `FGTS_FLOW_ID` (o gerado na Task 9).

- [ ] **Step 2: Documentar no README (sem valores, mesma regra de sempre)**

Adicionar uma linha na tabela de variáveis de ambiente e uma seção curta explicando o que cada
uma é e onde foi gerada (Unnotech → Configurações → Integrações → API keys; Meta WhatsApp
Manager → Flows).

- [ ] **Step 3: Conferir que nada sensível foi commitado**

Run: `git log --all -p -- unnotech.js server.js | grep -iE "client_secret|UNNOTECH_CLIENT" | grep -v "process.env\|UNNOTECH_CLIENT_ID\"\\|UNNOTECH_CLIENT_SECRET\""`
Expected: nenhuma linha com um valor de credencial de verdade, só referências a
`process.env.UNNOTECH_CLIENT_ID`/`SECRET`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "FGTS/Unnotech: documenta variaveis de ambiente novas"
```

---

## Task 13 (fase 5, por último): Flow dinâmico com autopreenchimento de CEP

**Files:**
- Create: `flow-crypto.js` (criptografia RSA/AES do endpoint do Flow)
- Modify: `server.js` (nova rota `POST /webhook/flow-data`)
- Modify: `flows/fgts-cadastro.json` (tela ENDERECO passa a chamar o endpoint via `data_exchange`)

**Interfaces:**
- Produces: `flowCrypto.decrypt(encryptedFlowData, encryptedAesKey, iv) → {aesKeyBuffer, request}`
  `flowCrypto.encrypt(response, aesKeyBuffer, iv) → base64String`

**Esta é a peça de maior risco técnico do projeto** (primeira vez que esse código usa Flow com
endpoint). Fazer por último, com o resto já funcionando e testado com o Flow estático da Task 9.

- [ ] **Step 1: Gerar o par de chaves RSA (uma vez, local)**

```bash
openssl genrsa -out flow_private.pem 2048
openssl rsa -in flow_private.pem -pubout -out flow_public.pem
cat flow_public.pem
```

Guardar `flow_private.pem` como variável de ambiente `FGTS_FLOW_PRIVATE_KEY` no Render (o
conteúdo do arquivo, como string, com as quebras de linha preservadas). Registrar a pública via
`POST /{PHONE_NUMBER_ID}/whatsapp_business_encryption` (Graph API), com o conteúdo de
`flow_public.pem` no campo `business_public_key`.

- [ ] **Step 2: `flow-crypto.js` — decriptar a requisição**

```js
// flow-crypto.js — criptografia híbrida RSA-OAEP + AES-128-GCM exigida pelo endpoint de dados
// de um WhatsApp Flow (ver docs da Meta: "Endpoint for Flows — Encryption"). Isolado num
// arquivo próprio por ser um protocolo bem específico, sem nada a ver com o resto do domínio.
const crypto = require("crypto");

function decrypt(encryptedFlowDataB64, encryptedAesKeyB64, ivB64) {
  const privateKey = crypto.createPrivateKey({
    key: process.env.FGTS_FLOW_PRIVATE_KEY,
    format: "pem",
  });
  const aesKey = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(encryptedAesKeyB64, "base64")
  );
  const flowDataBuffer = Buffer.from(encryptedFlowDataB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = flowDataBuffer.subarray(flowDataBuffer.length - 16);
  const cipherText = flowDataBuffer.subarray(0, flowDataBuffer.length - 16);
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return { aesKey, iv, request: JSON.parse(decrypted.toString("utf8")) };
}

// A resposta usa a MESMA chave AES, mas com todo byte do IV invertido (regra explícita da Meta,
// pra garantir que request/response nunca reusem o mesmo par chave+IV).
function encrypt(responseObj, aesKey, iv) {
  const ivInvertido = Buffer.from(iv.map((b) => b ^ 0xff));
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, ivInvertido);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(responseObj), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}

module.exports = { decrypt, encrypt };
```

- [ ] **Step 2b: Testar a decriptação/criptografia isoladas (ida e volta)**

```bash
node -e "
const crypto = require('crypto');
process.env.FGTS_FLOW_PRIVATE_KEY = require('fs').readFileSync('./flow_private.pem', 'utf8');
const publicKey = require('fs').readFileSync('./flow_public.pem', 'utf8');
const flowCrypto = require('./flow-crypto.js');

const aesKey = crypto.randomBytes(16);
const iv = crypto.randomBytes(16);
const requestObj = { version: '3.0', action: 'data_exchange', screen: 'ENDERECO', data: { cep: '88000000' }, flow_token: 'fgtsorig_1' };
const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
const encryptedData = Buffer.concat([cipher.update(JSON.stringify(requestObj), 'utf8'), cipher.final(), cipher.getAuthTag()]);
const encryptedAesKey = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey);

const { request, aesKey: aesKeyDecifrada, iv: ivDecifrado } = flowCrypto.decrypt(
  encryptedData.toString('base64'), encryptedAesKey.toString('base64'), iv.toString('base64')
);
console.log('Decriptado corretamente:', JSON.stringify(request) === JSON.stringify(requestObj));

const respostaObj = { screen: 'ENDERECO', data: { rua: 'Rua Teste', bairro: 'Centro', cidade: 'Floripa', uf: 'SC' } };
const respostaCriptografada = flowCrypto.encrypt(respostaObj, aesKeyDecifrada, ivDecifrado);
console.log('Resposta criptografada (base64, tamanho):', respostaCriptografada.length);
"
rm -f flow_private.pem flow_public.pem
```

Expected: `Decriptado corretamente: true`, e um tamanho de base64 > 0 na segunda linha.

- [ ] **Step 3: Rota do endpoint de dados**

Em `server.js`, uma rota nova que recebe `POST /webhook/flow-data` **sem** passar pela
autenticação Basic do painel (é a Meta chamando, não o navegador) — decripta, resolve o CEP via
ViaCEP quando `action === 'data_exchange'` e `screen === 'ENDERECO'`, responde criptografado:

```js
if (req.method === "POST" && path_ === "/webhook/flow-data") {
  const body = await parseBody(req);
  const { request, aesKey, iv } = flowCrypto.decrypt(body.encrypted_flow_data, body.encrypted_aes_key, body.initial_vector);
  let respostaPayload;
  if (request.action === "ping") {
    respostaPayload = { data: { status: "active" } };
  } else if (request.action === "data_exchange" && request.screen === "ENDERECO" && request.data?.cep) {
    const cepLimpo = String(request.data.cep).replace(/\D/g, "");
    try {
      const viaCepResp = await new Promise((resolve, reject) => {
        https.get(`https://viacep.com.br/ws/${cepLimpo}/json/`, (r) => {
          let buf = "";
          r.on("data", (c) => (buf += c));
          r.on("end", () => resolve(JSON.parse(buf)));
        }).on("error", reject);
      });
      respostaPayload = {
        screen: "ENDERECO",
        data: {
          rua: viaCepResp.logradouro || "",
          bairro: viaCepResp.bairro || "",
          cidade: viaCepResp.localidade || "",
          uf: viaCepResp.uf || "",
        },
      };
    } catch (err) {
      respostaPayload = { screen: "ENDERECO", data: { rua: "", bairro: "", cidade: "", uf: "" } };
    }
  } else {
    respostaPayload = { screen: request.screen, data: {} };
  }
  const respostaCriptografada = flowCrypto.encrypt(respostaPayload, aesKey, iv);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(respostaCriptografada);
  return;
}
```

(Adicionar `const flowCrypto = require("./flow-crypto");` no topo de `server.js`.)

- [ ] **Step 4: Atualizar o `flow_json`** (tela ENDERECO) pra chamar esse endpoint

Trocar a ação do campo `cep` (ou de um botão "Buscar endereço" na tela ENDERECO) de navegação
estática pra `data_exchange`, e registrar `https://meuwhats.onrender.com/webhook/flow-data` como
"Endpoint URI" do Flow no WhatsApp Manager. Os campos `rua`/`bairro`/`cidade`/`uf` passam a vir
preenchidos pela resposta do endpoint em vez de digitados — ajustar o JSON conforme o Flow
Builder pedir (a sintaxe exata de disparar `data_exchange` a partir de um campo tem que ser
conferida ali, é a fonte de verdade final).

- [ ] **Step 5: Verificar sintaxe**

Run: `node --check server.js && node --check flow-crypto.js`

- [ ] **Step 6: Testar de verdade no celular**

Abrir o Flow, chegar na tela de endereço, digitar um CEP real, confirmar que rua/bairro/
cidade/UF preenchem sozinhos.

- [ ] **Step 7: Commit**

```bash
git add flow-crypto.js server.js flows/fgts-cadastro.json
git commit -m "FGTS/Unnotech: autopreenchimento de CEP via endpoint criptografado do Flow"
```
