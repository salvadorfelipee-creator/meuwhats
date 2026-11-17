// Conta quanto o servidor enviou pela rede no mês, pra avisar no painel antes de estourar os 5 GB grátis de
// banda do Render (em 23/10/2026 a conta foi suspensa por isso). É uma ESTIMATIVA: soma os bytes escritos em
// cada conexão ao fechar (respostas do painel + uploads pro R2/Meta/Turso), ignorando conexões locais.
// O número oficial continua sendo o do Render (Billing > Included Bandwidth).
const net = require("net");

const LIMITE_BYTES = Number(process.env.BANDA_LIMITE_GB || 5) * 1024 ** 3;

let pendente = 0; // bytes contados desde a última gravação no banco
let pendentePorHost = {}; // idem, separado por servidor de destino (pra descobrir quem gasta a banda)
let db = null;

const LOCAIS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const destroyOriginal = net.Socket.prototype._destroy;
net.Socket.prototype._destroy = function (err, cb) {
  try {
    if (!LOCAIS.has(this.remoteAddress)) {
      const bytes = this.bytesWritten || 0;
      pendente += bytes;
      const host = String(this.servername || this._host || this.remoteAddress || "desconhecido");
      pendentePorHost[host] = (pendentePorHost[host] || 0) + bytes;
    }
  } catch { /* contagem nunca pode derrubar uma conexão */ }
  return destroyOriginal.call(this, err, cb);
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM em UTC
}

// Totais do mês em memória: lê do banco uma vez por mês (ou após falha) e depois só grava — antes eram 2 leituras + 2 gravações
// a cada 2 min, e o próprio tráfego dessas consultas realimentava a contagem.
let cacheMes = null;
let cacheTotal = 0;
let cacheHosts = {};

async function carregarMes() {
  const mes = mesAtual();
  if (cacheMes === mes) return;
  cacheTotal = Number(await db.reelsConfigGet(`banda_${mes}`)) || 0;
  try { cacheHosts = JSON.parse((await db.reelsConfigGet(`banda_hosts_${mes}`)) || "{}"); } catch { cacheHosts = {}; }
  cacheMes = mes;
}

async function gravar() {
  if (!db || !pendente) return;
  const delta = pendente;
  const deltaHosts = pendentePorHost;
  pendente = 0;
  pendentePorHost = {};
  try {
    await carregarMes();
    cacheTotal += delta;
    for (const [h, b] of Object.entries(deltaHosts)) cacheHosts[h] = (cacheHosts[h] || 0) + b;
    await db.reelsConfigSet(`banda_${cacheMes}`, String(cacheTotal));
    await db.reelsConfigSet(`banda_hosts_${cacheMes}`, JSON.stringify(cacheHosts));
  } catch {
    pendente += delta; // tenta de novo no próximo ciclo
    for (const [h, b] of Object.entries(deltaHosts)) pendentePorHost[h] = (pendentePorHost[h] || 0) + b;
    cacheMes = null; // recarrega do banco na próxima (o cache pode ter ficado adiantado)
  }
}

// Grava a cada 10 min (madrugada em Brasília, 22h–6h: a cada 30 min).
function emMadrugada() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date())) % 24;
  return h >= 22 || h < 6;
}
let ultimaGravacao = 0;
function iniciar(dbModulo) {
  db = dbModulo;
  setInterval(() => {
    const espera = emMadrugada() ? 30 * 60_000 : 10 * 60_000;
    if (Date.now() - ultimaGravacao < espera - 60_000) return;
    ultimaGravacao = Date.now();
    gravar();
  }, 5 * 60_000).unref();
}

// Calibração com o número OFICIAL do Render (Billing > Included Bandwidth). O contador bruto passa de 2x o que o
// Render cobra (conta também tráfego que o Render não tarifa, e o overhead de TLS), então o painel mostra:
//   oficial_na_calibração + (bruto_agora - bruto_na_calibração) * fator
// `fator` começa pela razão oficial/bruto da 1ª calibração e é reajustado a cada nova calibração com ≥0,5 GB de
// diferença (aí a razão é medida no intervalo, bem mais precisa). Sem calibração do mês, mostra o bruto como antes.
const FATOR_PADRAO = 0.35;
async function lerCalibracao(mes) {
  try { return JSON.parse((await db.reelsConfigGet(`banda_calib_${mes}`)) || "null"); } catch { return null; }
}
async function calibrar(gbOficial) {
  const mes = mesAtual();
  await gravar();
  const bruto = Number(await db.reelsConfigGet(`banda_${mes}`)) || 0;
  const oficial = Number(gbOficial) * 1024 ** 3;
  if (!(oficial >= 0) || !bruto) throw new Error("valor inválido");
  const anterior = await lerCalibracao(mes);
  let fator = anterior?.fator || oficial / bruto || FATOR_PADRAO;
  if (anterior && bruto - anterior.bruto >= 0.5 * 1024 ** 3 && oficial > anterior.oficial) {
    fator = (oficial - anterior.oficial) / (bruto - anterior.bruto);
  } else if (!anterior) {
    fator = oficial / bruto;
  }
  fator = Math.min(1, Math.max(0.05, fator));
  await db.reelsConfigSet(`banda_calib_${mes}`, JSON.stringify({ oficial, bruto, fator, em: Date.now() }));
  return { mes, oficialGb: Number(gbOficial), brutoGb: Math.round((bruto / 1024 ** 3) * 100) / 100, fator: Math.round(fator * 1000) / 1000 };
}

async function uso() {
  await gravar();
  const mes = mesAtual();
  const brutoBytes = Number(await db.reelsConfigGet(`banda_${mes}`)) || 0;
  const calib = await lerCalibracao(mes);
  const bytes = calib ? calib.oficial + Math.max(0, brutoBytes - calib.bruto) * calib.fator : brutoBytes;
  const gb = bytes / 1024 ** 3;
  let hosts = {};
  try { hosts = JSON.parse((await db.reelsConfigGet(`banda_hosts_${mesAtual()}`)) || "{}"); } catch { /* sem detalhe */ }
  const porServidor = Object.entries(hosts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([host, b]) => ({ host, mb: Math.round((b / 1024 ** 2) * 10) / 10 }));
  return {
    porServidor,
    mes,
    calibrado: !!calib,
    brutoGb: Math.round((brutoBytes / 1024 ** 3) * 100) / 100,
    gb: Math.round(gb * 100) / 100,
    limiteGb: LIMITE_BYTES / 1024 ** 3,
    pct: Math.round((bytes / LIMITE_BYTES) * 1000) / 10,
  };
}

module.exports = { iniciar, uso, calibrar };
