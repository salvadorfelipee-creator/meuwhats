#!/usr/bin/env python3
"""
Combina arte.png + resposta.mp3 (gerados pelo generate.py --modo audio e
gerar_audio.py) num vídeo reels.mp4 pronto pra publicar como Instagram Reels
— mesma imagem da caixinha, virando vídeo estático com a resposta em áudio.

Requer ffmpeg instalado (já confirmado disponível neste ambiente).

Uso:
    python3 gerar_reels.py ./saida-caixinha
"""

import argparse
import subprocess
from pathlib import Path


def gerar_um(pasta: Path):
    arte = pasta / "arte.png"
    audio = pasta / "resposta.mp3"
    if not arte.exists() or not audio.exists():
        return False
    saida = pasta / "reels.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(arte),
        "-i", str(audio),
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", "scale=1080:1920",
        "-shortest",
        str(saida),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERRO em {pasta.name}: {result.stderr[-500:]}")
        return False
    return True


def main():
    ap = argparse.ArgumentParser(description="Gera vídeos de Reels (imagem + áudio) via ffmpeg")
    ap.add_argument("pasta", help="Pasta --out usada no generate.py (contém as subpastas 001/, 002/...)")
    args = ap.parse_args()

    root = Path(args.pasta)
    subpastas = sorted([p for p in root.iterdir() if p.is_dir()])
    feitos = 0
    for pasta in subpastas:
        if gerar_um(pasta):
            feitos += 1
            print(f"{pasta.name}: reels.mp4 ok")
    print(f"\nPronto: {feitos} vídeo(s) gerado(s) em {root.resolve()}")


if __name__ == "__main__":
    main()
