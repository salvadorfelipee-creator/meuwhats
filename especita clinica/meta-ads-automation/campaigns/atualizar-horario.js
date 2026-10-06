// Estende o horário dos conjuntos novos de 7h-21h pra 7h-24h (seg-sex) — pedido do
// Salvador 05/10/2026: o atendimento automático (fluxo dinâmico do painel) cobre fora do
// horário humano, então não tem motivo pra cortar a campanha às 21h.
//
// Uso: node --env-file=.env campaigns/atualizar-horario.js

import { graphRequest } from "../lib/metaMarketingApi.js";
import { PRODUTOS } from "./produtos.js";

const NOVO_HORARIO = {
  days: [1, 2, 3, 4, 5],
  start_minute: 7 * 60,
  end_minute: 24 * 60,
  timezone_type: "USER",
};

async function listarCampanhasExistentes() {
  const campaigns = await graphRequest("GET", `act_${process.env.META_AD_ACCOUNT_ID}/campaigns`, {
    fields: "id,name",
    limit: 500,
  });
  return new Map(campaigns.data.map((c) => [c.name, c.id]));
}

async function main() {
  const campanhas = await listarCampanhasExistentes();
  let atualizados = 0;

  for (const produto of PRODUTOS) {
    const campaignId = campanhas.get(produto.campanha);
    if (!campaignId) {
      console.log(`Campanha "${produto.campanha}" não encontrada — pulando.`);
      continue;
    }

    const adsets = await graphRequest("GET", `${campaignId}/adsets`, {
      fields: "id,name",
      limit: 500,
    });

    for (const adset of adsets.data) {
      await graphRequest("POST", adset.id, {
        pacing_type: ["day_parting"],
        adset_schedule: [NOVO_HORARIO],
      });
      console.log(`Atualizado: ${adset.name} (${adset.id}) → seg-sex 7h-24h`);
      atualizados++;
    }
  }

  console.log(`\n${atualizados} conjuntos atualizados.`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
