// Cria e PUBLICA, na WABA do Nexus (2241797536694166), o WhatsApp Flow de qualificação (nome, cargo, clínica) — flows/nexus-qualificacao.json.
// Usa o token do usuário de sistema (NEXUS_ADS_TOKEN, tem whatsapp_business_management). Só a WABA do Nexus: não toca em Felizcred/Cota Certa/Especitá.
// Uso: node --env-file=.env scripts/nexus-criar-flow.js     Imprime o flow id (guardar no nó 'formulario' do fluxo 5 — ver nexus-anuncios/fluxo-formulario.js)
const fs = require("fs");
const path = require("path");
const WABA = "2241797536694166";
const T = process.env.NEXUS_ADS_TOKEN;
(async () => {
  const json = fs.readFileSync(path.join(__dirname, "..", "flows", "nexus-qualificacao.json"), "utf8");
  const fd = new FormData();
  fd.append("access_token", T);
  fd.append("name", "Nexus - Qualificação (nome, cargo, clínica)");
  fd.append("categories", JSON.stringify(["LEAD_GENERATION"]));
  fd.append("flow_json", json);
  fd.append("publish", "true");
  const r = await (await fetch(`https://graph.facebook.com/v21.0/${WABA}/flows`, { method: "POST", body: fd })).json();
  console.log(JSON.stringify(r, null, 2));
  if (r.error) process.exit(1);
})();
