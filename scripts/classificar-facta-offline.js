"use strict";

const facta = require("../facta");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStdin() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

function cpfsFrom(raw) {
  return [...new Set(String(raw).split(/\s+/).map((v) => v.replace(/\D/g, "")).filter(Boolean))]
    .map((cpf) => cpf.padStart(11, "0"))
    .filter((cpf) => cpf.length === 11);
}

function numero(value) {
  const raw = String(value ?? "").trim().replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sim(value) {
  return /^(s|sim|true|1|elegivel|elegível)$/i.test(String(value ?? "").trim());
}

(async () => {
  const cpfs = cpfsFrom(await readStdin());
  const grupos = { comMargem: [], semMargem: [], inelegiveis: [], semDados: [], falhas: [] };

  async function consultar(cpf, index, registrarFalha = true) {
    try {
      const response = await facta.consultarBaseOffline(cpf);
      const rows = Array.isArray(response?.dados) ? response.dados : [];
      if (!rows.length) grupos.semDados.push(cpf);
      else {
        const elegiveis = rows.filter((row) => sim(row.elegivel));
        const maiorMargem = Math.max(0, ...elegiveis.map((row) => numero(row.valorMargemDisponivel)));
        if (elegiveis.length && maiorMargem > 0) grupos.comMargem.push({ cpf, maiorMargem, vinculos: elegiveis.length });
        else if (elegiveis.length) grupos.semMargem.push(cpf);
        else grupos.inelegiveis.push(cpf);
      }
      process.stdout.write(`PROGRESSO ${index + 1}/${cpfs.length} candidatos=${grupos.comMargem.length}\n`);
    } catch (error) {
      if (registrarFalha) grupos.falhas.push({ cpf, index, status: error.httpStatus || null, mensagem: error.message });
      process.stdout.write(`PROGRESSO ${index + 1}/${cpfs.length} candidatos=${grupos.comMargem.length} falhas=${grupos.falhas.length}\n`);
    }
  }

  // A Facta exige no mínimo três segundos entre requisições. Iniciamos uma chamada a cada
  // 3,2 segundos, mas não esperamos a resposta anterior terminar; assim um timeout isolado não
  // multiplica o tempo total do lote.
  const consultas = [];
  for (let index = 0; index < cpfs.length; index++) {
    consultas.push(consultar(cpfs[index], index));
    if (index < cpfs.length - 1) await wait(3200);
  }
  await Promise.all(consultas);
  const repetir = [...grupos.falhas];
  grupos.falhas.length = 0;
  for (let index = 0; index < repetir.length; index++) {
    await consultar(repetir[index].cpf, repetir[index].index, true);
    if (index < repetir.length - 1) await wait(3200);
  }
  grupos.comMargem.sort((a, b) => cpfs.indexOf(a.cpf) - cpfs.indexOf(b.cpf));
  process.stdout.write(`RESULTADO ${JSON.stringify({ total: cpfs.length, ...grupos })}\n`);
})().catch((error) => {
  console.error(`ERRO_FATAL ${error.message}`);
  process.exit(1);
});
