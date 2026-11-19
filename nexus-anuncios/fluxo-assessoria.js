// 19/11/2026: fluxo dinâmico 5 do Nexus passa a qualificar para a ASSESSORIA de marketing (anúncios "30 dias de integração + criação de campanhas grátis").
// Tom simpático e curto, 3 perguntas: (1) área [filtro: já existia] (2) como os pacientes chegam hoje (3) o que mais quer agora.
// No fim: tag Quente + pipeline em_atendimento (aparece nos Avisos do painel) e mensagem de "já te respondo".
// Uso: node nexus-anuncios/fluxo-assessoria.js   (lê TURSO_* de .env; idempotente: não roda 2x). Os nós antigos (site) ficam no banco, só deixam de ser usados.
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const BN = "1512976205221650", F = 5, INICIAL = 24, APOS_AREA = [25, 27], TAG_QUENTE = "17";
const agora = () => Date.now();
const no = async (tipo, texto, acao_tipo, acao_valor, proximo) => Number((await c.execute({ sql: "INSERT INTO fluxo_nos (fluxo_id,tipo,texto,acao_tipo,acao_valor,proximo_no_id,created_at) VALUES (?,?,?,?,?,?,?)", args: [F, tipo, texto, acao_tipo, acao_valor, proximo, agora()] })).lastInsertRowid);
const tag = async (nome, cor) => String(Number((await c.execute({ sql: "INSERT INTO tags (business_number_id,nome,cor,created_at) VALUES (?,?,?,?)", args: [BN, nome, cor, agora()] })).lastInsertRowid));
const opc = (no_id, botao_id, titulo, prox) => c.execute({ sql: "INSERT INTO fluxo_opcoes (no_id,botao_id,botao_titulo,proximo_no_id) VALUES (?,?,?,?)", args: [no_id, botao_id, titulo, prox] });
(async () => {
  if ((await c.execute({ sql: "SELECT 1 FROM tags WHERE business_number_id=? AND nome='Chega por indicação'", args: [BN] })).rows.length) { console.log("já aplicado"); return; }
  // backup do que vai ser alterado
  const bk = { nos: (await c.execute("SELECT * FROM fluxo_nos WHERE id IN (24,25,27)")).rows, opcoes: (await c.execute("SELECT * FROM fluxo_opcoes WHERE no_id=24")).rows };
  fs.writeFileSync(path.join(__dirname, "fluxo-assessoria-backup.json"), JSON.stringify(bk, (k, v) => (typeof v === "bigint" ? Number(v) : v), 2));

  const tInd = await tag("Chega por indicação", "#F59E0B"), tRedes = await tag("Chega por redes sociais", "#8B5CF6"), tAnun = await tag("Já anuncia", "#10B981");
  const tPac = await tag("Quer mais pacientes", "#EF4444"), tOrg = await tag("Quer organizar contatos", "#3B82F6"), tMarca = await tag("Quer fortalecer a marca", "#EC4899");

  // fim: tag Quente -> pipeline em_atendimento -> mensagem final
  const fim = await no("mensagem", "Perfeito, obrigado por me contar! 🙌\n\nVou olhar o seu caso com carinho e já te respondo por aqui para combinarmos os próximos passos.\n\nEnquanto isso, se quiser adiantar, me diga o *nome da clínica* e a *cidade*. 😊", null, null, null);
  const pipe = await no("acao", null, "pipeline", "em_atendimento", fim);
  const quente = await no("acao", null, "tag", TAG_QUENTE, pipe);
  // pergunta 3
  const q3 = await no("mensagem", "Entendi! 💛 E o que você mais gostaria de resolver agora?", null, null, null);
  const a3 = {}; for (const [k, t] of [["pac", tPac], ["org", tOrg], ["marca", tMarca]]) a3[k] = await no("acao", null, "tag", t, quente);
  await opc(q3, "nx_o_pac", "Mais pacientes", a3.pac); await opc(q3, "nx_o_org", "Organizar contatos", a3.org); await opc(q3, "nx_o_marca", "Fortalecer a marca", a3.marca);
  // pergunta 2
  const q2 = await no("mensagem", "Que bom! 😊 E hoje, como os pacientes costumam chegar até a sua clínica?", null, null, null);
  const a2 = {}; for (const [k, t] of [["ind", tInd], ["redes", tRedes], ["anun", tAnun]]) a2[k] = await no("acao", null, "tag", t, q3);
  await opc(q2, "nx_c_ind", "Por indicação", a2.ind); await opc(q2, "nx_c_redes", "Redes sociais", a2.redes); await opc(q2, "nx_c_anun", "Anúncios pagos", a2.anun);
  // após a área (Odonto/Harmonização-Estética/Outra área com clínica) vai para a pergunta 2
  for (const id of APOS_AREA) await c.execute({ sql: "UPDATE fluxo_nos SET proximo_no_id=? WHERE id=?", args: [q2, id] });
  // boas-vindas (pergunta 1)
  await c.execute({ sql: "UPDATE fluxo_nos SET texto=? WHERE id=?", args: ["Oi! 👋 Aqui é o Felipe, da *Nexus*. Que bom ter você por aqui!\n\nA gente cuida do marketing de clínicas odontológicas, de harmonização e de estética. E neste Black Novembro + Dezembro, os primeiros *30 dias de integração e a criação das campanhas são por nossa conta*. 🎁\n\nPra eu te atender direitinho, me conta: qual é a sua área?", INICIAL] });
  console.log("ok", { q2, q3, quente, pipe, fim });
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
