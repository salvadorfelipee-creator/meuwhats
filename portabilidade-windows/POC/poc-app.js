const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.POC_PORT || 4321;
const SEGREDO = process.env.POC_SEGREDO_TESTE || "(vazio — .env nao foi carregado)";

const outputPath = path.join(__dirname, "poc-output.txt");
const linha =
  `poc rodou em ${new Date().toISOString()}\n` +
  `cwd (de onde foi chamado) = ${process.cwd()}\n` +
  `__dirname (pasta real do script) = ${__dirname}\n` +
  `POC_SEGREDO_TESTE (vindo do .env.poc) = ${SEGREDO}\n`;

fs.writeFileSync(outputPath, linha);
console.log("[POC] escreveu resultado em:", outputPath);
console.log("[POC] " + linha.trim().replace(/\n/g, "\n[POC] "));

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`POC de portabilidade OK.\nSegredo carregado do .env: ${SEGREDO}\n`);
});

server.listen(PORT, () => {
  console.log(`[POC] servidor de teste rodando em http://localhost:${PORT}`);
  console.log("[POC] vai se encerrar sozinho em 5s (é só uma prova de conceito).");
  setTimeout(() => {
    server.close(() => {
      console.log("[POC] encerrado.");
      process.exit(0);
    });
  }, 5000);
});
