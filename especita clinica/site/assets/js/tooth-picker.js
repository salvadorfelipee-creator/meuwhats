/* Especitá · seletor 3D de dentes (three.js). Carrega só quando a seção chega perto da tela.
   Modelos: BodyParts3D via Dental Scope (CC BY-SA 2.1 JP; ver assets/models/CREDITS.md). Uso educativo. */
const roots = Array.prototype.slice.call(document.querySelectorAll("[data-picker]"));
if (roots.length) {
  const WA = document.documentElement.getAttribute("data-wa") || "";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TYPES = ["incisivo central", "incisivo lateral", "canino", "primeiro pré-molar", "segundo pré-molar", "primeiro molar", "segundo molar", "terceiro molar (siso)"];
  const QUAD = { 1: "superior direito", 2: "superior esquerdo", 3: "inferior esquerdo", 4: "inferior direito" };
  const nome = (n) => TYPES[(n % 10) - 1] + " " + QUAD[Math.floor(n / 10)];
  const SIT = {
    faltando: ["Faltando", "Dente que falta pode ser reposto com implante, prótese ou ponte. A avaliação com planejamento digital mostra qual caminho faz sentido no seu caso."],
    quebrado: ["Quebrado ou lascado", "Dente quebrado costuma resolver com restauração, faceta ou coroa, muitas vezes no mesmo dia. Peça um encaixe."],
    dor: ["Com dor", "Dor de dente que não passa precisa de avaliação. Se houver inchaço ou febre, avise a recepção: o atendimento é prioritário."],
    manchado: ["Manchado ou escuro", "Manchas superficiais respondem ao clareamento; manchas profundas podem pedir lente de contato. A avaliação define."],
    torto: ["Torto ou com espaço", "Dentes tortos ou com espaços podem ser alinhados com aparelho fixo ou alinhador invisível. Vale uma avaliação ortodôntica."],
    pequeno: ["Pequeno ou desgastado", "Lentes de contato dentais e restaurações corrigem formato e tamanho. O planejamento digital mostra a proposta antes de qualquer procedimento."],
  };
  const FDI_UP = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const FDI_LO = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  function waLink(t) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(t); }

  function setup(root) {
    const stage = root.querySelector(".pk-stage"), canvas = root.querySelector("canvas"), tip = root.querySelector(".pk-tip"), loadEl = root.querySelector(".pk-load");
    const chips = root.querySelector(".pk-chips"), out = root.querySelector(".pk-out"), cta = root.querySelector("[data-pk-cta]");
    const sits = Array.prototype.slice.call(root.querySelectorAll(".pk-sit button"));
    const base = root.getAttribute("data-cta") || "Olá! Vim pelo site.";
    const selected = new Set(); let sit = root.getAttribute("data-default-sit") || sits[0] && sits[0].getAttribute("data-s"); let api = null;

    function refresh() {
      const arr = Array.from(selected).sort(function (a, b) { return a - b; });
      chips.innerHTML = arr.length ? arr.map(function (n) { return '<button type="button" class="pk-chip" data-n="' + n + '" aria-label="Remover dente ' + n + '"><b>' + n + "</b> " + nome(n) + " <i>×</i></button>"; }).join("") : '<span class="pk-empty">Nenhum dente escolhido ainda. Clique no modelo ou use os números abaixo.</span>';
      sits.forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-s") === sit); });
      out.textContent = sit && SIT[sit] ? SIT[sit][1] : "";
      const msg = base + (arr.length ? " Dentes: " + arr.map(function (n) { return n + " (" + nome(n) + ")"; }).join("; ") + "." : "") + (sit && SIT[sit] ? " Situação: " + SIT[sit][0].toLowerCase() + "." : "");
      cta.href = waLink(msg); cta.target = "_blank"; cta.rel = "noopener";
      root.querySelectorAll(".pk-num button").forEach(function (b) { b.setAttribute("aria-pressed", selected.has(+b.getAttribute("data-n")) ? "true" : "false"); });
      if (api) api.paint(selected);
    }
    function toggle(n) { selected.has(n) ? selected.delete(n) : selected.add(n); refresh(); }
    chips.addEventListener("click", function (e) { const b = e.target.closest(".pk-chip"); if (b) toggle(+b.getAttribute("data-n")); });
    sits.forEach(function (b) { b.addEventListener("click", function () { sit = b.getAttribute("data-s"); refresh(); }); });
    root.querySelectorAll(".pk-num button").forEach(function (b) { b.addEventListener("click", function () { toggle(+b.getAttribute("data-n")); }); });
    root.querySelectorAll(".pk-views button").forEach(function (b) { b.addEventListener("click", function () { if (api) api.view(b.getAttribute("data-view")); root.querySelectorAll(".pk-views button").forEach(function (x) { x.classList.toggle("on", x === b); }); }); });
    refresh();

    let started = false;
    async function start() {
      if (started) return; started = true;
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const { MeshoptDecoder } = await import("three/addons/libs/meshopt_decoder.module.js");
        api = await build(THREE, GLTFLoader, MeshoptDecoder, stage, canvas, tip, toggle, selected);
        loadEl.classList.add("done"); api.paint(selected);
      } catch (err) {
        console.warn("[picker] 3D indisponível:", err);
        loadEl.textContent = "O modelo 3D não carregou neste navegador. Escolha o dente pelos números abaixo.";
        stage.classList.add("fail");
      }
    }
    new IntersectionObserver(function (es, ob) { if (es[0].isIntersecting) { ob.disconnect(); start(); } }, { rootMargin: "400px 0px" }).observe(root);
  }

  async function build(THREE, GLTFLoader, MeshoptDecoder, stage, canvas, tip, toggle, selected) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3e322a, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 9); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc4b196, 0.9); rim.position.set(-6, 2, -5); scene.add(rim);

    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise(function (res, rej) { loader.load("/assets/models/core.glb", res, undefined, rej); });
    const arch = new THREE.Group(); arch.add(gltf.scene); scene.add(arch);

    const mats = {
      tooth: new THREE.MeshStandardMaterial({ color: 0xf3ece1, roughness: 0.42, metalness: 0 }),
      gum: new THREE.MeshStandardMaterial({ color: 0xc08f80, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    };
    const teeth = {}; const lower = [];
    gltf.scene.traverse(function (o) {
      if (!o.isMesh) return;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      if (/^tooth-\d\d$/.test(o.name)) { const n = +o.name.slice(6); o.material = mats.tooth.clone(); o.userData.n = n; teeth[n] = o; if (n >= 30) lower.push(o); }
      else if (o.name === "gingiva-upper") o.material = mats.gum;
      else if (o.name === "gingiva-lower") { o.material = mats.gum; lower.push(o); }
      else o.visible = false;
    });
    lower.forEach(function (o) { o.position.y -= 0.75; });

    const box = new THREE.Box3();
    gltf.scene.traverse(function (o) { if (o.isMesh && o.visible) box.union(new THREE.Box3().setFromObject(o)); });
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    const radius = size.length() / 2;
    // corta as raízes que atravessariam a gengiva (planos no espaço da arcada, atualizados a cada quadro)
    arch.updateMatrixWorld(true);
    const gu = new THREE.Box3().setFromObject(gltf.scene.getObjectByName("gingiva-upper")), gl = new THREE.Box3().setFromObject(gltf.scene.getObjectByName("gingiva-lower"));
    const localUp = new THREE.Plane(new THREE.Vector3(0, -1, 0), gu.max.y - 0.35), localLo = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(gl.min.y + 0.35));
    const wUp = localUp.clone(), wLo = localLo.clone();
    Object.keys(teeth).forEach(function (k) { teeth[k].material.clippingPlanes = [+k < 30 ? wUp : wLo]; });
    const VIEWS = { front: [0.05, 0], upper: [-1.15, 0], lower: [1.0, 0], right: [0.05, 1.05], left: [0.05, -1.05] };
    const rot = { x: 0.05, y: 0 }, target = { x: 0.05, y: 0 };
    let hover = null, dragging = false, moved = 0, lx = 0, ly = 0, last = 0, interacted = false, visible = true, raf = 0;

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      const fit = radius / Math.sin((camera.fov * Math.PI) / 360) * (w / h < 1 ? 1.0 : 0.78);
      camera.position.set(0, 0, fit); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); need = true;
    }
    let need = true;
    new ResizeObserver(resize).observe(stage); resize();

    const colSel = new THREE.Color(0xe0b36a), colHov = new THREE.Color(0xe9dcc3), colBase = new THREE.Color(0xf3ece1);
    function paint(sel) {
      Object.keys(teeth).forEach(function (k) { const t = teeth[k], isSel = sel.has(+k);
        t.material.color.copy(isSel ? colSel : (hover === +k ? colHov : colBase));
        t.material.emissive.setHex(isSel ? 0x4a3410 : 0x000000); });
      need = true;
    }

    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    function pick(e) {
      const r = canvas.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(Object.values(teeth), false)[0]; return hit ? hit.object.userData.n : null;
    }
    canvas.style.touchAction = "pan-y";
    canvas.addEventListener("pointerdown", function (e) { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); interacted = true; });
    canvas.addEventListener("pointermove", function (e) {
      if (dragging) { const dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY;
        target.y += dx * 0.008; target.x = Math.max(-1.3, Math.min(1.3, target.x + dy * 0.006)); need = true; return; }
      const n = pick(e);
      if (n !== hover) { hover = n; paint(selected); canvas.style.cursor = n ? "pointer" : "grab"; }
      if (n) { tip.textContent = n + " · " + nome(n); tip.style.opacity = 1; const r = stage.getBoundingClientRect(); tip.style.transform = "translate(" + (e.clientX - r.left + 14) + "px," + (e.clientY - r.top + 14) + "px)"; } else tip.style.opacity = 0;
    });
    function up(e) { if (!dragging) return; dragging = false; if (moved < 6) { const n = pick(e); if (n) toggle(n); } }
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", function () { dragging = false; });
    canvas.addEventListener("pointerleave", function () { hover = null; tip.style.opacity = 0; paint(selected); });
    canvas.style.cursor = "grab";

    function frame(t) {
      raf = 0; if (!visible) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      if (!interacted && !reduce) { target.y = Math.sin(t / 2600) * 0.28; need = true; }
      const k = 1 - Math.pow(0.0015, dt); rot.x += (target.x - rot.x) * k; rot.y += (target.y - rot.y) * k;
      if (Math.abs(target.x - rot.x) > 0.0005 || Math.abs(target.y - rot.y) > 0.0005) need = true;
      if (need) { arch.rotation.set(rot.x, rot.y, 0); arch.updateMatrixWorld(true); wUp.copy(localUp).applyMatrix4(arch.matrixWorld); wLo.copy(localLo).applyMatrix4(arch.matrixWorld); renderer.render(scene, camera); need = false; }
      raf = requestAnimationFrame(frame);
    }
    function loop() { if (!raf && visible) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(stage); loop();
    return { paint: paint, view: function (v) { const p = VIEWS[v] || VIEWS.front; target.x = p[0]; target.y = p[1]; interacted = true; need = true; loop(); } };
  }

  roots.forEach(setup);
}
