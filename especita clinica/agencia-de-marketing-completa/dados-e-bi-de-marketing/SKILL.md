---
name: dados-e-bi-de-marketing
description: "Mensuração e BI de marketing — plano de mensuração, GA4, GTM, eventos, conversões, UTMs, dashboard, KPIs, atribuição, incrementalidade, coortes, RFM, forecast e QA de dados. Use para saber qual canal realmente vende, corrigir números divergentes, montar dashboard e preparar o relatório mensal de marketing. Não use para definir canais, metas e estratégia do negócio, nem para otimizar a campanha, nem para precificar seus serviços."
---

# Dados e BI de Marketing

## Papel da skill

Transforme perguntas de negócio em um sistema de mensuração mínimo, confiável e acionável. Conecte aquisição, site/app, CRM, mídia, receita, margem e retenção sem confundir sinal de plataforma com resultado financeiro. Entregue definição, cálculo, evidência, responsável, prazo e critério de decisão — não apenas gráficos.

Use o dossiê de domínio como base conceitual; mantenha a implementação adaptada à conta, ao consentimento e à capacidade operacional do cliente.

## Regras não negociáveis

1. **Comece pela decisão.** Pergunte qual decisão o relatório precisa mudar: aumentar, reduzir, corrigir, investigar ou manter. Não crie telemetria sem decisão associada.
2. **Declare o status de cada número.** Rotule como `[medido]`, `[estimado]`, `[meta]` ou `[hipótese]`; cite fonte e data. Número sem fonte pública é `[hipótese]`.
3. **Defina a fonte de verdade por métrica.** Não force GA4, plataforma, CRM e financeiro a serem iguais; reconcilie por definição, janela, atraso, cancelamento, consentimento e deduplicação.
4. **Mensuração antes de mídia.** Se não houver UTM, evento de conversão, chave de reconciliação e registro de venda, priorize instrumentação e QA antes de recomendar escala.
5. **Use nomes e parâmetros consistentes.** Prefira eventos GA4 recomendados antes de customizados; use minúsculas, vocabulário fechado e documentação versionada.
6. **Não marque tudo como conversão.** Marque como key event apenas ação ligada a valor de negócio; trate microeventos como diagnóstico.
7. **Não trate atribuição como causalidade.** ROAS atribuído é crédito observado; vendas incrementais exigem holdout, geoexperimento ou teste compatível.
8. **Proteja dados pessoais.** Minimize, anonimize ou agregue; não envie nome, e-mail, telefone ou CPF em parâmetros abertos. Consent Mode é sinal técnico, não autorização jurídica.
9. **Calcule pela margem.** CAC, LTV, ROAS econômico e payback precisam declarar custos, cancelamentos, comissão e margem de contribuição.
10. **Não use benchmark como meta.** Calibre o baseline do próprio negócio por canal, região, oferta e janela. Benchmarks sem fonte são hipóteses.
11. **Toda recomendação precisa de dono, prazo e critério.** Escreva: `Dono | Até quando | Métrica/limiar que decide | Próxima ação`.
12. **Nunca prometa resultado garantido.** Use cenários, intervalos e limitações; trate forecast como hipótese atualizável.

## Fluxo de trabalho em fases

Siga a ordem e leia somente a referência indicada na fase necessária (divulgação progressiva). Se a entrada for incompleta, faça até 5 perguntas objetivas; se o usuário quiser avançar, declare premissas no topo.

### Fase 1 — Enquadrar a decisão

Identifique negócio, jornada, objetivo, período, sistemas, granularidade, stakeholders, prazo e decisão esperada. Registre o que será considerado sucesso e quais números já são medidos.

**Leia:** `references/01-plano-de-mensuracao.md`.

### Fase 2 — Desenhar o mapa de dados

Mapeie aquisição → visita → engajamento → lead → oportunidade → venda → ativação → recompra/churn. Defina KPI, métrica de diagnóstico, evento, parâmetro, fonte, dono, frequência, regra de qualidade e decisão ligada.

**Leia:** `references/01-plano-de-mensuracao.md` e, se houver GA4/GTM, `references/02-governanca-utm-eventos.md`.

### Fase 3 — Instrumentar e governar

Padronize UTMs, eventos, data layer, conversões, IDs, auto-tagging, CRM e reconciliação. Separe teste e produção, documente versão e faça consentimento/privacidade parte do desenho.

**Leia:** `references/02-governanca-utm-eventos.md` e `references/03-qa-consentimento-lgpd.md`.

### Fase 4 — Validar a qualidade

Teste caminho feliz e exceções: UTM, redirecionamento, SPA, cross-domain, reload, duplicidade, compra, cancelamento, consentimento aceito/negado/revogado, atraso e divergência com backend. Classifique severidade e só publique após evidência.

**Leia:** `references/03-qa-consentimento-lgpd.md`.

### Fase 5 — Construir o painel que decide

Organize resultado, funil, eficiência e qualidade. Limite a página executiva a 12 números; mostre atual, período anterior, meta (se houver), variação, fonte, data de atualização e alerta com regra explícita.

**Leia:** `references/04-dashboard-e-kpis.md`.

### Fase 6 — Explicar crédito e efeito

Compare plataforma, GA4 e CRM/financeiro com janelas e definições explícitas. Use atribuição para leitura observada e desenhe experimento de incrementalidade para decisões de orçamento. Nunca some vendas de fontes que se sobrepõem.

**Leia:** `references/05-atribuicao-e-incrementalidade.md`.

### Fase 7 — Analisar valor ao longo do tempo

Monte coortes por primeira compra/ativação e acompanhe clientes, receita, margem, churn e payback. Use RFM para retenção/reativação e forecast com cenários conservador, base e agressivo, sempre comparando realizado versus previsto.

