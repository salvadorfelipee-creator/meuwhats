(() => {
  const API = "https://meuwhats.onrender.com/site-chat/conversations";
  const STORAGE = "felizcred_site_chat_v1";
  const state = { session: null, messages: [], open: false, poll: null, lastAgentCount: 0 };

  const iconChat = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>';
  const iconClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  const iconSend = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';

  const root = document.createElement("div");
  root.className = "fc-chat-root";
  root.innerHTML = `
    <button class="fc-chat-launcher" type="button" aria-label="Abrir chat com a FelizCred" aria-expanded="false">
      ${iconChat}<span>Fale com a gente</span><span class="fc-chat-unread" aria-label="Novas mensagens">1</span>
    </button>
    <section class="fc-chat" role="dialog" aria-modal="false" aria-label="Chat com a FelizCred" aria-hidden="true">
      <header class="fc-chat-head">
        <div class="fc-chat-brand">F</div>
        <div class="fc-chat-head-copy"><p class="fc-chat-title">Atendimento FelizCred</p><p class="fc-chat-status">Respondemos por aqui</p></div>
        <button class="fc-chat-close" type="button" aria-label="Fechar chat">${iconClose}</button>
      </header>
      <div class="fc-chat-start">
        <div class="fc-chat-welcome"><h2>Olá! Como podemos ajudar?</h2><p>Converse diretamente com nossa equipe sem sair do site.</p></div>
        <form class="fc-chat-form">
          <label class="fc-chat-label"><span>Seu nome</span><input name="name" maxlength="80" autocomplete="name" required placeholder="Como podemos chamar você?"/></label>
          <label class="fc-chat-label"><span>E-mail <em>(opcional)</em></span><input name="contact" type="email" maxlength="160" autocomplete="email" placeholder="Para continuarmos a conversa por e-mail"/></label>
          <fieldset class="fc-chat-topics">
            <legend>Sobre o que você quer falar?</legend>
            <label class="fc-chat-topic"><input type="radio" name="topic" value="FGTS" required/><span><b>FGTS</b><small>Antecipação do saque-aniversário</small></span></label>
            <label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo CLT" required/><span><b>Empréstimo CLT</b><small>Crédito para quem trabalha registrado</small></span></label>
            <label class="fc-chat-topic"><input type="radio" name="topic" value="Empréstimo com carro em garantia" required/><span><b>Carro em garantia</b><small>Empréstimo usando seu veículo</small></span></label>
          </fieldset>
          <p class="fc-chat-error" role="alert"></p>
          <button class="fc-chat-primary" type="submit">Iniciar conversa ${iconSend}</button>
          <p class="fc-chat-privacy">Ao enviar, você concorda com o uso destes dados para responder ao seu atendimento.</p>
        </form>
      </div>
      <div class="fc-chat-thread">
        <div class="fc-chat-messages" aria-live="polite"><span class="fc-chat-day">Conversa com a equipe FelizCred</span></div>
        <form class="fc-chat-compose"><textarea maxlength="2000" rows="1" aria-label="Mensagem" placeholder="Escreva sua mensagem..."></textarea><button class="fc-chat-send" type="submit" aria-label="Enviar mensagem">${iconSend}</button></form>
      </div>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector(".fc-chat-launcher");
  const panel = root.querySelector(".fc-chat");
  const close = root.querySelector(".fc-chat-close");
  const startForm = root.querySelector(".fc-chat-form");
  const compose = root.querySelector(".fc-chat-compose");
  const composeText = compose.querySelector("textarea");
  const messagesEl = root.querySelector(".fc-chat-messages");
  const errorEl = root.querySelector(".fc-chat-error");
  const unreadEl = root.querySelector(".fc-chat-unread");

  function loadSession() {
    try { state.session = JSON.parse(localStorage.getItem(STORAGE) || "null"); } catch { state.session = null; }
    if (state.session?.id && state.session?.token) root.classList.add("has-conversation");
  }

  function setOpen(open) {
    state.open = open;
    root.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    if (open) {
      unreadEl.classList.remove("show");
      window.setTimeout(() => (state.session ? composeText : startForm.querySelector("input")).focus(), 180);
      refresh();
    }
  }

  function formatTime(ms) {
    return new Date(Number(ms)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderMessages() {
    messagesEl.querySelectorAll(".fc-chat-bubble").forEach((node) => node.remove());
    state.messages.forEach((message) => {
      const bubble = document.createElement("div");
      bubble.className = `fc-chat-bubble ${message.direction}`;
      const text = document.createElement("p");
      text.textContent = message.body;
      const meta = document.createElement("small");
      meta.textContent = `${message.direction === "agent" && message.sender_name ? `${message.sender_name} · ` : ""}${formatTime(message.created_at)}`;
      bubble.append(text, meta);
      messagesEl.appendChild(bubble);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function api(path = "", options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (state.session?.token) headers["X-Chat-Token"] = state.session.token;
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível conectar agora.");
    return data;
  }

  async function refresh() {
    if (!state.session) return;
    try {
      const data = await api(`/${state.session.id}`);
      const agentCount = data.messages.filter((m) => m.direction === "agent").length;
      if (!state.open && agentCount > state.lastAgentCount) unreadEl.classList.add("show");
      state.lastAgentCount = agentCount;
      state.messages = data.messages;
      renderMessages();
    } catch (error) {
      if (/não encontrada/i.test(error.message)) {
        localStorage.removeItem(STORAGE);
        state.session = null;
        root.classList.remove("has-conversation");
      }
    }
  }

  startForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = startForm.querySelector("button[type=submit]");
    const form = new FormData(startForm);
    errorEl.classList.remove("show");
    button.disabled = true;
    try {
      const data = await api("", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          contact: form.get("contact"),
          message: `Tenho interesse em: ${form.get("topic")}`,
          pageUrl: location.href,
        }),
      });
      state.session = { id: data.conversation.id, token: data.token };
      state.messages = data.messages;
      localStorage.setItem(STORAGE, JSON.stringify(state.session));
      root.classList.add("has-conversation");
      renderMessages();
      composeText.focus();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.classList.add("show");
    } finally { button.disabled = false; }
  });

  compose.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = composeText.value.trim();
    if (!message) return;
    const button = compose.querySelector("button");
    button.disabled = true;
    try {
      await api(`/${state.session.id}`, { method: "POST", body: JSON.stringify({ message }) });
      composeText.value = "";
      await refresh();
    } finally { button.disabled = false; }
  });

  composeText.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); compose.requestSubmit(); }
  });
  launcher.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && state.open) setOpen(false); });
  loadSession();
  refresh();
  state.poll = window.setInterval(() => { if (!document.hidden) refresh(); }, 4000);
})();
