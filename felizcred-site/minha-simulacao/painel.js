(() => {
  "use strict";
  const API = "https://meuwhats.onrender.com/site-chat";
  const KEY = "felizcred_painel_v1";
  const CHAT_KEY = "felizcred_site_chat_v1";
  const DIAS_30 = 30 * 24 * 3600 * 1000;
  const app = document.getElementById("app");
  const state = { session: null, clt: null, messages: [], aba: "inicio", folha: false, erro: "", carregando: false, outroNumero: false, aviso: "", valorFolha: "", assinatura: "" };
  let sondagem = null;

  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inputDate = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ""); };
  const hora = (t) => new Date(Number(t)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  // Atendimento: seg a sex 9h-18h, sáb 9h-12h (Brasília). Fora disso o cliente é convidado a nos chamar a partir das 9h
  // (conversa iniciada por ele não gera custo de mensagem para nós).
  function emExpediente() {
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dia = agora.getDay(), h = agora.getHours() + agora.getMinutes() / 60;
    if (dia >= 1 && dia <= 5) return h >= 9 && h < 18;
    if (dia === 6) return h >= 9 && h < 12;
    return false;
  }
  const TEXTO_FORA_HORARIO = "Atendemos de segunda a sexta, das 9h às 18h, e aos sábados, das 9h às 12h. Escreva para nós a partir das 9h e respondemos em seguida. Se preferir, deixe sua mensagem agora.";
  const primeiroNome = () => String(state.session?.name || "").trim().split(/\s+/)[0] || "";

  const ICONE = {
    casa: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z"/></svg>',
    user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    seta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    envia: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
    zap: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.4-7l.4-.1-1.2 4.2 4.2-1.2"/><path d="M8.5 9.5c.5 2.5 2.5 4.5 5 5l1.5-1.5-2-1-1 .7c-.8-.4-1.5-1.1-1.9-1.9l.7-1-1-2z"/></svg>',
  };

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (state.session?.token) headers["X-Chat-Token"] = state.session.token;
    const resposta = await fetch(`${API}${path}`, { cache: "no-store", ...opts, headers });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) { const erro = new Error(dados.error || "Não foi possível concluir agora. Tente de novo em instantes."); erro.status = resposta.status; throw erro; }
    return dados;
  }

  // ── sessão ────────────────────────────────────────────────────────────────
  function lerSessao() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.id && s.token && s.expiresAt > Date.now()) return s; } catch {}
    // Quem acabou de usar o chat do site já tem sessão lá: o painel aproveita.
    try { const c = JSON.parse(localStorage.getItem(CHAT_KEY) || "null"); if (c && c.id && c.token && c.expiresAt > Date.now()) return { id: c.id, token: c.token, name: c.name, contact: c.contact || "", email: c.email || "", expiresAt: c.expiresAt }; } catch {}
    return null;
  }
  function guardarSessao(s) {
    state.session = s;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      // Mantém o chat do site na mesma conversa (o acesso renova a chave da conversa).
      localStorage.setItem(CHAT_KEY, JSON.stringify({ id: s.id, token: s.token, name: s.name, contact: s.contact || "", email: s.email || "", expiresAt: Date.now() + 6 * 3600 * 1000 }));
    } catch {}
  }
  function telaErro(texto) {
    clearInterval(sondagem);
    app.innerHTML = `<div class="erro-tela"><span class="marca">FelizCred</span><h1>Não deu para abrir</h1><p class="sub">${esc(texto)}</p><a class="btn primario" href="/?chat=abrir">Falar com a FelizCred</a></div>`;
  }

  // ── etapas ────────────────────────────────────────────────────────────────
  const ETAPAS_AUTORIZACAO = ["solicitando_autorizacao", "autorizacao_enviada", "aguardando_autorizacao", "consultando_margem", "simulando"];
  const nomeBanco = (c) => (c && c.provider === "unnotech" ? "bancos parceiros" : "Facta");
  const ETAPAS_SEM_CONDICAO = ["sem_margem", "nao_elegivel", "sem_oferta", "politica_reprovada", "erro_consulta", "erro_autorizacao", "erro_integracao", "proposta_cancelada"];
  function indiceEtapa(etapa) {
    if (etapa === "consultando_margem" || etapa === "simulando") return 1;
    if (ETAPAS_AUTORIZACAO.includes(etapa)) return 0;
    if (etapa === "ofertas_disponiveis") return 2;
    if (etapa === "dados_pessoais") return 3;
    if (etapa === "aguardando_assinatura_facta" || etapa === "proposta_em_analise") return 4;
    if (etapa === "proposta_concluida") return 5;
    return 0;
  }
  const PASSOS = ["Autorização da consulta", "Condições liberadas", "Escolha da condição", "Seus dados", "Assinatura e pagamento"];
  function andamento() {
    const atual = indiceEtapa(state.clt?.etapa);
    return `<div class="andamento">${PASSOS.map((nome, i) => {
      const classe = i < atual ? "feita" : i === atual ? "agora" : "";
      return `<div class="etapa ${classe}"><span class="bola">${i < atual ? ICONE.check : ""}</span><span>${nome}${i === atual ? ' <span style="font-weight:400;color:#4b5d6e">· agora</span>' : ""}</span></div>`;
    }).join("")}</div>`;
  }
  const blocoBanco = (chip, rotulo, nome = "Facta") => `<div class="banco"><b>${nome}</b><span class="chip ${chip}">${rotulo}</span></div>`;
  // Lista de bancos consultados: se a Facta não liberou e seguimos com outros bancos, mostra os dois.
  function blocoBancos(c) {
    if (c && c.provider === "unnotech") {
      const falhou = ETAPAS_SEM_CONDICAO.includes(c.etapa);
      const chip = falhou ? ["aviso", "Sem condições agora"] : ["claro", ["ofertas_disponiveis", "dados_pessoais", "aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida"].includes(c.etapa) ? "Condições liberadas" : "Consultando"];
      return (c.previous ? blocoBanco("aviso", "Sem condições agora") + '<div style="height:10px"></div>' : "") + blocoBanco(chip[0], chip[1], "Bancos parceiros");
    }
    const falhou = c && ETAPAS_SEM_CONDICAO.includes(c.etapa);
    return blocoBanco(falhou ? "aviso" : "claro", falhou ? "Sem condições agora" : "Condições liberadas");
  }

  // ── telas ─────────────────────────────────────────────────────────────────
  const topo = () => `<div class="topo"><a class="marca" href="/">FelizCred</a><span class="avatar" aria-hidden="true">${esc((primeiroNome()[0] || "F").toUpperCase())}</span></div>`;
  const erroBox = () => (state.erro ? `<p class="erro" role="alert">${esc(state.erro)}</p>` : "");
  const avisoBox = () => (state.aviso ? `<p class="erro" style="background:#e3f6ec;color:#06603a" role="status">${esc(state.aviso)}</p>` : "");

  function viewSemSimulacao() {
    return `${topo()}<div class="cabeca"><h1>Oi${primeiroNome() ? ", " + esc(primeiroNome()) : ""}</h1><p class="sub">Sua simulação ainda não começou. Leva menos de um minuto.</p></div>
      <div class="lista-opcoes" style="margin-top:18px"><a class="opcao forte" href="/?chat=abrir"><span class="ico verde">F</span><span><b>Começar minha simulação</b><small>O Felipe te acompanha.</small></span><span class="seta">${ICONE.seta}</span></a></div>`;
  }

  function viewAutorizacaoParceiros() {
    const c = state.clt;
    const processando = c.etapa === "consultando_margem" || c.etapa === "simulando";
    if (processando) {
      return `${topo()}<div class="cabeca"><h1>Consultando os bancos</h1><p class="sub">Sua autorização foi confirmada. Estamos pedindo as condições para os bancos parceiros. Isso leva alguns instantes.</p></div>
        <div class="espera" style="margin-top:18px"><span class="ponto"><i></i><i></i></span><div><b>${c.etapa === "simulando" ? "Comparando as condições" : "Consultando sua margem"}</b><p>Atualizamos aqui sozinhos, sem apertar nada.</p></div></div>
        <p class="rotulo">Bancos consultados</p>${blocoBancos(c)}`;
    }
    return `${topo()}<div class="cabeca"><h1>${c.previous ? "Vamos tentar outros bancos" : "Falta só um passo"}</h1><p class="sub">${c.previous ? "A Facta não liberou desta vez, mas usamos seus dados salvos para consultar bancos parceiros. " : ""}Falta só autorizar a consulta. Leva menos de um minuto.</p></div>
      <div class="passos">
        <div class="passo"><span class="n">1</span><p><b>Toque em “Abrir a autorização”.</b> É uma página segura do Dataprev, o sistema do governo.</p></div>
        <div class="passo"><span class="n">2</span><p><b>Leia e confirme</b> o termo de autorização da consulta.</p></div>
        <div class="passo"><span class="n">3</span><p><b>Volte para cá.</b> Seguimos sozinhos, sem apertar nada.</p></div>
      </div>
      <div style="margin:18px 20px 0">${c.consentUrl ? `<a class="btn primario grande" href="${esc(c.consentUrl)}" target="_blank" rel="noopener">Abrir a autorização</a>` : `<button class="btn primario grande" type="button" disabled>Preparando o link…</button>`}</div>
      <div class="espera"><span class="ponto"><i></i><i></i></span><div><b>Esperando sua autorização</b><p>Conferimos sozinhos a cada poucos segundos.</p></div></div>
      <p class="rotulo">Bancos consultados</p>${blocoBancos(c)}
      <p class="rotulo">Precisa de ajuda?</p>
      <div class="lista-opcoes"><button class="opcao" type="button" data-acao="conversa"><span><b>Falar com o Felipe</b></span><span class="seta">${ICONE.seta}</span></button></div>`;
  }

  function viewAutorizacao() {
    if (state.clt && state.clt.provider === "unnotech") return viewAutorizacaoParceiros();
    const final = String(state.session?.contact || "").replace(/\D/g, "").slice(-4);
    return `${topo()}<div class="cabeca"><h1>Falta só um passo</h1><p class="sub">A Facta precisa da sua autorização para consultar suas condições. Leva menos de um minuto.</p></div>
      <div class="passos">
        <div class="passo"><span class="n">1</span><p><b>Abra o WhatsApp.</b> A Facta mandou uma mensagem${final ? ` para o número final <b>${esc(final)}</b>` : ""}.</p></div>
        <div class="passo"><span class="n">2</span><p><b>Toque no link</b> da mensagem e confirme a autorização.</p></div>
        <div class="passo"><span class="n">3</span><p><b>Volte para cá.</b> Suas condições aparecem sozinhas, sem apertar nada.</p></div>
      </div>
      <div style="margin:18px 20px 0"><a class="btn primario grande" href="https://wa.me/" target="_blank" rel="noopener">${ICONE.zap} Abrir o WhatsApp</a></div>
      <div class="espera"><span class="ponto"><i></i><i></i></span><div><b>Esperando sua autorização</b><p>Conferimos sozinhos a cada poucos segundos.</p></div></div>
      ${avisoBox()}${erroBox()}
      <p class="rotulo">Não chegou?</p>
      <div class="lista-opcoes">
        <button class="opcao" type="button" data-acao="reenviar"><span><b>Reenviar o link</b></span><span class="seta">${ICONE.seta}</span></button>
        <button class="opcao" type="button" data-acao="conversa"><span><b>Falar com o Felipe</b></span><span class="seta">${ICONE.seta}</span></button>
      </div>
      <div class="aviso-navy"><span class="f">F</span><span>Pode sair do painel: quando as condições chegarem, avisamos você.</span></div>`;
  }

  function viewOfertas() {
    const c = state.clt;
    const ofertas = c.offers || [];
    const max = c.maxInstallment || (ofertas[0] && ofertas[0].installmentValue) || 0;
    const cartoes = ofertas.map((o, i) => {
      const rotulo = ofertas.length > 1 ? (i === 0 ? '<span class="chip claro">Mais dinheiro na mão</span>' : '<span class="chip cinza">Prazo mais curto</span>') : '<span class="chip claro">Sua condição</span>';
      return `<div class="cartao ${i === 0 ? "destaque" : "simples"}">${rotulo}
        <p class="peq">Você recebe</p><p class="valor">${money(o.disbursedAmount)}</p>
        <p class="prazo">${o.installments} parcelas de <b>${money(o.installmentValue)}</b></p>
        <p class="nota">Valor estimado${o.rate ? ` · Taxa informada ${Number(o.rate).toFixed(2).replace(".", ",")}%` : ""}${o.insuranceValue ? " · Inclui seguro" : ""}</p>
        <button class="btn ${i === 0 ? "primario" : "contorno"}" type="button" data-acao="escolher" data-id="${esc(o.id)}"${state.carregando ? " disabled" : ""}>${state.carregando === o.id ? "Analisando com a Facta…" : "Quero esta condição"}</button></div>`;
    }).join("");
    return `${topo()}<div class="cabeca"><h1>Oi${primeiroNome() ? ", " + esc(primeiroNome()) : ""}</h1><p class="sub">Sua simulação está salva. Escolha como prefere seguir.</p></div>
      <div class="hero"><span class="chip ok">${ICONE.check} ${c.provider === "unnotech" ? "Bancos parceiros" : "Facta"} · autorização confirmada</span><p class="titulo">Suas condições estão prontas</p><div class="linha"><span>Parcela máxima por mês</span><b>${money(max)}</b></div></div>
      ${erroBox()}
      <p class="rotulo">Escolha sua condição</p>${cartoes}
      <button class="linha-botao" type="button" data-acao="folha"><span>Quero pagar menos por mês</span>${ICONE.seta}</button>
      <p class="rotulo">Seu andamento</p>${andamento()}
      <p class="rotulo">Bancos consultados</p>${blocoBancos(c)}
      <p class="rodape-nota">Valores estimados. A aprovação final é do banco e você revê o contrato completo antes de assinar.</p>`;
  }

  function folhaParcela() {
    const max = Number(state.clt?.maxInstallment || 0);
    const sugestoes = [0.45, 0.7, 0.9].map((f) => Math.max(10, Math.floor((max * f) / 5) * 5)).filter((v, i, a) => v < max && a.indexOf(v) === i);
    return `<div class="folha-fundo" data-acao="fechar-folha"></div>
      <div class="folha" role="dialog" aria-label="Escolher outra parcela"><div class="puxador"></div>
        <h2>Quanto você quer pagar por mês?</h2>
        <p class="sub">Você pode escolher qualquer parcela até <b style="color:#10243b">${money(max)}</b>, que é o máximo disponível para você.</p>
        <label class="rot" for="valor-parcela">Valor da parcela</label>
        <div class="campo-valor"><span>R$</span><input id="valor-parcela" type="text" inputmode="decimal" autocomplete="off" value="${esc(state.valorFolha)}" placeholder="0,00"></div>
        <div class="fichas">${sugestoes.map((v) => `<button type="button" class="ficha" data-acao="ficha" data-valor="${v}">R$ ${v}</button>`).join("")}<button type="button" class="ficha" data-acao="ficha" data-valor="${max.toFixed(2).replace(".", ",")}">Máximo</button></div>
        ${erroBox()}
        <button class="btn primario grande" type="button" style="margin-top:20px" data-acao="enviar-parcela"${state.carregando ? " disabled" : ""}>${state.carregando === "parcela" ? "Calculando com a Facta…" : "Ver as condições para essa parcela"}</button>
        <p class="centro" style="margin:16px 0 0;font-size:13px;color:#5a6b7b">Valores estimados. A aprovação final é do banco.</p></div>`;
  }

  function formDados(d, offer) {
    return `<form class="form" data-form="dados"><p>Condição selecionada: você recebe aproximadamente <b>${money(offer.disbursedAmount)}</b> e paga ${offer.installments || "—"} parcelas de ${money(offer.installmentValue)}.</p><div class="form-section"><b>Dados pessoais</b><div class="form-grid"><label>Nome completo<input name="nome" value="${esc(d.nome)}" required autocomplete="name"></label><label>Sexo<select name="sexo" required><option value="">Selecione</option><option value="M" ${d.sexo === "M" ? "selected" : ""}>Masculino</option><option value="F" ${d.sexo === "F" ? "selected" : ""}>Feminino</option></select></label><label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="4">Solteiro(a)</option><option value="3">Casado(a)</option><option value="2">Divorciado(a)</option><option value="5">Viúvo(a)</option><option value="9">União estável</option><option value="6">Outro</option></select></label><label>Data de nascimento<input name="data_nascimento" type="date" value="${esc(inputDate(d.data_nascimento))}" required></label><label>RG<input name="rg" required inputmode="numeric"></label><label>UF do RG<input name="estado_rg" maxlength="2" required placeholder="SC"></label><label>Órgão emissor<input name="orgao_emissor" required placeholder="SSP"></label><label>Data de expedição<input name="data_expedicao" type="date" required></label><label>UF de nascimento<input name="estado_natural" maxlength="2" required placeholder="SC"></label><label>Cidade de nascimento<input name="cidade_natural_nome" required></label><label>Nacionalidade<select name="nacionalidade" required><option value="1">Brasileiro(a)</option><option value="2">Estrangeiro(a)</option></select></label><label>Celular<input name="celular" required inputmode="tel" value="${esc(d.celular)}"></label><label>E-mail<input name="email" type="email" autocomplete="email"></label><label>Nome da mãe<input name="nome_mae" value="${esc(d.nome_mae)}" required></label><label>Nome do pai<input name="nome_pai" required placeholder="Ou NÃO DECLARADO"></label><label>Faixa de patrimônio<select name="valor_patrimonio" required><option value="1">Até R$ 10 mil</option><option value="2">De R$ 10 mil a R$ 100 mil</option><option value="3">De R$ 100 mil a R$ 500 mil</option><option value="4">De R$ 500 mil a R$ 1 milhão</option><option value="5">Acima de R$ 1 milhão</option></select></label></div></div><div class="form-section"><b>Endereço</b><div class="form-grid"><label>CEP<input name="cep" required inputmode="numeric" maxlength="9"></label><label>Endereço<input name="endereco" required></label><label>Número<input name="numero" required inputmode="numeric"></label><label>Complemento<input name="complemento"></label><label>Bairro<input name="bairro" required></label><label>Cidade<input name="cidade_nome" required></label><label>UF<input name="estado" required maxlength="2" placeholder="SC"></label></div></div><div class="form-section"><b>Conta para recebimento</b><div class="form-grid"><label>Banco<select name="banco" required><option value="">Selecione</option><option value="001">Banco do Brasil</option><option value="033">Santander</option><option value="104">Caixa</option><option value="237">Bradesco</option><option value="341">Itaú</option><option value="260">Nubank</option><option value="077">Inter</option><option value="336">C6 Bank</option></select></label><label>Tipo de conta<select name="tipo_conta" required><option value="C">Conta corrente</option><option value="P">Conta poupança</option></select></label><label>Agência<input name="agencia" required inputmode="numeric"></label><label>Conta com dígito<input name="conta" required></label><label>Tipo de chave Pix<select name="tipo_chave_pix" required><option value="1">CPF</option><option value="2">Telefone</option><option value="3">E-mail</option><option value="4">Chave aleatória</option></select></label><label>Chave Pix<input name="chave_pix" required></label></div></div><input type="hidden" name="renda" value="${esc(d.renda)}"><input type="hidden" name="matricula" value="${esc(d.matricula)}"><input type="hidden" name="cnpj_empregador" value="${esc(d.cnpj_empregador)}"><input type="hidden" name="data_admissao" value="${esc(inputDate(d.data_admissao))}"><label>Precisa de assinatura a rogo?<select name="cliente_iletrado_impossibilitado" required><option value="N">Não</option><option value="S">Sim</option></select></label><div class="rogo" hidden><div class="form-grid"><label>Nome de quem assina a rogo<input name="nome_a_rogo"></label><label>CPF de quem assina<input name="cpf_a_rogo" inputmode="numeric"></label><label>Nome da testemunha<input name="nome_a_rogo_testemunha"></label><label>CPF da testemunha<input name="cpf_a_rogo_testemunha" inputmode="numeric"></label></div></div><label class="consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real na Facta. Poderei revisar o contrato antes de assinar.</label><button class="btn primario grande">Gerar proposta para revisão</button></form>`;
  }
  const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
  const opcoesUf = (sel) => `<option value="">Selecione</option>${UFS.map((u) => `<option value="${u}"${u === sel ? " selected" : ""}>${u}</option>`).join("")}`;
  function formDadosParceiros(d, offer) {
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
      <div class="form-section"><b>Seu RH (opcional)</b><div class="form-grid">
        <label>E-mail do RH<input name="email_rh" type="email"></label>
        <label>Telefone do RH<input name="telefone_rh" inputmode="tel"></label>
      </div></div>
      <label class="consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real. Poderei revisar o contrato antes de assinar.</label>
      <button class="btn primario grande">Gerar proposta para revisão</button></form>`;
  }
  function viewDados() {
    const c = state.clt;
    if (c.provider === "unnotech") return `${topo()}<div class="cabeca"><h1>Seus dados</h1><p class="sub">Para gerar a proposta, o banco precisa de mais alguns dados. Você revê tudo antes de assinar.</p></div>${erroBox()}<div style="margin-top:14px">${formDadosParceiros(c.customerDefaults || {}, c.selectedOffer || {})}</div>`;
    return `${topo()}<div class="cabeca"><h1>Seus dados</h1><p class="sub">Para gerar a proposta, a Facta precisa de mais alguns dados. Você revê tudo antes de assinar.</p></div>${erroBox()}<div style="margin-top:14px">${formDados(c.customerDefaults || {}, c.selectedOffer || {})}</div>`;
  }

  // Cartão de suporte: azul-escuro quando estamos atendendo; vermelho apagado fora do horário (sem pressa, só informa).
  function suporteCartao(titulo) {
    if (emExpediente()) return `<div class="suporte"><span class="f">F</span><div class="t"><b>${titulo}</b><small>O Felipe responde aqui mesmo.</small></div><button class="btn-claro" type="button" data-acao="conversa">Conversar</button></div>`;
    return `<div class="suporte fora"><div class="cab"><span class="f">F</span><b>Fora do horário de atendimento</b></div><p>${TEXTO_FORA_HORARIO}</p><button class="btn-claro" type="button" data-acao="conversa">Deixar mensagem</button></div>`;
  }
  function viewProposta() {
    const c = state.clt;
    const oferta = c.selectedOffer || {};
    const etapa = c.etapa;
    const chip = etapa === "aguardando_assinatura_facta" ? '<span class="chip espera">Aguardando assinatura</span>' : etapa === "proposta_concluida" ? '<span class="chip claro">Concluída</span>' : '<span class="chip espera">Em análise na Facta</span>';
    const titulo = etapa === "proposta_concluida" ? "Proposta concluída" : etapa === "proposta_em_analise" ? `${nomeBanco(c) === "Facta" ? "A Facta" : "O banco"} está analisando` : "Sua proposta foi gerada";
    const sub = etapa === "aguardando_assinatura_facta" ? "Falta revisar e assinar. Você vê o contrato completo antes de decidir." : etapa === "proposta_em_analise" ? "Recebemos sua assinatura. Atualizamos aqui sozinhos." : "O pagamento foi confirmado pela Facta. Confira a conta informada na contratação.";
    const idx = etapa === "aguardando_assinatura_facta" ? 1 : etapa === "proposta_em_analise" ? 2 : 4;
    const linhas = [["Proposta gerada", "Seus dados já foram enviados."], ["Sua assinatura", "Toque em “Revisar e assinar”."], ["Análise do banco", "Atualizamos aqui sozinhos."], ["Pagamento na sua conta", ""]];
    const timeline = linhas.map(([nome, nota], i) => {
      const feito = i < idx || idx === 4;
      const agora = i === idx && idx !== 4;
      return `<div style="display:flex;gap:14px"><div style="display:flex;flex-direction:column;align-items:center"><span class="etapa ${feito ? "feita" : agora ? "agora" : ""}"><span class="bola">${feito ? ICONE.check : ""}</span></span>${i < 3 ? `<span style="width:2px;height:26px;background:${feito ? "#087a47" : "#c3d0da"}"></span>` : ""}</div><div style="padding-bottom:12px"><p style="margin:2px 0 0;font-size:15px;${feito || agora ? "font-weight:700" : "color:#4b5d6e"}">${nome}${agora ? ' <span style="font-weight:400;color:#4b5d6e">· agora</span>' : ""}</p>${nota ? `<p style="margin:2px 0 0;font-size:13px;color:#4b5d6e">${nota}</p>` : ""}</div></div>`;
    }).join("");
    return `${topo()}<div class="cabeca"><h1>${titulo}</h1><p class="sub">${sub}</p></div>
      <div class="cartao" style="margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;color:#4b5d6e">Proposta</span>${chip}</div>
        <p style="margin:2px 0 0;font:700 15px Sora,sans-serif;color:#33475b">${esc(c.proposalCode || "em geração")}</p>
        ${oferta.disbursedAmount ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #e4ece7"><p class="peq" style="margin:0">Você recebe</p><p class="valor">${money(oferta.disbursedAmount)}</p><p class="prazo">${oferta.installments} parcelas de <b>${money(oferta.installmentValue)}</b></p></div>` : ""}
        ${etapa === "aguardando_assinatura_facta" && c.contractLink ? `<a class="btn primario grande" style="margin-top:20px" href="${esc(c.contractLink)}" target="_blank" rel="noopener">Revisar e assinar</a><p class="centro" style="margin:12px 0 0;font-size:12px;color:#5a6b7b">A assinatura acontece no ambiente seguro do banco.</p>` : ""}</div>
      <p class="rotulo">Próximos passos</p><div class="andamento" style="gap:0">${timeline}</div>
      ${suporteCartao("Dúvida sobre o contrato?")}`;
  }

  function viewSemCondicoes() {
    const c = state.clt;
    const titulos = { sem_margem: "Sem margem disponível agora", nao_elegivel: "O vínculo não está elegível agora", sem_oferta: "A Facta não encontrou uma condição", politica_reprovada: "A condição não passou pela política", erro_consulta: "Não conseguimos consultar agora", erro_autorizacao: "A autorização não foi enviada", erro_integracao: "A Facta não respondeu agora", proposta_cancelada: "Seu contrato não foi finalizado" };
    const rotuloChip = c.etapa === "proposta_cancelada" ? "Contrato não finalizado" : "Sem condições agora";
    const motivo = c.error || "A Facta não detalhou o motivo.";
    const podeOutroCelular = c.provider !== "unnotech" && /telefone.*(outro|cpf)|j[aá] informado/i.test(String(c.error || ""));
    return `${topo()}<div class="cabeca"><h1>Não deu desta vez${primeiroNome() ? ", " + esc(primeiroNome()) : ""}</h1><p class="sub">${esc(titulos[c.etapa] || "A Facta não liberou condições agora")}. Isso é comum e não significa que você não possa ter crédito: a gente continua tentando por você.</p></div>
      ${c.provider === "unnotech" && c.previous ? `<div class="cartao" style="margin-top:18px;padding:14px 18px"><div style="display:flex;align-items:center;justify-content:space-between"><b style="font:700 16px Sora,sans-serif">Facta</b><span class="chip aviso">Sem condições agora</span></div></div>` : ""}
      <div class="cartao" style="margin-top:${c.provider === "unnotech" && c.previous ? 12 : 18}px"><div style="display:flex;align-items:center;justify-content:space-between"><b style="font:700 16px Sora,sans-serif">${c.provider === "unnotech" ? "Bancos parceiros" : "Facta"}</b><span class="chip aviso">${rotuloChip}</span></div><p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#4b5d6e">Motivo informado: <b style="color:#10243b">${esc(motivo)}</b></p></div>
      
      ${avisoBox()}${erroBox()}
      <p class="rotulo">O que você pode fazer agora</p>
      <div class="lista-opcoes">
        ${c.provider !== "unnotech" && c.etapa !== "proposta_cancelada" ? `<button class="opcao forte pulsa" type="button" data-acao="outros-bancos"${state.carregando === "outros" ? " disabled" : ""}><span class="ico verde">+</span><span><span class="selo">Maior chance de aprovação</span><b>${state.carregando === "outros" ? "Consultando outros bancos…" : "Tentar com outros bancos"}</b><small>Outros bancos analisam de forma diferente. Usamos seus dados salvos, sem refazer o cadastro.</small></span><span class="seta">${ICONE.seta}</span></button>` : ""}
        <button class="opcao" type="button" data-acao="conversa"><span class="ico verde">F</span><span><b>Falar com o Felipe</b><small>Ele confere seu caso e te responde aqui.</small></span><span class="seta">${ICONE.seta}</span></button>
        ${podeOutroCelular ? `<button class="opcao" type="button" data-acao="outro-numero"><span class="ico">${ICONE.user}</span><span><b>Tentar com outro celular</b><small>Útil quando o número já está ligado a outro CPF.</small></span><span class="seta">${ICONE.seta}</span></button>` : ""}
        ${state.outroNumero ? `<form class="form" style="margin:0" data-form="outro-numero"><label>Celular com DDD<input name="phone" inputmode="tel" autocomplete="tel" placeholder="(47) 99999-9999" required></label><button class="btn primario">Enviar a autorização para esse número</button></form>` : ""}
        <button class="opcao" type="button" data-acao="avisar"><span class="ico">${ICONE.chat}</span><span><b>Me avisar quando puder</b><small>Mandamos um aviso quando houver novidade.</small></span><span class="seta">${ICONE.seta}</span></button>
      </div>
      <p class="rodape-nota">Seus dados continuam salvos e protegidos. Você pode pedir a exclusão deles quando quiser, na aba Conta.</p>`;
  }

  function viewInicio() {
    const c = state.clt;
    if (!c || c === "start") return viewSemSimulacao();
    if (ETAPAS_AUTORIZACAO.includes(c.etapa)) return viewAutorizacao();
    if (c.etapa === "ofertas_disponiveis") return viewOfertas();
    if (c.etapa === "dados_pessoais") return viewDados();
    if (["aguardando_assinatura_facta", "proposta_em_analise", "proposta_concluida"].includes(c.etapa)) return viewProposta();
    if (ETAPAS_SEM_CONDICAO.includes(c.etapa)) return viewSemCondicoes();
    return viewAutorizacao();
  }

  function viewSimulacao() {
    const c = state.clt;
    const oferta = c?.selectedOffer;
    return `${topo()}<div class="cabeca"><h1>Minha simulação</h1><p class="sub">Tudo o que já fizemos por você, em um só lugar.</p></div>
      <p class="rotulo">Andamento</p>${andamento()}
      ${oferta ? `<p class="rotulo">Condição escolhida</p><div class="cartao"><p class="peq" style="margin:0">Você recebe</p><p class="valor">${money(oferta.disbursedAmount)}</p><p class="prazo">${oferta.installments} parcelas de <b>${money(oferta.installmentValue)}</b></p></div>` : ""}
      <p class="rotulo">Bancos consultados</p>${blocoBancos(c)}`;
  }

  function viewConversa() {
    return `<div class="conversa"><div class="conversa-topo"><span class="f">F<i></i></span><div><b>Felipe</b><small>FelizCred · ${emExpediente() ? "responde em minutos" : "fora do horário de atendimento"}</small></div></div>
      ${emExpediente() ? "" : `<p class="aviso-fora">${TEXTO_FORA_HORARIO}</p>`}
      <div class="mensagens" id="mensagens"></div>
      <form class="compor" data-form="mensagem"><input name="texto" type="text" aria-label="Escreva uma mensagem" placeholder="Escreva uma mensagem" autocomplete="off"><button type="submit" aria-label="Enviar">${ICONE.envia}</button></form></div>`;
  }
  function desenharMensagens() {
    const alvo = document.getElementById("mensagens");
    if (!alvo) return;
    const perto = alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight < 120;
    alvo.innerHTML = state.messages.length ? state.messages.map((m) => {
      const eu = m.direction === "visitor";
      const texto = m.type && m.type !== "text" && !m.body ? "[arquivo]" : m.body;
      return `<div class="bolha ${eu ? "eu" : ""}">${esc(texto)}<small>${eu ? "" : esc(m.sender_name || "FelizCred") + " · "}${hora(m.created_at)}</small></div>`;
    }).join("") : '<p class="sub centro">Escreva aqui. O Felipe responde em minutos.</p>';
    if (perto) window.scrollTo(0, document.body.scrollHeight);
  }

  function viewConta() {
    const email = String(state.session?.email || "");
    const [u, d] = email.split("@");
    const mascarado = d ? `${u.slice(0, 2)}${"*".repeat(Math.max(u.length - 2, 1))}@${d}` : "—";
    return `${topo()}<div class="cabeca"><h1>Minha conta</h1><p class="sub">Seus dados ficam protegidos e só são usados na sua simulação.</p></div>
      <div class="cartao" style="margin-top:18px;display:grid;gap:12px"><div><p class="peq" style="margin:0">Nome</p><b>${esc(state.session?.name || "—")}</b></div><div><p class="peq" style="margin:0">E-mail</p><b>${esc(mascarado)}</b></div></div>
      ${avisoBox()}
      <div class="lista-opcoes" style="margin-top:18px">
        <button class="opcao" type="button" data-acao="excluir"><span><b>Pedir a exclusão dos meus dados</b><small>Nossa equipe confirma o pedido por aqui.</small></span><span class="seta">${ICONE.seta}</span></button>
        <button class="opcao" type="button" data-acao="sair"><span><b>Sair deste aparelho</b><small>Para entrar de novo, use o link do e-mail.</small></span><span class="seta">${ICONE.seta}</span></button>
      </div>`;
  }

  function abas() {
    const itens = [["inicio", "Início", ICONE.casa], ["simulacao", "Simulação", ICONE.doc], ["conversa", "Conversa", ICONE.chat], ["conta", "Conta", ICONE.user]];
    const novas = naoLidas();
    return `<nav class="abas" aria-label="Navegação">${itens.map(([id, nome, icone]) => `<button class="aba" type="button" data-aba="${id}"${state.aba === id ? ' aria-current="page"' : ""}>${icone}${nome}${id === "conversa" && novas ? `<span class="cont">${novas}</span>` : ""}</button>`).join("")}</nav>`;
  }
  const chaveVisto = () => `fc_painel_visto_${state.session?.id}`;
  function naoLidas() {
    let visto = 0; try { visto = Number(localStorage.getItem(chaveVisto()) || 0); } catch {}
    return state.messages.filter((m) => m.direction === "agent" && Number(m.created_at) > visto).length;
  }
  function marcarVistas() { try { localStorage.setItem(chaveVisto(), String(Date.now())); } catch {} }

  function render() {
    if (!state.session) return;
    const corpo = state.aba === "conversa" ? viewConversa() : state.aba === "simulacao" ? viewSimulacao() : state.aba === "conta" ? viewConta() : viewInicio();
    const antes = document.querySelector('[name="texto"]')?.value || "";
    app.innerHTML = `${corpo}${state.folha ? folhaParcela() : ""}${abas()}`;
    if (state.aba === "conversa") { desenharMensagens(); marcarVistas(); const campo = document.querySelector('[name="texto"]'); if (campo) campo.value = antes; window.scrollTo(0, document.body.scrollHeight); }
    document.title = (state.aviso && document.hidden ? "(1) " : "") + "Minha simulação | FelizCred";
  }

  // ── dados ────────────────────────────────────────────────────────────────
  const assinaturaClt = (c) => JSON.stringify([c?.etapa, c?.status, c?.error, (c?.offers || []).length, c?.maxInstallment, c?.selectedOffer, c?.contractLink, c?.proposalCode, c?.consentUrl, c?.provider]);
  async function atualizarClt() {
    try {
      const dados = await api(`/conversations/${state.session.id}/clt/status`);
      const antes = state.clt?.etapa;
      const nova = assinaturaClt(dados.clt);
      if (nova !== state.assinatura) {
        state.assinatura = nova; state.clt = dados.clt;
        if (document.hidden && antes && dados.clt?.etapa !== antes) document.title = "(1) Atualização da sua simulação | FelizCred";
        if (!state.folha && !document.querySelector("form[data-form='dados'] input:focus")) render();
      }
    } catch (e) { if (e.status === 404) { try { localStorage.removeItem(KEY); } catch {} telaErro("Sua sessão expirou. Abra o link que enviamos para o seu e-mail."); } }
  }
  async function atualizarMensagens() {
    try {
      const dados = await api(`/conversations/${state.session.id}`);
      const mudou = dados.messages.length !== state.messages.length;
      state.messages = dados.messages;
      if (mudou) { if (state.aba === "conversa") { desenharMensagens(); marcarVistas(); } else render(); }
    } catch {}
  }

  // ── ações ────────────────────────────────────────────────────────────────
  async function executar(fn) {
    state.erro = ""; state.aviso = "";
    try { await fn(); } catch (e) { state.erro = e.message; }
    state.carregando = false; render();
  }
  function numeroDigitado(texto) {
    const m = String(texto || "").match(/\d[\d.]*([,]\d{1,2})?/);
    return m ? Number(m[0].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) : NaN;
  }
  async function enviarMensagemSimples(texto) { await api(`/conversations/${state.session.id}`, { method: "POST", body: JSON.stringify({ message: texto }) }); await atualizarMensagens(); }

  app.addEventListener("click", async (e) => {
    const aba = e.target.closest("[data-aba]");
    if (aba) { state.aba = aba.dataset.aba; state.folha = false; state.erro = ""; state.aviso = ""; render(); window.scrollTo(0, 0); return; }
    const alvo = e.target.closest("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    if (acao === "conversa") { state.aba = "conversa"; render(); return; }
    if (acao === "folha") { state.folha = true; state.erro = ""; state.valorFolha = ""; render(); return; }
    if (acao === "fechar-folha") { state.folha = false; state.erro = ""; render(); return; }
    if (acao === "ficha") { state.valorFolha = String(alvo.dataset.valor); const campo = document.getElementById("valor-parcela"); if (campo) campo.value = state.valorFolha; return; }
    if (acao === "outro-numero") { state.outroNumero = !state.outroNumero; render(); return; }
    if (acao === "sair") { try { localStorage.removeItem(KEY); localStorage.removeItem(CHAT_KEY); } catch {} telaErro("Você saiu deste aparelho. Para voltar, abra o link que enviamos para o seu e-mail."); return; }
    if (acao === "escolher") {
      state.carregando = alvo.dataset.id; render();
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/select-offer`, { method: "POST", body: JSON.stringify({ offerId: alvo.dataset.id }) }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); window.scrollTo(0, 0); });
      return;
    }
    if (acao === "enviar-parcela") {
      const campo = document.getElementById("valor-parcela");
      state.valorFolha = campo ? campo.value : state.valorFolha;
      const valor = numeroDigitado(state.valorFolha);
      const max = Number(state.clt?.maxInstallment || 0);
      if (!(valor > 0)) { state.erro = "Digite o valor da parcela, por exemplo 60,00."; render(); return; }
      if (max && valor > max + 0.005) { state.erro = `Essa parcela passa do máximo de ${money(max)}. Digite um valor menor.`; render(); return; }
      state.carregando = "parcela"; state.erro = ""; render();
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/resimulate`, { method: "POST", body: JSON.stringify({ installmentValue: state.valorFolha }) }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); state.folha = false; });
      return;
    }
    if (acao === "reenviar") {
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/resend-authorization`, { method: "POST", body: "{}" }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); state.aviso = "Enviamos o link de novo para o seu WhatsApp."; });
      return;
    }
    if (acao === "outros-bancos") {
      state.carregando = "outros"; render();
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/other-banks`, { method: "POST", body: "{}" }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); window.scrollTo(0, 0); });
      return;
    }
    if (acao === "avisar") { await executar(async () => { await enviarMensagemSimples("Quero ser avisado quando houver novidade na minha simulação."); state.aviso = "Combinado! Avisamos você assim que houver novidade."; }); return; }
    if (acao === "excluir") { await executar(async () => { await enviarMensagemSimples("Pedido de exclusão dos meus dados (LGPD)."); state.aviso = "Recebemos seu pedido. Nossa equipe confirma por aqui."; }); return; }
  });

  app.addEventListener("submit", async (e) => {
    const form = e.target.closest("form");
    if (!form) return;
    e.preventDefault();
    const tipo = form.dataset.form || (form.classList.contains("form") ? "dados" : "");
    const dados = new FormData(form);
    if (tipo === "mensagem") {
      const texto = String(dados.get("texto") || "").trim();
      if (!texto) return;
      form.reset();
      state.messages = [...state.messages, { direction: "visitor", body: texto, created_at: Date.now() }]; desenharMensagens();
      try { await enviarMensagemSimples(texto); } catch (err) { state.erro = err.message; }
      return;
    }
    if (tipo === "outro-numero") {
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/resend-authorization`, { method: "POST", body: JSON.stringify({ phone: dados.get("phone") }) }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); state.outroNumero = false; state.aviso = "Enviamos a autorização para o novo número."; });
      return;
    }
    if (tipo === "dados") {
      const cliente = Object.fromEntries(dados.entries()); delete cliente.on;
      const botao = form.querySelector("button"); if (botao) { botao.disabled = true; botao.textContent = "Gerando sua proposta…"; }
      await executar(async () => { const d = await api(`/conversations/${state.session.id}/clt/personal-data`, { method: "POST", body: JSON.stringify({ customer: cliente }) }); state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); window.scrollTo(0, 0); });
    }
  });
  app.addEventListener("change", (e) => {
    if (e.target.name === "forma_desembolso") { const conta = app.querySelector(".conta-banco"); if (conta) conta.hidden = e.target.value !== "CONTA"; }
    if (e.target.name === "cliente_iletrado_impossibilitado") { const rogo = app.querySelector(".rogo"); if (rogo) rogo.hidden = e.target.value !== "S"; }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) { document.title = "Minha simulação | FelizCred"; atualizarClt(); atualizarMensagens(); } });

  // ── início ───────────────────────────────────────────────────────────────
  async function iniciar() {
    const codigo = new URLSearchParams(location.search).get("t");
    if (codigo) {
      try {
        const resposta = await fetch(`${API}/access`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: codigo }) });
        const d = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(d.error || "Esse link expirou. Abra o chat e informe seus dados para continuar.");
        guardarSessao({ id: d.conversation.id, token: d.token, name: d.conversation.name, contact: d.conversation.contact || "", email: d.conversation.email || "", expiresAt: Date.now() + DIAS_30 });
        state.clt = d.clt; state.assinatura = assinaturaClt(d.clt); state.messages = d.messages || [];
        history.replaceState(null, "", location.pathname);
      } catch (erro) {
        if (!lerSessao()) return telaErro(erro.message);
      }
    }
    if (!state.session) {
      const s = lerSessao();
      if (!s) return telaErro("Abra o link que enviamos para o seu e-mail para ver sua simulação.");
      state.session = s;
    }
    render();
    await Promise.all([atualizarClt(), atualizarMensagens()]);
    render();
    let tique = 0;
    sondagem = setInterval(() => { if (document.hidden) return; atualizarClt(); tique += 1; if (state.aba === "conversa" || tique % 2 === 0) atualizarMensagens(); }, 4000);
  }
  iniciar();
})();
