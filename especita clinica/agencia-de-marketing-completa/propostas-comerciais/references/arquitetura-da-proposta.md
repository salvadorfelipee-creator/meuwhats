# Arquitetura, escopo e redação da proposta

Use este arquivo para transformar diagnóstico em um documento que o decisor consiga ler, discutir e aprovar. O documento deve ser um contrato de entendimento: claro sobre intenção, fronteiras, responsabilidades e critérios, sem substituir revisão jurídica.

## 1. Ordem recomendada

| Seção | Pergunta respondida | Tamanho sugerido | Teste de qualidade |
| --- | --- | ---: | --- |
| Capa | de quem é, para quem e quando? | 1 página | nome, objetivo, data, validade e responsável corretos |
| Resumo executivo | qual problema, caminho, prazo e investimento? | 5 linhas | alguém repete a decisão sem ler o resto |
| Contexto/diagnóstico | o que entendemos? | 0,5–1 página | cliente reconhece suas palavras e dados |
| Objetivo e sucesso | o que queremos habilitar? | tabela | métrica, prazo, baseline e fonte/hipótese |
| Solução por fases | como o trabalho acontece? | 1–2 páginas | mecanismo, não catálogo de tarefas |
| Escopo e aceite | o que entra, sai e como validar? | tabela | ninguém confunde entrega com resultado |
| Cronograma/governança | quem faz o quê e quando? | tabela | dono, dependência e cadência definidos |
| Prova | por que esta abordagem é plausível? | 0,5 página | contexto, método, período e limite da prova |
| Opções/investimento | quais escolhas existem? | tabela | diferenças reais de valor, risco e velocidade |
| Premissas/riscos | do que depende e o que pode mudar? | tabela | risco tem mitigação e dono |
| Condições/próximo passo | como decidimos e iniciamos? | 0,5 página | validade, pendências e data de leitura claros |

## 2. Resumo executivo em cinco linhas

Preencha nesta ordem:

1. **Situação:** “A equipe de [cliente] precisa [mudar X], hoje [baseline/fonte ou hipótese].”
2. **Impacto:** “Se permanecer assim, o custo provável é [margem/tempo/risco], com premissas [A, B].”
3. **Solução:** “Propomos [mecanismo] em [fases], com [entregas principais].”
4. **Prazo e decisão:** “A primeira leitura acontece em [data] e o critério é [métrica/aceite].”
5. **Investimento:** “Recomendamos [opção] por [valor], condicionado a [dependências], sem promessa de resultado.”

### Exemplo forte e exemplo fraco

| Fraco | Forte |
| --- | --- |
| “Vamos fazer marketing digital completo para aumentar suas vendas.” | “Para reduzir o vazamento entre lead e reunião da Clínica Alfa, propomos instrumentar origem, revisar a oferta de avaliação e treinar a primeira resposta em 30 dias; meta de decisão: elevar a taxa medida de contato→agendamento de [baseline] para [meta], validando com CRM. Recomendamos a opção B, R$ [valor], dependente de acesso ao CRM e aprovação em até 2 dias úteis.” |

## 3. Tabela de objetivo e sucesso

| Objetivo | Baseline | Meta/faixa | Prazo | Fonte | Estado | Dono | Critério de decisão |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Aumentar reuniões qualificadas | | | | CRM | | comercial | manter se custo por reunião ≤ teto por 2 semanas |
| Reduzir tempo de resposta | | | | WhatsApp/CRM | | atendimento | corrigir se mediana > SLA por 7 dias |
| Instrumentar origem | 0% [medido] | 100% [meta] | 14 dias | CRM/UTM | | analista | não escalar antes de origem preenchida |

Não preencha meta com benchmark de mercado sem fonte. Se o cliente não tem baseline, escreva `[hipótese]` e inclua a fase de medição.

## 4. Escopo executável

Escreva cada linha no formato **entrega → resultado habilitado → prazo → aceite → dependência → dono**.

| Fase | Entrega verificável | Resultado habilitado (não garantido) | Prazo | Critério de aceite | Dependência do cliente | Dono |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | mapa de eventos e UTMs | origem das oportunidades pode ser comparada | semana 1 | planilha com 100% dos links prioritários e teste registrado | acesso ao site/CRM em D+2 | analista |
| Oferta | matriz de proposta de valor + 3 mensagens | equipe testa linguagem alinhada à dor | semana 2 | cliente aprova 1 mensagem e lista de objeções | entrevista com atendimento | estrategista |
| Comercial | roteiro + pipeline com próxima ação | menos leads esquecidos e leitura por etapa | semana 3 | 10 registros de teste completos | alguém do comercial participa | líder comercial |
| Otimização | relatório de 30 dias | decisão de manter, ajustar ou pausar | dia 30 | relatório com fonte, comparação e recomendação | dados sem lacunas críticas | analista |

