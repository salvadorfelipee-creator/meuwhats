// Cria no Meta a campanha do plano (campanha-nexus.json). TUDO nasce PAUSED. Idempotente: guarda IDs em campanha-ids.json.
// Uso: node --env-file=.env nexus-anuncios/criar-campanha.js [--limite N]   (token em NEXUS_ADS_TOKEN)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const T = process.env.NEXUS_ADS_TOKEN;
const ACT = "act_945463391448600";
const PAGE = "1512388375281177";
const IG = "17841439718181335"; // @sitesnexus
const WHATS = "554731804984";
const B = "https://graph.facebook.com/v21.0/";
// --spec outro.json: cria só os anúncios de outro lote (ex.: novos-anuncios.json) nos conjuntos já existentes
const specArg = process.argv.includes("--spec") ? process.argv[process.argv.indexOf("--spec") + 1] : "campanha-nexus.json";
const spec = require("./" + specArg);
const idsFile = path.join(__dirname, "campanha-ids.json");
const ids = fs.existsSync(idsFile) ? JSON.parse(fs.readFileSync(idsFile, "utf8")) : { imagens: {}, videos: {}, thumbs: {}, conjuntos: {}, criativos: {}, anuncios: {} };
const salvar = () => fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2));
const limite = process.argv.includes("--limite") ? Number(process.argv[process.argv.indexOf("--limite") + 1]) : Infinity;

async function graph(p, body, multipart) {
  const url = B + p;
  let opts;
  if (multipart) opts = { method: "POST", body: multipart };
  else if (body) opts = { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.fromEntries(Object.entries({ ...body, access_token: T }).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]))) };
  else return (await fetch(url + (p.includes("?") ? "&" : "?") + "access_token=" + T)).json();
  const r = await (await fetch(url, opts)).json();
  if (r.error) throw new Error(`${p}: ${r.error.message}${r.error.error_user_msg ? " | " + r.error.error_user_msg : ""}`);
  return r;
}

async function subirImagem(arquivo) {
  if (ids.imagens[arquivo]) return ids.imagens[arquivo];
  const fd = new FormData();
  fd.append("access_token", T);
  fd.append("filename", new Blob([fs.readFileSync(arquivo)], { type: "image/png" }), path.basename(arquivo));
  const r = await graph(`${ACT}/adimages`, null, fd);
  const hash = Object.values(r.images)[0].hash;
  ids.imagens[arquivo] = hash; salvar();
  return hash;
}

async function subirVideo(arquivo) {
  if (ids.videos[arquivo]) return ids.videos[arquivo];
  const fd = new FormData();
  fd.append("access_token", T);
  fd.append("title", path.basename(arquivo, ".mp4"));
  fd.append("source", new Blob([fs.readFileSync(arquivo)], { type: "video/mp4" }), path.basename(arquivo));
  const r = await graph(`${ACT}/advideos`, null, fd);
  ids.videos[arquivo] = r.id; salvar();
  return r.id;
}

async function esperarVideo(id) {
  for (let i = 0; i < 40; i++) {
    const r = await graph(`${id}?fields=status`);
    const st = r.status && r.status.video_status;
    if (st === "ready") return;
    if (st === "error") throw new Error("vídeo com erro de processamento " + id);
    await new Promise((x) => setTimeout(x, 5000));
  }
  throw new Error("vídeo demorou demais " + id);
}

async function thumb(arquivo) {
  if (ids.thumbs[arquivo]) return ids.thumbs[arquivo];
  const out = path.join(path.dirname(arquivo), "..", "thumbs", path.basename(arquivo, ".mp4") + ".png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", arquivo, "-frames:v", "1", out]);
  const hash = await subirImagem(out);
  ids.thumbs[arquivo] = hash; salvar();
  return hash;
}

// Detalhe de público: o que o Meta ainda oferece em português para esses nichos (Advantage+ expande a partir daqui).
const DETALHE = {
  odonto: { work_positions: [{ id: "168991743113816" }] },
  medicina: {},
  psicologia: { work_positions: [{ id: "647520825310747" }], interests: [{ id: "6003224104145" }] },
  psiquiatria: {},
  harmonizacao: { work_positions: [{ id: "176835319023033" }] },
  geral: { work_positions: [{ id: "339651256100614" }, { id: "127978847249423" }], interests: [{ id: "6004140335706" }, { id: "6003136069408" }, { id: "6003114185392" }] },
};

