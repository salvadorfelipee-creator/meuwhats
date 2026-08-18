#!/usr/bin/env python3
"""
Revisão pedida pelo usuário: nos 12 itens em modo áudio, a resposta agora
também aparece ESCRITA na imagem (igual ao modo texto) além de narrada —
e o Reels ganha o selo "🔊 Ative o som". Isso muda o Story (mudo) e o Reels
(com áudio) dos 12 itens: os dois recompostos com pergunta+resposta+gradiente,
só o Reels com o selo extra.

Como a API de agenda não tem "editar", os 24 posts (12 Stories + 12 Reels)
são apagados e recriados no mesmo horário, com vídeo (e legenda, no caso do
Reels) atualizados.

Uso:
    python3 atualizar_audio_com_texto.py schedule.json --saida ./saida \
        --video1 "..." --video2 "..." --dry-run
    python3 atualizar_audio_com_texto.py schedule.json --saida ./saida \
        --video1 "..." --video2 "..."
"""

import argparse
import base64
import datetime
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://meuwhats.onrender.com/painel/api/agenda"
AUTH = ("admin", "admin")

CAIXA_TOP = 124
CAIXA_WIDTH = 675
CAIXA_RADIUS = 30
HEADER_HEIGHT = 103
PERGUNTA_MIN_HEIGHT = 189
DURACAO_TEXTO = 6

HASHTAGS_POR_CATEGORIA = {
    "Direitos CLT": "#DireitosDoTrabalhador #CLT #DireitosTrabalhistas",
    "FGTS": "#FGTS #FGTS2026 #TrabalhadorCLT",
    "Demissão": "#Demissão #RescisãoTrabalhista #DireitosCLT",
    "INSS": "#INSS #BenefíciosINSS #AuxílioDoença",
    "Consignado": "#ConsignadoCLT #CréditoDoTrabalhador #EmpréstimoConsignado",
    "PIS/Abono": "#AbonoSalarial #PIS #PISPasep",
    "Golpes": "#GolpeFinanceiro #CuidadoComGolpes #SegurançaFinanceira",
    "Seguros": "#SeguroDeVida #SeguroCLT #ProteçãoFinanceira",
    "Dívidas": "#DesenrolaBrasil #QuitarDívidas #NomeLimpo",
    "Diversos": "#CLT #DireitosTrabalhista #TrabalhadorCLT",
}

TEMPLATE = """<!doctype html>
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
  .selo-som {{ position:absolute; top:52px; right:40px; background:rgba(0,0,0,0.55); color:#fff; font-weight:600; font-size:22px; padding:10px 20px; border-radius:999px; display:flex; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(0,0,0,0.25); }}
</style></head>
<body>
  <div class="gradient"></div>
  {selo}
  <div class="caixinha">
    <div class="caixinha-header"><div class="titulo">{titulo}</div></div>
    <div class="caixinha-pergunta"><p>{pergunta}</p></div>
  </div>
  <div class="resposta"><p>{resposta}</p></div>
</body></html>
"""


def montar_legenda(item):
    tags = HASHTAGS_POR_CATEGORIA.get(item["categoria"], "#CLT #DireitosTrabalhista")
    return (
        f"{item['pergunta']}\n\n"
        f"{item['resposta']}\n\n"
        f"🎧 Ativa o som pra ouvir a resposta na voz.\n"
        f"Tem outra dúvida sobre {item['categoria'].lower()}? Chama a Felizcred no link da bio. 💬\n\n"
        f"#Felizcred {tags}"
    )


def epoch_de(data_str):
    dt = datetime.datetime.strptime(data_str, "%Y-%m-%dT%H:%M")
    dt_utc = dt + datetime.timedelta(hours=3)
    return int(dt_utc.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)


def http(method, path, body=None):
    url = BASE_URL if path is None else f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    b64auth = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()
    req.add_header("Authorization", f"Basic {b64auth}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read().decode()


def gerar_overlays(itens_audio, saida_root, titulo, page):
    for item in itens_audio:
        pasta = saida_root / f"{item['id']:03d}"
        for nome, selo in (("overlay_v2_story.png", ""), ("overlay_v2_reels.png", '<div class="selo-som">🔊 Ative o som</div>')):
            html = TEMPLATE.format(
                titulo=titulo, pergunta=item["pergunta"], resposta=item["resposta"], selo=selo,
                caixa_top=CAIXA_TOP, caixa_width=CAIXA_WIDTH, caixa_radius=CAIXA_RADIUS,
                header_height=HEADER_HEIGHT, pergunta_min_height=PERGUNTA_MIN_HEIGHT,
            )
            html_path = pasta / "_tmp_v2.html"
            html_path.write_text(html, encoding="utf-8")
            page.goto("file:///" + str(html_path.resolve()).replace("\\", "/"))
            page.wait_for_timeout(150)
            page.screenshot(path=str(pasta / nome), omit_background=True)
            html_path.unlink()
        print(f"item {item['id']:03d}: overlays v2 ok")


def compor_silencioso(bg_video, overlay, saida):
    filtro = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[v]"
    cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(bg_video), "-loop", "1", "-i", str(overlay),
           "-filter_complex", filtro, "-map", "[v]", "-t", str(DURACAO_TEXTO),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", str(saida)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERRO ffmpeg (story):", r.stderr[-800:])
        return False
    return True


