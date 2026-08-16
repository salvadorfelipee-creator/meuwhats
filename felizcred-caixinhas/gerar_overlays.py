#!/usr/bin/env python3
"""
Gera o overlay transparente (caixinha + pergunta, e no modo texto também
gradiente + resposta) em PNG 1080x1920 com fundo transparente, pra depois
compor por cima de um vídeo de fundo via ffmpeg (em vez de uma foto estática).

Reaproveita as medidas pixel-validadas da skill caixinha-pergunta-instagram
(C:\\Users\\Salvador\\.claude\\skills\\caixinha-pergunta-instagram\\generate.py) —
só remove a camada de fundo (.bg) e ativa fundo transparente no screenshot.

Uso:
    python3 gerar_overlays.py conteudo_master.json --out ./saida --titulo "Bate bola"
"""

import argparse
import json
import sys
from pathlib import Path

CAIXA_TOP = 124
CAIXA_WIDTH = 675
CAIXA_RADIUS = 30
HEADER_HEIGHT = 103
PERGUNTA_MIN_HEIGHT = 189

TEMPLATE_AUDIO = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ background: transparent; }}
  body {{ width:1080px; height:1920px; position:relative; font-family:'Poppins',sans-serif; overflow:hidden; }}
  .caixinha {{ position:absolute; top:{caixa_top}px; left:50%; transform:translateX(-50%); width:{caixa_width}px; border-radius:{caixa_radius}px; overflow:hidden; box-shadow:0 10px 24px rgba(0,0,0,0.28); }}
  .caixinha-header {{ background:#151515; height:{header_height}px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-header .titulo {{ color:#fff; font-weight:600; font-size:26px; line-height:1.2; }}
  .caixinha-pergunta {{ background:#fff; min-height:{pergunta_min_height}px; padding:24px 34px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-pergunta p {{ color:#111111; font-weight:600; font-size:30px; line-height:1.32; text-align:center; margin:0; }}
</style></head>
<body>
  <div class="caixinha">
    <div class="caixinha-header"><div class="titulo">{titulo}</div></div>
    <div class="caixinha-pergunta"><p>{pergunta}</p></div>
  </div>
</body></html>
"""

TEMPLATE_TEXTO = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html, body {{ background: transparent; }}
  body {{ width:1080px; height:1920px; position:relative; font-family:'Poppins',sans-serif; overflow:hidden; }}
  .gradient {{ position:absolute; left:0; right:0; bottom:0; height:46%; background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.78) 70%, rgba(0,0,0,0.94) 100%); }}
  .caixinha {{ position:absolute; top:{caixa_top}px; left:50%; transform:translateX(-50%); width:{caixa_width}px; border-radius:{caixa_radius}px; overflow:hidden; box-shadow:0 10px 24px rgba(0,0,0,0.28); }}
  .caixinha-header {{ background:#151515; height:{header_height}px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-header .titulo {{ color:#fff; font-weight:600; font-size:26px; line-height:1.2; }}
  .caixinha-pergunta {{ background:#fff; min-height:{pergunta_min_height}px; padding:24px 34px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-pergunta p {{ color:#111111; font-weight:600; font-size:30px; line-height:1.32; text-align:center; margin:0; }}
  .resposta {{ position:absolute; left:9%; right:9%; bottom:5.5%; color:#fff; font-weight:400; font-size:30px; line-height:1.42; text-align:center; }}
</style></head>
<body>
  <div class="gradient"></div>
  <div class="caixinha">
    <div class="caixinha-header"><div class="titulo">{titulo}</div></div>
    <div class="caixinha-pergunta"><p>{pergunta}</p></div>
  </div>
  <div class="resposta"><p>{resposta}</p></div>
</body></html>
"""


def build_html(item, titulo):
    tpl = TEMPLATE_AUDIO if item["modo"] == "audio" else TEMPLATE_TEXTO
    return tpl.format(
        titulo=titulo,
        pergunta=item["pergunta"],
        resposta=item.get("resposta", ""),
        caixa_top=CAIXA_TOP,
        caixa_width=CAIXA_WIDTH,
        caixa_radius=CAIXA_RADIUS,
        header_height=HEADER_HEIGHT,
        pergunta_min_height=PERGUNTA_MIN_HEIGHT,
    )


def main():
    ap = argparse.ArgumentParser(description="Gera overlays transparentes (caixinha+resposta) pra compor sobre vídeo de fundo")
    ap.add_argument("conteudo", help="JSON com id/categoria/modo/pergunta/resposta")
    ap.add_argument("--titulo", default="Bate bola")
    ap.add_argument("--out", default="./saida")
    args = ap.parse_args()

    itens = json.loads(Path(args.conteudo).read_text(encoding="utf-8"))
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.emulate_media(color_scheme="light")
        for item in itens:
            pasta = out_dir / f"{item['id']:03d}"
            pasta.mkdir(exist_ok=True)
            html = build_html(item, args.titulo)
            html_path = pasta / "_tmp.html"
            html_path.write_text(html, encoding="utf-8")
            page.goto("file:///" + str(html_path.resolve()).replace("\\", "/"))
            page.wait_for_timeout(150)
            page.screenshot(path=str(pasta / "overlay.png"), omit_background=True)
            html_path.unlink()
            (pasta / "pergunta.txt").write_text(item["pergunta"], encoding="utf-8")
            if item["modo"] == "texto":
                (pasta / "resposta.txt").write_text(item.get("resposta", ""), encoding="utf-8")
            else:
                (pasta / "resposta_audio.txt").write_text(item.get("resposta", ""), encoding="utf-8")
            print(f"item {item['id']:03d} ({item['modo']}) -> {pasta / 'overlay.png'}")
        browser.close()

    print(f"\nPronto: {len(itens)} overlay(s) em {out_dir.resolve()}")


if __name__ == "__main__":
    main()
