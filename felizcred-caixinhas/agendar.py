#!/usr/bin/env python3
"""
Agenda os 50 Stories (+ 12 Reels correspondentes) via POST /painel/api/agenda.
Lê schedule.json (gerado por montar_ordem.py) + os vídeos finais em
saida/NNN/story.mp4 (e reels.mp4 pros itens em modo áudio).

Uso:
    python3 agendar.py schedule.json --saida ./saida --dry-run
    python3 agendar.py schedule.json --saida ./saida
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import urllib.request

BASE_URL = "https://meuwhats.onrender.com/painel/api/agenda"
AUTH = ("admin", "admin")


def video_base64(path: Path) -> str:
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:video/mp4;base64,{b64}"


def postar(payload, dry_run):
    if dry_run:
        preview = {k: (v if k != "videoBase64" else f"<{len(v)} chars base64>") for k, v in payload.items()}
        print("DRY-RUN ->", json.dumps(preview, ensure_ascii=False))
        return True
    import urllib.error
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(BASE_URL, data=data, method="POST", headers={"Content-Type": "application/json"})
    b64auth = base64.b64encode(f"{AUTH[0]}:{AUTH[1]}".encode()).decode()
    req.add_header("Authorization", f"Basic {b64auth}")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode()
            print(f"OK {resp.status}: {body[:150]}")
            return True
    except urllib.error.HTTPError as e:
        print(f"ERRO {e.code}: {e.read().decode()[:300]}")
        return False
    except Exception as e:
        print(f"ERRO: {e}")
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("schedule")
    ap.add_argument("--saida", default="./saida")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    schedule = json.loads(Path(args.schedule).read_text(encoding="utf-8"))
    saida_root = Path(args.saida)

    ok, falhas = 0, 0
    for item in schedule:
        pasta = saida_root / f"{item['id']:03d}"
        story_path = pasta / "story.mp4"
        if not story_path.exists():
            print(f"pulando {item['id']:03d}: story.mp4 não encontrado")
            falhas += 1
            continue

        payload_story = {
            "contaId": "felizcred",
            "texto": "",
            "redes": ["instagram_story"],
            "data": item["story_data"],
            "videoBase64": video_base64(story_path),
        }
        if postar(payload_story, args.dry_run):
            ok += 1
        else:
            falhas += 1
        if not args.dry_run:
            time.sleep(1)

        if item["modo"] == "audio":
            reels_path = pasta / "reels.mp4"
            if not reels_path.exists():
                print(f"pulando reels {item['id']:03d}: reels.mp4 não encontrado")
                falhas += 1
                continue
            cta = "\n\n🎧 Responde em áudio — ativa o som. Dúvida sobre CLT, FGTS ou crédito? Chama a Felizcred no link da bio."
            payload_reels = {
                "contaId": "felizcred",
                "texto": item["pergunta"] + cta,
                "redes": ["instagram_reels"],
                "data": item["reels_data"],
                "videoBase64": video_base64(reels_path),
            }
            if postar(payload_reels, args.dry_run):
                ok += 1
            else:
                falhas += 1
            if not args.dry_run:
                time.sleep(1)

    print(f"\nPronto: {ok} post(s) agendado(s), {falhas} falha(s)/pulado(s).")
    if falhas:
        sys.exit(1)


if __name__ == "__main__":
    main()
