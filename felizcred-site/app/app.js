// FelizCred · App de teste. Página escondida: sem link no site e fora do Google.
// Visual de app de crédito (stepper, simulador, bancos lado a lado). O chat fica só como ajuda.
// Prévia dos estados sem consultar nada: /app-teste/?demo=autorizar | analisando | whatsapp | ofertas | proposta | sem
(() => {
  "use strict";
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const API = LOCAL ? "http://localhost:3000/site-chat" : "https://meuwhats.onrender.com/site-chat";
  const KEY = "felizcred_app_v1";
  const LOGIN_KEY = "felizcred_app_login_v1";
  const TRES_DIAS = 3 * 24 * 3600 * 1000, TRINTA_DIAS = 30 * 24 * 3600 * 1000;
  const PARAMS = new URLSearchParams(location.search);
  const EMBED = PARAMS.get("embed") === "1";
  if (EMBED) document.body.classList.add("embed");
  const app = document.getElementById("app");
  const sheet = document.getElementById("sheet");
  const demo = new URLSearchParams(location.search).get("demo");
  const state = { aviso: "", outrosDados: false, produto: /^fgts$/i.test(new URLSearchParams(location.search).get("p") || new URLSearchParams(location.search).get("novo") || "") ? "fgts" : "clt", fgtsLoading: false, session: null, clt: null, erro: "", escolhendo: "", assinatura: "", prazo: null, parcela: null, atualizando: false, chat: { aberto: false, msgs: [], enviando: false } };
  let sondagem = null, sondagemChat = null;

  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const money0 = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inputDate = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ""); };
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  const maskCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  const maskTel = (v) => { const d = soDigitos(v).slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
  const IC = {
    seta: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z"/></svg>',
    zap: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a9.7 9.7 0 0 0-8.4 14.55L2.2 21.8l5.37-1.4A9.8 9.8 0 1 0 12 2Zm4.28 11.96c-.23-.12-1.39-.69-1.6-.76-.22-.08-.38-.12-.54.12-.16.23-.61.76-.75.92-.14.15-.28.17-.52.05a6.4 6.4 0 0 1-3.2-2.8c-.24-.42.24-.39.7-1.3.08-.16.04-.29-.02-.4-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.4h-.46c-.16 0-.41.06-.63.3-.22.23-.83.81-.83 1.98s.85 2.3.97 2.46c.12.15 1.67 2.55 4.05 3.58.57.24 1.01.39 1.35.5.57.18 1.08.15 1.49.09.45-.07 1.39-.57 1.59-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.45-.28Z"/></svg>',
    cadeado: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    pix: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.8l3.6 3.6a2 2 0 0 0 2.8 0l1.1-1.1.9.9-1.1 1.1a2 2 0 0 0 0 2.8L22 13.7l-3.6 3.6a2 2 0 0 1-2.8 0L14.5 16.2a2 2 0 0 0-2.8 0l-1.1 1.1a2 2 0 0 1-2.8 0L4.2 13.7 7.8 10a2 2 0 0 0 0-2.8L6.7 6.1l.9-.9 1.1 1.1a2 2 0 0 0 2.8 0z" transform="scale(.9) translate(1.3 1.3)"/></svg>',
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
  const guardar = (s) => { state.session = { ...s, lastSeen: Date.now() }; try { localStorage.setItem(KEY, JSON.stringify(state.session)); } catch {} };
  const lerSessao = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && s.id && s.token && s.expiresAt > Date.now() ? s : null; } catch { return null; } };
  // "Login": os dados digitados ficam neste aparelho para reabrir ou reiniciar a simulação com um toque.
  const lerLogin = () => { try { const l = JSON.parse(localStorage.getItem(LOGIN_KEY) || "null"); return l && l.name && l.cpf ? l : null; } catch { return null; } };
  const guardarLogin = (l) => { try { localStorage.setItem(LOGIN_KEY, JSON.stringify(l)); } catch {} };
  const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";

  // ── formulários da proposta (copiados do painel "Minha simulação") ──────────────────────────────────────────
  // ── formulários da proposta ──────────────────────────────────────────────────────────────────────────────────
  // O cliente só digita o que os bancos não sabem. O resto o servidor preenche sozinho (Pix na chave CPF, patrimônio até
  // R$ 10 mil, escolaridade ensino médio, órgão emissor SSP, nacionalidade brasileira, sem assinatura a rogo, pai "não declarado").
  const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
  const opcoesUf = (sel) => `<option value="">Selecione</option>${UFS.map((u) => `<option value="${u}"${u === sel ? " selected" : ""}>${u}</option>`).join("")}`;
  const BANCOS = [["001", "Banco do Brasil"], ["033", "Santander"], ["104", "Caixa"], ["237", "Bradesco"], ["341", "Itaú"], ["260", "Nubank"], ["077", "Inter"], ["336", "C6 Bank"]];
  const resumoCondicao = (offer) => `<div class="ap-cond"><span>Condição escolhida</span><b>${money(offer.disbursedAmount)}</b><small>${state.clt?.produto === "FGTS" ? `${offer.installments || "—"} parcelas anuais de ${money(offer.installmentValue)}` : `${offer.installments || "—"}x de ${money(offer.installmentValue)}`} · você recebe por Pix</small></div>`;
  const campoEndereco = (n) => `<div class="form-section"><b>Endereço</b><div class="form-grid">
        <label>CEP<input name="cep" required inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="00000-000"></label>
        <label>Rua<input name="${n.rua}" required autocomplete="address-line1"></label>
        <div class="form-duo"><label>Número<input name="numero" required inputmode="numeric"></label><label>Complemento <em>(opcional)</em><input name="complemento"></label></div>
        <label>Bairro<input name="bairro" required></label>
        <div class="form-duo"><label>Cidade<input name="${n.cidade}" required></label><label>UF<select name="${n.uf}" required>${opcoesUf("")}</select></label></div>
      </div></div>`;
  const consentimento = '<label class="consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real. Poderei revisar o contrato antes de assinar.</label>';

  function formDadosParceiros(d, offer) {
    return `<form class="form" data-form="dados">${resumoCondicao(offer)}
      <div class="form-section"><b>Dados pessoais</b><div class="form-grid">
        <label>Nome completo<input name="nome" value="${esc(state.session?.name || d.nome)}" required autocomplete="name"></label>
        <div class="form-duo"><label>Nascimento<input name="data_nascimento" type="date" required></label>
          <label>Gênero<select name="genero" required><option value="">Selecione</option><option value="FEMALE">Feminino</option><option value="MALE">Masculino</option><option value="OTHER">Outro</option></select></label></div>
        <label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="SINGLE">Solteiro(a)</option><option value="MARRIED">Casado(a)</option><option value="DIVORCED">Divorciado(a)</option><option value="WIDOWED">Viúvo(a)</option><option value="SEPARATED">Separado(a)</option><option value="OTHER">Outro</option></select></label>
        <label>Nome completo da mãe<input name="nome_mae" required></label>
        <label>Celular<input name="celular" required inputmode="tel" value="${esc(maskTel(d.celular || state.session?.contact))}" autocomplete="tel"></label>
        <label>E-mail<input name="email" type="email" required value="${esc(state.session?.email || "")}" autocomplete="email"></label>
      </div></div>
      <div class="form-section"><b>Documento</b><div class="form-grid"><div class="form-duo"><label>Número do RG<input name="rg_numero" required></label><label>UF do RG<select name="rg_uf" required>${opcoesUf("")}</select></label></div></div></div>
      ${campoEndereco({ rua: "rua", cidade: "cidade", uf: "uf" })}
      <div class="form-section"><b>Como receber o valor</b><div class="form-grid">
        <label>Forma de recebimento<select name="forma_desembolso" required><option value="PIX">Pix (chave = seu CPF)</option><option value="CONTA">Conta bancária</option></select></label>
        <div class="conta-banco" hidden>
          <label>Banco<select name="banco"><option value="">Selecione</option>${["Banco do Brasil", "Santander", "Caixa Econômica Federal", "Bradesco", "Itaú", "Nubank", "Inter", "C6 Bank", ...(state.clt?.produto === "FGTS" ? [] : ["PagBank", "Mercado Pago", "PicPay"]), "Banco Original", "Sicoob", "Sicredi"].map((b) => `<option>${b}</option>`).join("")}</select></label>
          <label>Tipo de conta<select name="tipo_conta"><option value="Corrente">Corrente</option><option value="Poupança">Poupança</option><option value="Salário">Salário</option></select></label>
          <div class="form-duo"><label>Agência<input name="agencia" inputmode="numeric"></label><label>Conta<input name="conta" inputmode="numeric"></label></div>
          <label>Dígito da conta<input name="digito_conta"></label>
        </div></div></div>
      ${consentimento}<button class="ap-btn principal grande">Gerar proposta</button></form>`;
  }

  function formDados(d, offer) {
    const tem = (v) => String(v || "").trim() !== "";
    return `<form class="form" data-form="dados">${resumoCondicao(offer)}
      <div class="form-section"><b>Dados pessoais</b><div class="form-grid">
        <label>Nome completo<input name="nome" value="${esc(state.session?.name || d.nome)}" required autocomplete="name"></label>
        ${tem(d.data_nascimento) ? "" : '<label>Data de nascimento<input name="data_nascimento" type="date" required></label>'}
        ${tem(d.sexo) ? "" : '<label>Sexo<select name="sexo" required><option value="">Selecione</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label>'}
        <label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="4">Solteiro(a)</option><option value="3">Casado(a)</option><option value="2">Divorciado(a)</option><option value="5">Viúvo(a)</option><option value="9">União estável</option><option value="6">Outro</option></select></label>
        ${tem(d.nome_mae) ? "" : '<label>Nome completo da mãe<input name="nome_mae" required></label>'}
        <label>Celular<input name="celular" required inputmode="tel" value="${esc(maskTel(d.celular || state.session?.contact))}" autocomplete="tel"></label>
        <label>E-mail<input name="email" type="email" required value="${esc(state.session?.email || "")}" autocomplete="email"></label>
      </div></div>
      <div class="form-section"><b>Documento e naturalidade</b><div class="form-grid">
        <div class="form-duo"><label>Número do RG<input name="rg" required></label><label>UF do RG<select name="estado_rg" required>${opcoesUf("")}</select></label></div>
        <label>Data de expedição do RG<input name="data_expedicao" type="date" required></label>
        <div class="form-duo"><label>Cidade onde nasceu<input name="cidade_natural_nome" required></label><label>UF<select name="estado_natural" required>${opcoesUf("")}</select></label></div>
      </div></div>
      ${campoEndereco({ rua: "endereco", cidade: "cidade_nome", uf: "estado" })}
      <div class="form-section"><b>Conta para receber</b><div class="form-grid">
        <label>Banco<select name="banco" required><option value="">Selecione</option>${BANCOS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></label>
        <label>Tipo de conta<select name="tipo_conta" required><option value="C">Conta corrente</option><option value="P">Conta poupança</option></select></label>
        <div class="form-duo"><label>Agência<input name="agencia" required inputmode="numeric"></label><label>Conta com dígito<input name="conta" required></label></div>
      </div></div>
      <div class="form-section"><b>Chave Pix para receber</b><div class="form-grid">
        <label>Tipo de chave<select name="tipo_chave_pix" required><option value="1">CPF (o seu)</option><option value="2">Telefone</option><option value="3">E-mail</option><option value="4">Chave aleatória</option></select></label>
        <label class="chave-pix" hidden>Chave Pix<input name="chave_pix"></label>
      </div></div>
      ${consentimento}<button class="ap-btn principal grande">Gerar proposta</button></form>`;
  }

  // CEP → rua, bairro, cidade e UF (ViaCEP). Se falhar, o cliente digita.
  async function preencherCep(input) {
    const cep = soDigitos(input.value);
    if (cep.length !== 8) return;
    const form = input.closest("form");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const j = await r.json();
      if (j.erro) return;
      const set = (nomes, v) => { for (const n of nomes) { const el = form.querySelector(`[name="${n}"]`); if (el && v && !el.value) el.value = v; } };
      set(["rua", "endereco"], j.logradouro); set(["bairro"], j.bairro); set(["cidade", "cidade_nome"], j.localidade); set(["uf", "estado"], j.uf);
    } catch {}
  }


  // ── prévia (?demo=) ──────────────────────────────────────────────────────────────────────────────────────────
  const DEMO_OFERTAS = [24, 36, 48, 60].map((n, i) => ({ id: "d" + n, installments: n, installmentValue: 480, disbursedAmount: [9120, 11740, 13380, 14610][i] }));
  function demoClt(tipo) {
    const base = { provider: "unnotech", consentUrl: "https://termo.exemplo/autorizar", maxInstallment: 480, offers: [], parallelFacta: null, customerDefaults: { nome: "Salvador Felipe", celular: "47999999999" }, selectedOffer: null };
    switch (tipo) {
      case "fgts-consulta": return { ...base, produto: "FGTS", etapa: "fgts_cotando" };
      case "fgts-autorizar": return { ...base, produto: "FGTS", etapa: "fgts_autorizar", consentUrl: null };
      case "fgts-oferta": return { ...base, produto: "FGTS", etapa: "ofertas_disponiveis", offers: [{ id: "f1", installments: 5, installmentValue: 480, disbursedAmount: 1920 }] };
      case "fgts-sem": return { ...base, produto: "FGTS", etapa: "sem_oferta", motivoRecusa: "Trabalhador sem adesão ao saque-aniversário", error: "Não há saldo do FGTS disponível para antecipar agora. Isso pode mudar, por exemplo depois do mês do seu aniversário." };
      case "dados-unno": return { ...base, etapa: "dados_pessoais", parallelFacta: "descartada", selectedOffer: DEMO_OFERTAS[1] };
      case "dados-facta": return { ...base, provider: "facta", etapa: "dados_pessoais", parallelFacta: "facta_venceu", selectedOffer: DEMO_OFERTAS[1], customerDefaults: { nome: "Salvador Felipe", celular: "47999999999", sexo: "3", data_nascimento: "16/09/1975", nome_mae: "" } };
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
    if (/resimulate|fgts-requote/.test(path)) return { clt: { ...state.clt } };
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
    if (p === "aguardando") return { k: "whats" };
    if (c.etapa === "autorizacao_enviada" || !p) return { k: "espera" };
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
    if (e.k === "autorizar" && !c.consentUrl) return `<div class="ap-preparando" role="status"><span class="ap-pontos" aria-hidden="true"><i></i><i></i><i></i></span><div><b>Preparando o link de autorização</b><small>O banco está gerando o seu link. Pode levar alguns minutos: deixe esta tela aberta, ele aparece aqui sozinho.</small></div></div>`;
    if (e.k === "autorizar") return `<div class="ap-acoes"><a class="ap-btn principal" href="${esc(c.consentUrl)}" target="_blank" rel="noopener">${IC.cadeado} Autorizar agora</a>
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
    return `<section class="ap-proposta"><span class="ap-tag verde">${c.produto === "FGTS" ? "FGTS" : c.provider === "facta" ? "Facta" : "Unno"} · ${esc(c.proposalCode || "em geração")}</span><h2>${titulo}</h2><p>${sub}</p>
      ${o.disbursedAmount ? `<div class="ap-resumo"><span>Você recebe</span><b>${money(o.disbursedAmount)}</b><small>${c.produto === "FGTS" ? `${o.installments} parcelas anuais de ${money(o.installmentValue)}` : `${o.installments}x de ${money(o.installmentValue)}`} · pagamento via Pix</small></div>` : ""}
      ${etapa === "aguardando_assinatura_facta" && c.contractLink ? `<a class="ap-btn principal grande" href="${esc(c.contractLink)}" target="_blank" rel="noopener">Revisar e assinar</a>` : etapa === "aguardando_assinatura_facta" ? '<div class="ap-gerando"><i class="ap-spin claro"></i><div><b>Gerando o link de assinatura</b><small>Aparece aqui em instantes.</small></div></div>' : ""}</section>`;
  }

  // ── telas ────────────────────────────────────────────────────────────────────────────────────────────────────
  const barraTopo = (extra = "") => `<div class="ap-topo"><span class="ap-marca">FelizCred</span><div class="ap-topo-dir">${extra}${EMBED ? `<button class="ap-icone" type="button" data-acao="fechar-embed" aria-label="Fechar">${IC.x}</button>` : ""}</div></div>`;

  function telaEntrada(erro = "", v = {}) {
    clearInterval(sondagem);
    const login = lerLogin();
    if (login && !state.outrosDados && !erro && !demo) return telaBemVindo(login);
    const fgts = state.produto === "fgts";
    let wa = soDigitos(PARAMS.get("wa")); if (/^55\d{10,11}$/.test(wa)) wa = wa.slice(2);
    const base = { name: v.name ?? "", cpf: v.cpf ?? "", phone: v.phone ?? (wa.length >= 10 ? maskTel(wa) : ""), email: v.email ?? "" };
    app.innerHTML = `${barraTopo()}
      <div class="ap-escolha" role="tablist"><button type="button" class="${fgts ? "" : "on"}" data-acao="produto" data-p="clt">Consignado CLT</button><button type="button" class="${fgts ? "on" : ""}" data-acao="produto" data-p="fgts">Antecipar FGTS</button></div>
      <div class="ap-capa"><span class="ap-tag verde">${fgts ? "Antecipação do FGTS" : "Consignado CLT"} · simulação grátis</span><h1>${fgts ? "Receba seu FGTS antes, sem sair do celular" : "Seu crédito em poucos minutos, sem sair do celular"}</h1>
        <ul class="ap-ponto"><li>${IC.ok}<span>${fgts ? "Consultamos seu saldo nos <b>bancos parceiros</b>" : "Consultamos <b>dois bancos ao mesmo tempo</b>"}</span></li><li>${IC.ok}<span>Você recebe por <b>Pix</b> na sua conta</span></li><li>${IC.ok}<span>Revê o contrato antes de assinar</span></li></ul></div>
      ${erro ? `<div class="ap-erro">${esc(erro)}</div>` : ""}
      <form class="form ap-form" data-form="entrada" autocomplete="on">
        <label>Nome completo<input name="name" value="${esc(base.name)}" required autocomplete="name" enterkeyhint="next"></label>
        <label>CPF<input name="cpf" value="${esc(base.cpf)}" inputmode="numeric" required placeholder="000.000.000-00" enterkeyhint="next"></label>
        <label>Celular com DDD<input name="phone" value="${esc(base.phone)}" inputmode="tel" required placeholder="(00) 00000-0000" autocomplete="tel" enterkeyhint="next"></label>
        <label>E-mail<input name="email" type="email" value="${esc(base.email)}" required autocomplete="email" enterkeyhint="go"></label>
        ${fgts ? "" : '<label class="consent"><input type="checkbox" name="tres_meses" required> Tenho mais de 3 meses de registro no trabalho atual (CLT).</label>'}
        <label class="consent"><input type="checkbox" name="whatsapp" checked> Pode me avisar por WhatsApp quando as condições chegarem.</label>
        <button class="ap-btn principal grande" id="seguir">Simular agora</button>
      </form>
      <p class="ap-rodape">${IC.cadeado} Seus dados ficam salvos neste aparelho para você voltar com um toque. Simulação sem compromisso.</p>`;
  }
  function telaBemVindo(login) {
    const nome = esc(primeiroNome(login.name));
    app.innerHTML = `${barraTopo()}
      <div class="ap-capa"><span class="ap-tag verde">Bem-vindo de volta</span><h1>Olá, ${nome}!</h1><p class="ap-capa-sub">O que você quer simular agora?</p></div>
      <div class="ap-tiles">
        <button class="ap-tile" type="button" data-acao="iniciar" data-p="clt"><span class="ap-tile-ic">C</span><span><b>Consignado CLT</b><small>Para quem tem mais de 3 meses de registro</small></span><i>${IC.seta}</i></button>
        <button class="ap-tile" type="button" data-acao="iniciar" data-p="fgts"><span class="ap-tile-ic fgts">F</span><span><b>Antecipar FGTS</b><small>Saque-aniversário</small></span><i>${IC.seta}</i></button>
      </div>
      <button class="ap-link" type="button" data-acao="outros-dados">Não sou ${nome} · usar outros dados</button>
      <p class="ap-rodape">${IC.cadeado} Usamos os dados que você já informou. Simulação sem compromisso.</p>`;
  }

  function stepper(n, nomes = ["Autorização", "Análise", "Condições", "Contratação"]) {
    return `<ol class="ap-steps">${nomes.map((t, i) => `<li class="${i + 1 < n ? "ok" : i + 1 === n ? "atual" : ""}"><span>${i + 1 < n ? IC.ok : i + 1}</span><em>${t}</em></li>`).join("")}</ol>`;
  }
  function heroTexto(c, u, f, n) {
    const semTudo = u.k === "sem" && f.k === "sem";
    if (semTudo) return ["Nenhum banco liberou agora", "Não encontramos condições para o seu perfil neste momento. Fale com a gente: podemos tentar outro caminho."];
    if (n === 4 && ETAPAS_PROPOSTA.includes(c.etapa)) return ["Falta só assinar", "Sua proposta foi gerada. Revise e assine no ambiente seguro do banco."];
    if (n === 4) return ["Quase lá", "Complete seus dados para gerar a proposta."];
    if (n === 3) return ["Suas condições chegaram", "Ajuste a parcela e o prazo do jeito que couber no seu bolso e contrate."];
    if (n === 1 && !c.consentUrl) return f.k === "whats" ? ["Autorize pelo WhatsApp", "O link do primeiro banco está sendo preparado. Enquanto isso, abra a mensagem do Facta no seu WhatsApp e toque no link."] : ["Preparando sua consulta", "Estamos gerando o link de autorização. Deixe esta tela aberta: ele aparece aqui sozinho."];
    if (n === 1) return ["Autorize a consulta", "Toque em “Autorizar agora” no primeiro banco. Leva menos de um minuto."];
    if (f.k === "whats" && u.k !== "analisando") return ["Falta autorizar no WhatsApp", "Abra a mensagem do Facta no seu WhatsApp e toque no link."];
    return ["Analisando seu perfil", "Os dois bancos estão trabalhando. O primeiro que liberar aparece aqui."];
  }

  // ── FGTS ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const REQUISITOS_FGTS = `<section class="ap-req"><b>O que é preciso para antecipar</b><ul>
      <li>Estar no <b>saque-aniversário</b> do FGTS e ter saldo.</li><li>Ter de 18 a 69 anos e o CPF regular na Receita.</li>
      <li>Receber em conta de <b>sua titularidade</b>. Contas digitais como PagBank, Mercado Pago e PicPay não são aceitas.</li>
      <li>Uma antecipação por ano. Valor de R$ 100 a R$ 500 por parcela anual (até R$ 2.500).</li>
      <li>Quem acabou de aderir ao saque-aniversário pode precisar aguardar até 90 dias.</li></ul></section>`;
  const NOMES_FGTS = ["Consulta", "Autorização", "Condições", "Contratação"];
  const ETAPAS_SEM_FGTS = ["sem_oferta", "sem_margem", "nao_elegivel", "erro_consulta", "erro_integracao", "proposta_cancelada"];
  function passoFgts(c) {
    if (ETAPAS_PROPOSTA.includes(c.etapa) || c.etapa === "dados_pessoais") return 4;
    if (c.etapa === "ofertas_disponiveis") return 3;
    if (c.etapa === "fgts_autorizar") return 2;
    return 1;
  }
  function cartaoFgtsAndamento(c) {
    const sem = ETAPAS_SEM_FGTS.includes(c.etapa);
    const t = sem ? ["ok", "ok", "falha"] : c.etapa === "fgts_autorizar" ? ["ok", "atual", "pendente"] : ["ofertas_disponiveis", "dados_pessoais"].includes(c.etapa) || ETAPAS_PROPOSTA.includes(c.etapa) ? ["ok", "ok", "ok"] : ["atual", "pendente", "pendente"];
    const nomes = ["Consulta do seu saldo", "Autorização no app do FGTS", "Condição liberada"];
    const vivo = !sem && t.includes("atual");
    return `<section class="ap-banco ${vivo ? "vivo" : ""} ${sem ? "apagado" : ""}"><header><span class="ap-logo fgts">F</span><div><b>Antecipação do FGTS</b><small>Bancos parceiros</small></div>
      <span class="ap-tag ${sem ? "cinza" : vivo ? "laranja" : "verde"}">${vivo ? '<i class="ap-pulso"></i>' : ""}${sem ? "Sem condições" : vivo ? "Em andamento" : "Liberou"}</span></header>
      <ul class="ap-lista">${nomes.map((n, i) => `<li class="ap-li ${t[i]}"><span class="ap-bolinha">${t[i] === "ok" ? IC.ok : t[i] === "falha" ? IC.x : ""}</span><span>${n}</span></li>`).join("")}</ul></section>`;
  }
  function cartaoAutorizarFgts(retentar = false, c = {}) {
    return `<section class="ap-banco vivo"><header><span class="ap-logo fgts">F</span><div><b>${retentar ? "Já autorizou os bancos no app do FGTS?" : "Autorize no app do FGTS"}</b><small>${retentar ? "Se ainda não, faça agora e consulte de novo" : "Leva menos de um minuto"}</small></div><span class="ap-tag laranja"><i class="ap-pulso"></i>${retentar ? "Confira" : "Falta você"}</span></header>
      ${retentar && c.motivoRecusa ? `<p class="ap-dica" style="margin-top:12px"><b>Motivo informado pelo banco:</b> ${esc(c.motivoRecusa)}</p>` : ""}
      <ol class="ap-passos">
        <li><span>1</span><p><b>Abra o aplicativo FGTS</b> (ou entre em fgts.caixa.gov.br) e faça login.</p></li>
        <li><span>2</span><p>Vá em <b>Meu FGTS › Autorizações</b>.</p></li>
        <li><span>3</span><p><b>Autorize estes 3 bancos:</b><br><em>J17 Sociedade de Crédito Direto S/A · BMP Sociedade de Crédito Direto S.A. · BMP Sociedade de Crédito ao Microempreendedor e à Empresa de Pequeno Porte Ltda</em></p></li>
        <li><span>4</span><p><b>Volte aqui</b> e toque em “Já autorizei”. A autorização vale por 90 dias.</p></li></ol>
      <div class="ap-acoes"><a class="ap-btn suave" href="https://fgts.caixa.gov.br" target="_blank" rel="noopener">Abrir o site do FGTS</a>
        <button class="ap-btn principal" type="button" data-acao="fgts-requote" ${state.fgtsLoading ? "disabled" : ""}>${state.fgtsLoading ? '<i class="ap-spin"></i> Consultando de novo…' : "Já autorizei, consultar de novo"}</button></div></section>`;
  }
  function cartaoOfertaFgts(c) {
    const o = (c.offers || [])[0];
    if (!o) return "";
    return `<section class="ap-sim"><div class="ap-sim-topo"><span class="ap-tag verde">Antecipação do FGTS</span><span class="ap-pixmini">${IC.pix} Pix</span></div>
      <p class="ap-rotulo">Você recebe</p><p class="ap-valor">${money0(o.disbursedAmount)}</p>
      <p class="ap-sub"><b>${o.installments}</b> parcelas anuais de <b>${money(o.installmentValue)}</b></p>
      <p class="ap-dica" style="margin-top:8px">Uma parcela por ano, paga automaticamente pelo seu FGTS. Valores estimados: o banco confirma na hora de gerar a proposta.</p>
      <button class="ap-btn principal grande" style="margin-top:14px" type="button" data-acao="escolher" data-id="${esc(o.id)}" ${state.escolhendo ? "disabled" : ""}>${state.escolhendo ? '<i class="ap-spin"></i> Preparando…' : "Contratar esta antecipação"}</button>
      <p class="ap-pixnota">${IC.pix}<span>O dinheiro cai por <b>Pix</b> ou na conta de sua titularidade. Você revê o contrato inteiro antes de assinar.</span></p></section>`;
  }
  function telaFgts() {
    const c = state.clt;
    const nome = String(state.session?.name || "").trim().split(/\s+/)[0] || "";
    const n = passoFgts(c), temProposta = ETAPAS_PROPOSTA.includes(c.etapa), sem = ETAPAS_SEM_FGTS.includes(c.etapa);
    let titulo, sub;
    if (sem) { titulo = "Não há antecipação disponível agora"; sub = c.error || "Os bancos não encontraram uma condição para o seu FGTS neste momento."; }
    else if (temProposta) { titulo = "Falta só assinar"; sub = "Sua proposta foi gerada. Revise e assine no ambiente seguro do banco."; }
    else if (n === 4) { titulo = "Quase lá"; sub = "Complete seus dados para gerar a proposta."; }
    else if (n === 3) { titulo = "Sua antecipação está liberada"; sub = "Confira o valor e contrate. Você recebe por Pix."; }
    else if (n === 2) { titulo = "Autorize os bancos no app do FGTS"; sub = "Para consultar seu saldo, o FGTS precisa da sua autorização. Você faz direto no aplicativo, em menos de um minuto."; }
    else { titulo = "Consultando seu FGTS"; sub = "Estamos pedindo as condições aos bancos. Isso leva alguns instantes."; }
    app.innerHTML = `${barraTopo(`<span class="ap-ola">Olá, ${esc(nome)}</span><button class="ap-avatar" type="button" data-acao="menu" title="Menu">${esc(nome.slice(0, 1).toUpperCase() || "F")}</button>`)}
      ${stepper(n, NOMES_FGTS)}
      <section class="ap-hero ${sem ? "erro" : ""}"><h1>${titulo}</h1><p>${esc(sub)}</p>${n === 1 && !sem ? '<div class="ap-barra"><i></i></div>' : ""}</section>
      ${state.aviso ? `<div class="ap-aviso">${esc(state.aviso)}</div>` : ""}${state.erro ? `<div class="ap-erro">${esc(state.erro)}</div>` : ""}
      ${temProposta ? cartaoProposta(c) : ""}
      ${c.etapa === "dados_pessoais" ? '<section class="ap-sim"><p class="ap-sub">Condição escolhida. Falta completar seus dados.</p><button class="ap-btn principal grande" type="button" data-acao="abrir-dados">Completar dados</button></section>' : ""}
      ${n === 3 ? cartaoOfertaFgts(c) : ""}
      ${n === 2 ? cartaoAutorizarFgts() : ""}
      ${sem && ["sem_oferta", "erro_consulta"].includes(c.etapa) ? cartaoAutorizarFgts(true, c) : ""}
      ${temProposta ? "" : (n === 2 ? "" : `<p class="ap-secao">Andamento</p><div class="ap-bancos">${cartaoFgtsAndamento(c)}</div>`)}
      ${n <= 2 || sem ? REQUISITOS_FGTS : ""}
      ${sem ? `<div class="ap-acoes pad"><button class="ap-btn principal grande" type="button" data-acao="chat">Falar com a FelizCred</button></div>` : ""}
      <div class="ap-selopix">${IC.pix}<span>Pagamento sempre via <b>Pix</b></span></div>`;
  }

  function telaApp() {
    if (state.clt?.produto === "FGTS") return telaFgts();
    const c = state.clt;
    const nome = String(state.session?.name || "").trim().split(/\s+/)[0] || "";
    const u = estadoUnno(c), f = estadoFacta(c);
    const n = passo(c, u, f);
    const [titulo, sub] = heroTexto(c, u, f, n);
    const temProposta = ETAPAS_PROPOSTA.includes(c.etapa);
    const semTudo = u.k === "sem" && f.k === "sem";
    const bancoOfertas = u.k === "ofertas" ? "unno" : f.k === "ofertas" ? "facta" : null;
    const mostrarOfertas = !!bancoOfertas && !temProposta && c.etapa !== "dados_pessoais";
    app.innerHTML = `${barraTopo(`<span class="ap-ola">Olá, ${esc(nome)}</span><button class="ap-avatar" type="button" data-acao="menu" title="Menu">${esc(nome.slice(0, 1).toUpperCase() || "F")}</button>`)}
      ${stepper(n)}
      <section class="ap-hero ${semTudo ? "erro" : ""}"><h1>${titulo}</h1><p>${sub}</p>${!semTudo && !temProposta && n === 2 ? '<div class="ap-barra"><i></i></div>' : ""}</section>
      ${state.aviso ? `<div class="ap-aviso">${esc(state.aviso)}</div>` : ""}${state.erro ? `<div class="ap-erro">${esc(state.erro)}</div>` : ""}
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
      <div class="pix-faixa"><span>${IC.pix}</span><div><b>O pagamento é feito via Pix</b><small>O pagamento é por Pix (ou na conta que você escolher). Você revê o contrato inteiro antes de assinar.</small></div></div>
      ${demo ? notaDemo(c) : ""}<div class="erro-sheet"></div>${form}
      <button class="ap-btn suave" type="button" data-acao="fechar-sheet" style="margin:10px 20px 0;width:calc(100% - 40px)">Voltar</button></div>`;
    sheet.classList.add("aberta"); document.body.classList.add("trava");
  }
  function notaDemo(c) {
    const auto = c.provider === "unnotech"
      ? ["Escolaridade: ensino médio", "Órgão emissor do RG: SSP", "CPF, valores e prazo da condição"]
      : ["Sexo, nascimento, renda, matrícula, empresa e admissão (vêm da consulta)", "Chave Pix: o CPF (se o cliente não escolher outra)", "Faixa de patrimônio: até R$ 10 mil", "Órgão emissor do RG: SSP", "Nacionalidade: brasileira", "Assinatura a rogo: não", "Nome do pai: não declarado"];
    return `<div class="ap-demo-nota"><b>Prévia · o cliente NÃO vê estes campos</b><ul>${auto.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
  }
  function fecharSheet() { sheet.classList.remove("aberta"); document.body.classList.remove("trava"); sheet.innerHTML = ""; }

  // ── ajuda (chat) ─────────────────────────────────────────────────────────────────────────────────────────────
  // O chat sabe em que etapa o cliente está: mostra a etapa e atalhos com as dúvidas mais comuns daquela etapa.
  function statusAtual() {
    const c = state.clt;
    if (!c) return { linha: "Preenchendo seus dados", atalhos: ["Preciso de ajuda para começar"] };
    const falar = "Quero falar com um atendente";
    if (c.produto === "FGTS") {
      if (c.etapa === "fgts_cotando") return { linha: "Consultando seu FGTS", atalhos: ["Está demorando para consultar", falar] };
      if (c.etapa === "fgts_autorizar") return { linha: "Falta autorizar os bancos no app do FGTS", atalhos: ["Não sei autorizar no app do FGTS", "Já autorizei e não avançou", falar] };
      if (c.etapa === "ofertas_disponiveis") return { linha: "Antecipação liberada: falta contratar", atalhos: ["Tenho dúvida sobre o valor", falar] };
      if (c.etapa === "dados_pessoais") return { linha: "Preenchendo os dados da proposta", atalhos: ["Tenho dúvida em um campo", falar] };
      if (ETAPAS_PROPOSTA.includes(c.etapa)) return { linha: "Proposta gerada: falta assinar", atalhos: ["Não consigo assinar", falar] };
      return { linha: "Sem condições agora", atalhos: [falar] };
    }
    const u = estadoUnno(c), f = estadoFacta(c);
    if (ETAPAS_PROPOSTA.includes(c.etapa)) return { linha: "Proposta gerada: falta assinar", atalhos: ["Não consigo assinar", falar] };
    if (c.etapa === "dados_pessoais") return { linha: "Preenchendo os dados da proposta", atalhos: ["Tenho dúvida em um campo", falar] };
    if (u.k === "ofertas" || f.k === "ofertas") return { linha: "Condições liberadas: falta contratar", atalhos: ["Tenho dúvida sobre os valores", falar] };
    if (u.k === "autorizar" && !c.consentUrl && f.k !== "whats") return { linha: "Preparando o link do 1º banco (Unno)", atalhos: ["O link está demorando", falar] };
    if (u.k === "autorizar") return { linha: "Falta autorizar no 1º banco (Unno)", atalhos: ["Não consigo abrir o link", "Já autorizei e não avançou", falar] };
    if (f.k === "whats") return { linha: "Falta autorizar no WhatsApp (Facta)", atalhos: ["Não recebi a mensagem do Facta", "Já autorizei e não avançou", falar] };
    if (u.k === "analisando") return { linha: "Bancos analisando seu perfil", atalhos: ["Está demorando", falar] };
    return { linha: "Sem condições agora", atalhos: [falar] };
  }
  function desenharChat() {
    if (!state.chat.aberto) return;
    const msgs = state.chat.msgs.filter((m) => !/^Tenho interesse em:/.test(String(m.body || "")));
    const corpo = msgs.length ? msgs.map((m) => `<div class="ap-msg ${m.direction === "visitor" ? "eu" : "eles"}">${esc(m.body)}</div>`).join("") : '<p class="ap-vazio">Oi! Se tiver qualquer dúvida sobre a simulação, escreva aqui ou toque em um atalho. Respondemos no horário de atendimento.</p>';
    const st = statusAtual();
    sheet.innerHTML = `<div class="fundo" data-acao="fechar-chat"></div><div class="folha ap-chat" role="dialog" aria-modal="true" aria-label="Ajuda">
      <div class="puxador"></div><div class="ap-chat-topo"><b>Fale com a FelizCred</b><button class="ap-icone claro" type="button" data-acao="fechar-chat" aria-label="Fechar">${IC.x}</button></div>
      <div class="ap-status"><span>Você está em</span><b>${esc(st.linha)}</b></div>
      <div class="ap-msgs" id="ap-msgs">${corpo}</div>
      <div class="ap-atalhos">${st.atalhos.map((t) => `<button type="button" data-acao="atalho" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <form class="ap-chat-form" data-form="chat"><input name="msg" placeholder="Escreva sua dúvida" autocomplete="off" required><button class="ap-btn principal" ${state.chat.enviando ? "disabled" : ""}>Enviar</button></form></div>`;
    sheet.classList.add("aberta"); document.body.classList.add("trava");
    const m = document.getElementById("ap-msgs"); if (m) m.scrollTop = m.scrollHeight;
  }
  async function enviarMensagem(texto) {
    const t = String(texto || "").trim(); if (!t || demo) return;
    state.chat.msgs.push({ direction: "visitor", body: t }); desenharChat();
    try { await api(`/conversations/${state.session.id}`, { method: "POST", body: JSON.stringify({ message: t }) }); await carregarChat(); } catch (erro) { state.chat.msgs.push({ direction: "agent", body: erro.message }); desenharChat(); }
  }
  async function carregarChat() {
    if (!state.session || demo) return;
    try { const d = await api(`/conversations/${state.session.id}`); const novas = d.messages || []; const mudou = novas.length !== state.chat.msgs.length; state.chat.msgs = novas; if (mudou && state.chat.aberto && !document.activeElement?.closest?.(".ap-chat-form")) desenharChat(); } catch {}
  }
  function abrirChat() {
    if (!state.session) { telaEntrada("Preencha seus dados para falar com a gente."); return; }
    state.chat.aberto = true; desenharChat(); carregarChat(); clearInterval(sondagemChat); sondagemChat = setInterval(carregarChat, 6000);
  }
  function fecharChat() { state.chat.aberto = false; clearInterval(sondagemChat); fecharSheet(); }

  // ── dados do servidor ────────────────────────────────────────────────────────────────────────────────────────
  const assinaturaClt = (c) => JSON.stringify([c?.produto, c?.provider, c?.etapa, c?.status, c?.parallelFacta, c?.error, (c?.offers || []).map((o) => o.id + o.installmentValue).join(), c?.consentUrl, c?.contractLink, c?.proposalCode, c?.motivoRecusa]);
  function aplicar(clt) {
    const mudou = assinaturaClt(clt) !== state.assinatura;
    state.clt = clt; state.assinatura = assinaturaClt(clt);
    if (mudou) { state.atualizando = false; state.parcela = null; state.prazo = null; if (!state.chat.aberto) telaApp(); }
  }
  async function atualizar() {
    if (!state.session || demo) return;
    try { const d = await api(`/conversations/${state.session.id}/clt/status`); state.session.lastSeen = Date.now(); if (d.clt) aplicar(d.clt); } catch (erro) { if (erro.status === 401 || erro.status === 404) reiniciarSozinho(); }
  }
  function iniciarSondagem() { clearInterval(sondagem); if (demo) return; sondagem = setInterval(() => { if (!document.hidden && !sheet.classList.contains("aberta")) atualizar(); }, 3000); }
  // Sessão vencida (3 dias sem uso, ou o servidor não reconhece mais): recomeça sozinho com os dados salvos.
  function reiniciarSozinho() {
    const login = lerLogin(); limparSessao(); try { localStorage.removeItem(KEY); } catch {}
    if (!login) { state.outrosDados = true; return telaEntrada(); }
    state.aviso = "Sua simulação anterior venceu, então começamos uma nova com os seus dados.";
    abrir(login);
  }
  function limparSessao() { clearInterval(sondagem); clearInterval(sondagemChat); state.session = null; state.clt = null; state.assinatura = ""; state.chat = { aberto: false, msgs: [], enviando: false }; state.erro = ""; state.aviso = ""; fecharSheet(); }
  function sair() { try { localStorage.removeItem(KEY); localStorage.removeItem(LOGIN_KEY); } catch {} limparSessao(); state.outrosDados = true; telaEntrada(); }

  // Cria a conversa e já inicia a simulação do produto escolhido (CLT: Unno na frente + Facta em paralelo; FGTS: bancos parceiros).
  async function abrir(d) {
    const produto = d.produto === "fgts" ? "fgts" : "clt";
    state.produto = produto; state.outrosDados = false;
    clearInterval(sondagem);
    app.innerHTML = '<div class="splash"><span class="spinner" aria-hidden="true"></span><p>Abrindo sua simulação…</p></div>';
    try {
      const r = await fetch(`${API}/conversations`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: d.name, contact: d.phone, email: d.email, whatsappOptIn: d.whatsapp !== false, message: produto === "fgts" ? "Tenho interesse em: FGTS" : "Tenho interesse em: Empréstimo CLT", pageUrl: location.origin + "/app/" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível começar agora.");
      state.clt = null; state.assinatura = "";
      guardar({ id: j.conversation.id, token: j.token, name: d.name, contact: d.phone, email: d.email, produto, startedAt: Date.now(), expiresAt: Date.now() + TRINTA_DIAS });
      guardarLogin({ name: d.name, cpf: d.cpf, phone: d.phone, email: d.email, whatsapp: d.whatsapp !== false, produto });
      const s = produto === "fgts"
        ? await api(`/conversations/${state.session.id}/clt/fgts-start`, { method: "POST", body: JSON.stringify({ cpf: d.cpf }) })
        : await api(`/conversations/${state.session.id}/clt/start`, { method: "POST", body: JSON.stringify({ name: d.name, cpf: d.cpf, phone: d.phone }) });
      aplicar(s.clt); iniciarSondagem();
    } catch (erro) { limparSessao(); state.outrosDados = true; telaEntrada(erro.message, { name: d.name, cpf: maskCpf(d.cpf), phone: maskTel(d.phone), email: d.email }); }
  }
  async function seguir(form) {
    const d = new FormData(form);
    const name = String(d.get("name") || "").trim().replace(/\s+/g, " ");
    const cpf = soDigitos(d.get("cpf")), phone = soDigitos(d.get("phone")), email = String(d.get("email") || "").trim().toLowerCase();
    const v = { name, cpf: maskCpf(cpf), phone: maskTel(phone), email };
    if (name.split(" ").filter(Boolean).length < 2) return telaEntrada("Digite seu nome completo, como aparece no documento.", v);
    if (cpf.length !== 11) return telaEntrada("Digite um CPF válido.", v);
    if (phone.length < 10) return telaEntrada("Digite um celular com DDD.", v);
    const botao = form.querySelector("#seguir"); botao.disabled = true; botao.textContent = "Abrindo…";
    await abrir({ name, cpf, phone, email, whatsapp: d.has("whatsapp"), produto: state.produto });
  }
  function abrirMenu() {
    const login = lerLogin();
    sheet.innerHTML = `<div class="fundo" data-acao="fechar-sheet"></div><div class="folha ap-menu" role="dialog" aria-modal="true" aria-label="Menu"><div class="puxador"></div>
      ${login ? `<p class="ap-menu-ola">${esc(login.name)}</p>` : ""}
      ${login ? `<button class="ap-menu-item" type="button" data-acao="iniciar" data-p="clt"><b>Nova simulação de CLT</b><small>Recomeça com os seus dados</small></button>
      <button class="ap-menu-item" type="button" data-acao="iniciar" data-p="fgts"><b>Nova simulação de FGTS</b><small>Recomeça com os seus dados</small></button>` : ""}
      <button class="ap-menu-item" type="button" data-acao="chat"><b>Falar com a FelizCred</b><small>Tire dúvidas sobre a sua simulação</small></button>
      <button class="ap-menu-item" type="button" data-acao="outros-dados"><b>Trocar meus dados</b><small>Usar outro nome, CPF ou celular</small></button>
      <button class="ap-menu-item sair" type="button" data-acao="sair"><b>Sair deste aparelho</b><small>Apaga os dados salvos aqui</small></button></div>`;
    sheet.classList.add("aberta"); document.body.classList.add("trava");
  }

  document.addEventListener("input", (e) => {
    if (e.target.name === "cpf" && e.target.closest(".ap-form")) e.target.value = maskCpf(e.target.value);
    if (e.target.name === "phone" && e.target.closest(".ap-form")) e.target.value = maskTel(e.target.value);
    if (e.target.name === "cep" && e.target.closest("form[data-form=dados]")) { const d = soDigitos(e.target.value).slice(0, 8); e.target.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; preencherCep(e.target); }
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
    if (e.target.name === "forma_desembolso") {
      const conta = sheet.querySelector(".conta-banco");
      if (conta) { conta.hidden = e.target.value !== "CONTA"; conta.querySelectorAll("input, select").forEach((el) => { el.required = e.target.value === "CONTA" && el.name !== "complemento"; }); }
    }
    if (e.target.name === "tipo_chave_pix") {
      const campo = sheet.querySelector(".chave-pix");
      if (campo) { campo.hidden = e.target.value === "1"; const i = campo.querySelector("input"); i.required = e.target.value !== "1"; if (e.target.value === "1") i.value = ""; }
    }
    if (e.target.name === "cliente_iletrado_impossibilitado") { const rogo = sheet.querySelector(".rogo"); if (rogo) rogo.hidden = e.target.value !== "S"; }
  });
  document.addEventListener("click", async (e) => {
    const alvo = e.target.closest("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === "sair") return sair();
    if (acao === "menu") return abrirMenu();
    if (acao === "fechar-embed") { try { parent.postMessage({ fcApp: "close" }, "*"); } catch {} return; }
    if (acao === "iniciar") {
      const login = lerLogin(); fecharSheet();
      if (!login) { state.produto = alvo.dataset.p === "fgts" ? "fgts" : "clt"; limparSessao(); state.outrosDados = true; return telaEntrada(); }
      limparSessao(); return abrir({ ...login, produto: alvo.dataset.p });
    }
    if (acao === "outros-dados") { limparSessao(); fecharSheet(); state.outrosDados = true; return telaEntrada(); }
    if (acao === "atalho") { await enviarMensagem(alvo.dataset.t); return; }
    if (acao === "produto") {
      const f = document.querySelector("form[data-form=entrada]"); const d = f ? new FormData(f) : new FormData();
      state.produto = alvo.dataset.p === "fgts" ? "fgts" : "clt";
      return telaEntrada("", { name: d.get("name") || "", cpf: d.get("cpf") || "", phone: d.get("phone") || "", email: d.get("email") || "" });
    }
    if (acao === "fgts-requote") {
      if (state.fgtsLoading) return;
      state.fgtsLoading = true; state.erro = ""; telaApp();
      try { const d = await api(`/conversations/${state.session.id}/clt/fgts-requote`, { method: "POST", body: "{}" }); state.fgtsLoading = false; state.assinatura = ""; aplicar(d.clt); }
      catch (erro) { state.fgtsLoading = false; state.erro = erro.message; telaApp(); }
      return;
    }
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
      const campo = form.querySelector("input[name=msg]"); const texto = campo.value.trim(); campo.value = "";
      if (texto) await enviarMensagem(texto);
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
  window.addEventListener("focus", () => { if (state.session) atualizar(); });

  // Botão de ajuda fixo no canto de baixo (celular, computador e gaveta).
  const fab = document.createElement("button");
  fab.type = "button"; fab.className = "ap-fab"; fab.dataset.acao = "chat"; fab.setAttribute("aria-label", "Falar com a FelizCred");
  fab.innerHTML = `${IC.chat}<span>Ajuda</span>`;
  document.body.appendChild(fab);

  // ── início ───────────────────────────────────────────────────────────────────────────────────────────────────
  function barraDemo() {
    const lista = ["autorizar", "analisando", "whatsapp", "ofertas", "dados-unno", "dados-facta", "proposta", "sem", "fgts-consulta", "fgts-autorizar", "fgts-oferta", "fgts-sem"];
    const el = document.createElement("div"); el.className = "ap-demo";
    el.innerHTML = '<b>Prévia</b>' + lista.map((k) => `<a href="?demo=${k}" class="${k === demo ? "on" : ""}">${k}</a>`).join("") + '<a href="?demo=entrada" class="' + (demo === "entrada" ? "on" : "") + '">entrada</a>';
    document.body.prepend(el);
  }
  if (demo) {
    barraDemo();
    state.session = { id: "demo", token: "demo", name: "Salvador Felipe", contact: "47999999999", email: "demo@teste.com" };
    if (demo === "entrada") telaEntrada(); else { state.clt = demoClt(demo); state.assinatura = assinaturaClt(state.clt); telaApp(); if (/^dados-/.test(demo)) abrirSheet(); }
  } else {
    boot();
  }
  async function boot() {
    const t = PARAMS.get("t");
    if (t) {
      try {
        const r = await fetch(`${API}/access`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Esse link expirou.");
        guardar({ id: d.conversation.id, token: d.token, name: d.conversation.name, contact: d.conversation.contact || "", email: d.conversation.email || "", produto: /fgts/i.test(String(d.conversation.product || "")) ? "fgts" : "clt", startedAt: Date.now(), expiresAt: Date.now() + TRINTA_DIAS });
        history.replaceState(null, "", location.pathname + (EMBED ? "?embed=1" : ""));
      } catch (erro) { state.aviso = erro.message + " Entre com seus dados para continuar."; }
    }
    const s = state.session || lerSessao();
    if (!s) return telaEntrada();
    state.session = s;
    const velha = Date.now() - Number(s.lastSeen || s.startedAt || 0) > TRES_DIAS;
    try {
      const d = await api(`/conversations/${s.id}/clt/status`);
      // Passou o prazo: recomeça sozinho, EXCETO se já existe proposta gerada (o cliente não pode perder o link de assinatura).
      if (velha && !(d.clt && ETAPAS_PROPOSTA.includes(d.clt.etapa))) return reiniciarSozinho();
      if (!d.clt) { limparSessao(); return telaEntrada(); }
      guardar(s); aplicar(d.clt); iniciarSondagem();
    } catch (erro) { reiniciarSozinho(); }
  }
})();
