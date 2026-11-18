# Reels só com a imagem + piano calmo sintetizado (sem voz, sem texto extra). Uso: python nexus-reels/gerar_piano.py [N ...]
import sys, subprocess, numpy as np, wave, os
from PIL import Image, ImageFilter, ImageEnhance
OUT = "C:/Users/Salvador/Documents/nexus-assets"
os.makedirs(f"{OUT}/piano", exist_ok=True)
sr, D = 44100, 9
PROG = [  # acordes em Hz (C, G, Am, F ...), 4 progressões suaves
 [[261.63,329.63,392.0,493.88],[220.0,261.63,329.63,392.0],[174.61,261.63,329.63,440.0],[196.0,246.94,293.66,392.0]],
 [[196.0,246.94,293.66,369.99],[164.81,196.0,246.94,293.66],[130.81,196.0,261.63,329.63],[146.83,220.0,261.63,329.63]],
 [[220.0,277.18,329.63,415.3],[185.0,220.0,277.18,329.63],[146.83,220.0,293.66,370.0],[164.81,207.65,246.94,329.63]],
 [[174.61,220.0,261.63,329.63],[196.0,246.94,293.66,349.23],[220.0,261.63,329.63,392.0],[130.81,196.0,261.63,329.63]],
]
def piano(i):
    rng = np.random.default_rng(i); out = np.zeros(sr*D)
    def nota(f, t0, dur=3.2, vol=.25):
        t = np.arange(int(dur*sr))/sr
        s = sum(a*np.sin(2*np.pi*f*k*t)*np.exp(-t*(1.2+k*1.1)) for k,a in [(1,1),(2,.45),(3,.2),(4,.1)])
        s *= np.minimum(1, t/0.006); a = int(t0*sr); e = min(len(out), a+len(s)); out[a:e] += vol*s[:e-a]
    ch = PROG[i % 4]; shift = 2**(((i*2) % 5 - 2)/12); step = 0.26 + 0.03*(i % 3); t = .2
    for c in ch:
        nota(c[0]/2*shift, t, vol=.3)
        for j, f in enumerate(c): nota(f*shift*(2 if j == 3 else 1), t+.25+j*step)
        t += 2.2
    out /= max(1, abs(out).max())*1.1
    n = len(out); fade = np.minimum(1, np.minimum(np.arange(n)/sr, (n-np.arange(n))/(sr*1.8)))
    p = f"{OUT}/piano/p_{i:02d}.wav"; w = wave.open(p, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((out*fade*32000).astype(np.int16).tobytes()); w.close(); return p
for i in map(int, sys.argv[1:]):
    n2 = f"{i:02d}"; post = f"{OUT}/posts/post_{n2}.png"
    im = Image.open(post).convert("RGB"); W, H = 1080, 1920
    s = max(W/im.width, H/im.height); bg = im.resize((int(im.width*s)+1, int(im.height*s)+1))
    bg = bg.crop(((bg.width-W)//2, (bg.height-H)//2, (bg.width-W)//2+W, (bg.height-H)//2+H)).filter(ImageFilter.GaussianBlur(40))
    fundo = f"{OUT}/piano/f_{n2}.png"; ImageEnhance.Brightness(bg).enhance(.6).save(fundo)
    wav = piano(i); wr = wav.replace(".wav", "_r.wav")
    subprocess.run(["ffmpeg","-v","error","-y","-i",wav,"-af","aecho=0.8:0.6:60|120:0.25|0.12",wr], check=True)
    h = round(1080*im.height/im.width); y = (1920-h)//2
    flt = f"[1:v]scale=2160:-2,zoompan=z='min(1+0.0001*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={D*30}:s=1080x{h}:fps=30[fg];[0:v][fg]overlay=0:{y},format=yuv420p[v]"
    mp4 = f"{OUT}/piano/reel_{n2}.mp4"
    subprocess.run(["ffmpeg","-v","error","-y","-loop","1","-framerate","30","-i",fundo,"-i",post,"-i",wr,"-filter_complex",flt,"-map","[v]","-map","2:a","-t",str(D),"-r","30","-c:v","libx264","-crf","20","-c:a","aac","-b:a","128k","-movflags","+faststart",mp4], check=True)
    print("ok", n2)
