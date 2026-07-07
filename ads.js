const https = require("https");
const querystring = require("querystring");

const GRAPH_VERSION = "v21.0";
const ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // formato: act_XXXXXXXXX

function encodeParams(params) {
  const flat = {};
  for (const [key, value] of Object.entries(params || {})) {
    flat[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return querystring.stringify(flat);
}

function graphRequest(method, requestPath, params) {
  return new Promise((resolve, reject) => {
    const isGet = method === "GET";
    const body = !isGet ? encodeParams(params) : null;
    const path = isGet && params
      ? `${requestPath}?${encodeParams(params)}`
      : requestPath;

    const req = https.request(
      {
        method,
        hostname: "graph.facebook.com",
        path,
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json;
          try {
            json = JSON.parse(buf.toString("utf8") || "{}");
          } catch {
            json = { raw: buf.toString("utf8") };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function assertOk(promise, label) {
  const { status, json } = await promise;
  if (status >= 400) {
    throw new Error(`${label}: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

function criarCampanha({ nome, objetivo, categoriasEspeciais = [], status = "PAUSED" }) {
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/campaigns`, {
      name: nome,
      objective: objetivo,
      special_ad_categories: categoriasEspeciais,
      status,
    }),
    "Falha ao criar campanha"
  );
}

function criarConjuntoAnuncios({
  nome,
  campanhaId,
  orcamentoDiarioCentavos,
  orcamentoTotalCentavos, // orçamento total (lifetime) — exige inicio e fim
  inicio, // start_time ISO 8601, ex: "2026-07-06T18:00:00-03:00"
  fim, // end_time ISO 8601
  evento_cobranca = "IMPRESSIONS",
  meta_otimizacao = "LINK_CLICKS",
  destino, // destination_type, ex: "WHATSAPP"
  promotedObject, // ex: { page_id: "..." } para anúncios de WhatsApp
  targeting,
  status = "PAUSED",
}) {
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/adsets`, {
      name: nome,
      campaign_id: campanhaId,
      ...(orcamentoDiarioCentavos ? { daily_budget: orcamentoDiarioCentavos } : {}),
      ...(orcamentoTotalCentavos ? { lifetime_budget: orcamentoTotalCentavos } : {}),
      ...(inicio ? { start_time: inicio } : {}),
      ...(fim ? { end_time: fim } : {}),
      billing_event: evento_cobranca,
      optimization_goal: meta_otimizacao,
      ...(destino ? { destination_type: destino } : {}),
      ...(promotedObject ? { promoted_object: promotedObject } : {}),
      targeting,
      status,
    }),
    "Falha ao criar conjunto de anúncios"
  );
}

function criarCreativo({ nome, pageId, instagramActorId, mensagem, link, imageHash }) {
  const object_story_spec = {
    page_id: pageId,
    ...(instagramActorId ? { instagram_actor_id: instagramActorId } : {}),
    link_data: {
      message: mensagem,
      link,
      ...(imageHash ? { image_hash: imageHash } : {}),
    },
  };
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/adcreatives`, {
      name: nome,
      object_story_spec,
    }),
    "Falha ao criar criativo"
  );
}

// Criativo a partir de uma publicação já existente do Instagram (não sobe imagem nova).
// Exige o Instagram conectado à conta de anúncios (já feito — ver README).
function criarCreativoDePublicacaoInstagram({ nome, instagramMediaId, instagramUserId, callToAction }) {
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/adcreatives`, {
      name: nome,
      source_instagram_media_id: instagramMediaId,
      ...(instagramUserId ? { instagram_user_id: instagramUserId } : {}),
      ...(callToAction ? { call_to_action: callToAction } : {}),
    }),
    "Falha ao criar criativo da publicação do Instagram"
  );
}

function criarAnuncio({ nome, conjuntoId, creativoId, status = "PAUSED" }) {
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/ads`, {
      name: nome,
      adset_id: conjuntoId,
      creative: { creative_id: creativoId },
      status,
    }),
    "Falha ao criar anúncio"
  );
}

// Lista anúncios com o id do criativo de cada um — usado na receita "usuário cria 1
// anúncio no Gerenciador, API replica nos demais conjuntos" (ver README, seção Campanhas).
async function listarAnuncios() {
  const json = await assertOk(
    graphRequest("GET", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/ads`, {
      fields: "id,name,status,effective_status,adset_id,creative{id}",
      limit: 100,
    }),
    "Falha ao listar anúncios"
  );
  return json.data || [];
}

async function listarCampanhas() {
  const json = await assertOk(
    graphRequest("GET", `/${GRAPH_VERSION}/${AD_ACCOUNT_ID}/campaigns`, {
      fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time",
      limit: 100,
    }),
    "Falha ao listar campanhas"
  );
  return json.data || [];
}

async function listarConjuntos(campanhaId) {
  const json = await assertOk(
    graphRequest("GET", `/${GRAPH_VERSION}/${campanhaId}/adsets`, {
      fields: "id,name,status,effective_status,daily_budget,targeting",
    }),
    "Falha ao listar conjuntos de anúncios"
  );
  return json.data || [];
}

async function obterInsights(objectId, { since, until } = {}) {
  const params = {
    fields: "spend,impressions,clicks,ctr,cpc,reach,actions",
  };
  if (since && until) params.time_range = { since, until };
  const json = await assertOk(
    graphRequest("GET", `/${GRAPH_VERSION}/${objectId}/insights`, params),
    "Falha ao obter insights"
  );
  return json.data?.[0] || null;
}

function atualizarStatus(objectId, status) {
  return assertOk(
    graphRequest("POST", `/${GRAPH_VERSION}/${objectId}`, { status }),
    "Falha ao atualizar status"
  );
}

module.exports = {
  criarCampanha,
  criarConjuntoAnuncios,
  criarCreativo,
  criarCreativoDePublicacaoInstagram,
  criarAnuncio,
  listarAnuncios,
  listarCampanhas,
  listarConjuntos,
  obterInsights,
  atualizarStatus,
};
