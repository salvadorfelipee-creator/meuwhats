// Cria campanha + conjuntos de anúncios por produto (sem imagem/anúncio ainda —
// isso fica pra quando a imagem chegar). Tudo em status PAUSED, clique direto pro
// WhatsApp, horário seg-sex 7h-24h, público em Brusque + cidades vizinhas.
//
// Não mexe em nada que já está rodando (botox, ortodontia lead-form, post
// impulsionado) — só cria objetos novos.
//
// Uso:
//   node --env-file=.env campaigns/criar-conjuntos.js              → dry-run
//   node --env-file=.env campaigns/criar-conjuntos.js --execute     → cria de verdade (pausado)

import {
  findCitySC,
  createCampaign,
  createAdSet,
  graphRequest,
} from "../lib/metaMarketingApi.js";
import { PRODUTOS, CIDADES, HORARIO, ORCAMENTO_DIARIO_TESTE_REAIS, DIAS_CAMPANHA } from "./produtos.js";

const execute = process.argv.includes("--execute");
const PAGE_ID = process.env.META_PAGE_ID;

const PLACEMENTS = {
  publisher_platforms: ["facebook", "instagram"],
  facebook_positions: ["feed", "facebook_reels"],
  instagram_positions: ["stream", "story", "reels"],
};

function extractMinBudgetFromError(message) {
  const match = message.match(/R\$\s?([\d.,]+)/g);
  if (!match) return null;
  const values = match
    .map((m) => m.replace("R$", "").trim().replace(/\./g, "").replace(",", "."))
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (!values.length) return null;
  return Math.max(...values);
}

async function resolveCidades() {
  console.log("Resolvendo localização das cidades...");
  const resolved = [];
  for (const nome of CIDADES) {
    const cidade = await findCitySC(nome);
    console.log(`  ${nome} → ${cidade.key} (${cidade.name})`);
    resolved.push({ key: cidade.key });
  }
  return resolved;
}

// Busca automática de interesse (type=adinterest, 1 palavra) é frágil: pode pegar
// categoria errada/depreciada (ex.: "Odontologia" bateu numa universidade de Mianmar).
// Como a própria Meta trata interesse como só "sugestão" em campanha de mensagem desde
// 2025 (Advantage+ detailed targeting), não vale o risco — segmentação fica por
// localização + idade + gênero + horário + criativo, como o plano local já recomenda.

async function listarCampanhasExistentes() {
  const campaigns = await graphRequest("GET", `act_${process.env.META_AD_ACCOUNT_ID}/campaigns`, {
    fields: "id,name",
    limit: 500,
  });
  return new Map(campaigns.data.map((c) => [c.name, c.id]));
}

async function listarConjuntosExistentes(campaignId) {
  const adsets = await graphRequest("GET", `${campaignId}/adsets`, {
    fields: "id,name",
    limit: 500,
  });
  return new Map(adsets.data.map((a) => [a.name, a.id]));
}

async function criarConjuntoComRetry(payload, tentativa = 1) {
  try {
    return await createAdSet(payload);
  } catch (err) {
    const minimo = extractMinBudgetFromError(err.message);
    if (minimo && tentativa <= 3) {
      const novoDiario = Math.ceil(minimo / DIAS_CAMPANHA) + 1;
      console.log(`    Orçamento rejeitado como baixo demais, tentando com R$ ${novoDiario}/dia (tentativa ${tentativa + 1})...`);
      const novoLifetime = novoDiario * DIAS_CAMPANHA * 100;
      return criarConjuntoComRetry({ ...payload, lifetimeBudgetCents: novoLifetime }, tentativa + 1);
    }
    throw err;
  }
}

