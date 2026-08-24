#!/usr/bin/env python3
"""
Agenda os 4 temas x 3 formatos dos cards de beneficios da Cota Certa
via POST /painel/api/agenda.

Uso:
    python3 agendar_cards_beneficios.py --dry-run
    python3 agendar_cards_beneficios.py
"""

import argparse
import base64
import io
import json
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_URL = "https://meuwhats.onrender.com/painel/api/agenda"
AUTH = ("admin", "admin")
SOCIAL_DIR = Path(__file__).resolve().parents[0]  # overridden below via --social-dir
CTA_TEXTO = (
    "\n\n💬 Fale com a Cota Certa e personalize seu plano: "
    "https://wa.me/5547996103804"
)

TEMAS = [
    {
        "slug": "empresarial",
        "data_base": "2026-09-01",
        "feed": "feed-seguro-empresarial-roubo-furto-vidro.png",
        "story": "insta-story-seguro-empresarial-roubo-furto-vidro.png",
        "reels": "reels-seguro-empresarial-animado.mp4",
        "texto": (
            "Seu negócio protegido de verdade 🏢 Roubo, furto qualificado, "
            "quebra de vidros, estoque e responsabilidade civil — tudo num "
            "plano feito pra PME." + CTA_TEXTO
        ),
    },
    {
        "slug": "residencial",
        "data_base": "2026-09-08",
        "feed": "feed-seguro-residencial-incendio-roubo-danos-eletricos.png",
        "story": "insta-story-seguro-residencial-incendio-roubo-danos-eletricos.png",
        "reels": "reels-seguro-residencial-incendio-roubo-danos-eletricos-animado.mp4",
        "texto": (
            "Sua casa protegida contra os imprevistos 🏠 Incêndio, roubo, "
            "danos elétricos, assistência 24h e responsabilidade civil "
            "familiar num plano só." + CTA_TEXTO
        ),
    },
    {
        "slug": "funcionarios",
        "data_base": "2026-09-15",
        "feed": "feed-seguro-funcionarios-vida-grupo-acidentes-pessoais.png",
        "story": "insta-story-seguro-funcionarios-vida-grupo-acidentes-pessoais.png",
        "reels": "reels-seguro-funcionarios-vida-grupo-acidentes-pessoais-animado.mp4",
        "texto": (
            "Cuidar do time também é proteger o negócio 👥 Vida em grupo, "
            "acidentes pessoais, assistência funeral e adesão facilitada "
            "pros seus funcionários." + CTA_TEXTO
        ),
    },
    {
        "slug": "frotas",
        "data_base": "2026-09-22",
        "feed": "feed-seguro-frotas-colisao-roubo-responsabilidade-civil.png",
        "story": "insta-story-seguro-frotas-colisao-roubo-responsabilidade-civil.png",
        "reels": "reels-seguro-frotas-colisao-roubo-responsabilidade-civil-animado.mp4",
        "texto": (
            "Sua frota rodando com segurança 🚚 Colisão, roubo, furto, "
            "responsabilidade civil facultativa, carro reserva e gestão "
            "simplificada pra toda a frota." + CTA_TEXTO
        ),
    },
]

HORARIOS = {"feed": "10:00", "story": "13:00", "reels": "18:30"}


def file_base64(path: Path) -> str:
    ext = path.suffix.lstrip(".")
    mime = "video/mp4" if ext == "mp4" else f"image/{ext}"
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


def postar(payload, dry_run):
    if dry_run:
        preview = {
            k: (v if k not in ("videoBase64", "imagemBase64") else f"<{len(v)} chars base64>")
            for k, v in payload.items()
        }
        print("DRY-RUN ->", json.dumps(preview, ensure_ascii=False))
        return True
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL, data=data, method="POST", headers={"Content-Type": "application/json"}
    )
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
    ap.add_argument(
        "--social-dir",
        default=str(Path("cotacerta-seguros/social")),
        help="pasta com os pngs/mp4 dos cards",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    social_dir = Path(args.social_dir)
    ok, falhas = 0, 0

    for tema in TEMAS:
        for formato, filename in [("feed", tema["feed"]), ("story", tema["story"]), ("reels", tema["reels"])]:
            path = social_dir / filename
            if not path.exists():
                print(f"pulando {tema['slug']}/{formato}: {path} não encontrado")
                falhas += 1
                continue

            data_hora = f"{tema['data_base']}T{HORARIOS[formato]}"

            if formato == "feed":
                redes = ["instagram", "facebook", "threads"]
                payload = {
                    "contaId": "cotacerta",
                    "texto": tema["texto"],
                    "redes": redes,
                    "data": data_hora,
                    "imagemBase64": file_base64(path),
                }
            elif formato == "story":
                redes = ["instagram_story"]
                payload = {
                    "contaId": "cotacerta",
                    "texto": "",
                    "redes": redes,
                    "data": data_hora,
                    "imagemBase64": file_base64(path),
                }
            else:  # reels
                redes = ["instagram_reels"]
                payload = {
                    "contaId": "cotacerta",
                    "texto": tema["texto"],
                    "redes": redes,
                    "data": data_hora,
                    "videoBase64": file_base64(path),
                }

            print(f"-> {tema['slug']} / {formato} / {redes} / {data_hora}")
            if postar(payload, args.dry_run):
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
