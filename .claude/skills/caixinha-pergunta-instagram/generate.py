#!/usr/bin/env python3
"""
Gerador de "caixinha de pergunta do Instagram" — reproduz a caixinha nativa
(cabeçalho escuro + campo branco com a pergunta) sobre uma FOTO REAL fornecida
pelo usuário, nunca uma foto gerada por IA.

Validado ao vivo comparando pixel a pixel com um exemplo real (modelo "Bate
bola") até bater exatamente nas proporções — não alterar as medidas abaixo
sem re-validar contra uma referência real.

⚠️ `.resposta` (modo texto): o `bottom` já foi 5.5%, mas um screenshot real
de um Story publicado (Felizcred, 18/08/2026) mostrou o texto colidindo com
a barra nativa de resposta do Instagram ("Responder a [conta]...") que fica
fixa no rodapé por cima de qualquer Story. Corrigido pra `bottom:15%` — deixa
a resposta dentro da "zona segura" (Meta recomenda ~250px de margem inferior
num canvas de 1920px) e livre da barra do app.

Uso:
    python3 generate.py conteudo.json --foto caminho/da/foto.png --modo texto --out ./saida
    python3 generate.py conteudo.json --foto caminho/da/foto.png --modo audio --out ./saida

conteudo.json (lista de itens):
[
  { "pergunta": "Seguro de moto cobre roubo e furto?", "resposta": "Sim. ..." },
  ...
]

Modos:
  texto -> caixinha + pergunta, RESPOSTA ESCRITA no rodapé sobre gradiente escuro.
           Vira 1 arquivo por item: NNN/arte.png (Instagram Story, 1080x1920).
  audio -> caixinha só com a pergunta (SEM resposta escrita — regra fixa desse
           formato). A resposta vai em áudio separadamente, ver gerar_audio.py.

Cada item vira uma pasta NNN/ (numerada a partir de 1) dentro de --out, com
pergunta.txt + resposta.txt (modo texto) ou resposta_audio.txt (modo audio) +
arte.png.
"""

import argparse
import base64
import json
import mimetypes
import sys
from pathlib import Path

# Medidas exatas (canvas 1080x1920) medidas pixel a pixel numa caixinha real
# de referência — não mexer sem comparar de novo com um exemplo real.
CAIXA_TOP = 124
CAIXA_WIDTH = 675
CAIXA_RADIUS = 30
HEADER_HEIGHT = 103
PERGUNTA_MIN_HEIGHT = 189

