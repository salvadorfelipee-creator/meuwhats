#!/usr/bin/env python3
"""Valida itens críticos de um checklist de campanha usando biblioteca padrão.

Uso:
  python3 validar_checklist.py --exemplo
  python3 validar_checklist.py --json checklist.json

Formato JSON: {"campanha":"...", "itens":[{"nome":"evento", "status":"OK", "critico":true}, ...]}
"""
import argparse
import json
import sys

EXEMPLO = {
    "campanha": "Search - oferta exemplo",
    "itens": [
        {"nome": "objetivo", "status": "OK", "critico": True},
        {"nome": "evento primario", "status": "OK", "critico": True},
        {"nome": "utm e crm", "status": "OK", "critico": True},
        {"nome": "consentimento", "status": "PENDENTE", "critico": True},
        {"nome": "criativos", "status": "OK", "critico": False},
    ],
}


def validar(dados):
    itens = dados.get("itens", [])
    if not itens:
        raise ValueError("a lista itens não pode ser vazia")
    normalizados = []
    for item in itens:
        nome = str(item.get("nome", "")).strip()
        status = str(item.get("status", "PENDENTE")).strip().upper()
        if not nome:
            raise ValueError("todo item precisa de nome")
        if status not in {"OK", "PENDENTE", "N/A"}:
            raise ValueError(f"status inválido em {nome}: {status}")
        normalizados.append({"nome": nome, "status": status, "critico": bool(item.get("critico", False))})
    pendentes = [item for item in normalizados if item["status"] == "PENDENTE"]
    criticos = [item for item in pendentes if item["critico"]]
    return {
        "campanha": dados.get("campanha", "campanha"),
        "total": len(normalizados),
        "ok": sum(item["status"] == "OK" for item in normalizados),
        "pendentes": pendentes,
        "pendentes_criticos": criticos,
        "publicavel": not criticos,
    }


def main():
    parser = argparse.ArgumentParser(description="Valida checklist de lançamento")
    parser.add_argument("--exemplo", action="store_true", help="usa checklist de teste")
    parser.add_argument("--json", help="arquivo JSON do checklist")
    parser.add_argument("--json-saida", action="store_true", help="imprime JSON")
    args = parser.parse_args()
    if args.json:
        with open(args.json, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    elif args.exemplo:
        dados = EXEMPLO
    else:
        parser.error("use --exemplo ou --json arquivo.json")
    resultado = validar(dados)
    if args.json_saida:
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    else:
        print(f"CHECKLIST — {resultado['campanha']}")
        print(f"Itens OK: {resultado['ok']}/{resultado['total']}")
        print(f"Publicável: {'SIM' if resultado['publicavel'] else 'NÃO'}")
        if resultado["pendentes"]:
            print("Pendências:")
            for item in resultado["pendentes"]:
                marca = "CRÍTICA" if item["critico"] else "" 
                print(f"- {item['nome']} {marca}".rstrip())
        return 0 if resultado["publicavel"] else 2


if __name__ == "__main__":
    sys.exit(main())