**Critério de aceite é verificável:** “entregue arquivo X e realizada sessão Y” é aceite; “gerou crescimento” é resultado, não aceite.

## 5. Dentro e fora do escopo

| Dentro do escopo | Fora do escopo | Consequência/alternativa |
| --- | --- | --- |
| 1 landing page e 2 rodadas de revisão | desenvolvimento de site completo | estimar em aditivo separado, com prazo e dono |
| 4 campanhas e 8 peças/mês | verba de mídia e produção audiovisual externa | cliente fornece verba/fornecedor ou incluir linha específica |
| painel em Sheets com dados fornecidos | limpeza histórica de 3 anos | abrir fase de saneamento com volume e critério |
| reunião semanal de 45 min | disponibilidade ilimitada por WhatsApp | definir canal, horário e SLA |
| testes de 1 variável por vez | prometer venda, ROAS ou quantidade de leads | definir hipótese, métrica e janela |

Exclusões devem aparecer antes do investimento, não em nota escondida.

## 6. Cronograma e governança

| Semana | Foco | Entregáveis | Cliente fornece | Dono | Reunião/ritual | Critério de passagem |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | diagnóstico e instrumentação | briefing final + mapa de dados | acessos e baseline | líder do projeto | kickoff 45 min | dados críticos disponíveis |
| 2 | oferta e material | matriz + rascunhos | aprovação em 2 dias | estrategista | revisão assíncrona | uma versão aprovada |
| 3–4 | implementação | campanhas/roteiros/pipeline | equipe treinada | especialistas | leitura semanal | eventos funcionando |
| 5–8 | otimização | testes + relatório | feedback e registros | líder + cliente | ritual semanal | custo/qualidade comparáveis |
| 9–12 | decisão | recomendação de escala/ajuste | decisão do decisor | sponsor | revisão mensal | critério de escala ou pausa atingido |

## 7. Prova sem exagero

Registre a prova assim:

| Caso/prova | Contexto comparável | Resultado observado | Método/período | O que não está comprovado |
| --- | --- | --- | --- | --- |
| Case próprio autorizado | setor, ticket, maturidade | número e unidade | antes/depois, janela, fontes | causalidade isolada, repetição em outro cliente |
| Depoimento | quem fala e problema | frase validada | data e autorização | não é benchmark |
| Benchmark externo | mercado/amostra | número citado | fonte e ano | não prevê operação brasileira |

Não use “somos referência”, selo sem contexto ou case interno não auditado como prova de resultado.

## 8. Opções de decisão

| Critério | Essencial | Recomendada | Transformação |
| --- | --- | --- | --- |
| Problema atendido | uma restrição | gargalo principal + apoio | sistema completo |
| Velocidade | menor | equilibrada | mais rápida por mais capacidade |
| Risco | cliente executa mais | responsabilidades divididas | maior dependência de dados/equipe |
| Entregas | | | |
| Resultado habilitado | | | |
| Participação do cliente | | | |
| Investimento | | | |
| Escolha recomendada | não | **sim, por impacto/risco/capacidade** | só se houver capacidade |

As opções devem remover escopo, velocidade, suporte ou profundidade de forma explícita; nunca apenas renomear o mesmo pacote.

## 9. Revisão de coerência antes de enviar

1. Comparar nome, CNPJ/razão social se fornecidos, datas, versão e responsável em todas as páginas.
2. Recalcular totais e confrontar investimento com a planilha de custos.
3. Confirmar que cada número tem fonte, estado ou etiqueta **hipótese**.
4. Conferir que toda promessa foi reescrita como meta ou resultado habilitado.
5. Verificar limites, revisões, reuniões, acessos, ferramentas, mídia, produção e aprovações.
6. Testar links, fórmulas, unidades, arredondamentos e moeda.
7. Conferir que há um único próximo passo, decisores e data sugerida.
8. Pedir revisão jurídica das cláusulas aplicáveis; não apresentar este documento como aconselhamento jurídico.
