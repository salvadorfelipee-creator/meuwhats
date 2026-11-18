// 18/11/2026: fluxo dinâmico 5 do Nexus passa a qualificar a área. Só odontologia/harmonização/estética segue pro diagnóstico;
// "Outra área" faz uma 2ª pergunta (tem clínica/consultório de saúde ou estética?) e quem diz "Não" é encerrado com tag "Fora do perfil" + pipeline "perdido".
// Uso: node nexus-anuncios/ajustar-fluxo-qualificacao.js   (lê TURSO_* de .env; idempotente: não roda 2x)
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const BN = "1512976205221650", F = 5, NO_SAUDE_TAG29 = 25, NO_OUTRA_TAG31 = 27, NO_INICIAL = 24;
const agora = () => Date.now();
async function no(tipo, texto, acao_tipo, acao_valor, proximo) {
  const r = await c.execute({ sql: "INSERT INTO fluxo_nos (fluxo_id,tipo,texto,acao_tipo,acao_valor,proximo_no_id,created_at) VALUES (?,?,?,?,?,?,?)", args: [F, tipo, texto, acao_tipo, acao_valor, proximo, agora()] });
  return Number(r.lastInsertRowid);
}
async function tag(nome, cor) {
  const r = await c.execute({ sql: "INSERT INTO tags (business_number_id,nome,cor,created_at) VALUES (?,?,?,?)", args: [BN, nome, cor, agora()] });
  return String(Number(r.lastInsertRowid));
}
(async () => {
  const ja = await c.execute({ sql: "SELECT 1 FROM tags WHERE business_number_id=? AND nome='Fora do perfil'", args: [BN] });
  if (ja.rows.length) { console.log("já aplicado"); return; }
  const tOdonto = await tag("Odontologia", "#0EA5E9"), tEstet = await tag("Harmonização/estética", "#EC4899"), tFora = await tag("Fora do perfil", "#6B7280");
  const fim = await no("mensagem", "Obrigado pelo contato! 🙏 Hoje a Sites Nexus atende profissionais de *odontologia, harmonização e estética*. Se isso mudar para você, é só mandar *menu* por aqui.", null, null, null);
  const perdido = await no("acao", null, "pipeline", "perdido", fim);
  const fora = await no("acao", null, "tag", tFora, perdido);
  const pergunta = await no("mensagem", "Obrigado! 😊 Hoje a Sites Nexus atende profissionais de *odontologia, harmonização e estética*.\n\nVocê tem clínica ou consultório nessa área?", null, null, null);
  const nOdonto = await no("acao", null, "tag", tOdonto, NO_SAUDE_TAG29);
  const nEstet = await no("acao", null, "tag", tEstet, NO_SAUDE_TAG29);
  // opções do nó inicial: reaproveita os mesmos botao_id (quem tocar em botão antigo continua funcionando)
  await c.execute({ sql: "UPDATE fluxo_opcoes SET botao_titulo='Odontologia', proximo_no_id=? WHERE no_id=? AND botao_id='nx_a_saude'", args: [nOdonto, NO_INICIAL] });
  await c.execute({ sql: "UPDATE fluxo_opcoes SET botao_titulo='Harmoniz./Estética', proximo_no_id=? WHERE no_id=? AND botao_id='nx_a_arq'", args: [nEstet, NO_INICIAL] });
  await c.execute({ sql: "UPDATE fluxo_opcoes SET botao_titulo='Outra área', proximo_no_id=? WHERE no_id=? AND botao_id='nx_a_outra'", args: [pergunta, NO_INICIAL] });
  await c.execute({ sql: "INSERT INTO fluxo_opcoes (no_id,botao_id,botao_titulo,proximo_no_id) VALUES (?,?,?,?)", args: [pergunta, "nx_q_sim", "Sim, tenho", NO_OUTRA_TAG31] });
  await c.execute({ sql: "INSERT INTO fluxo_opcoes (no_id,botao_id,botao_titulo,proximo_no_id) VALUES (?,?,?,?)", args: [pergunta, "nx_q_nao", "Não", fora] });
  await c.execute({ sql: "UPDATE fluxo_nos SET texto=? WHERE id=?", args: ["Oi! 👋 Aqui é o Felipe, da *Sites Nexus*.\n\nCriamos sites para *dentistas e profissionais de harmonização e estética* serem encontrados no Google, com agenda e atendimento no WhatsApp para não perder paciente.\n\nQual é a sua área?", NO_INICIAL] });
  console.log("ok", { tOdonto, tEstet, tFora, fim, perdido, fora, pergunta, nOdonto, nEstet });
})();
