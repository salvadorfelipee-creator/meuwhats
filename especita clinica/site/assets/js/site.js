/* Especitá · v2 · comportamento. Depende de GSAP + ScrollTrigger e Lenis (CDN, carregados antes). */
(function () {
  "use strict";
  var WA = document.documentElement.getAttribute("data-wa") || "";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover:hover) and (pointer:fine)").matches;

  // ---------- menu
  var burger = document.querySelector(".burger"), menu = document.querySelector(".menu");
  if (burger && menu) burger.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.textContent = open ? "Fechar" : "Menu";
    document.body.style.overflow = open ? "hidden" : "";
  });

  // ---------- WhatsApp com texto e origem (utm)
  function utm() {
    try {
      var p = new URLSearchParams(location.search), s = p.get("utm_source"), c = p.get("utm_campaign");
      return (s || c) ? " (origem: " + [s, c].filter(Boolean).join(" / ") + ")" : "";
    } catch (e) { return ""; }
  }
  function waLink(t) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(t + utm()); }
  document.querySelectorAll("a[data-wa-text]").forEach(function (a) { a.href = waLink(a.getAttribute("data-wa-text")); a.target = "_blank"; a.rel = "noopener"; });

  // ---------- reveals (CSS + IntersectionObserver)
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll("[data-reveal],[data-clip]").forEach(function (el) { io.observe(el); });

  // ---------- texto grande: palavras acendem com o scroll (home e páginas internas)
  document.querySelectorAll(".mf .big, .intro .big").forEach(function (man) {
    if (man.dataset.split) return;
    man.innerHTML = man.textContent.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    man.dataset.split = "1";
    var ws = man.querySelectorAll(".w");
    function paint() {
      var r = man.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var n = Math.round(p * ws.length);
      ws.forEach(function (w, i) { w.classList.toggle("on", i < n); });
    }
    if (reduce) ws.forEach(function (w) { w.classList.add("on"); }); else { window.addEventListener("scroll", paint, { passive: true }); paint(); }
  });

  // ---------- contadores
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10), suf = el.getAttribute("data-suffix") || "";
    var o = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; o.disconnect();
      if (reduce) { el.textContent = target + suf; return; }
      var t0 = null; function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suf; if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    }); o.observe(el);
  });

  // ---------- nav clara/escura conforme a seção sob ela
  var navEl = document.querySelector(".nav"), darkSecs = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  if (navEl && darkSecs.length) {
    var navTick = false;
    function navUpdate() { navTick = false; var dark = darkSecs.some(function (el) { var r = el.getBoundingClientRect(); return r.top <= 36 && r.bottom > 36; }); navEl.classList.toggle("dark", dark); }
    window.addEventListener("scroll", function () { if (!navTick) { navTick = true; requestAnimationFrame(navUpdate); } }, { passive: true });
    navUpdate();
  }

  // ---------- Lenis + GSAP: rolagem suave e coreografia (copiada do mecanismo do Aventura: hero pinado + painéis pinados)
  var rootEl = document.documentElement, fxOn = rootEl.classList.contains("fx");
  if (fxOn && !(window.gsap && window.ScrollTrigger)) { rootEl.classList.remove("fx"); fxOn = false; }
  if (!reduce && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis) {
      var lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach(function (a) { a.addEventListener("click", function (e) { var id = a.getAttribute("href"); var el = id.length > 1 && document.querySelector(id); if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -80 }); } }); });
    }

    // HERO (home e páginas internas): a foto cresce de metade para a tela toda, a frase gigante atravessa, as fotos trocam
    var hero = document.querySelector(".hero");
    if (fxOn && hero) {
      var pinPct = parseInt(hero.getAttribute("data-pin"), 10) || 430, D = pinPct / 100;
      var media = hero.querySelector(".h-media"), hps = hero.querySelectorAll(".h-media .hp"), sweep = hero.querySelector(".h-sweep");
      gsap.set(sweep, { yPercent: -50, x: function () { return window.innerWidth; }, opacity: 1 });
      var tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: hero, start: "top top", end: "+=" + pinPct + "%", scrub: 0.6, pin: ".hero-pin", anticipatePin: 1, invalidateOnRefresh: true } });
      tl.to(media, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.3 * D }, 0)
        .fromTo(hps[0], { scale: 1.22 }, { scale: 1, duration: 0.3 * D }, 0)
        .to(".h-copy .h-foot,.h-copy .h-meta", { opacity: 0, duration: 0.1 * D }, 0.2 * D)
        .to(".h-copy .h-title,.h-cap", { opacity: 0, yPercent: -8, duration: 0.14 * D }, 0.4 * D)
        .fromTo(sweep, { x: function () { return window.innerWidth; } }, { x: function () { return -(sweep.offsetWidth + 60); }, duration: 0.56 * D }, 0.43 * D);
      for (var hi = 1; hi < hps.length; hi++) tl.to(hps[hi], { opacity: 1, duration: 0.14 * D }, (0.43 + (0.56 / hps.length) * hi) * D);
    }

    // MANIFESTO: retrato com parallax
    document.querySelectorAll(".mf .card img").forEach(function (im) {
      gsap.fromTo(im, { yPercent: -7 }, { yPercent: 7, ease: "none", scrollTrigger: { trigger: im.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // SERVIÇOS: seção fixa; cada painel sobe cobrindo o anterior
    var svc = document.querySelector(".svc");
    if (fxOn && svc) {
      var panels = svc.querySelectorAll(".svc-panel"), idx = svc.querySelectorAll(".svc-index li"), n = panels.length;
      gsap.set(panels, { clipPath: function (i) { return i ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 0% 0%)"; } });
      var st = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: svc, start: "top top", end: "+=" + (n - 1) * 110 + "%", scrub: 0.6, pin: true, anticipatePin: 1,
        onUpdate: function (self) { var k = Math.min(n - 1, Math.round(self.progress * (n - 1))); idx.forEach(function (li, j) { li.classList.toggle("on", j === k); }); } } });
      for (var i = 1; i < n; i++) {
        st.to(panels[i], { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, i - 1)
          .fromTo(panels[i].querySelector(".sp-photo img"), { scale: 1.25 }, { scale: 1, duration: 1 }, i - 1)
          .fromTo(panels[i].querySelector(".sp-title"), { yPercent: 35, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8 }, i - 1 + 0.2);
      }
      if (idx[0]) idx[0].classList.add("on");
    }

    // COMO FUNCIONA: lista fixa, contador e foto trocam com a rolagem
    var stp = document.querySelector(".stp");
    if (fxOn && stp) {
      var rows = stp.querySelectorAll(".stp-row"), pics = stp.querySelectorAll(".stp-pic img"), cnt = stp.querySelector(".stp-count b");
      function setStep(k) { rows.forEach(function (r, j) { r.classList.toggle("on", j === k); }); pics.forEach(function (p, j) { p.classList.toggle("on", j === k); }); if (cnt) cnt.textContent = "0" + (k + 1); }
      setStep(0);
      ScrollTrigger.create({ trigger: stp, start: "top top", end: "+=" + rows.length * 80 + "%", pin: true, anticipatePin: 1, onUpdate: function (self) { setStep(Math.min(rows.length - 1, Math.floor(self.progress * rows.length))); } });
    }

    document.querySelectorAll(".shero .ph img").forEach(function (im) {
      gsap.to(im, { yPercent: 12, ease: "none", scrollTrigger: { trigger: im.parentElement, start: "top top", end: "bottom top", scrub: true } });
    });
    document.querySelectorAll(".dra .ph img").forEach(function (im) {
      gsap.fromTo(im, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: im.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    if (fine) document.querySelectorAll(".btn.solid, .wa-float").forEach(function (b) {
      var xTo = gsap.quickTo(b, "x", { duration: .4, ease: "power3" }), yTo = gsap.quickTo(b, "y", { duration: .4, ease: "power3" });
      b.addEventListener("mousemove", function (e) { var r = b.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .25); yTo((e.clientY - r.top - r.height / 2) * .25); });
      b.addEventListener("mouseleave", function () { xTo(0); yTo(0); });
    });
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  // ---------- antes/depois
  document.querySelectorAll(".ba").forEach(function (box) {
    var inp = box.querySelector("input"), after = box.querySelector(".after"), handle = box.querySelector(".handle");
    function set(v) { after.style.clipPath = "inset(0 0 0 " + v + "%)"; handle.style.left = v + "%"; }
    inp.addEventListener("input", function () { set(inp.value); }); set(inp.value);
  });

  // ---------- quiz
  document.querySelectorAll(".quiz").forEach(function (qz) {
    var qs = Array.prototype.slice.call(qz.querySelectorAll(".q")), i = 0, answers = [];
    var prog = qz.querySelector(".prog i"), res = qz.querySelector(".res"), ctaText = qz.getAttribute("data-cta") || "Olá! Vim pelo site.";
    function show(n) { qs.forEach(function (q, k) { q.classList.toggle("on", k === n); }); if (prog) prog.style.width = Math.round((n / qs.length) * 100) + "%"; }
    qz.querySelectorAll(".opts button").forEach(function (b) {
      b.addEventListener("click", function () {
        answers.push(b.getAttribute("data-v") || b.textContent.trim()); i++;
        if (i < qs.length) { show(i); return; }
        qs.forEach(function (q) { q.classList.remove("on"); }); if (prog) prog.style.width = "100%";
        var key = answers.join("|"), rules = JSON.parse(qz.getAttribute("data-rules") || "{}"), txt = rules["default"] || "";
        Object.keys(rules).forEach(function (k) { if (k !== "default" && key.indexOf(k) === 0) txt = rules[k]; });
        res.querySelector(".txt").textContent = txt;
        var a = res.querySelector("a"); if (a) a.href = waLink(ctaText + " Minhas respostas: " + answers.join(", ") + ".");
        res.classList.add("on");
      });
    });
    show(0);
  });

  // ---------- checklist → mensagem
  document.querySelectorAll(".chk-wa").forEach(function (f) {
    var a = f.querySelector("a[data-chk-cta]");
    function upd() { var m = Array.prototype.slice.call(f.querySelectorAll("input:checked")).map(function (c) { return c.parentNode.textContent.trim(); }); a.href = waLink(a.getAttribute("data-chk-cta") + (m.length ? " Situação: " + m.join("; ") + "." : "")); }
    f.addEventListener("change", upd); upd();
  });

  // ---------- calculadora primeiro dentinho
  var calc = document.querySelector(".calc[data-calc='dentinho']");
  if (calc) {
    var inp2 = calc.querySelector("input"), out = calc.querySelector(".out");
    function run() {
      var m = parseInt(inp2.value, 10), t;
      if (isNaN(m) || m < 0) t = "Digite a idade do bebê em meses.";
      else if (m <= 6) t = "Ainda sem dentes na maioria dos bebês. Já vale a orientação sobre limpeza da gengiva, chupeta e mamadeira. A primeira visita pode ser marcada para quando o primeiro dente nascer.";
      else if (m <= 12) t = "É a janela ideal para a primeira visita: até 1 ano de idade, segundo as sociedades de odontopediatria. Visitas precoces reduzem muito o risco de cárie nos primeiros anos.";
      else if (m <= 36) t = "Hora de uma visita de adaptação, se ainda não foi. A criança conhece a cadeira sem procedimento e os pais recebem orientação de escovação e alimentação.";
      else if (m <= 84) t = "Revisões a cada 6 meses, flúor e selantes conforme indicação. Entre 6 e 7 anos, a primeira avaliação ortodôntica.";
      else t = "Revisões a cada 6 meses e avaliação ortodôntica, se ainda não fez. Converse com a Dra. sobre selantes nos dentes permanentes.";
      out.textContent = t;
    }
    inp2.addEventListener("input", run); run();
    calc.querySelectorAll("[data-step]").forEach(function (b) { b.addEventListener("click", function () { inp2.value = Math.min(144, Math.max(0, (parseInt(inp2.value, 10) || 0) + parseInt(b.getAttribute("data-step"), 10))); run(); }); });
  }

  // ---------- comparar ortodontia
  document.querySelectorAll(".cmp").forEach(function (c) {
    var opts = c.querySelectorAll(".opt"), tds = c.querySelectorAll("td[data-k]");
    function pick(k) { opts.forEach(function (o) { o.classList.toggle("on", o.getAttribute("data-k") === k); }); tds.forEach(function (td) { td.classList.toggle("hi", td.getAttribute("data-k") === k); }); }
    opts.forEach(function (o) { o.addEventListener("click", function () { pick(o.getAttribute("data-k")); }); }); pick("fixo");
  });

  // ---------- escala de clareamento
  var sh = document.querySelector(".shade");
  if (sh) {
    var tones = ["#D9C39F", "#DFCCAE", "#E5D5BB", "#EADDC7", "#EFE5D3", "#F3EBDE", "#F7F1E8", "#FAF6F0"];
    sh.innerHTML = tones.map(function (t, k) { return '<i style="background:' + t + '" data-k="' + k + '"></i>'; }).join("");
    var r = document.querySelector(".shade-range"), lbl = document.querySelector(".shade-lbl");
    function paint2() { var v = parseInt(r.value, 10); sh.querySelectorAll("i").forEach(function (el, k) { el.classList.toggle("on", k === v); }); lbl.textContent = v <= 1 ? "Tom inicial comum em quem toma café, chá ou fuma." : v <= 4 ? "Tons intermediários, alcançados nas primeiras semanas do protocolo." : "Tons claros: o resultado depende do esmalte de cada pessoa, não de 'mais produto'."; }
    r.addEventListener("input", paint2); paint2();
  }

  // ---------- simulador ilustrativo de expressão
  var sim = document.querySelector("[data-sim='expressao']");
  if (sim) {
    var rng = sim.querySelector("input[type=range]"), lines = sim.querySelectorAll(".ruga"), out2 = sim.querySelector(".sim-out");
    function s() { var v = parseInt(rng.value, 10) / 100; lines.forEach(function (l) { l.style.opacity = (1 - v * 0.85).toFixed(2); l.style.strokeWidth = (2.2 - v * 1.4).toFixed(2); }); out2.textContent = v < 0.2 ? "Linhas de expressão marcadas (ilustração)." : v < 0.7 ? "Suavização parcial: é o objetivo de uma abordagem discreta." : "Suavização maior. Na prática, a Dra. define dose e pontos para manter a expressão natural."; }
    rng.addEventListener("input", s); s();
  }
})();
