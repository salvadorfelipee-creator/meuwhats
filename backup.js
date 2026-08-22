// Backup de reserva do banco (Turso) pra uma SEGUNDA conta/banco, separada da principal —
// se a conta principal travar de novo (limite de leitura, como já aconteceu), dá pra trocar
// TURSO_DATABASE_URL/TURSO_AUTH_TOKEN pra apontar pro banco de reserva sem perder os dados.
//
// Uso manual (Render → Shell): node backup.js
// Uso automático: chamado 1x por dia pelo server.js (ver rodarBackupDiario), só se
// TURSO_BACKUP_URL/TURSO_BACKUP_TOKEN estiverem configurados — sem eles, não faz nada.
const { createClient } = require("@libsql/client");

async function rodarBackup() {
  if (!process.env.TURSO_BACKUP_URL || !process.env.TURSO_BACKUP_TOKEN) {
    console.log("Backup pulado: TURSO_BACKUP_URL/TURSO_BACKUP_TOKEN não configurados.");
    return { pulado: true };
  }

  const origem = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const destino = createClient({ url: process.env.TURSO_BACKUP_URL, authToken: process.env.TURSO_BACKUP_TOKEN });

  // 1) Replica o schema (tabelas + índices) exatamente como está na origem — assim não
  // precisa manter uma cópia separada de cada CREATE TABLE aqui, sempre em dia com db.js.
  const schema = await origem.execute(
    `SELECT type, name, sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
  );
  for (const obj of schema.rows) {
    try {
      await destino.execute(obj.sql);
    } catch {
      // tabela/índice já existe de um backup anterior — ok, segue
    }
  }

  // 2) Copia os dados de cada tabela. Apaga e reinsere tudo (mais simples que calcular
  // diferença) — o volume total é pequeno (poucos MB), sai barato mesmo rodando todo dia.
  const tabelas = schema.rows.filter((r) => r.type === "table").map((r) => r.name);
  const resumo = {};
  for (const tabela of tabelas) {
    const dados = await origem.execute(`SELECT * FROM ${tabela}`);
    await destino.execute(`DELETE FROM ${tabela}`);
    if (dados.rows.length) {
      const colunas = Object.keys(dados.rows[0]);
      const placeholders = colunas.map(() => "?").join(", ");
      for (const linha of dados.rows) {
        await destino.execute({
          sql: `INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${placeholders})`,
          args: colunas.map((c) => linha[c]),
        });
      }
    }
    resumo[tabela] = dados.rows.length;
  }
  return { pulado: false, resumo };
}

if (require.main === module) {
  rodarBackup()
    .then((r) => {
      if (r.pulado) return;
      console.log("Backup concluído:");
      for (const [tabela, total] of Object.entries(r.resumo)) console.log(`  ${tabela}: ${total} linha(s)`);
    })
    .catch((err) => {
      console.error("Erro no backup:", err);
      process.exitCode = 1;
    });
}

module.exports = { rodarBackup };
