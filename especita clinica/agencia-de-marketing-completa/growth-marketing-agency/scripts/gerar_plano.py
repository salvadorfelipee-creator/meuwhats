#!/usr/bin/env python3
"""
Gera o esqueleto do plano de captação já preenchido com os números calculados
(funil por canal, unit economics, cenários e metas reversas).

Uso:
    python3 gerar_plano.py --exemplo
    python3 gerar_plano.py --json cliente.json --out plano.md

Entrada (mesmo formato da calculadora, com campos extras opcionais):
{
  "empresa": "Clinica Sorriso", "segmento": "odontologia", "regiao": "Campinas/SP",
  "objetivo": "chegar a 80 pacientes novos por mes",
  "clientes_alvo_mes": 80,          # meta reversa (quanto preciso para bater o objetivo)
  "ticket_medio": 1800, "margem_contribuicao": 0.65, "meses_retencao": 18,
  "frequencia_ano": 1.5, "indicacoes_por_cliente": 0.3, "capacidade_mensal": 150,
  "custo_comercial_mes": 2500,
  "canais": [{"nome":"Google Search","investimento_mes":3000,"cpl":25,"conv_lead_venda":0.12}]
}

O arquivo gerado é um rascunho estruturado: as seções narrativas vêm com marcadores
[TODO] para o agente completar com diagnóstico, oferta, segmento e riscos.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from calculadora_growth import analisar, cenarios, brl, pct, EXEMPLO  # noqa: E402


def meta_reversa(d, r):
    """Quanto investir para atingir a meta de clientes, com o mix atual de canais."""
    alvo = d.get("clientes_alvo_mes")
    if not alvo:
        return None
    atual = r["resumo"]["clientes_novos_mes"]
    if atual <= 0:
        return None
    fator = alvo / atual
    investimento = r["resumo"]["investimento_mensal"] * fator
    linhas = []
    for c in r["canais"]:
        linhas.append({
            "canal": c["canal"],
            "investimento": c["investimento"] * fator,
            "clientes": c["clientes"] * fator,
            "cac": c["cac"],
        })
    return {"alvo": alvo, "fator": fator, "investimento": investimento, "canais": linhas}


def gerar(d, r, cs, mr):
    s = r["resumo"]
    L = []
    L.append(f"# Plano de Captação de Clientes — {d.get('empresa', '[empresa]')}")
    L.append("")
    L.append(f"> Segmento: {d.get('segmento', '[segmento]')} · Região: {d.get('regiao', '[região]')} "
             f"· Objetivo: {d.get('objetivo', '[objetivo]')}")
    L.append("")
    L.append("**Rascunho gerado automaticamente.** As seções marcadas com [TODO] precisam ser "
             "escritas com o diagnóstico, a oferta e o contexto do segmento. Os números abaixo "
             "já estão calculados a partir das premissas informadas — confira cada um antes de entregar.")
    L.append("")
    L.append("## Premissas usadas (confirme com o cliente)")
    L.append("")
    L.append("| Premissa | Valor | Medido ou estimado? |")
    L.append("| --- | --- | --- |")
    for chave, rotulo in [
        ("ticket_medio", "Ticket médio"),
        ("margem_contribuicao", "Margem de contribuição"),
        ("meses_retencao", "Meses de permanência do cliente"),
        ("frequencia_ano", "Compras/visitas por ano"),
        ("indicacoes_por_cliente", "Indicações por cliente"),
        ("capacidade_mensal", "Capacidade mensal de atendimento"),
        ("custo_comercial_mes", "Custo comercial mensal"),
    ]:
        v = d.get(chave, "")
        if isinstance(v, float) and chave in ("margem_contribuicao",):
            v = pct(v)
        L.append(f"| {rotulo} | {v} | [TODO] |")
    L.append("")

    L.append("## 1. Resumo executivo")
    L.append("")
    L.append(f"O plano considera investimento mensal de **{brl(s['investimento_mensal'])}** em mídia "
             f"e **{brl(s['custo_comercial_mensal'])}** de custo comercial, gerando "
             f"**{s['clientes_novos_mes']:.1f} clientes novos por mês**, com "
             f"**CAC de {brl(s['cac_blended'])}**, **LTV de {brl(s['ltv'])}** e "
             f"**LTV/CAC de {s['ltv_cac']:.2f}x** (payback de {s['payback_meses']:.1f} meses).")
    L.append("")
    L.append("Meta do período: [TODO — número e prazo]. Motor principal: [TODO]. "
             "Maior risco do plano: [TODO].")
    L.append("")

    L.append("## 2. Funil por canal (projeção)")
    L.append("")
    L.append("| Canal | Investimento | CPL | Leads | Conversão | Clientes | CAC |")
    L.append("| --- | --- | --- | --- | --- | --- | --- |")
    for c in r["canais"]:
        L.append(f"| {c['canal']} | {brl(c['investimento'])} | {brl(c['cpl'])} | "
                 f"{c['leads']:.0f} | {pct(c['conversao'])} | {c['clientes']:.1f} | {brl(c['cac'])} |")
    L.append(f"| **Total** | **{brl(s['investimento_mensal'])}** | — | "
             f"**{sum(c['leads'] for c in r['canais']):.0f}** | — | "
             f"**{s['clientes_novos_mes']:.1f}** | **{brl(s['cac_blended'])}** |")
    L.append("")
    L.append("[TODO] Diagnóstico do funil atual do cliente (volume e taxa por etapa) e os três "
             "maiores vazamentos. Sem o funil atual medido, esta tabela é apenas projeção.")
    L.append("")

    L.append("## 3. Unit economics")
    L.append("")
    L.append("| Indicador | Valor |")
    L.append("| --- | --- |")
    L.append(f"| CAC de marketing | {brl(s['cac_marketing'])} |")
    L.append(f"| CAC blended | {brl(s['cac_blended'])} |")
    L.append(f"| Margem mensal por cliente | {brl(s['margem_mensal_por_cliente'])} |")
    L.append(f"| LTV | {brl(s['ltv'])} |")
    L.append(f"| LTV com indicação | {brl(s['ltv_com_indicacao'])} |")
    L.append(f"| LTV/CAC | {s['ltv_cac']:.2f}x |")
    L.append(f"| Payback | {s['payback_meses']:.1f} meses |")
    L.append(f"| Ponto de equilíbrio | {s['breakeven_clientes_mes']:.1f} clientes/mês |")
    L.append(f"| Margem total da coorte (vida útil) | {brl(s['margem_total_coorte'])} |")
    L.append(f"| Resultado da coorte (margem − CAC) | {brl(s['resultado_total_coorte'])} |")
    L.append("")
    teto = s["margem_mensal_por_cliente"] * max(d.get("meses_retencao", 12), 1) / 3
    L.append(f"**Teto de CAC aceitável (LTV/CAC de 3x): {brl(teto)}.** "
             "Canal que custar acima disso é ajustado ou pausado.")
    L.append("")
    if r["alertas"]:
        L.append("### Alertas do modelo")
        L.append("")
        for a in r["alertas"]:
            L.append(f"- {a}")
        L.append("")

    if cs:
        L.append("## 4. Cenários")
        L.append("")
        L.append("| Cenário | Clientes/mês | CAC | LTV/CAC | Resultado da coorte |")
        L.append("| --- | --- | --- | --- | --- |")
        for nome, v in cs.items():
            L.append(f"| {nome.title()} | {v['clientes_novos_mes']:.1f} | {brl(v['cac_blended'])} | "
                     f"{v['ltv_cac']:.2f}x | {brl(v['resultado_total_coorte'])} |")
        L.append("")

    if mr:
        L.append("## 5. Meta reversa (quanto investir para bater o objetivo)")
        L.append("")
        L.append(f"Para chegar a **{mr['alvo']:.0f} clientes por mês** com o mix atual de canais, "
                 f"o investimento projetado é de **{brl(mr['investimento'])}** por mês "
                 f"(fator de {mr['fator']:.2f}x sobre o cenário base).")
        L.append("")
        L.append("| Canal | Investimento | Clientes | CAC |")
        L.append("| --- | --- | --- | --- |")
        for c in mr["canais"]:
            L.append(f"| {c['canal']} | {brl(c['investimento'])} | {c['clientes']:.1f} | {brl(c['cac'])} |")
        L.append("")
        L.append("Confira a **capacidade de atendimento**: se a meta excede a capacidade, o gargalo "
                 "não é mídia e sim operação.")
        L.append("")

    L.append("## 6. Diagnóstico e oferta")
    L.append("")
    L.append("[TODO] Preencher com: contexto do negócio, dor real do cliente (Jobs To Be Done), "
             "as quatro forças da mudança, funil atual, conta do negócio, restrição principal "
             "e hipótese central. Use `references/segmentos.md` e `templates/diagnostico-empresa.md`.")
    L.append("")

    L.append("## 7. Motor, canais e plano de aquisição")
    L.append("")
    L.append("[TODO] Um motor principal + canais de apoio. Para cada canal: estratégia, estrutura, "
             "metas, prazo de leitura, critério de corte e riscos. Use `references/canais-aquisicao.md`.")
    L.append("")

    L.append("## 8. Conversão, vendas e CRM")
    L.append("")
    L.append("[TODO] SLA de primeira resposta, roteiro de qualificação, régua de follow-up, "
             "registro de motivo de perda. Use `references/vendas-e-crm.md`.")
    L.append("")

    L.append("## 9. Retenção, recompra e indicação")
    L.append("")
    L.append("[TODO] Jornada pós-venda, reativação da base inativa, programa de indicação com "
             "mecânica de dois lados e meta de K-factor.")
    L.append("")

    L.append("## 10. Cronograma de 90 dias")
    L.append("")
    L.append("| Semana | Foco | Entregáveis | Dono |")
    L.append("| --- | --- | --- | --- |")
    for sem, foco in [("1–2", "Fundação: rastreio, oferta, materiais, CRM"),
                      ("3–4", "Lançamento do motor principal"),
                      ("5–6", "Leitura e ajuste de criativos e roteiros"),
                      ("7–9", "Otimização por custo por venda"),
                      ("10–12", "Escala do que funciona + ativação da base")]:
        L.append(f"| {sem} | {foco} | [TODO] | [TODO] |")
    L.append("")

    L.append("## 11. Painel semanal e rituais")
    L.append("")
    L.append("Painel: leads por canal, CPL, agendamentos, comparecimento, vendas, custo por venda, "
             "ticket, CAC, LTV/CAC. Ritual semanal de 1 hora com 3 testes por semana "
             "(ver `references/ritual-de-growth.md`).")
    L.append("")

    L.append("## 12. Riscos")
    L.append("")
    L.append("| Risco | Probabilidade | Impacto | Mitigação |")
    L.append("| --- | --- | --- | --- |")
    L.append("| [TODO] | | | |")
    L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description="Gera rascunho de plano de captação com números calculados")
    ap.add_argument("--json", help="arquivo JSON com os dados do cliente")
    ap.add_argument("--out", default="plano-captacao.md", help="arquivo markdown de saída")
    ap.add_argument("--exemplo", action="store_true", help="usa o exemplo de clínica odontológica")
    ap.add_argument("--sem-cenarios", action="store_true")
    args = ap.parse_args()

    if args.exemplo or not args.json:
        d = dict(EXEMPLO)
        d.update({"regiao": "Campinas/SP", "objetivo": "chegar a 80 pacientes novos por mês",
                  "clientes_alvo_mes": 80})
    else:
        with open(args.json, encoding="utf-8") as fh:
            d = json.load(fh)

    r = analisar(d)
    cs = None if args.sem_cenarios else cenarios(d)
    mr = meta_reversa(d, r)
    texto = gerar(d, r, cs, mr)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(texto)
    print(f"Plano gerado em {args.out} ({len(texto)} caracteres)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
