#!/usr/bin/env python3
"""Gera uma ata semanal em Markdown a partir de JSON, usando apenas biblioteca padrao.

Uso:
    python3 gerar_ata_weekly.py --exemplo --out /tmp/ata.md
    python3 gerar_ata_weekly.py --json reuniao.json --out ata.md

A entrada aceita cliente, data, participantes, kpis, achados, decisoes, acoes e riscos.
"""

import argparse
import json
import sys

EXEMPLO = {
    "cliente": "Conta Exemplo",
    "data": "2026-04-10",
    "periodo": "2026-04-04 a 2026-04-10",
    "participantes": ["Ana (account lead)", "Bruno (dados)", "Carla (cliente)"],
    "kpis": [
        {"nome": "oportunidades qualificadas", "meta": "20", "realizado": "18", "status": "amarelo", "leitura": "volume proximo; qualidade ainda em validacao"},
        {"nome": "cumprimento de SLA", "meta": "90%", "realizado": "96%", "status": "verde", "leitura": "entregas elegiveis dentro do prazo"},
    ],
    "achados": ["O gargalo esta na aprovacao do cliente, com 3 itens bloqueados.", "O evento de lead passou no teste, mas conversao offline ainda e lacuna."],
    "decisoes": ["Consolidar feedback em um unico formulario.", "Manter o teste de oferta por mais uma semana, sem aumentar escopo."],
    "acoes": [
        {"acao": "Enviar formulario de aprovacao", "dono": "Carla", "prazo": "2026-04-11", "criterio": "feedback consolidado em um canal", "evidencia": "link do formulario"},
        {"acao": "Validar conversao offline", "dono": "Bruno", "prazo": "2026-04-14", "criterio": "origem preenchida em 95% dos ganhos (hipotese)", "evidencia": "relatorio de auditoria"},
    ],
    "riscos": [{"risco": "Aprovacao tardia move a janela do teste", "dono": "account lead", "mitigacao": "escalar no prazo de SLA", "gatilho": "atraso > 1 dia util"}],
}


def md_linha(valor):
    return str(valor).replace("|", "\\|").replace("\n", " ")


def gerar(dados):
    linhas = []
    cliente = dados.get("cliente", "cliente sem nome")
    data = dados.get("data", "data nao informada")
    periodo = dados.get("periodo", "periodo nao informado")
    linhas += [f"# Weekly — {cliente}", "", f"> Data: {data} · Período: {periodo}", ""]
    participantes = dados.get("participantes", [])
    linhas += ["## Participantes", "", ", ".join(map(str, participantes)) or "Não informado", ""]
    linhas += ["## Resumo executivo", "", dados.get("resumo", "Preencher leitura executiva com resultado, gargalo e decisão."), ""]
    linhas += ["## KPIs", "", "| KPI | Meta | Realizado | Status | Leitura |", "| --- | --- | --- | --- | --- |"]
    for kpi in dados.get("kpis", []):
        linhas.append("| " + " | ".join(md_linha(kpi.get(campo, "")) for campo in ("nome", "meta", "realizado", "status", "leitura")) + " |")
    if not dados.get("kpis"):
        linhas.append("| [TODO] | [meta] | [medido] | [status] | [interpretação] |")
    linhas += ["", "## Achados e limitações", ""]
    for achado in dados.get("achados", []):
        linhas.append(f"- {md_linha(achado)}")
    if not dados.get("achados"):
        linhas.append("- [TODO] Declare o que aconteceu e a qualidade do dado.")
    linhas += ["", "## Decisões", ""]
    for indice, decisao in enumerate(dados.get("decisoes", []), start=1):
        linhas.append(f"{indice}. {md_linha(decisao)}")
    if not dados.get("decisoes"):
        linhas.append("1. [TODO] Registrar decisão ou marcar inconclusivo.")
    linhas += ["", "## Ações", "", "| Ação | Dono | Prazo | Critério de decisão | Evidência | Status |", "| --- | --- | --- | --- | --- | --- |"]
    for acao in dados.get("acoes", []):
        colunas = [acao.get(campo, "") for campo in ("acao", "dono", "prazo", "criterio", "evidencia")]
        linhas.append("| " + " | ".join(md_linha(c) for c in colunas) + " | aberto |")
    if not dados.get("acoes"):
        linhas.append("| [TODO] | [dono] | [data] | [critério] | [link] | aberto |")
    linhas += ["", "## Riscos e dependências", "", "| Risco | Dono | Mitigação | Gatilho | Status |", "| --- | --- | --- | --- | --- |"]
    for risco in dados.get("riscos", []):
        colunas = [risco.get(campo, "") for campo in ("risco", "dono", "mitigacao", "gatilho")]
        linhas.append("| " + " | ".join(md_linha(c) for c in colunas) + " | monitorar |")
    if not dados.get("riscos"):
        linhas.append("| [TODO] | [dono] | [mitigação] | [gatilho] | monitorar |")
    linhas += ["", "## Próximo checkpoint", "", f"{dados.get('proximo_checkpoint', '[TODO] data e pauta do próximo checkpoint]')}", "", "**Regra:** ata enviada em até 24 horas; silêncio não é aceite.", ""]
    return "\n".join(linhas)


def main():
    parser = argparse.ArgumentParser(description="Gera ata semanal em Markdown")
    parser.add_argument("--exemplo", action="store_true", help="usa dados de exemplo")
    parser.add_argument("--json", help="arquivo JSON de entrada")
    parser.add_argument("--out", required=True, help="arquivo Markdown de saída")
    args = parser.parse_args()
    if args.exemplo:
        dados = EXEMPLO
    elif args.json:
        with open(args.json, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    else:
        parser.error("informe --exemplo ou --json arquivo.json")
    try:
        texto = gerar(dados)
        with open(args.out, "w", encoding="utf-8") as arquivo:
            arquivo.write(texto)
    except (OSError, ValueError, TypeError) as erro:
        print(f"Erro: {erro}", file=sys.stderr)
        return 2
    print(f"Ata gerada em {args.out} ({len(texto)} caracteres)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
