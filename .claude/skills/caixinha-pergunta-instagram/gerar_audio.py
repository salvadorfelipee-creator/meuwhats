#!/usr/bin/env python3
"""
Gera o áudio da resposta (voz brasileira nativa, GRÁTIS, sem conta/API key)
pros itens em modo "audio" gerados pelo generate.py — lê resposta_audio.txt
de cada pasta e grava resposta.mp3 ao lado.

Usa edge-tts (motor de voz do Microsoft Edge, exposto sem precisar de conta/
cartão) — mesma qualidade das vozes neurais da Azure. Testado: contas
ElevenLabs no plano free NÃO conseguem usar vozes de biblioteca via API
(erro "payment_required"), por isso não usamos o ElevenLabs por padrão aqui.

Instalar (se faltar): pip install edge-tts

Vozes pt-BR disponíveis (checar outras com `python3 -m edge_tts --list-voices`):
  pt-BR-AntonioNeural   (masculina, default)
  pt-BR-FranciscaNeural (feminina)
  pt-BR-ThalitaMultilingualNeural (feminina)

Uso:
    python3 gerar_audio.py ./saida-caixinha --voz pt-BR-AntonioNeural
"""

import argparse
import asyncio
from pathlib import Path


async def gerar_um(pasta: Path, voz: str):
    import edge_tts
    texto_path = pasta / "resposta_audio.txt"
    if not texto_path.exists():
        return False
    texto = texto_path.read_text(encoding="utf-8").strip()
    if not texto:
        return False
    communicate = edge_tts.Communicate(texto, voz)
    await communicate.save(str(pasta / "resposta.mp3"))
    return True


async def main_async(args):
    root = Path(args.pasta)
    subpastas = sorted([p for p in root.iterdir() if p.is_dir()])
    feitos = 0
    for pasta in subpastas:
        ok = await gerar_um(pasta, args.voz)
        if ok:
            feitos += 1
            print(f"{pasta.name}: áudio gerado")
    print(f"\nPronto: {feitos} áudio(s) gerado(s) em {root.resolve()}")


def main():
    ap = argparse.ArgumentParser(description="Gera os áudios (edge-tts) das respostas em modo audio")
    ap.add_argument("pasta", help="Pasta --out usada no generate.py (contém as subpastas 001/, 002/...)")
    ap.add_argument("--voz", default="pt-BR-AntonioNeural", help="Voz do edge-tts (default: pt-BR-AntonioNeural)")
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
