import asyncio
import edge_tts
import os

VOICE = "pt-BR-AntonioNeural"

BLOCOS = [
    ("intro", "Seguro de Empresa. Roubo, furto e vidro."),
    ("b1", "Roubo e furto qualificado."),
    ("b2", "Quebra de vidros."),
    ("b3", "Cobertura para o estoque."),
    ("b4", "Responsabilidade civil."),
    ("b5", "Planos para PME."),
    ("cta", "Personalize seu plano."),
]

async def gerar():
    os.makedirs("audio_partes", exist_ok=True)
    for nome, texto in BLOCOS:
        path = f"audio_partes/{nome}.mp3"
        comm = edge_tts.Communicate(texto, VOICE, rate="+4%")
        await comm.save(path)
        print(f"gerado {path}")

if __name__ == "__main__":
    asyncio.run(gerar())
