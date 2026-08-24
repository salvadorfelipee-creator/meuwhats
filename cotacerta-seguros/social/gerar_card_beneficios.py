#!/usr/bin/env python3
"""
Gerador parametrizado do "card de benefícios" da Cota Certa — ver
PLAYBOOK-COTACERTA-CARDS-BENEFICIOS.md na raiz do repo.

Pra cada tema (spec dict) gera 3 arquivos em cotacerta-seguros/social/:
  - insta-story-<slug>.png   (1080x1920, estático)
  - feed-<slug>.png          (1080x1350, estático)
  - reels-<slug>-animado.mp4 (1080x1920, narração só dos títulos + partículas
    + botão pulsando, <=19s)

Uso:
    python3 gerar_card_beneficios.py
"""

import asyncio
import os
import subprocess

import edge_tts
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = "pt-BR-AntonioNeural"

WHATSAPP_ICON_SVG = (
    '<svg viewBox="0 0 24 24">'
    '<path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 '
    '5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.07c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.08.28-3.63-.76-3.05-1.24-5-4.36-5.15-4.56-.15-.2-1.23-1.64-1.23-3.13s.78-2.22 '
    '1.06-2.53c.28-.31.6-.38.8-.38h.58c.18 0 .43-.07.67.51.24.6.83 2.06.9 2.21.07.15.12.33.02.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.53-.15.15-.31.31-.13.61.18.3.8 1.32 1.72 2.14 '
    '1.18 1.05 2.18 1.38 2.48 1.53.3.15.48.13.65-.08.18-.2.77-.9.98-1.2.2-.3.4-.25.68-.15.28.1 1.78.84 2.08.99.3.15.5.23.58.36.07.13.07.75-.17 1.43z"/></svg>'
)


def bullets_html(bullets):
    out = []
    for b in bullets:
        out.append(
            f'        <div class="bullet">\n'
            f'          <div class="dot"></div>\n'
            f'          <p><b>{b["titulo"]}:</b> {b["desc"]}</p>\n'
            f'        </div>'
        )
    return "\n".join(out)


def bullets_html_animado(bullets):
    out = []
    for i, b in enumerate(bullets, start=1):
        out.append(
            f'        <div class="bullet reveal" id="b{i}">\n'
            f'          <div class="dot"></div>\n'
            f'          <p><b>{b["titulo"]}:</b> {b["desc"]}</p>\n'
            f'        </div>'
        )
    return "\n".join(out)


