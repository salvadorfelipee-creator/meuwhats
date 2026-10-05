#!/usr/bin/env python3
"""Prioriza backlog de SEO por impacto x demanda x confiança / esforço.

Uso:
  python3 priorizar_backlog.py --exemplo
  python3 priorizar_backlog.py --json backlog.json --out priorizado.md

Entrada JSON: lista de itens ou {"itens": [...]}. Cada item usa notas de 1 a 5
para impacto, demanda, confianca e esforco, além de acao, dono, prazo e criterio.
O score é um modelo operacional; não é benchmark do Google.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


EXEMPLO = [
    {
        "id": "T1",
        "acao": "Corrigir canonical conflitante em páginas de serviço",
        "impacto": 5,
        "demanda": 4,
        "confianca": 4,
        "esforco": 2,
        "dono": "Dev",
        "prazo": "5 dias",
        "criterio": "zero conflito na amostra e inspeção validada",
    },
    {
        "id": "T2",
        "acao": "Atualizar guia com impressões e CTA de diagnóstico",
        "impacto": 4,
        "demanda": 5,
        "confianca": 3,
        "esforco": 3,
        "dono": "Editor",
        "prazo": "10 dias",
        "criterio": "fontes revisadas, evento e métrica de guarda ativos",
    },
    {
        "id": "T3",
        "acao": "Criar três páginas por sinônimo sem diferença de intenção",
        "impacto": 1,
        "demanda": 2,
        "confianca": 1,
        "esforco": 5,
        "dono": "SEO",
        "prazo": "pausar",
        "criterio": "não executar; consolidar intenção primeiro",
    },
]


def nota(item: dict, campo: str) -> float:
    try:
        valor = float(item[campo])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Item {item.get('id', '?')} sem nota válida em '{campo}'.") from exc
    if not 1 <= valor <= 5:
        raise ValueError(f"Item {item.get('id', '?')}: '{campo}' deve estar entre 1 e 5.")
    return valor


def priorizar(itens: list[dict]) -> list[dict]:
    saida = []
    for item in itens:
        esforco = nota(item, "esforco")
        score = nota(item, "impacto") * nota(item, "demanda") * nota(item, "confianca") / esforco
        novo = dict(item)
        novo["score"] = score
        saida.append(novo)
    return sorted(saida, key=lambda item: (-item["score"], str(item.get("id", ""))))


def markdown(itens: list[dict]) -> str:
    linhas = [
        "# Backlog de SEO priorizado",
        "",
        "> Score = impacto × demanda × confiança ÷ esforço. Modelo operacional; valide com dados do negócio.",
        "",
        "| ID | Ação | Impacto | Demanda | Confiança | Esforço | Score | Dono | Prazo | Critério |",
        "|---|---|---:|---:|---:|---:|---:|---|---|---|",
    ]
    for item in itens:
        def texto(campo: str) -> str:
            return str(item.get(campo, "")).replace("|", "\\|").replace("\n", " ")

        linhas.append(
            f"| {texto('id')} | {texto('acao')} | {texto('impacto')} | {texto('demanda')} | "
            f"{texto('confianca')} | {texto('esforco')} | {item['score']:.2f} | "
            f"{texto('dono')} | {texto('prazo')} | {texto('criterio')} |"
        )
    return "\n".join(linhas) + "\n"


def carregar(caminho: str | None, exemplo: bool) -> list[dict]:
    if exemplo:
        return EXEMPLO
    if not caminho:
        raise ValueError("Informe --exemplo ou --json arquivo.json.")
    dados = json.loads(Path(caminho).read_text(encoding="utf-8"))
    if isinstance(dados, dict):
        dados = dados.get("itens")
    if not isinstance(dados, list) or not dados:
        raise ValueError("O JSON deve ser uma lista não vazia ou conter a chave 'itens'.")
    return dados


def main() -> int:
    parser = argparse.ArgumentParser(description="Prioriza backlog de SEO.")
    parser.add_argument("--exemplo", action="store_true", help="usa três itens de exemplo")
    parser.add_argument("--json", help="arquivo JSON de entrada")
    parser.add_argument("--out", help="arquivo Markdown de saída; sem isso imprime no terminal")
    args = parser.parse_args()
    try:
        itens = priorizar(carregar(args.json, args.exemplo))
        saida = markdown(itens)
    except (OSError, json.JSONDecodeError, ValueError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    if args.out:
        Path(args.out).write_text(saida, encoding="utf-8")
        print(f"Backlog gerado em {args.out} ({len(saida)} caracteres)")
    else:
        print(saida, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
