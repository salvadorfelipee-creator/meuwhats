#!/usr/bin/env python3
"""
Demo de teste — reaproveita o gerador real de cards de beneficios da Cota Certa
(cotacerta-seguros/social/gerar_card_beneficios.py) sem mexer no arquivo de
producao, so redirecionando a saida pra demo-modelos/cards-beneficios-cotacerta/.
"""

import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REAL_SCRIPT = os.path.join(HERE, "..", "cotacerta-seguros", "social", "gerar_card_beneficios.py")
OUT_DIR = os.path.join(HERE, "cards-beneficios-cotacerta")
os.makedirs(OUT_DIR, exist_ok=True)

spec = importlib.util.spec_from_file_location("gerar_card_beneficios_prod", REAL_SCRIPT)
cg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cg)

cg.HERE = OUT_DIR  # todo path interno do gerador usa esse global

TEMA_DEMO = {
    "slug": "seguro-auto-colisao-roubo-terceiros",
    "title": "Seguro Auto",
    "badge": "colisão, roubo e terceiros",
    "badge_fala": "colisão, roubo e terceiros",
    "bullets": [
        {"titulo": "Colisão e capotamento", "fala": "Colisão", "desc": "reparo do veículo em caso de acidente."},
        {"titulo": "Roubo e furto", "desc": "indenização conforme tabela FIPE em caso de perda total."},
        {"titulo": "Responsabilidade civil", "fala": "Terceiros", "desc": "cobre danos causados a outras pessoas ou veículos."},
        {"titulo": "Assistência 24h", "desc": "guincho, chaveiro e carro reserva conforme o plano contratado."},
        {"titulo": "Vidros e faróis", "desc": "cobertura para reparo ou troca de itens de vidro."},
    ],
    "cta_text": "PERSONALIZE SEU PLANO",
}

if __name__ == "__main__":
    resultado = cg.gerar_tema(TEMA_DEMO)
    print("\n=== DEMO PRONTA ===")
    print(resultado)
