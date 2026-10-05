// Detalha a campanha "[leads] form" (botox + ortodontia): em que posicionamento
// (Facebook/Instagram) ela roda e qual é o formulário instantâneo (perguntas,
// mensagem de agradecimento, link de privacidade) — tudo só leitura.
//
// Uso: node --env-file=.env campaigns/inspecionar-leads.js

import { graphRequest } from "../lib/metaMarketingApi.js";

const adAccountId = process.env.META_AD_ACCOUNT_ID;
const CAMPAIGN_ID = "120251391613830415"; // "[leads] form"

async function main() {
  const adsets = await graphRequest("GET", `${CAMPAIGN_ID}/adsets`, {
    fields:
      "id,name,effective_status,targeting{publisher_platforms,facebook_positions,instagram_positions,geo_locations,age_min,age_max,genders}",
    limit: 50,
  });

  for (const adset of adsets.data) {
    console.log(`\n=== Conjunto: ${adset.name} (${adset.id}) ===`);
    const t = adset.targeting || {};
    console.log(`Plataformas: ${(t.publisher_platforms || []).join(", ") || "(herdado/Advantage+)"}`);
    console.log(`Posições Facebook: ${(t.facebook_positions || []).join(", ") || "-"}`);
    console.log(`Posições Instagram: ${(t.instagram_positions || []).join(", ") || "-"}`);
    console.log(`Idade: ${t.age_min || "?"}-${t.age_max || "?"} | Gêneros: ${(t.genders || []).join(",") || "todos"}`);
    if (t.geo_locations) console.log(`Localização: ${JSON.stringify(t.geo_locations)}`);

    const ads = await graphRequest("GET", `${adset.id}/ads`, {
      fields: "id,name,effective_status,creative{id,object_story_spec,effective_object_story_id}",
      limit: 50,
    });

    for (const ad of ads.data) {
      console.log(`\n  --- Anúncio: ${ad.name} (${ad.effective_status}) ---`);
      const creative = ad.creative;
      if (!creative) {
        console.log("  (sem criativo associado)");
        continue;
      }
      const linkData = creative.object_story_spec?.link_data;
      const leadFormId = linkData?.lead_gen_form_id;
      console.log(`  Criativo: ${creative.id}`);
      if (linkData) {
        console.log(`  Headline: ${linkData.name || "-"}`);
        console.log(`  Texto: ${linkData.message || "-"}`);
        console.log(`  CTA: ${linkData.call_to_action?.type || "-"}`);
      }

      if (leadFormId) {
        const form = await graphRequest("GET", leadFormId, {
          fields: "name,status,questions,privacy_policy_url,follow_up_action_url,thank_you_page,locale",
        });
        console.log(`\n  Formulário instantâneo: "${form.name}" (${form.status})`);
        console.log(`  Perguntas:`);
        for (const q of form.questions || []) {
          console.log(`    - ${q.type}${q.label ? `: ${q.label}` : ""}`);
        }
        if (form.thank_you_page) {
          console.log(`  Página de agradecimento: ${form.thank_you_page.title || "-"} — ${form.thank_you_page.body || "-"}`);
          console.log(`  Botão: ${form.thank_you_page.button_text || "-"} → ${form.thank_you_page.button_url || "-"}`);
        }
        console.log(`  Política de privacidade: ${form.privacy_policy_url || "-"}`);
      } else {
        console.log("  (não achei lead_gen_form_id no object_story_spec — conferir manualmente no Gerenciador)");
      }
    }
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
