# Benchmarks, fórmulas e critérios de decisão

## Índice

1. Classificação de números  
2. Fórmulas de gestão  
3. Benchmarks com fonte  
4. Calibração sem baseline  
5. Exemplo de decisão

## 1. Classificação de números

| Rótulo | Significado | Como escrever |
| --- | --- | --- |
| `[medido]` | veio de sistema, período e fonte definidos | “42 oportunidades `[medido no CRM, mar/2026]`” |
| `[meta]` | resultado desejado e prazo | “≤R$220 até 30/06 `[meta]`” |
| `[estimado]` | cálculo com dado incompleto | “34 meses `[estimado por renovação]`” |
| `[hipótese]` | suposição a validar | “WIP 3 `[hipótese operacional]`” |
| `[benchmark]` | número externo com fonte/data | “5–10 KPIs `[AgencyAnalytics, acesso no dossiê]`” |

Nunca use benchmark externo como garantia. Quando não houver fonte pública brasileira comparável, escreva: **sem fonte pública — tratar como hipótese**.

## 2. Fórmulas

| Indicador | Fórmula | Interpretação e cuidado |
| --- | --- | --- |
| cumprimento de SLA | itens dentro do prazo ÷ itens elegíveis × 100 | reporte pausas por dependência; não apague itens |
| lead time | conclusão − entrada | tempo total no fluxo |
| cycle time | conclusão − início | tempo em execução |
| churn de logo | clientes perdidos ÷ clientes no início × 100 | acompanhe por coorte |
| churn de receita | MRR perdido ÷ MRR inicial × 100 | não confunda com logos |
| retenção | (clientes no fim − novos) ÷ clientes no início × 100 | declare período |
| NPS | % promotores (9–10) − % detratores (0–6) | registre amostra e data |
| CAC blended | (mídia + comercial + ferramentas variáveis) ÷ novos clientes | use margem para decisão |
| LTV simplificado | ticket mensal × margem de contribuição × meses esperados | sem baseline, marque hipótese |
| LTV/CAC | LTV ÷ CAC | não é benchmark universal |
| payback | CAC ÷ margem mensal por cliente | declare moeda e período |
| score health | soma(dimensão × peso) ÷ 100 | pesos precisam ser auditáveis |

### Recorrência anual sem permanência

`anos ≈ 1 ÷ (1 − taxa de renovação anual)`; `meses = anos × 12`. Exemplo: renovação de 80% → 5 anos → 60 meses `[estimado; validar em 90 dias]`. Para prazo fixo, use prazo real.

### Cenários

Monte conservador, base e agressivo alterando uma premissa por vez. Declare cada fator e rode janela suficiente para substituir hipótese por medida. Não declare vencedor de teste com menos de aproximadamente 30 conversões por variação: regra interna citada no dossiê, não lei estatística universal.

## 3. Benchmarks com fonte

| Número | Fonte/origem | Como usar |
| --- | --- | --- |
| 5–10 KPIs em relatório | AgencyAnalytics, https://agencyanalytics.com/blog/client-reporting-tips | filtro de leitura, não meta de performance |
| 1 Accountable por tarefa | Atlassian RACI, https://www.atlassian.com/work-management/project-management/raci-chart | regra de responsabilidade |
| 15 min de preparo, 60 min de execução e 3–6 pessoas no DACI | Atlassian play, https://www.atlassian.com/team-playbook/plays/daci | instrução do play; não benchmark de eficácia |
| 20% anual como preocupação em retainer | Sakas & Company, https://sakasandcompany.com/client-turnover-rates/ | orientação consultiva; não censo brasileiro |
| 30%–50% anual plausível em projetos | Sakas & Company, mesma fonte | separar projeto de recorrência e analisar pipeline |
| +5% retenção associado a +25%–95% de lucro | Bain, https://www.bain.com/insights/retaining-customers-is-the-real-challenge/ | achado geral; não específico de agência brasileira |
| 1–2 semanas de onboarding típico | DesignRush, https://www.designrush.com/agency/business-consulting/trends/agency-client-onboarding | variação por complexidade; não promessa |
| aproximadamente 30 conversões por variação para decisão interna | dossiê/manual de ritual local | regra operacional; alongar em negócio pequeno |
| aumento de verba de 20%–30% por degrau | dossiê/manual de ritual local | hipótese operacional; ler custo marginal |

## 4. Calibrar quando falta baseline

1. Marque campos como `[hipótese]`, nunca como medido.
2. Derive somente o que os dados permitem: `CPL = gasto ÷ leads`; `conversão = vendas ÷ leads`.
3. Rode meta reversa para mostrar esforço, sem prometer custo.
4. Defina 14–30 dias de instrumentação/teste `[dossiê]` e data de revisão.
5. Use o teto de custo que vem da margem e do objetivo de LTV/CAC; explique a premissa.
6. Troque hipótese por dado somente depois de registrar fonte e período.

### Tabela de decisão

| Situação | Decisão | Dono | Prazo | Critério |
| --- | --- | --- | --- | --- |
| dado ausente | instrumentar antes de otimizar | dados | 7 dias `[hipótese]` | evento, origem e CRM testados |
| métrica melhora, qualidade cai | manter em observação ou pausar | account lead | próxima weekly | qualidade mínima definida |
| custo acima do teto | ajustar oferta/processo/canal | estratégia | 7 dias | novo custo dentro do teto ou corte |
| resultado inconclusivo | prolongar ou arquivar | PM | 2–3 semanas | volume suficiente ou decisão registrada |

## 5. Exemplo de decisão

**Dados:** ticket R$1.000 `[medido]`, margem 60% `[estimado pelo cliente]`, permanência 6 meses `[hipótese]`, CAC R$1.200 `[medido no CRM]`.

- LTV simplificado = `1.000 × 0,60 × 6 = R$3.600` `[estimado]`.
- LTV/CAC = `3.600 ÷ 1.200 = 3,0x` `[calculado]`.
- Decisão: manter apenas se qualidade e capacidade estiverem estáveis; validar margem e permanência em 90 dias.

| Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| confirmar margem por serviço | cliente/financeiro | 5 dias úteis | fonte contábil registrada |
| registrar coorte de permanência | dados | 30 dias | primeira coorte com data de entrada |
| auditar capacidade | operação | 7 dias | demanda projetada não excede agenda |

## Fontes e lacunas

A base principal é o dossiê local, seção 3. Não existe benchmark público confiável e comparável para todas as agências brasileiras em churn, SLA, health score, frequência de weekly ou capacidade por account manager. Declare a lacuna e meça o baseline próprio.
