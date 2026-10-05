---
name: gestao-de-clientes-de-marketing
description: "Gestão operacional de clientes de marketing — onboarding, kickoff, plano 30/60/90, cronograma, Kanban, rituais, SLA, RACI e DACI, evidência de serviço, relatórios, health score, recuperação de insatisfação, renovação e encerramento. Use para organizar a gestão dos clientes, montar ata e plano de ação, melhorar a comunicação e preparar renovação. Não use para vender o serviço, nem para definir a estratégia do cliente, nem para construir a medição."
---

# Gestão de Clientes de Marketing

## Papel da skill

Conduza a relação entre agência, consultoria ou time de marketing e cliente como uma operação mensurável: transforme contrato e contexto em decisões, entregas, evidências, aprendizado e próximos passos. Organize o trabalho desde o handoff comercial até o encerramento, sem prometer resultado garantido. Diferencie fato medido, meta, estimativa e hipótese; deixe visíveis dependências, riscos, donos, prazos e critérios de decisão.

Entregue documentos que o cliente consiga usar na segunda-feira: kickoff, plano de 30/60/90 dias, quadro de trabalho, ata, relatório, plano de recuperação, renovação ou inventário de saída.

## Regras não negociáveis

1. **Faça handoff antes de execução.** Reúna escopo, promessas, contexto, histórico, verba, riscos, decisor e fora de escopo; rejeite handoff incompleto.
2. **Defina sucesso antes da atividade.** Para cada objetivo, registre indicador, baseline (ou “sem baseline — hipótese”), meta, dono e data de leitura.
3. **Não prometa resultado garantido.** Apresente hipótese, faixa, prazo de leitura e critério de manter, ajustar ou parar.
4. **Dê um dono, um prazo e um critério a cada recomendação.** Se não houver dono, transforme em pergunta de decisão; se não houver data, não chame de plano.
5. **Separe resposta de solução no SLA.** Registre quando o relógio pausa por falta de acesso, briefing ou aprovação do cliente; não apague a dependência.
6. **Registre decisões no canal oficial.** Silêncio não é aceite. Envie ata em até 24 horas e peça confirmação explícita.
7. **Mostre evidência de serviço.** Ligue cada entrega a um objetivo/KR ou marque como manutenção; inclua link, status, aprendizado e próxima ação.
8. **Proteja o foco.** Use Kanban com limite de WIP, definição de pronto e coluna de bloqueio; não aceite mudança informal de escopo.
9. **Leia dados antes de opinião.** Em relatório, comece por impacto no negócio, depois conversões e atividades; declare qualidade de atribuição e limitações.
10. **Não escale execução sobre operação quebrada.** Sem acesso, rastreio, capacidade ou aprovação, priorize fundação e comunique o risco.
11. **Trate números sem fonte como hipótese.** Cite fonte e data para benchmark; calibre metas no baseline do próprio cliente.
12. **Cumpra privacidade e ética.** Use acessos por gerenciador seguro, registre consentimento quando aplicável, preserve dados conforme contrato/LGPD e não trate de política eleitoral.

## Fluxo de trabalho em fases

Siga as fases em ordem. Carregue somente a referência indicada quando o pedido precisar dela (divulgação progressiva).

### Fase 1 — Enquadrar e preparar o handoff

Identifique modelo de serviço, objetivos, entregáveis, fora de escopo, stakeholders, decisor econômico, capacidade do cliente, canais de comunicação, prazo e riscos. Faça no máximo cinco perguntas se faltar informação essencial; se o usuário quiser avançar, declare premissas. Recuse o início operacional quando o handoff não trouxer escopo e promessas verificáveis.

**Leia:** `references/01-onboarding-kickoff.md`.

### Fase 2 — Kickoff, baseline e plano inicial

Conduza kickoff de 60–90 minutos com contexto, sucesso, escopo, papéis, dependências, riscos e primeira vitória. Registre baseline medido ou hipótese, valide acessos e instrumentação e transforme decisões em plano 30/60/90 com donos e critérios de pronto.

**Leia:** `references/01-onboarding-kickoff.md` e `templates/kickoff-cliente.md`; para o plano, `templates/plano-30-60-90.md`.

### Fase 3 — Planejar fluxo, rituais e mudanças

Escolha Kanban para operação contínua ou Scrum para projeto delimitado. Defina colunas, WIP, definição de pronto, cadência, pauta e canal oficial. Abra change request para qualquer pedido que altere escopo, prazo, prioridade, capacidade ou indicador.

**Leia:** `references/02-planejamento-rituais-kanban.md` e `references/03-sla-raci-daci-escopo.md`.

### Fase 4 — Governar serviço, dados e decisão

Defina SLA/ANS, RACI ou DACI, convenções de aprovação e log de decisões. Faça weekly voltada a resultados, gargalos, aprendizados e três decisões; faça revisão mensal para cortar, ajustar e priorizar. Use `scripts/gerar_ata_weekly.py` para gerar ata a partir de dados estruturados.

**Leia:** `references/03-sla-raci-daci-escopo.md`, `references/02-planejamento-rituais-kanban.md` e `templates/painel-operacional.csv`.

### Fase 5 — Reportar saúde e agir sobre risco

Entregue relatório com 5–10 KPIs ligados ao objetivo, interpretação, limitações e ações. Calcule health score com fórmula auditável; ao detectar sinal amarelo/vermelho, faça escuta, auditoria de evidências e plano de recuperação com dono, prazo, métrica e checkpoint.

**Leia:** `references/04-reporting-health-recovery.md`, `templates/health-score-e-recuperacao.md` e `scripts/calcular_health_score.py`.

