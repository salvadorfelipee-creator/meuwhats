#!/usr/bin/env python3
"""Gera um rascunho Markdown de proposta a partir da conta do script de cálculo.

Uso:
    python3 gerar_proposta.py --exemplo --out /tmp/proposta.md
    python3 gerar_proposta.py --json entrada.json --out proposta.md

O texto gerado contém números calculados e marcadores [TODO] para diagnóstico,
escopo e decisão. Revise premissas e não trate cenários como promessa.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Permite executar o arquivo diretamente a partir da pasta scripts.
from calcular_proposta import EXEMPLO, calcular, moeda, percentual


def gerar(dados: dict, resultado: dict) -> str:
    p = resultado["precificacao"]
    e = resultado["economia"]
    premissas = resultado["premissas"]
    linhas = [
        f"# Proposta Comercial — {dados.get('empresa', '[cliente]')}",
        "",
        f"> Objetivo: {dados.get('objetivo', '[TODO — objetivo em número e prazo]')}  ",
        f"> Região: {dados.get('regiao', '[TODO]')} · Versão: [TODO] · Data: [TODO]",
        "",
        "> **Rascunho calculado automaticamente.** Confirme todas as entradas; valores sem fonte devem permanecer marcados como hipótese.",
        "",
        "## 1. Resumo executivo",
        "",
        "[TODO] Descreva a situação do cliente, o problema, o impacto, a solução, a opção recomendada, o prazo e o próximo passo. Não prometa resultado.",
        "",
        "## 2. Premissas e estado dos dados",
        "",
        "| Premissa | Valor | Estado/fonte |",
        "| --- | ---: | --- |",
        f"| Ticket | {moeda(premissas['ticket'])} | [TODO: medido/estimado/hipótese] |",
        f"| Margem de contribuição | {percentual(premissas['margem_contribuicao'])} | [TODO: fonte] |",
        f"| Permanência | {premissas['meses_retencao']:.1f} meses | [TODO: fonte/hipótese] |",
        f"| Frequência anual | {premissas['frequencia_ano']:.2f} | [TODO: fonte/hipótese] |",
        f"| Leads estimados | {premissas['leads_estimados']:.1f} | [TODO: fonte/hipótese] |",
        f"| Conversão lead→venda | {percentual(premissas['conversao_lead_venda'])} | [TODO: fonte/hipótese] |",
        "",
        "## 3. Diagnóstico e escopo",
        "",
        "[TODO] Use templates/briefing-diagnostico.md. Liste três vazamentos, hipótese central, dependências e o que fica fora do escopo.",
        "",
        "| Fase | Entrega | Resultado habilitado | Prazo | Aceite | Dono |",
        "| --- | --- | --- | --- | --- | --- |",
        "| 1 | [TODO] | [TODO] | [TODO] | [TODO] | [TODO] |",
        "| 2 | [TODO] | [TODO] | [TODO] | [TODO] | [TODO] |",
        "| 3 | [TODO] | [TODO] | [TODO] | [TODO] | [TODO] |",
        "",
        "## 4. Conta de decisão",
        "",
        "| Indicador | Valor | Observação |",
        "| --- | ---: | --- |",
        f"| Custos operacionais | {moeda(p['custos_operacionais'])} | controle interno; confirme composição |",
        f"| Prêmio de risco | {moeda(p['premio_de_risco'])} | hipótese de {percentual(dados.get('risco_percentual', 0.0))} |",
        f"| Preço antes de imposto | {moeda(p['preco_antes_de_imposto'])} | cálculo |",
        f"| Preço com imposto | {moeda(p['preco_com_imposto'])} | alíquota informada |",
        f"| Preço recomendado | **{moeda(p['preco_recomendado'])}** | margem-alvo informada |",
        f"| LTV | {moeda(e['ltv'])} | hipótese se entradas não forem medidas |",
        f"| Ponto de equilíbrio | {e['ponto_equilibrio_clientes']:.2f} clientes | investimento ÷ LTV |",
        "",
        "## 5. Cenários de sensibilidade",
        "",
        "| Cenário | Fator de conversão | Clientes | Margem incremental | ROI | Decisão |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for nome, cenario in resultado["cenarios"].items():
        linhas.append(
            f"| {nome.title()} | {percentual(cenario['fator_conversao'])} | "
            f"{cenario['clientes_estimados']:.2f} | {moeda(cenario['margem_incremental'])} | "
            f"{percentual(cenario['roi'])} | [TODO: manter/ajustar/pausar] |"
        )
    linhas.extend([
        "",
        "## 6. Opções",
        "",
        "| Opção | Investimento | Clientes estimados | Equilíbrio em clientes | Escopo/diferença |",
        "| --- | ---: | ---: | ---: | --- |",
    ])
    if resultado["opcoes"]:
        for opcao in resultado["opcoes"]:
            linhas.append(
                f"| {opcao['nome']} | {moeda(opcao['investimento'])} | "
                f"{opcao['clientes_estimados']:.2f} | {opcao['equilibrio_em_clientes']:.2f} | [TODO] |"
            )
    else:
        linhas.append("| Recomendada | [TODO] | [TODO] | [TODO] | [TODO] |")
    linhas.extend([
        "",
        "**Opção recomendada:** [TODO — explique por impacto, risco e capacidade].",
        "",
        "## 7. Governança, riscos e próximo passo",
        "",
        "| Item | Dono | Prazo | Critério de decisão |",
        "| --- | --- | --- | --- |",
        "| Acessos e dados | [TODO] | [TODO] | [TODO] |",
        "| Aprovações | [TODO] | [TODO] | [TODO] |",
        "| Leitura de resultados | [TODO] | [TODO] | [TODO] |",
        "",
        "### Próximo passo",
        "",
        "[TODO — ação única, participantes e data].",
        "",
        "### Checklist de revisão",
        "",
        "- [ ] Nomes, datas, links e totais conferidos.",
        "- [ ] Números têm fonte ou estão marcados como hipótese.",
        "- [ ] Entregas, aceites, exclusões, dependências e donos estão claros.",
        "- [ ] Cenários não estão escritos como promessa.",
        "- [ ] Opção recomendada e critério de manter/ajustar/pausar estão claros.",
    ])
    return "\n".join(linhas) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera rascunho Markdown de proposta comercial")
    parser.add_argument("--exemplo", action="store_true", help="usa uma entrada de teste")
    parser.add_argument("--json", help="JSON de entrada")
    parser.add_argument("--out", default="proposta-comercial.md", help="arquivo Markdown de saída")
    args = parser.parse_args()
    try:
        if args.exemplo:
            dados = dict(EXEMPLO)
            dados.update({"regiao": "Sao Paulo/SP", "objetivo": "validar uma oferta em 30 dias"})
        elif args.json:
            with Path(args.json).open(encoding="utf-8") as arquivo:
                dados = json.load(arquivo)
        else:
            raise ValueError("Informe --exemplo ou --json arquivo.json")
        texto = gerar(dados, calcular(dados))
        Path(args.out).write_text(texto, encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    print(f"Proposta gerada em {args.out} ({len(texto)} caracteres)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
