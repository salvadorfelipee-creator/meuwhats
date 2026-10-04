#!/usr/bin/env python3
"""
Gerador de carrossel "formato tuiter" — reproduz print de post do X/Twitter
(avatar, nome+selo, @handle, texto, barra de engajamento) usando a logo real
da Felizcred, fontes Sora (nome) + DM Sans (resto), fiel ao layout do X.

Uso:
    python3 generate.py conteudo.json --mode feed --out ./saida
    python3 generate.py conteudo.json --mode story --out ./saida

conteudo.json (lista de slides):
[
  {
    "text": "Texto do post.\n\nPode ter mais de um parágrafo.",
    "link": {"domain": "felizcred.com.br", "title": "Título do artigo do blog"},  # opcional
    "comments": 47,      # opcional — se omitido, gera número plausível crescente
    "retweets": 312,     # opcional
    "likes": 1204         # opcional
  },
  ...
]

"link" (opcional): renderiza o card cinza de link-preview (domínio + título) que
aparece quando um post do X traz um link — igual ao print de referência original.
Usar quando o post existe pra levar tráfego pra um artigo do blog.

Modos:
  feed  -> 1080x1350 (4:5), cartão ocupa a tela toda. Usar pra carrossel de feed.
  story -> 1080x1920 (9:16), cartão branco centralizado dentro do story inteiro,
           com margem de segurança pro cabeçalho e pra barra "Diga algo..." do
           Instagram. Usar SÓ quando for publicar como Story (nunca o "feed"
           direto num story — o Instagram estica/corta e corta o texto).

Cada slide vira um arquivo slide_N.png dentro de --out.
"""

import argparse
import base64
import json
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
ICON_PATH = SKILL_DIR / "assets" / "felizcred-icon.png"

CHECK_SVG = """<svg viewBox="0 0 22 22" width="{size}" height="{size}">
  <path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.573 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.164-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.618l-3.32-3.32 1.293-1.293 2.027 2.027 4.997-4.997 1.293 1.293-6.29 6.29z"/>
</svg>"""

ICON_COMMENT = """<svg viewBox="0 0 24 24" fill="none"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z" stroke="#667080" stroke-width="1.5"/></svg>"""
ICON_RETWEET = """<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H14v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM18.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2H9v-2h6.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14z" fill="#667080"/></svg>"""
ICON_LIKE = """<svg viewBox="0 0 24 24" fill="none"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.06-2.349.74-2.91 1.72-.552.972-.633 2.42.671 4.34a25.5 25.5 0 004.744 5.09L12 18.98l2.19-2.33a25.5 25.5 0 004.745-5.09c1.304-1.92 1.223-3.368.67-4.34-.56-.98-1.665-1.66-2.908-1.72z" stroke="#667080" stroke-width="1.5"/></svg>"""
ICON_SHARE = """<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z" fill="#667080"/></svg>"""

# Card de link-preview (dominio + titulo) que o X mostra quando o post traz um link —
# usado quando o slide tem "link": {"domain": "...", "title": "..."} no JSON de conteudo.
LINK_CARD = """<div class="link-card">
      <div class="link-domain">{domain}</div>
      <div class="link-title">{title}</div>
    </div>"""

