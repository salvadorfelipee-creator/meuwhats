# Health score e plano de recuperação — {{cliente}}

> Data de leitura: {{data}} · Account lead: {{account_lead}} · Próximo checkpoint: {{checkpoint}}

## 1. Score auditável

**Fórmula:** `score = soma(valor da dimensão × peso) ÷ 100`. Não altere pesos sem registrar motivo e data.

| Dimensão | Peso | Valor 0–100 | Evidência/fonte | Comentário |
| --- | ---: | ---: | --- | --- |
| Resultado/KRs | 30 | {{resultado}} | {{evidencia_resultado}} | {{comentario_resultado}} |
| Entrega/SLA | 20 | {{entrega}} | {{evidencia_entrega}} | {{comentario_entrega}} |
| Engajamento | 15 | {{engajamento}} | {{evidencia_engajamento}} | {{comentario_engajamento}} |
| Qualidade dos dados | 15 | {{dados}} | {{evidencia_dados}} | {{comentario_dados}} |
| Satisfação | 10 | {{satisfacao}} | {{evidencia_satisfacao}} | {{comentario_satisfacao}} |
| Fit/risco de negócio | 10 | {{fit}} | {{evidencia_fit}} | {{comentario_fit}} |
| **Total** | **100** | **{{score}}** | {{data_calculo}} | faixa: **{{faixa}}** |

Faixas operacionais: 80–100 saudável; 60–79 atenção; 0–59 crítico. Trate-as como regra inicial da operação, não benchmark de mercado.

## 2. Fatos, impacto e expectativa

| Campo | Registro |
| --- | --- |
| Fato observado | {{fato}} |
| Fonte e período | {{fonte_periodo}} |
| Impacto no cliente | {{impacto}} |
| Expectativa declarada | {{expectativa}} |
| Resultado mínimo aceitável | {{minimo_aceitavel}} |
| Causas externas | {{causas_externas}} |
| O que ainda é hipótese | {{hipoteses}} |

## 3. Auditoria de evidências

| Evidência | Verificação | Resultado | Dono | Prazo | Critério |
| --- | --- | --- | --- | --- | --- |
| Escopo e promessa | {{verificacao_escopo}} | {{resultado_escopo}} | {{dono_escopo}} | {{prazo_escopo}} | {{criterio_escopo}} |
| Prazos e SLA | {{verificacao_sla}} | {{resultado_sla}} | {{dono_sla}} | {{prazo_sla}} | {{criterio_sla}} |
| Aprovações | {{verificacao_aprovacao}} | {{resultado_aprovacao}} | {{dono_aprovacao}} | {{prazo_aprovacao}} | {{criterio_aprovacao}} |
| Dados e tracking | {{verificacao_dados}} | {{resultado_dados}} | {{dono_dados}} | {{prazo_dados}} | {{criterio_dados}} |
| Capacidade | {{verificacao_capacidade}} | {{resultado_capacidade}} | {{dono_capacidade}} | {{prazo_capacidade}} | {{criterio_capacidade}} |

## 4. Plano de recuperação

Responda sem defensiva em até 1 dia útil. Apresente fatos e opções em até 48h, ajustando a janela à severidade e registrando a hipótese.

| Ação corretiva | Dono | Prazo | Dependência | Métrica de sucesso | Evidência | Status |
| --- | --- | --- | --- | --- | --- | --- |
| {{acao_1}} | {{dono_1}} | {{prazo_1}} | {{dependencia_1}} | {{metrica_1}} | {{evidencia_1}} | {{status_1}} |
| {{acao_2}} | {{dono_2}} | {{prazo_2}} | {{dependencia_2}} | {{metrica_2}} | {{evidencia_2}} | {{status_2}} |
| {{acao_3}} | {{dono_3}} | {{prazo_3}} | {{dependencia_3}} | {{metrica_3}} | {{evidencia_3}} | {{status_3}} |

## 5. Comunicação e checkpoint

- Mensagem inicial enviada em: {{data_mensagem}} por {{dono_mensagem}}.
- Opções apresentadas: {{opcoes}}.
- Decisão do cliente: {{decisao_cliente}}.
- Checkpoint de evidência: {{checkpoint_evidencia}}.
- Próxima revisão do score: {{proxima_revisao}}.

## 6. Retrospectiva

| Pergunta | Resposta | Mudança de processo | Dono | Prazo |
| --- | --- | --- | --- | --- |
| Onde a expectativa quebrou? | {{quebra}} | {{mudanca_1}} | {{dono_mudanca_1}} | {{prazo_mudanca_1}} |
| Qual sinal ignoramos? | {{sinal}} | {{mudanca_2}} | {{dono_mudanca_2}} | {{prazo_mudanca_2}} |
| O que manteremos? | {{manter}} | {{mudanca_3}} | {{dono_mudanca_3}} | {{prazo_mudanca_3}} |
