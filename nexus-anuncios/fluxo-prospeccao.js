// 19/11/2026: fluxo "Nexus - prospecção ativa" — quem RESPONDE aos templates inicio_bom_dia / inicio_boa_tarde.
// Proposta (botões) -> formulário nome/cargo/clínica -> 3 perguntas (problema, agência, automação) -> encerramento + aviso interno.
// Saídas: "Agora não" (sem interesse + não mensagear de novo), texto livre (chama o Felipe e pausa o robô), "Parar"/"Sair" (descadastra).
// Fica INATIVO de propósito (o fluxo ativo do número é o dos anúncios). Para usar: no painel, "Campanha" -> conectar a este fluxo,
// ou no contato: "Reabrir fluxo" e escolher este fluxo. Uso: node nexus-anuncios/fluxo-prospeccao.js (idempotente).
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const BN = "1512976205221650", NOME = "Nexus - prospecção ativa", FLOW_ID = "1896347024686913";
const agora = () => Date.now();
const num = (r) => Number(r.lastInsertRowid);
(async () => {
  if ((await c.execute({ sql: "SELECT id FROM fluxos_dinamicos WHERE business_id=? AND nome=?", args: [BN, NOME] })).rows[0]) { console.log("já existe"); return; }
  const tag = async (nome, cor) => {
    const r = (await c.execute({ sql: "SELECT id FROM tags WHERE business_number_id=? AND nome=? COLLATE NOCASE", args: [BN, nome] })).rows[0];
    if (r) return String(r.id);
    return String(num(await c.execute({ sql: "INSERT INTO tags (business_number_id,nome,cor,created_at) VALUES (?,?,?,?)", args: [BN, nome, cor, agora()] })));
  };
  const tSem = await tag("Sem interesse", "#6B7280"), tQual = await tag("Lead qualificado", "#15803D"), tPros = await tag("Prospecção ativa", "#EA580C");
  const F = num(await c.execute({ sql: "INSERT INTO fluxos_dinamicos (business_id,nome,ativo,created_at) VALUES (?,?,0,?)", args: [BN, NOME, agora()] }));
  const no = async (tipo, texto, acao_tipo, acao_valor, proximo) => num(await c.execute({ sql: "INSERT INTO fluxo_nos (fluxo_id,tipo,texto,acao_tipo,acao_valor,proximo_no_id,created_at) VALUES (?,?,?,?,?,?,?)", args: [F, tipo, texto, acao_tipo || null, acao_valor || null, proximo || null, agora()] }));
  const op = (n, id, t, prox) => c.execute({ sql: "INSERT INTO fluxo_opcoes (no_id,botao_id,botao_titulo,proximo_no_id) VALUES (?,?,?,?)", args: [n, id, t, prox] });
  const HUMANO = "chamar_humano"; // texto livre neste nó => "vou chamar o Felipe" + pausa o robô

  // Etapa 3 (encerramento) + aviso interno
  const fim = await no("mensagem", "Ótimo! Agora é só aguardar o nosso atendimento, por favor. 🙌");
  const aviso = await no("acao", null, "aviso_lead", null, fim);
  const qual = await no("acao", null, "tag", tQual, aviso);
  // Q4 automação
  const q4 = await no("mensagem", "Vocês têm sistema de automação e qualificação de leads?", HUMANO);
  for (const [id, t] of [["nxp_a_sim", "Sim"], ["nxp_a_nao", "Não"]]) await op(q4, id, t, await no("acao", null, "campo", `Automação|${t}`, qual));
  // Q3 agência
  const q3 = await no("mensagem", "Vocês têm agência de marketing ou fazem por conta própria?", HUMANO);
  for (const [id, t] of [["nxp_m_ag", "Tenho agência"], ["nxp_m_pro", "Faço por conta"]]) await op(q3, id, t, await no("acao", null, "campo", `Marketing|${t}`, q4));
  // Q2 problema
  const q2 = await no("mensagem", "Hoje, qual é o principal problema dos leads que chegam de forma orgânica (Google, Instagram e anúncios)?", HUMANO);
  for (const [id, t] of [["nxp_p_param", "Respondem e param"], ["nxp_p_falt", "Agendam e faltam"], ["nxp_p_pouco", "Poucos leads"]]) await op(q2, id, t, await no("acao", null, "campo", `Problema com leads|${t}`, q3));
  // Formulário (Flow já publicado: nome, cargo em lista, clínica)
  const form = await no("formulario", "Ótimo! Para começar, preencha rapidinho:", "flow", FLOW_ID, q2);
  // Saída "Agora não"
  const bye = await no("mensagem", "Sem problema, obrigado pela atenção! Se mudar de ideia, é só responder aqui.", "bloquear");
  const byePipe = await no("acao", null, "pipeline", "perdido", bye);
  const byeTag = await no("acao", null, "tag", tSem, byePipe);
  // "Sim": marca a origem e abre o formulário
  const simTag = await no("acao", null, "tag", tPros, form);
  // Etapa 1: proposta. Texto original confirmado pelo dono (19/11): a Nexus de fato olha a presença da clínica.
  const ini = await no("mensagem", "Que bom falar com você! 😊\n\nMuitas clínicas perdem pacientes por detalhes simples na presença no Google, e dá para corrigir.\n\nPosso te conectar com um especialista da Nexus para conversar sobre isso?", HUMANO);
  await op(ini, "nxp_sim", "Sim, quero a análise", simTag);
  await op(ini, "nxp_nao", "Agora não", byeTag);
  await c.execute({ sql: "UPDATE fluxos_dinamicos SET no_inicial_id=? WHERE id=?", args: [ini, F] });
  console.log("fluxo", F, "nó inicial", ini, "(inativo)");
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
