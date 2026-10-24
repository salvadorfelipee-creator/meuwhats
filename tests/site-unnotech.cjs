// Teste do adaptador da Unnotech no site (sem rede): simula a Unnotech e o banco em memória.
// Rodar: node tests/site-unnotech.cjs
const assert = require("assert");
process.env.UNNOTECH_CLIENT_ID = "x";
process.env.UNNOTECH_CLIENT_SECRET = "y";
const { criarAdaptador, selecionarOfertas } = require("../site-unnotech");

const futuro = new Date(Date.now() + 3600_000).toISOString();
const oferta = (id, prazo, liquido, parcela = 89.06) => ({ offer_id: id, status: "AVAILABLE", installment_count: prazo, net_amount: liquido, installment_amount: parcela, table_name: `T${id}`, expires_at: futuro });

// ── regra de apresentação ────────────────────────────────────────────────────
const menu = [oferta("a", 60, 1500), oferta("b", 60, 1568.1), oferta("c", 48, 1300), oferta("d", 24, 1000), oferta("e", 24, 1123.94)];
const sel = selecionarOfertas(menu);
assert.deepStrictEqual(sel.map((o) => o.offer_id), ["b", "e"], "maior prazo + 24x, melhor líquido de cada");
assert.deepStrictEqual(selecionarOfertas([oferta("x", 36, 900), oferta("y", 12, 500)]).map((o) => o.offer_id), ["x", "y"], "sem 24x usa o menor prazo");
assert.strictEqual(selecionarOfertas([oferta("x", 36, 900)]).length, 1, "um prazo só = uma opção");
assert.strictEqual(selecionarOfertas([{ ...oferta("z", 24, 800), status: "REJECTED" }]).length, 0, "recusadas não entram");

// ── comissão da Unnotech decide a tabela de cada prazo ──────────────────────
const tab = (id, prazo, liquido, nome, seguro) => ({ ...oferta(id, prazo, liquido), table_name: nome, insurance_included: seguro });
const comissao = selecionarOfertas([
  tab("j36", 36, 2000, "JURERÊ - COM SEGURO", true),        // 3,6% a 36x
  tab("b36", 36, 1800, "BÚZIOS - COM SEGURO", true),        // 9,6% a 25-36x → ganha mesmo com menos dinheiro
  tab("b24", 24, 1200, "BÚZIOS - COM SEGURO", true),        // 7,2% a 19-24x
  tab("i24", 24, 1500, "ITAPEMA - COM SEGURO", true),       // 4,25% a 24x
]);
assert.deepStrictEqual(comissao.map((o) => o.offer_id), ["b36", "b24"], "maior comissão manda em cada prazo");
assert.strictEqual(require("../site-unnotech").comissaoOferta(tab("x", 36, 1, "BÚZIOS - SEM SEGURO", false)), 3.6, "sem seguro 25-36x = 3,6%");
assert.strictEqual(require("../site-unnotech").comissaoOferta(tab("x", 50, 1, "OUTRA TABELA", false)), 0, "fora da lista = 0");

// ── nenhuma oferta com seguro, a não ser que não haja outra ─────────────────
const seg = (id, prazo, liquido, nome, comSeguro) => ({ ...oferta(id, prazo, liquido), table_name: nome, insurance_included: comSeguro, insurance_amount: comSeguro ? 50 : 0 });
const preferida = selecionarOfertas([seg("s60", 60, 2000, "BÚZIOS - COM SEGURO", true), seg("n36", 36, 1500, "BÚZIOS - SEM SEGURO", false), seg("n24", 24, 1100, "JURERÊ - SEM SEGURO", false)]);
assert.deepStrictEqual(preferida.map((o) => o.offer_id), ["n36", "n24"], "com seguro só entra se não houver nenhuma sem seguro");
assert.deepStrictEqual(selecionarOfertas([seg("s60", 60, 2000, "BÚZIOS - COM SEGURO", true), seg("s24", 24, 1000, "BÚZIOS - COM SEGURO", true)]).map((o) => o.offer_id), ["s60", "s24"], "sem alternativa, mostra as com seguro");

