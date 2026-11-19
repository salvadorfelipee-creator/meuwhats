// 19/11/2026: 1 anúncio (criativo "Campanhas certas para clínicas de estética") com público segmentado de HARMONIZAÇÃO,
// verba TOTAL de R$ 59 (lifetime), termina hoje às 21:00, mesma localização dos outros (SC exceto Balneário Camboriú e Brusque).
// Uso: node --env-file=.env nexus-anuncios/assessoria-teste-21h.js
const fs = require("fs");
const path = require("path");
const T = process.env.NEXUS_ADS_TOKEN, ACT = "act_945463391448600", PAGE = "1512388375281177", WHATS = "554731804984", B = "https://graph.facebook.com/v21.0/";
const idsFile = path.join(__dirname, "assessoria-ids.json");
const ids = JSON.parse(fs.readFileSync(idsFile, "utf8"));
const ARQ = "C:/Users/Salvador/Downloads/criativos assesoria de marketing/Campanhas certas para clínicas de estética.png";
const post = async (p, body) => {
  const r = await (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.fromEntries(Object.entries({ ...body, access_token: T }).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]))) })).json();
  if (r.error) throw new Error(`${p}: ${r.error.message}${r.error.error_user_msg ? " | " + r.error.error_user_msg : ""}`);
  return r;
};
const I = (a) => a.map((id) => ({ id }));
// mesmo público segmentado de Harmonização já usado em aplicar-publico-nicho.js
const PROF_HARM = { work_positions: I(["176835319023033", "849932375045036", "613039548827558", "143806268976956", "108768179146852", "168991743113816"]), education_majors: I(["106103479421761", "255204301335523", "1598512447053454"]), industries: I(["6012903159383"]) };
const LUXO = ["6007828099136", "6003011087019", "6003254590688", "6003227641778", "6003225930699"], ESTETICA = ["6003062618007", "6003088846792"];
const targeting = { geo_locations: { regions: [{ key: "459" }] }, excluded_geo_locations: { cities: [{ key: "243550" }, { key: "245903" }] }, publisher_platforms: ["facebook", "instagram"], targeting_automation: { advantage_audience: 0 }, age_min: 25, age_max: 50, genders: [2], flexible_spec: [PROF_HARM, { interests: I([...LUXO, ...ESTETICA]) }] };
(async () => {
  if (ids.teste21h) { console.log("já criado", ids.teste21h); return; }
  const cr = ids.criativos[ARQ];
  if (!cr) throw new Error("criativo não encontrado em assessoria-ids.json");
  const as = await post(`${ACT}/adsets`, {
    name: "Nexus SC | Assessoria | Harmonização segmentado | até 21h 19/11", campaign_id: ids.campanha, status: "ACTIVE", lifetime_budget: "5900",
    billing_event: "IMPRESSIONS", optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    promoted_object: { page_id: PAGE, whatsapp_phone_number: WHATS }, targeting,
    regional_regulation_identities: { universal_beneficiary: "599219759208171", universal_payer: "599219759208171" },
    start_time: new Date(Date.now() + 120000).toISOString(), end_time: "2026-11-19T21:00:00-0300",
  });
  const ad = await post(`${ACT}/ads`, { name: "harmonizacao-segmentado | Campanhas certas para clínicas de estética", adset_id: as.id, creative: { creative_id: cr }, status: "ACTIVE" });
  await post(ids.campanha, { status: "ACTIVE" }); // só o conjunto novo está ativo; os 3 conjuntos e 60 anúncios da assessoria seguem pausados
  ids.teste21h = { adset: as.id, ad: ad.id }; fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2));
  console.log("conjunto", as.id, "anúncio", ad.id);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
