/* Especitá · comportamento do site (sem dependências) */
(function () {
  "use strict";
  var WA = document.documentElement.getAttribute("data-wa") || "";

  // ---- menu mobile
  var burger = document.querySelector(".burger");
  var nav = document.querySelector("nav.main");
  if (burger && nav) burger.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // ---- WhatsApp: texto pré-preenchido + origem (utm) para o painel reconhecer a campanha
  function utm() {
    try {
      var p = new URLSearchParams(location.search);
      var src = p.get("utm_source"), camp = p.get("utm_campaign");
      if (!src && !camp) return "";
      return " (origem: " + [src, camp].filter(Boolean).join(" / ") + ")";
    } catch (e) { return ""; }
  }
  function waLink(text) {
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text + utm());
  }
  document.querySelectorAll("a[data-wa-text]").forEach(function (a) {
    a.href = waLink(a.getAttribute("data-wa-text"));
    a.target = "_blank"; a.rel = "noopener";
  });

  // ---- antes/depois (slider)
  document.querySelectorAll(".ba").forEach(function (box) {
    var inp = box.querySelector("input"), after = box.querySelector(".after"), handle = box.querySelector(".handle");
    function set(v) { after.style.clipPath = "inset(0 0 0 " + v + "%)"; handle.style.left = v + "%"; }
    inp.addEventListener("input", function () { set(inp.value); });
    set(inp.value);
  });

  // ---- quiz genérico: data-quiz com perguntas em .q, botões com data-v; resultado em .res
  document.querySelectorAll(".quiz").forEach(function (qz) {
    var qs = Array.prototype.slice.call(qz.querySelectorAll(".q")), i = 0, answers = [];
    var prog = qz.querySelector(".prog i"), res = qz.querySelector(".res");
    var ctaText = qz.getAttribute("data-cta") || "Olá! Vim pelo site.";
    function show(n) {
      qs.forEach(function (q, k) { q.classList.toggle("on", k === n); });
      if (prog) prog.style.width = Math.round((n / qs.length) * 100) + "%";
    }
    qz.querySelectorAll(".opts button").forEach(function (b) {
      b.addEventListener("click", function () {
        answers.push(b.getAttribute("data-v") || b.textContent.trim());
        i++;
        if (i < qs.length) { show(i); return; }
        qs.forEach(function (q) { q.classList.remove("on"); });
        if (prog) prog.style.width = "100%";
        var key = answers.join("|");
        var rules = JSON.parse(qz.getAttribute("data-rules") || "{}");
        var txt = rules["default"] || "";
        Object.keys(rules).forEach(function (k) { if (k !== "default" && key.indexOf(k) === 0) txt = rules[k]; });
        res.querySelector(".txt").textContent = txt;
        var a = res.querySelector("a"); if (a) a.href = waLink(ctaText + " Minhas respostas: " + answers.join(", ") + ".");
        res.classList.add("on");
      });
    });
    show(0);
  });

  // ---- checklist de urgência → mensagem
  document.querySelectorAll(".chk-wa").forEach(function (f) {
    var a = f.querySelector("a[data-chk-cta]");
    function upd() {
      var marcados = Array.prototype.slice.call(f.querySelectorAll("input:checked")).map(function (c) { return c.parentNode.textContent.trim(); });
      a.href = waLink(a.getAttribute("data-chk-cta") + (marcados.length ? " Situação: " + marcados.join("; ") + "." : ""));
    }
    f.addEventListener("change", upd); upd();
  });

  // ---- calculadora primeiro dentinho
  var calc = document.querySelector(".calc[data-calc='dentinho']");
  if (calc) {
    var inp = calc.querySelector("input"), out = calc.querySelector(".out");
    function run() {
      var m = parseInt(inp.value, 10);
      if (isNaN(m) || m < 0) { out.textContent = "Digite a idade do bebê em meses."; return; }
      var t;
      if (m <= 6) t = "Ainda sem dentes na maioria dos bebês. Já vale a orientação sobre limpeza da gengiva, chupeta e mamadeira. A primeira visita pode ser agendada para quando o primeiro dente nascer.";
      else if (m <= 12) t = "É a janela ideal para a primeira visita: até 1 ano de idade, segundo as sociedades de odontopediatria. Visitas precoces reduzem muito o risco de cárie nos primeiros anos.";
      else if (m <= 36) t = "Hora de uma visita de adaptação, se ainda não foi. Nessa fase a criança conhece a cadeira sem procedimento e os pais recebem orientação de escovação e alimentação.";
      else if (m <= 84) t = "Revisões a cada 6 meses, flúor e selantes conforme indicação. Entre 6 e 7 anos, a primeira avaliação ortodôntica.";
      else t = "Revisões a cada 6 meses e avaliação ortodôntica, se ainda não fez. Converse com a Dra. sobre selantes nos dentes permanentes.";
      out.textContent = t;
    }
    inp.addEventListener("input", run); run();
  }

  // ---- comparar ortodontia
  document.querySelectorAll(".cmp").forEach(function (c) {
    var opts = c.querySelectorAll(".opt"), rows = c.querySelectorAll("tbody tr");
    opts.forEach(function (o) {
      o.addEventListener("click", function () {
        opts.forEach(function (x) { x.classList.remove("on"); }); o.classList.add("on");
        var k = o.getAttribute("data-k");
        rows.forEach(function (r) { r.querySelectorAll("td[data-k]").forEach(function (td) { td.style.fontWeight = td.getAttribute("data-k") === k ? "700" : "400"; td.style.color = td.getAttribute("data-k") === k ? "var(--brand-deep)" : ""; }); });
      });
    });
  });

  // ---- escala de clareamento (ilustrativa)
  var sh = document.querySelector(".shade");
  if (sh) {
    var tones = ["#E9D7B8", "#EBDCC1", "#EEE2CB", "#F1E8D5", "#F4EDDF", "#F7F2E8", "#FAF7F0", "#FCFAF6"];
    sh.innerHTML = tones.map(function (t, k) { return '<i style="background:' + t + '" data-k="' + k + '"></i>'; }).join("");
    var r = document.querySelector(".shade-range"), lbl = document.querySelector(".shade-lbl");
    function paint() {
      var v = parseInt(r.value, 10);
      sh.querySelectorAll("i").forEach(function (el, k) { el.classList.toggle("on", k === v); });
      lbl.textContent = v <= 1 ? "Tom inicial comum em quem toma café, chá ou fuma." : v <= 4 ? "Tons intermediários, alcançados nas primeiras semanas do protocolo." : "Tons claros: o resultado depende do esmalte de cada pessoa, não de 'mais produto'.";
    }
    r.addEventListener("input", paint); paint();
  }

  // ---- simulador ilustrativo de expressão (harmonização)
  var sim = document.querySelector("[data-sim='expressao']");
  if (sim) {
    var rng = sim.querySelector("input[type=range]"), lines = sim.querySelectorAll(".ruga");
    var out2 = sim.querySelector(".sim-out");
    function s() {
      var v = parseInt(rng.value, 10) / 100; // 0 = antes, 1 = suavizado
      lines.forEach(function (l) { l.style.opacity = (1 - v * 0.85).toFixed(2); l.style.strokeWidth = (2.2 - v * 1.4).toFixed(2); });
      out2.textContent = v < 0.2 ? "Linhas de expressão marcadas (ilustração)." : v < 0.7 ? "Suavização parcial: é o objetivo de uma abordagem discreta." : "Suavização maior. Na prática, a Dra. define dose e pontos para manter a expressão natural.";
    }
    rng.addEventListener("input", s); s();
  }
})();