def compor_com_audio(bg_video, overlay, audio, saida):
    filtro = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[v]"
    cmd = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(bg_video), "-loop", "1", "-i", str(overlay), "-i", str(audio),
           "-filter_complex", filtro, "-map", "[v]", "-map", "2:a",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", str(saida)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("ERRO ffmpeg (reels):", r.stderr[-800:])
        return False
    return True


def video_base64(path: Path) -> str:
    return f"data:video/mp4;base64,{base64.b64encode(path.read_bytes()).decode()}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("schedule")
    ap.add_argument("--saida", default="./saida")
    ap.add_argument("--video1", required=True)
    ap.add_argument("--video2", required=True)
    ap.add_argument("--titulo", default="Bate bola")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    schedule = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
    itens_audio = [i for i in schedule if i["modo"] == "audio"]
    videos = [Path(args.video1), Path(args.video2)]
    saida_root = Path(args.saida)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        gerar_overlays(itens_audio, saida_root, args.titulo, page)
        browser.close()

    status, body = http("GET", "/fila")
    fila = json.loads(body)
    agenda_por_epoch_rede = {}
    for i in fila:
        if i.get("conta_id") == "felizcred" and i["id"] >= 251:
            agenda_por_epoch_rede[(i["agendado_para"], tuple(i["redes"]))] = i["id"]

    ok, falhas = 0, 0
    for item in itens_audio:
        pasta = saida_root / f"{item['id']:03d}"
        bg = videos[(item["id"] - 1) % 2]
        audio = pasta / "resposta.mp3"

        story_novo = pasta / "story_v2.mp4"
        reels_novo = pasta / "reels_v2.mp4"
        ok_story = compor_silencioso(bg, pasta / "overlay_v2_story.png", story_novo)
        ok_reels = compor_com_audio(bg, pasta / "overlay_v2_reels.png", audio, reels_novo)
        if not (ok_story and ok_reels):
            falhas += 1
            continue

        story_epoch = epoch_de(item["story_data"])
        reels_epoch = epoch_de(item["reels_data"])
        story_agenda_id = agenda_por_epoch_rede.get((story_epoch, ("instagram_story",)))
        reels_agenda_id = agenda_por_epoch_rede.get((reels_epoch, ("instagram_reels",)))

        legenda_reels = montar_legenda(item)

        if args.dry_run:
            print(f"[DRY-RUN] item {item['id']:03d}: apagaria story={story_agenda_id} reels={reels_agenda_id}, recriaria os dois")
            ok += 1
            continue

        for agenda_id, label in ((story_agenda_id, "story"), (reels_agenda_id, "reels")):
            if agenda_id:
                try:
                    http("DELETE", f"/{agenda_id}")
                except urllib.error.HTTPError as e:
                    print(f"AVISO {item['id']:03d} ({label}): falha ao remover {agenda_id}: {e.read().decode()[:200]}")
            else:
                print(f"AVISO {item['id']:03d} ({label}): não achei o post atual pra apagar — só vou criar o novo.")

        try:
            _, b1 = http("POST", None, {
                "contaId": "felizcred", "texto": "", "redes": ["instagram_story"],
                "data": item["story_data"], "videoBase64": video_base64(story_novo),
            })
            _, b2 = http("POST", None, {
                "contaId": "felizcred", "texto": legenda_reels, "redes": ["instagram_reels"],
                "data": item["reels_data"], "videoBase64": video_base64(reels_novo),
            })
            print(f"item {item['id']:03d}: recriados -> story {b1[:80]} | reels {b2[:80]}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"ERRO {item['id']:03d}: {e.read().decode()[:300]}")
            falhas += 1
        time.sleep(1)

    print(f"\nPronto: {ok} item(ns) atualizado(s) (story+reels), {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
