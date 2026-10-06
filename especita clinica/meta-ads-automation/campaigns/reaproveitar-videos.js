// Reaproveita os 2 vídeos que já rodam (botox/bioestimulador e ortodontia infantil —
// ambos JÁ publicados no Instagram, ver instagram_permalink_url) como anúncio nos
// conjuntos novos, trocando só o destino: formulário → clique direto pro WhatsApp.
// Não sobe vídeo de novo (usa o video_id que já existe), não mexe nos anúncios
// originais (que continuam rodando como estão).
//
// Uso:
//   node --env-file=.env campaigns/reaproveitar-videos.js              → dry-run
//   node --env-file=.env campaigns/reaproveitar-videos.js --execute     → cria de verdade (pausado)

import { createAdCreativeDeVideo, createAd } from "../lib/metaMarketingApi.js";

const execute = process.argv.includes("--execute");
const PAGE_ID = process.env.META_PAGE_ID;
const INSTAGRAM_USER_ID = "17841400550057579"; // @clinicaespecita

const REUSOS = [
  {
    adSetId: "120253288583120415", // ESP - Harmonização Facial - Harmonização facial - geral
    videoId: "4532430747086575",
    thumbnailHash: "1696ce159f4861dd88cac22726765b9e",
    nome: "ESP - Harmonização Facial - Bioestimulador (vídeo reaproveitado)",
    headline: "Bioestimulador de colágeno em Brusque",
    primaryText:
      "Sua pele perdeu firmeza? O bioestimulador de colágeno é um dos procedimentos de " +
      "Harmonização Orofacial da Dra. Catiucia (CRO-SC 14067, habilitação EPAO 4417). Fale no " +
      "WhatsApp e agende sua avaliação.",
    welcomeMessage: {
      greeting: "Olá! Vi o vídeo sobre bioestimulador de colágeno da Especitá 💉",
      autofill: "Olá! Vi o vídeo sobre bioestimulador de colágeno da Especitá e quero saber mais.",
    },
  },
  {
    adSetId: "120253288580790415", // ESP - Ortodontia - Aparelho fixo - pais
    videoId: "1702325897743070",
    thumbnailHash: "9a6fa9d55bdb9598164235964e15a72b",
    nome: "ESP - Ortodontia - Avaliação infantil (vídeo reaproveitado)",
    headline: "Avaliação ortodôntica infantil em Brusque",
    primaryText:
      "Seu filho range os dentes, morde torto ou já ouviu que vai precisar de aparelho? A Dra. " +
      "Catiucia (CRO-SC 14067) faz a avaliação ortodôntica em Brusque. Fale no WhatsApp.",
    welcomeMessage: {
      greeting: "Olá! Vi o vídeo sobre avaliação ortodôntica infantil da Especitá 🦷",
      autofill: "Olá! Vi o vídeo sobre avaliação ortodôntica infantil da Especitá e quero saber mais.",
    },
  },
];

async function main() {
  console.log(execute ? "Modo: EXECUÇÃO (cria de verdade, tudo PAUSADO)" : "Modo: DRY-RUN");

  for (const item of REUSOS) {
    console.log(`\n=== ${item.nome} ===`);
    console.log(`Conjunto: ${item.adSetId} | Vídeo: ${item.videoId}`);
    console.log(`Headline: ${item.headline}`);
    console.log(`Texto: ${item.primaryText}`);

    if (!execute) {
      console.log("(dry-run: criativo/anúncio não criado)");
      continue;
    }

    const creative = await createAdCreativeDeVideo({
      name: item.nome,
      pageId: PAGE_ID,
      instagramUserId: INSTAGRAM_USER_ID,
      videoId: item.videoId,
      thumbnailHash: item.thumbnailHash,
      headline: item.headline,
      primaryText: item.primaryText,
      welcomeMessage: item.welcomeMessage,
    });
    console.log(`Criativo criado: ${creative.id}`);

    const ad = await createAd({
      name: item.nome,
      adSetId: item.adSetId,
      creativeId: creative.id,
      status: "PAUSED",
    });
    console.log(`Anúncio criado (PAUSADO): ${ad.id}`);
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
