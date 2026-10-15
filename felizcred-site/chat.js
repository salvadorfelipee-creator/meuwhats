(() => {
  const API = "https://meuwhats.onrender.com/site-chat/conversations";
  const STORAGE = "felizcred_site_chat_v1";
  const CLT_SANDBOX = new URLSearchParams(location.search).get("clt") === "sandbox";
  const state = { session: null, messages: [], open: false, lastAgentCount: null, step: 0, audioCtx: null, recorder: null, stream: null, chunks: [], clt: null, cltCpf: "", selectedOffer: null };
  const iconChat = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>';
  const iconClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const iconSend = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
  const root = document.createElement("div");
  root.className = "fc-chat-root";
  root.innerHTML = `
    <button class="fc-chat-launcher" type="button" aria-label="Abrir chat com a FelizCred" aria-expanded="false">${iconChat}<span>Fale com a gente</span><span class="fc-chat-unread">1</span></button>
    <section class="fc-chat" role="dialog" aria-label="Chat com a FelizCred" aria-hidden="true">
      <header class="fc-chat-head"><div class="fc-chat-brand">F</div><div class="fc-chat-head-copy"><p class="fc-chat-title">Atendimento FelizCred</p><p class="fc-chat-status">Respondemos por aqui</p></div><button class="fc-chat-close" type="button" aria-label="Fechar chat">${iconClose}</button></header>
      <div class="fc-chat-start"><div class="fc-chat-progress"><span></span></div>
        <form class="fc-chat-form" novalidate>
          <section class="fc-chat-step is-active" data-step="0"><p class="fc-chat-kicker">Vamos começar</p><h2>Como podemos chamar você?</h2><p class="fc-chat-hint">Digite seu nome para deixar a conversa mais pessoal.</p><input name="name" maxlength="80" autocomplete="name" required placeholder="Seu nome"><button class="fc-chat-primary fc-chat-next" type="button">Continuar <kbd>Enter ↵</kbd></button></section>
          <section class="fc-chat-step" data-step="1"><button class="fc-chat-back" type="button">← Voltar</button><p class="fc-chat-kicker">Só mais um dado</p><h2>Qual é o seu melhor e-mail?</h2><p class="fc-chat-hint">Usaremos para continuar o atendimento se você sair do site.</p><input name="contact" type="email" maxlength="160" autocomplete="email" required placeholder="voce@exemplo.com"><button class="fc-chat-primary fc-chat-next" type="button">Continuar <kbd>Enter ↵</kbd></button></section>
          <section class="fc-chat-step" data-step="2"><button class="fc-chat-back" type="button">← Voltar</button><p class="fc-chat-kicker">Escolha uma opção</p><h2>Sobre o que você quer falar?</h2><fieldset class="fc-chat-topics"><legend class="sr-only">Assunto</legend><label class="fc-chat-topic"><input type="radio" name="topic" value="FGTS" required><span><i>A</i><b>FGTS</b><small>Antecipação do saque-aniversário</small></span></label><label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo CLT" required><span><i>B</i><b>Empréstimo CLT</b><small>Crédito para quem trabalha registrado</small></span></label><label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo com carro em garantia" required><span><i>C</i><b>Carro em garantia</b><small>Empréstimo usando seu veículo</small></span></label></fieldset><button class="fc-chat-primary" type="submit">Iniciar conversa ${iconSend}</button><p class="fc-chat-privacy">Ao enviar, você concorda com o uso destes dados para responder ao seu atendimento.</p></section>
          <p class="fc-chat-error" role="alert"></p>
        </form>
      </div>
      <div class="fc-chat-thread"><div class="fc-chat-messages" aria-live="polite"><span class="fc-chat-day">Conversa com a equipe FelizCred</span></div><div class="fc-chat-clt" aria-live="polite"></div><div class="fc-chat-emoji-menu"><button type="button">😊</button><button type="button">👍</button><button type="button">❤️</button><button type="button">😂</button><button type="button">🙏</button><button type="button">✅</button></div><form class="fc-chat-compose"><button class="fc-chat-tool fc-chat-emoji" type="button" aria-label="Emoji">☺</button><label class="fc-chat-tool" aria-label="Anexar arquivo">⌕<input class="fc-chat-file" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden></label><button class="fc-chat-tool fc-chat-mic" type="button" aria-label="Gravar áudio">●</button><textarea maxlength="2000" rows="1" aria-label="Mensagem" placeholder="Escreva sua mensagem..."></textarea><button class="fc-chat-send" type="submit" aria-label="Enviar mensagem">${iconSend}</button></form></div>
    </section>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const launcher = $(".fc-chat-launcher"), panel = $(".fc-chat"), close = $(".fc-chat-close");
  const startForm = $(".fc-chat-form"), compose = $(".fc-chat-compose"), composeText = compose.querySelector("textarea");
  const messagesEl = $(".fc-chat-messages"), errorEl = $(".fc-chat-error"), unreadEl = $(".fc-chat-unread"), progress = $(".fc-chat-progress span");
  const fileInput = $(".fc-chat-file"), emojiButton = $(".fc-chat-emoji"), emojiMenu = $(".fc-chat-emoji-menu"), micButton = $(".fc-chat-mic");
  const cltEl = $(".fc-chat-clt");
  const steps = [...root.querySelectorAll(".fc-chat-step")];
  function fieldForStep(step) { return step === 0 ? startForm.elements.name : step === 1 ? startForm.elements.contact : startForm.elements.topic; }
  function showError(message) { errorEl.textContent = message; errorEl.classList.add("show"); }
  function validStep(step) {
    const field = fieldForStep(step);
    if (step === 0 && field.value.trim().length < 2) { showError("Digite seu nome para continuar."); return false; }
    if (step === 1 && !field.checkValidity()) { showError("Digite um e-mail válido para continuar."); return false; }
    return true;
  }
  function goTo(step) {
    if (step > state.step && !validStep(state.step)) return;
    state.step = Math.max(0, Math.min(2, step)); errorEl.classList.remove("show");
    steps.forEach((node, index) => node.classList.toggle("is-active", index === state.step));
    progress.style.width = `${((state.step + 1) / 3) * 100}%`;
    setTimeout(() => fieldForStep(state.step)?.focus?.(), 220);
  }
  function loadSession() { try { state.session = JSON.parse(localStorage.getItem(STORAGE) || "null"); } catch { state.session = null; } if (state.session?.id && state.session?.token) root.classList.add("has-conversation"); }
  function setOpen(open) { state.open = open; root.classList.toggle("is-open", open); launcher.setAttribute("aria-expanded", String(open)); panel.setAttribute("aria-hidden", String(!open)); if (open) { unreadEl.classList.remove("show"); setTimeout(() => (state.session ? composeText : fieldForStep(state.step)).focus(), 180); refresh(); } }
  function formatTime(ms) { return new Date(Number(ms)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function sound(kind) { try { const Ctx = window.AudioContext || window.webkitAudioContext; state.audioCtx ||= new Ctx(); const ctx = state.audioCtx, osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = "sine"; osc.frequency.value = kind === "in" ? 660 : 440; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .22); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .24); } catch {} }
  function renderMessages() { messagesEl.querySelectorAll(".fc-chat-bubble").forEach((n) => n.remove()); state.messages.forEach((m) => { const bubble = document.createElement("div"); bubble.className = `fc-chat-bubble ${m.direction}`; if (m.media_url) { let media; if (m.type === "image") { media = document.createElement("img"); media.alt = m.file_name || "Imagem"; } else if (m.type === "video") { media = document.createElement("video"); media.controls = true; } else if (m.type === "audio") { media = document.createElement("audio"); media.controls = true; } else { media = document.createElement("a"); media.target = "_blank"; media.textContent = m.file_name || "Abrir arquivo"; } media.src = m.media_url; if (media.tagName === "A") media.href = m.media_url; media.className = "fc-chat-media"; bubble.appendChild(media); } if (m.body) { const text = document.createElement("p"); text.textContent = m.body; bubble.appendChild(text); } const meta = document.createElement("small"); meta.textContent = `${m.direction === "agent" && m.sender_name ? `${m.sender_name} · ` : ""}${formatTime(m.created_at)}`; bubble.appendChild(meta); messagesEl.appendChild(bubble); }); messagesEl.scrollTop = messagesEl.scrollHeight; }
  async function api(path = "", options = {}) { const headers = { "Content-Type": "application/json", ...(options.headers || {}) }; if (state.session?.token) headers["X-Chat-Token"] = state.session.token; const response = await fetch(`${API}${path}`, { ...options, headers }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Não foi possível conectar agora."); return data; }
  const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  function renderClt() {
    const c = state.clt;
    root.classList.toggle("is-contracting", !!state.selectedOffer);
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
      cltEl.innerHTML = `<form class="fc-clt-card" data-action="start"><span class="fc-clt-step">1 de 5 · Simulação</span><h3>Agora informe seus dados</h3><p>Usaremos estas informações somente para iniciar a consulta no ambiente seguro do banco.</p><label>CPF<input name="cpf" inputmode="numeric" maxlength="14" required placeholder="000.000.000-00"></label><label>Celular com DDD<input name="phone" inputmode="tel" maxlength="16" required placeholder="(47) 99999-9999"></label><button class="fc-chat-primary">Continuar</button></form>`;
      return;
    }
    if (["aguardando_autorizacao", "simulando"].includes(c.etapa)) {
      cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">2 de 5 · Autorização</span><h3>${c.termsLink ? "Autorize a consulta" : "Preparando sua autorização…"}</h3><p>${c.termsLink ? "Para simular e ver as condições, clique no link e faça a autorização." : "Isso costuma levar poucos segundos."}</p>${c.termsLink ? `<a class="fc-chat-primary" href="${c.termsLink}" target="_blank" rel="noopener">Abrir autorização segura</a>` : '<span class="fc-clt-loading">Consultando…</span>'}</div>`;
      return;
    }
    if (c.etapa === "sem_oferta") { cltEl.innerHTML = `<div class="fc-clt-card"><span class="fc-clt-step">Consulta concluída</span><h3>Não há uma oferta disponível agora</h3><p>Você poderá tentar novamente quando sua margem mudar.</p></div>`; return; }
    if (c.etapa === "oferta_disponivel" && !state.selectedOffer) {
      const preferred = c.offers.filter((o) => [18, 24].includes(Number(o.installments)));
      const offers = preferred.length ? preferred : c.offers;
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
  async function refreshClt() { if (!CLT_SANDBOX || !state.session) return; try { const data = await api(`/${state.session.id}/clt/status`); if (data.clt) { state.clt = data.clt; renderClt(); } } catch {} }
  async function refresh() { if (!state.session) return; try { const data = await api(`/${state.session.id}`); const count = data.messages.filter((m) => m.direction === "agent").length; if (state.lastAgentCount !== null && count > state.lastAgentCount) { sound("in"); if (!state.open) unreadEl.classList.add("show"); if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("FelizCred respondeu", { body: data.messages.at(-1)?.body || "Você recebeu uma nova mensagem." }); } state.lastAgentCount = count; state.messages = data.messages; renderMessages(); } catch (error) { if (/não encontrada/i.test(error.message)) { localStorage.removeItem(STORAGE); state.session = null; root.classList.remove("has-conversation"); } } }
  root.querySelectorAll(".fc-chat-next").forEach((b) => b.addEventListener("click", () => goTo(state.step + 1)));
  root.querySelectorAll(".fc-chat-back").forEach((b) => b.addEventListener("click", () => goTo(state.step - 1)));
  startForm.addEventListener("keydown", (e) => { if (e.key === "Enter" && state.step < 2) { e.preventDefault(); goTo(state.step + 1); } if (state.step === 2 && ["a","b","c"].includes(e.key.toLowerCase())) startForm.elements.topic[["a","b","c"].indexOf(e.key.toLowerCase())].checked = true; });
  startForm.addEventListener("submit", async (e) => { e.preventDefault(); const form = new FormData(startForm), topic = form.get("topic"); if (!topic) return showError("Escolha uma opção para iniciar a conversa."); const button = startForm.querySelector('button[type="submit"]'); button.disabled = true; errorEl.classList.remove("show"); try { const data = await api("", { method: "POST", body: JSON.stringify({ name: form.get("name"), contact: form.get("contact"), message: `Tenho interesse em: ${topic}`, pageUrl: location.href }) }); state.session = { id: data.conversation.id, token: data.token }; state.messages = data.messages; localStorage.setItem(STORAGE, JSON.stringify(state.session)); root.classList.add("has-conversation"); renderMessages(); if (/CLT/i.test(topic) && CLT_SANDBOX) { state.clt = "eligibility"; renderClt(); } sound("out"); composeText.focus(); } catch (error) { showError(error.message); } finally { button.disabled = false; } });
  cltEl.addEventListener("click", (e) => {
    const tenure = e.target.closest("[data-tenure]");
    if (tenure) { state.clt = tenure.dataset.tenure === "yes" ? "start" : "ineligible"; renderClt(); return; }
    const offerButton = e.target.closest("[data-offer]");
    if (offerButton) { state.selectedOffer = state.clt.offers.find((o) => String(o.simulationId) === offerButton.dataset.offer); renderClt(); return; }
    if (e.target.closest("[data-lower]")) { cltEl.querySelector(".fc-clt-resim").hidden = false; }
  });
  cltEl.addEventListener("submit", async (e) => {
    e.preventDefault(); const form = new FormData(e.target), button = e.target.querySelector('button[type="submit"],button:not([type])'); if (button) button.disabled = true;
    try {
      if (e.target.dataset.action === "start") {
        state.cltCpf = String(form.get("cpf") || "");
        const data = await api(`/${state.session.id}/clt/start`, { method: "POST", body: JSON.stringify({ cpf: state.cltCpf, phone: form.get("phone") }) }); state.clt = data.clt;
      } else if (e.target.classList.contains("fc-clt-resim")) {
        const requested = Number(String(form.get("installmentValue") || "").replace(",", "."));
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
    } catch (error) { alert(error.message); } finally { if (button) button.disabled = false; }
  });
  async function sendPayload(payload) { const button = $(".fc-chat-send"); button.disabled = true; try { await api(`/${state.session.id}`, { method: "POST", body: JSON.stringify(payload) }); composeText.value = ""; sound("out"); await refresh(); } finally { button.disabled = false; } }
  compose.addEventListener("submit", async (e) => { e.preventDefault(); const message = composeText.value.trim(); if (message) await sendPayload({ message }); });
  emojiButton.addEventListener("click", () => emojiMenu.classList.toggle("show"));
  emojiMenu.addEventListener("click", (e) => { if (e.target === emojiMenu) return; const emoji = e.target.textContent; composeText.value += emoji; emojiMenu.classList.remove("show"); composeText.focus(); });
  fileInput.addEventListener("change", async () => { const file = fileInput.files?.[0]; if (!file) return; if (file.size > 15 * 1024 * 1024) return alert("O arquivo deve ter no máximo 15 MB."); const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); const key = file.type.startsWith("image/") ? "imagemBase64" : file.type.startsWith("video/") ? "videoBase64" : file.type.startsWith("audio/") ? "audioBase64" : "documentBase64"; await sendPayload({ message: composeText.value.trim(), [key]: data, fileName: file.name }); fileInput.value = ""; });
  micButton.addEventListener("click", async () => { if (state.recorder?.state === "recording") { state.recorder.stop(); return; } try { state.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); state.recorder = new MediaRecorder(state.stream); state.chunks = []; state.recorder.ondataavailable = (e) => e.data.size && state.chunks.push(e.data); state.recorder.onstop = async () => { const blob = new Blob(state.chunks, { type: state.recorder.mimeType || "audio/webm" }); state.stream.getTracks().forEach((t) => t.stop()); micButton.classList.remove("recording"); const data = await new Promise((resolve) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(blob); }); await sendPayload({ audioBase64: data, fileName: "audio.webm" }); }; state.recorder.start(); micButton.classList.add("recording"); } catch { alert("Autorize o microfone para gravar áudio."); } });
  composeText.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); } });
  launcher.addEventListener("click", () => { setOpen(true); if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }); close.addEventListener("click", () => setOpen(false)); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) setOpen(false); });
  loadSession(); goTo(0); refresh(); refreshClt(); setInterval(() => { if (!document.hidden) { refresh(); refreshClt(); } }, 4000);
})();
