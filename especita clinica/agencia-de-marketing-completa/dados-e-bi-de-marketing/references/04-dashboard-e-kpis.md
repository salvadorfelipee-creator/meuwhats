# Dashboard e KPIs que geram decisão

Use para desenhar painel executivo, relatório mensal ou camada exploratória. O dashboard dá destaque; a análise conecta fato, hipótese e ação.

## 1. Arquitetura em quatro camadas

| Camada | Pergunta | Exemplos | Frequência sugerida |
|---|---|---|---|
| Resultado | o negócio ganhou valor? | receita líquida, margem, vendas, clientes | semanal/mensal |
| Funil | onde o volume passa ou vaza? | sessões, leads, qualificados, oportunidades, venda | diário/semanal |
| Eficiência | quanto custa gerar valor? | CAC, CPL qualificado, payback, LTV/CAC | semanal/mensal |
| Qualidade | posso confiar na leitura? | frescor, completude, duplicidade, consentimento | diário/semanal |

Não misture métrica de topo (impressão/CTR) com fechamento como se fossem a mesma etapa. Use a matriz atenção × intenção para contextualizar o papel do canal.

## 2. Página executiva com até 12 números

| Posição | Número | Exibição mínima | Alerta de exemplo |
|---:|---|---|---|
| 1 | margem/receita líquida | atual, anterior, variação, fonte | abaixo da meta declarada |
| 2 | vendas aprovadas | período e status | queda semana contra semana |
| 3 | clientes novos | por canal, se muda decisão | abaixo do plano |
| 4 | CAC blended | fórmula e custos inclusos | acima do teto econômico |
| 5 | LTV/CAC | horizonte e coorte | abaixo de 3x é alerta de referência, não lei |
| 6 | payback | meses e margem | acima do caixa suportado |
| 7 | leads qualificados | definição CRM | completude baixa |
| 8 | conversão lead→venda | denominador | queda ≥ 20% `[hipótese de alerta]` |
| 9 | taxa de resposta | janela | acima do SLA |
| 10 | retenção/cohort M1 ou recompra | safra e corte | nova coorte abaixo da anterior |
| 11 | cobertura de origem | proporção com UTM/CRM | abaixo de 95% `[hipótese operacional]` |
| 12 | frescor/duplicidade | hora de atualização e contagem | fora do SLA/qualquer crítica |

Os limiares de queda, cobertura e qualidade acima são exemplos operacionais; marque como `[hipótese]` e calibre após 4 semanas.

## 3. Especificação de KPI

| Campo | Exemplo |
|---|---|
| Pergunta | podemos aumentar Search? |
| KPI | CAC blended por cliente aprovado |
| Fórmula | (mídia + custo comercial + ferramentas incluídas) ÷ clientes aprovados |
| Fonte de verdade | financeiro + CRM |
| Janela | mês fechado, timezone Brasil |
| Filtros | cancelados/estornos excluídos; documentar |
| Segmentação | canal/campanha/cohort quando muda decisão |
| Meta | número informado pelo cliente; senão não criar |
| Alerta | `CAC > teto` por 2 leituras consecutivas `[hipótese]` |
| Dono | gerente de marketing |
| Ação | pausar, corrigir ou testar incrementalidade |

## 4. Funil e comentário do analista

Apresente cada etapa com volume, taxa, comparação e fonte.

| Etapa | Volume atual | Taxa de passagem | Variação | Interpretação |
|---|---:|---:|---:|---|
| Sessões qualificadas | 10.000 `[medido]` | — | +12% | tráfego cresceu |
| Leads | 400 `[medido]` | 4% | -1 p.p. | landing ou oferta a investigar |
| Qualificados | 180 `[medido]` | 45% | -5 p.p. | mensagem pode atrair perfil errado |
| Vendas aprovadas | 36 `[medido]` | 20% | estável | fechamento preservado |

**Modelo de comentário:**

> **Fato:** leads cresceram 12%, mas qualificados caíram 5 p.p. `[fonte: CRM, semana X]`. **Hipótese:** nova peça trouxe volume com baixa aderência; ainda não é causalidade. **Ação:** revisar criativo e perguntar origem/dor em 50 próximos leads. **Dono:** mídia + comercial. **Prazo:** 7 dias. **Critério:** manter peça se taxa qualificado→venda não cair; pausar se CAC exceder o teto por 2 leituras.

## 5. Abas recomendadas

1. **Executivo:** até 12 números e decisões.
2. **Funil:** etapas, taxas, segmentos e vazamentos.
3. **Aquisição:** canal/campanha, UTM, plataforma, CRM e financeiro.
4. **Retenção:** cohort, RFM, recompra, churn, margem acumulada.
5. **Qualidade:** frescor, completude, duplicidade, consentimento, falhas.
6. **Dicionário:** definição, fórmula, fonte, dono, versão.
7. **Backlog:** testes, ações e decisões registradas.

## 6. Ritual de operação

| Ritmo | Agenda | Dono | Saída |
|---|---|---|---|
| Diário | frescor, falha crítica, gasto sem conversão | analista | incidente/sem incidente |
| Semanal (1h) | ler números, localizar gargalo, escolher até 3 testes | líder de growth/BI | hipótese, dono, prazo |
| Mensal (2h) | fechar receita/margem, cohort, atribuição, forecast | marketing + financeiro | decisão de orçamento |
| Trimestral | revisar taxonomia, fontes e perguntas | owner de dados | versão do plano |

## 7. Ferramenta não substitui decisão

Antes de recomendar Looker Studio, Sheets, BI ou warehouse, responda: qual decisão muda, quem opera, qual é o custo de manutenção, qual latência é aceitável e se a prova de valor cabe em 30 dias. Consulte `references/07-ferramentas-gratuitas.md`.
