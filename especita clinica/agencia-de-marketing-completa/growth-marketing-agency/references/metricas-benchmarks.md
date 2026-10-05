# Métricas, fórmulas e benchmarks

Duas regras antes de usar qualquer número daqui:

1. **Benchmark é referência de ordem de grandeza, não meta.** Toda meta deve ser calibrada com o
   baseline do próprio cliente em 30 a 60 dias de operação.
2. **Digamos sempre a idade e a origem do dado.** Ao citar um número para um cliente, informe a
   fonte e o ano; se for estimativa, diga que é estimativa.

---

## 1. Fórmulas que você vai usar em todo plano

| Métrica | Fórmula | Cuidado |
| --- | --- | --- |
| CPL | investimento ÷ leads | lead barato pode ser lead ruim; sempre acompanhe o custo por venda |
| CPA / custo por venda | investimento ÷ vendas | é a métrica que decide orçamento |
| CAC pago | investimento em mídia ÷ novos clientes | não inclui time comercial |
| CAC blended | (mídia + custo comercial e ferramentas) ÷ novos clientes | mede o custo real de adquirir |
| Margem de contribuição | receita − custos variáveis (impostos, insumos, comissão, frete) | use margem, nunca receita bruta, para LTV |
| LTV | ticket × frequência anual × margem × (meses de permanência ÷ 12) | se não houver recorrência, LTV = margem do cliente ao longo do tempo |
| LTV/CAC | LTV ÷ CAC | referência prática: mínimo 3x, confortável acima de 5x |
| Payback | CAC ÷ margem mensal gerada por cliente | acima de 12 meses exige caixa para sustentar |
| ROAS | receita de mídia ÷ investimento em mídia | ROAS de receita engana; use ROAS sobre margem |
| ROI | (ganho − custo) ÷ custo | contabilize custo comercial e operacional |
| K-factor | convites enviados por cliente × conversão dos convites | acima de 1 = crescimento autossustentado (raro) |
| Taxa de recompra | clientes que compraram 2ª vez ÷ clientes ativos | principal alavanca de LTV em negócio local |
| No-show | faltas ÷ agendamentos | o maior vazamento invisível de receita em serviços |
| NRR / GRR | receita da base atual (com/sem expansão) ÷ base anterior | em B2B recorrente é o termômetro do negócio |
| Churn | clientes perdidos ÷ clientes no início do período | sempre acompanhe por coorte, não pela média |
| DAU/MAU | usuários ativos diários ÷ mensais | mede hábito; acima de 20% indica uso frequente |

---

## 2. Benchmarks de referência (com fonte)

Faixas abaixo vêm de relatórios compilados nas referências internacionais desta skill
(`references/internacional/`). Valem como direção, não como promessa.

| Tema | Referência | Fonte |
| --- | --- | --- |
| LTV/CAC saudável | 3x como mínimo; 5x+ confortável | a16z / Paddle (ProfitWell) |
| CAC payback | ~12 meses como regra geral; 4 meses em negócio muito eficiente | Paddle / Benchmarkit |
| NRR mediano (SaaS) | ~101% em 2024; best-in-class 110–125% | Benchmarkit / ChartMogul |
| GRR mediano | ~88% | Benchmarkit |
| Churn mensal SaaS | 3–4% mediano; abaixo de 2% está no topo | ChartMogul |
| New CAC ratio | ~US$ 1,76–2,00 de S&M por US$ 1 de novo ARR | Benchmarkit 2024 |
| Retenção de app social (orientativa) | D1 60% · D7 30% · D30 15% | Andrew Chen / a16z |
| DAU/MAU | acima de 20% como referência de hábito | Andrew Chen / a16z |
| Ativação em PLG | 20–30% nas empresas de referência | OpenView / Amplitude |
| Win rate B2B | 17–20%; lead→MQL 11–15%; opportunity→close 10–28% | compilações OpenView/HubSpot |
| Outbound | ~344 e-mails frios por reunião (Gong); top 10% com 8x mais reuniões; e-mail ideal ≤100 palavras | Gong |
| SLA marketing–vendas | 39% das empresas com SLA batem meta contra 20% sem SLA (RD Station 2026); 62% não têm SLA; só 7% respondem um lead em 5 minutos | RD Station / InsideSales |
| Reter vs adquirir | adquirir custa de 5x a 25x mais que reter (varia por setor) | HBR / Bain |
| Efeito de retenção | +5% de retenção associado a +25% a +95% de lucro | HBR / Bain (validar localmente) |
| E-mail marketing | abertura ~39,6% e clique ~3,3% (distorcidos por Apple Mail Privacy) | GetResponse |
| Fidelidade | programa de loyalty em amostra global: 8,5x ROI em 90 dias e +164% de recompra | Yotpo |
| Marketing de marca | execuções publicitárias fortes chegam a ser 10–20x mais eficazes em vendas que as medíocres | Ehrenberg-Bass |
| Regra 95:5 (B2B) | até 95% dos compradores estão fora do mercado num trimestre | Ehrenberg-Bass |
| 40% PMF | ~40% dos clientes "muito decepcionados se o produto acabasse" indica product-market fit | Sean Ellis |
| Saturação de canal | CTR de anúncio pode cair 10x a 100x conforme o canal é copiado | Andrew Chen |
| Referência de CPA por setor (EUA, 2016–18, USD) | Google Search: saúde 78 · educação 73 · finanças/seguros 82 · jurídico 86 · imobiliário 117 · e-commerce 45. Facebook: saúde 12 · educação 8 · seguros 41 · jurídico 29 · imobiliário 17 | WordStream (dado antigo, use só para comparação entre canais) |

