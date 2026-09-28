#!/usr/bin/env python3
"""
Chama o CLI do Higgsfield (nano_banana_pro) pra gerar 1 fundo por persona
(painel de marca + foto, sem texto nenhum), pras contas Cota Certa e Felizcred.
Salva em media/personas-backgrounds/<slug>.png. Depois disso, gerar_persona_overlay.py
carimba os 5 cards de texto de cada persona em cima do fundo correspondente.
"""

import os
import subprocess
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "media", "personas-backgrounds")
os.makedirs(OUT_DIR, exist_ok=True)

COTACERTA_BASE = """Create a vertical 9:16 Instagram Story background graphic for a Brazilian insurance brand called CotaCerta. Editorial advertising design: warm cream/off-white background, one large white rounded card panel filling most of the frame with a soft realistic drop shadow, a solid blue quarter-circle decorative shape tucked into the top-right corner of the card. Top-left of the card: the wordmark 'CotaCerta' in bold navy sans-serif, with a short blue underline beneath it.

IMPORTANT: leave the entire upper-middle-left area of the card (below the wordmark, roughly the top half of the card) completely EMPTY, plain white, with NO headline text, NO body text, NO other words of any kind anywhere in the image except the 'CotaCerta' wordmark already described. This blank area will have text added later separately.

On the right side of the card, bleeding naturally to the bottom edge and blending into the white panel with a soft gradient (no hard cutout edge, no visible seam), a photorealistic photograph of: {scene}. The photo and the graphic panel must look like one single cohesive professional advertising photograph shot and composited by a real design studio.

Bottom-left of the card: a small thin blue horizontal line, then a small dotted grid pattern in blue dots below that. Leave blank empty space above the dots for a caption to be added later, but do not render any actual caption text there.

No watermark, no logo other than the CotaCerta wordmark described. Professional advertising photography quality, cinematic lighting, sharp focus."""

FELIZCRED_BASE = """Create a vertical 9:16 Instagram Story background graphic for a Brazilian loan/credit correspondent brand called Felizcred. Editorial advertising design: warm cream/off-white background, one large white rounded card panel filling most of the frame with a soft realistic drop shadow, a solid dark-navy quarter-circle decorative shape tucked into the top-right corner of the card. Top-left of the card: the wordmark 'Felizcred' in bold navy sans-serif, with a short green underline beneath it.

IMPORTANT: leave the entire upper-middle-left area of the card (below the wordmark, roughly the top half of the card) completely EMPTY, plain white, with NO headline text, NO body text, NO other words of any kind anywhere in the image except the 'Felizcred' wordmark already described. This blank area will have text added later separately.

On the right side of the card, bleeding naturally to the bottom edge and blending into the white panel with a soft gradient (no hard cutout edge, no visible seam), a photorealistic photograph of: {scene}. The photo and the graphic panel must look like one single cohesive professional advertising photograph shot and composited by a real design studio.

Bottom-left of the card: a small thin green horizontal line, then a small dotted grid pattern in green dots below that. Leave blank empty space above the dots for a caption to be added later, but do not render any actual caption text there.

No watermark, no logo other than the Felizcred wordmark described. Professional advertising photography quality, cinematic lighting, sharp focus."""

COTACERTA_PERSONAS = {
    "camila": "a Brazilian woman in her late 20s working as a self-employed manicurist in a small cozy beauty studio, nail polish bottles neatly organized, warm soft lighting",
    "joao": "a Brazilian electrician in his 40s wearing a hard hat and tool belt, working safely at a residential construction site, daylight",
    "priscila": "a Brazilian female plumber in her mid-30s holding a toolbox, standing in front of a residential house, confident professional posture",
    "marcelo": "a Brazilian event photographer in his early 30s holding a professional camera at an elegant social event, warm string lights in background",
    "larissa": "a Brazilian female graphic designer in her mid-20s working at a home office desk with a laptop, creative organized workspace, plants",
    "andre": "a Brazilian barber in his early 30s in a modern barbershop, tools organized, a client blurred in the background",
    "bianca": "a Brazilian woman in her 30s running an online clothing business, sorting clothes in a small home stock room, packages and a phone nearby",
    "sonia": "a Brazilian woman in her late 40s working as an independent house cleaner, holding cleaning supplies in a bright residential home",
    "carlos": "a Brazilian construction worker (bricklayer) in his 40s wearing safety equipment at a small residential construction site",
    "juliana": "a Brazilian female residential painter in her mid-30s holding a paint roller, colorful freshly painted wall in the background",
    "felipe": "a Brazilian private tutor in his early 30s in a home study room with books and a notebook computer",
    "renata": "a Brazilian female personal trainer in her late 20s coaching a client at a modern gym, professional athletic setting",
    "aline": "a Brazilian nutritionist in her mid-30s in a bright clinic office, clipboard and healthy foods on the desk",
    "marina": "a Brazilian female psychologist in her early 40s in a warm cozy therapy office, no patient visible, calm professional setting",
    "eduardo": "a Brazilian accountant in his mid-40s at an office desk with documents and a computer, corporate professional look",
    "patricia": "a Brazilian female lawyer in her late 30s in a modern law office with legal books and a laptop",
    "gustavo": "a Brazilian architect in his late 30s reviewing a blueprint in a design studio with a small model building and computer",
}

FELIZCRED_PERSONAS = {
    "marta": "a Brazilian woman in her mid-30s wearing a store employee uniform, working as a retail sales associate in a clothing shop, warm daylight",
    "roberto": "a Brazilian man in his early 40s wearing a company driver uniform, standing beside a company van, urban daylight setting",
    "fernanda": "a Brazilian woman in her late 20s working as an administrative assistant at an office desk with paperwork and a computer",
    "ana": "a Brazilian woman in her early 50s working as a registered domestic housekeeper, tidy bright home environment, warm and dignified",
    "marcos": "a Brazilian man in his mid-30s wearing an industrial technician uniform in a factory setting, checking a smartphone app",
}


def gerar_fundo(slug, base_template, scene, out_path):
    if os.path.exists(out_path):
        print("ja existe, pulando:", out_path)
        return
    prompt = base_template.format(scene=scene)
    print(f"\n=== gerando fundo: {slug} ===")
    HIGGSFIELD_BIN = r"C:\Users\Salvador\AppData\Roaming\npm\higgsfield.cmd"
    result = subprocess.run(
        [HIGGSFIELD_BIN, "generate", "create", "nano_banana_pro",
         "--prompt", prompt, "--aspect-ratio", "9:16", "--resolution", "2k"],
        capture_output=True, text=True,
    )
    job_id = result.stdout.strip()
    if not job_id:
        print("ERRO ao criar job", slug, ":", result.stdout, result.stderr)
        return

    wait_result = subprocess.run(
        [HIGGSFIELD_BIN, "generate", "wait", job_id, "--timeout", "3m", "--quiet"],
        capture_output=True, text=True,
    )
    url = wait_result.stdout.strip()
    if not url.startswith("http"):
        print("ERRO ao esperar job", slug, ":", wait_result.stdout, wait_result.stderr)
        return
    urllib.request.urlretrieve(url, out_path)
    print("ok:", out_path)


if __name__ == "__main__":
    for slug, scene in COTACERTA_PERSONAS.items():
        gerar_fundo(slug, COTACERTA_BASE, scene, os.path.join(OUT_DIR, f"{slug}.png"))
    for slug, scene in FELIZCRED_PERSONAS.items():
        gerar_fundo(slug, FELIZCRED_BASE, scene, os.path.join(OUT_DIR, f"felizcred_{slug}.png"))
    print("\n=== TODOS OS FUNDOS GERADOS ===")
