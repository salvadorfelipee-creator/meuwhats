"use strict";

const facta = require("../facta");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStdin() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

function cpfsFrom(raw) {
  return [...new Set(String(raw).split(/\s+/).map((value) => value.replace(/\D/g, "")).filter(Boolean))]
    .map((cpf) => cpf.padStart(11, "0"))
    .filter((cpf) => cpf.length === 11);
}

function registros(payload) {
  if (Array.isArray(payload?.dados)) return payload.dados;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

(async () => {
  const cpfs = cpfsFrom(await readStdin());
  if (!cpfs.length) throw new Error("Nenhum CPF informado pela entrada padrão.");
  const encontrados = [];
  const falhas = [];

  for (let index = 0; index < cpfs.length; index++) {
    const cpf = cpfs[index];
    try {
      const response = await facta.consultarBaseOffline(cpf);
      const rows = registros(response);
      if (rows.length) encontrados.push({ cpf, registros: rows.length });
      process.stdout.write(`PROGRESSO ${index + 1}/${cpfs.length} encontrados=${encontrados.length}\n`);
    } catch (error) {
      falhas.push({ cpf, status: error.httpStatus || null, mensagem: error.message });
      process.stdout.write(`PROGRESSO ${index + 1}/${cpfs.length} encontrados=${encontrados.length} falhas=${falhas.length}\n`);
    }
    if (index < cpfs.length - 1) await wait(3200);
  }

  process.stdout.write(`RESULTADO ${JSON.stringify({ total: cpfs.length, encontrados, falhas })}\n`);
})().catch((error) => {
  console.error(`ERRO_FATAL ${error.message}`);
  process.exit(1);
});
