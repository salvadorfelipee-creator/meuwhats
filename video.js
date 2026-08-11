const { spawn } = require("child_process");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const MOLDURA = path.join(__dirname, "assets", "reels-frame.png");

const RESOLUCOES = {
  "1080p": { w: 1080, h: 1920 },
  "720p": { w: 720, h: 1280 },
};

function executarFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg falhou (código ${code}): ${stderr.slice(-800)}`));
    });
  });
}

// Processa um vídeo pro formato Reels: recorta/redimensiona, opcionalmente sobrepõe a
// moldura FelizCred e/ou troca a trilha de áudio por uma música enviada. Reencoda em
// H.264/AAC pra garantir compatibilidade com Instagram/Facebook independente da entrada.
//
// opcoes:
//   moldura   "felizcred" (padrão) | "nenhuma" — com ou sem a marca/janela por cima
//   qualidade "1080p" (padrão) | "720p"
//   musicaPath  caminho de um áudio local (opcional) — SUBSTITUI o áudio original inteiro
//               (mais simples e previsível do que misturar volumes com a narração)
async function processarVideo(entradaPath, saidaPath, opcoes = {}) {
  const moldura = opcoes.moldura === "nenhuma" ? "nenhuma" : "felizcred";
  const { w, h } = RESOLUCOES[opcoes.qualidade] || RESOLUCOES["1080p"];

  const args = ["-y", "-i", entradaPath];
  let proximoIndice = 1; // índice 0 já é o vídeo de entrada
  let filtroVideo = `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[vid]`;

  if (moldura === "felizcred") {
    const indiceMoldura = proximoIndice++;
    args.push("-i", MOLDURA);
    // a moldura é sempre 1080x1920 — se a saída pedida for outra resolução, escala ela junto
    filtroVideo += `;[${indiceMoldura}:v]scale=${w}:${h}[frm];[vid][frm]overlay=0:0:format=auto[out]`;
  } else {
    filtroVideo += ";[vid]copy[out]";
  }

  const mapAudio = [];
  if (opcoes.musicaPath) {
    const indiceMusica = proximoIndice++;
    args.push("-stream_loop", "-1", "-i", opcoes.musicaPath);
    mapAudio.push("-map", `${indiceMusica}:a`, "-shortest");
  } else {
    mapAudio.push("-map", "0:a?");
  }

  args.push(
    "-filter_complex", filtroVideo,
    "-map", "[out]",
    ...mapAudio,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    saidaPath
  );

  await executarFfmpeg(args);
}

module.exports = { processarVideo };
