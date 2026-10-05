#!/usr/bin/env python3
"""Calcula métricas básicas de BI de marketing sem dependências externas.

Uso:
  python3 calculadora_bi.py --exemplo
  python3 calculadora_bi.py --json entrada.json

Os resultados são cálculo mecânico. O chamador deve conferir definição, fonte,
janela, margem, cancelamentos e status de cada campo antes de tomar decisão.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from typing import Any


EXEMPLO = {
    "empresa": "Operacao Exemplo",
    "periodo": "2026-09",
    "investimento": 10000.0,
    "impressoes": 250000,
    "cliques": 5000,
    "leads": 400,
    "leads_qualificados": 180,
    "vendas": 36,
    "receita_liquida": 54000.0,
    "custos_variaveis": 27000.0,
    "custo_comercial": 3000.0,
    "clientes_inicio": 400,
    "clientes_perdidos": 20,
    "ticket_medio": 1500.0,
    "margem_contribuicao": 0.5,
    "frequencia_ano": 2.0,
    "meses_retencao": 12.0,
}


def n(data: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = data.get(key, default)
    if value is None or value == "":
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Campo '{key}' precisa ser numerico") from exc


def div(a: float, b: float) -> float | None:
    return a / b if b else None


def calcular(data: dict[str, Any]) -> dict[str, Any]:
    investimento = n(data, "investimento")
    impressoes = n(data, "impressoes")
    cliques = n(data, "cliques")
    leads = n(data, "leads")
    qualificados = n(data, "leads_qualificados")
    vendas = n(data, "vendas")
    receita = n(data, "receita_liquida")
    custos = n(data, "custos_variaveis")
    comercial = n(data, "custo_comercial")
    clientes_inicio = n(data, "clientes_inicio")
    perdidos = n(data, "clientes_perdidos")
    ticket = n(data, "ticket_medio")
    margem_pct = n(data, "margem_contribuicao")
    frequencia = n(data, "frequencia_ano", 1.0)
    meses = n(data, "meses_retencao", 1.0)

    margem = receita - custos
    margem_pct_calculada = div(margem, receita)
    clientes = vendas
    cac_pago = div(investimento, clientes)
    cac_blended = div(investimento + comercial, clientes)
    ltv = ticket * frequencia * margem_pct * (meses / 12.0)
    ltv_cac = div(ltv, cac_blended or 0.0)
    margem_mensal = ticket * margem_pct * frequencia / 12.0
    payback = div(cac_blended or 0.0, margem_mensal)

    resultado = {
        "empresa": data.get("empresa", ""),
        "periodo": data.get("periodo", ""),
        "metricas": {
            "ctr": div(cliques, impressoes),
            "cpc": div(investimento, cliques),
            "cpl": div(investimento, leads),
            "cpl_qualificado": div(investimento, qualificados),
            "taxa_lead_qualificado": div(qualificados, leads),
            "taxa_lead_venda": div(vendas, leads),
            "taxa_qualificado_venda": div(vendas, qualificados),
            "cac_pago": cac_pago,
            "cac_blended": cac_blended,
            "margem_contribuicao_valor": margem,
            "margem_contribuicao_pct_observada": margem_pct_calculada,
            "roas_receita": div(receita, investimento),
            "roas_margem": div(margem, investimento),
            "ltv": ltv,
            "ltv_cac": ltv_cac,
            "payback_meses": payback,
            "churn": div(perdidos, clientes_inicio),
        },
        "entradas": data,
        "alertas": [],
    }

    alertas = resultado["alertas"]
    if ltv_cac is not None and ltv_cac < 3.0:
        alertas.append("LTV/CAC abaixo de 3x: referencia operacional, nao meta universal.")
    if payback is not None and payback > 12.0:
        alertas.append("Payback acima de 12 meses: avaliar caixa e prazo de retorno.")
    if margem < 0:
        alertas.append("Margem de contribuicao negativa no periodo.")
    if qualificados > leads:
        alertas.append("Leads qualificados maior que leads: revisar denominadores.")
    return resultado


def brl(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "n/a"
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "n/a"
    return f"{value * 100:.2f}%".replace(".", ",")


def imprimir(resultado: dict[str, Any]) -> None:
    m = resultado["metricas"]
    print(f"BI DE MARKETING — {resultado['empresa']} — {resultado['periodo']}")
    print(f"CTR: {pct(m['ctr'])} | CPC: {brl(m['cpc'])} | CPL: {brl(m['cpl'])}")
    print(f"Taxa lead→venda: {pct(m['taxa_lead_venda'])} | CAC pago: {brl(m['cac_pago'])}")
    print(f"CAC blended: {brl(m['cac_blended'])} | Margem: {brl(m['margem_contribuicao_valor'])}")
    print(f"ROAS receita: {m['roas_receita']:.2f}x | ROAS margem: {m['roas_margem']:.2f}x")
    print(f"LTV: {brl(m['ltv'])} | LTV/CAC: {m['ltv_cac']:.2f}x | Payback: {m['payback_meses']:.2f} meses")
    print(f"Churn: {pct(m['churn'])}")
    if resultado["alertas"]:
        print("ALERTAS:")
        for alerta in resultado["alertas"]:
            print(f"- {alerta}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Calcula metricas de BI de marketing")
    parser.add_argument("--exemplo", action="store_true", help="usa entradas de exemplo")
    parser.add_argument("--json", help="arquivo JSON com entradas")
    parser.add_argument("--saida-json", action="store_true", help="imprime JSON em vez do resumo")
    args = parser.parse_args()

    if args.exemplo:
        data = EXEMPLO
    elif args.json:
        with open(args.json, encoding="utf-8") as handle:
            data = json.load(handle)
    else:
        parser.error("informe --exemplo ou --json")

    try:
        resultado = calcular(data)
    except ValueError as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    if args.saida_json:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    else:
        imprimir(resultado)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
