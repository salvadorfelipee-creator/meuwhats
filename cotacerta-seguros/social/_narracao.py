import asyncio
import edge_tts
import json
import os

VOICE = "pt-BR-AntonioNeural"

BLOCOS = [
    ("intro", "Seguro de Empresa. Proteção contra roubo, furto e vidro."),
    ("b1", "Roubo e furto qualificado: indenização por bens subtraídos com arrombamento ou violência, incluindo equipamentos e mercadorias."),
    ("b2", "Quebra de vidros: reposição de vitrines, fachadas e portas de vidro danificadas."),
    ("b3", "Cobertura para o estoque: proteção do conteúdo da loja contra os eventos previstos na apólice."),
    ("b4", "Responsabilidade civil: indenização por danos causados a terceiros dentro do estabelecimento."),
    ("b5", "Planos para PME: coberturas proporcionais ao porte do negócio, incluindo MEI."),
    ("cta", "Personalize seu plano."),
]

async def gerar():
    os.makedirs("audio_partes", exist_ok=True)
    for nome, texto in BLOCOS:
        path = f"audio_partes/{nome}.mp3"
        comm = edge_tts.Communicate(texto, VOICE, rate="+2%")
        await comm.save(path)
        print(f"gerado {path}")

if __name__ == "__main__":
    asyncio.run(gerar())
