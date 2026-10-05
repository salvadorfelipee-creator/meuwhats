# SLA, RACI, DACI e mudança de escopo

## Índice

1. SLA/ANS operacional  
2. RACI  
3. DACI  
4. Change request  
5. Exemplos e linguagem

## 1. SLA/ANS operacional

Defina serviço, volumetria, canal, resposta inicial, execução, revisão, disponibilidade, exclusões e dependências. Separe **SLA de resposta** (confirmar recebimento e próximo passo) de **prazo de entrega/solução**.

| Serviço | Canal oficial | Resposta inicial | Execução | Rodadas | Pausa por cliente | Medição |
| --- | --- | --- | --- | --- | --- | --- |
| Pedido de ajuste simples | quadro | 1 dia útil `[hipótese]` | 3 dias úteis `[hipótese]` | 1 | briefing/aprovação ausente | itens elegíveis no prazo |
| Criativo de campanha | cartão + pasta | 1 dia útil `[hipótese]` | 5 dias úteis `[hipótese]` | 2 | acesso, oferta ou aprovação | entrega pronta e link |
| Incidente de tracking | canal urgente | 4 horas úteis `[hipótese]` | plano em 1 dia útil | conforme risco | acesso do cliente | evento testado |
| Weekly/relatório | calendário + painel | confirmar pauta em 1 dia | data combinada | 1 reunião | dados não enviados | ata em até 24h |

**Política de dependência:** inicie o relógio quando o briefing estiver completo; registre data de solicitação, data de resposta, motivo da pausa e retomada. Nunca transforme “aguardando cliente” em atraso da agência nem o esconda.

Calcule cumprimento assim: `itens dentro do prazo ÷ itens elegíveis × 100`. Mostre pausas separadamente.

## 2. RACI

- **R (Responsible):** executa.
- **A (Accountable):** responde pelo resultado; mantenha exatamente uma pessoa por atividade.
- **C (Consulted):** contribui antes da decisão.
- **I (Informed):** recebe informação depois.

| Entrega | R | A | C | I | Evidência |
| --- | --- | --- | --- | --- | --- |
| Briefing de campanha | account lead | líder de contas | cliente + copy | mídia | briefing aprovado |
| Configuração de eventos | dados | líder técnico | cliente + tráfego | account lead | teste do evento |
| Aprovação de oferta | copy + estratégia | approver do cliente | vendas | especialistas | decisão no log |
| Publicação | social/mídia | account lead | cliente | vendas | URL e horário |
| Relatório mensal | dados + account lead | líder de contas | cliente | equipe | painel e narrativa |

**Cheque:** não confunda R com A; não coloque vários A para “dividir responsabilidade”. Se não houver pessoa com autoridade, a tarefa está sem governança.

## 3. DACI para decisões travadas

Use quando a pergunta exige escolha entre opções, por exemplo: redistribuir verba, mover data, trocar canal, reduzir escopo ou aprovar promessa.

- **D (Driver):** conduz dados, agenda e prazo.
- **A (Approver):** decide; mantenha um approver.
- **C (Contributors):** trazem análise sem veto.
- **I (Informed):** recebem o resultado.

| Campo da página de decisão | Exemplo |
| --- | --- |
| Pergunta | Mantemos a publicação em 12/04 ou movemos para 19/04? |
| Contexto | aprovação atrasou 3 dias; campanha perde janela sazonal `[medido]` |
| Opção A | manter data e reduzir duas peças |
| Opção B | mover data e manter escopo |
| Critérios | KR, risco de qualidade, capacidade e impacto no prazo |
| D | PM |
| A | diretora do cliente |
| C | copy, mídia, vendas |
| I | time interno |
| Decisão/data | Opção B, 09/04 |
| Próxima ação | PM atualizar calendário até 10/04 |

O play da Atlassian cita 15 minutos de preparação, 60 de execução e grupos de 3–6 pessoas; trate isso como instrução daquele play, não benchmark universal de eficácia. Fonte: https://www.atlassian.com/team-playbook/plays/daci.

## 4. Change request

Abra um cartão quando o pedido mudar quantidade, prioridade, prazo, esforço, risco, verba ou KR.

### Passo a passo

1. Capture pedido, motivo e urgência sem prometer execução.
2. Calcule impacto em prazo, capacidade, escopo, risco e indicador.
3. Proponha três opções: manter data e reduzir escopo; manter escopo e mover data; adicionar capacidade/recursos se aplicável.
4. Nomeie Driver e Approver; consulte quem contribui.
5. Registre decisão e efeito no plano 30/60/90.
6. Atualize quadro, cronograma, ata e dependências.
7. Revise na próxima weekly se o critério foi atendido.

| Pedido | Impacto identificado | Opção A | Opção B | Decisão | Dono | Prazo | Critério |
| --- | --- | --- | --- | --- | --- | --- | --- |
| adicionar landing page | +5 dias; revisão técnica; risco no teste | adiar teste | retirar dois criativos | pendente | cliente/approver | 11/04 | uma opção aceita por escrito |

**Não faça:** “só mais uma coisinha”, revisão ilimitada, alteração no WhatsApp sem registrar, ou aceite presumido.

## 5. Linguagem de alinhamento

| Situação | Frase útil | Próximo passo |
| --- | --- | --- |
| falta briefing | “Para cumprir a data, precisamos de X até Y; sem isso o relógio pausa.” | registrar dependência e prazo |
| conflito de prioridades | “Temos três opções: manter escopo/data, reduzir escopo ou mover data.” | DACI com um approver |
| feedback difuso | “Qual critério objetivo fará esta peça estar pronta?” | atualizar definição de pronto |
| escopo extra | “Consigo mapear o impacto antes de confirmar execução.” | abrir change request |
| aprovação silenciosa | “Sem aceite explícito, mantenho o item em aprovação.” | follow-up e status bloqueado |

## Fontes

- Dossiê local, seções 1.5–1.6 e 2.2, 2.4.
- Atlassian RACI: https://www.atlassian.com/work-management/project-management/raci-chart.
- Atlassian DACI: https://www.atlassian.com/team-playbook/plays/daci.
- Salesforce SLA: https://www.salesforce.com/br/blog/sla/.
