// Conta quanto o servidor enviou pela rede no mês, pra avisar no painel antes de estourar os 5 GB grátis de
// banda do Render (em 23/10/2026 a conta foi suspensa por isso). É uma ESTIMATIVA: soma os bytes escritos em
// cada conexão ao fechar (respostas do painel + uploads pro R2/Meta/Turso), ignorando conexões locais.
// O número oficial continua sendo o do Render (Billing > Included Bandwidth).
const net = require("net");

const LIMITE_BYTES = Number(process.env.BANDA_LIMITE_GB || 5) * 1024 ** 3;

let pendente = 0; // bytes contados desde a última gravação no banco
let db = null;

const LOCAIS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const destroyOriginal = net.Socket.prototype._destroy;
net.Socket.prototype._destroy = function (err, cb) {
  try {
    if (!LOCAIS.has(this.remoteAddress)) pendente += this.bytesWritten || 0;
  } catch { /* contagem nunca pode derrubar uma conexão */ }
  return destroyOriginal.call(this, err, cb);
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM em UTC
}

async function gravar() {
  if (!db || !pendente) return;
  const delta = pendente;
  pendente = 0;
  try {
    const chave = `banda_${mesAtual()}`;
    const atual = Number(await db.reelsConfigGet(chave)) || 0;
    await db.reelsConfigSet(chave, String(atual + delta));
  } catch {
    pendente += delta; // tenta de novo no próximo ciclo
  }
}

function iniciar(dbModulo) {
  db = dbModulo;
  setInterval(gravar, 2 * 60_000).unref();
}

async function uso() {
  await gravar();
  const bytes = Number(await db.reelsConfigGet(`banda_${mesAtual()}`)) || 0;
  const gb = bytes / 1024 ** 3;
  return {
    mes: mesAtual(),
    gb: Math.round(gb * 100) / 100,
    limiteGb: LIMITE_BYTES / 1024 ** 3,
    pct: Math.round((bytes / LIMITE_BYTES) * 1000) / 10,
  };
}

module.exports = { iniciar, uso };
