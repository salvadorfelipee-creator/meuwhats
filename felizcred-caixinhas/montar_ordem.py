#!/usr/bin/env python3
"""
Monta a ordem final de postagem dos 50 itens, intercalando pelas categorias
(rodízio, mesma lógica do PLAYBOOK-COTACERTA-100-CAIXINHAS.md) e distribui
datas/horários evitando os horários já ocupados pela conta felizcred na
agenda (12h e 18h BRT já usados por outras séries) — usa 09h e 16h BRT,
2 Stories por dia. Itens em modo áudio ganham também um post de Reels 6
minutos depois do Story correspondente.

O campo "data" gerado aqui é sempre horário LOCAL de Brasília, no formato
"YYYY-MM-DDTHH:MM" — é o formato que POST /painel/api/agenda espera
(ver agenda.js: timestampDeDataHora soma +3h assumindo Brasília, nunca UTC).

Uso:
    python3 montar_ordem.py conteudo_master.json --out schedule.json \
        --inicio 2026-08-18
"""

import argparse
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

SLOTS_BRT = [(9, 0), (16, 0)]


def montar_ordem(itens):
    por_categoria = defaultdict(list)
    for item in itens:
        por_categoria[item["categoria"]].append(item)
    categorias = list(por_categoria.keys())
    ordem = []
    while any(por_categoria[c] for c in categorias):
        for c in categorias:
            if por_categoria[c]:
                ordem.append(por_categoria[c].pop(0))
    return ordem


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("conteudo")
    ap.add_argument("--out", default="schedule.json")
    ap.add_argument("--inicio", default="2026-08-18")
    args = ap.parse_args()

    itens = json.loads(Path(args.conteudo).read_text(encoding="utf-8"))
    ordem = montar_ordem(itens)

    inicio = datetime.strptime(args.inicio, "%Y-%m-%d")
    schedule = []
    for idx, item in enumerate(ordem):
        dia = idx // 2
        slot = idx % 2
        hora, minuto = SLOTS_BRT[slot]
        story_dt = inicio.replace(hour=hora, minute=minuto) + timedelta(days=dia)
        entry = {
            "id": item["id"],
            "categoria": item["categoria"],
            "modo": item["modo"],
            "pergunta": item["pergunta"],
            "resposta": item.get("resposta", ""),
            "story_data": story_dt.strftime("%Y-%m-%dT%H:%M"),
        }
        if item["modo"] == "audio":
            reels_dt = story_dt + timedelta(minutes=6)
            entry["reels_data"] = reels_dt.strftime("%Y-%m-%dT%H:%M")
        schedule.append(entry)

    Path(args.out).write_text(json.dumps(schedule, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(schedule)} itens ordenados e agendados (hora de Brasília) de {schedule[0]['story_data']} a {schedule[-1]['story_data']}")
    print(f"Salvo em {args.out}")


if __name__ == "__main__":
    main()