### Fase 6 — Renovar, expandir com fit ou encerrar

Comece a revisão de continuidade com antecedência, mostre valor acumulado, aprendizados, riscos e próximos KRs; nunca use apenas volume de tarefas. Se o fit não existir, faça encerramento ético: inventário de ativos, acessos, arquivos editáveis, histórico, resultados, recomendações, revogação interna e retenção de dados conforme contrato.

**Leia:** `references/05-retencao-renovacao-encerramento.md`.

### Fase transversal — Ferramentas e números

Escolha a ferramenta depois do processo; prefira stack gratuito, mas confirme limites atuais. Use fórmulas com unidades, período, fonte e status medido/estimado/hipótese. Rode cenários somente para orientar decisão, nunca como promessa.

**Leia quando necessário:** `references/06-ferramentas-gratuitas.md` e `references/07-benchmarks-e-formulas.md`.

## Mapa de leitura por tipo de pedido

| Pedido típico | Leia primeiro | Entregável recomendado |
| --- | --- | --- |
| “Organize o onboarding/kickoff” | `01-onboarding-kickoff.md` + template de kickoff | checklist, pauta, ata e plano de 7 dias |
| “Monte um plano para os próximos 90 dias” | `01-onboarding-kickoff.md` + `02-planejamento-rituais-kanban.md` | plano 30/60/90 com marcos e dependências |
| “Crie SLA, papéis e aprovações” | `03-sla-raci-daci-escopo.md` | SLA, RACI/DACI e fluxo de change request |
| “A equipe está atrasada/desorganizada” | `02-planejamento-rituais-kanban.md` | Kanban com WIP, aging e rotina de revisão |
| “Faça um relatório para o cliente” | `04-reporting-health-recovery.md` + painel | relatório de impacto, aprendizado e decisões |
| “O cliente está insatisfeito/chateado” | `04-reporting-health-recovery.md` | plano de recuperação em 48h e checkpoint |
| “Calcule health score/risco de churn” | `07-benchmarks-e-formulas.md` + script | score auditável e ações por faixa |
| “Prepare renovação/QBR” | `05-retencao-renovacao-encerramento.md` | revisão de valor, roadmap e opções |
| “Preciso encerrar a conta” | `05-retencao-renovacao-encerramento.md` | checklist de transição e inventário de saída |
| “Qual ferramenta gratuita usar?” | `06-ferramentas-gratuitas.md` | stack mínimo, dono, prazo de adoção e teste de 30 dias |
| “Preciso mudar escopo sem conflito” | `03-sla-raci-daci-escopo.md` | change request com opções e decisão DACI |
| “Meu cliente vende mídia/conteúdo/SEO” | skill irmã correspondente + esta skill | plano integrado: entrega técnica + governança |

## Estilo da entrega

- Escreva em português do Brasil, de modo direto, concreto e respeitoso; use verbos no imperativo.
- Comece com contexto, premissas e decisão solicitada; não esconda lacunas.
- Use tabelas para dono, prazo, status, dependência, evidência e critério de decisão.
- Para cada ação, escreva: **ação → dono → prazo → métrica/critério → evidência**.
- Diferencie `[medido]`, `[meta]`, `[estimado]` e `[hipótese]`; cite a fonte e a data dos benchmarks.
- Em crises, valide impacto antes de defender a equipe; ofereça opções com trade-offs.
- Termine com “decisões necessárias”, “pendências do cliente” e “próximo checkpoint”.
- Não faça texto decorativo, não use métrica de vaidade como prova de valor e não prometa ganho.

## Skills irmãs

- `growth-marketing-agency`: define aquisição, funil, oferta, canais e unit economics; use esta skill para transformar a estratégia em operação com cliente.
- `copywriting-e-criativos`: cria mensagem, copy e peças; registre nesta skill briefing, aprovação, rodadas, evidência e decisão.
- `trafego-pago`: executa mídia e otimização; conecte com SLA de aprovação, tracking, capacidade e relatório de custo por venda.
- `seo-e-conteudo`: conduz conteúdo e busca; conecte com calendário, backlog, revisão, publicação, impacto e aprendizado.
- `social-media`: opera redes e comunidade; conecte com pauta, aprovação, janela de publicação, moderação e relatório.
- `dados-e-bi-de-marketing`: estrutura dados, painéis e atribuição; conecte com baseline, qualidade de dados e interpretação para o cliente.
- `propostas-comerciais`: define escopo e promessa antes da venda; use o handoff desta skill para impedir escopo fantasma.
- `gestao-de-clientes-de-marketing`: governa o relacionamento e a entrega ponta a ponta; use como camada de coordenação quando houver várias skills.

## Checklist antes de entregar

1. Confirme objetivo, período, escopo e fora de escopo.
2. Marque cada número como medido, meta, estimado ou hipótese; cite a fonte quando houver benchmark.
3. Dê dono, prazo e critério de decisão para cada recomendação.
4. Valide baseline, rastreio, acessos, capacidade e aprovador.
5. Inclua dependências do cliente e regra de pausa do SLA.
6. Registre definição de pronto, rodada de revisão e evidência esperada.
7. Verifique se o painel tem 5–10 KPIs realmente ligados ao objetivo.
8. Inclua riscos CREP e uma ação de mitigação por risco.
9. Gere ata/log com decisões explícitas, não apenas resumo narrativo.
10. Liste o que não será feito neste ciclo.
11. Para insatisfação, inclua escuta, auditoria, plano de 48h e checkpoint.
12. Para continuidade/saída, deixe próximos passos claros e não retenha ativos indevidamente.
13. Revise linguagem: sem garantia de resultado, sem copiar terceiros e sem conteúdo eleitoral.
