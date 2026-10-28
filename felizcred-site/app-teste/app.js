// FelizCred · App de teste. Página escondida: sem link no site e fora do Google.
// Visual de app de crédito (stepper, simulador, bancos lado a lado). O chat fica só como ajuda.
// Prévia dos estados sem consultar nada: /app-teste/?demo=autorizar | analisando | whatsapp | ofertas | proposta | sem
(() => {
  "use strict";
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const API = LOCAL ? "http://localhost:3000/site-chat" : "https://meuwhats.onrender.com/site-chat";
  const KEY = "felizcred_app_teste_v1";
  const app = document.getElementById("app");
  const sheet = document.getElementById("sheet");
  const demo = new URLSearchParams(location.search).get("demo");
  const state = { session: null, clt: null, erro: "", escolhendo: "", assinatura: "", prazo: null, parcela: null, atualizando: false, chat: { aberto: false, msgs: [], enviando: false } };
  let sondagem = null, sondagemChat = null;

  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const money0 = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inputDate = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ""); };
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  const maskCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  const maskTel = (v) => { const d = soDigitos(v).slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
  const IC = {
    ok: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z"/></svg>',
    zap: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a9.7 9.7 0 0 0-8.4 14.55L2.2 21.8l5.37-1.4A9.8 9.8 0 1 0 12 2Zm4.28 11.96c-.23-.12-1.39-.69-1.6-.76-.22-.08-.38-.12-.54.12-.16.23-.61.76-.75.92-.14.15-.28.17-.52.05a6.4 6.4 0 0 1-3.2-2.8c-.24-.42.24-.39.7-1.3.08-.16.04-.29-.02-.4-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.4h-.46c-.16 0-.41.06-.63.3-.22.23-.83.81-.83 1.98s.85 2.3.97 2.46c.12.15 1.67 2.55 4.05 3.58.57.24 1.01.39 1.35.5.57.18 1.08.15 1.49.09.45-.07 1.39-.57 1.59-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.45-.28Z"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    pix: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"/><path d="M8.5 12l3.5-3.5 3.5 3.5-3.5 3.5z" fill="currentColor"/></svg>',
  };

  async function api(path, opts = {}) {
    if (demo) return demoApi(path, opts);
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (state.session?.token) headers["X-Chat-Token"] = state.session.token;
    const resposta = await fetch(`${API}${path}`, { cache: "no-store", ...opts, headers });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) { const erro = new Error(dados.error || "Não foi possível concluir agora. Tente de novo em instantes."); erro.status = resposta.status; throw erro; }
    return dados;
  }
  const guardar = (s) => { state.session = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const lerSessao = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.id && s.token && s.expiresAt > Date.now() ? s : null; } catch { return null; } };

  // ── formulários da proposta (copiados do painel "Minha simulação") ──────────────────────────────────────────
    function formDados(d, offer) {
    return `<form class="form" data-form="dados"><p>Condição selecionada: você recebe aproximadamente <b>${money(offer.disbursedAmount)}</b> e paga ${offer.installments || "—"} parcelas de ${money(offer.installmentValue)}.</p><div class="form-section"><b>Dados pessoais</b><div class="form-grid"><label>Nome completo<input name="nome" value="${esc(d.nome)}" required autocomplete="name"></label><label>Sexo<select name="sexo" required><option value="">Selecione</option><option value="M" ${d.sexo === "M" ? "selected" : ""}>Masculino</option><option value="F" ${d.sexo === "F" ? "selected" : ""}>Feminino</option></select></label><label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="4">Solteiro(a)</option><option value="3">Casado(a)</option><option value="2">Divorciado(a)</option><option value="5">Viúvo(a)</option><option value="9">União estável</option><option value="6">Outro</option></select></label><label>Data de nascimento<input name="data_nascimento" type="date" value="${esc(inputDate(d.data_nascimento))}" required></label><label>RG<input name="rg" required inputmode="numeric"></label><label>UF do RG<input name="estado_rg" maxlength="2" required placeholder="SC"></label><label>Órgão emissor<input name="orgao_emissor" required placeholder="SSP"></label><label>Data de expedição<input name="data_expedicao" type="date" required></label><label>UF de nascimento<input name="estado_natural" maxlength="2" required placeholder="SC"></label><label>Cidade de nascimento<input name="cidade_natural_nome" required></label><label>Nacionalidade<select name="nacionalidade" required><option value="1">Brasileiro(a)</option><option value="2">Estrangeiro(a)</option></select></label><label>Celular<input name="celular" required inputmode="tel" value="${esc(d.celular)}"></label><label>E-mail<input name="email" type="email" autocomplete="email"></label><label>Nome da mãe<input name="nome_mae" value="${esc(d.nome_mae)}" required></label><label>Nome do pai<input name="nome_pai" required placeholder="Ou NÃO DECLARADO"></label><label>Faixa de patrimônio<select name="valor_patrimonio" required><option value="1">Até R$ 10 mil</option><option value="2">De R$ 10 mil a R$ 100 mil</option><option value="3">De R$ 100 mil a R$ 500 mil</option><option value="4">De R$ 500 mil a R$ 1 milhão</option><option value="5">Acima de R$ 1 milhão</option></select></label></div></div><div class="form-section"><b>Endereço</b><div class="form-grid"><label>CEP<input name="cep" required inputmode="numeric" maxlength="9"></label><label>Endereço<input name="endereco" required></label><label>Número<input name="numero" required inputmode="numeric"></label><label>Complemento<input name="complemento"></label><label>Bairro<input name="bairro" required></label><label>Cidade<input name="cidade_nome" required></label><label>UF<input name="estado" required maxlength="2" placeholder="SC"></label></div></div><div class="form-section"><b>Conta para recebimento</b><div class="form-grid"><label>Banco<select name="banco" required><option value="">Selecione</option><option value="001">Banco do Brasil</option><option value="033">Santander</option><option value="104">Caixa</option><option value="237">Bradesco</option><option value="341">Itaú</option><option value="260">Nubank</option><option value="077">Inter</option><option value="336">C6 Bank</option></select></label><label>Tipo de conta<select name="tipo_conta" required><option value="C">Conta corrente</option><option value="P">Conta poupança</option></select></label><label>Agência<input name="agencia" required inputmode="numeric"></label><label>Conta com dígito<input name="conta" required></label><label>Tipo de chave Pix<select name="tipo_chave_pix" required><option value="1">CPF</option><option value="2">Telefone</option><option value="3">E-mail</option><option value="4">Chave aleatória</option></select></label><label>Chave Pix<input name="chave_pix" required></label></div></div><input type="hidden" name="renda" value="${esc(d.renda)}"><input type="hidden" name="matricula" value="${esc(d.matricula)}"><input type="hidden" name="cnpj_empregador" value="${esc(d.cnpj_empregador)}"><input type="hidden" name="data_admissao" value="${esc(inputDate(d.data_admissao))}"><label>Precisa de assinatura a rogo?<select name="cliente_iletrado_impossibilitado" required><option value="N">Não</option><option value="S">Sim</option></select></label><div class="rogo" hidden><div class="form-grid"><label>Nome de quem assina a rogo<input name="nome_a_rogo"></label><label>CPF de quem assina<input name="cpf_a_rogo" inputmode="numeric"></label><label>Nome da testemunha<input name="nome_a_rogo_testemunha"></label><label>CPF da testemunha<input name="cpf_a_rogo_testemunha" inputmode="numeric"></label></div></div><label class="consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real na Facta. Poderei revisar o contrato antes de assinar.</label><button class="btn primario grande">Gerar proposta para revisão</button></form>`;
  }
  const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
  const opcoesUf = (sel) => `<option value="">Selecione</option>${UFS.map((u) => `<option value="${u}"${u === sel ? " selected" : ""}>${u}</option>`).join("")}`;
  function formDadosParceiros(d, offer) {
    const c0 = state.clt || {};
    return `<form class="form" data-form="dados"><p>Condição escolhida: você recebe aproximadamente <b>${money(offer.disbursedAmount)}</b> e paga ${offer.installments || "—"} parcelas de ${money(offer.installmentValue)}.</p>
      <div class="form-section"><b>Dados pessoais</b><div class="form-grid">
        <label>Nome completo<input name="nome" value="${esc(state.session?.name || d.nome)}" required autocomplete="name"></label>
        <label>Data de nascimento<input name="data_nascimento" type="date" required></label>
        <label>Gênero<select name="genero" required><option value="">Selecione</option><option value="FEMALE">Feminino</option><option value="MALE">Masculino</option><option value="OTHER">Outro</option></select></label>
        <label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="SINGLE">Solteiro(a)</option><option value="MARRIED">Casado(a)</option><option value="DIVORCED">Divorciado(a)</option><option value="WIDOWED">Viúvo(a)</option><option value="SEPARATED">Separado(a)</option><option value="OTHER">Outro</option></select></label>
        <label>Escolaridade<select name="escolaridade" required><option value="">Selecione</option><option value="Fundamental">Ensino Fundamental</option><option value="Ensino Médio">Ensino Médio</option><option value="Superior">Ensino Superior</option><option value="Pós-graduação">Pós-graduação</option></select></label>
        <label>Nome completo da mãe<input name="nome_mae" required></label>
        <label>Celular<input name="celular" required inputmode="tel" value="${esc(d.celular)}"></label>
        <label>E-mail<input name="email" type="email" value="${esc(state.session?.email)}" autocomplete="email"></label>
      </div></div>
      <div class="form-section"><b>Documento (RG)</b><div class="form-grid">
        <label>Número do RG<input name="rg_numero" required inputmode="numeric"></label>
        <label>Órgão emissor<select name="rg_orgao" required><option value="SSP">SSP</option><option value="DETRAN">DETRAN</option><option value="PC">Polícia Civil</option><option value="IFP">IFP</option></select></label>
        <label>UF do RG<select name="rg_uf" required>${opcoesUf("")}</select></label>
      </div></div>
      <div class="form-section"><b>Endereço</b><div class="form-grid">
        <label>CEP<input name="cep" required inputmode="numeric" maxlength="9"></label>
        <label>Rua<input name="rua" required></label>
        <label>Número<input name="numero" required></label>
        <label>Complemento (opcional)<input name="complemento"></label>
        <label>Bairro<input name="bairro" required></label>
        <label>Cidade<input name="cidade" required></label>
        <label>UF<select name="uf" required>${opcoesUf("")}</select></label>
      </div></div>
      <div class="form-section"><b>Como receber o valor</b><div class="form-grid">
        <label>Forma de recebimento<select name="forma_desembolso" required><option value="PIX">PIX (chave = seu CPF)</option><option value="CONTA">Conta bancária</option></select></label>
      </div>
      <div class="form-grid conta-banco" hidden>
        <label>Banco<select name="banco"><option value="">Selecione</option>${["Banco do Brasil","Santander","Caixa Econômica Federal","Bradesco","Itaú","Nubank","Inter","C6 Bank","PagBank","Mercado Pago","PicPay","Banco Original","Sicoob","Sicredi"].map((b) => `<option>${b}</option>`).join("")}</select></label>
        <label>Tipo de conta<select name="tipo_conta"><option value="Corrente">Corrente</option><option value="Poupança">Poupança</option><option value="Salário">Salário</option></select></label>
        <label>Agência<input name="agencia" inputmode="numeric"></label>
        <label>Número da conta<input name="conta" inputmode="numeric"></label>
        <label>Dígito da conta<input name="digito_conta"></label>
      </div></div>
      ${c0.produto === "FGTS" ? "" : `<div class="form-section"><b>Seu RH (opcional)</b><div class="form-grid">
        <label>E-mail do RH<input name="email_rh" type="email"></label>
        <label>Telefone do RH<input name="telefone_rh" inputmode="tel"></label>
      </div></div>`}
      <label class="consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real. Poderei revisar o contrato antes de assinar.</label>
      <button class="btn primario grande">Gerar proposta para revisão</button></form>`;
  }

  // ── prévia (?demo=) ──────────────────────────────────────────────────────────────────────────────────────────
  const DEMO_OFERTAS = [24, 36, 48, 60].map((n, i) => ({ id: "d" + n, installments: n, installmentValue: 480, disbursedAmount: [9120, 11740, 13380, 14610][i] }));
  function demoClt(tipo) {
    const base = { provider: "unnotech", consentUrl: "https://termo.exemplo/autorizar", maxInstallment: 480, offers: [], parallelFacta: null, customerDefaults: { nome: "Salvador Felipe", celular: "47999999999" }, selectedOffer: null };
    switch (tipo) {
      case "autorizar": return { ...base, etapa: "autorizacao_enviada" };
      case "analisando": return { ...base, etapa: "simulando", parallelFacta: "aguardando" };
      case "whatsapp": return { ...base, provider: "facta", etapa: "autorizacao_enviada", parallelFacta: "facta_assumiu" };
      case "ofertas": return { ...base, etapa: "ofertas_disponiveis", parallelFacta: "descartada", offers: DEMO_OFERTAS };
      case "proposta": return { ...base, etapa: "aguardando_assinatura_facta", parallelFacta: "descartada", contractLink: "#", proposalCode: "A1B2C3D4", selectedOffer: DEMO_OFERTAS[1] };
      default: return { ...base, etapa: "sem_margem", parallelFacta: "negativa" };
    }
  }
  async function demoApi(path) {
    await new Promise((r) => setTimeout(r, 700));
    if (/select-offer/.test(path)) return { clt: { ...state.clt, etapa: "dados_pessoais", selectedOffer: state.clt.offers.find((o) => state.pendente === o.id) || state.clt.offers[0] } };
    if (/personal-data/.test(path)) return { clt: demoClt("proposta") };
    if (/resimulate/.test(path)) return { clt: { ...state.clt } };
    return { clt: state.clt, messages: [] };
  }

  // ── estado dos bancos e passos ───────────────────────────────────────────────────────────────────────────────
  const ETAPAS_PROPOSTA = ["aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida"];
  function estadoUnno(c) {
    if (c.provider !== "unnotech") return { k: c.parallelFacta === "facta_venceu" ? "dispensado" : "sem" };
    if (c.etapa === "autorizacao_enviada") return { k: "autorizar" };
    if (["consultando_margem", "simulando"].includes(c.etapa)) return { k: "analisando" };
    if (["ofertas_disponiveis", "dados_pessoais"].includes(c.etapa)) return { k: "ofertas" };
    if (ETAPAS_PROPOSTA.includes(c.etapa)) return { k: "proposta" };
    return { k: "sem" };
  }
  function estadoFacta(c) {
    if (c.provider === "facta") {
      if (["autorizacao_enviada", "aguardando_autorizacao", "solicitando_autorizacao"].includes(c.etapa)) return { k: "whats" };
      if (["ofertas_disponiveis", "dados_pessoais"].includes(c.etapa)) return { k: "ofertas" };
      if (ETAPAS_PROPOSTA.includes(c.etapa)) return { k: "proposta" };
      return { k: "sem" };
    }
    const p = c.parallelFacta;
    if (c.etapa === "autorizacao_enviada" || !p) return { k: "espera" };
    if (p === "aguardando") return { k: "whats" };
    if (p === "descartada") return { k: "dispensado" };
    return { k: "sem" };
  }
  // 1 Autorização · 2 Análise · 3 Condições · 4 Contratação
  function passo(c, u, f) {
    if (ETAPAS_PROPOSTA.includes(c.etapa) || c.etapa === "dados_pessoais") return 4;
    if (u.k === "ofertas" || f.k === "ofertas") return 3;
    if (u.k === "autorizar") return 1;
    if (u.k === "analisando" || f.k === "whats") return 2;
    return 2;
  }
  function linhasBanco(banco, e) {
    // estado de cada etapa do banco: ok | atual | pendente | falha
    const t = { espera: ["pendente", "pendente", "pendente"], autorizar: ["atual", "pendente", "pendente"], whats: ["atual", "pendente", "pendente"], analisando: ["ok", "atual", "pendente"],
      ofertas: ["ok", "ok", "ok"], escolhida: ["ok", "ok", "ok"], proposta: ["ok", "ok", "ok"], sem: ["ok", "ok", "falha"], dispensado: ["pendente", "pendente", "pendente"] }[e.k] || ["pendente", "pendente", "pendente"];
    const nomes = [banco === "unno" ? "Autorização pelo link" : "Autorização no WhatsApp", "Análise do banco", "Condições liberadas"];
    return nomes.map((n, i) => `<li class="ap-li ${t[i]}"><span class="ap-bolinha">${t[i] === "ok" ? IC.ok : t[i] === "falha" ? IC.x : ""}</span><span>${n}</span></li>`).join("");
  }
  function acaoBanco(banco, e, c) {
    if (e.k === "autorizar") return `<div class="ap-acoes">${c.consentUrl ? `<a class="ap-btn principal" href="${esc(c.consentUrl)}" target="_blank" rel="noopener">${IC.cadeado} Autorizar agora</a>` : '<button class="ap-btn principal" disabled>Preparando o link…</button>'}
        <button class="ap-btn suave" type="button" data-acao="atualizar">Já autorizei</button></div>
        <p class="ap-dica">É uma página segura do banco parceiro. Depois de autorizar, volte para cá: seguimos sozinhos.</p>`;
    if (e.k === "whats") return `<div class="ap-acoes"><a class="ap-btn zap" href="https://wa.me/" target="_blank" rel="noopener">${IC.zap} Abrir o WhatsApp</a></div>
        <p class="ap-dica">Enviamos uma mensagem do <b>Facta</b> para o seu celular. Toque no link dela e libere a consulta. Conferimos sozinhos a cada poucos segundos.</p>`;
    if (e.k === "espera") return '<p class="ap-dica">Começa assim que você autorizar o primeiro banco. Você não precisa fazer nada aqui.</p>';
    if (e.k === "analisando") return '<p class="ap-dica">Estamos analisando seu perfil. Costuma levar alguns minutos; pode manter esta tela aberta ou voltar depois.</p>';
    if (e.k === "sem") return '<p class="ap-dica">Este banco não liberou valores agora.</p>';
    if (e.k === "dispensado") return '<p class="ap-dica">Outro banco liberou primeiro, então não foi preciso consultar este.</p>';
    return "";
  }
  function cartaoBanco(banco, e, c) {
    const nome = banco === "unno" ? "Unno" : "Facta";
    const rotulos = { espera: ["Na fila", "cinza"], autorizar: ["Falta você", "laranja"], whats: ["Aguardando você", "laranja"], analisando: ["Analisando", "amarelo"], ofertas: ["Liberou", "verde"], escolhida: ["Escolhida", "verde"], proposta: ["Proposta", "verde"], sem: ["Sem condições", "cinza"], dispensado: ["Não precisou", "cinza"] };
    const [rot, cor] = rotulos[e.k] || ["", "cinza"];
    const vivo = ["autorizar", "whats", "analisando"].includes(e.k);
    return `<section class="ap-banco ${["sem", "dispensado"].includes(e.k) ? "apagado" : ""} ${vivo ? "vivo" : ""}">
      <header><span class="ap-logo ${banco}">${nome[0]}</span><div><b>${nome}</b><small>${banco === "unno" ? "Banco parceiro · autorização por link" : "Banco parceiro · autorização por WhatsApp"}</small></div><span class="ap-tag ${cor}">${vivo ? '<i class="ap-pulso"></i>' : ""}${rot}</span></header>
      <ul class="ap-lista">${linhasBanco(banco, e)}</ul>${acaoBanco(banco, e, c)}</section>`;
  }

  // ── simulador ────────────────────────────────────────────────────────────────────────────────────────────────
  function ofertasPorPrazo(c) {
    const m = new Map();
    for (const o of c.offers || []) { const atual = m.get(o.installments); if (!atual || o.disbursedAmount > atual.disbursedAmount) m.set(o.installments, o); }
    return [...m.values()].sort((a, b) => a.installments - b.installments);
  }
  function ofertaAtual(c) {
    const lista = ofertasPorPrazo(c);
    if (!lista.length) return null;
    return lista.find((o) => o.installments === state.prazo) || lista.reduce((a, b) => (b.disbursedAmount > a.disbursedAmount ? b : a));
  }
  function cartaoSimulador(c, banco) {
    const lista = ofertasPorPrazo(c), o = ofertaAtual(c);
    if (!o) return "";
    const max = Math.max(Number(c.maxInstallment || 0), o.installmentValue), min = Math.max(30, Math.ceil(max * 0.2 / 10) * 10);
    const parcela = state.parcela == null ? o.installmentValue : state.parcela;
    const fator = o.disbursedAmount / (o.installmentValue || 1);
    const estimado = Math.abs(parcela - o.installmentValue) > 0.5;
    const valor = estimado ? parcela * fator : o.disbursedAmount;
    return `<section class="ap-sim ${state.atualizando ? "carregando" : ""}">
      <div class="ap-sim-topo"><span class="ap-tag verde">Condições de ${banco === "unno" ? "Unno" : "Facta"}</span><span class="ap-pixmini">${IC.pix} Pix</span></div>
      <p class="ap-rotulo">Você recebe</p>
      <p class="ap-valor" id="ap-valor">${money0(valor)}${estimado ? '<small>estimativa</small>' : ""}</p>
      <p class="ap-sub"><b>${o.installments}x</b> de <b id="ap-parcela-txt">${money(parcela)}</b> por mês</p>
      <p class="ap-rotulo" style="margin-top:20px">Em quantas parcelas?</p>
      <div class="ap-chips">${lista.map((x) => `<button type="button" class="ap-chip ${x.installments === o.installments ? "on" : ""}" data-acao="prazo" data-prazo="${x.installments}">${x.installments}x</button>`).join("")}</div>
      <p class="ap-rotulo" style="margin-top:20px">Quanto quer pagar por mês?</p>
      <input class="ap-range" id="ap-range" type="range" min="${min}" max="${Math.round(max)}" step="10" value="${Math.round(parcela)}" aria-label="Valor da parcela">
      <div class="ap-range-leg"><span>${money0(min)}</span><span>até ${money(max)}</span></div>
      ${estimado ? `<button class="ap-btn suave" type="button" data-acao="resimular">${state.atualizando ? "Calculando com o banco…" : "Atualizar valores com o banco"}</button>` : ""}
      <button class="ap-btn principal grande" type="button" data-acao="escolher" data-id="${esc(o.id)}" ${state.escolhendo || state.atualizando || estimado ? "disabled" : ""}>${state.escolhendo ? '<i class="ap-spin"></i> Preparando…' : "Contratar esta condição"}</button>
      <p class="ap-pixnota">${IC.pix}<span>O dinheiro cai na sua conta por <b>Pix</b>. Você revê o contrato inteiro antes de assinar.</span></p></section>`;
  }

  function cartaoProposta(c) {
    const o = c.selectedOffer || {};
    const etapa = c.etapa;
    const titulo = etapa === "proposta_concluida" ? "Contrato concluído 🎉" : etapa === "proposta_em_analise" ? "Banco analisando sua assinatura" : "Sua proposta está pronta";
    const sub = etapa === "aguardando_assinatura_facta" ? "Falta só revisar e assinar. Você vê o contrato completo antes de decidir." : etapa === "proposta_em_analise" ? "Recebemos sua assinatura. Atualizamos aqui sozinhos." : "O pagamento foi confirmado. Confira a conta informada.";
    return `<section class="ap-proposta"><span class="ap-tag verde">${c.provider === "facta" ? "Facta" : "Unno"} · ${esc(c.proposalCode || "em geração")}</span><h2>${titulo}</h2><p>${sub}</p>
      ${o.disbursedAmount ? `<div class="ap-resumo"><span>Você recebe</span><b>${money(o.disbursedAmount)}</b><small>${o.installments}x de ${money(o.installmentValue)} · pagamento via Pix</small></div>` : ""}
      ${etapa === "aguardando_assinatura_facta" && c.contractLink ? `<a class="ap-btn principal grande" href="${esc(c.contractLink)}" target="_blank" rel="noopener">Revisar e assinar</a>` : etapa === "aguardando_assinatura_facta" ? '<div class="ap-gerando"><i class="ap-spin claro"></i><div><b>Gerando o link de assinatura</b><small>Aparece aqui em instantes.</small></div></div>' : ""}</section>`;
  }

  // ── telas ────────────────────────────────────────────────────────────────────────────────────────────────────
  const barraTopo = (extra = "") => `<div class="ap-topo"><span class="ap-marca">FelizCred</span><div class="ap-topo-dir">${extra}<button class="ap-icone" type="button" data-acao="chat" aria-label="Falar com a FelizCred">${IC.chat}</button></div></div>`;

  function telaEntrada(erro = "", v = {}) {
    clearInterval(sondagem);
    app.innerHTML = `${barraTopo()}
      <div class="ap-capa"><span class="ap-tag verde">Consignado CLT · simulação grátis</span><h1>Seu crédito em poucos minutos, sem sair do celular</h1>
        <ul class="ap-ponto"><li>${IC.ok}<span>Consultamos <b>dois bancos ao mesmo tempo</b></span></li><li>${IC.ok}<span>Você recebe por <b>Pix</b> na sua conta</span></li><li>${IC.ok}<span>Revê o contrato antes de assinar</span></li></ul></div>
      ${erro ? `<div class="ap-erro">${esc(erro)}</div>` : ""}
      <form class="form ap-form" data-form="entrada" autocomplete="on">
        <label>Nome completo<input name="name" value="${esc(v.name || "")}" required autocomplete="name"></label>
        <label>CPF<input name="cpf" value="${esc(v.cpf || "")}" inputmode="numeric" required placeholder="000.000.000-00"></label>
        <label>Celular com DDD<input name="phone" value="${esc(v.phone || "")}" inputmode="tel" required placeholder="(00) 00000-0000" autocomplete="tel"></label>
        <label>E-mail<input name="email" type="email" value="${esc(v.email || "")}" required autocomplete="email"></label>
        <label class="consent"><input type="checkbox" name="tres_meses" required> Tenho mais de 3 meses de registro no trabalho atual (CLT).</label>
        <label class="consent"><input type="checkbox" name="whatsapp" checked> Pode me avisar por WhatsApp quando as condições chegarem.</label>
        <button class="ap-btn principal grande" id="seguir">Simular agora</button>
      </form>
      <p class="ap-rodape">${IC.cadeado} Seus dados são usados só para consultar as condições. Simulação sem compromisso.</p>`;
  }

  function stepper(n) {
    const nomes = ["Autorização", "Análise", "Condições", "Contratação"];
    return `<ol class="ap-steps">${nomes.map((t, i) => `<li class="${i + 1 < n ? "ok" : i + 1 === n ? "atual" : ""}"><span>${i + 1 < n ? IC.ok : i + 1}</span><em>${t}</em></li>`).join("")}</ol>`;
  }
  function heroTexto(c, u, f, n) {
    const semTudo = u.k === "sem" && f.k === "sem";
    if (semTudo) return ["Nenhum banco liberou agora", "Não encontramos condições para o seu perfil neste momento. Fale com a gente: podemos tentar outro caminho."];
    if (n === 4 && ETAPAS_PROPOSTA.includes(c.etapa)) return ["Falta só assinar", "Sua proposta foi gerada. Revise e assine no ambiente seguro do banco."];
    if (n === 4) return ["Quase lá", "Complete seus dados para gerar a proposta."];
    if (n === 3) return ["Suas condições chegaram", "Ajuste a parcela e o prazo do jeito que couber no seu bolso e contrate."];
    if (n === 1) return ["Autorize a consulta", "Toque em “Autorizar agora” no primeiro banco. Leva menos de um minuto."];
    if (f.k === "whats" && u.k !== "analisando") return ["Falta autorizar no WhatsApp", "Abra a mensagem do Facta no seu WhatsApp e toque no link."];
    return ["Analisando seu perfil", "Os dois bancos estão trabalhando. O primeiro que liberar aparece aqui."];
  }

  function telaApp() {
    const c = state.clt;
    const nome = String(state.session?.name || "").trim().split(/\s+/)[0] || "";
    const u = estadoUnno(c), f = estadoFacta(c);
    const n = passo(c, u, f);
    const [titulo, sub] = heroTexto(c, u, f, n);
    const temProposta = ETAPAS_PROPOSTA.includes(c.etapa);
    const semTudo = u.k === "sem" && f.k === "sem";
    const bancoOfertas = u.k === "ofertas" ? "unno" : f.k === "ofertas" ? "facta" : null;
    const mostrarOfertas = !!bancoOfertas && !temProposta && c.etapa !== "dados_pessoais";
    app.innerHTML = `${barraTopo(`<span class="ap-ola">Olá, ${esc(nome)}</span><button class="ap-avatar" type="button" data-acao="sair" title="Sair">${esc(nome.slice(0, 1).toUpperCase() || "F")}</button>`)}
      ${stepper(n)}
      <section class="ap-hero ${semTudo ? "erro" : ""}"><h1>${titulo}</h1><p>${sub}</p>${!semTudo && !temProposta && n === 2 ? '<div class="ap-barra"><i></i></div>' : ""}</section>
      ${state.erro ? `<div class="ap-erro">${esc(state.erro)}</div>` : ""}
      ${temProposta ? cartaoProposta(c) : ""}
      ${c.etapa === "dados_pessoais" ? '<section class="ap-sim"><p class="ap-sub">Condição escolhida. Falta completar seus dados.</p><button class="ap-btn principal grande" type="button" data-acao="abrir-dados">Completar dados</button></section>' : ""}
      ${mostrarOfertas ? cartaoSimulador(c, bancoOfertas) : ""}
      ${temProposta ? "" : `<p class="ap-secao">Bancos consultados</p><div class="ap-bancos">${cartaoBanco("unno", u, c)}${cartaoBanco("facta", f, c)}</div>`}
      ${semTudo ? `<div class="ap-acoes pad"><button class="ap-btn principal grande" type="button" data-acao="chat">Falar com a FelizCred</button></div>` : ""}
      <div class="ap-selopix">${IC.pix}<span>Pagamento sempre via <b>Pix</b></span></div>`;
  }

  // ── popup com os dados da proposta ───────────────────────────────────────────────────────────────────────────
  function abrirSheet() {
    const c = state.clt;
    if (!c || c.etapa !== "dados_pessoais") return;
    const form = c.provider === "unnotech" ? formDadosParceiros(c.customerDefaults || {}, c.selectedOffer || {}) : formDados(c.customerDefaults || {}, c.selectedOffer || {});
    sheet.innerHTML = `<div class="fundo" data-acao="fechar-sheet"></div><div class="folha" role="dialog" aria-modal="true" aria-label="Dados da proposta">
      <div class="puxador"></div>
      <div class="pix-faixa"><span>${IC.pix}</span><div><b>O pagamento é feito via Pix</b><small>O valor cai na conta que você informar abaixo. Você revê o contrato antes de assinar.</small></div></div>
      <div class="erro-sheet"></div>${form}
      <button class="ap-btn suave" type="button" data-acao="fechar-sheet" style="margin:10px 20px 0;width:calc(100% - 40px)">Voltar</button></div>`;
    sheet.classList.add("aberta"); document.body.classList.add("trava");
  }
  function fecharSheet() { sheet.classList.remove("aberta"); document.body.classList.remove("trava"); sheet.innerHTML = ""; }

  // ── ajuda (chat) ─────────────────────────────────────────────────────────────────────────────────────────────
  function desenharChat() {
    if (!state.chat.aberto) return;
    const msgs = state.chat.msgs.filter((m) => !/^Tenho interesse em:/.test(String(m.body || "")));
    const corpo = msgs.length ? msgs.map((m) => `<div class="ap-msg ${m.direction === "visitor" ? "eu" : "eles"}">${esc(m.body)}</div>`).join("") : '<p class="ap-vazio">Oi! Se tiver qualquer dúvida sobre a simulação, escreva aqui. Respondemos no horário de atendimento.</p>';
    sheet.innerHTML = `<div class="fundo" data-acao="fechar-chat"></div><div class="folha ap-chat" role="dialog" aria-modal="true" aria-label="Ajuda">
      <div class="puxador"></div><div class="ap-chat-topo"><b>Fale com a FelizCred</b><button class="ap-icone claro" type="button" data-acao="fechar-chat" aria-label="Fechar">${IC.x}</button></div>
      <div class="ap-msgs" id="ap-msgs">${corpo}</div>
      <form class="ap-chat-form" data-form="chat"><input name="msg" placeholder="Escreva sua dúvida" autocomplete="off" required><button class="ap-btn principal" ${state.chat.enviando ? "disabled" : ""}>Enviar</button></form></div>`;
    sheet.classList.add("aberta"); document.body.classList.add("trava");
    const m = document.getElementById("ap-msgs"); if (m) m.scrollTop = m.scrollHeight;
  }
  async function carregarChat() {
    if (!state.session || demo) return;
    try { const d = await api(`/conversations/${state.session.id}`); state.chat.msgs = d.messages || []; if (state.chat.aberto && !document.activeElement?.closest?.(".ap-chat-form")) desenharChat(); } catch {}
  }
  function abrirChat() {
    if (!state.session) { telaEntrada("Preencha seus dados para falar com a gente."); return; }
    state.chat.aberto = true; desenharChat(); carregarChat(); clearInterval(sondagemChat); sondagemChat = setInterval(carregarChat, 6000);
  }
  function fecharChat() { state.chat.aberto = false; clearInterval(sondagemChat); fecharSheet(); }

  // ── dados do servidor ────────────────────────────────────────────────────────────────────────────────────────
  const assinaturaClt = (c) => JSON.stringify([c?.provider, c?.etapa, c?.status, c?.parallelFacta, c?.error, (c?.offers || []).map((o) => o.id + o.installmentValue).join(), c?.consentUrl, c?.contractLink, c?.proposalCode]);
  function aplicar(clt) {
    const mudou = assinaturaClt(clt) !== state.assinatura;
    state.clt = clt; state.assinatura = assinaturaClt(clt);
    if (mudou) { state.atualizando = false; state.parcela = null; state.prazo = null; if (!state.chat.aberto) telaApp(); }
  }
  async function atualizar() {
    if (!state.session || demo) return;
    try { const d = await api(`/conversations/${state.session.id}/clt/status`); if (d.clt) aplicar(d.clt); } catch (erro) { if (erro.status === 401 || erro.status === 404) sair(); }
  }
  function iniciarSondagem() { clearInterval(sondagem); if (demo) return; sondagem = setInterval(() => { if (!document.hidden && !sheet.classList.contains("aberta")) atualizar(); }, 4000); }
  function sair() { try { localStorage.removeItem(KEY); } catch {} clearInterval(sondagem); clearInterval(sondagemChat); state.session = null; state.clt = null; state.assinatura = ""; state.chat = { aberto: false, msgs: [], enviando: false }; fecharSheet(); telaEntrada(); }

  async function seguir(form) {
    const d = new FormData(form);
    const name = String(d.get("name") || "").trim().replace(/\s+/g, " ");
    const cpf = soDigitos(d.get("cpf")), phone = soDigitos(d.get("phone")), email = String(d.get("email") || "").trim().toLowerCase();
    const v = { name, cpf: maskCpf(cpf), phone: maskTel(phone), email };
    if (name.split(" ").filter(Boolean).length < 2) return telaEntrada("Digite seu nome completo, como aparece no documento.", v);
    if (cpf.length !== 11) return telaEntrada("Digite um CPF válido.", v);
    if (phone.length < 10) return telaEntrada("Digite um celular com DDD.", v);
    const botao = form.querySelector("#seguir"); botao.disabled = true; botao.textContent = "Abrindo…";
    try {
      const r = await fetch(`${API}/conversations`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact: phone, email, whatsappOptIn: d.has("whatsapp"), message: "Tenho interesse em: Empréstimo CLT", pageUrl: location.origin + "/app-teste/" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível começar agora.");
      guardar({ id: j.conversation.id, token: j.token, name, contact: phone, email, expiresAt: Date.now() + 6 * 3600 * 1000 });
      const s = await api(`/conversations/${state.session.id}/clt/start`, { method: "POST", body: JSON.stringify({ name, cpf, phone }) });
      aplicar(s.clt); iniciarSondagem();
    } catch (erro) { state.session = null; telaEntrada(erro.message, v); }
  }

  document.addEventListener("input", (e) => {
    if (e.target.name === "cpf" && e.target.closest(".ap-form")) e.target.value = maskCpf(e.target.value);
    if (e.target.name === "phone" && e.target.closest(".ap-form")) e.target.value = maskTel(e.target.value);
    if (e.target.id === "ap-range") {
      const o = ofertaAtual(state.clt); if (!o) return;
      state.parcela = Number(e.target.value);
      const estimado = Math.abs(state.parcela - o.installmentValue) > 0.5;
      document.getElementById("ap-parcela-txt").textContent = money(state.parcela);
      document.getElementById("ap-valor").innerHTML = money0(estimado ? state.parcela * (o.disbursedAmount / (o.installmentValue || 1)) : o.disbursedAmount) + (estimado ? "<small>estimativa</small>" : "");
      const sim = document.querySelector(".ap-sim"); let b = sim.querySelector('[data-acao="resimular"]');
      if (estimado && !b) { b = document.createElement("button"); b.className = "ap-btn suave"; b.type = "button"; b.dataset.acao = "resimular"; b.textContent = "Atualizar valores com o banco"; sim.querySelector(".ap-range-leg").after(b); }
      if (!estimado && b) b.remove();
      const cta = sim.querySelector('[data-acao="escolher"]'); if (cta) cta.disabled = estimado;
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.name === "forma_desembolso") { const conta = sheet.querySelector(".conta-banco"); if (conta) conta.hidden = e.target.value !== "CONTA"; }
    if (e.target.name === "cliente_iletrado_impossibilitado") { const rogo = sheet.querySelector(".rogo"); if (rogo) rogo.hidden = e.target.value !== "S"; }
  });
  document.addEventListener("click", async (e) => {
    const alvo = e.target.closest("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === "sair") return sair();
    if (acao === "chat") return abrirChat();
    if (acao === "fechar-chat") return fecharChat();
    if (acao === "atualizar") { alvo.disabled = true; alvo.textContent = "Conferindo…"; await atualizar(); telaApp(); return; }
    if (acao === "fechar-sheet") return fecharSheet();
    if (acao === "abrir-dados") return abrirSheet();
    if (acao === "prazo") { state.prazo = Number(alvo.dataset.prazo); state.parcela = null; telaApp(); return; }
    if (acao === "resimular") {
      if (state.atualizando || state.parcela == null) return;
      state.atualizando = true; state.erro = ""; telaApp();
      try {
        const d = await api(`/conversations/${state.session.id}/clt/resimulate`, { method: "POST", body: JSON.stringify({ installmentValue: state.parcela }) });
        state.assinatura = ""; state.atualizando = false; state.parcela = null; state.prazo = null; aplicar(d.clt);
      } catch (erro) { state.atualizando = false; state.erro = erro.message; telaApp(); }
      return;
    }
    if (acao === "escolher") {
      state.escolhendo = alvo.dataset.id; state.pendente = alvo.dataset.id; state.erro = ""; telaApp();
      try {
        const d = await api(`/conversations/${state.session.id}/clt/select-offer`, { method: "POST", body: JSON.stringify({ offerId: alvo.dataset.id }) });
        state.escolhendo = ""; state.assinatura = ""; aplicar(d.clt);
        if (d.clt.etapa === "dados_pessoais") abrirSheet();
      } catch (erro) { state.escolhendo = ""; state.erro = erro.message; telaApp(); }
    }
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form;
    if (tipo === "entrada") return seguir(form);
    if (tipo === "chat") {
      const campo = form.querySelector("input[name=msg]"); const texto = campo.value.trim(); if (!texto || demo) { campo.value = ""; return; }
      campo.value = ""; state.chat.msgs.push({ direction: "visitor", body: texto }); desenharChat();
      try { await api(`/conversations/${state.session.id}`, { method: "POST", body: JSON.stringify({ message: texto }) }); await carregarChat(); } catch (erro) { state.chat.msgs.push({ direction: "agent", body: erro.message }); desenharChat(); }
      return;
    }
    if (tipo === "dados") {
      const cliente = Object.fromEntries(new FormData(form).entries()); delete cliente.on;
      const botao = form.querySelector("button.primario, button.ap-btn.principal, .btn.primario"); if (botao) { botao.disabled = true; botao.textContent = "Gerando sua proposta…"; }
      const faixa = sheet.querySelector(".erro-sheet"); faixa.innerHTML = "";
      try {
        const d = await api(`/conversations/${state.session.id}/clt/personal-data`, { method: "POST", body: JSON.stringify({ customer: cliente }) });
        fecharSheet(); state.assinatura = ""; aplicar(d.clt); window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (erro) { if (botao) { botao.disabled = false; botao.textContent = "Gerar proposta para revisão"; } faixa.innerHTML = `<div class="erro" style="margin:10px 20px 0">${esc(erro.message)}</div>`; sheet.querySelector(".folha").scrollTo({ top: 0, behavior: "smooth" }); }
    }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) atualizar(); });

  // ── início ───────────────────────────────────────────────────────────────────────────────────────────────────
  function barraDemo() {
    const lista = ["autorizar", "analisando", "whatsapp", "ofertas", "proposta", "sem"];
    const el = document.createElement("div"); el.className = "ap-demo";
    el.innerHTML = '<b>Prévia</b>' + lista.map((k) => `<a href="?demo=${k}" class="${k === demo ? "on" : ""}">${k}</a>`).join("") + '<a href="?demo=entrada" class="' + (demo === "entrada" ? "on" : "") + '">entrada</a>';
    document.body.prepend(el);
  }
  if (demo) {
    barraDemo();
    state.session = { id: "demo", token: "demo", name: "Salvador Felipe", contact: "47999999999", email: "demo@teste.com" };
    if (demo === "entrada") telaEntrada(); else { state.clt = demoClt(demo); state.assinatura = assinaturaClt(state.clt); telaApp(); }
  } else {
    const s = lerSessao();
    if (!s) telaEntrada();
    else { state.session = s; api(`/conversations/${s.id}/clt/status`).then((d) => { if (!d.clt) return telaEntrada(); aplicar(d.clt); iniciarSondagem(); }).catch(() => sair()); }
  }
})();
