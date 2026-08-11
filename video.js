const { spawn } = require("child_process");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");

const MOLDURA = path.join(__dirname, "assets", "reels-frame.png");

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

// Recorta/redimensiona o vídeo pra preencher 1080x1920 (formato Reels) e sobrepõe a
// moldura (assets/reels-frame.png — navy com um furo arredondado + marca FelizCred),
// deixando o vídeo visível só dentro da "janela" da moldura. Reencoda em H.264 pra
// garantir compatibilidade com o Instagram/Facebook independente do codec original.
async function aplicarMoldura(entradaPath, saidaPath) {
  await executarFfmpeg([
    "-y",
    "-i", entradaPath,
    "-i", MOLDURA,
    "-filter_complex",
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[vid];[vid][1:v]overlay=0:0:format=auto[out]",
    "-map", "[out]",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    saidaPath,
  ]);
}

module.exports = { aplicarMoldura };
