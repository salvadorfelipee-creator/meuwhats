#!/usr/bin/env python3
"""Calcula health score de cliente sem dependências externas.

Uso:
    python3 calcular_health_score.py --exemplo
    python3 calcular_health_score.py --json entrada.json

Entrada JSON:
{
  "cliente": "Conta Exemplo",
  "data": "2026-04-10",
  "dimensoes": {
    "resultado_krs": {"valor": 70, "peso": 30},
    "entrega_sla": {"valor": 80, "peso": 20},
    "engajamento": {"valor": 60, "peso": 15},
    "qualidade_dados": {"valor": 90, "peso": 15},
    "satisfacao": {"valor": 70, "peso": 10},
    "fit_risco": {"valor": 80, "peso": 10}
  }
}
"""

import argparse
import json
import sys

EXEMPLO = {
    "cliente": "Conta Exemplo",
    "data": "2026-04-10",
    "dimensoes": {
        "resultado_krs": {"valor": 70, "peso": 30},
        "entrega_sla": {"valor": 80, "peso": 20},
        "engajamento": {"valor": 60, "peso": 15},
        "qualidade_dados": {"valor": 90, "peso": 15},
        "satisfacao": {"valor": 70, "peso": 10},
        "fit_risco": {"valor": 80, "peso": 10},
    },
}


def classificar(score):
    if score >= 80:
        return "saudavel", "manter e escolher proxima aposta"
    if score >= 60:
        return "atencao", "abrir plano de prevencao e validar expectativa"
    return "critico", "fazer escuta, auditoria e plano de recuperacao"


def calcular(dados):
    dimensoes = dados.get("dimensoes")
    if not isinstance(dimensoes, dict) or not dimensoes:
        raise ValueError("'dimensoes' deve ser um objeto nao vazio")
    total_peso = 0.0
    ponderado = 0.0
    linhas = []
    for nome, item in dimensoes.items():
        if not isinstance(item, dict) or "valor" not in item or "peso" not in item:
            raise ValueError(f"Dimensao '{nome}' precisa de valor e peso")
        valor = float(item["valor"])
        peso = float(item["peso"])
        if not 0 <= valor <= 100 or peso < 0:
            raise ValueError(f"Dimensao '{nome}' fora da faixa: valor 0-100 e peso >= 0")
        total_peso += peso
        ponderado += valor * peso
        linhas.append({"dimensao": nome, "valor": valor, "peso": peso})
    if total_peso <= 0:
        raise ValueError("A soma dos pesos deve ser maior que zero")
    score = ponderado / total_peso
    faixa, acao = classificar(score)
    return {
        "cliente": dados.get("cliente", "cliente sem nome"),
        "data": dados.get("data", "nao informada"),
        "score": round(score, 2),
        "faixa": faixa,
        "acao_recomendada": acao,
        "dono": "lider de contas",
        "prazo": "1 dia util se a faixa for critica; 3 dias uteis se for atencao",
        "criterio": "registrar evidencia e recalcular no proximo checkpoint",
        "peso_total": round(total_peso, 2),
        "dimensoes": linhas,
    }


def imprimir(resultado):
    print(f"Cliente: {resultado['cliente']}")
    print(f"Data: {resultado['data']}")
    print(f"Health score: {resultado['score']:.2f}/100 ({resultado['faixa']})")
    print(f"Acao: {resultado['acao_recomendada']}")
    print(f"Dono: {resultado['dono']} | Prazo: {resultado['prazo']}")
    print(f"Criterio: {resultado['criterio']}")
    print("Dimensoes:")
    for item in resultado["dimensoes"]:
        print(f"  - {item['dimensao']}: {item['valor']:.1f} (peso {item['peso']:.1f})")


def main():
    parser = argparse.ArgumentParser(description="Calcula health score auditavel")
    parser.add_argument("--exemplo", action="store_true", help="usa dados de exemplo")
    parser.add_argument("--json", help="arquivo JSON de entrada")
    parser.add_argument("--json-saida", action="store_true", help="imprime resultado em JSON")
    args = parser.parse_args()
    if args.exemplo:
        dados = EXEMPLO
    elif args.json:
        with open(args.json, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    else:
        parser.error("informe --exemplo ou --json arquivo.json")
    try:
        resultado = calcular(dados)
    except (ValueError, TypeError, KeyError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    if args.json_saida:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    else:
        imprimir(resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