async function main() {
  console.log(execute ? "Modo: EXECUÇÃO (cria de verdade, tudo PAUSADO)" : "Modo: DRY-RUN (nada é enviado pra API)");

  let cidadesResolvidas = CIDADES.map((nome) => ({ key: `<resolver "${nome}" em --execute>` }));
  if (execute) {
    cidadesResolvidas = await resolveCidades();
  }

  const resumo = [];
  const campanhasExistentes = execute ? await listarCampanhasExistentes() : new Map();

  for (const produto of PRODUTOS) {
    console.log(`\n=== ${produto.campanha} ===`);

    let campaignId = "<id só existe em --execute>";
    let conjuntosExistentes = new Map();
    if (execute) {
      if (campanhasExistentes.has(produto.campanha)) {
        campaignId = campanhasExistentes.get(produto.campanha);
        console.log(`Campanha já existe, reaproveitando: ${campaignId}`);
      } else {
        const campaign = await createCampaign({
          name: produto.campanha,
          objective: "OUTCOME_ENGAGEMENT",
          status: "PAUSED",
          specialAdCategories: [],
        });
        campaignId = campaign.id;
        console.log(`Campanha criada: ${campaignId}`);
      }
      conjuntosExistentes = await listarConjuntosExistentes(campaignId);
    } else {
      console.log("(dry-run: campanha não criada)");
    }

    for (const conjunto of produto.conjuntos) {
      const nomeCompleto = `${produto.campanha} - ${conjunto.nome}`;
      console.log(`\n  --- Conjunto: ${conjunto.nome} ---`);

      if (execute && conjuntosExistentes.has(nomeCompleto)) {
        console.log(`  Já existe, pulando: ${conjuntosExistentes.get(nomeCompleto)}`);
        resumo.push({
          campanha: produto.campanha,
          conjunto: conjunto.nome,
          adSetId: conjuntosExistentes.get(nomeCompleto),
          campaignId,
          status: "já existia",
        });
        continue;
      }

      const targeting = {
        geo_locations: { cities: cidadesResolvidas },
        age_min: conjunto.idadeMin,
        age_max: conjunto.idadeMax,
        ...(conjunto.genero ? { genders: [conjunto.genero] } : {}),
        ...PLACEMENTS,
        // Advantage+ Audience (ligado por padrão em conjuntos de Mensagens) trava idade
        // mínima em até 25 anos e tenta expandir o público sozinho. Desligando, a
        // segmentação por idade/gênero que definimos no produto vale como restrição
        // dura de verdade — é o que cada produto pede (ex.: implante 45-65).
        targeting_automation: { advantage_audience: 0 },
      };

      const dailyEquivalent = ORCAMENTO_DIARIO_TESTE_REAIS;
      const lifetimeBudgetCents = dailyEquivalent * DIAS_CAMPANHA * 100;
      const now = new Date();
      const endTime = new Date(now.getTime() + DIAS_CAMPANHA * 24 * 60 * 60 * 1000);

      const payload = {
        name: `${produto.campanha} - ${conjunto.nome}`,
        campaignId,
        lifetimeBudgetCents,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        adsetSchedule: [HORARIO],
        optimizationGoal: "CONVERSATIONS",
        destinationType: "WHATSAPP",
        promotedObject: { page_id: PAGE_ID },
        targeting,
        status: "PAUSED",
      };

      console.log(`  Orçamento: R$ ${dailyEquivalent}/dia equivalente (R$ ${(lifetimeBudgetCents / 100).toFixed(2)} em ${DIAS_CAMPANHA} dias)`);
      console.log(`  Idade: ${conjunto.idadeMin}-${conjunto.idadeMax} | Gênero: ${conjunto.genero ? (conjunto.genero === 1 ? "homens" : "mulheres") : "todos"}`);
      console.log(`  Horário: seg-sex 7h-24h`);

      if (execute) {
        const adSet = await criarConjuntoComRetry(payload);
        console.log(`  Conjunto criado (PAUSADO): ${adSet.id}`);
        resumo.push({ campanha: produto.campanha, conjunto: conjunto.nome, adSetId: adSet.id, campaignId });
      } else {
        console.log("  (dry-run: conjunto não criado)");
      }
    }
  }

  if (execute) {
    console.log("\n\n=== Resumo ===");
    console.table(resumo);
    console.log(
      `\n${resumo.length} conjuntos criados, todos PAUSADOS. Falta: imagem + criativo + anúncio por conjunto ` +
        "(rodar campaigns/criar-anuncio.js quando as imagens chegarem)."
    );
  } else {
    console.log("\nRodar de novo com --execute pra criar de verdade (ainda pausado, sem gastar).");
  }
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exitCode = 1;
});
