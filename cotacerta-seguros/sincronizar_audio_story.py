#!/usr/bin/env python3
"""
Mesma correção aplicada na Felizcred: o Story de modo áudio do Cota Certa
também deixa de ser mudo — passa a usar o vídeo COM áudio que já está
publicado/agendado como Reels (baixa da URL assinada do R2, já que os
arquivos locais de produção não estão mais neste checkout).

Localiza os pares Story+Reels pendentes pela diferença de 6 minutos entre
os horários (mesmo padrão do PLAYBOOK-COTACERTA-100-CAIXINHAS.md), baixa o
vídeo do Reels de cada par e recria o Story com esse mesmo vídeo.

Uso:
    python3 sincronizar_audio_story.py --dry-run
    python3 sincronizar_audio_story.py
"""

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request

BASE_URL = "https://meuwhats.onrender.com/painel/api/agenda"
AUTH = ("admin", "admin")


def http(method, path, body=None):
    url = BASE_URL if path is None else f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    b64auth = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()
    req.add_header("Authorization", f"Basic {b64auth}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read().decode()


def baixar(url):
    with urllib.request.urlopen(url, timeout=60) as resp:
        return resp.read()


def data_hora_de(ts_ms):
    import datetime
    dt = datetime.datetime.fromtimestamp(ts_ms / 1000, datetime.timezone.utc) + datetime.timedelta(hours=-3)
    return dt.strftime("%Y-%m-%dT%H:%M")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    status, body = http("GET", "/fila")
    fila = json.loads(body)
    cota = [i for i in fila if i.get("conta_id") == "cotacerta"]
    stories = {i["agendado_para"]: i for i in cota if i["redes"] == ["instagram_story"]}
    reels = {i["agendado_para"]: i for i in cota if i["redes"] == ["instagram_reels"]}

    pares = []
    for r_ts, r in reels.items():
        s_ts = r_ts - 6 * 60 * 1000
        if s_ts in stories:
            pares.append((stories[s_ts], r))
    pares.sort(key=lambda p: p[1]["agendado_para"])

    print(f"{len(pares)} par(es) de áudio encontrados.")

    ok, falhas = 0, 0
    for story_item, reels_item in pares:
        if not reels_item.get("videoUrl"):
            print(f"pulando story={story_item['id']}: reels {reels_item['id']} sem videoUrl")
            falhas += 1
            continue

        if args.dry_run:
            print(f"[DRY-RUN] apagaria story={story_item['id']}, recriaria com o vídeo do reels={reels_item['id']}")
            ok += 1
            continue

        try:
            video_bytes = baixar(reels_item["videoUrl"])
        except Exception as e:
            print(f"ERRO ao baixar vídeo do reels {reels_item['id']}: {e}")
            falhas += 1
            continue

        try:
            http("DELETE", f"/{story_item['id']}")
        except urllib.error.HTTPError as e:
            print(f"AVISO: falha ao remover story {story_item['id']}: {e.read().decode()[:200]}")

        video_b64 = f"data:video/mp4;base64,{base64.b64encode(video_bytes).decode()}"
        try:
            _, b = http("POST", None, {
                "contaId": "cotacerta", "texto": "", "redes": ["instagram_story"],
                "data": data_hora_de(story_item["agendado_para"]), "videoBase64": video_b64,
            })
            print(f"story {story_item['id']} -> recriado com áudio: {b[:80]}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"ERRO ao recriar story: {e.read().decode()[:300]}")
            falhas += 1
        time.sleep(1)

    print(f"\nPronto: {ok} atualizado(s), {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
