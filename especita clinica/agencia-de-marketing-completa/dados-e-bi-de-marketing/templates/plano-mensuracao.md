# Plano de Mensuração e BI — {{empresa}}

> Período: {{periodo}} · Região/produto: {{escopo}} · Elaborado em: {{data}} · Responsável: {{responsavel}}

**Como usar:** substitua os campos entre chaves, marque cada número como `[medido]`, `[estimado]`, `[meta]` ou `[hipótese]` e não publique recomendação sem dono, prazo e critério.

## 1. Decisão que este plano suporta

- **Decisão:** {{aumentar_reduzir_corrigir_investigar}}
- **Quem decide:** {{nome_cargo}}
- **Prazo da decisão:** {{data}}
- **KPI primário:** {{kpi}}
- **Métricas de guarda:** {{guardas}}
- **O que não será decidido ainda:** {{limite}}

## 2. Premissas e evidências

| Item | Valor | Status | Fonte/data | Limitação |
|---|---|---|---|---|
| Objetivo de negócio | | | | |
| Período e timezone | | | | |
| Capacidade | | | | |
| Margem | | | | |
| Retenção | | | | |

## 3. Jornada e plano de medição

| Etapa | Pergunta | KPI | Diagnóstico | Evento/registro | Fonte de verdade | Dono | Frequência |
|---|---|---|---|---|---|---|---|
| Aquisição | | | | | | | |
| Visita | | | | | | | |
| Engajamento | | | | | | | |
| Lead | | | | | | | |
| Oportunidade | | | | | | | |
| Venda aprovada | | | | | | | |
| Ativação | | | | | | | |
| Recompra/churn | | | | | | | |

## 4. UTMs e taxonomia de eventos

### Vocabulário UTM

| Campo | Valores permitidos | Exemplo |
|---|---|---|
| `utm_source` | | |
| `utm_medium` | | |
| `utm_campaign` | | |
| `utm_content` | | |
| `utm_term` | | |

### Eventos prioritários

| Evento | Condição de disparo | Parâmetros/tipos | Deduplicador | Key event? | Teste |
|---|---|---|---|---|---|
| `generate_lead` | | | `lead_id` | | |
| `purchase` | | | `transaction_id` | | |
| `order_cancelled` | | | `order_id` | | |

## 5. Fontes e reconciliação

| Campo | GA4 | Mídia | CRM | Financeiro | Regra |
|---|---|---|---|---|---|
| Lead | | | | | |
| Venda | | | | | |
| Receita | | | | | |
| Cancelamento | | | | | |

## 6. Dashboard

| Camada | Indicadores | Fonte | Atualização | Alerta | Dono |
|---|---|---|---|---|---|
| Resultado | | | | | |
| Funil | | | | | |
| Eficiência | | | | | |
| Qualidade | | | | | |

**Comentário executivo (fato → hipótese → ação):**

> Fato: {{fato_com_fonte}}. Hipótese: {{hipotese_e_limite}}. Ação: {{acao}} — dono: {{dono}} — prazo: {{prazo}} — critério: {{criterio}}.

## 7. QA e privacidade

| Caso | Evidência | Severidade | Dono | Prazo | Critério de aceite |
|---|---|---|---|---|---|
| UTM/redirecionamento | | | | | |
| Duplicidade/reload | | | | | |
| Cross-domain/SPA | | | | | |
| Compra/cancelamento | | | | | |
| Consentimento | | | | | |
| PII/minimização | | | | | |

## 8. Atribuição e incrementalidade

- Conversão e status: {{definicao}}
- Janelas: {{janelas}}
- Modelo(s) observado(s): {{modelos}}
- O que é atribuído, mas não causal: {{limite}}
- Teste incremental proposto: {{holdout_geo_etc}}
- Dono: {{dono}} · prazo: {{prazo}} · critério: {{criterio}}

## 9. Cronograma e responsabilidades

| Prazo | Entrega | Dono | Dependência | Critério de pronto |
|---|---|---|---|---|
| D+1 | decisões e premissas | | | |
| D+5 | dicionário/UTM | | | |
| D+10 | eventos e CRM | | | |
| D+12 | QA e evidências | | | |
| D+14 | publicação/rollback | | | |
| semanal | painel e backlog | | | |

## 10. Lacunas e decisões pendentes

| Lacuna | Impacto | Como medir | Dono | Prazo | Critério |
|---|---|---|---|---|---|
| | | | | | |

## Checklist de aceite

- [ ] decisão e KPI primário estão claros;
- [ ] cada métrica tem definição, fórmula, fonte, dono e versão;
- [ ] dados estão rotulados como medidos/estimados/meta/hipótese;
- [ ] UTMs e eventos têm regra de nomes e deduplicação;
- [ ] QA cobre consentimento, PII, reload, cancelamento e atraso;
- [ ] atribuição está separada de incrementalidade;
- [ ] cada recomendação tem dono, prazo e critério;
- [ ] limitações e o que não pode ser concluído estão escritos.
