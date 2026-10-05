#!/usr/bin/env python3
"""Gera um calendário editorial CSV de 30 dias com campos de decisão.

Uso:
  python3 gerar_calendario.py --exemplo --out /tmp/calendario.csv
  python3 gerar_calendario.py --tema "nutrição local" --canal Instagram --responsavel Ana --out pauta.csv

O arquivo é um ponto de partida: revise datas, frequência, direitos e capacidade antes de publicar.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, timedelta
from pathlib import Path


CAMPOS = [
    "Dia", "Data", "Canal", "Formato", "Pilar", "Etapa", "CEP ou dor",
    "Hook", "Promessa", "Prova", "CTA", "UTM ou codigo", "Dono",
    "Prazo aprovacao", "Status", "Hipotese", "Metrica primaria",
    "Metrica guarda", "Criterio de decisao", "Observacoes",
]

PADRAO = [
    ("Problema/Ensino", "Descoberta", "pergunta real do cliente", "responder uma dúvida sem jargão", "salvar"),
    ("Prova", "Consideracao", "objeção ou medo", "mostrar processo, limite ou caso autorizado", "enviar DM"),
    ("Proposta", "Conversao", "situação de compra", "explicar próximo passo e condição", "agendar"),
    ("Comunidade", "Retencao", "relato ou participação", "reconhecer e convidar conversa", "responder"),
]


def gerar(tema: str, canal: str, responsavel: str, inicio: date, dias: int = 30) -> list[dict[str, str]]:
    linhas = []
    for i in range(dias):
        pilar, etapa, dor, promessa, cta = PADRAO[i % len(PADRAO)]
        data = inicio + timedelta(days=i)
        linhas.append({
            "Dia": str(i + 1),
            "Data": data.isoformat(),
            "Canal": canal,
            "Formato": "Reel" if i % 2 == 0 else "Story/Carrossel",
            "Pilar": pilar,
            "Etapa": etapa,
            "CEP ou dor": f"{dor} — {tema}",
            "Hook": "[ESCREVER HOOK AUTORAL]",
            "Promessa": promessa,
            "Prova": "[INSERIR PROVA MEDIDA OU CONSENTIDA]",
            "CTA": cta,
            "UTM ou codigo": f"social_{canal.lower().replace(' ', '_')}_{data.strftime('%Y%m%d')}",
            "Dono": responsavel,
            "Prazo aprovacao": (data - timedelta(days=2)).isoformat(),
            "Status": "rascunho",
            "Hipotese": "[MUDANÇA] gera [EFEITO] porque [EVIDÊNCIA]",
            "Metrica primaria": "[DEFINIR EVENTO PRIMÁRIO]",
            "Metrica guarda": "tempo de resposta/reclamações",
            "Criterio de decisao": "[DEFINIR NÚMERO, JANELA E AÇÃO]",
            "Observacoes": "Revisar direitos, acessibilidade e capacidade antes de agendar.",
        })
    return linhas


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gera calendário editorial de 30 dias em CSV")
    parser.add_argument("--exemplo", action="store_true", help="gera uma pauta ilustrativa")
    parser.add_argument("--tema", default="tema do cliente")
    parser.add_argument("--canal", default="Instagram")
    parser.add_argument("--responsavel", default="[DEFINIR DONO]")
    parser.add_argument("--inicio", default=date.today().isoformat(), help="data ISO YYYY-MM-DD")
    parser.add_argument("--dias", type=int, default=30)
    parser.add_argument("--out", type=Path, required=True, help="CSV de saída")
    args = parser.parse_args(argv)
    if args.dias < 1 or args.dias > 90:
        parser.error("--dias deve ficar entre 1 e 90")
    try:
        inicio = date.fromisoformat(args.inicio)
    except ValueError:
        parser.error("--inicio deve estar em YYYY-MM-DD")
    tema = "exemplo de dúvida do cliente" if args.exemplo else args.tema
    linhas = gerar(tema, args.canal, args.responsavel, inicio, args.dias)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CAMPOS)
        writer.writeheader()
        writer.writerows(linhas)
    print(f"Calendário gerado: {args.out} ({len(linhas)} linhas, {len(CAMPOS)} colunas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
