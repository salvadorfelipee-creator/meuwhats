# Plano de mensuração: da decisão ao dado

Use este roteiro antes de campanha, redesign, mudança de funil ou criação de dashboard. O princípio é simples: **um evento só merece existir se puder mudar uma decisão**.

## 1. Comece pela decisão

| Pergunta | Exemplo concreto | Saída exigida |
|---|---|---|
| Qual decisão precisa ser tomada? | Aumentar verba de Search ou corrigir a landing page? | limiar de CAC e prazo de leitura |
| Quem decide? | gerente de marketing com financeiro | dono e aprovador |
| Em que janela? | semanal para mídia; mensal para margem | data de corte e timezone |
| Qual resultado importa? | venda aprovada e margem, não clique | KPI primário e métricas de guarda |
| O que pode invalidar a leitura? | cancelamento chega 10 dias depois | atraso e regra de atualização |

**Passos:**
1. Entreviste marketing, vendas, produto, financeiro e jurídico; registre as decisões reais.
2. Escreva uma frase: `Quando [situação], [responsável] decide [ação] usando [métrica] até [data]`.
3. Separe KPI primário, métricas de diagnóstico e métricas de guarda.
4. Defina o que não será medido neste ciclo para evitar telemetria sem uso.

## 2. Mapeie a jornada

| Etapa | Pergunta | Exemplo de fato | KPI | Fonte de verdade |
|---|---|---|---|---|
| Aquisição | De onde veio? | sessão com UTM | sessões qualificadas | GA4/CRM |
| Visita | Entrou na experiência certa? | landing_view | taxa de engajamento | GA4 |
| Engajamento | Mostrou intenção? | view_item, generate_lead | leads | GA4/CRM |
| Oportunidade | Pode comprar? | lead_qualified | oportunidades | CRM |
| Venda | Pagou? | order_approved | clientes e margem | ERP/financeiro |
| Ativação | Usou/recebeu valor? | activation_complete | ativação | produto/CRM |
| Retenção | Voltou? | repeat_purchase | retenção/cohort | CRM/ERP |
| Perda | Saiu ou cancelou? | churn/cancelled | churn e margem perdida | CRM/ERP |

Não trate `clique`, `form_submit` ou `purchase` como equivalentes. Descreva o denominador e a condição de validade.

## 3. Construa o dicionário de medição

Preencha `templates/dicionario-metricas.csv` ou a tabela abaixo para cada indicador.

| Campo | Exemplo preenchido |
|---|---|
| Nome estável | `lead_qualificado` |
| Definição | lead com dor, região e prazo confirmados no CRM |
| Fórmula | contagem de leads com status qualificado |
| Tipo | KPI de funil |
| Fonte de verdade | CRM |
| Fontes auxiliares | GA4, mídia |
| Granularidade | lead e dia |
| Chave | `lead_id` |
| Dono | líder comercial |
| Frequência | diário; fechamento mensal |
| Qualidade mínima | ≥95% com origem e próxima ação `[hipótese operacional]` |
| Decisão ligada | priorizar canal que traz venda, não lead bruto |
| Versão/data | v1.0 / AAAA-MM-DD |

## 4. Traduzir objetivos em especificação

| Objetivo de negócio | Pergunta analítica | KPI | Diagnóstico | Evento/registro | Decisão |
|---|---|---|---|---|---|
| Aumentar vendas com margem | Qual canal traz venda aprovada? | margem por canal | CPL, taxa lead→venda, cancelamento | `purchase` + `order_approved` | escalar/pausar |
| Reduzir desperdício | Onde o funil vaza? | custo por venda | resposta, qualificação, no-show | `lead_created`, CRM stages | corrigir processo |
| Aumentar recompra | Quem retorna e quando? | margem acumulada M3 | coorte, RFM, churn | `repeat_purchase` | ativar base |
| Prever caixa | Qual volume é provável? | vendas/margem previstas | conversão, ticket, capacidade | CRM + ERP | contratar/limitar mídia |

## 5. Desenhe o evento sem excesso

Use primeiro os eventos automáticos, Enhanced Measurement e recomendados do GA4; crie customizado apenas quando não houver equivalente. Fonte: [referência oficial de eventos GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) e [guia Analytics Mania](https://www.analyticsmania.com/post/how-to-track-events-with-google-analytics-4-and-google-tag-manager/).

| Evento | Quando disparar | Parâmetros úteis | Não faça |
|---|---|---|---|
| `generate_lead` | confirmação real de envio/lead | `lead_type`, `form_id`, `value`, `currency` | disparar no clique do botão |
| `sign_up` | conta criada com sucesso | `method` | contar tentativa falha |
| `view_item` | detalhe de produto visto | `item_id`, `item_name`, `value`, `currency` | enviar PII |
| `purchase` | pedido confirmado uma vez | `transaction_id`, `value`, `currency`, `items` | duplicar em reload |
| `activation_complete` | valor inicial entregue, se não houver recomendado | `activation_type` | marcar todo clique como conversão |

**Contrato de evento:** nome minúsculo; propósito; condição; parâmetros e tipos; exemplo JSON; dono; versão; teste; key event sim/não; retenção e sensibilidade.

## 6. Plano de implementação em 10 passos

1. Liste objetivos e decisões; dono: analista; prazo: kickoff + 1 dia.
2. Desenhe jornada e fontes; dono: analista + vendas; prazo: +3 dias.
3. Feche dicionário e nomenclatura; dono: BI; prazo: +5 dias.
4. Defina UTMs, IDs e chave de reconciliação; dono: mídia/CRM; prazo: +5 dias.
5. Especifique data layer e eventos; dono: analytics/dev; prazo: +7 dias.
6. Configure GTM em workspace de teste, consent initialization e ambientes; dono: analytics; prazo: +10 dias.
7. Crie conversões apenas de valor; dono: analytics; prazo: +10 dias.
8. Teste Preview, DebugView, Realtime, rede, backend e CRM; dono: QA; prazo: +12 dias.
9. Publique versão congelada com changelog interno; dono: aprovador técnico; prazo: +14 dias.
10. Audite semanalmente e revise definição mensalmente; dono: BI; critério: qualquer falha crítica bloqueia publicação.

## 7. Exemplo de decisão fechada

> **Ação:** aumentar Search somente se o CAC de novos clientes aprovados ficar ≤ R$ 420 por 4 semanas e a margem de contribuição pós-cancelamento permanecer positiva. **Dono:** gerente de mídia. **Prazo:** leitura em 30 dias. **Evidência:** CRM + financeiro reconciliados por `order_id`. **Se falhar:** revisar termos/página antes de elevar verba.

O valor de R$ 420 é apenas exemplo; trate como `[hipótese]` até derivar da margem, retenção e payback do negócio.

## Fontes e limites

- GA4 e eventos: [Google Developers](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).
- GTM: [Google Tag Manager](https://developers.google.com/tag-platform/tag-manager).
- Método e números do dossiê: `/home/ubuntu/pesquisa/dados-e-bi-de-marketing-dossie.md`.
- Não existe taxa universal de qualidade, consentimento ou divergência entre plataformas; calibre baseline e documente a definição local.
