#!/usr/bin/env python3
"""Valida um CSV de painel BI de marketing com a biblioteca padrão.

Uso:
  python3 validar_painel.py --exemplo
  python3 validar_painel.py --csv templates/painel-bi-semanal.csv
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from typing import Iterable


COLUNAS_OBRIGATORIAS = {
    "periodo",
    "canal",
    "fonte",
    "metrica",
    "valor",
    "unidade",
    "status",
    "atualizado_em",
    "dono",
    "prazo",
    "criterio_decisao",
}
STATUS_VALIDOS = {"medido", "estimado", "meta", "hipotese"}

EXEMPLO_CSV = """periodo,canal,fonte,metrica,valor,unidade,status,comparacao,atualizado_em,dono,prazo,criterio_decisao,observacao
2026-W01,Search,CRM+financeiro,clientes_novos,36,clientes,medido,,2026-01-08,BI,2026-01-09,manter se CAC abaixo do teto,ok
2026-W01,Search,CRM+financeiro,cac_blended,333.33,BRL,estimado,,2026-01-08,Marketing,2026-01-09,pausar se acima do teto,hipotese a validar
"""


def validar(linhas: Iterable[dict[str, str]]) -> list[str]:
    erros: list[str] = []
    for indice, linha in enumerate(linhas, start=2):
        for coluna in sorted(COLUNAS_OBRIGATORIAS):
            if not (linha.get(coluna) or "").strip():
                erros.append(f"linha {indice}: campo obrigatorio vazio: {coluna}")
        status = (linha.get("status") or "").strip().lower()
        if status and status not in STATUS_VALIDOS:
            erros.append(f"linha {indice}: status invalido: {status}")
        valor = (linha.get("valor") or "").strip()
        if valor:
            try:
                float(valor.replace(".", "").replace(",", "."))
            except ValueError:
                erros.append(f"linha {indice}: valor nao numerico: {valor}")
    return erros


def validar_texto(texto: str) -> list[str]:
    leitor = csv.DictReader(io.StringIO(texto))
    colunas = set(leitor.fieldnames or [])
    ausentes = sorted(COLUNAS_OBRIGATORIAS - colunas)
    if ausentes:
        return ["colunas obrigatorias ausentes: " + ", ".join(ausentes)]
    return validar(leitor)


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida CSV de painel BI")
    parser.add_argument("--exemplo", action="store_true", help="valida CSV interno de exemplo")
    parser.add_argument("--csv", help="caminho do CSV")
    args = parser.parse_args()
    if args.exemplo:
        texto = EXEMPLO_CSV
    elif args.csv:
        with open(args.csv, encoding="utf-8", newline="") as handle:
            texto = handle.read()
    else:
        parser.error("informe --exemplo ou --csv")

    erros = validar_texto(texto)
    if erros:
        print("FALHOU")
        for erro in erros:
            print(f"- {erro}")
        return 1
    print("OK: painel possui colunas, valores, status, fonte, dono, prazo e criterio de decisao")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
