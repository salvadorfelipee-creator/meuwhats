# Fórmulas, benchmarks e fontes

Use números para decidir, não para enfeitar. **Benchmark é direção, não meta.** Toda meta deve ser calibrada com baseline do próprio cliente em janela definida. Número sem fonte é **hipótese**.

## 1. Fórmulas essenciais

| Indicador | Fórmula | Cuidado |
| --- | --- | --- |
| margem de contribuição | receita − custos variáveis | incluir impostos, comissão, insumos e frete conforme o caso |
| CAC de marketing | investimento em mídia ÷ novos clientes | não inclui comercial, ferramentas ou operação |
| CAC blended | (mídia + comercial + ferramentas) ÷ novos clientes | use para decisão real de aquisição |
| LTV simples | ticket × frequência × margem × permanência | declarar janela e premissas |
| LTV/CAC | LTV ÷ CAC | referência de mercado não substitui caixa e risco |
| payback | CAC ÷ margem mensal gerada | payback longo exige caixa e retenção observada |
| ROI | (ganho incremental − investimento) ÷ investimento | ganho e investimento precisam da mesma janela |
| ponto de equilíbrio | investimento ÷ margem incremental por cliente | saída é quantidade de clientes, não receita bruta |
| taxa de fechamento | propostas ganhas ÷ propostas enviadas | segmentar por origem, ticket e opção |
| RCR | valor ganho ÷ orçamento declarado ou menor opção | métrica de valor capturado, fonte Blair Enns |
| taxa de avanço | propostas que avançaram ÷ propostas enviadas | defina “avançou” antes de contar |
| cobertura de pipeline | valor ponderado ÷ meta | probabilidade deve vir do histórico da operação |

### Exemplo reproduzível (hipótese)

Ticket R$ 2.000, margem 45%, frequência 1,5/ano e permanência 12 meses:

- margem anual aproximada = `2.000 × 0,45 × 1,5 = R$ 1.350`;
- se investimento total for R$ 30.000 e margem por cliente R$ 900, equilíbrio = `30.000 ÷ 900 = 33,3 clientes`;
- se CAC blended for R$ 600, LTV/CAC = `1.350 ÷ 600 = 2,25x`.

Marque o exemplo como hipótese; substitua por dados do cliente antes de recomendar investimento.

## 2. Calibrar sem baseline

1. Marcar todos os números desconhecidos como `[hipótese]`.
2. Derivar o que houver: `CPL = investimento ÷ leads`; `conversão = vendas ÷ leads`.
3. Fazer meta reversa: partir do número de clientes necessário e simular o mix.
4. Definir teste de 14–30 dias com orçamento controlado — janela sugerida, não benchmark.
5. Trocar hipóteses por medição no CRM e revisar em 30 dias.
6. Definir teto de CAC pelo negócio; pausar/ajustar o canal que exceder o teto durante a janela acordada.

## 3. Benchmarks e sinais com fonte

| Número ou faixa | Como usar | Fonte/qualificação |
| --- | --- | --- |
| 3x como LTV/CAC mínimo prático; 5x+ confortável | alerta de unidade econômica, não meta universal | a16z/Paddle compilados na skill irmã; validar no cliente |
| ~12 meses de payback como regra geral em referências SaaS | testar necessidade de caixa; não usar para serviço local automaticamente | Paddle/Benchmarkit, contexto SaaS |
| propostas enviadas em até 24h converteram 42% melhor na base analisada | formular teste de velocidade; não prever taxa brasileira | Better Proposals Report 2022, autorrelato e possível viés |
| até sete seções em propostas de melhor conversão nessa base | usar como teste de concisão, não limite obrigatório | Better Proposals Report 2022 |
| propostas visuais 82% melhores nessa base | testar clareza visual; definição e amostra não são universais | Better Proposals Report 2022 |
| 50% de fechamento e R$ 500 mil vs R$ 750 mil em exemplo de opções | demonstrar mecânica de preço, não benchmark | Blair Enns; exemplo hipotético |
| 25%–30% de closing ratio de firmas criativas citado como faixa indicativa | comparar somente após medir operação própria | Blair Enns; página não verifica estudos completos |
| 61% dos negócios perdidos atribuídos à indecisão em citação HubSpot | mapear decisores e fornecer caso interno; não generalizar para Brasil | HubSpot citando Ebsta/Pavilion 2024; metodologia a verificar |
| R$ 2.000/R$ 16.000 = 12,5% de rateio fixo | ensinar conta de rateio, não média do setor | exemplo didático RD Station |
| 24h, 7 seções, 82%, 42%, 23,4% e 15 min | usar somente como hipótese de teste na operação | Better Proposals 2022; não extrapolar |