function targeting(k, c) {
  const t = { geo_locations: { regions: [{ key: "459" }] }, excluded_geo_locations: { cities: [{ key: "243550" }, { key: "245903" }] }, age_min: Math.min(c.idade[0], 25), age_max: 65, age_range: [c.idade[0], c.idade[1]], targeting_automation: { advantage_audience: 1 }, publisher_platforms: ["facebook", "instagram"] };
  if (c.generos === "mulheres") t.genders = [2];
  if (Object.keys(DETALHE[k]).length) t.flexible_spec = [DETALHE[k]];
  return t;
}

(async () => {
  // 1) Campanha
  if (!ids.campanha) {
    const c = await graph(`${ACT}/campaigns`, { name: spec.campanha.nome, objective: "OUTCOME_ENGAGEMENT", special_ad_categories: [], status: "PAUSED", buying_type: "AUCTION", is_adset_budget_sharing_enabled: false });
    ids.campanha = c.id; salvar(); console.log("campanha", c.id);
  }
  // 2) Conjuntos
  for (const [k, c] of Object.entries(spec.conjuntos)) {
    if (ids.conjuntos[k]) continue;
    const r = await graph(`${ACT}/adsets`, {
      name: `Nexus SC | ${c.nome} | ${c.idade[0]}-${c.idade[1]}${c.generos === "mulheres" ? " F" : ""}`,
      campaign_id: ids.campanha, status: "PAUSED", daily_budget: String(c.orcamentoDia * 100),
      billing_event: "IMPRESSIONS", optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: { page_id: PAGE, whatsapp_phone_number: WHATS },
      targeting: targeting(k, c),
      regional_regulation_identities: { universal_beneficiary: "599219759208171", universal_payer: "599219759208171" },
      start_time: new Date().toISOString(), end_time: "2026-11-19T23:59:00-0200",
    });
    ids.conjuntos[k] = r.id; salvar(); console.log("conjunto", k, r.id);
  }
  // 3) Criativos + anúncios
  let n = 0;
  for (const a of spec.anuncios) {
    const recriar = process.argv.includes("--recriar");
    if (ids.anuncios[a.arquivo] && !recriar) continue;
    if (n >= limite) break;
    n++;
    const nome = `${a.conjunto} | ${path.basename(a.arquivo).replace(/\.(png|mp4)$/, "")}`;
    const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
    const link = `https://api.whatsapp.com/send?phone=${WHATS}`;
    let spec_;
    if (a.tipo === "imagem") {
      const hash = await subirImagem(a.arquivo);
      spec_ = { page_id: PAGE, instagram_user_id: IG, link_data: { image_hash: hash, link, message: a.texto, name: a.titulo, description: a.descricao, call_to_action: cta } };
    } else {
      const vid = await subirVideo(a.arquivo);
      await esperarVideo(vid);
      const th = await thumb(a.arquivo);
      spec_ = { page_id: PAGE, instagram_user_id: IG, video_data: { video_id: vid, image_hash: th, message: a.texto, title: a.titulo, link_description: a.descricao, call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP", link } } } };
    }
    let cr;
    if (ids.criativos[a.arquivo] && !recriar) cr = { id: ids.criativos[a.arquivo] };
    else try {
      cr = await graph(`${ACT}/adcreatives`, { name: nome, object_story_spec: spec_ });
    } catch (e) {
      if (/instagram/i.test(e.message)) { delete spec_.instagram_user_id; console.log("  sem identidade do Instagram:", e.message.slice(0, 120)); cr = await graph(`${ACT}/adcreatives`, { name: nome, object_story_spec: spec_ }); }
      else throw e;
    }
    ids.criativos[a.arquivo] = cr.id;
    let ad;
    if (recriar && ids.anuncios[a.arquivo]) { await graph(ids.anuncios[a.arquivo], { creative: { creative_id: cr.id } }); ad = { id: ids.anuncios[a.arquivo] }; }
    else ad = await graph(`${ACT}/ads`, { name: nome, adset_id: ids.conjuntos[a.conjunto], creative: { creative_id: cr.id }, status: "PAUSED" });
    ids.anuncios[a.arquivo] = ad.id; salvar();
    console.log("anúncio", nome, ad.id);
  }
  console.log("fim. anúncios criados:", Object.keys(ids.anuncios).length, "/", spec.anuncios.length);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