STORY_TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Cota Certa — __TITLE__ __BADGE__</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter',Arial,sans-serif;}
  .post{position:relative;width:1080px;height:1920px;
    background:linear-gradient(180deg,#ffffff 0%,#f4f5f8 55%,#eef0f5 100%);overflow:hidden;}

  .content{position:absolute;left:50%;top:420px;transform:translateX(-50%);width:860px;
    display:flex;flex-direction:column;align-items:center;text-align:center;}

  .title{font-family:'Poppins',sans-serif;font-weight:700;font-size:64px;color:#0052CC;
    line-height:1.15;margin-bottom:26px;}

  .badge{display:inline-block;background:#0052CC;border-radius:34px;padding:22px 46px;
    box-shadow:0 20px 38px -14px rgba(0,82,204,.5);}
  .badge span{font-family:'Poppins',sans-serif;font-weight:800;font-size:68px;color:#EAF1FF;
    letter-spacing:.5px;}

  .bullets{margin-top:64px;display:flex;flex-direction:column;gap:38px;width:100%;text-align:left;}
  .bullet{display:flex;align-items:flex-start;gap:22px;}
  .dot{flex-shrink:0;width:16px;height:16px;border-radius:50%;background:#0066FF;margin-top:14px;}
  .bullet p{font-size:31px;line-height:1.5;color:#1A1D29;}
  .bullet p b{color:#0052CC;font-weight:700;}

  .cta{margin-top:60px;display:inline-flex;align-items:center;gap:14px;background:#ffffff;
    border:2px solid #25D366;border-radius:18px;padding:16px 22px;max-width:720px;text-align:left;}
  .cta .icon{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#25D366;
    display:flex;align-items:center;justify-content:center;}
  .cta .icon svg{width:19px;height:19px;fill:#fff;}
  .cta p{font-size:24px;line-height:1.4;color:#1A1D29;font-weight:700;letter-spacing:.3px;}
  .cta .arrow{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#EAF1FF;
    display:flex;align-items:center;justify-content:center;}
  .cta .arrow svg{width:15px;height:15px;}
</style>
</head>
<body>
  <div class="post">
    <div class="content">
      <div class="title">__TITLE__</div>
      <div class="badge"><span>__BADGE__</span></div>

      <div class="bullets">
__BULLETS__
      </div>

      <div class="cta">
        <div class="icon">__WA_ICON__</div>
        <p>__CTA__</p>
        <div class="arrow">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#0052CC" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
"""

FEED_TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Cota Certa — __TITLE__ __BADGE__ (feed)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1350px;overflow:hidden;font-family:'Inter',Arial,sans-serif;}
  .post{position:relative;width:1080px;height:1350px;
    background:linear-gradient(180deg,#ffffff 0%,#f4f5f8 55%,#eef0f5 100%);overflow:hidden;
    display:flex;align-items:center;justify-content:center;}

  .content{width:900px;display:flex;flex-direction:column;align-items:center;text-align:center;}

  .title{font-family:'Poppins',sans-serif;font-weight:700;font-size:50px;color:#0052CC;
    line-height:1.15;margin-bottom:18px;}

  .badge{display:inline-block;background:#0052CC;border-radius:28px;padding:15px 32px;
    box-shadow:0 16px 30px -12px rgba(0,82,204,.5);}
  .badge span{font-family:'Poppins',sans-serif;font-weight:800;font-size:48px;color:#EAF1FF;
    letter-spacing:.4px;}

  .bullets{margin-top:38px;display:flex;flex-direction:column;gap:22px;width:100%;text-align:left;}
  .bullet{display:flex;align-items:flex-start;gap:16px;}
  .dot{flex-shrink:0;width:13px;height:13px;border-radius:50%;background:#0066FF;margin-top:10px;}
  .bullet p{font-size:24px;line-height:1.42;color:#1A1D29;}
  .bullet p b{color:#0052CC;font-weight:700;}

  .cta{margin-top:34px;display:inline-flex;align-items:center;gap:12px;background:#ffffff;
    border:2px solid #25D366;border-radius:16px;padding:13px 20px;max-width:760px;text-align:left;}
  .cta .icon{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#25D366;
    display:flex;align-items:center;justify-content:center;}
  .cta .icon svg{width:16px;height:16px;fill:#fff;}
  .cta p{font-size:19px;line-height:1.35;color:#1A1D29;font-weight:600;}
</style>
</head>
<body>
  <div class="post">
    <div class="content">
      <div class="title">__TITLE__</div>
      <div class="badge"><span>__BADGE__</span></div>

      <div class="bullets">
__BULLETS__
      </div>

      <div class="cta">
        <div class="icon">__WA_ICON__</div>
        <p>__CTA__</p>
      </div>
    </div>
  </div>
</body>
</html>
"""

ANIMADO_TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Cota Certa — __TITLE__ __BADGE__ (animado)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1080px;height:1920px;overflow:hidden;font-family:'Inter',Arial,sans-serif;}
  .post{position:relative;width:1080px;height:1920px;
    background:linear-gradient(180deg,#ffffff 0%,#f4f5f8 55%,#eef0f5 100%);overflow:hidden;}

  .content{position:absolute;left:50%;top:420px;transform:translateX(-50%);width:860px;
    display:flex;flex-direction:column;align-items:center;text-align:center;}

  .title{font-family:'Poppins',sans-serif;font-weight:700;font-size:64px;color:#0052CC;
    line-height:1.15;margin-bottom:26px;}

  .badge{display:inline-block;background:#0052CC;border-radius:34px;padding:22px 46px;
    box-shadow:0 20px 38px -14px rgba(0,82,204,.5);}
  .badge span{font-family:'Poppins',sans-serif;font-weight:800;font-size:68px;color:#EAF1FF;
    letter-spacing:.5px;}

  .bullets{margin-top:64px;display:flex;flex-direction:column;gap:38px;width:100%;text-align:left;}
  .bullet{display:flex;align-items:flex-start;gap:22px;}
  .dot{flex-shrink:0;width:16px;height:16px;border-radius:50%;background:#0066FF;margin-top:14px;position:relative;}
  .bullet p{font-size:31px;line-height:1.5;color:#1A1D29;}
  .bullet p b{color:#0052CC;font-weight:700;}

  .cta{margin-top:60px;display:inline-flex;align-items:center;gap:14px;background:#ffffff;
    border:2px solid #25D366;border-radius:18px;padding:16px 22px;max-width:720px;text-align:left;position:relative;}
  .cta .icon{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#25D366;
    display:flex;align-items:center;justify-content:center;}
  .cta .icon svg{width:19px;height:19px;fill:#fff;}
  .cta p{font-size:24px;line-height:1.4;color:#1A1D29;font-weight:700;letter-spacing:.3px;flex:1;}
  .cta .arrow{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:#EAF1FF;
    display:flex;align-items:center;justify-content:center;}
  .cta .arrow svg{width:15px;height:15px;}

  .reveal{opacity:0;transform:translateY(22px) scale(.97);
    transition:opacity .5s ease, transform .5s ease;}
  .reveal.visible{opacity:1;transform:translateY(0) scale(1);}

  .cta.pulsing{animation:pulse 1s ease-in-out infinite;}
  @keyframes pulse{
    0%,100%{box-shadow:0 0 0 0 rgba(37,211,102,.55);}
    50%{box-shadow:0 0 0 18px rgba(37,211,102,0);}
  }

  .particle{position:absolute;border-radius:50%;background:#0066FF;pointer-events:none;
    left:50%;top:50%;width:8px;height:8px;
    animation:burst .7s ease-out forwards;}
  .particle.green{background:#25D366;}
  @keyframes burst{
    0%{opacity:1;transform:translate(-50%,-50%) scale(1);}
    100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.3);}
  }
</style>
</head>
<body>
  <div class="post">
    <div class="content">
      <div class="title reveal" id="title">__TITLE__</div>
      <div class="badge reveal" id="badge"><span>__BADGE__</span></div>

      <div class="bullets">
__BULLETS_ANIMADO__
      </div>

      <div class="cta reveal" id="cta">
        <div class="icon">__WA_ICON__</div>
        <p>__CTA__</p>
        <div class="arrow">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#0052CC" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
    </div>
  </div>

<script>
  function burst(el, color, count){
    color = color || 'blue';
    count = count || 10;
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width/2;
    var cy = rect.top + rect.height/2;
    for(var i=0;i<count;i++){
      var p = document.createElement('div');
      p.className = 'particle' + (color === 'green' ? ' green' : '');
      var angle = (Math.PI*2*i/count) + (Math.random()*0.5);
      var dist = 60 + Math.random()*70;
      p.style.setProperty('--dx', (Math.cos(angle)*dist)+'px');
      p.style.setProperty('--dy', (Math.sin(angle)*dist)+'px');
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.position = 'fixed';
      document.body.appendChild(p);
      (function(el){ setTimeout(function(){ el.remove(); }, 750); })(p);
    }
  }

  function reveal(id, color, count){
    var el = document.getElementById(id);
    el.classList.add('visible');
    burst(el, color, count);
    if(id === 'cta'){ el.classList.add('pulsing'); }
  }

  var timeline = __TIMELINE__;

  timeline.forEach(function(step){
    setTimeout(function(){ reveal(step[1], step[2], step[3]); }, step[0]*1000);
  });
</script>
</body>
</html>
"""


def fill(template, spec, bullets_fn):
    return (
        template
        .replace("__TITLE__", spec["title"])
        .replace("__BADGE__", spec["badge"])
        .replace("__CTA__", spec["cta_text"])
        .replace("__WA_ICON__", WHATSAPP_ICON_SVG)
        .replace("__BULLETS_ANIMADO__", bullets_html_animado(spec["bullets"]))
        .replace("__BULLETS__", bullets_html(spec["bullets"]))
    )


def screenshot(html_path, png_path, width, height):
    url = "file:///" + os.path.abspath(html_path).replace("\\", "/")
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": width, "height": height})
        page.goto(url)
        page.wait_for_timeout(300)
        page.screenshot(path=png_path)
        b.close()


async def _gerar_narracao_async(blocos, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for nome, texto in blocos:
        path = os.path.join(out_dir, f"{nome}.mp3")
        comm = edge_tts.Communicate(texto, VOICE, rate="+8%")
        await comm.save(path)


def gerar_narracao(spec, audio_dir):
    badge_fala = spec.get("badge_fala", spec["badge"])
    blocos = [("intro", f'{spec["title"]}. {badge_fala}.')]
    for i, b in enumerate(spec["bullets"], start=1):
        fala = b.get("fala", b["titulo"])
        blocos.append((f"b{i}", f'{fala}.'))
    blocos.append(("cta", spec["cta_text"].capitalize() + "."))
    asyncio.run(_gerar_narracao_async(blocos, audio_dir))
    return [nome for nome, _ in blocos]


def duracao(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def montar_audio_e_timeline(nomes, audio_dir):
    silence = os.path.join(audio_dir, "silence.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", "0.1", "-q:a", "9", "-acodec", "libmp3lame", silence],
        capture_output=True, check=True,
    )

    inputs = []
    for nome in nomes:
        inputs.append(os.path.join(audio_dir, f"{nome}.mp3"))
        inputs.append(silence)
    inputs = inputs[:-1]  # remove o silêncio depois do último bloco

    cmd = ["ffmpeg", "-y"]
    for f in inputs:
        cmd += ["-i", f]
    n = len(inputs)
    filtro = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[out]"
    saida = os.path.join(audio_dir, "narracao_completa.mp3")
    cmd += ["-filter_complex", filtro, "-map", "[out]", saida]
    subprocess.run(cmd, capture_output=True, check=True)

    total = 0.0
    timeline = []
    cores_contagem = [("title", "blue", 14), ("badge", "blue", 16),
                       ("b1", "blue", 8), ("b2", "blue", 8), ("b3", "blue", 8),
                       ("b4", "blue", 8), ("b5", "blue", 8), ("cta", "green", 18)]
    # intro cobre title+badge (dois reveals dentro do mesmo bloco de áudio)
    dur_intro = duracao(os.path.join(audio_dir, "intro.mp3"))
    timeline.append([0.05, "title", "blue", 14])
    timeline.append([round(dur_intro * 0.45, 3), "badge", "blue", 16])
    t = dur_intro + 0.1
    for i in range(1, 6):
        timeline.append([round(t, 3), f"b{i}", "blue", 8])
        t += duracao(os.path.join(audio_dir, f"b{i}.mp3")) + 0.1
    timeline.append([round(t, 3), "cta", "green", 18])
    t += duracao(os.path.join(audio_dir, "cta.mp3"))

    return saida, timeline, t


def gravar_video(html_path, out_webm_dir, duration_ms):
    os.makedirs(out_webm_dir, exist_ok=True)
    url = "file:///" + os.path.abspath(html_path).replace("\\", "/")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 1080, "height": 1920},
            record_video_dir=out_webm_dir,
            record_video_size={"width": 1080, "height": 1920},
        )
        page = context.new_page()
        page.goto(url)
        page.wait_for_timeout(duration_ms)
        video_path = page.video.path()
        context.close()
        browser.close()
    return video_path


def gerar_tema(spec):
    slug = spec["slug"]
    print(f"\n=== {spec['title']} ({slug}) ===")

    # --- Story ---
    story_html = os.path.join(HERE, f"insta-story-{slug}.html")
    story_png = os.path.join(HERE, f"insta-story-{slug}.png")
    with open(story_html, "w", encoding="utf-8") as f:
        f.write(fill(STORY_TEMPLATE, spec, bullets_html))
    screenshot(story_html, story_png, 1080, 1920)
    print(f"story ok: {story_png}")

    # --- Feed ---
    feed_html = os.path.join(HERE, f"feed-{slug}.html")
    feed_png = os.path.join(HERE, f"feed-{slug}.png")
    with open(feed_html, "w", encoding="utf-8") as f:
        f.write(fill(FEED_TEMPLATE, spec, bullets_html))
    screenshot(feed_html, feed_png, 1080, 1350)
    print(f"feed ok: {feed_png}")

    # --- Reels animado ---
    audio_dir = os.path.join(HERE, f"_audio_{slug}")
    nomes = gerar_narracao(spec, audio_dir)
    audio_final, timeline, dur_total = montar_audio_e_timeline(nomes, audio_dir)
    print(f"narração: {dur_total:.1f}s")
    if dur_total > 19.5:
        print(f"AVISO: narração passou de 19s ({dur_total:.1f}s) — encurtar títulos")

    animado_html = os.path.join(HERE, f"reels-{slug}-animado.html")
    import json as _json
    html = fill(ANIMADO_TEMPLATE, spec, bullets_html).replace(
        "__TIMELINE__", _json.dumps(timeline)
    )
    with open(animado_html, "w", encoding="utf-8") as f:
        f.write(html)

    video_dir = os.path.join(HERE, f"_video_raw_{slug}")
    webm_path = gravar_video(animado_html, video_dir, int((dur_total + 1.2) * 1000))

    mp4_path = os.path.join(HERE, f"reels-{slug}-animado.mp4")
    subprocess.run(
        ["ffmpeg", "-y", "-i", webm_path, "-i", audio_final,
         "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-crf", "18", "-c:a", "aac", "-b:a", "192k", "-shortest", mp4_path],
        capture_output=True, check=True,
    )
    print(f"reels ok: {mp4_path}")

    # limpeza de arquivos intermediários
    import shutil
    shutil.rmtree(video_dir, ignore_errors=True)

    return {"story": story_png, "feed": feed_png, "reels": mp4_path}


TEMAS = [
    {
        "slug": "seguro-residencial-incendio-roubo-danos-eletricos",
        "title": "Seguro Residencial",
        "badge": "incêndio, roubo e danos elétricos",
        "badge_fala": "incêndio, roubo e elétrica",
        "bullets": [
            {"titulo": "Incêndio, raio e explosão", "fala": "Incêndio e explosão", "desc": "proteção patrimonial contra sinistros graves na casa."},
            {"titulo": "Roubo e furto qualificado", "fala": "Roubo e furto", "desc": "indenização por bens subtraídos com arrombamento."},
            {"titulo": "Danos elétricos", "desc": "cobertura para eletrodomésticos e equipamentos danificados por sobrecarga."},
            {"titulo": "Responsabilidade civil familiar", "fala": "Responsabilidade civil", "desc": "danos causados a terceiros dentro ou fora de casa."},
            {"titulo": "Assistência residencial 24h", "fala": "Assistência 24 horas", "desc": "chaveiro, eletricista e encanador de emergência."},
        ],
        "cta_text": "PERSONALIZE SEU PLANO",
    },
    {
        "slug": "seguro-funcionarios-vida-grupo-acidentes-pessoais",
        "title": "Seguro para Funcionários",
        "badge": "vida em grupo e acidentes pessoais",
        "badge_fala": "vida em grupo e acidentes",
        "bullets": [
            {"titulo": "Vida em grupo", "desc": "indenização aos beneficiários em caso de morte do colaborador."},
            {"titulo": "Acidentes pessoais coletivo", "fala": "Acidentes pessoais", "desc": "cobertura por invalidez ou morte acidental (APC)."},
            {"titulo": "Assistência funeral", "desc": "suporte à família em caso de falecimento."},
            {"titulo": "Invalidez por acidente", "desc": "indenização proporcional ao grau da invalidez."},
            {"titulo": "Adesão facilitada", "desc": "sem exames médicos, contratação simplificada pra empresa."},
        ],
        "cta_text": "PERSONALIZE SEU PLANO",
    },
    {
        "slug": "seguro-frotas-colisao-roubo-responsabilidade-civil",
        "title": "Seguro de Frotas",
        "badge": "colisão, roubo e responsabilidade civil",
        "badge_fala": "colisão, roubo e RC",
        "bullets": [
            {"titulo": "Cobertura para toda a frota", "fala": "Toda a frota", "desc": "uma única apólice pra todos os veículos da empresa."},
            {"titulo": "Colisão, roubo e furto", "desc": "proteção contra os principais sinistros da operação."},
            {"titulo": "Responsabilidade civil facultativa", "fala": "Responsabilidade civil", "desc": "cobre danos a terceiros causados pelos veículos (RCF)."},
            {"titulo": "Carro reserva", "desc": "mantém a operação rodando enquanto o veículo é reparado."},
            {"titulo": "Gestão simplificada", "desc": "um vencimento único pra toda a frota, sem controle apólice por apólice."},
        ],
        "cta_text": "PERSONALIZE SEU PLANO",
    },
]


if __name__ == "__main__":
    resultados = {}
    for spec in TEMAS:
        resultados[spec["slug"]] = gerar_tema(spec)
    print("\n=== TUDO PRONTO ===")
    for slug, r in resultados.items():
        print(slug, r)
