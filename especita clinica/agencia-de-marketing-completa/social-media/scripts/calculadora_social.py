#!/usr/bin/env python3
"""Calcula métricas operacionais de social media usando apenas a biblioteca padrão.

Uso:
  python3 calculadora_social.py --exemplo
  python3 calculadora_social.py --json entrada.json --formato json

Os dados de entrada devem ser medidos ou explicitamente marcados como hipótese pelo operador.
O script não estima alcance, conversão ou benchmark: calcula apenas o que foi informado.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


EXEMPLO = {
    "empresa": "Marca Exemplo",
    "periodo": "2026-09",
    "status_dados": "HIPOTESE — valores ilustrativos; substituir por Insights/CRM",
    "alcance": 10000,
    "impressoes": 15000,
    "views": 8000,
    "tempo_medio_assistido_s": 18,
    "duracao_s": 40,
    "conclusoes": 1200,
    "salvamentos": 420,
    "compartilhamentos": 260,
    "curtidas": 900,
    "comentarios": 80,
    "cliques": 300,
    "visitas_perfil": 700,
    "conversas_qualificadas": 45,
    "leads": 30,
    "vendas": 8,
    "receita": 6400,
    "margem": 0.55,
    "custo_midia": 500,
    "custo_producao": 900,
    "custo_creators": 0,
    "convites_por_cliente": 0.25,
    "convidados_ativados": 5,
    "clientes_convidantes": 20,
}


def num(data: dict, key: str, default: float = 0.0) -> float:
    value = data.get(key, default)
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Campo '{key}' precisa ser numérico; recebido {value!r}") from exc


def ratio(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def pct(value: float | None) -> float | None:
    return None if value is None else value * 100


def round_or_none(value: float | None, digits: int = 4):
    return None if value is None or not math.isfinite(value) else round(value, digits)


def calcular(data: dict) -> dict:
    alcance = num(data, "alcance")
    impressoes = num(data, "impressoes")
    views = num(data, "views")
    tempo = num(data, "tempo_medio_assistido_s")
    duracao = num(data, "duracao_s")
    conclusoes = num(data, "conclusoes")
    salvamentos = num(data, "salvamentos")
    compartilhamentos = num(data, "compartilhamentos")
    curtidas = num(data, "curtidas")
    comentarios = num(data, "comentarios")
    cliques = num(data, "cliques")
    visitas = num(data, "visitas_perfil")
    conversas = num(data, "conversas_qualificadas")
    leads = num(data, "leads")
    vendas = num(data, "vendas")
    receita = num(data, "receita")
    margem = num(data, "margem")
    custo_total = sum(num(data, key) for key in ("custo_midia", "custo_producao", "custo_creators"))
    convites = num(data, "convites_por_cliente")
    clientes_convidantes = num(data, "clientes_convidantes")
    convidados_ativados = num(data, "convidados_ativados")

    resultados = {
        "empresa": data.get("empresa", "empresa"),
        "periodo": data.get("periodo", "não informado"),
        "status_dados": data.get("status_dados", "NÃO INFORMADO — confirme se é MEDIDO, META ou HIPÓTESE"),
        "retencao_media_pct": pct(ratio(tempo, duracao)),
        "conclusao_pct": pct(ratio(conclusoes, views)),
        "share_rate_pct": pct(ratio(compartilhamentos, alcance)),
        "save_rate_pct": pct(ratio(salvamentos, alcance)),
        "engajamento_por_alcance_pct": pct(ratio(curtidas + comentarios + salvamentos + compartilhamentos, alcance)),
        "ctr_pct": pct(ratio(cliques, impressoes)),
        "visita_perfil_por_alcance_pct": pct(ratio(visitas, alcance)),
        "conversa_por_visita_pct": pct(ratio(conversas, visitas)),
        "conversa_para_lead_pct": pct(ratio(leads, conversas)),
        "conversao_lead_venda_pct": pct(ratio(vendas, leads)),
        "venda_por_conversa_pct": pct(ratio(vendas, conversas)),
        "custo_por_conversa": ratio(custo_total, conversas),
        "custo_por_venda": ratio(custo_total, vendas),
        "cac_social": ratio(custo_total, vendas),
        "receita_menos_custo": receita - custo_total,
        "margem_atribuida": receita * margem,
        "resultado_de_margem_menos_custo": receita * margem - custo_total,
        "k_factor": ratio(convidados_ativados, clientes_convidantes) * convites if clientes_convidantes else None,
    }

    alertas = []
    if resultados["retencao_media_pct"] is None:
        alertas.append("Sem duração ou tempo assistido: retenção não calculada.")
    if resultados["cac_social"] is None:
        alertas.append("Sem vendas atribuídas: CAC social não calculado; não trate custo por clique como CAC.")
    if num(data, "margem") <= 0:
        alertas.append("Margem não informada ou zero: decisão econômica fica incompleta.")
    if data.get("status_dados", "").upper().startswith("HIPOTESE"):
        alertas.append("Todos os valores ilustrativos devem ser substituídos por dados medidos antes de escalar.")
    resultados["alertas"] = alertas
    return {"entrada": data, "resultados": {k: round_or_none(v) if isinstance(v, (int, float)) else v for k, v in resultados.items()}}


def imprimir_texto(resultado: dict) -> None:
    r = resultado["resultados"]
    print(f"SOCIAL MEDIA — {r['empresa']} | período: {r['periodo']}")
    print(f"Status dos dados: {r['status_dados']}")
    for chave in (
        "retencao_media_pct", "conclusao_pct", "share_rate_pct", "save_rate_pct",
        "engajamento_por_alcance_pct", "ctr_pct", "conversa_por_visita_pct",
        "conversa_para_lead_pct", "conversao_lead_venda_pct", "custo_por_conversa",
        "cac_social", "resultado_de_margem_menos_custo", "k_factor",
    ):
        print(f"- {chave}: {r[chave]}")
    if r["alertas"]:
        print("ALERTAS:")
        for alerta in r["alertas"]:
            print(f"- {alerta}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Calcula métricas sociais a partir de dados informados")
    parser.add_argument("--exemplo", action="store_true", help="usa dados ilustrativos marcados como hipótese")
    parser.add_argument("--json", type=Path, help="arquivo JSON de entrada")
    parser.add_argument("--formato", choices=("texto", "json"), default="texto")
    args = parser.parse_args(argv)
    if args.exemplo:
        data = EXEMPLO
    elif args.json:
        data = json.loads(args.json.read_text(encoding="utf-8"))
    else:
        parser.error("informe --exemplo ou --json arquivo.json")
    resultado = calcular(data)
    if args.formato == "json":
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    else:
        imprimir_texto(resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
