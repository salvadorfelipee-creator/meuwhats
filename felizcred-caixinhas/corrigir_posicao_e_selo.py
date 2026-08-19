#!/usr/bin/env python3
"""
Corrige 2 coisas em TODOS os itens ainda pendentes (exclui os já publicados
#1 e #3): (1) a resposta escrita estava em bottom:5.5%, colidindo com a
barra nativa "Responder a [conta]..." do Instagram (visto num Story real
publicado) — corrigido pra bottom:15%; (2) o selo de áudio do Reels ganha
umas barrinhas de onda sonora, além do ícone, pra ficar mais óbvio que tem
alguém falando ali.

Recompõe overlay + vídeo de cada item e substitui o post pendente
correspondente na agenda (apaga + recria no mesmo horário), já que a API de
agenda não tem "editar".

Uso:
    python3 corrigir_posicao_e_selo.py conteudo_master.json schedule.json \
        --saida ./saida --video1 "..." --video2 "..." --excluir 1,3 --dry-run
    python3 corrigir_posicao_e_selo.py conteudo_master.json schedule.json \
        --saida ./saida --video1 "..." --video2 "..." --excluir 1,3
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

ONDA_HTML = (
    '<div style="display:flex; align-items:center; gap:3px; height:20px;">'
    '<span style="width:4px; height:8px; background:#fff; border-radius:2px;"></span>'
    '<span style="width:4px; height:18px; background:#fff; border-radius:2px;"></span>'
    '<span style="width:4px; height:12px; background:#fff; border-radius:2px;"></span>'
    '<span style="width:4px; height:20px; background:#fff; border-radius:2px;"></span>'
    '<span style="width:4px; height:10px; background:#fff; border-radius:2px;"></span>'
    "</div>"
)

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
  .resposta {{ position:absolute; left:9%; right:9%; bottom:15%; color:#fff; font-weight:400; font-size:30px; line-height:1.42; text-align:center; }}
  .selo-som {{ position:absolute; top:52px; right:40px; background:rgba(0,0,0,0.55); color:#fff; font-weight:600; font-size:22px; padding:10px 20px; border-radius:999px; display:flex; align-items:center; gap:10px; box-shadow:0 4px 14px rgba(0,0,0,0.25); }}
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

SELO_COM_ONDA = f'<div class="selo-som">{ONDA_HTML}Ative o som</div>'


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


def gerar_overlay(page, pasta, nome, item, titulo, selo):
    html = TEMPLATE.format(
        titulo=titulo, pergunta=item["pergunta"], resposta=item["resposta"], selo=selo,
        caixa_top=CAIXA_TOP, caixa_width=CAIXA_WIDTH, caixa_radius=CAIXA_RADIUS,
        header_height=HEADER_HEIGHT, pergunta_min_height=PERGUNTA_MIN_HEIGHT,
    )
    html_path = pasta / "_tmp_fix.html"
    html_path.write_text(html, encoding="utf-8")
    page.goto("file:///" + str(html_path.resolve()).replace("\\", "/"))
    page.wait_for_timeout(150)
    page.screenshot(path=str(pasta / nome), omit_background=True)
    html_path.unlink()


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
    ap.add_argument("conteudo")
    ap.add_argument("schedule")
    ap.add_argument("--saida", default="./saida")
    ap.add_argument("--video1", required=True)
    ap.add_argument("--video2", required=True)
    ap.add_argument("--titulo", default="Bate bola")
    ap.add_argument("--excluir", default="", help="ids separados por vírgula (já publicados, não mexer)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    excluir = {int(x) for x in args.excluir.split(",") if x.strip()}
    conteudo = {i["id"]: i for i in json.loads(Path(args.conteudo).read_text(encoding="utf-8"))}
    schedule = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
    schedule = [s for s in schedule if s["id"] not in excluir]
    videos = [Path(args.video1), Path(args.video2)]
    saida_root = Path(args.saida)

    status, body = http("GET", "/fila")
    fila = json.loads(body)
    agenda_por_epoch_rede = {}
    for i in fila:
        if i.get("conta_id") == "felizcred" and i["id"] >= 251:
            agenda_por_epoch_rede[(i["agendado_para"], tuple(i["redes"]))] = i["id"]

    from playwright.sync_api import sync_playwright
    ok, falhas = 0, 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)

        for sched_item in schedule:
            item = conteudo[sched_item["id"]]
            pasta = saida_root / f"{item['id']:03d}"
            bg = videos[(item["id"] - 1) % 2]

            if item["modo"] == "texto":
                gerar_overlay(page, pasta, "overlay_fix.png", item, args.titulo, "")
                novo_story = pasta / "story_fix.mp4"
                if not compor_silencioso(bg, pasta / "overlay_fix.png", novo_story):
                    falhas += 1
                    continue

                story_epoch = epoch_de(sched_item["story_data"])
                story_id = agenda_por_epoch_rede.get((story_epoch, ("instagram_story",)))
                if args.dry_run:
                    print(f"[DRY-RUN] item {item['id']:03d} (texto): apagaria story={story_id}, recriaria")
                    ok += 1
                    continue
                if story_id:
                    try:
                        http("DELETE", f"/{story_id}")
                    except urllib.error.HTTPError as e:
                        print(f"AVISO {item['id']:03d}: falha ao remover {story_id}: {e.read().decode()[:200]}")
                else:
                    print(f"AVISO {item['id']:03d}: não achei o story pendente pra apagar — só vou criar o novo.")
                try:
                    _, b = http("POST", None, {
                        "contaId": "felizcred", "texto": "", "redes": ["instagram_story"],
                        "data": sched_item["story_data"], "videoBase64": video_base64(novo_story),
                    })
                    print(f"item {item['id']:03d} (texto): recriado -> {b[:80]}")
                    ok += 1
                except urllib.error.HTTPError as e:
                    print(f"ERRO {item['id']:03d}: {e.read().decode()[:300]}")
                    falhas += 1
                time.sleep(1)

            else:  # audio
                gerar_overlay(page, pasta, "overlay_fix_story.png", item, args.titulo, "")
                gerar_overlay(page, pasta, "overlay_fix_reels.png", item, args.titulo, SELO_COM_ONDA)
                novo_story = pasta / "story_fix.mp4"
                novo_reels = pasta / "reels_fix.mp4"
                audio = pasta / "resposta.mp3"
                ok_s = compor_silencioso(bg, pasta / "overlay_fix_story.png", novo_story)
                ok_r = compor_com_audio(bg, pasta / "overlay_fix_reels.png", audio, novo_reels)
                if not (ok_s and ok_r):
                    falhas += 1
                    continue

                story_epoch = epoch_de(sched_item["story_data"])
                reels_epoch = epoch_de(sched_item["reels_data"])
                story_id = agenda_por_epoch_rede.get((story_epoch, ("instagram_story",)))
                reels_id = agenda_por_epoch_rede.get((reels_epoch, ("instagram_reels",)))
                legenda = montar_legenda(item)

                if args.dry_run:
                    print(f"[DRY-RUN] item {item['id']:03d} (audio): apagaria story={story_id} reels={reels_id}, recriaria os dois")
                    ok += 1
                    continue

                for aid, label in ((story_id, "story"), (reels_id, "reels")):
                    if aid:
                        try:
                            http("DELETE", f"/{aid}")
                        except urllib.error.HTTPError as e:
                            print(f"AVISO {item['id']:03d} ({label}): falha ao remover {aid}: {e.read().decode()[:200]}")
                    else:
                        print(f"AVISO {item['id']:03d} ({label}): não achei pendente pra apagar — só vou criar o novo.")

                try:
                    _, b1 = http("POST", None, {
                        "contaId": "felizcred", "texto": "", "redes": ["instagram_story"],
                        "data": sched_item["story_data"], "videoBase64": video_base64(novo_story),
                    })
                    _, b2 = http("POST", None, {
                        "contaId": "felizcred", "texto": legenda, "redes": ["instagram_reels"],
                        "data": sched_item["reels_data"], "videoBase64": video_base64(novo_reels),
                    })
                    print(f"item {item['id']:03d} (audio): recriados -> story {b1[:60]} | reels {b2[:60]}")
                    ok += 1
                except urllib.error.HTTPError as e:
                    print(f"ERRO {item['id']:03d}: {e.read().decode()[:300]}")
                    falhas += 1
                time.sleep(1)

        browser.close()

    print(f"\nPronto: {ok} item(ns) corrigido(s), {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
