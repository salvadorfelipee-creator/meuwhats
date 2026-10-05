#!/usr/bin/env python3
"""Gera um briefing de conteúdo em Markdown a partir de JSON.

Uso:
  python3 gerar_brief.py --exemplo
  python3 gerar_brief.py --json briefing.json --out briefing.md

O script usa somente a biblioteca padrão e deixa explícito o que é hipótese.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


EXEMPLO = {
    "titulo": "Como escolher contabilidade para pequena empresa",
    "url": "/guias/contabilidade-pequena-empresa/",
    "objetivo": "gerar diagnósticos qualificados",
    "pilar": "Contabilidade para pequenas empresas",
    "cluster": "Escolha e comparação",
    "consulta": "contabilidade para pequena empresa",
    "intencao": "comercial",
    "estagio": "consideração",
    "cep": "reduzir risco antes de contratar",
    "publico": "dona de pequena empresa que compara escritórios",
    "job": "entender o que comparar e evitar surpresa no regime tributário",
    "cta": "agendar diagnóstico",
    "kpi": "diagnósticos qualificados",
    "guarda": "taxa de qualificação e ausência de erro factual",
    "criterio": "manter se gerar diagnóstico qualificado sem queda na taxa de qualificação em 60 dias",
    "resposta_curta": "A escolha depende da atividade, receita, folha, regime e nível de suporte. Compare escopo, prazos, fontes e limites antes de escolher; confirme o enquadramento com um profissional.",
    "fontes": [
        {"afirmacao": "Regimes e limites tributários", "url": "fonte oficial vigente", "data": "verificar antes de publicar"},
        {"afirmacao": "Critérios de comparação", "url": "entrevistas com clientes", "data": "hipótese até validar"},
    ],
    "dono": "Editor",
    "prazo": "7 dias",
    "revisor": "Contador responsável",
}


def valor(dados: dict, chave: str, padrao: str = "[preencher]") -> str:
    v = dados.get(chave, padrao)
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    return str(v)


def gerar(dados: dict) -> str:
    fontes = dados.get("fontes", [])
    linhas_fontes = [
        "| Afirmação/entidade | Fonte/URL | Data/status |",
        "|---|---|---|",
    ]
    for fonte in fontes:
        if isinstance(fonte, dict):
            linhas_fontes.append(
                f"| {fonte.get('afirmacao', '')} | {fonte.get('url', '')} | {fonte.get('data', '')} |"
            )
        else:
            linhas_fontes.append(f"| {fonte} | [preencher] | [hipótese] |")
    if len(linhas_fontes) == 2:
        linhas_fontes.append("| [preencher] | [preencher] | [hipótese até verificar] |")

    return f"""# Briefing de conteúdo — {valor(dados, 'titulo')}

> **Status:** briefing gerado · **Dono:** {valor(dados, 'dono')} · **Prazo:** {valor(dados, 'prazo')} · **Revisor:** {valor(dados, 'revisor')}
>
> Fatos, hipóteses e metas devem permanecer separados. O script não valida a veracidade das fontes.

## 1. Decisão

| Campo | Preenchimento |
|---|---|
| Objetivo de negócio | {valor(dados, 'objetivo')} |
| URL | {valor(dados, 'url')} |
| Pilar/cluster | {valor(dados, 'pilar')} / {valor(dados, 'cluster')} |
| Consulta principal | {valor(dados, 'consulta')} |
| Intenção | {valor(dados, 'intencao')} |
| Estágio | {valor(dados, 'estagio')} |
| CEP | {valor(dados, 'cep')} |
| Público | {valor(dados, 'publico')} |
| CTA | {valor(dados, 'cta')} |
| KPI primário | {valor(dados, 'kpi')} |
| Métrica de guarda | {valor(dados, 'guarda')} |
| Critério de decisão | {valor(dados, 'criterio')} |

## 2. Pesquisa e job

- **Job:** {valor(dados, 'job')}
- **Frases reais:** [preencher com falas anonimizadas]
- **Objeções/medos:** [preencher]
- **SERP observada em:** [data e local]
- **Lacunas:** [preencher]

## 3. Promessa e resposta inicial

**Promessa:** Para {valor(dados, 'publico')}, responder “{valor(dados, 'consulta')}” com clareza, evidência e limites.

**Resposta curta:** {valor(dados, 'resposta_curta')}

## 4. Estrutura

1. H1: {valor(dados, 'titulo')}
2. Resposta direta e limites do que o conteúdo pode afirmar.
3. Critérios, passos e exceções observados na pesquisa.
4. Evidência própria, exemplos autorizados e fontes primárias.
5. Próximos passos e CTA: {valor(dados, 'cta')}.

## 5. Fontes e revisão

{chr(10).join(linhas_fontes)}

- **Autor:** [preencher e verificar credenciais]
- **Revisor técnico:** {valor(dados, 'revisor')}
- **Risco setorial/LGPD:** [avaliar antes da publicação]

## 6. Execução e QA

| Ação | Dono | Prazo | Critério |
|---|---|---|---|
| Redigir e inserir resposta curta | {valor(dados, 'dono')} | {valor(dados, 'prazo')} | leitura compreensível sem contexto |
| Validar fontes e limites | {valor(dados, 'revisor')} | antes de publicar | nenhuma afirmação sensível sem fonte |
| Testar links, CTA e evento | [dev/analista] | antes de publicar | caminho ponta a ponta funcionando |
| Revisar dados em Search Console/CRM | [analista] | 28–90 dias | decisão com métrica primária e guarda |

## 7. Não fazer

- Não copiar concorrentes nem publicar alegações sem fonte.
- Não prometer ranking, citação em IA, tráfego ou resultado comercial.
- Não criar variações artificiais da mesma intenção.
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera briefing de conteúdo em Markdown.")
    parser.add_argument("--exemplo", action="store_true", help="usa um briefing de exemplo")
    parser.add_argument("--json", help="arquivo JSON de entrada")
    parser.add_argument("--out", help="arquivo Markdown; sem isso imprime no terminal")
    args = parser.parse_args()
    if not args.exemplo and not args.json:
        print("Erro: informe --exemplo ou --json arquivo.json.", file=sys.stderr)
        return 2
    try:
        dados = EXEMPLO if args.exemplo else json.loads(Path(args.json).read_text(encoding="utf-8"))
        if not isinstance(dados, dict):
            raise ValueError("O JSON deve conter um objeto.")
        texto = gerar(dados)
    except (OSError, json.JSONDecodeError, ValueError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    if args.out:
        Path(args.out).write_text(texto, encoding="utf-8")
        print(f"Briefing gerado em {args.out} ({len(texto)} caracteres)")
    else:
        print(texto, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