**Sem benchmark público robusto:** não há taxa universal comparável de fechamento de agências brasileiras por ticket, nicho, canal ou modelo; não existe preço universal como percentual de impacto. Meça no CRM.

## 4. Fontes e como citar

| Tema | Fonte | Como citar na proposta |
| --- | --- | --- |
| valor e honorários | [Alan Weiss](https://alanweiss.com/shop/books/hardcover/value-based-fees-3rd-edition/) | “referência de value-based fees; preço não é soma de horas” |
| opções e RCR | [Blair Enns](https://www.winwithoutpitching.com/insights/quantifying-the-value-of-pricing) | separar exemplo hipotético de benchmark |
| escada de valor | [Jonathan Stark](https://jonathanstark.com/free) | diagnóstico/piloto com fronteira clara |
| discovery e sales story | [Mike Weinberg](https://mikeweinberg.com/new-sales-simplified-sp/) | foco em problema, resultado e conversa |
| objeções | [HubSpot](https://blog.hubspot.com/sales/handling-common-sales-objections) | ouvir, reconhecer, explorar, responder |
| proposta de serviço | [Sebrae-RS](https://digital.sebraers.com.br/blog/estrategia/como-elaborar-a-proposta-de-servico-e-de-consultoria-em-pequenos-negocios/) | objetivo específico, mensurável e temporal |
| estrutura comercial | [Salesforce Brasil](https://www.salesforce.com/br/blog/proposta-comercial/) | problema, solução, escopo, cronograma e condições |
| precificação de agência | [RD Station](https://www.rdstation.com/blog/agencias/precificacao-marketing-digital/) | custos, terceiros, impostos, margem e separação setup/ongoing |
| propostas e conversão | [Better Proposals](https://betterproposals.io/reports/2022/) | autorrelato; informar ano e limitação |

Não copie texto ou cases de terceiros. Parafraseie, cite a origem e use apenas o que é necessário para a decisão.

## 5. Sensibilidade e decisão

| Variável | Baixa | Base | Alta | Pergunta de decisão |
| --- | ---: | ---: | ---: | --- |
| leads qualificados | | | | qual volume cabe na capacidade? |
| conversão | | | | qual parte é medida e qual é hipótese? |
| ticket/margem | | | | a conta usa margem, não receita? |
| investimento | | | | qual teto preserva caixa? |
| permanência | | | | qual evidência sustenta a retenção? |

Para cada cenário, escreva dono, prazo e critério:

> **Dono:** responsável pelo CRM/financeiro. **Prazo:** revisar em 30 dias. **Critério:** manter se CAC blended ≤ teto definido e margem do cenário base permanecer positiva; ajustar oferta/canal se um critério falhar; pausar se houver dois ciclos acima do teto.

## 6. Integridade dos números

1. Use a mesma moeda, janela e definição em toda a proposta.
2. Não misture receita bruta com margem de contribuição.
3. Não some clientes projetados à capacidade sem alerta.
4. Não converta exemplo externo em previsão.
5. Coloque fonte, ano e contexto ao lado do benchmark.
6. Faça o cliente validar ticket, margem, baseline e capacidade antes da decisão.
7. Guarde o cálculo reproduzível em planilha ou no script da skill.
