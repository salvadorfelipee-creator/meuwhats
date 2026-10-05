# Benchmarks, fórmulas e calibração

**Regra:** benchmark é referência de ordem de grandeza, não meta. Informe fonte, ano, população, janela e comparabilidade. Se não houver fonte pública comparável, escreva `[hipótese — medir baseline]`.

## 1. Fórmulas operacionais

| Métrica | Fórmula | Base recomendada | Cuidado |
|---|---|---|---|
| CTR | cliques ÷ impressões | plataforma | não é venda |
| CPC | investimento ÷ cliques | mídia | depende de qualidade |
| CPL | investimento ÷ leads | CRM/financeiro + mídia | lead barato pode ser ruim |
| taxa de conversão | conversões ÷ denominador declarado | funil | escreva o denominador |
| CAC pago | mídia ÷ clientes novos | financeiro/CRM | não inclui comercial |
| CAC blended | (mídia + vendas + ferramentas) ÷ clientes novos | financeiro | declare custos |
| margem | receita líquida − custos variáveis | financeiro | incluir cancelamento/comissão |
| ROAS | receita atribuída ÷ mídia | plataforma/analítica | não é incrementalidade |
| ROAS margem | margem atribuída ÷ mídia | financeiro | melhor para economia |
| ROI | (ganho − custo) ÷ custo | financeiro | definir ganho |
| LTV | ticket × frequência × margem × duração | coorte/CRM | duração é hipótese se não medida |
| LTV/CAC | LTV ÷ CAC | coorte + financeiro | não comparar janelas diferentes |
| payback | CAC ÷ margem mensal | financeiro | considerar recebimento/caixa |
| churn | clientes perdidos ÷ clientes no início | CRM | separar coortes |
| retenção Mx | ativos em Mx ÷ ativos em M0 | cohort | coorte e corte explícitos |
| RFM M | receita ou margem por cliente | ERP/CRM | prefira margem |

## 2. Referências públicas do dossiê

| Referência | Número/descrição | Como usar | Fonte |
|---|---|---|---|
| Data-driven Google Ads | pelo menos 200 conversões e 2.000 interações em 30 dias para maior precisão em redes suportadas | elegibilidade da plataforma, não meta universal | [Google Ads](https://support.google.com/google-ads/answer/6394265?hl=en) |
| Eventos GA4 | quatro camadas operacionais: automáticos, Enhanced Measurement, recomendados e customizados | ordem de taxonomia | [Analytics Mania](https://www.analyticsmania.com/post/how-to-track-events-with-google-analytics-4-and-google-tag-manager/) |
| Janelas Meta | clique 1 ou 7 dias; visualização 1 dia; engajamento 1 dia, conforme configuração documentada | declarar janela; confirmar conta | [Meta](https://www.facebook.com/business/help/460276478298895) |
| Case TIM | +59% cliques e -32% custo por conversão após duas semanas | evidência direcional de fornecedor; sem grupo público | [Google Think](https://business.google.com/br/think/measurement/google-analytics-4-como-usar/) |
| Case BTG | ROAS 8,5x maior que meta média e CPA 55% menor | case sem amostra/desenho público | [Google Think](https://business.google.com/br/think/measurement/google-analytics-4-como-usar/) |
| Pesquisa Brasil no case TIM | 72% pesquisam online antes de comprar | comportamento, não taxa de conversão | [Google Think](https://business.google.com/br/think/measurement/google-analytics-4-como-usar/) |
| Jornada omnichannel no case BTG | 38% da jornada citada envolve mais de um canal | contexto do case, não benchmark geral | [Google Think](https://business.google.com/br/think/measurement/google-analytics-4-como-usar/) |
| Brasil CPM/CTR/CPL por setor | não há fonte pública comparável confiável no dossiê | marcar qualquer número como hipótese | dossiê de domínio |
| Incrementalidade 0–25% | afirmação editorial contextual | não usar como meta | [Kaushik](https://www.kaushik.net/avinash/marketing-analytics-attribution-is-not-incrementality/) |

## 3. Regras econômicas

A heurística interna de teto de CAC é:

`margem mensal por cliente × meses de retenção ÷ 3`

Ela busca LTV/CAC de 3x; é **heurística da operação, não benchmark universal**. Substitua por um valor derivado do cliente e inclua recebimento, margem, cancelamento e capacidade.

**Exemplo `[hipótese]`:** margem mensal de R$ 180, retenção de 12 meses → teto de R$ 720. Se CAC blended ficar em R$ 800, não aumente verba; teste oferta, conversão, retenção ou canal. **Dono:** gerente de marketing. **Prazo:** revisão em 30 dias. **Critério:** CAC abaixo do teto e margem acumulada positiva.

## 4. Calibrar quando não existe baseline

1. Marque todos os números como `[hipótese]` ou `[estimado]`.
2. Derive somente o que a base permite: `CPL = gasto ÷ leads`, `conversão = vendas ÷ leads`.
3. Rode três cenários, sem chamar projeção de medição.
4. Faça teste controlado de 14–30 dias `[janela operacional sugerida]`.
5. Registre canal, região, oferta, janela, orçamento, leads qualificados, vendas aprovadas, margem e cancelamento.
6. Troque hipótese por dado somente após QA e reconciliação.
7. Revise a meta em 30 dias; revise retenção e LTV quando houver cohort suficiente.

## 5. Checklist de citação

| Verificação | Sim/não |
|---|---|
| fonte pública e URL acessível | |
| data/ano e população informados | |
| janela e definição compatíveis | |
| número marcado como referência, não promessa | |
| hipótese local separada | |
| limitação/case de fornecedor explícito | |
| decisão baseada no baseline ou margem do cliente | |

## 6. Lacunas conhecidas

O dossiê não valida benchmark brasileiro atual por setor de CPM, CTR, CPL, conversão ou retenção; não há taxa universal de consentimento; limites gratuitos mudam; cases TIM/BTG não expõem amostra, controle e custos completos; não existe limiar universal de amostra para geo-incrementalidade. Declare essas lacunas no entregável e proponha medição com dono, prazo e critério.
