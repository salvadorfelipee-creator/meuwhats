# Reporting, health score e recuperação

## Índice

1. Relatório orientado a decisão  
2. Health score auditável  
3. Sinais e diagnóstico  
4. Plano de recuperação  
5. Exemplo preenchido

## 1. Relatório orientado a decisão

Comece pelo negócio e desça para a operação. Limite o painel a 5–10 KPIs ligados ao objetivo; se houver mais, mova para anexo. Mostre meta, realizado, período/coorte, atribuição, qualidade do dado, interpretação e ação.

| Ordem | Conteúdo | Exemplo | Dono da leitura |
| --- | --- | --- | --- |
| 1 | resumo executivo | “vendas cresceram, mas qualidade de lead caiu” `[medido]` | account lead |
| 2 | resultado/KR | oportunidades qualificadas, receita atribuída com método acordado | cliente + dados |
| 3 | funil | leads, qualificados, agendados, vendas, no-show | vendas |
| 4 | eficiência | custo por venda, CAC, margem, payback | estratégia/financeiro |
| 5 | atividades com impacto | peças publicadas, testes, correções e links | especialistas |
| 6 | limitações | conversões offline incompletas, janela curta ou coorte pequena | dados |
| 7 | decisões | três ações, dono, data e critério | todos |

Para cada número, responda: **o que significa? por que aconteceu? o que faremos?** Não comece por impressões ou quantidade de posts.

### Exemplo de linha de relatório

| KPI | Meta | Realizado | Status | Leitura | Ação → dono → prazo → critério |
| --- | --- | --- | --- | --- | --- |
| custo por oportunidade | R$ 220 `[meta]` | R$ 198 `[medido, abril]` | verde | abaixo do teto; amostra curta | manter criativo A → mídia → 15/04 → 20 oportunidades com qualidade mantida |
| no-show | ≤15% `[hipótese]` | 28% `[medido]` | vermelho | confirmação não padronizada | testar lembrete 24h/2h → cliente → 19/04 → no-show ≤20% em 30 agendamentos |

## 2. Health score auditável

Use um score de 0–100 com pesos declarados; não trate a faixa como benchmark universal. Recalibre pesos após 60–90 dias de histórico `[hipótese operacional]`.

| Dimensão | Peso inicial | Escala 0–100 | Fonte |
| --- | ---: | --- | --- |
| Resultado/KRs | 30 | 0 se sem avanço; 50 se dentro de faixa; 100 se meta atingida | painel e meta |
| Entrega/SLA | 20 | cumprimento elegível e aging | quadro/SLA |
| Engajamento do cliente | 15 | participação, feedback e aprovações | atas e cartões |
| Qualidade dos dados | 15 | rastreio, origem e consistência | auditoria |
| Satisfação | 10 | CSAT/NPS com data e amostra | pesquisa |
| Risco de negócio/fit | 10 | mudança de decisor, capacidade, caixa ou prioridade | health review |

**Fórmula:** `score = soma(dimensão × peso) / 100`. Registre a data, os valores brutos e a justificativa de cada nota.

| Faixa | Interpretação | Ação obrigatória | Dono | Prazo | Critério de saída |
| --- | --- | --- | --- | --- | --- |
| 80–100 | saudável | manter e identificar próxima aposta | account lead | próxima weekly | score permanece ≥80 por 2 leituras `[hipótese]` |
| 60–79 | atenção | abrir plano de prevenção e validar expectativa | account lead + cliente | 3 dias úteis | risco com dono e tendência melhorando |
| 0–59 | crítico | escuta, auditoria e plano de recuperação | líder de contas | resposta em 1 dia útil; plano em 48h | checkpoint com evidência e decisão |

## 3. Sinais e diagnóstico

| Sinal | Fato a verificar | Não conclua sem | Primeira ação |
| --- | --- | --- | --- |
| health caiu | qual dimensão caiu e desde quando? | série temporal/coorte | marcar risco e dono |
| reunião cancelada | conflito pontual ou padrão? | histórico de 3 reuniões | remarcar e perguntar impacto |
| relatório não aberto | canal, formato ou valor? | confirmação de recebimento | enviar resumo de decisão |
| reclamação | fato, impacto e expectativa | escuta literal | responder sem defensiva em até 1 dia útil |
| decisor mudou | novo objetivo e autoridade? | identificação formal | fazer alinhamento de contexto |
| custo subiu | dados, canal ou oferta? | margem, qualidade e janela | pausar escala e investigar |

## 4. Plano de recuperação

Execute a sequência abaixo. O prazo de 48h é uma janela operacional do dossiê, não garantia; ajuste pela severidade.

1. Responda em até 1 dia útil: “Entendi o impacto; vou investigar e voltar com fatos e opções.”
2. Faça call de escuta: fato, impacto, expectativa, momento da quebra e resultado mínimo aceitável.
3. Audite escopo, tickets, prazos, aprovações, dados, capacidade e causas externas.
4. Apresente plano em até 48h com correção, dono, prazo, métrica, dependência e checkpoint.
5. Entregue quick win em até sete dias quando viável `[hipótese operacional]`; comunique diariamente durante crise.
6. Faça retrospectiva conjunta e atualize SLA/processo.
7. Se não houver fit ou confiança, prepare transição ética; não use retenção coercitiva.

| Problema comprovado | Correção | Dono | Prazo | Métrica de sucesso | Checkpoint |
| --- | --- | --- | --- | --- | --- |
| relatórios sem recomendação | trocar data dump por 3 decisões | account lead + dados | 2 dias úteis | cliente confirma decisões e próximos passos | weekly de 12/04 |
| aprovação atrasada | um approver + calendário | cliente | 3 dias úteis | feedback no canal até prazo | revisão 19/04 |
| tracking inconsistente | mapa de eventos e teste | dados + cliente | 5 dias úteis | 95% de registros com origem `[hipótese]` | auditoria 26/04 |

## 5. Exemplo preenchido

**Situação:** cliente diz “não vejo trabalho”.

- Fato: 12 entregas tinham links, mas weekly mostrava apenas posts `[medido no quadro]`.
- Impacto: perda de confiança e nenhuma decisão sobre teste `[relato da escuta]`.
- Hipótese: evidência não estava ligada ao KR `[hipótese]`.
- Plano: reestruturar relatório, adicionar log de decisões e revisar health em sete dias.

| Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| enviar resumo com 5 KPIs e três decisões | account lead | 2 dias úteis | cliente confirma leitura |
| ligar cada cartão a KR ou manutenção | PM | 3 dias úteis | 100% dos cartões ativos classificados |
| fazer escuta de 20 min | líder de contas | 1 dia útil | expectativa mínima registrada |
| recalcular health | account lead | 7 dias | score e tendência documentados |

## Fontes

- Dossiê local, seções 2.5 e 2.6.
- AgencyAnalytics, *Client reporting tips*: https://agencyanalytics.com/blog/client-reporting-tips (recomendação de filtrar 5–10 KPIs).
- RD Station/Reportei: https://www.rdstation.com/blog/agencias/relatorios-mensais-de-marketing-digital/.
