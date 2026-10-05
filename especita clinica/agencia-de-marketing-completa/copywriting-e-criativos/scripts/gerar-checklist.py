#!/usr/bin/env python3
"""Gera checklist Markdown de prontidão para uma peça.

Uso:
  python3 gerar-checklist.py --exemplo
  python3 gerar-checklist.py --json brief.json --out checklist.md

Campos booleanos aceitos no JSON: pesquisa_feita, oferta_definida, prova_fonte,
cta_unico, destino_pronto, direitos_ok, acessibilidade_ok, tracking_ok,
dono_prazo_criterio. Ausência é marcada como PENDENTE, não como aprovação.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

EXEMPLO = {
    "projeto": "Reels diagnóstico",
    "pesquisa_feita": True,
    "oferta_definida": True,
    "prova_fonte": True,
    "cta_unico": True,
    "destino_pronto": True,
    "direitos_ok": True,
    "acessibilidade_ok": False,
    "tracking_ok": True,
    "dono_prazo_criterio": True,
    "donos": "Redator / editor / mídia",
    "prazo": "2026-06-20",
}

ITENS = [
    ("Pesquisa e voz do cliente", "pesquisa_feita", "brief registra fonte, data, dor, desejo e objeção"),
    ("Oferta e capacidade", "oferta_definida", "dor, resultado, prazo, prova, risco, condição e CTA estão definidos"),
    ("Prova", "prova_fonte", "claim tem fonte/data/autorização ou está marcado como hipótese"),
    ("CTA único", "cta_unico", "há uma ação clara e um próximo passo verificável"),
    ("Destino", "destino_pronto", "página/WhatsApp/atendimento repete a promessa e suporta a demanda"),
    ("Direitos e transparência", "direitos_ok", "imagem, voz, música, UGC e publicidade estão autorizados/identificados"),
    ("Acessibilidade", "acessibilidade_ok", "legenda, contraste, alt text e leitura sem áudio foram revisados"),
    ("Tracking", "tracking_ok", "UTM, evento, nome da variante e CRM foram testados"),
    ("Dono, prazo e decisão", "dono_prazo_criterio", "cada ação tem dono, prazo e critério de manter/ajustar/pausar"),
]


def status(valor: Any) -> str:
    return "OK" if valor is True else "PENDENTE"


def gerar(dados: dict[str, Any]) -> str:
    linhas = [
        f"# Checklist de prontidão — {dados.get('projeto', '[projeto]')}",
        "",
        f"> Donos: {dados.get('donos', '[definir]')} · Prazo: {dados.get('prazo', '[definir]')}",
        "> PENDENTE não é aprovação: corrija antes de publicar ou registre o bloqueio.",
        "",
        "| Item | Status | Critério | Próxima ação |",
        "|---|---|---|---|",
    ]
    pendentes = []
    for titulo, chave, criterio in ITENS:
        atual = status(dados.get(chave, False))
        acao = "Pronto para revisão final" if atual == "OK" else f"Definir/corrigir {chave} antes da publicação"
        linhas.append(f"| {titulo} | {atual} | {criterio} | {acao} |")
        if atual != "OK":
            pendentes.append(titulo)
    linhas.extend([
        "",
        "## Decisão",
        "",
        ("**LIBERAR PARA REVISÃO FINAL:** todos os gates estão OK; ainda exige aprovação humana."
         if not pendentes else "**BLOQUEAR PUBLICAÇÃO:** faltam " + ", ".join(pendentes) + "."),
        "",
        "## Registro",
        "",
        "- Hipótese e métrica primária: [preencher]",
        "- Métrica de guarda e janela: [preencher]",
        "- Aprovador e data: [preencher]",
        "- O que não será feito neste ciclo: [preencher]",
    ])
    return "\n".join(linhas) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera checklist de prontidão para copy/criativo")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--exemplo", action="store_true", help="gera checklist demonstrativo")
    grupo.add_argument("--json", help="caminho de brief JSON")
    parser.add_argument("--out", help="arquivo Markdown de saída; sem esta opção imprime no terminal")
    args = parser.parse_args()
    try:
        if args.exemplo or not args.json:
            dados = dict(EXEMPLO)
        else:
            dados = json.loads(Path(args.json).read_text(encoding="utf-8"))
        texto = gerar(dados)
        if args.out:
            Path(args.out).write_text(texto, encoding="utf-8")
            print(f"Checklist gerado em {args.out} ({len(texto)} caracteres)")
        else:
            print(texto, end="")
        return 0
    except (OSError, json.JSONDecodeError, TypeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
