#!/usr/bin/env python3
"""
Gera os 5 cards de cada persona restante (sem Higgsfield disponivel hoje),
reaproveitando o motor CSS/Playwright + foto de banco gratuita ja validado em
gerar_stories_funil.py. Le o texto de cada card de gerar_persona_overlay.py
(mesmo conteudo, so troca o motor de renderizacao).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gerar_stories_funil as funil
import gerar_persona_overlay as personas

ASSETS = os.path.join(funil.HERE, "media", "stories-assets")
OUT_ROOT = os.path.join(funil.HERE, "media", "stories-review-personas")

# slug -> (arquivo de foto, photo_pos)
FOTOS_COTACERTA = {
    "camila": ("p_camila.jpeg", "center 30%"),
    "joao": ("p_joao_v2.jpeg", "center 20%"),
    "priscila": ("p_priscila.jpeg", "center 25%"),
    "marcelo": ("p_marcelo.jpeg", "center 25%"),
    "larissa": ("p_larissa.jpeg", "center 25%"),
    "andre": ("p_andre.jpeg", "center 25%"),
    "bianca": ("p_bianca.jpeg", "center 25%"),
    "sonia": ("p_sonia.jpeg", "center 30%"),
    "carlos": ("p_carlos.jpeg", "center 25%"),
    "juliana": ("p_juliana.jpeg", "center 35%"),
    "felipe": ("p_felipe.jpeg", "center 25%"),
    "renata": ("p_renata.jpeg", "center 25%"),
    "aline": ("p_aline.jpeg", "center 25%"),
    "marina": ("p_marina.jpeg", "center 25%"),
    "eduardo": ("p_eduardo.jpeg", "center 30%"),
    "patricia": ("cotacerta_3_rc_profissional.jpeg", "center 25%"),
    "gustavo": ("p_gustavo.jpeg", "center 30%"),
}

FOTOS_FELIZCRED = {
    "marta": ("p_marta.jpeg", "center 25%"),
    "roberto": ("felizcred_2_portabilidade.jpeg", "center 15%"),
    "fernanda": ("p_fernanda.jpeg", "center 30%"),
    "ana": ("felizcred_4_domestico_rural.jpeg", "center 15%"),
    "marcos": ("p_marcos.jpeg", "center 25%"),
}

JA_FEITO_HIGGSFIELD = {"diego"}  # ja tem os 5 cards prontos via Higgsfield, nao mexe


def gerar(nome, conta, persona_dict, fotos_map):
    if nome in JA_FEITO_HIGGSFIELD:
        print(f"pulando {nome} (ja feito via Higgsfield)")
        return
    if nome not in fotos_map:
        print(f"AVISO: sem foto mapeada pra {nome}, pulando")
        return
    foto_arquivo, pos = fotos_map[nome]
    foto_path = os.path.join(ASSETS, foto_arquivo)
    if not os.path.exists(foto_path):
        print(f"AVISO: foto nao encontrada pra {nome}: {foto_path}")
        return
    persona = persona_dict[nome]
    out_dir = os.path.join(OUT_ROOT, conta, nome)
    os.makedirs(out_dir, exist_ok=True)
    for i, card in enumerate(persona["cards"], start=1):
        funil.render_card(
            conta, foto_path,
            headline=card["headline"],
            subtext=card["subtext"],
            footnote=card["footnote"],
            cta=card.get("cta"),
            photo_pos=pos,
            out_path=os.path.join(out_dir, f"card{i}.png"),
        )


if __name__ == "__main__":
    for nome in personas.COTACERTA:
        gerar(nome, "cotacerta", personas.COTACERTA, FOTOS_COTACERTA)
    for nome in personas.FELIZCRED:
        gerar(nome, "felizcred", personas.FELIZCRED, FOTOS_FELIZCRED)
    print("\n=== TODAS AS PERSONAS RESTANTES RENDERIZADAS ===")
