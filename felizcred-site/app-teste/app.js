// FelizCred · App de teste (Unno + Facta lado a lado). Página escondida: não tem link no site e não é indexada.
(() => {
  "use strict";
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:3000/site-chat" : "https://meuwhats.onrender.com/site-chat";
  const KEY = "felizcred_app_teste_v1";
  const app = document.getElementById("app");
  const sheet = document.getElementById("sheet");
  const state = { session: null, clt: null, erro: "", carregando: "", escolhendo: "", assinatura: "" };
  let sondagem = null;

  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inputDate = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ""); };
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  const maskCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  const maskTel = (v) => { const d = soDigitos(v).slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };

  async function api(path, opts = {}) {
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

  // ── tela de entrada (parece um login) ────────────────────────────────────────────────────────────────────────
  function telaEntrada(erro = "", v = {}) {
    clearInterval(sondagem);
    app.innerHTML = `<div class="topo"><span class="marca">FelizCred</span><span class="chip cinza">Versão de teste</span></div>
      <div class="cabeca"><h1>Acesse sua simulação</h1><p class="sub">Informe seus dados uma vez. Depois é só autorizar e escolher a melhor condição. O dinheiro cai por <b>Pix</b>.</p></div>
      ${erro ? `<div class="erro">${esc(erro)}</div>` : ""}
      <form class="form entrada" data-form="entrada" autocomplete="on">
        <label>Nome completo<input name="name" value="${esc(v.name || "")}" required autocomplete="name"></label>
        <label>CPF<input name="cpf" value="${esc(v.cpf || "")}" inputmode="numeric" required placeholder="000.000.000-00"></label>
        <label>Celular com DDD<input name="phone" value="${esc(v.phone || "")}" inputmode="tel" required placeholder="(00) 00000-0000" autocomplete="tel"></label>
        <label>E-mail<input name="email" type="email" value="${esc(v.email || "")}" required autocomplete="email"></label>
        <label class="consent"><input type="checkbox" name="tres_meses" required> Tenho mais de 3 meses de registro no trabalho atual (CLT).</label>
        <label class="consent"><input type="checkbox" name="whatsapp" checked> Pode me avisar por WhatsApp quando as condições chegarem.</label>
        <button class="btn primario grande" id="seguir">Seguir</button>
      </form>
      <p class="rodape-seguro">🔒 Seus dados são usados só para consultar as condições.</p>`;
  }

  // ── estado dos dois bancos ───────────────────────────────────────────────────────────────────────────────────
  const ETAPAS_PROPOSTA = ["aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida", "proposta_cancelada"];
  const ETAPAS_SEM = ["sem_margem", "sem_oferta", "nao_elegivel", "erro_consulta", "erro_integracao", "erro_autorizacao", "politica_reprovada", "proposta_cancelada"];
  function estadoUnno(c) {
    if (c.provider !== "unnotech") return { k: c.parallelFacta === "facta_venceu" ? "dispensado" : "sem" };
    if (c.etapa === "autorizacao_enviada") return { k: "autorizar" };
    if (["consultando_margem", "simulando"].includes(c.etapa)) return { k: "analisando" };
    if (c.etapa === "ofertas_disponiveis") return { k: "ofertas" };
    if (c.etapa === "dados_pessoais") return { k: "escolhida" };
    if (ETAPAS_PROPOSTA.includes(c.etapa) && c.etapa !== "proposta_cancelada") return { k: "proposta" };
    return { k: "sem" };
  }
  function estadoFacta(c) {
    if (c.provider === "facta") {
      if (["autorizacao_enviada", "aguardando_autorizacao", "solicitando_autorizacao"].includes(c.etapa)) return { k: "whats" };
      if (c.etapa === "ofertas_disponiveis") return { k: "ofertas" };
      if (c.etapa === "dados_pessoais") return { k: "escolhida" };
      if (["aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida"].includes(c.etapa)) return { k: "proposta" };
      return { k: "sem" };
    }
    const p = c.parallelFacta;
    if (c.etapa === "autorizacao_enviada" || !p) return { k: "espera" };
    if (p === "aguardando") return { k: "whats" };
    if (p === "descartada") return { k: "dispensado" };
    return { k: "sem" };
  }

  const ICONE_BANCO = { unno: "U", facta: "F" };
  function listaOfertas(c, banco) {
    const ofertas = c.offers || [];
    return `<div class="ofertas">${ofertas.map((o, i) => `<button class="oferta ${i === 0 ? "melhor" : ""}" type="button" data-acao="escolher" data-id="${esc(o.id)}" ${state.escolhendo ? "disabled" : ""}>
        ${i === 0 && ofertas.length > 1 ? '<span class="selo">Mais dinheiro na mão</span>' : ""}
        <span class="rec">Você recebe</span><b class="val">${money(o.disbursedAmount)}</b>
        <span class="par">${o.installments} parcelas de <b>${money(o.installmentValue)}</b></span>
        <span class="go">${state.escolhendo === o.id ? '<i class="mini-spin"></i> Preparando…' : "Quero esta condição →"}</span></button>`).join("")}</div>
      <p class="pix">💸 Pagamento via <b>Pix</b> direto na sua conta.</p>`;
  }
  function caixaBanco(banco, e, c) {
    const nome = banco === "unno" ? "Unno" : "Facta";
    const ativo = ["ofertas", "escolhida", "proposta"].includes(e.k);
    let corpo = "", chip = "";
    switch (e.k) {
      case "autorizar":
        chip = '<span class="chip aviso">Falta você</span>';
        corpo = `<p>Toque no botão, confirme a autorização e volte aqui.</p>
          ${c.consentUrl ? `<a class="btn primario" href="${esc(c.consentUrl)}" target="_blank" rel="noopener">Autorizar no Unno</a>` : '<button class="btn primario" disabled>Preparando o link…</button>'}
          <button class="btn contorno" type="button" data-acao="atualizar">Pronto, já autorizei</button>`; break;
      case "espera":
        chip = '<span class="chip cinza">Na fila</span>';
        corpo = '<p>Assim que você autorizar o primeiro banco, enviamos a autorização do Facta no seu WhatsApp.</p>'; break;
      case "whats":
        chip = '<span class="chip espera">Aguardando</span>';
        corpo = `<div class="carregando"><span class="ponto"><i></i><i></i></span><div><b>Enviamos a autorização no seu WhatsApp</b><small>Abra a mensagem do Facta, toque no link e libere. Conferimos sozinhos.</small></div></div>`; break;
      case "analisando":
        chip = '<span class="chip espera">Analisando</span>';
        corpo = '<div class="carregando"><span class="ponto"><i></i><i></i></span><div><b>O banco está analisando</b><small>Leva alguns minutos. Pode ficar nesta tela.</small></div></div>'; break;
      case "ofertas":
        chip = '<span class="chip claro">Condições liberadas</span>';
        corpo = listaOfertas(c, banco); break;
      case "escolhida":
        chip = '<span class="chip claro">Condição escolhida</span>';
        corpo = '<p>Complete seus dados para gerar a proposta.</p><button class="btn primario" type="button" data-acao="abrir-dados">Completar dados</button>'; break;
      case "proposta":
        chip = '<span class="chip claro">Proposta gerada</span>';
        corpo = '<p>Sua proposta está logo abaixo.</p>'; break;
      case "dispensado":
        chip = '<span class="chip cinza">Não precisou</span>';
        corpo = '<p>Outro banco liberou primeiro, então não foi preciso consultar este.</p>'; break;
      default:
        chip = '<span class="chip cinza">Sem condições</span>';
        corpo = '<p>Este banco não liberou valores agora.</p>';
    }
    return `<section class="banco ${ativo ? "ativo" : ""} k-${e.k}"><header><span class="logo">${ICONE_BANCO[banco]}</span><div><b>${nome}</b><small>${banco === "unno" ? "1º banco · autorização por link" : "2º banco · autorização por WhatsApp"}</small></div>${chip}</header><div class="corpo">${corpo}</div></section>`;
  }

  function cartaoProposta(c) {
    const o = c.selectedOffer || {};
    const etapa = c.etapa;
    const titulo = etapa === "proposta_concluida" ? "Proposta concluída 🎉" : etapa === "proposta_em_analise" ? "Banco analisando sua assinatura" : "Sua proposta foi gerada";
    const sub = etapa === "aguardando_assinatura_facta" ? "Falta revisar e assinar. Você vê o contrato completo antes de decidir." : etapa === "proposta_em_analise" ? "Recebemos sua assinatura. Atualizamos aqui sozinhos." : "O pagamento foi confirmado. Confira a conta informada.";
    return `<section class="proposta"><span class="chip claro">${c.provider === "facta" ? "Facta" : "Unno"} · ${esc(c.proposalCode || "em geração")}</span><h2>${titulo}</h2><p>${sub}</p>
      ${o.disbursedAmount ? `<div class="resumo"><span>Você recebe</span><b>${money(o.disbursedAmount)}</b><small>${o.installments} parcelas de ${money(o.installmentValue)} · pagamento via Pix</small></div>` : ""}
      ${etapa === "aguardando_assinatura_facta" && c.contractLink ? `<a class="btn primario grande" href="${esc(c.contractLink)}" target="_blank" rel="noopener">Revisar e assinar</a>` : etapa === "aguardando_assinatura_facta" ? '<div class="carregando"><span class="ponto"><i></i><i></i></span><div><b>Gerando o link de assinatura</b><small>Aparece aqui em instantes.</small></div></div>' : ""}</section>`;
  }

  function telaApp() {
    const c = state.clt;
    const nome = String(state.session?.name || "").trim().split(/\s+/)[0] || "";
    const u = estadoUnno(c), f = estadoFacta(c);
    const temProposta = ETAPAS_PROPOSTA.includes(c.etapa) && c.etapa !== "proposta_cancelada";
    const semTudo = u.k === "sem" && f.k === "sem";
    app.innerHTML = `<div class="topo"><span class="marca">FelizCred</span><button class="avatar" type="button" data-acao="sair" title="Sair">${esc(nome.slice(0, 1).toUpperCase() || "F")}</button></div>
      <div class="cabeca"><h1>Olá, ${esc(nome)}</h1><p class="sub">${temProposta ? "Sua proposta está pronta abaixo." : semTudo ? "Nenhum banco liberou condições agora. Nossa equipe pode ajudar." : "Estamos consultando dois bancos ao mesmo tempo. O primeiro que liberar aparece aqui."}</p></div>
      <div class="selo-pix">💸 Pagamento sempre via Pix</div>
      ${state.erro ? `<div class="erro">${esc(state.erro)}</div>` : ""}
      ${temProposta ? cartaoProposta(c) : ""}
      <div class="bancos">${caixaBanco("unno", u, c)}${caixaBanco("facta", f, c)}</div>
      ${semTudo ? '<a class="btn contorno" style="margin:14px 20px 0;width:calc(100% - 40px)" href="https://wa.me/554792747368?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20minha%20simula%C3%A7%C3%A3o" target="_blank" rel="noopener">Falar com a FelizCred</a>' : ""}`;
  }

  // ── popup (bottom sheet) com os dados da proposta ───────────────────────────────────────────────────────────
  function abrirSheet() {
    const c = state.clt;
    if (!c || c.etapa !== "dados_pessoais") return;
    const form = c.provider === "unnotech" ? formDadosParceiros(c.customerDefaults || {}, c.selectedOffer || {}) : formDados(c.customerDefaults || {}, c.selectedOffer || {});
    sheet.innerHTML = `<div class="fundo" data-acao="fechar-sheet"></div><div class="folha" role="dialog" aria-modal="true" aria-label="Dados da proposta">
      <div class="puxador"></div>
      <div class="pix-faixa"><span>💸</span><div><b>O pagamento é feito via Pix</b><small>O valor cai na conta que você informar abaixo. Você revê o contrato antes de assinar.</small></div></div>
      <div class="erro-sheet"></div>${form}
      <button class="btn contorno" type="button" data-acao="fechar-sheet" style="margin-top:10px">Voltar</button></div>`;
    sheet.classList.add("aberta");
    document.body.classList.add("trava");
  }
  function fecharSheet() { sheet.classList.remove("aberta"); document.body.classList.remove("trava"); sheet.innerHTML = ""; }

  // ── dados do servidor ────────────────────────────────────────────────────────────────────────────────────────
  const assinaturaClt = (c) => JSON.stringify([c?.provider, c?.etapa, c?.status, c?.parallelFacta, c?.error, (c?.offers || []).length, c?.consentUrl, c?.contractLink, c?.proposalCode]);
  function aplicar(clt) {
    const mudou = assinaturaClt(clt) !== state.assinatura;
    state.clt = clt; state.assinatura = assinaturaClt(clt);
    if (mudou) { telaApp(); if (clt?.etapa === "dados_pessoais" && !sheet.classList.contains("aberta") && state.escolhendo) { state.escolhendo = ""; abrirSheet(); } }
  }
  async function atualizar() {
    if (!state.session) return;
    try { const d = await api(`/conversations/${state.session.id}/clt/status`); if (d.clt) aplicar(d.clt); } catch (erro) { if (erro.status === 401 || erro.status === 404) sair(); }
  }
  function iniciarSondagem() { clearInterval(sondagem); sondagem = setInterval(() => { if (!document.hidden) atualizar(); }, 4000); }
  function sair() { try { localStorage.removeItem(KEY); } catch {} clearInterval(sondagem); state.session = null; state.clt = null; state.assinatura = ""; fecharSheet(); telaEntrada(); }

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
      const r = await fetch(`${API}/conversations`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, contact: phone, email, whatsappOptIn: d.has("whatsapp"), message: "Tenho interesse em: Empréstimo CLT", pageUrl: location.href }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível começar agora.");
      guardar({ id: j.conversation.id, token: j.token, name, contact: phone, email, expiresAt: Date.now() + 6 * 3600 * 1000 });
      // Mesmas mensagens do chat: confirma os 3 meses de registro antes de simular.
      await api(`/conversations/${state.session.id}`, { method: "POST", body: JSON.stringify({ message: "Sim, tenho mais de 3 meses" }) }).catch(() => {});
      const s = await api(`/conversations/${state.session.id}/clt/start`, { method: "POST", body: JSON.stringify({ name, cpf, phone }) });
      aplicar(s.clt); iniciarSondagem();
    } catch (erro) { state.session = null; telaEntrada(erro.message, v); }
  }

  document.addEventListener("input", (e) => {
    if (e.target.name === "cpf" && e.target.closest(".entrada")) e.target.value = maskCpf(e.target.value);
    if (e.target.name === "phone" && e.target.closest(".entrada")) e.target.value = maskTel(e.target.value);
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
    if (acao === "atualizar") { alvo.disabled = true; alvo.textContent = "Conferindo…"; await atualizar(); telaApp(); return; }
    if (acao === "fechar-sheet") return fecharSheet();
    if (acao === "abrir-dados") return abrirSheet();
    if (acao === "escolher") {
      state.escolhendo = alvo.dataset.id; state.erro = ""; telaApp();
      try {
        const d = await api(`/conversations/${state.session.id}/clt/select-offer`, { method: "POST", body: JSON.stringify({ offerId: alvo.dataset.id }) });
        state.assinatura = ""; aplicar(d.clt);
        if (d.clt.etapa === "dados_pessoais") { state.escolhendo = ""; abrirSheet(); }
      } catch (erro) { state.escolhendo = ""; state.erro = erro.message; telaApp(); }
    }
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form;
    if (tipo === "entrada") return seguir(form);
    if (tipo === "dados") {
      const cliente = Object.fromEntries(new FormData(form).entries()); delete cliente.on;
      const botao = form.querySelector("button.primario"); botao.disabled = true; botao.textContent = "Gerando sua proposta…";
      const faixa = sheet.querySelector(".erro-sheet"); faixa.innerHTML = "";
      try {
        const d = await api(`/conversations/${state.session.id}/clt/personal-data`, { method: "POST", body: JSON.stringify({ customer: cliente }) });
        fecharSheet(); state.assinatura = ""; aplicar(d.clt); window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (erro) { botao.disabled = false; botao.textContent = "Gerar proposta para revisão"; faixa.innerHTML = `<div class="erro" style="margin:10px 0 0">${esc(erro.message)}</div>`; sheet.querySelector(".folha").scrollTo({ top: 0, behavior: "smooth" }); }
    }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) atualizar(); });

  // ── início ───────────────────────────────────────────────────────────────────────────────────────────────────
  const s = lerSessao();
  if (!s) telaEntrada();
  else { state.session = s; api(`/conversations/${s.id}/clt/status`).then((d) => { if (!d.clt) return telaEntrada(); aplicar(d.clt); iniciarSondagem(); }).catch(() => sair()); }
})();
