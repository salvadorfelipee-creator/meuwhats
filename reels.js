const crypto = require("crypto");

const db = require("./db");
const r2 = require("./r2");
const ig = require("./instagram");
const fb = require("./facebook");

const LEGENDA_PADRAO_FALLBACK =
  "FelizCred — correspondente bancário. Crédito consignado, antecipação de FGTS e mais, 100% digital pelo WhatsApp. #felizcred #credito #consignado #fgts";

// Plano free do R2: 10GB de armazenamento. Bloqueia upload novo perto do limite pra nunca
// estourar (e começar a ser cobrado) — 9GB dá uma folga confortável de ~1GB.
const LIMITE_BYTES = 10 * 1024 * 1024 * 1024;
const BLOQUEIO_BYTES = 9 * 1024 * 1024 * 1024;

// Vídeo já publicado (nas redes que deram certo) fica esse tempo no R2 antes de ser
// apagado — só uma folga de segurança, não precisa manter depois de publicado.
const IDADE_LIMPEZA_MS = 24 * 60 * 60 * 1000;

function env(nome) {
  const valor = process.env[nome];
  return valor ? valor.trim() : valor;
}

function credenciaisFacebook() {
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  const paginaId = env("FACEBOOK_PAGE_ID");
  return token && paginaId ? { token, paginaId } : null;
}

async function espacoUsado() {
  const usados = await r2.usoTotalBytes();
  return { usados, limite: LIMITE_BYTES, percentual: Math.round((usados / LIMITE_BYTES) * 100), bloqueado: usados >= BLOQUEIO_BYTES };
}

// Puxa a lista atual do bucket e adiciona à fila quem ainda não está nela. Idempotente —
// chamar de novo só pega os vídeos novos (útil se algum vídeo foi colocado direto no R2
// por fora, embora o normal seja usar o botão de upload do painel).
async function sincronizarFila() {
  const arquivos = await r2.listarVideos();
  const adicionados = await db.reelsSincronizarFila(arquivos);
  return { encontrados: arquivos.length, adicionados };
}

// Publica em Instagram + Facebook direto de uma URL assinada do R2 — o servidor nunca
// baixa o vídeo pro próprio disco, só pede pro R2 gerar um link temporário e a Meta busca
// direto de lá. Cada rede é tentada de forma independente; conta como sucesso se AO MENOS
// UMA publicar. O arquivo em si só é apagado do R2 depois de 24h (ver limparAntigos()).
async function publicarProximoPendente() {
  const [item] = await db.reelsProximosPendentes(1);
  if (!item) return { vazio: true };

  try {
    const videoUrl = await r2.urlAssinada(item.drive_file_id);
    const legendaPadrao = (await db.reelsConfigGet("legenda_padrao")) || LEGENDA_PADRAO_FALLBACK;
    const legenda = item.legenda || legendaPadrao;
    const resultado = {};

    try {
      resultado.instagram = { ok: true, ...(await ig.publicarReels({ videoUrl, legenda })) };
    } catch (err) {
      resultado.instagram = { ok: false, erro: err.message };
    }

    const credFb = credenciaisFacebook();
    if (credFb) {
      try {
        resultado.facebook = { ok: true, ...(await fb.publicarReels({ videoUrl, legenda }, credFb)) };
      } catch (err) {
        resultado.facebook = { ok: false, erro: err.message };
      }
    }

    const algumaOk = Object.values(resultado).some((r) => r.ok);
    if (algumaOk) {
      await db.reelsMarcarPostado(item.id, resultado);
      return { ok: true, item, resultado };
    }
    const mensagemErro = Object.entries(resultado)
      .map(([rede, r]) => `${rede}: ${r.erro}`)
      .join(" | ");
    throw new Error(mensagemErro || "Nenhuma rede com vídeo configurada.");
  } catch (err) {
    await db.reelsMarcarErro(item.id, err.message);
    throw err;
  }
}

// Upload direto do painel: sobe o vídeo pro R2 (sem precisar abrir nenhum site por fora) e
// já sincroniza a fila na sequência, pra aparecer em "pendentes" na hora. `legenda` é
// opcional — só esse vídeo usa um texto diferente do padrão.
async function enviarVideo(buffer, nomeArquivo, legenda) {
  const espaco = await espacoUsado();
  if (espaco.bloqueado) {
    throw new Error(`Espaço quase cheio (${espaco.percentual}% de 10GB usado) — apague vídeos antigos ou espere a limpeza automática antes de subir mais.`);
  }
  const key = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${nomeArquivo}`;
  const arquivo = await r2.enviarVideo(key, buffer);
  await sincronizarFila();
  if (legenda) await db.reelsDefinirLegenda(arquivo.id, legenda);
  return arquivo;
}

// Apaga do R2 quem já foi publicado há mais de 24h — evita acumular espaço/custo depois
// que o vídeo já cumpriu sua função. Roda periodicamente (ver server.js).
async function limparAntigos() {
  const itens = await db.reelsPostadosParaLimpar(IDADE_LIMPEZA_MS);
  let apagados = 0;
  for (const item of itens) {
    try {
      await r2.apagarVideo(item.drive_file_id);
      await db.reelsMarcarArquivoApagado(item.id);
      apagados++;
    } catch (err) {
      console.error(`Falha ao apagar do R2 (id ${item.id}):`, err.message);
    }
  }
  return { apagados };
}

module.exports = {
  sincronizarFila,
  enviarVideo,
  publicarProximoPendente,
  limparAntigos,
  espacoUsado,
  resumo: db.reelsResumo,
  listarRecentes: db.reelsListarRecentes,
  reenfileirar: db.reelsReenfileirar,
  configGet: db.reelsConfigGet,
  configSet: db.reelsConfigSet,
};
