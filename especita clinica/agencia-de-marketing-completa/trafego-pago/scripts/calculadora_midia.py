#!/usr/bin/env python3
"""Calcula funil e economia de mídia paga sem dependências externas.

Uso:
  python3 calculadora_midia.py --exemplo
  python3 calculadora_midia.py --json entrada.json
"""
import argparse
import json
import math
import sys

EXEMPLO = {
    "empresa": "Exemplo Comércio Local",
    "ticket_liquido": 1500,
    "margem_contribuicao": 0.60,
    "frequencia_ano": 1.5,
    "meses_retencao": 12,
    "custo_aquisicao_extra": 1000,
    "capacidade_mensal": 40,
    "canais": [
        {"nome": "Google Search", "investimento": 3500, "leads": 140, "qualificados": 35, "vendas": 8},
        {"nome": "Meta Ads", "investimento": 2500, "leads": 180, "qualificados": 30, "vendas": 4},
    ],
}


def brl(value):
    if math.isinf(value):
        return "infinito"
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(value):
    return f"{value * 100:.2f}%".replace(".", ",")


def validar(dados):
    obrigatorios = ("ticket_liquido", "margem_contribuicao", "canais")
    faltantes = [campo for campo in obrigatorios if campo not in dados]
    if faltantes:
        raise ValueError("Campos ausentes: " + ", ".join(faltantes))
    if not 0 <= float(dados["margem_contribuicao"]) <= 1:
        raise ValueError("margem_contribuicao deve estar entre 0 e 1")
    if not dados["canais"]:
        raise ValueError("Informe ao menos um canal")


def calcular(dados, fator_conversao=1.0):
    validar(dados)
    linhas = []
    for canal in dados["canais"]:
        investimento = float(canal.get("investimento", 0))
        leads = float(canal.get("leads", 0))
        qualificados = float(canal.get("qualificados", 0))
        vendas = float(canal.get("vendas", 0)) * fator_conversao
        linhas.append({
            "canal": canal["nome"],
            "investimento": investimento,
            "leads": leads,
            "qualificados": qualificados,
            "vendas": vendas,
            "cpl": investimento / leads if leads else math.inf,
            "custo_qualificado": investimento / qualificados if qualificados else math.inf,
            "custo_venda": investimento / vendas if vendas else math.inf,
        })

    investimento = sum(item["investimento"] for item in linhas)
    leads = sum(item["leads"] for item in linhas)
    qualificados = sum(item["qualificados"] for item in linhas)
    vendas = sum(item["vendas"] for item in linhas)
    extra = float(dados.get("custo_aquisicao_extra", 0))
    cac_pago = investimento / vendas if vendas else math.inf
    cac_blended = (investimento + extra) / vendas if vendas else math.inf
    ticket = float(dados["ticket_liquido"])
    margem = float(dados["margem_contribuicao"])
    frequencia = float(dados.get("frequencia_ano", 1))
    meses = max(float(dados.get("meses_retencao", 12)), 1)
    margem_anual = ticket * frequencia * margem
    ltv = margem_anual * meses / 12
    margem_mensal = margem_anual / 12
    ltv_cac = ltv / cac_blended if cac_blended and not math.isinf(cac_blended) else 0
    payback = cac_blended / margem_mensal if margem_mensal and not math.isinf(cac_blended) else math.inf
    capacidade = float(dados.get("capacidade_mensal", 0) or 0)
    alertas = []
    if capacidade and vendas > capacidade:
        alertas.append("projeção de vendas excede capacidade mensal")
    if ltv_cac < 3:
        alertas.append("LTV/CAC abaixo de 3x: referência de disciplina, não meta universal")
    return {
        "empresa": dados.get("empresa", "empresa"),
        "canais": linhas,
        "resumo": {
            "investimento": investimento,
            "custo_aquisicao_extra": extra,
            "leads": leads,
            "qualificados": qualificados,
            "vendas": vendas,
            "cpl": investimento / leads if leads else math.inf,
            "custo_qualificado": investimento / qualificados if qualificados else math.inf,
            "cac_pago": cac_pago,
            "cac_blended": cac_blended,
            "ltv": ltv,
            "ltv_cac": ltv_cac,
            "payback_meses": payback,
            "margem_mensal_cliente": margem_mensal,
            "teto_cac_3x": ltv / 3,
        },
        "alertas": alertas,
    }


def cenarios(dados):
    saida = {}
    for nome, fator in (("conservador", 0.70), ("base", 1.00), ("agressivo", 1.30)):
        saida[nome] = calcular(dados, fator)["resumo"]
    return saida


def imprimir(resultado, cenarios_resultado):
    print(f"MÍDIA PAGA — {resultado['empresa']}")
    print("\nFUNIL POR CANAL")
    for linha in resultado["canais"]:
        print(f"- {linha['canal']}: {linha['leads']:.0f} leads; {linha['qualificados']:.0f} qualificados; "
              f"{linha['vendas']:.1f} vendas; CPL {brl(linha['cpl'])}; custo/venda {brl(linha['custo_venda'])}")
    resumo = resultado["resumo"]
    print("\nECONOMIA")
    for chave, valor in (("Investimento", resumo["investimento"]), ("CPL", resumo["cpl"]),
                         ("CAC pago", resumo["cac_pago"]), ("CAC blended", resumo["cac_blended"]),
                         ("LTV", resumo["ltv"]), ("Teto CAC (LTV/3)", resumo["teto_cac_3x"])):
        print(f"- {chave}: {brl(valor)}")
    print(f"- LTV/CAC: {resumo['ltv_cac']:.2f}x")
    print(f"- Payback: {resumo['payback_meses']:.2f} meses")
    if resultado["alertas"]:
        print("\nALERTAS")
        for alerta in resultado["alertas"]:
            print(f"- {alerta}")
    print("\nCENÁRIOS")
    for nome, dados in cenarios_resultado.items():
        print(f"- {nome}: {dados['vendas']:.1f} vendas; CAC {brl(dados['cac_blended'])}; LTV/CAC {dados['ltv_cac']:.2f}x")


def main():
    parser = argparse.ArgumentParser(description="Calcula funil e economia de mídia paga")
    parser.add_argument("--exemplo", action="store_true", help="usa dados de teste")
    parser.add_argument("--json", help="arquivo JSON com os campos de entrada")
    parser.add_argument("--json-saida", action="store_true", help="imprime JSON em vez do relatório")
    args = parser.parse_args()
    if args.json:
        with open(args.json, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    elif args.exemplo:
        dados = EXEMPLO
    else:
        parser.error("use --exemplo ou --json arquivo.json")
    resultado = calcular(dados)
    cenarios_resultado = cenarios(dados)
    if args.json_saida:
        print(json.dumps({"resultado": resultado, "cenarios": cenarios_resultado}, ensure_ascii=False, indent=2, allow_nan=False))
    else:
        imprimir(resultado, cenarios_resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
