// Campanha "Noivos" (Harmonização Orofacial) — ver especita clinica/CLAUDE.md,
// seção "Harmonização Orofacial — playbook completo".
//
// Rodar sempre em dry-run primeiro (padrão). Só cria/gasta de verdade com --execute,
// e mesmo assim fica tudo em status PAUSED — ninguém liga a campanha sem decisão
// explícita do Salvador/Dra. Catiucia.
//
// Uso:
//   node --env-file=.env campaigns/noivos.js                 → só mostra os payloads
//   node --env-file=.env campaigns/noivos.js --execute        → cria de verdade (pausado)
//   node --env-file=.env campaigns/noivos.js --execute --image caminho/foto.jpg
//       → além de campanha+conjunto, sobe a imagem e cria o anúncio (ainda pausado)

import {
  searchGeoLocation,
  createCampaign,
  createAdSet,
  uploadImage,
  createAdCreative,
  createAd,
} from "../lib/metaMarketingApi.js";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const imageArgIndex = args.indexOf("--image");
const imagePath = imageArgIndex >= 0 ? args[imageArgIndex + 1] : null;

const CAMPAIGN_NAME = "ESP - Harmonização - Noivos";
const DAILY_BUDGET_REAIS = 50;
const DAILY_BUDGET_CENTS = DAILY_BUDGET_REAIS * 100;

// Texto revisado pra não violar as regras de publicidade do CFO (Res. 196/2019 +
// 271/2025): sem preço, parcelamento, "grátis", promoção, garantia ou depoimento.
// AINDA ASSIM precisa de revisão da Dra. Catiucia antes de ativar de verdade.
const CREATIVE = {
  headline: "Harmonização Orofacial para noivos e noivas",
  primaryText:
    "Casamento chegando e você quer um sorriso e um rosto mais harmônicos, sem exagero? " +
    "A Dra. Catiucia (CRO-SC 14067, habilitada em Harmonização Orofacial) faz uma avaliação " +
    "personalizada em Brusque. Fale com a gente no WhatsApp.",
  description: "Avaliação personalizada com a Dra. Catiucia — Brusque/SC",
  welcomeMessage: {
    greeting: "Olá! Vi o anúncio de Harmonização Orofacial para noivos da Especitá 💍",
    autofill: "Olá! Vi o anúncio de Harmonização Orofacial para noivos da Especitá e quero saber mais.",
  },
};

function log(step, data) {
  console.log(`\n--- ${step} ---`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  console.log(execute ? "Modo: EXECUÇÃO (vai chamar a API de verdade, tudo PAUSADO)" : "Modo: DRY-RUN (nada é enviado pra API)");

  // 1) Localização — busca o ID certo de Brusque/SC em vez de chutar
  let geoKey = "<resolver com searchGeoLocation em modo --execute>";
  if (execute) {
    const geo = await searchGeoLocation("Brusque, Santa Catarina");
    const brusque = geo.data.find((item) => item.region === "Santa Catarina" || item.country_name === "Brazil");
    if (!brusque) throw new Error("Não encontrei Brusque/SC na busca de localização — conferir manualmente.");
    geoKey = brusque.key;
    log("Localização resolvida", brusque);
  }

  const targeting = {
    geo_locations: { cities: [{ key: geoKey, radius: 0 }] },
    age_min: 22,
    age_max: 45,
  };

  const campaignPayload = {
    name: CAMPAIGN_NAME,
    objective: "OUTCOME_ENGAGEMENT",
    status: "PAUSED",
    specialAdCategories: [],
  };
  log("Campanha (payload)", campaignPayload);

  let campaignId = "<id só existe em modo --execute>";
  if (execute) {
    const campaign = await createCampaign(campaignPayload);
    campaignId = campaign.id;
    console.log(`Campanha criada: ${campaignId}`);
  }

  const adSetPayload = {
    name: `${CAMPAIGN_NAME} - Conjunto 1`,
    campaignId,
    dailyBudgetCents: DAILY_BUDGET_CENTS,
    optimizationGoal: "CONVERSATIONS",
    destinationType: "WHATSAPP",
    promotedObject: {
      page_id: process.env.META_PAGE_ID,
      ...(process.env.META_WHATSAPP_PHONE_NUMBER
        ? { whatsapp_phone_number: process.env.META_WHATSAPP_PHONE_NUMBER }
        : {}),
    },
    targeting,
    status: "PAUSED",
  };
  log("Conjunto de anúncios (payload)", adSetPayload);

  let adSetId = "<id só existe em modo --execute>";
  if (execute) {
    const adSet = await createAdSet(adSetPayload);
    adSetId = adSet.id;
    console.log(`Conjunto de anúncios criado: ${adSetId}`);
  }

  log("Criativo (texto)", CREATIVE);

  if (!imagePath) {
    console.log(
      "\nSem --image informado: parando aqui. Campanha + conjunto ficam prontos (pausados), " +
        "falta só a imagem pra criar o criativo + anúncio. Rode de novo com --execute --image <caminho>."
    );
    return;
  }

  if (execute) {
    const imageHash = await uploadImage(imagePath);
    console.log(`Imagem enviada, hash: ${imageHash}`);

    const creative = await createAdCreative({
      name: `${CAMPAIGN_NAME} - Criativo 1`,
      pageId: process.env.META_PAGE_ID,
      imageHash,
      headline: CREATIVE.headline,
      primaryText: CREATIVE.primaryText,
      description: CREATIVE.description,
      welcomeMessage: CREATIVE.welcomeMessage,
    });
    console.log(`Criativo criado: ${creative.id}`);

    const ad = await createAd({
      name: `${CAMPAIGN_NAME} - Anúncio 1`,
      adSetId,
      creativeId: creative.id,
      status: "PAUSED",
    });
    console.log(`Anúncio criado (PAUSADO): ${ad.id}`);
    console.log("\nTudo pausado no Gerenciador de Anúncios — revisar e ligar manualmente quando aprovado.");
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
