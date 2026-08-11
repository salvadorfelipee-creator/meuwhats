const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const db = require("./db");
const drive = require("./drive");
const video = require("./video");
const ig = require("./instagram");

// Mesma pasta pública que o server.js usa pro upload manual do Publique IV — o vídeo
// processado (já com a moldura) precisa ficar aqui pro Instagram conseguir buscá-lo.
const PUBLICAR_MEDIA_DIR = path.join(__dirname, "media", "publicar");
fs.mkdirSync(PUBLICAR_MEDIA_DIR, { recursive: true });

const LEGENDA_PADRAO =
  "FelizCred — correspondente bancário. Crédito consignado, antecipação de FGTS e mais, 100% digital pelo WhatsApp. #felizcred #credito #consignado #fgts";

function baseUrl() {
  return (process.env.PUBLIC_URL || "https://meuwhats.onrender.com").replace(/\/$/, "");
}

// Puxa a lista atual da pasta do Drive e adiciona à fila quem ainda não está nela.
// Idempotente — chamar de novo só pega os vídeos novos.
async function sincronizarFila() {
  const folderId = process.env.GOOGLE_DRIVE_REELS_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_REELS_FOLDER_ID não configurado.");
  const arquivos = await drive.listarVideos(folderId);
  const adicionados = await db.reelsSincronizarFila(arquivos);
  return { encontrados: arquivos.length, adicionados };
}

// Baixa do Drive, aplica a moldura, publica como Reels no Instagram e limpa os
// arquivos temporários — usado tanto pelo agendador automático quanto pelo botão
// "publicar agora" do painel (pra testar sem esperar o horário).
async function publicarProximoPendente() {
  const [item] = await db.reelsProximosPendentes(1);
  if (!item) return { vazio: true };

  const tmpId = crypto.randomBytes(6).toString("hex");
  const brutoPath = path.join(os.tmpdir(), `reel-bruto-${tmpId}.mp4`);
  const finalNome = `reel-${tmpId}.mp4`;
  const finalPath = path.join(PUBLICAR_MEDIA_DIR, finalNome);

  try {
    const bytes = await drive.baixarVideo(item.drive_file_id);
    fs.writeFileSync(brutoPath, bytes);

    // "pular" = vídeo já vem pronto de fora (editado no CapCut, etc.) — não roda ffmpeg
    // nenhuma vez, só publica o arquivo como está. Configurável no painel porque é uma
    // escolha por conta/fluxo (toda a pasta do Drive é ou não pré-editada), não por vídeo.
    const moldura = (await db.reelsConfigGet("moldura_padrao")) || "felizcred";
    if (moldura === "pular") {
      fs.copyFileSync(brutoPath, finalPath);
    } else {
      await video.processarVideo(brutoPath, finalPath, { moldura, qualidade: "1080p" });
    }

    const videoUrl = `${baseUrl()}/publicar-media/${finalNome}`;
    const legenda = item.legenda || LEGENDA_PADRAO;
    const resultado = await ig.publicarReels({ videoUrl, legenda });

    await db.reelsMarcarPostado(item.id, resultado);
    return { ok: true, item, resultado };
  } catch (err) {
    await db.reelsMarcarErro(item.id, err.message);
    throw err;
  } finally {
    for (const p of [brutoPath, finalPath]) {
      fs.unlink(p, () => {}); // best-effort — disco do Render é efêmero mesmo
    }
  }
}

// Editor manual: recebe o CAMINHO de um vídeo já salvo em disco (o servidor grava direto
// via streaming multipart — ver server.js — em vez de carregar tudo em base64 na memória,
// que estourava RAM no plano free do Render com vídeo grande). Processa conforme as opções
// (moldura/qualidade/música) e devolve o link pra baixar o resultado — não publica em nada.
async function processarUploadAvulso(brutoPath, musicaPath, opcoes = {}) {
  const tmpId = crypto.randomBytes(6).toString("hex");
  const finalNome = `editor-${tmpId}.mp4`;
  const finalPath = path.join(PUBLICAR_MEDIA_DIR, finalNome);

  try {
    if (opcoes.moldura === "pular") {
      // vídeo já pronto de fora — só copia pra pasta pública, sem rodar ffmpeg nenhuma vez
      fs.copyFileSync(brutoPath, finalPath);
    } else {
      await video.processarVideo(brutoPath, finalPath, {
        moldura: opcoes.moldura,
        qualidade: opcoes.qualidade,
        musicaPath: musicaPath || null,
      });
    }
    return { url: `${baseUrl()}/publicar-media/${finalNome}` };
  } finally {
    fs.unlink(brutoPath, () => {});
    if (musicaPath) fs.unlink(musicaPath, () => {});
  }
}

// Fila em memória dos processamentos do editor manual em andamento — permite responder o
// upload na hora (sem o proxy do Render derrubar a conexão por demora) e o painel ir
// consultando o progresso, em vez de segurar a requisição HTTP até o ffmpeg terminar.
// Some se o processo reiniciar, mas o job em si também não sobreviveria a isso mesmo.
const jobsEditor = new Map();

function iniciarProcessamentoAvulso(brutoPath, musicaPath, opcoes) {
  const jobId = crypto.randomBytes(8).toString("hex");
  jobsEditor.set(jobId, { status: "processando" });
  processarUploadAvulso(brutoPath, musicaPath, opcoes)
    .then((resultado) => jobsEditor.set(jobId, { status: "pronto", url: resultado.url }))
    .catch((err) => jobsEditor.set(jobId, { status: "erro", erro: err.message }));
  return jobId;
}

function statusJobEditor(jobId) {
  return jobsEditor.get(jobId) || { status: "erro", erro: "Processamento não encontrado (talvez o servidor tenha reiniciado)." };
}

module.exports = {
  sincronizarFila,
  publicarProximoPendente,
  processarUploadAvulso,
  iniciarProcessamentoAvulso,
  statusJobEditor,
  resumo: db.reelsResumo,
  listarRecentes: db.reelsListarRecentes,
  reenfileirar: db.reelsReenfileirar,
  configGet: db.reelsConfigGet,
  configSet: db.reelsConfigSet,
};
