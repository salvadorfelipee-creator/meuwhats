// Cria no Meta a campanha "Assessoria de marketing" (60 criativos, 3 conjuntos). TUDO nasce PAUSED. Idempotente (IDs em assessoria-ids.json).
// Uso: node --env-file=.env nexus-anuncios/criar-campanha-assessoria.js [--limite N]
// NÃO usa campanha-ids.json: é uma campanha separada da de sites (120251076687240006).
const fs = require("fs");
const path = require("path");
const { anuncios } = require("./assessoria-copy.js");

const T = process.env.NEXUS_ADS_TOKEN;
const ACT = "act_945463391448600";
const PAGE = "1512388375281177";
const IG = "17841439718181335";
const WHATS = "554731804984";
const B = "https://graph.facebook.com/v21.0/";
const ORC = { odonto: 30, harmonizacao: 30, estetica: 30 }; // R$/dia por conjunto (rascunho; só vale quando o usuário ativar)
const FIM = "2026-12-31T23:59:00-0300";
const idsFile = path.join(__dirname, "assessoria-ids.json");
const ids = fs.existsSync(idsFile) ? JSON.parse(fs.readFileSync(idsFile, "utf8")) : { imagens: {}, conjuntos: {}, criativos: {}, anuncios: {} };
const salvar = () => fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2));
const limite = process.argv.includes("--limite") ? Number(process.argv[process.argv.indexOf("--limite") + 1]) : Infinity;

async function graph(p, body, multipart, tent = 0) {
  const opts = multipart ? { method: "POST", body: multipart } : { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.fromEntries(Object.entries({ ...body, access_token: T }).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]))) };
  const r = await (await fetch(B + p, opts)).json();
  if (r.error && r.error.code === 17 && tent < 15) { console.log("  limite da API; aguardando 60s"); await new Promise((x) => setTimeout(x, 60000)); return graph(p, body, multipart, tent + 1); }
  if (r.error) throw new Error(`${p}: ${r.error.message}${r.error.error_user_msg ? " | " + r.error.error_user_msg : ""}`);
  return r;
}

async function subirImagem(arquivo) {
  if (ids.imagens[arquivo]) return ids.imagens[arquivo];
  const fd = new FormData();
  fd.append("access_token", T);
  fd.append("filename", new Blob([fs.readFileSync(arquivo)], { type: "image/png" }), path.basename(arquivo));
  const r = await graph(`${ACT}/adimages`, null, fd);
  ids.imagens[arquivo] = Object.values(r.images)[0].hash; salvar();
  return ids.imagens[arquivo];
}

// Público: igual ao já aplicado nos conjuntos de sites (aplicar-publico-nicho.js), Advantage+ desligado.
const geo = { geo_locations: { regions: [{ key: "459" }] }, excluded_geo_locations: { cities: [{ key: "243550" }, { key: "245903" }] }, publisher_platforms: ["facebook", "instagram"], targeting_automation: { advantage_audience: 0 } };
const I = (a) => a.map((id) => ({ id }));
const SAUDE = I(["6012903159383"]);
const PROF_ODONTO = { work_positions: I(["108768179146852", "108158462546495", "168991743113816", "117785311602404", "200504049960954"]), education_majors: I(["1598512447053454", "108158462546495", "102052789875593"]), industries: SAUDE };
const PROF_HARM = { work_positions: I(["176835319023033", "849932375045036", "613039548827558", "143806268976956", "108768179146852", "168991743113816"]), education_majors: I(["106103479421761", "255204301335523", "1598512447053454"]), industries: SAUDE };
const LUXO = ["6007828099136", "6003011087019", "6003254590688", "6003227641778", "6003225930699"];
const ESTETICA = ["6003062618007", "6003088846792"];
const CONJ = {
  odonto: { nome: "Assessoria | Odontologia", t: { ...geo, age_min: 28, age_max: 60, flexible_spec: [PROF_ODONTO, { interests: I(LUXO) }] } },
  harmonizacao: { nome: "Assessoria | Harmonização", t: { ...geo, age_min: 25, age_max: 50, genders: [2], flexible_spec: [PROF_HARM, { interests: I([...LUXO, ...ESTETICA]) }] } },
  estetica: { nome: "Assessoria | Estética", t: { ...geo, age_min: 25, age_max: 55, genders: [2], flexible_spec: [PROF_HARM, { interests: I([...LUXO, ...ESTETICA]) }] } },
};

(async () => {
  if (!ids.campanha) {
    const c = await graph(`${ACT}/campaigns`, { name: "Nexus Assessoria | Black Nov+Dez", objective: "OUTCOME_ENGAGEMENT", special_ad_categories: [], status: "PAUSED", buying_type: "AUCTION", is_adset_budget_sharing_enabled: false });
    ids.campanha = c.id; salvar(); console.log("campanha", c.id);
  }
  for (const [k, c] of Object.entries(CONJ)) {
    if (ids.conjuntos[k]) continue;
    const r = await graph(`${ACT}/adsets`, {
      name: `Nexus SC | ${c.nome}`, campaign_id: ids.campanha, status: "PAUSED", daily_budget: String(ORC[k] * 100),
      billing_event: "IMPRESSIONS", optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      promoted_object: { page_id: PAGE, whatsapp_phone_number: WHATS }, targeting: c.t,
      regional_regulation_identities: { universal_beneficiary: "599219759208171", universal_payer: "599219759208171" },
      start_time: new Date().toISOString(), end_time: FIM,
    });
    ids.conjuntos[k] = r.id; salvar(); console.log("conjunto", k, r.id);
  }
  let n = 0;
  for (const a of anuncios) {
    if (ids.anuncios[a.arquivo]) continue;
    if (n++ >= limite) break;
    const nome = `${a.conjunto} | ${path.basename(a.arquivo, ".png")}`;
    const hash = await subirImagem(a.arquivo);
    const link = `https://api.whatsapp.com/send?phone=${WHATS}`;
    const cta = { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } };
    const oss = { page_id: PAGE, instagram_user_id: IG, link_data: { image_hash: hash, link, message: a.texto, name: a.titulo, description: a.descricao, call_to_action: cta } };
    let cr;
    try { cr = await graph(`${ACT}/adcreatives`, { name: nome, object_story_spec: oss }); }
    catch (e) { if (/instagram/i.test(e.message)) { delete oss.instagram_user_id; cr = await graph(`${ACT}/adcreatives`, { name: nome, object_story_spec: oss }); } else throw e; }
    ids.criativos[a.arquivo] = cr.id;
    const ad = await graph(`${ACT}/ads`, { name: nome, adset_id: ids.conjuntos[a.conjunto], creative: { creative_id: cr.id }, status: "PAUSED" });
    ids.anuncios[a.arquivo] = ad.id; salvar();
    console.log("anúncio", nome, ad.id);
  }
  console.log("fim. anúncios:", Object.keys(ids.anuncios).length, "/", anuncios.length);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
