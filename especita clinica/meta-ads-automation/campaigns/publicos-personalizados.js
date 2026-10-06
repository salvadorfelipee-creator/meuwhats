// Públicos personalizados de engajamento do Instagram — não existiam ainda na conta
// (achei 100 públicos da agência anterior, mas nenhum de engajamento IG com o
// instagram_user_id atual de @clinicaespecita, 17841400550057579). Sintaxe confirmada
// testando contra públicos antigos reais da própria conta (ver achados em CLAUDE.md).
//
// Uso: node --env-file=.env campaigns/publicos-personalizados.js

import { graphRequest } from "../lib/metaMarketingApi.js";

const IG_BUSINESS_ID = "17841400550057579"; // @clinicaespecita

function regraEngajamentoIG(evento, retentionDias) {
  return {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ type: "ig_business", id: Number(IG_BUSINESS_ID) }],
          retention_seconds: retentionDias * 24 * 60 * 60,
          filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: evento }] },
        },
      ],
    },
  };
}

const PUBLICOS = [
  {
    name: "ESP - ENG Instagram 365 dias",
    rule: regraEngajamentoIG("ig_business_profile_engaged", 365),
    descricao: "Quem interagiu com @clinicaespecita (curtiu, comentou, salvou, clicou) nos últimos 365 dias",
  },
  {
    name: "ESP - MSG Instagram 365 dias",
    rule: regraEngajamentoIG("ig_business_profile_user_messaged", 365),
    descricao: "Quem mandou mensagem pro Instagram da clínica nos últimos 365 dias",
  },
];

async function main() {
  for (const publico of PUBLICOS) {
    try {
      const r = await graphRequest("POST", `act_${process.env.META_AD_ACCOUNT_ID}/customaudiences`, {
        name: publico.name,
        subtype: "ENGAGEMENT",
        rule: JSON.stringify(publico.rule),
        description: publico.descricao,
      });
      console.log(`Criado: ${publico.name} (${r.id})`);
    } catch (err) {
      console.error(`Erro em "${publico.name}": ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