// ── fluxo ponta a ponta com Unnotech simulada ────────────────────────────────
let linha = { conversation_id: "c1", provider: "facta", cpf: "12345678909", phone: "47999990000", etapa: "sem_oferta", facta_worker_json: JSON.stringify({ nome: "Maria", dataNascimento: "01/02/1990" }) };
const mensagens = [];
const db = {
  siteChatCltAtualizar: async (_id, campos) => { linha = { ...linha, ...campos }; return linha; },
  siteChatFunilEvento: async () => {}, siteChatDefinirPipeline: async () => {},
};
const estado = { status: "AWAITING_AUTHORIZATION", authorization_status: "NOT_AUTHORIZED", quotes_pending: 1, proposal: null };
const chamadas = [];
const unnotech = {
  criarSolicitacaoClt: async (cpf, phone, email, _k, extras) => { chamadas.push(["criar", cpf, phone, email, extras]); return { application_id: "app-1", status: "AWAITING_AUTHORIZATION", authorization: { consent_url: "https://consent.test/x" } }; },
  consultarStatusClt: async () => ({ status: estado.status, authorization_status: estado.authorization_status, quotes_pending: estado.quotes_pending, proposal_uuid: estado.proposal }),
  consultarSolicitacaoCompletaClt: async () => ({ offers: menu, authorization: { consent_url: "https://consent.test/x" } }),
  consultarMargemClt: async () => ({ employments: [{ employment_id: "e1", employer_name: "ACME", available_margin: 89.06 }, { employment_id: "e2", available_margin: 10 }] }),
  simularClt: async (...a) => { chamadas.push(["simular", ...a.slice(0, 2)]); },
  montarPayloadKycClt: (cpf, d) => ({ cpf, nome: d.nome }), enviarKycClt: async () => {},
  aceitarOfertaClt: async (app, id) => { chamadas.push(["aceitar", app, id]); },
  consultarProposta: async () => ({ signature_link: "https://assinar.test/1" }),
  escolherMelhorOferta: (o, ja) => o.find((x) => !ja.includes(x.offer_id)) || null,
};
const avisos = [];
const unno = criarAdaptador({ db, unnotech, mensagemAtendente: async (_i, t) => mensagens.push(t), notificar: async (_r, etapa) => avisos.push(etapa) });

(async () => {
  const novo = await unno.iniciar(linha, { email: "m@x.com", name: "Maria Silva" }, { provider: "facta", etapa: "sem_oferta" });
  assert.strictEqual(novo.provider, "unnotech");
  assert.strictEqual(novo.terms_link, "https://consent.test/x");
  assert.deepStrictEqual(chamadas[0].slice(1, 4), ["12345678909", "47999990000", "m@x.com"]);
  assert.strictEqual(chamadas[0][4].birthDate, "1990-02-01", "nascimento da Facta vai como AAAA-MM-DD");

  // ainda sem autorização: fica esperando
  linha.authorization_checked_at = null;
  let r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "autorizacao_enviada");

  // autorizou → margem → simula no máximo do maior vínculo
  Object.assign(estado, { authorization_status: "AUTHORIZED", status: "AWAITING_SIMULATION" });
  linha.authorization_checked_at = null;
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "simulando");
  assert.strictEqual(Number(r.margem_disponivel), 89.06);
  assert.deepStrictEqual(chamadas.find((c) => c[0] === "simular")[2].employmentId, "e1");

  // cotação termina → ofertas
  Object.assign(estado, { status: "OFFERS_AVAILABLE", quotes_pending: 0 });
  linha.authorization_checked_at = null;
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "ofertas_disponiveis");

  // cliente escolhe e envia dados → aceite
  r = await unno.escolherOferta(linha, "b");
  assert.strictEqual(r.etapa, "dados_pessoais");
  await assert.rejects(() => unno.enviarDados(linha, { nome: "Maria" }), /campos obrigat/);
  const completos = { nome: "Maria", data_nascimento: "1990-02-01", genero: "FEMALE", estado_civil: "SINGLE", escolaridade: "Superior", nome_mae: "Ana", rg_numero: "1", rg_orgao: "SSP", rg_uf: "SC", cep: "88000000", rua: "R", numero: "1", bairro: "B", cidade: "C", uf: "SC", forma_desembolso: "PIX" };
  r = await unno.enviarDados(linha, completos);
  assert.strictEqual(r.etapa, "aguardando_assinatura_facta");
  assert.deepStrictEqual(chamadas.find((c) => c[0] === "aceitar").slice(1), ["app-1", "b"]);

  // contrato gerado → link de assinatura; depois assinado e pago
  estado.proposal = "abcdef12-0000"; estado.status = "CONTRACTING";
  linha.authorization_checked_at = null;
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.contract_link, "https://assinar.test/1");
  estado.status = "SIGNED"; linha.authorization_checked_at = null;
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "proposta_em_analise");
  estado.status = "DISBURSED"; linha.authorization_checked_at = null;
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "proposta_concluida");
  assert.deepStrictEqual(avisos, ["aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida"], "avisos de WhatsApp/e-mail em cada etapa");

  // sem margem encerra
  linha = { ...linha, etapa: "autorizacao_enviada", provider: "unnotech", authorization_checked_at: null };
  estado.status = "NO_MARGIN";
  r = await unno.sincronizar(linha);
  assert.strictEqual(r.etapa, "sem_margem");
  console.log("OK: adaptador da Unnotech passou em todos os cenários");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });

