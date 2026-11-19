// 19/11/2026: o fluxo 5 do Nexus passa a começar com um FORMULÁRIO nativo do WhatsApp (nome, cargo, nome da clínica).
// Depois do envio segue para a pergunta da área (botões Odonto/Harmonização-Estética/Outra) e o resto igual.
// Flow publicado na WABA do Nexus: 1131594619780974 (flows/nexus-qualificacao.json). Exige o deploy do nó 'formulario' no server.js.
// Uso: node nexus-anuncios/fluxo-formulario.js (idempotente; backup do nó inicial em fluxo-formulario-backup.json)
const fs = require("fs");
const path = require("path");
for (const l of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { createClient } = require("@libsql/client");
const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const F = 5, INICIAL = 24, FLOW_ID = "1131594619780974";
(async () => {
  const atual = (await c.execute({ sql: "SELECT * FROM fluxo_nos WHERE id=?", args: [INICIAL] })).rows[0];
  if (atual.tipo === "formulario") { console.log("já aplicado"); return; }
  const opcoes = (await c.execute({ sql: "SELECT * FROM fluxo_opcoes WHERE no_id=?", args: [INICIAL] })).rows;
  fs.writeFileSync(path.join(__dirname, "fluxo-formulario-backup.json"), JSON.stringify({ no: atual, opcoes }, (k, v) => (typeof v === "bigint" ? Number(v) : v), 2));
  const area = Number((await c.execute({ sql: "INSERT INTO fluxo_nos (fluxo_id,tipo,texto,acao_tipo,acao_valor,proximo_no_id,created_at) VALUES (?,?,?,?,?,?,?)", args: [F, "mensagem", "Prazer em te conhecer! 🤗 E qual é a sua área de atuação?", null, null, null, Date.now()] })).lastInsertRowid);
  await c.batch([
    { sql: "UPDATE fluxo_opcoes SET no_id=? WHERE no_id=?", args: [area, INICIAL] },
    { sql: "UPDATE fluxo_nos SET tipo='formulario', acao_tipo='flow', acao_valor=?, proximo_no_id=?, texto=? WHERE id=?", args: [FLOW_ID, area, "Oi! 👋 Aqui é o Felipe, da *Nexus*. Que bom ter você por aqui!\n\nA gente cuida do marketing de clínicas odontológicas, de harmonização e de estética. E neste Black Novembro + Dezembro, os primeiros *30 dias de integração e a criação das campanhas são por nossa conta*. 🎁\n\nPra começar, toque no botão abaixo e me conte seu *nome, cargo e o nome da clínica*:", INICIAL] },
  ], "write");
  console.log("ok; nó de área:", area);
})().catch((e) => { console.error("ERRO", e.message); process.exit(1); });
