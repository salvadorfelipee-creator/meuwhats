(() => {
  const API = "https://meuwhats.onrender.com/site-chat/conversations";
  const STORAGE = "felizcred_site_chat_v1";
  const SESSION_TTL = 6 * 60 * 60 * 1000;
  const NUDGE_STORAGE = "felizcred_chat_nudge_shown_at";
  const NUDGE_TTL = 24 * 60 * 60 * 1000;
  const state = { session: null, messages: [], open: false, lastAgentCount: null, refreshing: false, step: 0, audioCtx: null, recorder: null, stream: null, chunks: [], clt: null, cltCpf: "", selectedOffer: null, authorizationOpened: false, cltCheckedAt: null, dismissedCltStatus: null, reasoningTimer: null, retryingAuthorization: false, userIsReadingHistory: false };
  const iconChat = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>';
  const iconClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const iconExpand = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>';
  const iconSend = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
  const root = document.createElement("div");
  root.className = "fc-chat-root";
  root.innerHTML = `
    <aside class="fc-chat-nudge" aria-live="polite"><button type="button" aria-label="Fazer simulação de empréstimo"><span>Felipe, da FelizCred</span><strong>Faça aqui sua simulação e aprovação do seu empréstimo.</strong><small>Eu acompanho você em cada etapa.</small></button></aside>
    <button class="fc-chat-launcher" type="button" aria-label="Abrir atendimento com Felipe, da FelizCred" aria-expanded="false"><img src="/assets/img/chat/felipe-atendimento-profissional-512.png" alt="Felipe, atendimento FelizCred"><span class="fc-chat-online" aria-hidden="true"></span><span class="fc-chat-launcher-copy"><b>Fale com Felipe</b><small>Simule agora</small></span><span class="fc-chat-unread">1</span></button>
    <section class="fc-chat" role="dialog" aria-label="Chat com a FelizCred" aria-hidden="true">
      <header class="fc-chat-head"><div class="fc-chat-brand"><img src="/assets/img/chat/felipe-atendimento-profissional-512.png" alt="Felipe, atendimento FelizCred"><i aria-hidden="true"></i></div><div class="fc-chat-head-copy"><span>Atendimento FelizCred</span><p class="fc-chat-title">Felipe</p><p class="fc-chat-status">Assistente online agora</p></div><button class="fc-chat-expand" type="button" aria-label="Expandir chat" aria-pressed="false">${iconExpand}</button><button class="fc-chat-close" type="button" aria-label="Minimizar chat">${iconClose}</button></header>
      <div class="fc-chat-offline" role="status">Você está sem internet. Sua conversa continua salva neste dispositivo.</div>
      <div class="fc-chat-assurance"><span><i></i> Conexão segura</span><span>Seus dados só são pedidos quando necessários</span></div>
      <div class="fc-chat-start"><div class="fc-chat-progress"><span></span></div>
        <form class="fc-chat-form" novalidate>
          <section class="fc-chat-step is-active" data-step="0"><p class="fc-chat-kicker">Simulação acompanhada</p><h2>Olá, como podemos chamar você?</h2><p class="fc-chat-hint">Vamos pedir somente o necessário em cada etapa.</p><input name="name" maxlength="80" autocomplete="name" required placeholder="Digite seu nome"><button class="fc-chat-primary fc-chat-next" type="button">Continuar <kbd>Enter ↵</kbd></button><button class="fc-chat-resume-link" type="button" data-open-recovery>Já iniciei uma proposta</button></section>
          <section class="fc-chat-step" data-step="1"><button class="fc-chat-back" type="button">← Voltar</button><p class="fc-chat-kicker">Só mais um dado</p><h2>Qual é o seu celular?</h2><p class="fc-chat-hint">Ele será reaproveitado na consulta e para você continuar pelo WhatsApp.</p><input name="contact" type="tel" inputmode="tel" maxlength="16" autocomplete="tel" required placeholder="(47) 99999-9999"><button class="fc-chat-primary fc-chat-next" type="button">Continuar <kbd>Enter ↵</kbd></button></section>
          <section class="fc-chat-step" data-step="2"><button class="fc-chat-back" type="button">← Voltar</button><p class="fc-chat-kicker">Continue por onde preferir</p><h2>Qual é o seu melhor e-mail?</h2><p class="fc-chat-hint">Enviaremos o acompanhamento por e-mail. O chat continua sendo seu canal principal.</p><input name="email" type="email" maxlength="160" autocomplete="email" required placeholder="voce@exemplo.com"><button class="fc-chat-primary fc-chat-next" type="button">Continuar <kbd>Enter ↵</kbd></button></section>
          <section class="fc-chat-step" data-step="3"><button class="fc-chat-back" type="button">← Voltar</button><p class="fc-chat-kicker">Escolha uma opção</p><h2>O que você quer resolver hoje?</h2><fieldset class="fc-chat-topics"><legend class="sr-only">Assunto</legend><label class="fc-chat-topic"><input type="radio" name="topic" value="FGTS" required><span><i>A</i><b>FGTS</b><small>Antecipação do saque-aniversário</small></span></label><label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo CLT" required><span><i>B</i><b>Empréstimo CLT</b><small>Simule agora com a Facta</small></span></label><label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo com carro em garantia" required><span><i>C</i><b>Carro em garantia</b><small>Empréstimo usando seu veículo</small></span></label></fieldset><label class="fc-chat-optin"><input type="checkbox" name="whatsapp_opt_in"><span>Aceito receber no WhatsApp mensagens da FelizCred sobre esta simulação e futuras oportunidades. Posso cancelar a qualquer momento.</span></label><button class="fc-chat-primary" type="submit">Começar atendimento ${iconSend}</button><p class="fc-chat-privacy">Ao continuar, você aceita nossa <a href="/privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a>.</p></section>
          <p class="fc-chat-error" role="alert"></p>
        </form>
        <form class="fc-chat-recovery" hidden novalidate><button class="fc-chat-back" type="button" data-close-recovery>← Voltar</button><h2>Continue de onde parou</h2><p>Informe os dados usados anteriormente. Vamos localizar sua solicitação e consultar o andamento agora.</p><label>CPF<input name="recovery_cpf" inputmode="numeric" autocomplete="off" maxlength="14" required placeholder="000.000.000-00"></label><label>Número da proposta ou celular<input name="recovery_reference" inputmode="numeric" autocomplete="tel" maxlength="20" required placeholder="Ex.: 123456 ou (47) 99999-9999"></label><p class="fc-chat-recovery-error" role="alert"></p><button class="fc-chat-primary" type="submit">Consultar meu andamento</button><small>Se ainda não recebeu o número da proposta, use o celular informado no atendimento.</small></form>
      </div>
      <div class="fc-chat-thread"><div class="fc-chat-messages" aria-live="polite"><span class="fc-chat-day">Conversa com a equipe FelizCred</span><div class="fc-chat-typing" role="status" aria-live="polite"><i aria-hidden="true"><span></span><span></span><span></span></i><small class="fc-reasoning-text">Analisando sua mensagem</small></div></div><div class="fc-chat-quick-replies" aria-label="Respostas rápidas"></div><div class="fc-chat-clt" aria-live="polite"></div><div class="fc-chat-emoji-menu"><button type="button">😊</button><button type="button">👍</button><button type="button">❤️</button><button type="button">😂</button><button type="button">🙏</button><button type="button">✅</button></div><form class="fc-chat-compose"><button class="fc-chat-more" type="button" aria-label="Mais opções" aria-expanded="false">+</button><div class="fc-chat-tools-menu" aria-label="Opções de mensagem"><button class="fc-chat-tool fc-chat-emoji" type="button" aria-label="Adicionar emoji"><span>☺</span> Emoji</button><label class="fc-chat-tool" aria-label="Anexar arquivo"><span>＋</span> Anexar<input class="fc-chat-file" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden></label><button class="fc-chat-tool fc-chat-mic" type="button" aria-label="Gravar áudio"><span>●</span> Áudio</button></div><textarea maxlength="2000" rows="1" aria-label="Mensagem" placeholder="Escreva sua mensagem..."></textarea><button class="fc-chat-send" type="submit" aria-label="Enviar mensagem">${iconSend}</button></form></div>
    </section>`;
  document.body.appendChild(root);
  const toBottomButton = document.createElement("button");
  toBottomButton.className = "fc-chat-to-bottom";
  toBottomButton.type = "button";
  toBottomButton.setAttribute("aria-label", "Ir para as mensagens mais recentes");
  toBottomButton.title = "Mensagens mais recentes";
  toBottomButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  root.querySelector(".fc-chat-thread").appendChild(toBottomButton);
  const $ = (s) => root.querySelector(s);
  const launcher = $(".fc-chat-launcher"), panel = $(".fc-chat"), close = $(".fc-chat-close"), expand = $(".fc-chat-expand"), nudge = $(".fc-chat-nudge");
  const startForm = $(".fc-chat-form"), recoveryForm = $(".fc-chat-recovery"), compose = $(".fc-chat-compose"), composeText = compose.querySelector("textarea");
  const messagesEl = $(".fc-chat-messages"), errorEl = $(".fc-chat-error"), unreadEl = $(".fc-chat-unread"), progress = $(".fc-chat-progress span");
  const fileInput = $(".fc-chat-file"), emojiButton = $(".fc-chat-emoji"), emojiMenu = $(".fc-chat-emoji-menu"), micButton = $(".fc-chat-mic"), moreButton = $(".fc-chat-more"), toolsMenu = $(".fc-chat-tools-menu");
  const cltEl = $(".fc-chat-clt"), typingEl = $(".fc-chat-typing"), quickRepliesEl = $(".fc-chat-quick-replies");
  const steps = [...root.querySelectorAll(".fc-chat-step")];
  function fieldForStep(step) { return step === 0 ? startForm.elements.name : step === 1 ? startForm.elements.contact : step === 2 ? startForm.elements.email : startForm.elements.topic; }
  function showError(message) { errorEl.textContent = message; errorEl.classList.add("show"); }
  function validStep(step) {
    const field = fieldForStep(step);
    if (step === 0 && field.value.trim().length < 2) { showError("Digite seu nome para continuar."); return false; }
    if (step === 1 && !/^\d{10,11}$/.test(field.value.replace(/\D/g, ""))) { showError("Digite um celular com DDD para continuar."); return false; }
    if (step === 2 && !field.checkValidity()) { showError("Digite um e-mail válido para continuar."); return false; }
    return true;
  }
  function goTo(step) {
    if (step > state.step && !validStep(state.step)) return;
    state.step = Math.max(0, Math.min(3, step)); errorEl.classList.remove("show");
    steps.forEach((node, index) => node.classList.toggle("is-active", index === state.step));
    progress.style.width = `${((state.step + 1) / 4) * 100}%`;
    setTimeout(() => fieldForStep(state.step)?.focus?.(), 220);
  }
  function sessionIsValid(session) { return !!(session?.id && session?.token && session?.email && Number(session.expiresAt) > Date.now()); }
  function resetSession() {
    localStorage.removeItem(STORAGE); state.session = null; state.messages = []; state.clt = null; state.cltCpf = ""; state.cltName = ""; state.cltPhone = ""; state.selectedOffer = null;
    root.classList.remove("has-conversation", "is-contracting", "is-expanded"); recoveryForm.hidden = true; startForm.hidden = false; goTo(0); renderClt();
  }
  function loadSession() { try { const saved = JSON.parse(localStorage.getItem(STORAGE) || "null"); state.session = sessionIsValid(saved) ? saved : null; } catch { state.session = null; } if (!state.session) localStorage.removeItem(STORAGE); else root.classList.add("has-conversation"); }
  function prepareNudge() {
    const title = nudge.querySelector("strong"), detail = nudge.querySelector("small");
    if (state.session) { title.textContent = "Continue aqui sua simulação e aprovação do empréstimo."; detail.textContent = "Sua conversa fica disponível por até 6 horas."; }
    else { title.textContent = "Faça aqui sua simulação e aprovação do seu empréstimo."; detail.textContent = "Eu acompanho você em cada etapa."; }
  }
  function showNudgeOnce() {
    let lastShown = 0;
    try { lastShown = Number(localStorage.getItem(NUDGE_STORAGE) || 0); } catch {}
    if (Date.now() - lastShown < NUDGE_TTL || state.open) return;
    nudge.classList.add("show");
    try { localStorage.setItem(NUDGE_STORAGE, String(Date.now())); } catch {}
  }
  function setOpen(open) { state.open = open; root.classList.toggle("is-open", open); nudge.classList.remove("show"); launcher.setAttribute("aria-expanded", String(open)); panel.setAttribute("aria-hidden", String(!open)); if (open) { unreadEl.classList.remove("show"); setTimeout(() => (state.session ? composeText : fieldForStep(state.step)).focus(), 180); refresh(); } else { prepareNudge(); setTimeout(showNudgeOnce, 280); } }
  function formatTime(ms) { return new Date(Number(ms)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function sound(kind) { try { const Ctx = window.AudioContext || window.webkitAudioContext; state.audioCtx ||= new Ctx(); const ctx = state.audioCtx, osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = "sine"; osc.frequency.value = kind === "in" ? 660 : 440; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .22); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .24); } catch {} }
  function appendMessageText(container, body) { const parts = String(body).split(/(https?:\/\/[^\s]+)/g); parts.forEach((part) => { if (/^https?:\/\//.test(part)) { const link = document.createElement("a"); link.href = part; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = /(?:wa\.me|whatsapp\.com)/i.test(part) ? "Continuar pelo WhatsApp" : "Abrir autorização segura"; container.appendChild(link); } else { container.appendChild(document.createTextNode(part)); } }); }
  function isNearBottom() { return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 56; }
  function updateScrollControl() { state.userIsReadingHistory = !isNearBottom(); toBottomButton.classList.toggle("show", state.userIsReadingHistory); }
  function scrollToLatest(behavior = "auto") { state.userIsReadingHistory = false; messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior }); toBottomButton.classList.remove("show"); }
  function updateComposeMode() { const lastAgent = [...state.messages].reverse().find((m) => m.direction === "agent")?.body || ""; const wantsCpf = !state.clt && /digite seu CPF/i.test(lastAgent); composeText.inputMode = wantsCpf ? "numeric" : "text"; composeText.placeholder = wantsCpf ? "Digite os 11 números do CPF" : "Escreva sua mensagem..."; composeText.maxLength = wantsCpf ? 14 : 2000; }
  function renderMessages(forceLatest = false) { const wasNearBottom = isNearBottom(); const distanceFromBottom = messagesEl.scrollHeight - messagesEl.scrollTop; messagesEl.querySelectorAll(".fc-chat-bubble").forEach((n) => n.remove()); state.messages.forEach((m) => { const bubble = document.createElement("div"); bubble.className = `fc-chat-bubble ${m.direction}`; if (m.media_url) { let media; if (m.type === "image") { media = document.createElement("img"); media.alt = m.file_name || "Imagem"; } else if (m.type === "video") { media = document.createElement("video"); media.controls = true; } else if (m.type === "audio") { media = document.createElement("audio"); media.controls = true; } else { media = document.createElement("a"); media.target = "_blank"; media.textContent = m.file_name || "Abrir arquivo"; } media.src = m.media_url; if (media.tagName === "A") media.href = m.media_url; media.className = "fc-chat-media"; bubble.appendChild(media); } if (m.body) { const text = document.createElement("p"); appendMessageText(text, m.body); bubble.appendChild(text); } const meta = document.createElement("small"); meta.textContent = `${m.direction === "agent" && m.sender_name ? `${m.sender_name} · ` : ""}${formatTime(m.created_at)}`; bubble.appendChild(meta); messagesEl.insertBefore(bubble, typingEl); }); if (forceLatest || wasNearBottom) scrollToLatest(); else messagesEl.scrollTop = Math.max(0, messagesEl.scrollHeight - distanceFromBottom); updateScrollControl(); renderQuickReplies(); updateComposeMode(); }
  function renderQuickReplies() { quickRepliesEl.innerHTML = ""; const ultima = [...state.messages].reverse().find((m) => m.direction === "agent")?.body || ""; const conversaFgts = state.session?.product === "FGTS" || state.messages.some((m) => m.direction === "visitor" && /^Tenho interesse em:\s*FGTS$/i.test(String(m.body || "").trim())); const whatsappNaResposta = ultima.match(/https?:\/\/(?:wa\.me|(?:www\.)?whatsapp\.com)\/[^\s]+/i)?.[0]; let items = whatsappNaResposta ? [{ label: "Continuar no WhatsApp", href: whatsappNaResposta }] : conversaFgts ? [{ label: "Continuar FGTS no WhatsApp", href: "https://wa.me/554792747368?text=Ol%C3%A1%2C%20quero%20consultar%20minha%20antecipa%C3%A7%C3%A3o%20do%20FGTS" }] : []; if (/ainda deseja falar com o atendimento humano|responda sim ou não/i.test(ultima)) items.push({ label: "Sim, falar com Felipe", message: "Sim" }, { label: "Continuar com o assistente", message: "Não" }); else if (!state.clt && /mais de 3 meses|completou esse período/i.test(ultima)) items.push({ label: "Sim", message: "Sim, tenho mais de 3 meses" }, { label: "Não", message: "Ainda não tenho 3 meses" }); items.forEach((item) => { const button = document.createElement("button"); button.type = "button"; button.textContent = item.label; button.addEventListener("click", () => item.href ? window.open(item.href, "_blank", "noopener,noreferrer") : sendPayload({ message: item.message })); quickRepliesEl.appendChild(button); }); }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function startReasoning(phrases = ["Analisando sua mensagem", "Consultando seu contexto", "Preparando a resposta"]) {
    window.clearInterval(state.reasoningTimer);
    const text = typingEl.querySelector(".fc-reasoning-text");
    let index = 0;
    text.textContent = phrases[index];
    typingEl.classList.add("show");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) state.reasoningTimer = window.setInterval(() => {
      text.classList.add("is-changing");
      window.setTimeout(() => { index = (index + 1) % phrases.length; text.textContent = phrases[index]; text.classList.remove("is-changing"); }, 180);
    }, 1500);
    if (isNearBottom()) scrollToLatest();
  }
  function stopReasoning() { window.clearInterval(state.reasoningTimer); state.reasoningTimer = null; typingEl.classList.remove("show"); }
  async function api(path = "", options = {}) { const headers = { "Content-Type": "application/json", ...(options.headers || {}) }; if (state.session?.token) headers["X-Chat-Token"] = state.session.token; const response = await fetch(`${API}${path}`, { cache: "no-store", ...options, headers }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Não foi possível conectar agora."); return data; }
  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inputDate = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || "")); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || ""); };
  function showCltActionError(message) {
    let error = cltEl.querySelector(".fc-clt-action-error");
    if (!error) { error = document.createElement("p"); error.className = "fc-clt-inline-error fc-clt-action-error"; cltEl.querySelector(".fc-clt-card")?.appendChild(error); }
    error.textContent = `${message} Tente novamente ou escreva sua dúvida abaixo.`;
    error.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  // Quando o cliente precisa sair do chat (autorizar no WhatsApp), o chat fecha sozinho e fica um aviso na bolinha. Quando
  // as condições chegam, avisa de novo e, se ele voltou para a página, o chat abre sozinho já no resultado.
  const ETAPAS_RESULTADO_CLT = ["ofertas_disponiveis", "sem_margem", "nao_elegivel", "sem_oferta", "erro_consulta", "erro_autorizacao", "politica_reprovada"];
  function avisoChat(titulo, detalhe) {
    const t = nudge.querySelector("strong"), d = nudge.querySelector("small");
    t.textContent = titulo; d.textContent = detalhe; nudge.classList.add("show");
    if (!state.open) unreadEl.classList.add("show");
  }
  function aoMudarEtapaClt(anterior, etapa) {
    if (etapa === "autorizacao_enviada" && anterior && state.open) {
      state.minimizadoParaAutorizar = true;
      setTimeout(() => {
        if (state.clt?.etapa !== "autorizacao_enviada" || !state.open) return;
        setOpen(false);
        setTimeout(() => avisoChat("Abra o WhatsApp e toque no link da Facta", "Quando suas condições chegarem, avisamos aqui."), 450);
      }, 4500);
      return;
    }
    if (anterior === "autorizacao_enviada" && ETAPAS_RESULTADO_CLT.includes(etapa) && !state.open) {
      const ok = etapa === "ofertas_disponiveis";
      if (state.minimizadoParaAutorizar && !document.hidden) { state.minimizadoParaAutorizar = false; setOpen(true); return; }
      avisoChat(ok ? "Suas condições chegaram! Toque para ver." : "Temos uma atualização da sua simulação.", ok ? "Valores liberados para você." : "Toque para ver o que aconteceu.");
      if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("FelizCred", { body: ok ? "Suas condições chegaram." : "Temos uma atualização da sua simulação." });
    }
  }
  // "Salvar minha simulação": um toque envia o acesso (sem senha) para o e-mail que o cliente já informou no início.
  function acessoEnviadoPara() { try { return localStorage.getItem(`fc_acesso_${state.session?.id}`) || ""; } catch { return ""; } }
  function blocoAcessoClt() {
    const enviado = acessoEnviadoPara();
    if (enviado) return `<div class="fc-clt-access is-done"><b>✓ Acesso enviado</b><span>Olhe seu e-mail (${esc(enviado)}) e toque em “Acessar minha simulação” para voltar quando quiser.</span></div>`;
    return `<div class="fc-clt-access"><b>Salvar minha simulação</b><span>Receba o acesso no seu e-mail e volte quando quiser. Sem senha.</span><button type="button" data-send-access>Enviar meu acesso</button><p class="fc-clt-inline-error" hidden></p></div>`;
  }
  function renderClt() {
    const c = state.clt;
    { const etapaAtual = typeof c === "string" ? c : c?.etapa; if (etapaAtual && etapaAtual !== state.ultimaEtapaClt) { const anterior = state.ultimaEtapaClt; state.ultimaEtapaClt = etapaAtual; aoMudarEtapaClt(anterior, etapaAtual); } }
    root.classList.toggle("is-contracting", !!state.selectedOffer || c?.etapa === "dados_pessoais" || c?.etapa === "ofertas_disponiveis");
    const status = $(".fc-chat-status");
    if (status) status.textContent = c?.etapa === "proposta_em_analise" ? "Proposta em análise" : c?.etapa === "proposta_concluida" ? "Proposta concluída" : c ? "Simulação Facta em andamento" : "Assistente online agora";
    if (!c) { cltEl.classList.remove("show"); cltEl.innerHTML = ""; return; }
    cltEl.classList.add("show");
    if (c === "eligibility") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Antes de começar</span><h3>Para fazer a simulação do seu consignado CLT, você precisa ter mais de 3 meses de registro no trabalho atual.</h3><div class="fc-clt-actions"><button type="button" class="fc-chat-primary" data-tenure="yes">Tenho mais de 3 meses</button><button type="button" class="fc-clt-secondary" data-tenure="no">Ainda não tenho</button></div></div>`;
      return;
    }
    if (c === "ineligible") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Entendido</span><h3>Ainda não conseguimos fazer sua simulação</h3><p>Quando completar 3 meses no trabalho atual, volte aqui para consultar suas condições.</p></div>`;
      return;
    }
    if (c === "start") {
      const phone = String(state.session?.contact || "").replace(/\D/g, "");
      // O celular fica sempre visível e editável: se a Facta recusar o número, o cliente troca só ele.
      const phoneField = `<label>Celular do WhatsApp que vai receber o link<input name="phone" inputmode="tel" autocomplete="tel" maxlength="16" required value="${esc(state.cltPhone || phone)}" placeholder="(47) 99999-9999"></label>`;
      const intro = state.retryingAuthorization
        ? "<p><b>Revise os dados abaixo e envie de novo.</b> Nome, CPF e celular continuam preenchidos. Se o celular for o que deu erro, troque só ele.</p>"
        : "<p>Confirme seu nome completo, CPF e o celular do WhatsApp que vai receber o link.</p>";
      cltEl.innerHTML = `<form class="fc-clt-card" data-action="start"><span class="fc-clt-step">1 de 5 · Autorização</span><h3>Vamos enviar sua autorização pela Facta</h3>${intro}<label>Nome completo<input name="name" autocomplete="name" required placeholder="Como aparece no documento" value="${esc(state.cltName || state.session?.name || "")}"></label><label>CPF<input name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" required placeholder="000.000.000-00" value="${esc(state.cltCpf || "")}"></label>${phoneField}<label class="fc-clt-consent"><input type="checkbox" required> Autorizo o envio destes dados à Facta para solicitar a consulta.</label><button class="fc-chat-primary">Enviar autorização no WhatsApp</button><small class="fc-clt-safe">A autorização permite consultar vínculo e margem. Ela não cria empréstimo.</small></form>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "solicitando_autorizacao") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">1 de 5 · Autorização</span><h3>Solicitando sua autorização…</h3><p>Aguarde enquanto conectamos com a Facta.</p><span class="fc-clt-loading">Enviando para o seu WhatsApp</span></div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "autorizacao_enviada") {
      const checked = c.checkedAt ? `<small class="fc-clt-checked">Última verificação: ${formatTime(c.checkedAt)}</small>` : "";
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">2 de 5 · Autorize no WhatsApp</span><h3>Enviamos o link da Facta</h3><p>Abra a mensagem recebida no celular informado e autorize a consulta. Depois, volte aqui para verificar suas condições.</p><div class="fc-clt-notice"><b>Você continua no controle</b><span>A autorização permite consultar vínculo, margem e dados necessários à simulação. Ainda não cria empréstimo.</span></div>${c.error ? `<p class="fc-clt-inline-error">${esc(c.error)}</p>` : ""}<button type="button" class="fc-chat-primary" data-confirm-authorization>Já autorizei, consultar agora</button><button type="button" class="fc-clt-link" data-resend-authorization>Reenviar autorização</button>${checked}</div>`;
      return;
    }
    if (c.provider === "facta" && ["erro_autorizacao", "erro_integracao"].includes(c.etapa)) {
      const integrationError = c.etapa === "erro_integracao";
      const phoneErro = /telefone j[aá] informado/i.test(String(c.error || ""));
      cltEl.innerHTML = `<div class="fc-clt-card fc-clt-status-card"><span class="fc-clt-step">${integrationError ? "Falha de conexão" : "Dados não aceitos"}</span><h3>${integrationError ? "A Facta não recebeu a solicitação" : "A autorização não foi enviada"}</h3>${phoneErro ? "<p><strong>Celular já usado:</strong> este número já está ligado a outro CPF na Facta, então o link não chega nele. Toque em <strong>Corrigir dados</strong>, troque apenas o celular pelo número do WhatsApp que você usa agora e envie de novo.</p>" : `<p><strong>Retorno:</strong> ${esc(c.error || "A Facta recusou a solicitação de autorização.")}</p>`}<p class="fc-clt-reassurance">Seus dados ficaram salvos e nenhum contrato foi criado.</p><div class="fc-clt-actions"><button type="button" class="fc-chat-primary" data-resend-authorization>${integrationError ? "Tentar novamente" : "Corrigir dados"}</button></div></div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "ofertas_disponiveis") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">3 de 5 · Escolha sua condição</span><h3>Suas condições estão prontas ✅</h3><p>Parcela máxima: <b>${money(c.maxInstallment || (c.offers[0] && c.offers[0].installmentValue))}</b>. Quer pagar menos por mês? Toque em “Escolher outra parcela”.</p><div class="fc-clt-offers">${c.offers.map((o) => `<button type="button" data-facta-offer="${esc(o.id)}" class="fc-clt-offer"><span>Você recebe</span><strong>${money(o.disbursedAmount)}</strong><small>${o.installments} parcelas de ${money(o.installmentValue)}${o.rate ? ` · Taxa informada ${Number(o.rate).toFixed(2)}%` : ""}${o.insuranceValue ? ` · Inclui seguro de ${money(o.insuranceValue)}` : ""}</small></button>`).join("")}</div><button type="button" class="fc-clt-link" data-lower>Escolher outra parcela</button><form class="fc-clt-resim" data-max="${Number(c.maxInstallment || 0)}" hidden><p>Digite assim: “Quero uma parcela de R$ 250”. O valor precisa ser de até ${money(c.maxInstallment)}.</p><label>Valor desejado da parcela<input name="installmentValue" inputmode="decimal" required placeholder="Ex.: 250,00"></label><p class="fc-clt-inline-error" hidden></p><button class="fc-chat-primary">Ver prazos disponíveis</button></form>${blocoAcessoClt()}<div class="fc-clt-notice"><b>Antes de continuar</b><span>Valores estimados: a aprovação final é da Facta, e você revê o contrato completo antes de assinar.</span></div></div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "dados_pessoais") {
      const d = c.customerDefaults || {}, offer = c.selectedOffer || {};
      cltEl.innerHTML = `<form class="fc-clt-card fc-clt-formalize" data-action="facta-personal"><span class="fc-clt-step">4 de 5 · Dados da proposta</span><h3>Complete seus dados</h3><p>Condição selecionada: você recebe aproximadamente <b>${money(offer.disbursedAmount)}</b> e paga ${offer.installments || "—"} parcelas de ${money(offer.installmentValue)}.</p><div class="fc-clt-section"><b>Dados pessoais</b><div class="fc-clt-grid"><label>Nome completo<input name="nome" value="${esc(d.nome)}" required autocomplete="name"></label><label>Sexo<select name="sexo" required><option value="">Selecione</option><option value="M" ${d.sexo === "M" ? "selected" : ""}>Masculino</option><option value="F" ${d.sexo === "F" ? "selected" : ""}>Feminino</option></select></label><label>Estado civil<select name="estado_civil" required><option value="">Selecione</option><option value="4">Solteiro(a)</option><option value="3">Casado(a)</option><option value="2">Divorciado(a)</option><option value="5">Viúvo(a)</option><option value="9">União estável</option><option value="6">Outro</option></select></label><label>Data de nascimento<input name="data_nascimento" type="date" value="${esc(inputDate(d.data_nascimento))}" required></label><label>RG<input name="rg" required inputmode="numeric"></label><label>UF do RG<input name="estado_rg" maxlength="2" required placeholder="SC"></label><label>Órgão emissor<input name="orgao_emissor" required placeholder="SSP"></label><label>Data de expedição<input name="data_expedicao" type="date" required></label><label>UF de nascimento<input name="estado_natural" maxlength="2" required placeholder="SC"></label><label>Cidade de nascimento<input name="cidade_natural_nome" required></label><label>Nacionalidade<select name="nacionalidade" required><option value="1">Brasileiro(a)</option><option value="2">Estrangeiro(a)</option></select></label><label>Celular<input name="celular" required inputmode="tel"></label><label>E-mail<input name="email" type="email" autocomplete="email"></label><label>Nome da mãe<input name="nome_mae" value="${esc(d.nome_mae)}" required></label><label>Nome do pai<input name="nome_pai" required placeholder="Ou NÃO DECLARADO"></label><label>Faixa de patrimônio<select name="valor_patrimonio" required><option value="1">Até R$ 10 mil</option><option value="2">De R$ 10 mil a R$ 100 mil</option><option value="3">De R$ 100 mil a R$ 500 mil</option><option value="4">De R$ 500 mil a R$ 1 milhão</option><option value="5">Acima de R$ 1 milhão</option></select></label></div></div><div class="fc-clt-section"><b>Endereço</b><div class="fc-clt-grid"><label>CEP<input name="cep" required inputmode="numeric" maxlength="9"></label><label>Endereço<input name="endereco" required></label><label>Número<input name="numero" required inputmode="numeric"></label><label>Complemento<input name="complemento"></label><label>Bairro<input name="bairro" required></label><label>Cidade<input name="cidade_nome" required></label><label>UF<input name="estado" required maxlength="2" placeholder="SC"></label></div></div><div class="fc-clt-section"><b>Conta para recebimento</b><div class="fc-clt-grid"><label>Banco<select name="banco" required><option value="">Selecione</option><option value="001">Banco do Brasil</option><option value="033">Santander</option><option value="104">Caixa</option><option value="237">Bradesco</option><option value="341">Itaú</option><option value="260">Nubank</option><option value="077">Inter</option><option value="336">C6 Bank</option></select></label><label>Tipo de conta<select name="tipo_conta" required><option value="C">Conta corrente</option><option value="P">Conta poupança</option></select></label><label>Agência<input name="agencia" required inputmode="numeric"></label><label>Conta com dígito<input name="conta" required></label><label>Tipo de chave Pix<select name="tipo_chave_pix" required><option value="1">CPF</option><option value="2">Telefone</option><option value="3">E-mail</option><option value="4">Chave aleatória</option></select></label><label>Chave Pix<input name="chave_pix" required></label></div></div><input type="hidden" name="renda" value="${esc(d.renda)}"><input type="hidden" name="matricula" value="${esc(d.matricula)}"><input type="hidden" name="cnpj_empregador" value="${esc(d.cnpj_empregador)}"><input type="hidden" name="data_admissao" value="${esc(inputDate(d.data_admissao))}"><label>Precisa de assinatura a rogo?<select name="cliente_iletrado_impossibilitado" required><option value="N">Não</option><option value="S">Sim</option></select></label><div class="fc-clt-rogo" hidden><div class="fc-clt-grid"><label>Nome de quem assina a rogo<input name="nome_a_rogo"></label><label>CPF de quem assina<input name="cpf_a_rogo" inputmode="numeric"></label><label>Nome da testemunha<input name="nome_a_rogo_testemunha"></label><label>CPF da testemunha<input name="cpf_a_rogo_testemunha" inputmode="numeric"></label></div></div><label class="fc-clt-consent"><input type="checkbox" required> Confirmo que os dados estão corretos e autorizo a geração de uma proposta real na Facta. Poderei revisar o contrato antes de assinar.</label><button class="fc-chat-primary">Gerar proposta para revisão</button></form>`;
      const customerPhone = cltEl.querySelector('[name="celular"]');
      if (customerPhone) customerPhone.value = d.celular || "";
      return;
    }
    if (c.provider === "facta" && ["sem_margem", "nao_elegivel", "sem_oferta", "politica_reprovada", "erro_consulta"].includes(c.etapa)) {
      const titles = { sem_margem: "Não há margem disponível agora", nao_elegivel: "O vínculo não está elegível agora", sem_oferta: "A Facta não encontrou uma condição", politica_reprovada: "A proposta não passou pela política da Facta", erro_consulta: "A Facta não concluiu a consulta" };
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Análise concluída</span><h3>${titles[c.etapa]}</h3><p>${esc(c.error || "Neste momento não é possível continuar automaticamente com esta contratação.")}</p><button type="button" class="fc-clt-secondary" data-talk-agent>Falar com um atendente</button></div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "aguardando_assinatura_facta") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">5 de 5 · Revisão e assinatura</span><h3>Sua proposta foi gerada</h3><p>Revise no ambiente seguro da Facta o valor liberado, parcelas, taxa, CET e demais condições. A contratação só é concluída depois da sua assinatura.</p><a class="fc-chat-primary" href="${esc(c.contractLink)}" target="_blank" rel="noopener noreferrer">Revisar e assinar na Facta</a>${c.trackingUrl ? `<a class="fc-clt-secondary" href="${esc(c.trackingUrl)}" target="_blank" rel="noopener noreferrer">Ver página de acompanhamento</a>` : ""}<button type="button" class="fc-clt-secondary" data-refresh-clt>Já assinei, verificar andamento</button><small class="fc-clt-checked">Proposta ${esc(c.proposalCode || "")} · Também solicitamos o envio do link para o seu WhatsApp.</small>${c.error ? `<p class="fc-clt-inline-error">${esc(c.error)}</p>` : ""}</div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "proposta_em_analise") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Proposta em acompanhamento</span><h3>A Facta está analisando sua proposta</h3><p>A assinatura foi recebida ou a proposta avançou para análise. Status atual: <strong>${esc(c.status || "Em análise")}</strong>.</p>${c.trackingUrl ? `<a class="fc-chat-primary" href="${esc(c.trackingUrl)}" target="_blank" rel="noopener noreferrer">Acompanhar em página completa</a>` : ""}<button type="button" class="fc-clt-secondary" data-refresh-clt>Atualizar andamento</button><small class="fc-clt-checked">Você não precisa preencher os dados novamente.</small></div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "proposta_concluida") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Contratação concluída</span><h3>Proposta concluída pela Facta</h3><p>Status atual: <strong>${esc(c.status || "Concluída")}</strong>. Guarde o número da proposta ${esc(c.proposalCode || "")} para acompanhamento.</p>${c.trackingUrl ? `<a class="fc-clt-secondary" href="${esc(c.trackingUrl)}" target="_blank" rel="noopener noreferrer">Ver resumo da proposta</a>` : ""}</div>`;
      return;
    }
    if (c.provider === "facta" && c.etapa === "proposta_cancelada") {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Atualização do contrato</span><h3>Seu contrato não foi finalizado</h3><p>Nossa equipe já recebeu a atualização. Aguarde o atendimento para mais detalhes.</p></div>`;
      return;
    }
    if (["aguardando_autorizacao", "simulando"].includes(c.etapa)) {
      const demorando = c.waitingSince && Date.now() - Number(c.waitingSince) > 180_000;
      const termsLink = c.termsLink ? String(c.termsLink).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
      const statusEmProcessamento = /simulation in progress/i.test(c.status || "");
      const bankStatus = statusEmProcessamento ? "Simulação em processamento" : c.status ? String(c.status).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "Aguardando processamento";
      const checkedCopy = state.cltCheckedAt ? `<small class="fc-clt-checked">Última verificação: ${formatTime(state.cltCheckedAt)}</small>` : "";
      const authorizationCopy = demorando
        ? `A autorização foi enviada, mas o banco ainda não devolveu as ofertas. Status atual: <strong>${bankStatus}</strong>. Você não precisa preencher novamente.`
        : state.authorizationOpened
        ? "Conclua o formulário na janela do banco. Depois, feche essa janela e volte aqui: suas ofertas aparecerão automaticamente."
        : "A autorização abrirá em uma janela segura do banco. Depois de enviar o formulário, volte a este chat para ver suas ofertas.";
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">2 de 5 · Autorização</span><h3>${c.error ? "O banco não concluiu a análise" : c.termsLink ? demorando ? "Aguardando as ofertas do banco" : state.authorizationOpened ? "Aguardando a autorização do banco" : "Autorize a consulta" : demorando ? "O banco ainda está preparando o link" : "Preparando sua autorização…"}</h3><p>${c.error ? c.error : c.termsLink ? authorizationCopy : demorando ? "Pode demorar um pouco no ambiente de testes. Continue nesta conversa; o botão aparecerá automaticamente assim que o banco liberar." : "Isso costuma levar poucos segundos."}</p>${c.termsLink && !c.error ? `<div class="fc-clt-actions"><button type="button" class="fc-chat-primary" data-refresh-clt>Verificar ofertas agora</button>${statusEmProcessamento ? "" : `<a class="fc-clt-secondary" href="${termsLink}" target="_blank" rel="noopener" data-open-authorization>${state.authorizationOpened ? "Abrir autorização novamente" : "Autorizar no banco"}</a>`}${checkedCopy}</div>` : c.error ? '<button type="button" class="fc-chat-primary" data-refresh-clt>Verificar novamente</button>' : '<span class="fc-clt-loading">Consultando o banco…</span>'}</div>`;
      return;
    }
    if (c.etapa === "sem_oferta") { cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Consulta concluída</span><h3>Não há uma oferta disponível agora</h3><p>Você poderá tentar novamente quando sua margem mudar.</p></div>`; return; }
    if (c.etapa === "oferta_disponivel" && !state.selectedOffer) {
      const priority = (term) => Number(term) === 18 ? 0 : Number(term) === 24 ? 1 : 2;
      const offers = [...c.offers].sort((a, b) => priority(a.installments) - priority(b.installments) || Number(a.installments) - Number(b.installments));
      const maxInstallment = Math.max(...offers.map((o) => Number(o.installmentValue || 0)));
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">3 de 5 · Escolha</span><h3>Estas são suas condições</h3><p>Veja o valor máximo da parcela disponível para cada prazo. Escolha uma opção ou clique em “Escolher outra parcela”.</p><div class="fc-clt-offers">${offers.map((o) => `<button type="button" data-offer="${o.simulationId}" class="fc-clt-offer"><span>${o.installments} parcelas de</span><strong>${money(o.installmentValue)}</strong><small>Você recebe ${money(o.disbursedAmount)} · CET mensal ${Number(o.cetMonthlyRate || 0).toFixed(2)}%</small></button>`).join("")}</div><button type="button" class="fc-clt-link" data-lower>Escolher outra parcela</button><form class="fc-clt-resim" data-max="${maxInstallment}" hidden><p>Digite assim: “Quero uma parcela de R$ 250”. O valor precisa ser de até ${money(maxInstallment)}.</p><label>Valor desejado da parcela<input name="installmentValue" inputmode="decimal" required placeholder="Ex.: 250,00"></label><p class="fc-clt-inline-error" hidden></p><button class="fc-chat-primary">Ver prazos disponíveis</button></form></div>`;
      return;
    }
    if (state.selectedOffer) {
      cltEl.innerHTML = `<form class="fc-clt-card fc-clt-formalize" data-action="formalize"><span class="fc-clt-step">4 de 5 · Seus dados</span><h3>Complete a contratação</h3><p>Oferta escolhida: <b>${money(state.selectedOffer.disbursedAmount)}</b>, ${state.selectedOffer.installments}x de ${money(state.selectedOffer.installmentValue)}.</p><input type="hidden" name="simulationId" value="${state.selectedOffer.simulationId}"><div class="fc-clt-grid"><label>CPF<input name="cpf" required inputmode="numeric" value="${state.cltCpf}"></label><label>Nome completo<input name="nome" required autocomplete="name"></label><label>Nascimento<input name="data_nascimento" type="date" required></label><label>Gênero<select name="genero" required><option value="">Selecione</option><option value="M">Masculino</option><option value="F">Feminino</option></select></label><label>Profissão<input name="profissao" required></label><label>Celular<input name="celular" required inputmode="tel"></label><label>E-mail<input name="email" type="email" required></label><label>CEP<input name="cep" required inputmode="numeric"></label><label>Rua<input name="rua" required></label><label>Número<input name="numero" required></label><label>Bairro<input name="bairro" required></label><label>Cidade<input name="cidade" required></label><label>UF<input name="uf" required maxlength="2"></label><label>E-mail da empresa/RH<input name="email_rh" type="email" required></label><label>Recebimento<select name="forma_desembolso" required><option value="PIX">PIX</option><option value="CONTA">Conta bancária</option></select></label><label>Tipo da chave PIX<select name="pix_tipo"><option>CPF (o meu)</option><option>E-mail</option><option>Telefone</option><option>Chave aleatória</option></select></label><label>Chave PIX<input name="pix_chave"></label><label>Banco (se conta)<select name="banco"><option value="">Selecione</option><option>Banco do Brasil</option><option>Santander</option><option>Caixa Econômica Federal</option><option>Bradesco</option><option>Itaú</option><option>Nubank</option><option>Inter</option><option>C6 Bank</option></select></label><label>Tipo da conta<select name="tipo_conta"><option value="">Selecione</option><option>Corrente</option><option>Poupança</option><option>Salário</option></select></label><label>Agência<input name="agencia"></label><label>Conta<input name="conta"></label><label>Dígito<input name="digito_conta"></label></div><label class="fc-clt-consent"><input type="checkbox" required> Autorizo o envio destes dados para formalização da proposta.</label><button class="fc-chat-primary">Gerar contrato</button></form>`;
      return;
    }
    if (["formalizando", "aguardando_assinatura", "concluido"].includes(c.etapa)) {
      const ready = !!c.contractLink;
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">5 de 5 · Assinatura</span><h3>${ready ? "Seu contrato está pronto" : "Estamos gerando seu contrato…"}</h3><p>${ready ? "Revise os dados e assine no ambiente seguro. O andamento continuará aparecendo aqui." : "Pode levar alguns segundos. Você não precisa repetir seus dados."}</p>${ready ? `<a class="fc-chat-primary" href="${c.contractLink}" target="_blank" rel="noopener">Revisar e assinar contrato</a>` : '<span class="fc-clt-loading">Processando…</span>'}</div>`;
    }
  }
  async function refreshClt() { if (!state.session) return; if (state.clt === "start") return; try { const data = await api(`/${state.session.id}/clt/status`); if (data.clt) { state.clt = data.clt; renderClt(); } } catch {} }
  async function refresh(semAtraso = false) { if (!state.session || state.refreshing) return; state.refreshing = true; try { const data = await api(`/${state.session.id}`); const count = data.messages.filter((m) => m.direction === "agent").length; const novaResposta = state.lastAgentCount !== null && count > state.lastAgentCount; if (novaResposta && !semAtraso) { startReasoning(["Nova resposta recebida", "Organizando a conversa"]); await wait(900); } if (novaResposta) { sound("in"); if (!state.open) unreadEl.classList.add("show"); if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("FelizCred respondeu", { body: data.messages.at(-1)?.body || "Você recebeu uma nova mensagem." }); } state.lastAgentCount = count; state.messages = data.messages; renderMessages(); } catch (error) { if (/não encontrada/i.test(error.message)) { localStorage.removeItem(STORAGE); state.session = null; root.classList.remove("has-conversation"); } } finally { stopReasoning(); state.refreshing = false; } }
  root.querySelectorAll(".fc-chat-next").forEach((b) => b.addEventListener("click", () => goTo(state.step + 1)));
  root.querySelectorAll(".fc-chat-back").forEach((b) => b.addEventListener("click", () => goTo(state.step - 1)));
  startForm.addEventListener("keydown", (e) => { if (e.key === "Enter" && state.step < 3) { e.preventDefault(); goTo(state.step + 1); } if (state.step === 3 && ["a","b","c"].includes(e.key.toLowerCase())) startForm.elements.topic[["a","b","c"].indexOf(e.key.toLowerCase())].checked = true; });
  startForm.addEventListener("submit", async (e) => { e.preventDefault(); const form = new FormData(startForm), topic = form.get("topic"); if (!topic) return showError("Escolha uma opção para iniciar a conversa."); const button = startForm.querySelector('button[type="submit"]'); button.disabled = true; errorEl.classList.remove("show"); try { const contact = String(form.get("contact") || ""), email = String(form.get("email") || ""), name = String(form.get("name") || ""); const data = await api("", { method: "POST", body: JSON.stringify({ name, contact, email, whatsappOptIn: form.has("whatsapp_opt_in"), message: `Tenho interesse em: ${topic}`, pageUrl: location.href }) }); state.session = { id: data.conversation.id, token: data.token, name, contact, email, product: String(topic), expiresAt: Date.now() + SESSION_TTL }; state.messages = data.messages; localStorage.setItem(STORAGE, JSON.stringify(state.session)); root.classList.add("has-conversation"); renderMessages(); if (/CLT/i.test(topic)) { state.clt = "eligibility"; renderClt(); } sound("out"); composeText.focus(); } catch (error) { showError(error.message); } finally { button.disabled = false; } });
  $("[data-open-recovery]").addEventListener("click", () => { startForm.hidden = true; recoveryForm.hidden = false; recoveryForm.elements.recovery_cpf.focus(); });
  $("[data-close-recovery]").addEventListener("click", () => { recoveryForm.hidden = true; startForm.hidden = false; startForm.elements.name.focus(); });
  recoveryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = recoveryForm.querySelector('button[type="submit"]'), error = $(".fc-chat-recovery-error"), form = new FormData(recoveryForm);
    button.disabled = true; button.textContent = "Consultando…"; error.classList.remove("show");
    try {
      if (String(form.get("recovery_cpf") || "").replace(/\D/g, "").length !== 11) throw new Error("Digite o CPF completo para continuar.");
      if (String(form.get("recovery_reference") || "").replace(/\D/g, "").length < 4) throw new Error("Informe o número da proposta ou o celular usado no atendimento.");
      const response = await fetch(`${API.replace(/\/conversations$/, "")}/recover`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpf: form.get("recovery_cpf"), reference: form.get("recovery_reference") }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar agora.");
      state.session = { id: data.conversation.id, token: data.token, name: data.conversation.name, contact: data.conversation.contact || "", email: data.conversation.email || "", expiresAt: Date.now() + SESSION_TTL };
      state.messages = data.messages || []; state.clt = data.clt || null;
      localStorage.setItem(STORAGE, JSON.stringify(state.session));
      root.classList.add("has-conversation"); renderMessages(); renderClt(); sound("in"); composeText.focus();
    } catch (err) { error.textContent = err.message; error.classList.add("show"); }
    finally { button.disabled = false; button.textContent = "Consultar meu andamento"; }
  });
  cltEl.addEventListener("click", async (e) => {
    const sendAccess = e.target.closest("[data-send-access]");
    if (sendAccess) {
      sendAccess.disabled = true; sendAccess.textContent = "Enviando…";
      try {
        const data = await api(`/${state.session.id}/clt/access-email`, { method: "POST", body: "{}" });
        try { localStorage.setItem(`fc_acesso_${state.session.id}`, data.email || "seu e-mail"); } catch {}
        renderClt();
      } catch (error) {
        sendAccess.disabled = false; sendAccess.textContent = "Enviar meu acesso";
        const erro = cltEl.querySelector(".fc-clt-access .fc-clt-inline-error");
        if (erro) { erro.textContent = error.message || "Não foi possível enviar agora."; erro.hidden = false; }
      }
      return;
    }
    if (e.target.closest("[data-dismiss-clt-status]")) {
      const c = state.clt;
      state.dismissedCltStatus = `${c?.etapa || ""}:${c?.status || ""}:${c?.error || ""}`;
      cltEl.classList.remove("show");
      cltEl.innerHTML = "";
      composeText.focus();
      return;
    }
    const confirmAuthorization = e.target.closest("[data-confirm-authorization]");
    if (confirmAuthorization) {
      confirmAuthorization.disabled = true;
      confirmAuthorization.textContent = "Confirmando…";
      try {
        const data = await api(`/${state.session.id}/clt/confirm-authorization`, { method: "POST", body: "{}" });
        state.clt = data.clt;
        renderClt();
        await refresh();
      } catch (error) {
        confirmAuthorization.disabled = false;
        confirmAuthorization.textContent = "Já fiz a autorização";
        showCltActionError(error.message);
      }
      return;
    }
    const resendAuthorization = e.target.closest("[data-resend-authorization]");
    if (resendAuthorization) {
      if (["erro_autorizacao", "erro_integracao"].includes(state.clt?.etapa)) { state.retryingAuthorization = true; state.clt = "start"; renderClt(); return; }
      resendAuthorization.disabled = true;
      resendAuthorization.textContent = "Reenviando…";
      try {
        const data = await api(`/${state.session.id}/clt/resend-authorization`, { method: "POST", body: "{}" });
        state.clt = data.clt;
        renderClt();
      } catch (error) { showCltActionError(error.message); resendAuthorization.disabled = false; }
      return;
    }
    const factaOffer = e.target.closest("[data-facta-offer]");
    if (factaOffer) {
      factaOffer.disabled = true;
      const original = factaOffer.innerHTML;
      factaOffer.innerHTML = "<strong>Analisando esta condição…</strong><small>A Facta está verificando a política de crédito.</small>";
      try {
        const data = await api(`/${state.session.id}/clt/select-offer`, { method: "POST", body: JSON.stringify({ offerId: factaOffer.dataset.factaOffer }) });
        state.clt = data.clt;
        renderClt();
        await refresh();
      } catch (error) { factaOffer.disabled = false; factaOffer.innerHTML = original; showCltActionError(error.message); }
      return;
    }
    if (e.target.closest("[data-talk-agent]")) {
      composeText.value = "Quero falar com um atendente sobre minha consulta CLT.";
      composeText.focus();
      return;
    }
    const authorizationLink = e.target.closest("[data-open-authorization]");
    if (authorizationLink) {
      const width = Math.min(720, Math.max(360, window.screen.availWidth - 32));
      const height = Math.min(820, Math.max(600, window.screen.availHeight - 80));
      const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
      const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
      const popup = window.open("", "felizcred_autorizacao", `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
      if (popup) {
        e.preventDefault();
        popup.opener = null;
        popup.location.href = authorizationLink.href;
        popup.focus();
        state.authorizationOpened = true;
        renderClt();
      }
      return;
    }
    const tenure = e.target.closest("[data-tenure]");
    if (tenure) { tenure.disabled = true; await sendPayload({ message: tenure.dataset.tenure === "yes" ? "Sim, tenho mais de 3 meses" : "Ainda não tenho 3 meses" }); return; }
    const offerButton = e.target.closest("[data-offer]");
    if (offerButton) { state.selectedOffer = state.clt.offers.find((o) => String(o.simulationId) === offerButton.dataset.offer); renderClt(); return; }
    if (e.target.closest("[data-lower]")) { cltEl.querySelector(".fc-clt-resim").hidden = false; }
    if (e.target.closest("[data-refresh-clt]")) { const retry = e.target.closest("[data-refresh-clt]"); retry.disabled = true; retry.textContent = "Verificando no banco…"; await refreshClt(); state.cltCheckedAt = Date.now(); renderClt(); }
  });
  cltEl.addEventListener("submit", async (e) => {
    e.preventDefault(); const form = new FormData(e.target), button = e.target.querySelector('button[type="submit"],button:not([type])'); if (button) button.disabled = true;
    startReasoning(e.target.dataset.action === "start" ? ["Conectando com a Facta", "Verificando a autorização", "Preparando o próximo passo"] : ["Validando seus dados", "Consultando a Facta", "Preparando o próximo passo"]);
    try {
      if (e.target.dataset.action === "start") {
        state.cltCpf = String(form.get("cpf") || "");
        state.cltName = String(form.get("name") || "");
        state.cltPhone = String(form.get("phone") || "");
        const path = state.retryingAuthorization ? "resend-authorization" : "start";
        const data = await api(`/${state.session.id}/clt/${path}`, { method: "POST", body: JSON.stringify({ name: form.get("name"), cpf: state.cltCpf, phone: form.get("phone") }) }); state.clt = data.clt; state.retryingAuthorization = false;
      } else if (e.target.dataset.action === "facta-personal") {
        const customer = Object.fromEntries(form.entries());
        delete customer["on"];
        const data = await api(`/${state.session.id}/clt/personal-data`, { method: "POST", body: JSON.stringify({ customer }) });
        state.clt = data.clt;
      } else if (e.target.classList.contains("fc-clt-resim")) {
        const rawRequested = String(form.get("installmentValue") || "");
        const matchRequested = rawRequested.match(/\d[\d.]*([,]\d{1,2})?/);
        const requested = matchRequested ? Number(matchRequested[0].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) : NaN;
        const maximum = Number(e.target.dataset.max || 0);
        if (requested > maximum) {
          const error = e.target.querySelector(".fc-clt-inline-error");
          error.textContent = `Essa parcela não está disponível porque ultrapassa o máximo permitido de ${money(maximum)}. Digite um valor menor.`;
          error.hidden = false;
          return;
        }
        const data = await api(`/${state.session.id}/clt/resimulate`, { method: "POST", body: JSON.stringify({ installmentValue: form.get("installmentValue") }) }); state.clt = data.clt;
      } else if (e.target.dataset.action === "formalize") {
        const customer = Object.fromEntries(form.entries()); delete customer.simulationId; delete customer.cpf;
        const data = await api(`/${state.session.id}/clt/formalize`, { method: "POST", body: JSON.stringify({ simulationId: form.get("simulationId"), cpf: form.get("cpf") || state.cltCpf, customer }) }); state.selectedOffer = null; state.clt = data.clt;
      }
      renderClt(); await refresh();
    } catch (error) {
      let inline = e.target.querySelector(".fc-clt-submit-error");
      if (!inline) {
        inline = document.createElement("p");
        inline.className = "fc-clt-inline-error fc-clt-submit-error";
        e.target.insertBefore(inline, button || null);
      }
      inline.textContent = error.message;
      inline.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally { stopReasoning(); if (button) button.disabled = false; }
  });
  cltEl.addEventListener("change", (e) => {
    if (e.target.name !== "cliente_iletrado_impossibilitado") return;
    const rogo = cltEl.querySelector(".fc-clt-rogo");
    if (!rogo) return;
    const enabled = e.target.value === "S";
    rogo.hidden = !enabled;
    rogo.querySelectorAll("input").forEach((input) => { input.required = enabled; });
  });
  async function sendPayload(payload) { const button = $(".fc-chat-send"); button.disabled = true; const started = Date.now(); if (payload.message) { state.messages.push({ id: `local-${started}`, direction: "visitor", body: payload.message, created_at: started }); renderMessages(true); } composeText.value = ""; startReasoning(); try { const result = await api(`/${state.session.id}`, { method: "POST", body: JSON.stringify(payload) }); const restante = 1500 - (Date.now() - started); if (restante > 0) await wait(restante); const digits = String(payload.message || "").replace(/\D/g, ""); const cpfStart = digits.length === 11 ? digits : String(result.cltCpf || ""); if ((result.cltStep === "start" || result.cltStep === "start_cpf") && cpfStart.length === 11) { state.cltCpf = cpfStart; if (result.cltNome && state.session) state.session.name = result.cltNome; const phone = String(state.session?.contact || "").replace(/\D/g, ""); const data = await api(`/${state.session.id}/clt/start`, { method: "POST", body: JSON.stringify({ name: result.cltNome || state.session?.name, cpf: cpfStart, phone }) }); state.clt = data.clt; } else if (result.cltStep === "need_name") { state.clt = null; } else if (result.cltStep) { state.clt = result.cltStep === "start" ? null : result.cltStep; } else if (result.clt && !state.clt) { state.clt = "eligibility"; } renderClt(); while (state.refreshing) await wait(50); await Promise.all([refresh(true), refreshClt()]); } finally { stopReasoning(); button.disabled = false; updateComposeMode(); } }
  compose.addEventListener("submit", async (e) => { e.preventDefault(); const message = composeText.value.trim(); if (message) await sendPayload({ message }); });
  moreButton.addEventListener("click", () => { const open = toolsMenu.classList.toggle("show"); moreButton.classList.toggle("is-open", open); moreButton.setAttribute("aria-expanded", String(open)); emojiMenu.classList.remove("show"); });
  emojiButton.addEventListener("click", () => { toolsMenu.classList.remove("show"); moreButton.classList.remove("is-open"); moreButton.setAttribute("aria-expanded", "false"); emojiMenu.classList.toggle("show"); });
  emojiMenu.addEventListener("click", (e) => { if (e.target === emojiMenu) return; const emoji = e.target.textContent; composeText.value += emoji; emojiMenu.classList.remove("show"); composeText.focus(); });
  document.addEventListener("click", (e) => { if (!compose.contains(e.target) && !emojiMenu.contains(e.target)) { toolsMenu.classList.remove("show"); emojiMenu.classList.remove("show"); moreButton.classList.remove("is-open"); moreButton.setAttribute("aria-expanded", "false"); } });
  fileInput.addEventListener("change", async () => { const file = fileInput.files?.[0]; if (!file) return; if (file.size > 15 * 1024 * 1024) return alert("O arquivo deve ter no máximo 15 MB."); const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); const key = file.type.startsWith("image/") ? "imagemBase64" : file.type.startsWith("video/") ? "videoBase64" : file.type.startsWith("audio/") ? "audioBase64" : "documentBase64"; await sendPayload({ message: composeText.value.trim(), [key]: data, fileName: file.name }); fileInput.value = ""; });
  micButton.addEventListener("click", async () => { if (state.recorder?.state === "recording") { state.recorder.stop(); return; } try { state.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); state.recorder = new MediaRecorder(state.stream); state.chunks = []; state.recorder.ondataavailable = (e) => e.data.size && state.chunks.push(e.data); state.recorder.onstop = async () => { const blob = new Blob(state.chunks, { type: state.recorder.mimeType || "audio/webm" }); state.stream.getTracks().forEach((t) => t.stop()); micButton.classList.remove("recording"); const data = await new Promise((resolve) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(blob); }); await sendPayload({ audioBase64: data, fileName: "audio.webm" }); }; state.recorder.start(); micButton.classList.add("recording"); } catch { alert("Autorize o microfone para gravar áudio."); } });
  composeText.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); } });
  messagesEl.addEventListener("scroll", updateScrollControl, { passive: true });
  toBottomButton.addEventListener("click", () => scrollToLatest("smooth"));
  function updateConnection() { root.classList.toggle("is-offline", !navigator.onLine); }
  launcher.addEventListener("click", () => { setOpen(true); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); });
  nudge.addEventListener("click", () => setOpen(true));
  expand.addEventListener("click", () => { const expanded = root.classList.toggle("is-expanded"); expand.setAttribute("aria-pressed", String(expanded)); expand.setAttribute("aria-label", expanded ? "Reduzir chat" : "Expandir chat"); });
  close.addEventListener("click", () => setOpen(false)); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) setOpen(false); });
  window.addEventListener("online", updateConnection); window.addEventListener("offline", updateConnection); updateConnection();
  loadSession(); prepareNudge();
  // Vindo do WhatsApp (botão "Chat ao vivo" da oferta), o celular já vem em ?wa=, e o campo do celular
  // na abertura é preenchido sozinho. Só aceita 10 ou 11 dígitos; qualquer outra coisa é ignorada.
  const waDigits = (new URLSearchParams(location.search).get("wa") || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (/^\d{10,11}$/.test(waDigits) && startForm.elements.contact) {
    startForm.elements.contact.value = waDigits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
  }
  const chatParams = new URLSearchParams(location.search);
  const chatAction = chatParams.get("chat");
  // Link do e-mail ("Acessar minha simulação"): entra direto, sem senha, em qualquer aparelho.
  async function entrarPorLink(codigo) {
    setOpen(true);
    try {
      const response = await fetch(`${API.replace(/\/conversations$/, "")}/access`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: codigo }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir sua simulação.");
      state.session = { id: data.conversation.id, token: data.token, name: data.conversation.name, contact: data.conversation.contact || "", email: data.conversation.email || "", expiresAt: Date.now() + SESSION_TTL };
      state.messages = data.messages || []; state.clt = data.clt || null; state.ultimaEtapaClt = typeof state.clt === "object" && state.clt ? state.clt.etapa : state.ultimaEtapaClt;
      localStorage.setItem(STORAGE, JSON.stringify(state.session));
      root.classList.add("has-conversation"); renderMessages(); renderClt();
      history.replaceState(null, "", location.pathname);
    } catch (err) { showError(err.message); }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.session) { refresh(); refreshClt(); } });
  if (chatAction === "acessar" && chatParams.get("t")) setTimeout(() => entrarPorLink(chatParams.get("t")), 180);
  else if (["abrir", "acompanhar"].includes(chatAction)) setTimeout(() => { setOpen(true); if (chatAction === "acompanhar" && !state.session) $("[data-open-recovery]").click(); }, 180);
  else setTimeout(showNudgeOnce, 900);
  goTo(0); refresh(); refreshClt(); setInterval(() => { if (state.session && !sessionIsValid(state.session)) { resetSession(); prepareNudge(); showNudgeOnce(); return; } if (!document.hidden) { refresh(); refreshClt(); } }, 4000);
})();
