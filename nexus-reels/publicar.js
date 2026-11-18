// Publicador mecânico dos Reels da @nexusssites (sem IA): sobe os vídeos ao R2 e publica o próximo da fila.
// Vídeos ficam em posts/nexus-reels/ (prefixo "posts/" é ignorado pela fila de Reels da Felizcred — ver reels.js).
// Uso:
//   node nexus-reels/publicar.js subir            envia reel_NN.mp4 de nexus-assets/reels ao R2 (só as chaves exatas)
//   node nexus-reels/publicar.js proximo [--n 5] [--dry] [--normal]   publica o próximo não publicado (ou o N)
// Variáveis: SITESNEXUS_IG_TOKEN, SITESNEXUS_IG_ID, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
// Por padrão tenta "Reels de teste" (trial_params: aparece só para quem NÃO segue); se a API recusar, publica normal.
const fs = require("fs");
const path = require("path");
const r2 = require("../r2");

const GRAPH = "https://graph.facebook.com/v21.0/";
const TOKEN = process.env.SITESNEXUS_IG_TOKEN;
const IG = process.env.SITESNEXUS_IG_ID;
const itens = JSON.parse(fs.readFileSync(path.join(__dirname, "conteudo.json"), "utf8"));
const estadoFile = path.join(__dirname, "estado.json");
const estado = fs.existsSync(estadoFile) ? JSON.parse(fs.readFileSync(estadoFile, "utf8")) : { chaves: {}, publicados: {} };
const salvar = () => fs.writeFileSync(estadoFile, JSON.stringify(estado, null, 2));
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const chave = (it) => `posts/nexus-reels/${it.video}`;
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(p, body) {
  const opts = body ? { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...body, access_token: TOKEN }) } : {};
  const url = GRAPH + p + (body ? "" : (p.includes("?") ? "&" : "?") + "access_token=" + TOKEN);
  return (await fetch(url, opts)).json();
}

async function subir() {
  for (const it of itens) {
    const k = chave(it);
    if (estado.chaves[it.n]) continue;
    const f = `C:/Users/Salvador/Documents/nexus-assets/reels/${it.video}`;
    await r2.enviarVideo(k, fs.readFileSync(f));
    estado.chaves[it.n] = k; salvar();
    console.log("enviado", k);
  }
}

async function publicarUm(it, normal) {
  const videoUrl = await r2.urlAssinada(chave(it), 3600);
  const base = { media_type: "REELS", video_url: videoUrl, caption: it.legenda, share_to_feed: "true", thumb_offset: "1500" };
  let trial = !normal;
  let c = trial ? await graph(`${IG}/media`, { ...base, trial_params: JSON.stringify({ graduation_strategy: "SS_PERFORMANCE" }) }) : null;
  if (c && c.error) { console.log("  teste (trial) recusado:", c.error.message.slice(0, 160), "-> publicando normal"); trial = false; c = null; }
  if (!c) c = await graph(`${IG}/media`, base);
  if (c.error) throw new Error("container: " + JSON.stringify(c.error));
  for (let i = 0; i < 60; i++) {
    const s = await graph(`${c.id}?fields=status_code,status`);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("processamento: " + JSON.stringify(s));
    await dorme(5000);
  }
  const p = await graph(`${IG}/media_publish`, { creation_id: c.id });
  if (p.error) throw new Error("publicar: " + JSON.stringify(p.error));
  const m = await graph(`${p.id}?fields=permalink`);
  return { id: p.id, link: m.permalink || null, trial, data: new Date().toISOString() };
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === "subir") return subir();
  if (cmd === "proximo") {
    const n = arg("--n") ? Number(arg("--n")) : null;
    const it = n ? itens.find((x) => x.n === n) : itens.find((x) => !estado.publicados[x.n]);
    if (!it) return console.log("fila vazia: todos publicados");
    if (estado.publicados[it.n]) return console.log("já publicado:", it.n);
    if (!estado.chaves[it.n]) throw new Error("vídeo não enviado ao R2 (rode: subir)");
    console.log("publicando", it.n, it.titulo);
    if (process.argv.includes("--dry")) return console.log(it.legenda);
    estado.publicados[it.n] = await publicarUm(it, process.argv.includes("--normal"));
    salvar();
    console.log("publicado:", JSON.stringify(estado.publicados[it.n]));
    return;
  }
  console.log("uso: subir | proximo [--n N] [--dry] [--normal]");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