// ── FGTS: cotação, autorização nos bancos (no app do FGTS), oferta J17 e contratação ──────────────────────────
(async () => {
  let l = { conversation_id: "f1", provider: "facta", cpf: "12345678909", phone: "47999990000", etapa: "fgts_cotando" };
  const db2 = { siteChatCltAtualizar: async (_i, c) => { l = { ...l, ...c }; return l; }, siteChatFunilEvento: async () => {} };
  const st = { status: "QUOTING", quotes_pending: 1 };
  let completa = { offers: [], quotes: [] };
  const chamadas2 = [];
  const un = {
    criarSolicitacao: async () => ({ application_id: "fg-1", status: "QUOTING" }),
    consultarStatus: async () => ({ status: st.status, quotes_pending: st.quotes_pending, proposal_uuid: st.proposal }),
    consultarSolicitacaoCompleta: async () => completa,
    classificarRecusa: (t) => (String(t).toLowerCase().includes("autoriz") ? "autorizacao" : String(t).toLowerCase().includes("saldo") ? "sem_saldo" : "desconhecido"),
    requotar: async () => { chamadas2.push("requote"); },
    enviarKyc: async () => { chamadas2.push("kyc"); }, montarPayloadKyc: (cpf, d) => ({ cpf, nome: d.nome }),
    aceitarOferta: async (_a, id) => { chamadas2.push("aceitar:" + id); },
    consultarProposta: async () => ({ signature_link: "https://assinar.test/fgts" }),
    escolherMelhorOferta: () => null,
  };
  const fg = criarAdaptador({ db: db2, unnotech: un, mensagemAtendente: async () => {}, notificar: async () => {} });

  l = await fg.iniciarFgts(l, {});
  assert.strictEqual(l.etapa, "fgts_cotando");
  assert.ok(fg.ehFgts(l));

  // J17 recusou por falta de autorização → orienta autorizar os bancos no app
  Object.assign(st, { status: "NO_OFFERS", quotes_pending: 0 });
  completa = { offers: [], quotes: [{ source: "J17", reason: "Cliente não autorizou o banco no FGTS" }] };
  l.authorization_checked_at = null;
  l = await fg.sincronizar(l);
  assert.strictEqual(l.etapa, "fgts_autorizar");

  // "Já autorizei" → cota de novo → oferta da J17 (outras ignoradas)
  l = await fg.requotarFgts(l);
  assert.strictEqual(l.etapa, "fgts_cotando");
  Object.assign(st, { status: "OFFERS_AVAILABLE", quotes_pending: 0 });
  completa = { offers: [{ offer_id: "x", source: "OUTRO", status: "AVAILABLE", net_amount: 999 }, { offer_id: "j", source: "J17", status: "AVAILABLE", net_amount: 1200, installments: [{ amount: 300 }, { amount: 300 }], monthly_interest_rate: 1.79 }] };
  l.authorization_checked_at = null;
  l = await fg.sincronizar(l);
  assert.strictEqual(l.etapa, "ofertas_disponiveis");
  assert.deepStrictEqual(JSON.parse(l.offers_json).map((o) => o.offer_id), ["j"], "só a J17");
  assert.strictEqual(fg.ofertaPublicaFgts(JSON.parse(l.offers_json)[0]).installments, 2);

  l = await fg.escolherOferta(l, "j");
  assert.strictEqual(l.etapa, "dados_pessoais");
  l = await fg.enviarDados(l, { nome: "Maria", data_nascimento: "1990-02-01", genero: "FEMALE", estado_civil: "SINGLE", escolaridade: "Superior", nome_mae: "Ana", rg_numero: "1", rg_orgao: "SSP", rg_uf: "SC", cep: "88000000", rua: "R", numero: "1", bairro: "B", cidade: "C", uf: "SC", forma_desembolso: "PIX" });
  assert.strictEqual(l.etapa, "aguardando_assinatura_facta");
  assert.deepStrictEqual(chamadas2.filter((c) => c !== "requote"), ["kyc", "aceitar:j"]);
  console.log("OK: FGTS pelo painel passou em todos os cenários");
})().catch((e) => { console.error("FALHOU (FGTS):", e.message); process.exit(1); });

// Regressão: o payload público do FGTS usa ofertaPublicaFgts exportada pelo módulo (faltava o export e o status dava 500).
assert.strictEqual(typeof require("../site-unnotech").ofertaPublicaFgts, "function", "ofertaPublicaFgts precisa estar exportada");
console.log("OK: export do FGTS presente");
