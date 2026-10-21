"use strict";

// Consulta a base offline da Facta (CLT) para um lote de CPFs, uma por vez, com 3,2 s entre
// requisições (a Facta exige no mínimo 3 s). Salva a resposta bruta de cada CPF em JSON, para
// depois montar a planilha de margem. Uso: node scripts/consultar-lote-facta.js <cpfs.txt> <saida.json>
const fs = require("fs");
const facta = require("../facta");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const [, , entrada, saida] = process.argv;

(async () => {
  const cpfs = fs.readFileSync(entrada, "utf8").split(/\s+/).map((v) => v.replace(/\D/g, "").padStart(11, "0")).filter((v) => v.length === 11);
  const resultado = {};
  for (let i = 0; i < cpfs.length; i++) {
    const cpf = cpfs[i];
    try {
      resultado[cpf] = { ok: true, resposta: await facta.consultarBaseOffline(cpf) };
    } catch (error) {
      resultado[cpf] = { ok: false, status: error.httpStatus || null, mensagem: error.message };
    }
    fs.writeFileSync(saida, JSON.stringify(resultado, null, 2));
    process.stdout.write(`PROGRESSO ${i + 1}/${cpfs.length}\n`);
    if (i < cpfs.length - 1) await wait(3200);
  }
  process.stdout.write("FIM\n");
})().catch((error) => {
  console.error(`ERRO_FATAL ${error.message}`);
  process.exit(1);
});
