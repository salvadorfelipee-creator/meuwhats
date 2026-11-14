// Gera 100 anúncios (1080x1350): 10 avatares x 5 ângulos x 2 formatos.
// Formato A = frase direta. Formato B = infográfico com mockup (tela de exemplo, dados fictícios).
// Uso: node nexus-anuncios/gerar.js   -> grava em nexus-anuncios/out/
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { ANGULOS, PRODUTOS } = require("./dados");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  p1: { bg: "#0F2A22", fg: "#F4EFE4", ac: "#C9F26B", mute: "#9DB5AA", card: "#173A30" },
  p2: { bg: "#F4EFE4", fg: "#0F2A22", ac: "#1F7A5C", mute: "#5B6F66", card: "#FFFFFF" }
};
const ROTULO = { dor: "Dor", resultado: "Resultado", prova: "Prova", mecanismo: "Mecanismo", beneficio: "Benefício" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* ---------- MOCKUPS (telas de exemplo, dados fictícios) ---------- */
const frameNav = (inner, url) => `
<div class="win"><div class="bar"><i></i><i></i><i></i><span>${url}</span></div>${inner}</div>`;

function mockSite(kind) {
  const hero = `<div class="hero"><div><b>Sorrisos com cuidado, na sua cidade</b><p>Avaliação, tratamento e acompanhamento em um só lugar.</p><u>Agendar pelo WhatsApp</u></div><div class="img"></div></div>`;
  const cards = `<div class="cards3"><div><b>Implantes</b><p>Como funciona e quando indicar</p></div><div><b>Clareamento</b><p>Etapas, tempo e cuidados</p></div><div><b>Aparelho</b><p>Tipos e acompanhamento</p></div></div>`;
  if (kind === "site") return frameNav(`<div class="nav"><b>Clínica Exemplo</b><span>Procedimentos · Equipe · Contato</span></div>${hero}${cards}`, "clinicaexemplo.com.br");
  if (kind === "novo") return frameNav(`<div class="nav"><b>Clínica Exemplo</b><span>Inauguração</span></div>${hero}<div class="team"><i></i><i></i><i></i><div><b>Nossa equipe</b><p>Especialistas e estrutura completa</p></div><div class="pin">📍 Rua Exemplo, 100</div></div>`, "clinicaexemplo.com.br");
  if (kind === "caso") return frameNav(`<div class="nav"><b>Estúdio Exemplo</b><span>Casos · Método · Perfil</span></div><div class="case"><div class="img big"></div><div><b>Reabilitação completa</b><p>1. Diagnóstico</p><p>2. Tratamento em etapas</p><p>3. Acompanhamento</p><u>Falar com a equipe</u></div></div>`, "estudioexemplo.com.br/casos");
  if (kind === "busca")
    return `<div class="win"><div class="bar"><i></i><i></i><i></i><span>google.com/search</span></div><div class="gs"><div class="sbox">🔍 clínica odontológica em [sua cidade]</div>
    <div class="res"><small>Clínica Vizinha · ★4,6</small><b>Clínica Vizinha — Odontologia</b><p>Avaliação e tratamento. Agende sua consulta.</p></div>
    <div class="res you"><span class="tag">Sua clínica</span><small>Clínica Exemplo · ★4,9</small><b>Clínica Exemplo — Implantes, clareamento, aparelho</b><p>Veja procedimentos e agende pelo WhatsApp.</p></div>
    <div class="res"><small>Outra Clínica · ★4,4</small><b>Outra Clínica — Odontologia Geral</b><p>Atendimento para toda a família.</p></div></div></div>`;
  // insta: lado a lado
  return `<div class="vs"><div class="ph"><small>Só Instagram</small><div class="grid9">${"<i></i>".repeat(9)}</div><p>Link da bio</p></div><div class="mini">${frameNav(`<div class="nav"><b>Estúdio Exemplo</b></div>${hero}`, "estudioexemplo.com.br")}<small class="cap">Site completo</small></div></div>`;
}

function mockPhone(kind) {
  const body = {
    inbox: `<div class="hd">Conversas</div>${[
      ["Paciente A", "Quero marcar uma avaliação", "Novo", "2"],
      ["Paciente B", "Qual o valor do clareamento?", "Orçamento", "1"],
      ["Paciente C", "Confirmado para amanhã 14h", "Agendado", ""],
      ["Paciente D", "Obrigada!", "Atendido", ""]
    ].map(([n, m, s, u]) => `<div class="row"><i></i><div><b>${n}</b><p>${m}</p></div><span class="chip">${s}</span>${u ? `<em>${u}</em>` : ""}</div>`).join("")}`,
    menu: `<div class="hd">Clínica Exemplo</div><div class="msgs"><div class="b l">Olá! Como podemos ajudar?</div><div class="btns"><u>Agendar consulta</u><u>Endereço e horários</u><u>Convênios</u><u>Falar com a equipe</u></div><div class="b r">Endereço e horários</div><div class="b l">Rua Exemplo, 100. Seg a sex, 8h às 18h.</div></div>`,
    lembrete: `<div class="hd">Clínica Exemplo</div><div class="msgs"><div class="b l">Olá! Lembrete: sua consulta é amanhã, às 14h.</div><div class="btns"><u>Confirmar</u><u>Remarcar</u></div><div class="b r">Confirmar</div><div class="b l">Perfeito! Confirmado. Até lá.</div></div>`,
    funil: `<div class="hd">Funil de contatos</div><div class="kan">${[
      ["Novo", ["Paciente A", "Paciente E"]],
      ["Orçamento", ["Paciente B", "Paciente F"]],
      ["Agendado", ["Paciente C"]]
    ].map(([c, l]) => `<div class="col"><small>${c}</small>${l.map((x) => `<div class="k">${x}<br><span>retorno: amanhã</span></div>`).join("")}</div>`).join("")}</div>`,
    origem: `<div class="hd">Contatos</div>${[
      ["Paciente A", "Instagram"],
      ["Paciente B", "Google"],
      ["Paciente C", "Indicação"],
      ["Paciente D", "Anúncio"]
    ].map(([n, o]) => `<div class="row"><i></i><div><b>${n}</b><p>Origem do contato</p></div><span class="chip">${o}</span></div>`).join("")}`
  }[kind];
  return `<div class="phone"><div class="notch"></div><div class="scr">${body}</div></div>`;
}

/* ---------- CSS / HTML ---------- */
function css(t) {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:${t.bg};color:${t.fg};font-family:"Segoe UI",Arial,sans-serif;position:relative;overflow:hidden}
.top{position:absolute;left:72px;right:72px;top:64px;display:flex;justify-content:space-between;align-items:center}
.chip0{background:${t.ac};color:${t.bg === "#0F2A22" ? "#0F2A22" : "#fff"};font-weight:700;font-size:26px;padding:10px 22px;border-radius:40px;letter-spacing:.3px}
.tagr{font-size:24px;color:${t.mute};font-weight:600}
.foot{position:absolute;left:72px;right:72px;bottom:56px;display:flex;justify-content:space-between;align-items:center;font-size:26px;color:${t.mute}}
.logo{display:flex;align-items:center;gap:14px;color:${t.fg};font-weight:700;font-size:28px}
.logo i{width:44px;height:44px;border-radius:10px;background:${t.ac};color:${t.bg === "#0F2A22" ? "#0F2A22" : "#fff"};display:grid;place-items:center;font-style:normal;font-family:Georgia,serif;font-size:30px}
.cta{color:${t.fg};font-weight:600}
/* A */
.fa{position:absolute;left:72px;right:72px;top:210px;bottom:170px;display:flex;flex-direction:column;justify-content:center}
.fa h1{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:92px;line-height:1.08;letter-spacing:-1.5px}
.fa hr{width:140px;height:8px;border:0;background:${t.ac};margin-top:48px;border-radius:4px}
.ex{font-size:22px;color:${t.mute};margin-top:26px}
/* B */
.tt{position:absolute;left:72px;right:72px;top:150px}
.tt h2{font-family:Georgia,serif;font-size:60px;line-height:1.1;letter-spacing:-1px}
.mk{position:absolute;left:72px;right:72px;top:370px;height:560px;display:flex;justify-content:center}
.bl{position:absolute;left:72px;right:72px;top:960px;display:flex;flex-direction:column;gap:18px}
.bl div{display:flex;gap:18px;align-items:center;font-size:32px;font-weight:600;line-height:1.2}
.bl span{flex:0 0 46px;height:46px;border-radius:50%;background:${t.ac};color:${t.bg === "#0F2A22" ? "#0F2A22" : "#fff"};display:grid;place-items:center;font-size:26px;font-weight:800}
/* mocks */
.win{width:100%;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;color:#1b2b26;border:1px solid #e3ded2}
.bar{background:#eceae3;height:44px;display:flex;align-items:center;gap:8px;padding:0 16px}.bar i{width:12px;height:12px;border-radius:50%;background:#c9c4b6}.bar span{margin-left:14px;background:#fff;border-radius:14px;padding:4px 16px;font-size:18px;color:#6a756f}
.nav{display:flex;justify-content:space-between;padding:18px 26px;font-size:20px;border-bottom:1px solid #eee}.nav span{color:#6a756f}
.hero{display:flex;gap:20px;padding:26px;align-items:center}.hero b{font-family:Georgia,serif;font-size:34px;line-height:1.15;display:block}.hero p{font-size:19px;margin:12px 0;color:#52615a}.hero u{text-decoration:none;display:inline-block;background:#1F7A5C;color:#fff;font-weight:700;font-size:19px;padding:12px 20px;border-radius:30px}
.img{flex:0 0 220px;height:170px;border-radius:14px;background:linear-gradient(135deg,#cfe3da,#8fb9a8)}.img.big{flex:0 0 250px;height:250px}
.cards3{display:flex;gap:12px;padding:0 26px 26px}.cards3 div{flex:1;background:#f4f1e9;border-radius:12px;padding:14px}.cards3 b{font-size:20px}.cards3 p{font-size:16px;color:#52615a;margin-top:4px}
.team{display:flex;gap:12px;align-items:center;padding:0 26px 22px}.team i{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#cfe3da,#8fb9a8)}.team div{font-size:18px}.team b{display:block}.pin{margin-left:auto;background:#f4f1e9;padding:10px 14px;border-radius:12px;font-size:17px}
.case{display:flex;gap:22px;padding:26px;align-items:center}.case b{font-family:Georgia,serif;font-size:32px;display:block;margin-bottom:10px}.case p{font-size:19px;color:#52615a;margin:6px 0}.case u{display:inline-block;text-decoration:none;margin-top:14px;background:#1F7A5C;color:#fff;padding:12px 20px;border-radius:30px;font-weight:700;font-size:19px}
.gs{padding:20px 26px}.sbox{border:1px solid #ddd;border-radius:30px;padding:12px 20px;font-size:21px;margin-bottom:18px}.res{padding:12px 14px;border-radius:12px;margin-bottom:8px}.res small{color:#6a756f;font-size:16px}.res b{display:block;color:#1a4fa0;font-size:22px;margin:3px 0}.res p{font-size:17px;color:#52615a}.res.you{background:#EAF6E7;border:2px solid #1F7A5C;position:relative}.tag{position:absolute;right:12px;top:-12px;background:#1F7A5C;color:#fff;font-size:15px;font-weight:700;padding:3px 12px;border-radius:12px}
.vs{display:flex;gap:26px;width:100%;align-items:center}.ph{flex:0 0 250px;background:#fff;border-radius:34px;border:6px solid #1b2b26;padding:18px;color:#1b2b26;box-shadow:0 20px 50px rgba(0,0,0,.25)}.ph small,.mini small.cap{font-size:18px;font-weight:700;display:block;margin-bottom:10px}.grid9{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.grid9 i{aspect-ratio:1;background:linear-gradient(135deg,#e9c9d9,#c7b6e6);border-radius:4px}.ph p{font-size:16px;margin-top:12px;color:#1a4fa0}
.mini{flex:1;position:relative}.mini .win{box-shadow:0 20px 50px rgba(0,0,0,.25)}.mini small.cap{color:${t.fg};margin-top:12px;text-align:center}
.phone{width:330px;background:#fff;border-radius:44px;border:8px solid #1b2b26;box-shadow:0 20px 50px rgba(0,0,0,.28);position:relative;overflow:hidden;color:#1b2b26;height:560px}
.notch{position:absolute;left:50%;top:0;transform:translateX(-50%);width:110px;height:22px;background:#1b2b26;border-radius:0 0 14px 14px;z-index:2}
.scr{padding:34px 12px 12px;height:100%;background:#F3F0E8}.hd{font-weight:700;font-size:20px;padding:6px 6px 10px}
.row{display:flex;align-items:center;gap:10px;background:#fff;border-radius:12px;padding:9px;margin-bottom:8px;position:relative}.row i{flex:0 0 36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#cfe3da,#8fb9a8)}.row b{font-size:16px}.row p{font-size:13px;color:#6a756f}.row div{flex:1;min-width:0}.chip{background:#EAF6E7;color:#1F7A5C;font-size:12px;font-weight:700;padding:3px 9px;border-radius:10px;white-space:nowrap}.row em{position:absolute;right:8px;top:-6px;background:#1F7A5C;color:#fff;font-style:normal;font-size:12px;border-radius:10px;padding:1px 7px}
.msgs{display:flex;flex-direction:column;gap:9px;padding:6px}.b{max-width:85%;padding:10px 13px;border-radius:14px;font-size:15px;line-height:1.3}.b.l{background:#fff;align-self:flex-start}.b.r{background:#DCF3E4;align-self:flex-end}.btns{display:flex;flex-direction:column;gap:6px}.btns u{text-decoration:none;background:#fff;color:#1F7A5C;border:1px solid #cfe3da;text-align:center;font-weight:700;padding:8px;border-radius:12px;font-size:14px}
.kan{display:flex;gap:6px}.col{flex:1;background:#E8E4D8;border-radius:10px;padding:6px}.col small{font-weight:700;font-size:12px;display:block;margin-bottom:6px}.k{background:#fff;border-radius:8px;padding:7px;font-size:12px;font-weight:600;margin-bottom:6px}.k span{color:#1F7A5C;font-size:11px;font-weight:500}
`;
}

function htmlA(prod, av, ang, d) {
  const t = T[prod];
  return `<html><head><meta charset="utf-8"><style>${css(t)}</style></head><body>
  <div class="top"><span class="chip0">${PRODUTOS[prod].nome}</span></div>
  <div class="fa"><h1>${esc(d.f)}</h1><hr></div>
  <div class="foot"><div class="logo"><i>n</i>sitesnexus</div><div class="cta">Fale com a gente no WhatsApp</div></div></body></html>`;
}

function htmlB(prod, av, ang, d) {
  const t = T[prod];
  const mock = prod === "p1" ? mockSite(av.view) : mockPhone(av.view);
  return `<html><head><meta charset="utf-8"><style>${css(t)}</style></head><body>
  <div class="top"><span class="chip0">${ROTULO[ang]}</span><span class="tagr">${PRODUTOS[prod].nome}</span></div>
  <div class="tt"><h2>${esc(d.t)}</h2></div>
  <div class="mk">${mock}</div>
  <div class="bl">${d.b.map((x, i) => `<div><span>${i + 1}</span>${esc(x.replace(/^\d\.\s*/, ""))}</div>`).join("")}</div>
  <div class="foot"><div class="logo"><i>n</i>sitesnexus</div><div class="cta">Exemplo ilustrativo · dados fictícios</div></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const idx = [];
  let n = 0;
  for (const prod of ["p1", "p2"]) {
    for (const av of PRODUTOS[prod].avatares) {
      for (const ang of ANGULOS) {
        const d = av.angulos[ang];
        for (const fmt of ["A", "B"]) {
          const html = fmt === "A" ? htmlA(prod, av, ang, d) : htmlB(prod, av, ang, d);
          await page.setContent(html, { waitUntil: "load" });
          const nome = `${prod}-${av.id}-${ang}-${fmt}.png`;
          await page.screenshot({ path: path.join(OUT, nome) });
          idx.push({ nome, produto: PRODUTOS[prod].nome, avatar: av.nome, angulo: ang, formato: fmt === "A" ? "Frase direta" : "Infográfico" });
          n++;
        }
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "indice.json"), JSON.stringify(idx, null, 2));
  const rows = idx.map((x) => `<figure><img src="${x.nome}" loading="lazy"><figcaption>${x.produto} · ${x.avatar} · ${x.angulo} · ${x.formato}</figcaption></figure>`).join("");
  fs.writeFileSync(path.join(OUT, "galeria.html"), `<html><meta charset="utf-8"><style>body{font-family:sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:16px;background:#eee}img{width:100%}figcaption{font-size:13px}</style><body>${rows}</body></html>`);
  console.log("ok", n);
})();
