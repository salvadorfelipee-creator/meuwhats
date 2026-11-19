// 19/11/2026: ajuste do fluxo da assessoria a pedido: pergunta 2 = em quantas plataformas anuncia; pergunta 3 = quanto investe no total; fechamento chama um consultor.
// Quem diz "Nenhuma ainda" pula a pergunta de investimento (iria soar estranha) e vai direto ao fechamento.
// Uso: node nexus-anuncios/fluxo-assessoria-ajuste2.js (idempotente)
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const BN = "1512976205221650";
const run = (sql, args) => c.execute({ sql, args });
(async () => {
  // textos
  await run("UPDATE fluxo_nos SET texto=? WHERE id=42", ["Que bom! 😊 E hoje, você anuncia em quantas plataformas?\n\n(Instagram, Facebook, Google, TikTok…)"]);
  await run("UPDATE fluxo_nos SET texto=? WHERE id=38", ["Entendi! 💛 E no total, quanto você está investindo por mês nessas plataformas?"]);
  await run("UPDATE fluxo_nos SET texto=? WHERE id=35", ["Show, obrigado por me contar! 🙌\n\nJá vou chamar um *consultor* da nossa equipe, e em breve ele vem conversar com você por aqui. 😊\n\nSe quiser adiantar, me diga o *nome da clínica* e a *cidade*."]);
  // botões da pergunta 2 (nós de tag 43/44/45) e da 3 (39/40/41)
  await run("UPDATE fluxo_opcoes SET botao_titulo='Nenhuma ainda' WHERE botao_id='nx_c_ind'");
  await run("UPDATE fluxo_opcoes SET botao_titulo='1 plataforma' WHERE botao_id='nx_c_redes'");
  await run("UPDATE fluxo_opcoes SET botao_titulo='2 ou mais' WHERE botao_id='nx_c_anun'");
  await run("UPDATE fluxo_opcoes SET botao_titulo='Até R$ 1.000' WHERE botao_id='nx_o_pac'");
  await run("UPDATE fluxo_opcoes SET botao_titulo='R$ 1.000 a 3.000' WHERE botao_id='nx_o_org'");
  await run("UPDATE fluxo_opcoes SET botao_titulo='Acima de R$ 3.000' WHERE botao_id='nx_o_marca'");
  // tags renomeadas (criadas hoje, só este fluxo as usa)
  for (const [de, para] of [["Chega por indicação", "Anuncia: nenhuma"], ["Chega por redes sociais", "Anuncia: 1 plataforma"], ["Já anuncia", "Anuncia: 2 ou mais"], ["Quer mais pacientes", "Investe até R$ 1 mil"], ["Quer organizar contatos", "Investe R$ 1-3 mil"], ["Quer fortalecer a marca", "Investe mais de R$ 3 mil"]])
    await run("UPDATE tags SET nome=? WHERE business_number_id=? AND nome=?", [para, BN, de]);
  // "Nenhuma ainda" (nó de tag 43) pula o investimento: vai direto para a tag Quente (nó 37)
  await run("UPDATE fluxo_nos SET proximo_no_id=37 WHERE id=43");
  console.log("ok");
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
