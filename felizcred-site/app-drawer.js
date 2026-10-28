// Abre a simulação (/app/) ao lado da página no computador e em tela cheia no celular.
(() => {
  "use strict";
  const DESKTOP = 900;
  let gaveta = null;
  const css = document.createElement("style");
  css.textContent = `
    .fc-app-gaveta { position: fixed; inset: 0; z-index: 2147483000; display: none; }
    .fc-app-gaveta.on { display: block; }
    .fc-app-fundo { position: absolute; inset: 0; background: rgba(7, 26, 47, .35); animation: fcAppFundo .2s ease both; }
    .fc-app-painel { position: absolute; top: 0; right: 0; bottom: 0; width: min(480px, 100vw); background: #edf4f0; box-shadow: -18px 0 50px rgba(7, 26, 47, .25); animation: fcAppEntra .28s cubic-bezier(.2, .8, .2, 1) both; }
    .fc-app-painel iframe { width: 100%; height: 100%; border: 0; display: block; }
    body.fc-app-aberto .fc-chat-launcher, body.fc-app-aberto .fc-chat-widget { display: none !important; }
    @keyframes fcAppEntra { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes fcAppFundo { from { opacity: 0; } to { opacity: 1; } }`;
  document.head.appendChild(css);

  function fechar() {
    if (!gaveta) return;
    gaveta.classList.remove("on");
    document.body.classList.remove("fc-app-aberto");
  }
  function abrir(produto) {
    const p = produto === "fgts" || produto === "clt" ? produto : "";
    if (window.innerWidth < DESKTOP) { location.href = "/app/" + (p ? "?p=" + p : ""); return; }
    if (!gaveta) {
      gaveta = document.createElement("div");
      gaveta.className = "fc-app-gaveta";
      gaveta.innerHTML = `<div class="fc-app-fundo"></div><aside class="fc-app-painel" role="dialog" aria-label="Minha simulação"><iframe title="Minha simulação" src="/app/?embed=1${p ? "&p=" + p : ""}"></iframe></aside>`;
      document.body.appendChild(gaveta);
      gaveta.querySelector(".fc-app-fundo").addEventListener("click", fechar);
    } else if (p) {
      gaveta.querySelector("iframe").src = `/app/?embed=1&p=${p}`;
    }
    gaveta.classList.add("on");
    document.body.classList.add("fc-app-aberto");
  }
  window.fcAbrirApp = abrir;
  // O botão do chat (foto do Felipe) também leva para a simulação: o cliente escolhe CLT ou FGTS, informa os dados e segue na tela.
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".fc-chat-launcher")) return;
    e.preventDefault(); e.stopImmediatePropagation(); abrir("");
  }, true);
  window.addEventListener("message", (e) => { if (e.origin === location.origin && e.data && e.data.fcApp === "close") fechar(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
})();