TEMPLATE_AUDIO = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:1080px; height:1920px; position:relative; font-family:'Poppins',sans-serif; overflow:hidden; }}
  .bg {{ position:absolute; inset:0; width:100%; height:100%; background-image:url('{foto_uri}'); background-size:cover; background-position:center; }}
  .caixinha {{ position:absolute; top:{caixa_top}px; left:50%; transform:translateX(-50%); width:{caixa_width}px; border-radius:{caixa_radius}px; overflow:hidden; box-shadow:0 10px 24px rgba(0,0,0,0.28); }}
  .caixinha-header {{ background:#151515; height:{header_height}px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-header .titulo {{ color:#fff; font-weight:600; font-size:26px; line-height:1.2; }}
  .caixinha-pergunta {{ background:#fff; min-height:{pergunta_min_height}px; padding:24px 34px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-pergunta p {{ color:#111111; font-weight:600; font-size:30px; line-height:1.32; text-align:center; margin:0; }}
</style></head>
<body>
  <div class="bg"></div>
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
  body {{ width:1080px; height:1920px; position:relative; font-family:'Poppins',sans-serif; overflow:hidden; }}
  .bg {{ position:absolute; inset:0; width:100%; height:100%; background-image:url('{foto_uri}'); background-size:cover; background-position:center; }}
  .gradient {{ position:absolute; left:0; right:0; bottom:0; height:46%; background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 35%, rgba(0,0,0,0.78) 70%, rgba(0,0,0,0.94) 100%); }}
  .caixinha {{ position:absolute; top:{caixa_top}px; left:50%; transform:translateX(-50%); width:{caixa_width}px; border-radius:{caixa_radius}px; overflow:hidden; box-shadow:0 10px 24px rgba(0,0,0,0.28); }}
  .caixinha-header {{ background:#151515; height:{header_height}px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-header .titulo {{ color:#fff; font-weight:600; font-size:26px; line-height:1.2; }}
  .caixinha-pergunta {{ background:#fff; min-height:{pergunta_min_height}px; padding:24px 34px; display:flex; align-items:center; justify-content:center; }}
  .caixinha-pergunta p {{ color:#111111; font-weight:600; font-size:30px; line-height:1.32; text-align:center; margin:0; }}
  .resposta {{ position:absolute; left:9%; right:9%; bottom:15%; color:#fff; font-weight:400; font-size:30px; line-height:1.42; text-align:center; }}
</style></head>
<body>
  <div class="bg"></div>
  <div class="gradient"></div>
  <div class="caixinha">
    <div class="caixinha-header"><div class="titulo">{titulo}</div></div>
    <div class="caixinha-pergunta"><p>{pergunta}</p></div>
  </div>
  <div class="resposta"><p>{resposta}</p></div>
</body></html>
"""


def build_html(item, modo, titulo, foto_uri):
    tpl = TEMPLATE_AUDIO if modo == "audio" else TEMPLATE_TEXTO
    return tpl.format(
        foto_uri=foto_uri,
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
    ap = argparse.ArgumentParser(description="Gera caixinha de pergunta do Instagram sobre foto real")
    ap.add_argument("conteudo", help="JSON com a lista de itens {pergunta, resposta}")
    ap.add_argument("--foto", required=True, help="Caminho da foto REAL de fundo (nunca gerar uma nova)")
    ap.add_argument("--modo", choices=["texto", "audio"], default="texto",
                     help="texto = resposta escrita no rodapé. audio = só pergunta (resposta vai em áudio separado)")
    ap.add_argument("--titulo", default="Bate bola", help="Texto do cabeçalho da caixinha (default: 'Bate bola')")
    ap.add_argument("--out", default="./saida-caixinha", help="Pasta de saída")
    args = ap.parse_args()

    itens = json.loads(Path(args.conteudo).read_text(encoding="utf-8"))
    if not isinstance(itens, list) or not itens:
        print("O JSON de conteúdo precisa ser uma lista não vazia de itens."); sys.exit(1)

    foto_path = Path(args.foto)
    if not foto_path.exists():
        print(f"Foto não encontrada em {foto_path}"); sys.exit(1)
    mime = mimetypes.guess_type(str(foto_path))[0] or "image/png"
    b64 = base64.b64encode(foto_path.read_bytes()).decode()
    foto_uri = f"data:{mime};base64,{b64}"

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        for i, item in enumerate(itens, start=1):
            pasta = out_dir / f"{i:03d}"
            pasta.mkdir(exist_ok=True)
            html = build_html(item, args.modo, args.titulo, foto_uri)
            html_path = pasta / "_tmp.html"
            html_path.write_text(html, encoding="utf-8")
            page.goto("file:///" + str(html_path.resolve()).replace("\\", "/"))
            page.wait_for_timeout(150)
            page.screenshot(path=str(pasta / "arte.png"))
            html_path.unlink()
            (pasta / "pergunta.txt").write_text(item["pergunta"], encoding="utf-8")
            if args.modo == "texto":
                (pasta / "resposta.txt").write_text(item.get("resposta", ""), encoding="utf-8")
            else:
                (pasta / "resposta_audio.txt").write_text(item.get("resposta", ""), encoding="utf-8")
            print(f"item {i}/{len(itens)} -> {pasta / 'arte.png'}")
        browser.close()

    print(f"\nPronto: {len(itens)} item(ns) em {out_dir.resolve()}")


if __name__ == "__main__":
    main()
