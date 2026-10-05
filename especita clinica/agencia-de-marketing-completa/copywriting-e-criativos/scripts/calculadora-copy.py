#!/usr/bin/env python3
"""Calcula métricas de funil e economia de uma campanha de copy/criativo.

Uso:
  python3 calculadora-copy.py --exemplo
  python3 calculadora-copy.py --json entrada.json

Entrada JSON (números são exemplos; substitua por dados medidos):
{
  "projeto": "Campanha diagnóstico",
  "impressões": 10000,
  "cliques": 300,
  "leads": 60,
  "qualificados": 24,
  "vendas": 6,
  "investimento": 1200,
  "receita": 9000,
  "margem_contribuicao": 0.55,
  "outros_custos": 300
}

Os cálculos não declaram vencedor nem causalidade; use o log de experimento.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

EXEMPLO = {
    "projeto": "Campanha diagnóstico",
    "impressões": 10000,
    "cliques": 300,
    "leads": 60,
    "qualificados": 24,
    "vendas": 6,
    "investimento": 1200,
    "receita": 9000,
    "margem_contribuicao": 0.55,
    "outros_custos": 300,
}


def num(dados: dict[str, Any], chave: str) -> float:
    valor = dados.get(chave, 0)
    if valor is None or valor == "":
        return 0.0
    try:
        valor = float(valor)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"'{chave}' precisa ser numérico") from exc
    if not math.isfinite(valor) or valor < 0:
        raise ValueError(f"'{chave}' precisa ser um número finito não negativo")
    return valor


def divisao(a: float, b: float) -> float | None:
    return a / b if b else None


def percentual(valor: float | None) -> str:
    if valor is None:
        return "n/d"
    return f"{valor * 100:.2f}%".replace(".", ",")


def moeda(valor: float | None) -> str:
    if valor is None:
        return "n/d"
    texto = f"R$ {valor:,.2f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def calcular(dados: dict[str, Any]) -> dict[str, Any]:
    impressoes = num(dados, "impressões")
    cliques = num(dados, "cliques")
    leads = num(dados, "leads")
    qualificados = num(dados, "qualificados")
    vendas = num(dados, "vendas")
    investimento = num(dados, "investimento")
    receita = num(dados, "receita")
    margem = num(dados, "margem_contribuicao")
    custos = num(dados, "outros_custos")
    if margem > 1:
        raise ValueError("'margem_contribuicao' deve estar entre 0 e 1")
    receita_margem = receita * margem
    custo_total = investimento + custos
    resultado = receita_margem - custo_total
    return {
        "projeto": dados.get("projeto", "campanha"),
        "metricas": {
            "ctr": divisao(cliques, impressoes),
            "cpc": divisao(investimento, cliques),
            "cpl": divisao(investimento, leads),
            "cpql": divisao(investimento, qualificados),
            "taxa_qualificacao": divisao(qualificados, leads),
            "taxa_lead_venda": divisao(vendas, leads),
            "taxa_qualificado_venda": divisao(vendas, qualificados),
            "cac": divisao(custo_total, vendas),
            "roas_receita": divisao(receita, investimento),
            "margem_apos_custos": resultado,
            "vendas_break_even": divisao(custo_total, receita_margem / vendas) if vendas else None,
        },
        "entradas": {
            "impressões": impressoes,
            "cliques": cliques,
            "leads": leads,
            "qualificados": qualificados,
            "vendas": vendas,
            "investimento": investimento,
            "receita": receita,
            "margem_contribuicao": margem,
            "outros_custos": custos,
        },
        "alertas": alertas(dados, resultado),
    }


def alertas(dados: dict[str, Any], resultado: float) -> list[str]:
    avisos: list[str] = []
    leads = num(dados, "leads")
    qualificados = num(dados, "qualificados")
    vendas = num(dados, "vendas")
    if leads and not qualificados:
        avisos.append("Não há lead qualificado registrado: defina o critério antes de otimizar CPL.")
    if qualificados and not vendas:
        avisos.append("Não há venda registrada: não declare sucesso por CTR ou clique.")
    if resultado < 0:
        avisos.append("A margem após investimento e outros custos está negativa; revise oferta, margem ou aquisição antes de escalar.")
    avisos.append("Os números precisam ser classificados como medidos, meta ou hipótese no log.")
    return avisos


def imprimir(resultado: dict[str, Any]) -> None:
    m = resultado["metricas"]
    print(f"CAMPANHA: {resultado['projeto']}")
    print("=" * 58)
    print(f"CTR ..................... {percentual(m['ctr'])}")
    print(f"CPC ..................... {moeda(m['cpc'])}")
    print(f"CPL ..................... {moeda(m['cpl'])}")
    print(f"CPQL .................... {moeda(m['cpql'])}")
    print(f"Qualificação ............ {percentual(m['taxa_qualificacao'])}")
    print(f"Lead → venda ............ {percentual(m['taxa_lead_venda'])}")
    print(f"Qualificado → venda ..... {percentual(m['taxa_qualificado_venda'])}")
    print(f"CAC (custos totais) ..... {moeda(m['cac'])}")
    print(f"ROAS de receita ......... {m['roas_receita']:.2f}x" if m["roas_receita"] is not None else "ROAS de receita ......... n/d")
    print(f"Margem após custos ...... {moeda(m['margem_apos_custos'])}")
    print(f"Vendas para break-even .. {m['vendas_break_even']:.2f}" if m["vendas_break_even"] is not None else "Vendas para break-even .. n/d")
    if resultado["alertas"]:
        print("\nALERTAS")
        for aviso in resultado["alertas"]:
            print(f"- {aviso}")


def carregar(args: argparse.Namespace) -> dict[str, Any]:
    if args.exemplo or not args.json:
        return dict(EXEMPLO)
    return json.loads(Path(args.json).read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Calcula métricas de copy e criativos")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--exemplo", action="store_true", help="executa dados demonstrativos")
    grupo.add_argument("--json", help="caminho de entrada JSON")
    parser.add_argument("--json-saida", action="store_true", help="imprime também o resultado em JSON")
    args = parser.parse_args()
    try:
        resultado = calcular(carregar(args))
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    imprimir(resultado)
    if args.json_saida:
        print("\nJSON")
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