FEED_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('{fonts_import}');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    width:1080px; height:1350px;
    background: linear-gradient(180deg, #e8ebee 0%, #f5f6f8 45%, #ffffff 100%);
    font-family:'{fonte_corpo}',sans-serif; position:relative; overflow:hidden;
    display:flex; align-items:center; justify-content:center;
  }}
  .card {{
    width:920px; background:#ffffff; border-radius:28px;
    box-shadow: 0 24px 60px rgba(15,20,25,0.16), 0 2px 8px rgba(15,20,25,0.06);
    padding:64px 56px 52px;
  }}
  .header {{ display:flex; align-items:flex-start; gap:20px; }}
  .avatar {{ width:80px; height:80px; border-radius:50%; background:#ffffff; border:1px solid #eef0f2; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }}
  .avatar img {{ width:68%; height:68%; object-fit:contain; }}
  .identity {{ padding-top:4px; }}
  .name-row {{ display:flex; align-items:center; gap:8px; }}
  .name {{ font-family:'{fonte_nome}',sans-serif; font-size:31px; font-weight:700; color:#0f1419; }}
  .handle {{ margin-top:4px; font-size:23px; color:#667080; font-weight:400; }}
  .post-text {{ margin-top:38px; font-size:35px; line-height:1.42; color:#0f1419; font-weight:400; white-space:pre-line; }}
  .link-card {{ margin-top:28px; border:1px solid #eff3f4; border-radius:16px; padding:22px 24px; }}
  .link-domain {{ font-size:20px; color:#667080; }}
  .link-title {{ margin-top:6px; font-size:26px; font-weight:700; color:#0f1419; line-height:1.3; }}
  .engagement {{ margin-top:42px; display:flex; align-items:center; gap:52px; padding-top:28px; border-top:1px solid #eff3f4; }}
  .metric {{ display:flex; align-items:center; gap:12px; color:#667080; font-size:23px; font-weight:400; }}
  .metric svg {{ width:26px; height:26px; }}
  .metric.share {{ margin-left:auto; }}
</style></head>
<body>
  <div class="card">
    <div class="header">
      <div class="avatar"><img src="{data_uri}"></div>
      <div class="identity">
        <div class="name-row"><span class="name">{nome}</span>{check}</div>
        <div class="handle">{handle}</div>
      </div>
    </div>
    <div class="post-text">{text}</div>
    {link_card}
    <div class="engagement">
      <div class="metric">{icon_comment}<span>{comments}</span></div>
      <div class="metric">{icon_retweet}<span>{retweets}</span></div>
      <div class="metric">{icon_like}<span>{likes}</span></div>
      <div class="metric share">{icon_share}</div>
    </div>
  </div>
</body></html>
"""

STORY_TEMPLATE = """<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('{fonts_import}');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:1080px; height:1920px; background:linear-gradient(180deg,#e8ebee 0%,#f5f6f8 45%,#ffffff 100%); font-family:'{fonte_corpo}',sans-serif; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }}
  .safe {{ position:absolute; top:260px; bottom:260px; left:0; right:0; display:flex; align-items:center; justify-content:center; }}
  .card {{ width:900px; background:#ffffff; border-radius:28px; box-shadow:0 24px 60px rgba(15,20,25,0.18), 0 2px 8px rgba(15,20,25,0.06); padding:56px 52px 44px; }}
  .header {{ display:flex; align-items:flex-start; gap:18px; }}
  .avatar {{ width:72px; height:72px; border-radius:50%; background:#ffffff; border:1px solid #eef0f2; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }}
  .avatar img {{ width:68%; height:68%; object-fit:contain; }}
  .identity {{ padding-top:2px; }}
  .name-row {{ display:flex; align-items:center; gap:7px; }}
  .name {{ font-family:'{fonte_nome}',sans-serif; font-size:29px; font-weight:700; color:#0f1419; }}
  .handle {{ margin-top:3px; font-size:22px; color:#667080; font-weight:400; }}
  .post-text {{ margin-top:32px; font-size:32px; line-height:1.42; color:#0f1419; font-weight:400; white-space:pre-line; }}
  .link-card {{ margin-top:24px; border:1px solid #eff3f4; border-radius:14px; padding:18px 20px; }}
  .link-domain {{ font-size:17px; color:#667080; }}
  .link-title {{ margin-top:5px; font-size:22px; font-weight:700; color:#0f1419; line-height:1.3; }}
  .engagement {{ margin-top:32px; display:flex; align-items:center; gap:40px; padding-top:22px; border-top:1px solid #eff3f4; }}
  .metric {{ display:flex; align-items:center; gap:10px; color:#667080; font-size:19px; font-weight:400; }}
  .metric svg {{ width:22px; height:22px; }}
  .metric.share {{ margin-left:auto; }}
</style></head>
<body>
  <div class="safe"><div class="card">
    <div class="header">
      <div class="avatar"><img src="{data_uri}"></div>
      <div class="identity">
        <div class="name-row"><span class="name">{nome}</span>{check}</div>
        <div class="handle">{handle}</div>
      </div>
    </div>
    <div class="post-text">{text}</div>
    {link_card}
    <div class="engagement">
      <div class="metric">{icon_comment}<span>{comments}</span></div>
      <div class="metric">{icon_retweet}<span>{retweets}</span></div>
      <div class="metric">{icon_like}<span>{likes}</span></div>
      <div class="metric share">{icon_share}</div>
    </div>
  </div></div>
</body></html>
"""


def numeros_padrao(indice, total):
    """Numeros de engajamento plausiveis e crescentes quando o slide nao informa os proprios."""
    base_comments = 45 + indice * 9
    base_retweets = 300 + indice * 35
    base_likes = 1150 + indice * 220
    return base_comments, base_retweets, base_likes


def fmt_milhar(n):
    s = str(n)
    if len(s) <= 3:
        return s
    return f"{s[:-3]}.{s[-3:]}"


def montar_html(slide, indice, total, mode, data_uri, nome, handle, check_svg, fonte_nome, fonte_corpo, fonts_import):
    comments = slide.get("comments")
    retweets = slide.get("retweets")
    likes = slide.get("likes")
    if comments is None or retweets is None or likes is None:
        dc, dr, dl = numeros_padrao(indice, total)
        comments = comments if comments is not None else dc
        retweets = retweets if retweets is not None else dr
        likes = likes if likes is not None else dl

    link_card = ""
    if slide.get("link"):
        link_card = LINK_CARD.format(
            domain=slide["link"].get("domain", ""),
            title=slide["link"].get("title", ""),
        )

    template = FEED_TEMPLATE if mode == "feed" else STORY_TEMPLATE
    return template.format(
        data_uri=data_uri,
        nome=nome,
        check=check_svg,
        handle=handle,
        text=slide["text"],
        link_card=link_card,
        comments=fmt_milhar(comments),
        retweets=fmt_milhar(retweets),
        likes=fmt_milhar(likes),
        icon_comment=ICON_COMMENT,
        icon_retweet=ICON_RETWEET,
        icon_like=ICON_LIKE,
        icon_share=ICON_SHARE,
        fonte_nome=fonte_nome,
        fonte_corpo=fonte_corpo,
        fonts_import=fonts_import,
    )


def main():
    ap = argparse.ArgumentParser(description="Gera carrossel formato tuiter (Felizcred)")
    ap.add_argument("conteudo", help="Caminho pro JSON com a lista de slides")
    ap.add_argument("--mode", choices=["feed", "story"], default="feed",
                     help="feed = 1080x1350 pro carrossel de feed. story = 1080x1920 com cartão centralizado, só pra publicar como Story.")
    ap.add_argument("--out", default="./saida-carrossel", help="Pasta de saída dos PNGs")
    ap.add_argument("--nome", default="Felizcred", help="Nome exibido (default: Felizcred)")
    ap.add_argument("--handle", default="@felizcred", help="@usuário exibido (default: @felizcred)")
    ap.add_argument("--sem-selo", action="store_true", help="Remove o selo azul de verificado")
    ap.add_argument("--icon", default=str(SKILL_DIR / "assets" / "felizcred-icon.png"),
                     help="Caminho do avatar/logo (default: logo da Felizcred)")
    ap.add_argument("--fonte-nome", default="Sora", help="Fonte do nome/título (Google Fonts, default: Sora)")
    ap.add_argument("--fonte-corpo", default="DM Sans", help="Fonte do corpo do texto (Google Fonts, default: DM Sans)")
    args = ap.parse_args()

    slides = json.loads(Path(args.conteudo).read_text(encoding="utf-8"))
    if not isinstance(slides, list) or not slides:
        print("O JSON de conteúdo precisa ser uma lista não vazia de slides."); sys.exit(1)

    icon_path = Path(args.icon)
    if not icon_path.exists():
        print(f"Logo não encontrada em {icon_path}"); sys.exit(1)
    b64 = base64.b64encode(icon_path.read_bytes()).decode()
    data_uri = f"data:image/png;base64,{b64}"
    check_svg = "" if args.sem_selo else CHECK_SVG.format(size=27 if args.mode == "feed" else 25)

    fontes_google = "&".join(f"family={f.replace(' ', '+')}:wght@400;500;600;700" for f in {args.fonte_nome, args.fonte_corpo})
    fonts_import = f"https://fonts.googleapis.com/css2?{fontes_google}&display=swap"

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    html_paths = []
    for i, slide in enumerate(slides, start=1):
        html = montar_html(slide, i - 1, len(slides), args.mode, data_uri, args.nome, args.handle, check_svg,
                            args.fonte_nome, args.fonte_corpo, fonts_import)
        html_path = out_dir / f"slide_{i}.html"
        html_path.write_text(html, encoding="utf-8")
        html_paths.append((i, html_path))

    from playwright.sync_api import sync_playwright
    w, h = (1080, 1350) if args.mode == "feed" else (1080, 1920)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for i, html_path in html_paths:
            page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            page.goto("file:///" + str(html_path.resolve()).replace("\\", "/"))
            page.wait_for_timeout(1000)
            png_path = out_dir / f"slide_{i}.png"
            page.screenshot(path=str(png_path))
            page.close()
            html_path.unlink()
            print(f"slide {i}/{len(slides)} -> {png_path}")
        browser.close()

    print(f"\nPronto: {len(slides)} slide(s) em {out_dir.resolve()}")


if __name__ == "__main__":
    main()
