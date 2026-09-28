#!/usr/bin/env python3
"""
Agenda as 18 personas Cota Certa (5 Stories cada) no painel de producao,
um dia sim um dia nao, comecando amanha. Cada persona = 5 Stories no mesmo
dia, escalonadas de 2 em 2 minutos (o agendador confere a fila a cada minuto).

So roda contra o /painel/api/agenda (producao) -- nao mexe em nada local.
"""

import base64
import datetime
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REVIEW_ROOT = os.path.join(HERE, "media", "stories-review-personas")

API_BASE = "https://meuwhats.onrender.com"
AUTH = "admin:admin"

# ordem das personas -> pasta (diego fica na raiz, o resto em cotacerta/<nome>)
ORDEM = [
    ("diego", os.path.join(REVIEW_ROOT, "diego")),
    ("camila", os.path.join(REVIEW_ROOT, "cotacerta", "camila")),
    ("joao", os.path.join(REVIEW_ROOT, "cotacerta", "joao")),
    ("priscila", os.path.join(REVIEW_ROOT, "cotacerta", "priscila")),
    ("marcelo", os.path.join(REVIEW_ROOT, "cotacerta", "marcelo")),
    ("larissa", os.path.join(REVIEW_ROOT, "cotacerta", "larissa")),
    ("andre", os.path.join(REVIEW_ROOT, "cotacerta", "andre")),
    ("bianca", os.path.join(REVIEW_ROOT, "cotacerta", "bianca")),
    ("sonia", os.path.join(REVIEW_ROOT, "cotacerta", "sonia")),
    ("carlos", os.path.join(REVIEW_ROOT, "cotacerta", "carlos")),
    ("juliana", os.path.join(REVIEW_ROOT, "cotacerta", "juliana")),
    ("felipe", os.path.join(REVIEW_ROOT, "cotacerta", "felipe")),
    ("renata", os.path.join(REVIEW_ROOT, "cotacerta", "renata")),
    ("aline", os.path.join(REVIEW_ROOT, "cotacerta", "aline")),
    ("marina", os.path.join(REVIEW_ROOT, "cotacerta", "marina")),
    ("eduardo", os.path.join(REVIEW_ROOT, "cotacerta", "eduardo")),
    ("patricia", os.path.join(REVIEW_ROOT, "cotacerta", "patricia")),
    ("gustavo", os.path.join(REVIEW_ROOT, "cotacerta", "gustavo")),
]

DATA_INICIO = datetime.date(2026, 9, 6)  # amanha
HORA_BASE = (19, 0)  # 19:00 Brasilia


def criar_post(conta_id, data_hora_str, imagem_path):
    with open(imagem_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    payload = {
        "contaId": conta_id,
        "redes": ["instagram_story"],
        "data": data_hora_str,
        "imagemBase64": f"data:image/png;base64,{b64}",
    }
    payload_path = os.path.join(HERE, "_tmp_payload.json")
    with open(payload_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)

    result = subprocess.run(
        ["curl", "-s", "-u", AUTH, "-X", "POST",
         f"{API_BASE}/painel/api/agenda",
         "-H", "Content-Type: application/json",
         "--data-binary", f"@{payload_path}",
         "-w", "\nHTTP:%{http_code}"],
        capture_output=True, text=True,
    )
    os.remove(payload_path)
    return result.stdout.strip()


if __name__ == "__main__":
    dia = DATA_INICIO
    total_ok = 0
    total_erro = 0
    for nome, pasta in ORDEM:
        if not os.path.isdir(pasta):
            print(f"AVISO: pasta nao encontrada pra {nome}: {pasta}")
            continue
        print(f"\n=== {nome} -> {dia.isoformat()} ===")
        for i in range(1, 6):
            imagem_path = os.path.join(pasta, f"card{i}.png")
            if not os.path.exists(imagem_path):
                print(f"  card{i}: arquivo nao encontrado, pulando")
                continue
            minuto = HORA_BASE[1] + (i - 1) * 2
            data_hora_str = f"{dia.isoformat()}T{HORA_BASE[0]:02d}:{minuto:02d}"
            resp = criar_post("cotacerta", data_hora_str, imagem_path)
            ok = "HTTP:200" in resp
            total_ok += 1 if ok else 0
            total_erro += 0 if ok else 1
            status = "ok" if ok else "ERRO"
            print(f"  card{i} ({data_hora_str}): {status}")
            if not ok:
                print("    ", resp[:300])
        dia += datetime.timedelta(days=2)

    print(f"\n=== TOTAL: {total_ok} agendados, {total_erro} com erro ===")
