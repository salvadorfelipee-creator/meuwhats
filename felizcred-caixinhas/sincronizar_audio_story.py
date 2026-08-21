#!/usr/bin/env python3
"""
Revisão pedida pelo usuário: o Story de modo áudio deixa de ser mudo — passa
a usar o MESMO vídeo com áudio do Reels (não é limitação técnica do
Instagram, era só o ffmpeg cortando o áudio de propósito com -an). Quem vir
o Story já ouve a resposta na hora, sem precisar achar o Reels separado.

Pega o vídeo já pronto do Reels (reels_fix.mp4, com selo+texto+áudio) de
cada item de áudio ainda pendente e recria o post de Story usando esse
mesmo arquivo, no mesmo horário já agendado.

Uso:
    python3 sincronizar_audio_story.py schedule.json --saida ./saida --dry-run
    python3 sincronizar_audio_story.py schedule.json --saida ./saida
"""

import argparse
import base64
import datetime
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://meuwhats.onrender.com/painel/api/agenda"
AUTH = ("admin", "admin")


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


def video_base64(path: Path) -> str:
    return f"data:video/mp4;base64,{base64.b64encode(path.read_bytes()).decode()}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("schedule")
    ap.add_argument("--saida", default="./saida")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    schedule = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
    itens_audio = [i for i in schedule if i["modo"] == "audio"]
    saida_root = Path(args.saida)

    status, body = http("GET", "/fila")
    fila = json.loads(body)
    agenda_por_epoch_rede = {}
    for i in fila:
        if i.get("conta_id") == "felizcred" and i["id"] >= 251:
            agenda_por_epoch_rede[(i["agendado_para"], tuple(i["redes"]))] = i["id"]

    ok, pulados, falhas = 0, 0, 0
    for item in itens_audio:
        pasta = saida_root / f"{item['id']:03d}"
        reels_video = pasta / "reels_fix.mp4"
        if not reels_video.exists():
            reels_video = pasta / "reels_v2.mp4"  # fallback pro item já testado antes
        if not reels_video.exists():
            print(f"pulando {item['id']:03d}: nenhum vídeo de reels encontrado")
            pulados += 1
            continue

        story_epoch = epoch_de(item["story_data"])
        story_id = agenda_por_epoch_rede.get((story_epoch, ("instagram_story",)))
        if not story_id:
            print(f"pulando {item['id']:03d}: Story não está mais pendente (já publicado ou não encontrado)")
            pulados += 1
            continue

        if args.dry_run:
            print(f"[DRY-RUN] item {item['id']:03d}: apagaria story={story_id}, recriaria com {reels_video.name} (com áudio)")
            ok += 1
            continue

        try:
            http("DELETE", f"/{story_id}")
        except urllib.error.HTTPError as e:
            print(f"AVISO {item['id']:03d}: falha ao remover {story_id}: {e.read().decode()[:200]}")

        try:
            _, b = http("POST", None, {
                "contaId": "felizcred", "texto": "", "redes": ["instagram_story"],
                "data": item["story_data"], "videoBase64": video_base64(reels_video),
            })
            print(f"item {item['id']:03d}: story recriado com áudio -> {b[:80]}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"ERRO {item['id']:03d}: {e.read().decode()[:300]}")
            falhas += 1
        time.sleep(1)

    print(f"\nPronto: {ok} atualizado(s), {pulados} pulado(s) (já publicados), {falhas} falha(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
