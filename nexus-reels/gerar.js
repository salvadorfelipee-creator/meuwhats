// Transforma os posts soltos da pasta "usar esse" em Reels 9:16 (imagem com zoom lento + locução edge-tts).
// Uso: node nexus-reels/conteudo.js && node nexus-reels/gerar.js [--so N] [--n 1,5,9]
// Saída: C:/Users/Salvador/Documents/nexus-assets/reels/reel_NN.mp4 (fora do repositório)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = "C:/Users/Salvador/Downloads/usar esse";
const OUT = "C:/Users/Salvador/Documents/nexus-assets";
const itens = JSON.parse(fs.readFileSync(path.join(__dirname, "conteudo.json"), "utf8"));
const pngs = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith(".png")).sort();
if (pngs.length !== itens.length) throw new Error(`esperava ${itens.length} PNGs soltos, achei ${pngs.length}`);
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const so = arg("--n") ? arg("--n").split(",").map(Number) : arg("--so") ? [Number(arg("--so"))] : null;

for (const d of ["posts", "reels", "audio", "fundo"]) fs.mkdirSync(`${OUT}/${d}`, { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const dur = (f) => parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));

// fundo 1080x1920: a própria arte desfocada + faixa inferior com a chamada (zona livre da interface do Reels)
const PY = `
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
W, H = 1080, 1920
s = max(W / im.width, H / im.height)
bg = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).filter(ImageFilter.GaussianBlur(38))
bg = ImageEnhance.Brightness(bg).enhance(0.62)
d = ImageDraw.Draw(bg)
f1 = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 54)
f2 = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 40)
def centro(t, y, f, fill):
    w = d.textlength(t, font=f); d.text(((W - w) / 2, y), t, font=f, fill=fill)
d.rounded_rectangle((90, 1560, 990, 1700), radius=40, fill=(255, 122, 26))
centro("Diagnóstico gratuito de 15 min", 1585, f1, (20, 20, 20))
centro("Link na bio · WhatsApp", 1645, f2, (20, 20, 20))
bg.save(out)
`;
fs.writeFileSync(`${OUT}/fundo/_fundo.py`, PY);

for (const it of itens) {
  if (so && !so.includes(it.n)) continue;
  const num = String(it.n).padStart(2, "0");
  const post = `${OUT}/posts/post_${num}.png`;
  fs.copyFileSync(`${SRC}/${pngs[it.n - 1]}`, post);
  const mp3 = `${OUT}/audio/voz_${num}.mp3`;
  run("python", ["-m", "edge_tts", "--voice", "pt-BR-FranciscaNeural", "--rate=+4%", "--text", it.voz, "--write-media", mp3]);
  const fundo = `${OUT}/fundo/fundo_${num}.png`;
  run("python", [`${OUT}/fundo/_fundo.py`, post, fundo]);
  const D = Math.max(8, Math.ceil(dur(mp3) + 1.5));
  const frames = D * 30;
  // zoom lento 1.00 -> ~1.07; arte 1080x1350 posicionada em y=150 (acima da área coberta pela legenda do Reels)
  const filtro = `[1:v]scale=2160:-2,zoompan=z='min(1+0.0001*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1350:fps=30[fg];[0:v][fg]overlay=0:150,format=yuv420p[v];[2:a]adelay=500|500,apad=pad_dur=${D}[a]`;
  const mp4 = `${OUT}/reels/reel_${num}.mp4`;
  run("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-framerate", "30", "-i", fundo, "-i", post, "-i", mp3,
    "-filter_complex", filtro, "-map", "[v]", "-map", "[a]", "-t", String(D), "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mp4]);
  console.log(num, `${D}s`, (fs.statSync(mp4).size / 1e6).toFixed(1) + " MB", it.titulo);
}
