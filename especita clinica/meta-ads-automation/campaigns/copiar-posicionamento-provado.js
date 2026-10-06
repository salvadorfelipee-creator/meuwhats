// Os 2 conjuntos ativos que já provaram resultado (botox/bioestimulador e ortodontia, ver
// CLAUDE.md) rodam só no Instagram — nunca testaram Facebook. Em vez de chutar Facebook+Instagram
// nos 2 conjuntos novos que reaproveitam esses vídeos, copia o posicionamento provado: só
// Instagram (feed + stories + reels). Idade/gênero/localização dos conjuntos novos ficam como
// estavam (são refinamento de público por produto, não o que foi "provado" — o que foi provado
// de verdade nos 90 dias é o posicionamento, já que os conjuntos ativos nunca testaram outra
// segmentação de idade/gênero pra comparar).
//
// Uso: node --env-file=.env campaigns/copiar-posicionamento-provado.js

import { graphRequest } from "../lib/metaMarketingApi.js";

const CONJUNTOS_ALVO = [
  { id: "120253288583120415", nome: "ESP - Harmonização Facial - Harmonização facial - geral" },
  { id: "120253288580790415", nome: "ESP - Ortodontia - Aparelho fixo - pais" },
];

const PLACEMENT_PROVADO = {
  publisher_platforms: ["instagram"],
  instagram_positions: ["stream", "story", "reels"],
};

async function main() {
  for (const conjunto of CONJUNTOS_ALVO) {
    const atual = await graphRequest("GET", conjunto.id, { fields: "targeting" });
    const targeting = { ...atual.targeting, ...PLACEMENT_PROVADO };
    delete targeting.facebook_positions; // não existe mais Facebook no mix

    await graphRequest("POST", conjunto.id, { targeting });
    console.log(`Atualizado: ${conjunto.nome} → posicionamento só Instagram (feed/stories/reels)`);
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
