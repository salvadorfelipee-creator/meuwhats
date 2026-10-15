(() => {
  const API = "https://meuwhats.onrender.com/site-chat/conversations";
  const STORAGE = "felizcred_site_chat_v1";
  const state = { session: null, messages: [], open: false, lastAgentCount: 0, step: 0 };
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
      <div class="fc-chat-thread"><div class="fc-chat-messages" aria-live="polite"><span class="fc-chat-day">Conversa com a equipe FelizCred</span></div><form class="fc-chat-compose"><textarea maxlength="2000" rows="1" aria-label="Mensagem" placeholder="Escreva sua mensagem..."></textarea><button class="fc-chat-send" type="submit" aria-label="Enviar mensagem">${iconSend}</button></form></div>
    </section>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const launcher = $(".fc-chat-launcher"), panel = $(".fc-chat"), close = $(".fc-chat-close");
  const startForm = $(".fc-chat-form"), compose = $(".fc-chat-compose"), composeText = compose.querySelector("textarea");
  const messagesEl = $(".fc-chat-messages"), errorEl = $(".fc-chat-error"), unreadEl = $(".fc-chat-unread"), progress = $(".fc-chat-progress span");
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
  function renderMessages() { messagesEl.querySelectorAll(".fc-chat-bubble").forEach((n) => n.remove()); state.messages.forEach((m) => { const bubble = document.createElement("div"); bubble.className = `fc-chat-bubble ${m.direction}`; const text = document.createElement("p"); text.textContent = m.body; const meta = document.createElement("small"); meta.textContent = `${m.direction === "agent" && m.sender_name ? `${m.sender_name} · ` : ""}${formatTime(m.created_at)}`; bubble.append(text, meta); messagesEl.appendChild(bubble); }); messagesEl.scrollTop = messagesEl.scrollHeight; }
  async function api(path = "", options = {}) { const headers = { "Content-Type": "application/json", ...(options.headers || {}) }; if (state.session?.token) headers["X-Chat-Token"] = state.session.token; const response = await fetch(`${API}${path}`, { ...options, headers }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Não foi possível conectar agora."); return data; }
  async function refresh() { if (!state.session) return; try { const data = await api(`/${state.session.id}`); const count = data.messages.filter((m) => m.direction === "agent").length; if (!state.open && count > state.lastAgentCount) unreadEl.classList.add("show"); state.lastAgentCount = count; state.messages = data.messages; renderMessages(); } catch (error) { if (/não encontrada/i.test(error.message)) { localStorage.removeItem(STORAGE); state.session = null; root.classList.remove("has-conversation"); } } }
  root.querySelectorAll(".fc-chat-next").forEach((b) => b.addEventListener("click", () => goTo(state.step + 1)));
  root.querySelectorAll(".fc-chat-back").forEach((b) => b.addEventListener("click", () => goTo(state.step - 1)));
  startForm.addEventListener("keydown", (e) => { if (e.key === "Enter" && state.step < 2) { e.preventDefault(); goTo(state.step + 1); } if (state.step === 2 && ["a","b","c"].includes(e.key.toLowerCase())) startForm.elements.topic[["a","b","c"].indexOf(e.key.toLowerCase())].checked = true; });
  startForm.addEventListener("submit", async (e) => { e.preventDefault(); const form = new FormData(startForm), topic = form.get("topic"); if (!topic) return showError("Escolha uma opção para iniciar a conversa."); const button = startForm.querySelector('button[type="submit"]'); button.disabled = true; errorEl.classList.remove("show"); try { const data = await api("", { method: "POST", body: JSON.stringify({ name: form.get("name"), contact: form.get("contact"), message: `Tenho interesse em: ${topic}`, pageUrl: location.href }) }); state.session = { id: data.conversation.id, token: data.token }; state.messages = data.messages; localStorage.setItem(STORAGE, JSON.stringify(state.session)); root.classList.add("has-conversation"); renderMessages(); composeText.focus(); } catch (error) { showError(error.message); } finally { button.disabled = false; } });
  compose.addEventListener("submit", async (e) => { e.preventDefault(); const message = composeText.value.trim(); if (!message) return; const button = compose.querySelector("button"); button.disabled = true; try { await api(`/${state.session.id}`, { method: "POST", body: JSON.stringify({ message }) }); composeText.value = ""; await refresh(); } finally { button.disabled = false; } });
  composeText.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose.requestSubmit(); } });
  launcher.addEventListener("click", () => setOpen(true)); close.addEventListener("click", () => setOpen(false)); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) setOpen(false); });
  loadSession(); goTo(0); refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 4000);
})();
