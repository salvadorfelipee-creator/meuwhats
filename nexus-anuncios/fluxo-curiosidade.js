// 23/11/2026: fluxo "Nexus - curiosidade" — quem RESPONDE aos templates inicio_bom_dia / inicio_boa_tarde.
// Em vez de propor algo, desperta curiosidade: "tem um detalhe que quase ninguém percebe..." com 3 botões:
//   Quero ver -> 1 pergunta (origem dos pacientes) -> encerramento + aviso interno (Felipe assume)
//   Indicar o contato -> pede nome/WhatsApp do responsável (texto livre chama o Felipe e pausa o robô)
//   Agora não -> sem interesse, sem novas mensagens
// Fica INATIVO (o ativo do número é o dos anúncios); entra pela Campanha (fluxoId) ou "Reabrir fluxo".
// Uso: node nexus-anuncios/fluxo-curiosidade.js (idempotente).
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const BN = "1512976205221650", NOME = "Nexus - curiosidade";
const agora = () => Date.now();
const num = (r) => Number(r.lastInsertRowid);
(async () => {
  const ja = (await c.execute({ sql: "SELECT id FROM fluxos_dinamicos WHERE business_id=? AND nome=?", args: [BN, NOME] })).rows[0];
  if (ja) { console.log("já existe, id", ja.id); return; }
  const tag = async (nome, cor) => {
    const r = (await c.execute({ sql: "SELECT id FROM tags WHERE business_number_id=? AND nome=? COLLATE NOCASE", args: [BN, nome] })).rows[0];
    if (r) return String(r.id);
    return String(num(await c.execute({ sql: "INSERT INTO tags (business_number_id,nome,cor,created_at) VALUES (?,?,?,?)", args: [BN, nome, cor, agora()] })));
  };
  const tSem = await tag("Sem interesse", "#6B7280"), tQual = await tag("Lead qualificado", "#15803D"), tPros = await tag("Prospecção ativa", "#EA580C"), tInd = await tag("Indicou responsável", "#2563EB");
  const F = num(await c.execute({ sql: "INSERT INTO fluxos_dinamicos (business_id,nome,ativo,created_at) VALUES (?,?,0,?)", args: [BN, NOME, agora()] }));
  const no = async (tipo, texto, acao_tipo, acao_valor, proximo) => num(await c.execute({ sql: "INSERT INTO fluxo_nos (fluxo_id,tipo,texto,acao_tipo,acao_valor,proximo_no_id,created_at) VALUES (?,?,?,?,?,?,?)", args: [F, tipo, texto, acao_tipo || null, acao_valor || null, proximo || null, agora()] }));
  const op = (n, id, t, prox) => c.execute({ sql: "INSERT INTO fluxo_opcoes (no_id,botao_id,botao_titulo,proximo_no_id) VALUES (?,?,?,?)", args: [n, id, t, prox] });
  const HUMANO = "chamar_humano"; // texto livre neste nó => "vou chamar o Felipe" + pausa o robô

  // Encerramento + aviso interno
  const fim = await no("mensagem", "Entendi! Isso muda o que eu vou te mostrar. Vou separar o que encontrei e o Felipe te envia por aqui. 🙌");
  const aviso = await no("acao", null, "aviso_lead", null, fim);
  const qual = await no("acao", null, "tag", tQual, aviso);

  // "Quero ver": uma pergunta rápida
  const q = await no("mensagem", "Combinado! Antes, uma pergunta rápida pra eu te mostrar certo: hoje a maioria dos seus pacientes chega por qual caminho?", HUMANO);
  for (const [id, t] of [["nxc_o_ind", "Indicação"], ["nxc_o_ins", "Instagram"], ["nxc_o_goo", "Google"]]) await op(q, id, t, await no("acao", null, "campo", `Origem dos pacientes|${t}`, qual));
  const verTag = await no("acao", null, "tag", tPros, q);

  // "Indicar o contato": pede o responsável; texto livre chama o Felipe
  const indMsg = await no("mensagem", "Perfeito! Me passa o nome e o WhatsApp da pessoa responsável pelo marketing da clínica que eu falo direto com ela. 🙏", HUMANO);
  const indTag = await no("acao", null, "tag", tInd, indMsg);

  // "Agora não"
  const bye = await no("mensagem", "Sem problema, obrigado pela atenção! Se mudar de ideia, é só responder aqui.", "bloquear");
  const byePipe = await no("acao", null, "pipeline", "perdido", bye);
  const byeTag = await no("acao", null, "tag", tSem, byePipe);

  // Primeira mensagem (quando a pessoa responde ao template)
  const ini = await no("mensagem", "Que bom! 😊 Dei uma olhada em como a presença {{da_clinica}} aparece quando alguém pesquisa o seu procedimento principal em Joinville.\n\nTem um detalhe que quase ninguém percebe e faz o paciente escolher outra clínica em vez da sua.\n\nSe você quiser ver, ou preferir indicar o contato da pessoa responsável, a gente explica. 👇", HUMANO);
  await op(ini, "nxc_ver", "Quero ver", verTag);
  await op(ini, "nxc_ind", "Indicar o contato", indTag);
  await op(ini, "nxc_nao", "Agora não", byeTag);
  await c.execute({ sql: "UPDATE fluxos_dinamicos SET no_inicial_id=? WHERE id=?", args: [ini, F] });
  console.log("fluxo", F, "nó inicial", ini, "(inativo)");
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
