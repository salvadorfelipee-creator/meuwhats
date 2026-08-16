#!/usr/bin/env python3
"""
Compõe o vídeo final de cada item: vídeo de fundo (alternando entre os 2
clipes fornecidos) + overlay transparente (caixinha/resposta) por cima,
via ffmpeg. Substitui a foto estática da skill original por um fundo em
vídeo, intercalando os dois clipes a cada item.

- modo texto -> story.mp4 (mudo, looped até DURACAO_TEXTO segundos)
- modo audio -> story.mp4 (mudo, só pergunta, looped até DURACAO_TEXTO) +
                reels.mp4 (looped até a duração do resposta.mp3, com áudio)

Uso:
    python3 gerar_video_bg.py conteudo_master.json --saida ./saida \
        --video1 "video1.mp4" --video2 "video2.mp4"
"""

import argparse
import json
import subprocess
from pathlib import Path

DURACAO_TEXTO = 6  # segundos de loop pros itens sem narração


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("ERRO:", " ".join(cmd))
        print(result.stderr[-1500:])
        return False
    return True


def compor_silencioso(bg_video: Path, overlay: Path, saida: Path, duracao: int):
    filtro = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0:shortest=0[v]"
    )
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", str(bg_video),
        "-loop", "1", "-i", str(overlay),
        "-filter_complex", filtro,
        "-map", "[v]",
        "-t", str(duracao),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
        str(saida),
    ]
    return run(cmd)


def compor_com_audio(bg_video: Path, overlay: Path, audio: Path, saida: Path):
    filtro = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[v]"
    )
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", str(bg_video),
        "-loop", "1", "-i", str(overlay),
        "-i", str(audio),
        "-filter_complex", filtro,
        "-map", "[v]", "-map", "2:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(saida),
    ]
    return run(cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("conteudo")
    ap.add_argument("--saida", default="./saida")
    ap.add_argument("--video1", required=True)
    ap.add_argument("--video2", required=True)
    args = ap.parse_args()

    itens = json.loads(Path(args.conteudo).read_text(encoding="utf-8"))
    videos = [Path(args.video1), Path(args.video2)]
    saida_root = Path(args.saida)

    feitos = 0
    for item in itens:
        pasta = saida_root / f"{item['id']:03d}"
        overlay = pasta / "overlay.png"
        if not overlay.exists():
            print(f"pulando {item['id']:03d}: overlay.png não encontrado")
            continue

        # alterna os dois vídeos por posição no id (impar/par)
        bg = videos[(item["id"] - 1) % 2]

        story = pasta / "story.mp4"
        if compor_silencioso(bg, overlay, story, DURACAO_TEXTO):
            print(f"{item['id']:03d} ({item['modo']}, fundo={bg.name[:20]}...): story.mp4 ok")
            feitos += 1

        if item["modo"] == "audio":
            audio = pasta / "resposta.mp3"
            if audio.exists():
                reels = pasta / "reels.mp4"
                if compor_com_audio(bg, overlay, audio, reels):
                    print(f"{item['id']:03d}: reels.mp4 ok")
                    feitos += 1

    print(f"\nPronto: {feitos} vídeo(s) gerado(s) em {saida_root.resolve()}")


if __name__ == "__main__":
    main()
