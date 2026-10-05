// Wrapper fino em cima da Graph API (Marketing API) do Meta — sem dependências externas.
// Rodar sempre com `node --env-file=.env ...` (Node 20+) pra carregar as variáveis.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

function graphVersion() {
  return process.env.META_GRAPH_VERSION || "v23.0";
}

function graphBase() {
  return `https://graph.facebook.com/${graphVersion()}`;
}

async function graphRequest(method, path, body = {}) {
  const token = requireEnv("META_SYSTEM_USER_TOKEN");
  const url = `${graphBase()}/${path}`;

  let res;
  if (method === "GET") {
    const params = new URLSearchParams({ ...body, access_token: token });
    res = await fetch(`${url}?${params.toString()}`);
  } else {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      params.append(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    params.append("access_token", token);
    res = await fetch(url, { method, body: params });
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Erro Graph API em ${path}: ${JSON.stringify(data.error || data, null, 2)}`);
  }
  return data;
}

function adAccountId() {
  return requireEnv("META_AD_ACCOUNT_ID");
}

// --- Busca (pra achar a localização certa sem chutar ID) -----------------

async function searchGeoLocation(query, types = ["city"]) {
  return graphRequest("GET", "search", {
    type: "adgeolocation",
    location_types: types,
    q: query,
  });
}

// Acha a cidade certa em SC (evita pegar uma cidade de mesmo nome em outro estado)
async function findCitySC(name) {
  const result = await searchGeoLocation(name, ["city"]);
  const match = result.data.find((c) => c.type === "city" && c.region === "Santa Catarina" && c.country_code === "BR");
  if (!match) throw new Error(`Não achei "${name}, SC" na busca de localização do Meta.`);
  return match;
}

// Busca de interesse pra segmentação detalhada (só sugestão/Advantage+ desde 2025,
// não é mais filtro duro — ver especita clinica/plano-midia-2026-10/02-PUBLICOS-E-PERSONAS.md)
async function searchInterest(query) {
  const result = await graphRequest("GET", "search", {
    type: "adinterest",
    q: query,
    limit: 5,
  });
  return result.data;
}

// --- Criação -----------------------------------------------------------

async function createCampaign({ name, objective, status = "PAUSED", specialAdCategories = [] }) {
  return graphRequest("POST", `act_${adAccountId()}/campaigns`, {
    name,
    objective,
    status,
    special_ad_categories: specialAdCategories,
    // false: cada conjunto de anúncios controla o próprio orçamento (não é CBO/orçamento
    // de campanha compartilhado) — obrigatório informar desde a v26 da Graph API.
    is_adset_budget_sharing_enabled: false,
  });
}

async function createAdSet({
  name,
  campaignId,
  dailyBudgetCents,
  lifetimeBudgetCents,
  endTime,
  startTime,
  adsetSchedule,
  optimizationGoal,
  destinationType,
  promotedObject,
  targeting,
  status = "PAUSED",
  bidStrategy = "LOWEST_COST_WITHOUT_CAP",
}) {
  const body = {
    name,
    campaign_id: campaignId,
    billing_event: "IMPRESSIONS",
    optimization_goal: optimizationGoal,
    destination_type: destinationType,
    promoted_object: promotedObject,
    targeting,
    status,
    bid_strategy: bidStrategy,
  };

  if (adsetSchedule) {
    // Agendamento por horário (dayparting) só funciona com orçamento vitalício,
    // não com orçamento diário — ver docs oficiais do Meta.
    body.lifetime_budget = lifetimeBudgetCents;
    body.end_time = endTime;
    body.start_time = startTime;
    body.pacing_type = ["day_parting"];
    body.adset_schedule = adsetSchedule;
  } else {
    body.daily_budget = dailyBudgetCents;
  }

  return graphRequest("POST", `act_${adAccountId()}/adsets`, body);
}

async function uploadImage(filePath) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const bytes = await fs.readFile(filePath);
  const token = requireEnv("META_SYSTEM_USER_TOKEN");

  const form = new FormData();
  form.append("access_token", token);
  form.append(path.basename(filePath), new Blob([bytes]), path.basename(filePath));

  const res = await fetch(`${graphBase()}/act_${adAccountId()}/adimages`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Erro ao subir imagem: ${JSON.stringify(data.error || data, null, 2)}`);
  }
  // Resposta vem como { images: { "<nome-do-arquivo>": { hash, url, ... } } }
  const entry = Object.values(data.images)[0];
  return entry.hash;
}

async function createAdCreative({ name, pageId, imageHash, headline, primaryText, description, welcomeMessage }) {
  const linkData = {
    name: headline,
    message: primaryText,
    description,
    image_hash: imageHash,
    link: "https://api.whatsapp.com/send",
    call_to_action: {
      type: "WHATSAPP_MESSAGE",
      value: { app_destination: "WHATSAPP" },
    },
  };

  if (welcomeMessage) {
    linkData.page_welcome_message = {
      type: "VISUAL_EDITOR",
      version: 2,
      landing_screen_type: "welcome_message",
      media_type: "text",
      text_format: {
        customer_action_type: "autofill_message",
        message: {
          text: welcomeMessage.greeting,
          autofill_message: { content: welcomeMessage.autofill },
        },
      },
    };
  }

  return graphRequest("POST", `act_${adAccountId()}/adcreatives`, {
    name,
    object_story_spec: { page_id: pageId, link_data: linkData },
  });
}

async function createAd({ name, adSetId, creativeId, status = "PAUSED" }) {
  return graphRequest("POST", `act_${adAccountId()}/ads`, {
    name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status,
  });
}

export {
  graphRequest,
  searchGeoLocation,
  findCitySC,
  searchInterest,
  createCampaign,
  createAdSet,
  uploadImage,
  createAdCreative,
  createAd,
};
