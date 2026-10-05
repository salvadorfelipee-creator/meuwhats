// Lista o que está rodando de verdade na conta agora (campanhas, conjuntos e
// anúncios com effective_status ACTIVE) — rodar antes de criar qualquer coisa
// nova, pra não duplicar ou conflitar com o que já está no ar.
//
// Uso: node --env-file=.env campaigns/listar-ativos.js

import { graphRequest } from "../lib/metaMarketingApi.js";

const adAccountId = process.env.META_AD_ACCOUNT_ID;

async function main() {
  const campaigns = await graphRequest("GET", `act_${adAccountId}/campaigns`, {
    fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget",
    limit: 200,
  });

  const active = campaigns.data.filter((c) => c.effective_status === "ACTIVE");
  const paused = campaigns.data.filter((c) => c.effective_status !== "ACTIVE");

  console.log(`\nTotal de campanhas na conta ${adAccountId}: ${campaigns.data.length}`);
  console.log(`Ativas agora: ${active.length} | Não ativas (pausadas/arquivadas/etc): ${paused.length}`);

  for (const campaign of active) {
    console.log(`\n=== ${campaign.name} (${campaign.id}) ===`);
    console.log(`Objetivo: ${campaign.objective} | Status: ${campaign.effective_status}`);
    if (campaign.daily_budget) console.log(`Orçamento diário: R$ ${(campaign.daily_budget / 100).toFixed(2)}`);
    if (campaign.lifetime_budget) console.log(`Orçamento total: R$ ${(campaign.lifetime_budget / 100).toFixed(2)}`);

    const adsets = await graphRequest("GET", `${campaign.id}/adsets`, {
      fields: "id,name,status,effective_status,daily_budget,optimization_goal,destination_type",
      limit: 200,
    });

    for (const adset of adsets.data) {
      console.log(`  Conjunto: ${adset.name} (${adset.effective_status})`);
      if (adset.daily_budget) console.log(`    Orçamento: R$ ${(adset.daily_budget / 100).toFixed(2)}/dia`);
      console.log(`    Otimização: ${adset.optimization_goal} | Destino: ${adset.destination_type || "-"}`);

      const ads = await graphRequest("GET", `${adset.id}/ads`, {
        fields: "id,name,effective_status",
        limit: 200,
      });
      for (const ad of ads.data) {
        console.log(`    Anúncio: ${ad.name} (${ad.effective_status})`);
      }
    }
  }

  if (paused.length) {
    console.log(`\n--- Não ativas (${paused.length}) ---`);
    for (const c of paused) {
      console.log(`  ${c.name} — ${c.effective_status}`);
    }
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
