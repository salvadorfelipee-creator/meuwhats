#!/usr/bin/env python3
"""Calcula uma conta interna de proposta comercial sem dependências externas.

Uso:
    python3 calcular_proposta.py --exemplo
    python3 calcular_proposta.py --json entrada.json
    python3 calcular_proposta.py --json entrada.json --json-saida

Os números de entrada não são benchmarks: devem vir do cliente ou ser marcados como
hipótese na proposta. Fórmulas principais:
- preço antes de margem = custos operacionais + prêmio de risco;
- preço com imposto = preço antes de imposto / (1 - alíquota);
- preço recomendado = preço com imposto / (1 - margem-alvo);
- LTV = ticket x frequência anual x margem x permanência/12;
- equilíbrio = investimento / LTV;
- ROI de cenário = (margem incremental - investimento) / investimento.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any


EXEMPLO: dict[str, Any] = {
    "empresa": "Agencia Exemplo",
    "ticket": 2000.0,
    "margem_contribuicao": 0.45,
    "meses_retencao": 12.0,
    "frequencia_ano": 1.5,
    "leads_estimados": 100.0,
    "conversao_lead_venda": 0.08,
    "investimento_total": 30000.0,
    "custos_diretos": 12000.0,
    "terceiros": 2000.0,
    "rateio_fixos": 3000.0,
    "risco_percentual": 0.10,
    "impostos_percentual": 0.06,
    "margem_alvo_percentual": 0.25,
    "opcoes": [
        {"nome": "Essencial", "investimento": 18000.0, "clientes_estimados": 5.0},
        {"nome": "Recomendada", "investimento": 30000.0, "clientes_estimados": 10.0},
        {"nome": "Transformacao", "investimento": 48000.0, "clientes_estimados": 16.0},
    ],
}


def moeda(valor: float) -> str:
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def percentual(valor: float) -> str:
    return f"{valor * 100:.2f}%".replace(".", ",")


def _numero(dados: dict[str, Any], chave: str, padrao: float | None = None) -> float:
    valor = dados.get(chave, padrao)
    if valor is None:
        raise ValueError(f"Campo obrigatorio ausente: {chave}")
    try:
        return float(valor)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Campo {chave} precisa ser numerico") from exc


def validar(dados: dict[str, Any]) -> None:
    obrigatorios = ["ticket", "margem_contribuicao", "meses_retencao", "frequencia_ano"]
    for chave in obrigatorios:
        _numero(dados, chave)
    for chave in ("margem_contribuicao", "conversao_lead_venda", "risco_percentual",
                  "impostos_percentual", "margem_alvo_percentual"):
        if chave in dados:
            valor = _numero(dados, chave)
            if not 0 <= valor < 1:
                raise ValueError(f"{chave} deve estar entre 0 e 1")
    for chave in ("ticket", "meses_retencao", "frequencia_ano", "leads_estimados",
                  "investimento_total", "custos_diretos", "terceiros", "rateio_fixos"):
        if chave in dados and _numero(dados, chave) < 0:
            raise ValueError(f"{chave} nao pode ser negativo")


def calcular(dados: dict[str, Any]) -> dict[str, Any]:
    validar(dados)
    ticket = _numero(dados, "ticket")
    margem = _numero(dados, "margem_contribuicao")
    meses = _numero(dados, "meses_retencao")
    frequencia = _numero(dados, "frequencia_ano")
    ltv = ticket * frequencia * margem * (meses / 12.0)

    custos = sum(_numero(dados, chave, 0.0) for chave in ("custos_diretos", "terceiros", "rateio_fixos"))
    risco = _numero(dados, "risco_percentual", 0.0)
    impostos = _numero(dados, "impostos_percentual", 0.0)
    margem_alvo = _numero(dados, "margem_alvo_percentual", 0.0)
    custo_com_risco = custos * (1 + risco)
    if impostos >= 1 or margem_alvo >= 1:
        raise ValueError("impostos_percentual e margem_alvo_percentual precisam ser menores que 1")
    preco_com_imposto = custo_com_risco / (1 - impostos) if impostos else custo_com_risco
    preco_recomendado = preco_com_imposto / (1 - margem_alvo) if margem_alvo else preco_com_imposto

    leads = _numero(dados, "leads_estimados", 0.0)
    conversao = _numero(dados, "conversao_lead_venda", 0.0)
    clientes_base = leads * conversao
    investimento = _numero(dados, "investimento_total", preco_recomendado)
    breakeven = investimento / ltv if ltv else math.inf

    cenarios: dict[str, dict[str, float]] = {}
    for nome, fator in (("conservador", 0.70), ("base", 1.00), ("alto", 1.40)):
        clientes = clientes_base * fator
        margem_incremental = clientes * ltv
        roi = (margem_incremental - investimento) / investimento if investimento else math.inf
        cenarios[nome] = {
            "fator_conversao": fator,
            "clientes_estimados": clientes,
            "margem_incremental": margem_incremental,
            "roi": roi,
        }

    opcoes = []
    for opcao in dados.get("opcoes", []):
        nome = str(opcao.get("nome", "Opcao"))
        valor = float(opcao.get("investimento", 0.0))
        clientes = float(opcao.get("clientes_estimados", 0.0))
        opcoes.append({
            "nome": nome,
            "investimento": valor,
            "clientes_estimados": clientes,
            "investimento_por_cliente": valor / clientes if clientes else math.inf,
            "equilibrio_em_clientes": valor / ltv if ltv else math.inf,
        })

    return {
        "empresa": dados.get("empresa", "Empresa"),
        "premissas": {
            "ticket": ticket,
            "margem_contribuicao": margem,
            "meses_retencao": meses,
            "frequencia_ano": frequencia,
            "leads_estimados": leads,
            "conversao_lead_venda": conversao,
            "investimento_total": investimento,
        },
        "precificacao": {
            "custos_operacionais": custos,
            "premio_de_risco": custos * risco,
            "preco_antes_de_imposto": custo_com_risco,
            "preco_com_imposto": preco_com_imposto,
            "preco_recomendado": preco_recomendado,
        },
        "economia": {
            "ltv": ltv,
            "clientes_base": clientes_base,
            "ponto_equilibrio_clientes": breakeven,
        },
        "cenarios": cenarios,
        "opcoes": opcoes,
    }


def imprimir(resultado: dict[str, Any]) -> None:
    p = resultado["precificacao"]
    e = resultado["economia"]
    print(f"PROPOSTA — {resultado['empresa']}")
    print("=" * 56)
    print(f"Preço antes de imposto .... {moeda(p['preco_antes_de_imposto'])}")
    print(f"Preço com imposto ........ {moeda(p['preco_com_imposto'])}")
    print(f"Preço recomendado ........ {moeda(p['preco_recomendado'])}")
    print(f"LTV ...................... {moeda(e['ltv'])}")
    print(f"Clientes para equilíbrio . {e['ponto_equilibrio_clientes']:.2f}")
    print("\nCENARIOS (sensibilidade, nao promessa)")
    print(f"{'Cenario':<14}{'Clientes':>12}{'Margem':>16}{'ROI':>12}")
    for nome, valor in resultado["cenarios"].items():
        print(f"{nome:<14}{valor['clientes_estimados']:>12.2f}{moeda(valor['margem_incremental']):>16}{percentual(valor['roi']):>12}")
    if resultado["opcoes"]:
        print("\nOPCOES")
        for opcao in resultado["opcoes"]:
            print(f"- {opcao['nome']}: {moeda(opcao['investimento'])} | "
                  f"{opcao['clientes_estimados']:.2f} clientes | "
                  f"equilibrio: {opcao['equilibrio_em_clientes']:.2f}")


def carregar(args: argparse.Namespace) -> dict[str, Any]:
    if args.exemplo:
        return EXEMPLO
    if args.json:
        with Path(args.json).open(encoding="utf-8") as arquivo:
            return json.load(arquivo)
    raise ValueError("Informe --exemplo ou --json arquivo.json")


def main() -> int:
    parser = argparse.ArgumentParser(description="Calcula precificacao, LTV, equilibrio e cenarios")
    parser.add_argument("--exemplo", action="store_true", help="executa uma entrada de teste")
    parser.add_argument("--json", help="caminho do JSON de entrada")
    parser.add_argument("--json-saida", action="store_true", help="imprime tambem o resultado em JSON")
    args = parser.parse_args()
    try:
        resultado = calcular(carregar(args))
    except (OSError, ValueError, json.JSONDecodeError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    imprimir(resultado)
    if args.json_saida:
        print("\nJSON")
        print(json.dumps(resultado, ensure_ascii=False, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
