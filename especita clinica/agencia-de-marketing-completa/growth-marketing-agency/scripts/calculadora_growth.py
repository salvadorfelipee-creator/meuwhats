#!/usr/bin/env python3
"""
Calculadora de Growth: funil, CAC, LTV, payback e cenarios.

Uso interativo (recomendado para o agente):
    python3 calculadora_growth.py --exemplo            # roda um exemplo completo
    python3 calculadora_growth.py --json entrada.json  # roda com um JSON de entrada
    python3 calculadora_growth.py                      # modo interativo (perguntas no terminal)

Modelo de entrada (JSON):
{
  "empresa": "Clinica Odontologica Sorriso",
  "segmento": "odontologia",
  "ticket_medio": 1800,           # receita media por cliente novo (R$)
  "margem_contribuicao": 0.65,    # 0 a 1 (receita - custos variaveis)
  "meses_retencao": 14,           # tempo medio que o cliente permanece ativo
  "frequencia_ano": 2.0,          # compras/visitas por ano (para recorrencia)
  "indicacoes_por_cliente": 0.3,  # clientes novos que cada cliente traz
  "capacidade_mensal": 120,       # maximo de clientes atendidos por mes (0 = sem limite)
  "canais": [
    {"nome": "Google Search", "investimento_mes": 3000, "cpl": 25, "conv_lead_venda": 0.12},
    {"nome": "Meta Ads", "investimento_mes": 3000, "cpl": 18, "conv_lead_venda": 0.06},
    {"nome": "Indicacao", "investimento_mes": 500, "cpl": 10, "conv_lead_venda": 0.35}
  ]
}

Saida: funil por canal, CAC blended, LTV, LTV/CAC, payback, resultado
mensal, ponto de equilibrio e cenarios (conservador / base / agressivo).
"""

import argparse
import json
import sys

# ----------------------------------------------------------------------------
# Benchmarks de referencia (usados apenas como alerta, nunca como meta automatica)
# ----------------------------------------------------------------------------
REFERENCIAS = {
    "ltv_cac_minimo": 3.0,
    "ltv_cac_saudavel": 5.0,
    "payback_maximo_meses": 12,
    "taxa_resposta_whatsapp": (0.30, 0.60),
    "resposta_1a_hora": 0.60,   # ganho de conversao quando se responde em <1h
}