---

## 3. Contexto brasileiro (2024–2026)

| Tema | Número | Fonte |
| --- | --- | --- |
| E-commerce brasileiro projetado 2025 | R$ 235,5 bilhões de faturamento, ticket médio R$ 536,60 e 438,9 milhões de pedidos | ABComm |
| WhatsApp como canal de compra | 79% dos usuários já falaram com empresas pelo WhatsApp; 66% já contrataram serviço; 62% já compraram produto | Opinion Box 2024 |
| Uso esperado do WhatsApp | 77% tirar dúvidas · 67% suporte · 58% comprar · 51% promoções | Opinion Box 2024 |
| Comunicação não solicitada | 82% receberam mensagem de empresa com que nunca falaram; 20% bloqueiam antes de ver | Opinion Box 2024 |
| Escala de marketplace de comida | iFood: ~400 mil estabelecimentos, 55 milhões de usuários, 120 milhões de pedidos/mês | iFood |

**O que não existe:** benchmark público confiável e comparável de CPM, CTR e CPL por setor no
Brasil. Qualquer número "de mercado" apresentado como verdade deve ser tratado com desconfiança.
A resposta correta é sempre: medir o baseline do cliente por canal, cidade e oferta.

---

## 4. Como calibrar metas sem benchmark confiável

1. **Medir antes de prometer:** rode o canal em pequena escala por 14 a 30 dias com orçamento
   de teste e registre o CPL e o custo por venda reais.
2. **Definir teto pelo negócio, não pelo mercado:** o CAC máximo aceitável vem de
   `margem mensal por cliente × meses de retenção ÷ 3` (para LTV/CAC de 3x) — o cliente define.
3. **Construir o cenário com o script:** use `scripts/calculadora_growth.py` para simular
   conservador, base e agressivo antes de apresentar metas.
4. **Marcar estimativas como estimativas:** separe na planilha o que é medido, o que é meta e o
   que é hipótese.
5. **Revisar em 30 dias:** meta que não se move em 30 dias precisa de revisão de premissa, não
   de mais verba.

---

## 5. Painel mínimo do cliente (semanal)

| Grupo | Campos |
| --- | --- |
| Aquisição | leads por canal, CPL, custo por lead qualificado |
| Conversão | taxa de contato, agendamento, comparecimento, fechamento |
| Receita | vendas, ticket médio, receita, margem de contribuição |
| Eficiência | CAC, custo por venda, LTV/CAC, payback |
| Base | recompra, indicações, churn, NPS |
| Motor | entregas do conteúdo, convites de indicação, avaliações novas |

Regra do painel: **no máximo 12 números**. Painel com 40 colunas ninguém lê na reunião de segunda.
## 5. Quando o cliente não tem CPL nem conversão medidos

Isso é regra, não exceção: a maioria das PMEs não tem baseline. Nunca invente o número como se
fosse medido — e nunca deixe de fazer a conta. Procedimento:

1. **Marque tudo como hipótese** no documento (coluna "medido / estimado").
2. **Derive o CPL do que o cliente tem:** se ele sabe gasto e volume de leads, `CPL = gasto ÷ leads`.
   Se só sabe as vendas, `conversão = vendas ÷ leads`. O script aceita os campos `leads_mes` e
   `vendas_mes` justamente para isso.
3. **Rode a meta reversa:** parta do número de clientes que o negócio precisa e calcule o
   investimento que o mix atual exigiria. Isso mostra o tamanho do desafio sem prometer custo.
4. **Estabeleça a janela de medição:** 14 a 30 dias de teste com orçamento controlado para
   substituir cada hipótese por um número real.
5. **Coloque no plano o valor de referência que o canal não pode ultrapassar** (teto de CAC
   calculado pela margem do próprio cliente) — esse número é confiável porque sai do negócio.

## 6. Converter recorrência anual em tempo de vida do cliente

Quando o cliente informa **taxa de renovação anual** (seguros, contratos, assinaturas) e não
sabe o tempo de permanência:

```
anos de permanência ≈ 1 ÷ (1 − taxa de renovação anual)
meses de permanência = anos × 12
```

Exemplos: renovação de 65% → ~2,9 anos → ~34 meses; 80% → ~5 anos → ~60 meses; 50% → ~2 anos → 24 meses.
Para contratos com prazo fixo (ex.: 12 meses), use o prazo real e não a fórmula. Registre no
documento que o valor é **estimado por renovação** e valide com a base real em 90 dias.

## 7. Painel mínimo do cliente (semanal)
