/* Chat do site — widget genérico (JS puro, sem dependências). Fala com as rotas /site/chat/* do painel.
 * Uso no HTML do site:
 *   <link rel="stylesheet" href="/chat-widget.css">
 *   <script src="/chat-widget.js" defer
 *           data-api="https://SEU-PAINEL"            (URL do painel DA ESPECITÁ, nunca de outro projeto)
 *           data-marca="Especitá"                   (nome no cabeçalho)
 *           data-boas-vindas="Olá! Como podemos ajudar?"
 *           data-pedir-contato="true"></script>     (pede celular antes de começar; "false" pede só o nome)
 * Custo de rede: só consulta o servidor com o chat ABERTO e a aba visível (a cada 4 s; 15 s depois de 2 min sem novidade).
 */
(() => {
  const el = document.currentScript;
  const API = (el?.dataset.api || "").replace(/\/$/, "") + "/site/chat";
  if (!el?.dataset.api) { console.error("chat-widget: falta data-api"); return; }
  const MARCA = el.dataset.marca || "Atendimento";
  const BOAS_VINDAS = el.dataset.boasVindas || "Olá! Como podemos ajudar?";
  const PEDIR_CONTATO = el.dataset.pedirContato !== "false";
  const CHAVE = "site_chat_sessao_v1";
  const VALIDADE = 12 * 3600_000;
  const s = { sessao: null, aberto: false, ultimoId: 0, mensagens: [], opcoes: [], timer: null, semNovidadeDesde: Date.now(), naoLidas: 0 };

  const ler = () => { try { const v = JSON.parse(localStorage.getItem(CHAVE) || "null"); return v && v.expira > Date.now() ? v : null; } catch { return null; } };
  const gravar = (v) => { try { v ? localStorage.setItem(CHAVE, JSON.stringify(v)) : localStorage.removeItem(CHAVE); } catch {} };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function api(caminho, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (s.sessao) { headers["X-Chat-Id"] = s.sessao.id; headers["X-Chat-Token"] = s.sessao.token; }
    const r = await fetch(API + caminho, { cache: "no-store", ...opts, headers });
    const d = await r.json().catch(() => ({}));
    if (r.status === 404 && s.sessao) { encerrar(); throw new Error("Conversa expirada"); }
    if (!r.ok) throw new Error(d.error || "Não foi possível conectar agora.");
    return d;
  }

  const raiz = document.createElement("div");
  raiz.className = "sc-root";
  raiz.innerHTML = `
    <button class="sc-launcher" type="button" aria-label="Abrir chat com ${esc(MARCA)}" aria-expanded="false">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
      <span class="sc-badge" hidden>0</span></button>
    <section class="sc-janela" role="dialog" aria-label="Chat com ${esc(MARCA)}" hidden>
      <header><strong>${esc(MARCA)}</strong><button class="sc-fechar" type="button" aria-label="Minimizar">×</button></header>
      <form class="sc-inicio"><p>${esc(BOAS_VINDAS)}</p>
        <input name="nome" placeholder="Seu nome" maxlength="80" required autocomplete="name">
        ${PEDIR_CONTATO ? '<input name="contato" type="tel" inputmode="tel" placeholder="Seu celular com DDD" maxlength="16" autocomplete="tel">' : ""}
        <button type="submit">Começar conversa</button><p class="sc-erro" role="alert"></p></form>
      <div class="sc-conversa" hidden>
        <div class="sc-msgs" aria-live="polite"></div>
        <div class="sc-opcoes"></div>
        <form class="sc-enviar"><textarea rows="1" maxlength="2000" placeholder="Escreva sua mensagem..." aria-label="Mensagem"></textarea><button type="submit" aria-label="Enviar">➤</button></form>
      </div>
    </section>`;
  document.body.appendChild(raiz);
  const q = (x) => raiz.querySelector(x);
  const janela = q(".sc-janela"), launcher = q(".sc-launcher"), badge = q(".sc-badge");
  const inicio = q(".sc-inicio"), conversa = q(".sc-conversa"), msgsEl = q(".sc-msgs"), opcoesEl = q(".sc-opcoes"), formEnviar = q(".sc-enviar"), campo = formEnviar.querySelector("textarea");

  function desenhar() {
    msgsEl.innerHTML = s.mensagens.map((m) => {
      const texto = String(m.body || "").split("\n").filter((l) => !l.startsWith("🔘 ")).join("\n").trim(); // botões viram chips
      return texto ? `<div class="sc-msg ${m.direction === "in" ? "sc-eu" : "sc-eles"}">${esc(texto).replace(/\n/g, "<br>")}</div>` : "";
    }).join("");
    const ultima = s.mensagens[s.mensagens.length - 1];
    const mostrar = ultima && ultima.direction === "out" ? s.opcoes : []; // chips só enquanto a pessoa não respondeu
    opcoesEl.innerHTML = mostrar.map((o) => `<button type="button" data-id="${esc(o.id)}">${esc(o.title)}</button>`).join("");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  async function atualizar() {
    if (!s.sessao) return;
    const d = await api(`/mensagens?desde=${s.ultimoId}`);
    s.opcoes = d.opcoes || [];
    if (d.mensagens.length) {
      s.mensagens.push(...d.mensagens);
      s.ultimoId = d.mensagens[d.mensagens.length - 1].id;
      s.semNovidadeDesde = Date.now();
      if (!s.aberto) { s.naoLidas += d.mensagens.filter((m) => m.direction === "out").length; badge.textContent = s.naoLidas; badge.hidden = !s.naoLidas; }
      desenhar();
    }
  }

  function agendar() {
    clearTimeout(s.timer);
    if (!s.aberto || !s.sessao) return;
    const espera = Date.now() - s.semNovidadeDesde > 120_000 ? 15_000 : 4_000;
    s.timer = setTimeout(async () => { if (!document.hidden) { try { await atualizar(); } catch {} } agendar(); }, espera);
  }

  function mostrarConversa() { inicio.hidden = true; conversa.hidden = false; }
  function encerrar() { gravar(null); s.sessao = null; s.mensagens = []; s.ultimoId = 0; s.opcoes = []; inicio.hidden = false; conversa.hidden = true; }
  function abrir(sim) {
    s.aberto = sim; janela.hidden = !sim; launcher.setAttribute("aria-expanded", String(sim));
    if (sim) { s.naoLidas = 0; badge.hidden = true; s.semNovidadeDesde = Date.now(); if (s.sessao) { mostrarConversa(); atualizar().catch(() => {}); } }
    agendar();
  }

  launcher.addEventListener("click", () => abrir(!s.aberto));
  q(".sc-fechar").addEventListener("click", () => abrir(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && s.aberto) { atualizar().catch(() => {}); agendar(); } });
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-abrir-chat]"); if (a) { e.preventDefault(); abrir(true); } });

  inicio.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = q(".sc-erro"); erro.textContent = "";
    const f = new FormData(inicio);
    try {
      const d = await api("/iniciar", { method: "POST", body: JSON.stringify({ nome: f.get("nome"), contato: f.get("contato") || "", pageUrl: location.href }) });
      s.sessao = { id: d.id, token: d.token, expira: Date.now() + VALIDADE }; gravar(s.sessao);
      mostrarConversa(); await atualizar(); s.semNovidadeDesde = Date.now(); agendar();
    } catch (err) { erro.textContent = err.message; }
  });

  async function enviar(corpo) {
    try { await api("/enviar", { method: "POST", body: JSON.stringify(corpo) }); s.semNovidadeDesde = Date.now(); await atualizar(); agendar(); }
    catch (err) { msgsEl.insertAdjacentHTML("beforeend", `<div class="sc-aviso">${esc(err.message)}</div>`); }
  }
  formEnviar.addEventListener("submit", (e) => { e.preventDefault(); const t = campo.value.trim(); if (!t) return; campo.value = ""; enviar({ texto: t }); });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); formEnviar.requestSubmit(); } });
  opcoesEl.addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) enviar({ opcaoId: b.dataset.id }); });

  s.sessao = ler();
  if (s.sessao) { mostrarConversa(); atualizar().catch(() => {}); }
})();