def brl(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(v):
    return f"{v*100:,.2f}%".replace(".", ",")


def calcular_canal(c, fator_escala=1.0):
    invest = c["investimento_mes"] * fator_escala
    # CPL pode vir medido (campo "cpl") ou derivado de leads informados ("leads_mes")
    if "cpl" in c:
        cpl_base = c["cpl"]
    elif c.get("leads_mes"):
        cpl_base = c["investimento_mes"] / c["leads_mes"]
    else:
        raise ValueError(
            f"Canal '{c.get('nome')}' sem CPL nem volume de leads. "
            "Informe 'cpl' ou 'leads_mes' (e marque como hipotese se for estimativa)."
        )
    # CPL sobe quando o canal escala (saturacao): +0,15x por fator acima de 1
    cpl = cpl_base * (1 + 0.15 * (fator_escala - 1))
    # Conversao pode vir medida ("conv_lead_venda") ou derivada de vendas informadas
    if "conv_lead_venda" in c:
        conv = c["conv_lead_venda"]
    elif c.get("vendas_mes") and c.get("leads_mes"):
        conv = c["vendas_mes"] / c["leads_mes"]
    else:
        raise ValueError(
            f"Canal '{c.get('nome')}' sem conversao lead->venda. Informe "
            "'conv_lead_venda' ou 'vendas_mes' junto com 'leads_mes'."
        )
    leads = invest / cpl if cpl > 0 else 0
    vendas = leads * conv
    cac = invest / vendas if vendas > 0 else float("inf")
    custo_por_lead = cpl
    return {
        "canal": c["nome"],
        "investimento": invest,
        "cpl": cpl,
        "leads": leads,
        "conversao": conv,
        "clientes": vendas,
        "cac": cac,
        "custo_por_lead": custo_por_lead,
    }


def analisar(d):
    canais = [calcular_canal(c) for c in d["canais"]]
    invest_total = sum(c["investimento"] for c in canais)
    clientes = sum(c["clientes"] for c in canais)
    # custo comercial (SDR, closer, CS, ferramentas de vendas) entra no CAC
    custo_comercial = d.get("custo_comercial_mes", 0) or 0

    # limite de capacidade
    cap = d.get("capacidade_mensal", 0) or 0
    alerta_capacidade = None
    if cap and clientes > cap:
        alerta_capacidade = (
            f"A demanda gerada ({clientes:.1f} clientes/mes) excede a capacidade "
            f"declarada ({cap}/mes). Ajuste midia ou aumente capacidade: "
            f"excesso de leads sem atendimento derruba a conversao e queima marca."
        )
        fator = cap / clientes
        canais = [calcular_canal(c, fator) for c in d["canais"]]
        invest_total = sum(c["investimento"] for c in canais)
        clientes = sum(c["clientes"] for c in canais)

    cac_marketing = invest_total / clientes if clientes > 0 else float("inf")
    cac_blended = (invest_total + custo_comercial) / clientes if clientes > 0 else float("inf")

    ticket = d["ticket_medio"]
    margem = d["margem_contribuicao"]
    ticket_margem = ticket * margem
    meses = max(d.get("meses_retencao", 1), 1)
    freq = d.get("frequencia_ano", 1.0)

    # LTV por margem de contribuicao, considerando recorrencia anual
    receita_por_cliente_ano = ticket * freq
    ltv = receita_por_cliente_ano * margem * (meses / 12)

    # efeito de indicacao (clientes trazidos de graca)
    indic = d.get("indicacoes_por_cliente", 0.0)
    ltv_com_indicacao = ltv * (1 + indic) if indic < 1 else ltv / (1 - indic) if indic > 0 else ltv

    ltv_cac = ltv / cac_blended if cac_blended else float("inf")
    ltv_cac_com_indicacao = ltv_com_indicacao / cac_blended if cac_blended else float("inf")
    # payback = CAC dividido pela margem que o cliente gera por mes
    margem_mensal_cliente = ticket * margem * freq / 12
    payback = cac_blended / margem_mensal_cliente if margem_mensal_cliente else float("inf")

    resultado_mes = clientes * margem_mensal_cliente - invest_total - custo_comercial
    # resultado da coorte: toda a margem que os clientes adquiridos neste mes
    # geram ao longo da vida, menos o custo de adquiri-los
    margem_total_coorte = clientes * ltv
    resultado_total_coorte = clientes * (ltv - cac_blended)
    breakeven_clientes = (invest_total + custo_comercial) / margem_mensal_cliente if margem_mensal_cliente else float("inf")

    alertas = []
    if alerta_capacidade:
        alertas.append(alerta_capacidade)
    if ltv_cac < REFERENCIAS["ltv_cac_minimo"]:
        alertas.append(
            f"LTV/CAC de {ltv_cac:.2f}x esta abaixo do minimo de 3x: o negocio esta "
            "comprando cliente caro. Acoes: subir ticket, aumentar margem, melhorar "
            "conversao ou trocar de canal."
        )
    if payback > REFERENCIAS["payback_maximo_meses"]:
        alertas.append(
            f"Payback de {payback:.1f} meses acima de 12: exige caixa. Reduza o ciclo "
            "ou venda recorrencia/pacote para acelerar o retorno."
        )
    if indic < 0.15:
        alertas.append(
            "Indicacao abaixo de 0,15 cliente por cliente: falta um motor de "
            "recomendacao. Implemente pedido de indicacao pos-entrega com incentivo "
            "de dois lados."
        )

    return {
        "resumo": {
            "investimento_mensal": invest_total,
            "custo_comercial_mensal": custo_comercial,
            "clientes_novos_mes": clientes,
            "cac_marketing": cac_marketing,
            "cac_blended": cac_blended,
            "ticket_medio": ticket,
            "margem_contribuicao": margem,
            "ltv": ltv,
            "ltv_com_indicacao": ltv_com_indicacao,
            "ltv_cac": ltv_cac,
            "ltv_cac_com_indicacao": ltv_cac_com_indicacao,
            "margem_mensal_por_cliente": margem_mensal_cliente,
            "payback_meses": payback,
            "resultado_mensal": resultado_mes,
            "margem_total_coorte": margem_total_coorte,
            "resultado_total_coorte": resultado_total_coorte,
            "breakeven_clientes_mes": breakeven_clientes,
        },
        "canais": canais,
        "alertas": alertas,
    }


def cenarios(d):
    out = {}
    for nome, fator in (("conservador", 0.7), ("base", 1.0), ("agressivo", 1.4)):
        d2 = json.loads(json.dumps(d))
        for c in d2["canais"]:
            c["conv_lead_venda"] = c["conv_lead_venda"] * fator
        out[nome] = analisar(d2)["resumo"]
    return out


def imprimir(d, r, cs=None):
    print("=" * 72)
    print(f"PLANO DE GROWTH - {d.get('empresa', 'empresa')}  |  segmento: {d.get('segmento', '-')}")
    print("=" * 72)
    print("\nFUNIL POR CANAL")
    print(f"{'canal':<22}{'invest.':>13}{'CPL':>10}{'leads':>9}{'conv':>8}{'clientes':>10}{'CAC':>13}")
    for c in r["canais"]:
        print(f"{c['canal'][:21]:<22}{brl(c['investimento']):>13}{brl(c['cpl']):>10}"
              f"{c['leads']:>9.1f}{pct(c['conversao']):>8}{c['clientes']:>10.1f}{brl(c['cac']):>13}")

    s = r["resumo"]
    print("\nUNIT ECONOMICS")
    print(f"  Investimento mensal ......... {brl(s['investimento_mensal'])}")
    print(f"  Custo comercial mensal ...... {brl(s['custo_comercial_mensal'])}")
    print(f"  Clientes novos por mes ...... {s['clientes_novos_mes']:.1f}")
    print(f"  CAC de marketing ............ {brl(s['cac_marketing'])}")
    print(f"  CAC blended ................. {brl(s['cac_blended'])}")
    print(f"  Ticket medio ................ {brl(s['ticket_medio'])}  (margem {pct(s['margem_contribuicao'])})")
    print(f"  Margem mensal por cliente ... {brl(s['margem_mensal_por_cliente'])}")
    print(f"  LTV ......................... {brl(s['ltv'])}")
    print(f"  LTV com indicacao ........... {brl(s['ltv_com_indicacao'])}")
    print(f"  LTV / CAC ................... {s['ltv_cac']:.2f}x")
    print(f"  Payback ..................... {s['payback_meses']:.1f} meses")
    print(f"  Resultado mensal (margem) ... {brl(s['resultado_mensal'])}")
    print(f"  Ponto de equilibrio ......... {s['breakeven_clientes_mes']:.1f} clientes/mes")
    print(f"  Margem total da coorte ...... {brl(s['margem_total_coorte'])}")
    print(f"  Resultado da coorte ......... {brl(s['resultado_total_coorte'])}")
    print("  Obs: o resultado do mes 1 costuma ser negativo porque a margem do cliente")
    print("       e acumulada ao longo do tempo enquanto a midia e paga na entrada.")

    if r["alertas"]:
        print("\nALERTAS")
        for a in r["alertas"]:
            print(f"  - {a}")

    if cs:
        print("\nCENARIOS (variacao na conversao lead -> venda)")
        print(f"{'cenario':<14}{'clientes':>10}{'CAC':>14}{'LTV/CAC':>10}{'resultado':>16}")
        for nome, v in cs.items():
            print(f"{nome:<14}{v['clientes_novos_mes']:>10.1f}{brl(v['cac_blended']):>14}"
                  f"{v['ltv_cac']:>9.2f}x{brl(v['resultado_mensal']):>16}")
    print()


EXEMPLO = {
    "empresa": "Clinica Odontologica Sorriso",
    "segmento": "odontologia",
    "ticket_medio": 1800,
    "margem_contribuicao": 0.65,
    "meses_retencao": 18,
    "frequencia_ano": 1.5,
    "indicacoes_por_cliente": 0.3,
    "capacidade_mensal": 150,
    "custo_comercial_mes": 2500,
    "canais": [
        {"nome": "Google Search", "investimento_mes": 3000, "cpl": 25, "conv_lead_venda": 0.12},
        {"nome": "Meta Ads", "investimento_mes": 3000, "cpl": 18, "conv_lead_venda": 0.06},
        {"nome": "Indicacao", "investimento_mes": 500, "cpl": 10, "conv_lead_venda": 0.35},
    ],
}


def main():
    ap = argparse.ArgumentParser(description="Calculadora de growth: funil, CAC, LTV e cenarios")
    ap.add_argument("--json", help="arquivo JSON com a entrada")
    ap.add_argument("--exemplo", action="store_true", help="roda o exemplo de clinica odontologica")
    ap.add_argument("--sem-cenarios", action="store_true", help="omite a analise de cenarios")
    args = ap.parse_args()

    if args.exemplo or (not args.json and not sys.stdin.isatty()):
        d = EXEMPLO
    elif args.json:
        with open(args.json, encoding="utf-8") as fh:
            d = json.load(fh)
    else:
        print("Informe --exemplo ou --json arquivo.json")
        return 1

    r = analisar(d)
    cs = None if args.sem_cenarios else cenarios(d)
    imprimir(d, r, cs)
    if args.exemplo:
        print("JSON de saida:")
        print(json.dumps(r, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
