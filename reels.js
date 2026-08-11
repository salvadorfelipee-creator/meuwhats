const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("./db");
const drive = require("./drive");
const ig = require("./instagram");
const fb = require("./facebook");

// Mesma pasta pública que o server.js usa pro upload manual do Publique IV — o vídeo
// baixado do Drive precisa ficar aqui pro Instagram/Facebook conseguirem buscá-lo.
const PUBLICAR_MEDIA_DIR = path.join(__dirname, "media", "publicar");
fs.mkdirSync(PUBLICAR_MEDIA_DIR, { recursive: true });

const LEGENDA_PADRAO =
  "FelizCred — correspondente bancário. Crédito consignado, antecipação de FGTS e mais, 100% digital pelo WhatsApp. #felizcred #credito #consignado #fgts";

function env(nome) {
  const valor = process.env[nome];
  return valor ? valor.trim() : valor;
}

function baseUrl() {
  return (process.env.PUBLIC_URL || "https://meuwhats.onrender.com").replace(/\/$/, "");
}

// Credenciais do Facebook lidas direto do env (mesmo padrão do publique.js) — o Instagram
// não precisa disso porque instagram.js já cai no token/conta padrão sozinho quando nenhuma
// credencial explícita é passada.
function credenciaisFacebook() {
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  const paginaId = env("FACEBOOK_PAGE_ID");
  return token && paginaId ? { token, paginaId } : null;
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

// Baixa do Drive (vídeo já pronto, editado por fora — sem processamento nenhum aqui) e
// publica em todas as redes com vídeo configuradas (Instagram + Facebook). Cada rede é
// tentada de forma independente; a publicação conta como sucesso se AO MENOS UMA rede
// publicar — o resultado detalhado (por rede) fica salvo pra mostrar no painel.
async function publicarProximoPendente() {
  const [item] = await db.reelsProximosPendentes(1);
  if (!item) return { vazio: true };

  const finalNome = `reel-${crypto.randomBytes(6).toString("hex")}.mp4`;
  const finalPath = path.join(PUBLICAR_MEDIA_DIR, finalNome);

  try {
    const bytes = await drive.baixarVideo(item.drive_file_id);
    fs.writeFileSync(finalPath, bytes);

    const videoUrl = `${baseUrl()}/publicar-media/${finalNome}`;
    const legenda = item.legenda || LEGENDA_PADRAO;
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
  } finally {
    fs.unlink(finalPath, () => {}); // best-effort — disco do Render é efêmero mesmo
  }
}

// Upload direto do painel: sobe o vídeo pra pasta do Drive configurada (sem precisar abrir
// o Drive por fora) e já sincroniza a fila na sequência, pra aparecer em "pendentes" na
// hora. A pasta precisa estar compartilhada com a Service Account em permissão de Editor
// (não só Leitor, que bastava só pra ler/baixar).
async function enviarVideo(buffer, nomeArquivo) {
  const folderId = process.env.GOOGLE_DRIVE_REELS_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_REELS_FOLDER_ID não configurado.");
  const arquivo = await drive.enviarVideo(folderId, nomeArquivo, buffer);
  await sincronizarFila();
  return arquivo;
}

module.exports = {
  sincronizarFila,
  enviarVideo,
  publicarProximoPendente,
  resumo: db.reelsResumo,
  listarRecentes: db.reelsListarRecentes,
  reenfileirar: db.reelsReenfileirar,
  configGet: db.reelsConfigGet,
  configSet: db.reelsConfigSet,
};