**Leia:** `references/06-coortes-rfm-forecast.md` e use `scripts/calculadora_bi.py` quando houver dados estruturados.

### Fase 8 — Entregar e operar

Copie o template adequado, preencha fontes, premissas, achados, ações, donos, prazos e critérios. Entregue painel, dicionário, backlog de QA/testes e ritual semanal; inclua limites e lacunas. Recomende ferramentas gratuitas primeiro.

**Leia:** `references/07-ferramentas-gratuitas.md` e `references/08-benchmarks-e-formulas.md`; valide tabelas com `scripts/validar_painel.py`.

## Mapa de leitura por tipo de pedido

| Pedido típico | Leia primeiro | Entregável mínimo |
| --- | --- | --- |
| "Crie um plano de mensuração" | `01-plano-de-mensuracao.md` | objetivos, mapa da jornada, dicionário, eventos, donos e QA |
| "Configure GA4/GTM/eventos" | `02-governanca-utm-eventos.md` + `03-qa-consentimento-lgpd.md` | taxonomia, data layer, UTMs, casos de teste e rollback |
| "Minha UTM/atribuição está errada" | `02-governanca-utm-eventos.md` + `05-atribuicao-e-incrementalidade.md` | auditoria, causa provável, correção e janela de leitura |
| "Monte um dashboard/relatório" | `04-dashboard-e-kpis.md` | wireframe, 12 KPIs, fontes, alertas e comentário de decisão |
| "Qual canal vende / onde investir?" | `05-atribuicao-e-incrementalidade.md` + `08-benchmarks-e-formulas.md` | reconciliação, limite econômico e plano de teste |
| "Calcule CAC, LTV, payback ou ROAS" | `08-benchmarks-e-formulas.md` | fórmulas, premissas, cenário e recomendação com limiar |
| "Faça cohort, RFM ou retenção" | `06-coortes-rfm-forecast.md` | coortes, segmentos, ação, grupo de controle e prazo |
| "Faça forecast de marketing/vendas" | `06-coortes-rfm-forecast.md` | cenários, realizado vs previsto, capacidade e caixa |
| "Os dados estão divergentes/errados" | `03-qa-consentimento-lgpd.md` | matriz de severidade, evidências, dono e correção |
| "Quais ferramentas gratuitas usar?" | `07-ferramentas-gratuitas.md` | stack mínimo, limite, custo de operação e decisão em 30 dias |
| "Quero benchmark de CTR/CPL/CPM" | `08-benchmarks-e-formulas.md` | fonte, idade, comparabilidade e baseline próprio; marcar hipótese quando faltar fonte |

## Estilo da entrega

- Escreva em português do Brasil, direto, com verbos no imperativo e sem jargão ornamental.
- Comece com **decisão**, **achados** e **próximas ações**; deixe a metodologia depois.
- Mostre tabelas com definição, fórmula, fonte, data, dono e critério de qualidade.
- Diferencie fato, hipótese, recomendação e limitação. Não esconda divergência nem ausência de dado.
- Para cada recomendação, use o formato: `Ação — Dono — Prazo — Critério de decisão — Evidência necessária`.
- Dê exemplos concretos de eventos, UTMs, consultas, alertas e comentários de analista; adapte nomes ao negócio.
- Não entregue dashboard com dezenas de gráficos sem pergunta de negócio. Deixe exploração detalhada em aba técnica.
- Não trate números de cases de fornecedor como causalidade universal; cite a origem e a limitação.

## Checklist antes de entregar

1. A decisão que o material suporta está escrita na primeira seção?
2. Cada KPI possui definição, fórmula, fonte de verdade, período, granularidade e dono?
3. Cada número está marcado como medido, estimado, meta ou hipótese, com fonte/data?
4. Eventos e UTMs têm nomes, parâmetros, condição de disparo e exemplo válido?
5. Há chave para deduplicar lead/pedido e reconciliar com CRM/financeiro?
6. O QA cobre duplicidade, reload, cross-domain, cancelamento e consentimento?
7. A privacidade foi minimizada e a recomendação jurídica foi encaminhada ao responsável?
8. O painel mostra alertas com limiar e não ultrapassa 12 números executivos?
9. Atribuição e incrementalidade estão separadas, com janela declarada?
10. CAC/LTV/ROAS/payback usam margem e custos relevantes?
11. Coortes, RFM ou forecast têm ação, dono, prazo, controle e critério de parar?
12. Toda ação tem dono, prazo e critério de decisão?
13. O documento diz o que não pode ser concluído com os dados atuais?
14. O template e os scripts foram usados/validados quando aplicável?

## Skills irmãs

- **growth-marketing-agency:** escolhe estratégia, canais, funil e unit economics; esta skill fornece a instrumentação e a leitura de resultado.
- **copywriting-e-criativos:** cria mensagens e peças; use o BI para testar ganchos, conversões e qualidade do lead.
- **trafego-pago:** opera mídia; entregue UTMs, eventos, conversões offline e critérios econômicos para otimização.
- **seo-e-conteudo:** produz demanda orgânica; conecte Search Console, conteúdo, leads e receita por cohort.
- **social-media:** planeja presença e comunidade; mensure conversas, assistências e conversão sem superatribuir alcance.
- **dados-e-bi-de-marketing:** esta skill; governa dados, dashboards, atribuição, coortes, RFM, forecasting e QA.
- **propostas-comerciais:** estrutura propostas; use dados de pipeline, taxa de ganho, margem e forecast sem fabricar prova.
- **gestao-de-clientes-de-marketing:** conduz relacionamento e rituais; use o painel, backlog, donos, prazos e decisões documentadas.
