# Planejamento, Kanban e rituais

## Índice

1. Escolha do método  
2. Quadro e definição de pronto  
3. Plano 30/60/90  
4. Weekly, mensal e QBR  
5. Métricas de fluxo  
6. Exemplo operacional

## 1. Escolha do método

| Situação | Método | Cadência | Saída principal | Evite |
| --- | --- | --- | --- | --- |
| Operação contínua de mídia, SEO, conteúdo e atendimento | Kanban | revisão semanal | fluxo visível e lead/cycle time | sprint artificial para toda demanda |
| Projeto delimitado de landing page/campanha | Scrum adaptado | sprint de 1–2 semanas | backlog, review e retrospectiva | chamar reunião externa de daily |
| Decisão travada ou mudança de prioridade | DACI | reunião ad hoc | decisão, opção escolhida e ação | consultar todos sem approver |

O Scrum Guide 2020 descreve sprint, revisão e retrospectiva; a daily é inspeção interna. Kanban recomenda visualizar o fluxo, limitar WIP, gerir fluxo e melhorar continuamente. Use os conceitos, não os nomes como decoração.

## 2. Quadro e definição de pronto

Use estas colunas mínimas:

`Entrada/triagem → Pronto → Em execução → Revisão interna → Aprovação cliente → Publicado/entregue → Aprendizado`

| Campo obrigatório do cartão | Exemplo concreto |
| --- | --- |
| Objetivo/KR | gerar 10 reuniões qualificadas no mês `[meta]` |
| Entrega | landing page de diagnóstico B2B |
| Responsável | Ana, copy |
| Aprovador | João, diretor do cliente |
| Data | envio 08/04; feedback até 10/04 |
| Definição de pronto | copy revisada, formulário testado, UTM e evento ativos |
| Evidência | link do documento e vídeo do teste |
| Bloqueio | aguarda acesso ao domínio desde 06/04 |
| Aprendizado | formulário com 3 perguntas teve menor abandono `[medir]` |

**Regras de fluxo:**

1. Limite WIP por coluna; comece com `Em execução = 3` por equipe `[hipótese operacional]`.
2. Não puxe item novo se a coluna seguinte estiver lotada; resolva gargalo.
3. Separe “aguardando cliente” de atraso interno.
4. Marque aging diário dos itens bloqueados e escale depois do prazo de resposta do SLA.
5. Feche o cartão somente com evidência, status e aprendizado ou motivo de descarte.

## 3. Plano 30/60/90

Quebre objetivo em marcos, tarefas e dependências. Nunca escreva “melhorar marketing” como entrega.

| Horizonte | Foco | Entregas exemplificadas | Dono | Critério de decisão |
| --- | --- | --- | --- | --- |
| Dias 1–30 | fundação e baseline | rastreio, backlog, oferta, painel, primeiro teste | PM + especialistas | manter só se dados e capacidade estiverem prontos |
| Dias 31–60 | leitura e otimização | testes priorizados, correção de gargalo, relatório comparável | account lead | ajustar se KR não mover e premissa cair |
| Dias 61–90 | padronização | playbook do vencedor, roadmap, revisão de risco | líder de conta + cliente | escalar apenas se custo/qualidade/capacidade couberem |

Para cada marco, registre:

| Marco | Dependência do cliente | Esforço P/M/G | Data de envio | Data de aprovação | Pronto quando |
| --- | --- | --- | --- | --- | --- |
| Painel v1 | acesso a GA4 e CRM | M | 12/04 | 15/04 | 5–10 KPIs, fonte e atualização testadas |
| Campanha piloto | verba e aprovação de oferta | G | 19/04 | 22/04 | UTMs, evento, peças e resposta prontos |
| Revisão de 30 dias | dados de vendas | M | 30/04 | 02/05 | custo por venda e qualidade interpretados |

## 4. Rituais

### Weekly com cliente (60 min)

| Minutos | Bloco | Pergunta | Saída |
| --- | --- | --- | --- |
| 0–15 | números | o que aconteceu com o KR e a qualidade do dado? | 1–3 achados |
| 15–25 | gargalo | onde o fluxo perde mais valor? | gargalo priorizado |
| 25–45 | testes | quais três hipóteses merecem execução? | hipótese, dono, prazo, métrica |
| 45–55 | revisão | testes venceram, perderam ou foram inconclusivos? | decisão registrada |
| 55–60 | fechamento | quem faz o quê até quando? | lista de ações e checkpoint |

### Daily interna

Use 15 minutos ou atualização assíncrona: ontem, hoje, bloqueio. Resolva temas fora da daily e não chame o cliente para esse ritual.

### Revisão mensal (2 horas)

1. Corte ações que não atingem critério de custo/qualidade.
2. Escale gradualmente vencedores e leia custo marginal.
3. Converta hipóteses em dados ou arquive-as.
4. Revise capacidade, saúde, satisfação e riscos.
5. Atualize próximos 30 dias e aceite de mudança de escopo.

### QBR/revisão de continuidade

Use a cada trimestre ou antes da decisão de continuidade: valor acumulado, KRs, aprendizados, riscos, roadmap, capacidade e opções. Não apresente somente volume de tarefas.

## 5. Métricas de fluxo

| Métrica | Fórmula | Uso | Decisão |
| --- | --- | --- | --- |
| Lead time | conclusão − entrada | tempo total percebido | reduzir fila/bloqueio |
| Cycle time | conclusão − início | tempo em execução | limitar WIP |
| Throughput | itens concluídos/período | capacidade real | ajustar promessa |
| Aging | hoje − entrada de item aberto | risco de esquecimento | escalar ou replanejar |
| Itens bloqueados | contagem por dependência | gargalo externo/interno | dono e data de destrave |

As fórmulas e o uso de WIP seguem o material de Kanban da Atlassian: https://www.atlassian.com/agile/kanban. Não use meta universal; meça duas semanas antes de calibrar.

## 6. Exemplo operacional

**Problema:** cinco criativos em revisão há oito dias.  
**Leitura:** gargalo na aprovação, não na produção `[medido no quadro]`.  

| Decisão | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| Consolidar feedback em um formulário | account lead | hoje | um canal e uma rodada aberta |
| Definir aprovador substituto | cliente | 2 dias úteis | nome e limite de decisão registrados |
| Limitar WIP de revisão a 3 | PM | amanhã | nenhum novo item entra acima do limite |
| Revisar aging semanal | PM | toda sexta | item > SLA escalado com opção de data/escopo |

## Fontes

- Dossiê local, seções 1.3, 1.4 e 2.2–2.3.
- Scrum Guide 2020: https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf.
- Atlassian Kanban: https://www.atlassian.com/agile/kanban.
