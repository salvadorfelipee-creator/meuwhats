# Métricas, fórmulas, benchmarks e conta econômica

Use esta referência para calcular cenários e explicar decisões. Todo número externo é direção, nunca promessa; calibre com baseline próprio de 14–30 dias (ou mais quando o ciclo for longo).

## 1. Fórmulas operacionais

| Métrica | Fórmula | Leitura correta |
| --- | --- | --- |
| CPL | investimento ÷ leads | diagnostica aquisição; lead pode ser ruim |
| Custo por qualificado | investimento ÷ qualificados | filtra qualidade |
| CPA/custo por venda | investimento ÷ vendas | decisão direta de mídia |
| CAC pago | custos incrementais de mídia ÷ novos clientes pagantes | por canal/coorte |
| CAC blended | (mídia + criação + ferramentas + custos comerciais alocados) ÷ novos pagantes | economia real |
| Margem de contribuição | receita líquida − custos variáveis | base de LTV e ROAS de margem |
| LTV | ticket × frequência × margem × permanência | explicitar hipótese de retenção |
| LTV/CAC | LTV ÷ CAC | referência de disciplina, não lei |
| Payback | CAC ÷ margem mensal por cliente | meses para recuperar aquisição |
| ROAS receita | receita atribuída ÷ mídia | não desconta custo |
| ROAS margem | margem atribuída ÷ mídia | melhor para economia |
| Conversão | conversões ÷ cliques ou sessões | sempre informe denominador |
| No-show | faltas ÷ agendamentos | vazamento de agenda |
| K-factor | convites por cliente × conversão do convite | mede indicação; K>1 é raro |

### Exemplo calculado

Premissas **hipotéticas**: investimento R$ 6.000; 240 leads; 48 qualificados; 12 vendas; ticket líquido R$ 1.500; margem 60%; frequência 1,5/ano; permanência 12 meses; custo comercial R$ 1.000.

- CPL = 6.000 ÷ 240 = **R$ 25,00**.
- Custo por qualificado = 6.000 ÷ 48 = **R$ 125,00**.
- CAC pago = 6.000 ÷ 12 = **R$ 500,00**.
- CAC blended = (6.000 + 1.000) ÷ 12 = **R$ 583,33**.
- LTV estimado = 1.500 × 1,5 × 0,60 × (12/12) = **R$ 1.350,00**.
- LTV/CAC blended = 1.350 ÷ 583,33 = **2,31x**.
- Margem mensal = 1.500 × 1,5 × 0,60 ÷ 12 = **R$ 112,50**.
- Payback = 583,33 ÷ 112,50 = **5,19 meses**.

Conclusão: não chame de saudável automaticamente; compare com teto de CAC, caixa, retenção observada e cenário conservador.

## 2. Cenários

| Cenário | Como montar | O que declarar |
| --- | --- | --- |
| Conservador | conversão menor, margem menor, atraso de venda | hipótese de estresse |
| Base | baseline medido ou hipótese explicitada | cenário de trabalho |
| Agressivo | conversão melhor e capacidade disponível | teto operacional, não promessa |

Rode o script `scripts/calculadora_midia.py`. Não use um aumento linear de verba como se CPC/CPL permanecesse igual: saturação pode elevar custo e reduzir qualidade.

## 3. Benchmarks com fonte

| Métrica | Número publicado | Fonte/ano | Uso e caveat |
| --- | ---: | --- | --- |
| Google Search média | CTR 6,42%, CPC US$4,66, CVR 6,96%, CPL US$66,69 | WordStream/LocaliQ, 2024, EUA | ordem de grandeza; não converter para meta BR |
| Google Search atualização | CTR 6,64%, CPC US$5,42, CVR 8,18%, CPL US$66,69 | LocaliQ, 2026, EUA | moeda, setores e definição variam |
| Meta mediana geral | CTR 1,49%, CPC US$0,40, CPM US$5,61 | Databox, mar/2023 | amostra de contas; não meta nacional |
| PMax | 6 semanas iniciais; após mudança 1–2 semanas/ciclo | Google Ads, documentação consultada no dossiê | recomendação de aprendizagem, não garantia |
| PMax assets | 15 headlines, 5 descrições, 7 imagens e 1 vídeo | Google Ads, documentação consultada no dossiê | checklist de cobertura |
| LTV/CAC | 3x mínimo prático; 5x confortável | `growth-marketing-agency`/a16z/Paddle | regra de disciplina, não universal |
| Payback | 12 meses como referência geral em SaaS | Paddle/Benchmarkit | não transplante para negócio local |
| SLA | 39% com SLA atingem meta vs. 20% sem; 62% sem SLA | RD Station 2026 | pesquisa brasileira, não causalidade automática |
| WhatsApp | 79% já falaram com empresas; 66% contrataram serviço | Opinion Box 2024 | comportamento declarado, não CVR de campanha |

**Caveat brasileiro:** não há benchmark público confiável e comparável de CPM, CTR e CPL por setor, cidade e oferta no Brasil. A resposta correta é construir baseline próprio.

## 4. Como calibrar metas

1. Defina teto de CAC pela margem e retenção, não por custo publicado.
2. Rode orçamento controlado por 14–30 dias; para ciclo longo, use pelo menos um ciclo completo.
3. Separe dados por canal, campanha, região, oferta, estágio e coorte.
4. Calcule mediana e intervalo, não apenas média.
5. Substitua hipótese por medido no painel e revise meta em 30 dias.

| Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| validar ticket/margem | financeiro | D+3 | margem documentada por oferta |
| extrair baseline | analista | D+14–30 | pelo menos uma janela completa |
| calcular teto de CAC | estrategista + dono | D+5 | CAC máximo aprovado |
| revisar cenário | reunião semanal/mensal | próximo ciclo | decisão baseada em venda/margem |

## 5. Decisão econômica

- **Escalar:** CAC e payback dentro do teto, margem positiva, capacidade e coorte estável.
- **Manter/testar:** sinal de qualidade, mas volume insuficiente ou hipótese ainda incerta.
- **Ajustar oferta/funil:** lead qualificado chega e não fecha; revise preço, prova, página e SLA.
- **Pausar:** custo por venda acima do teto em dois ciclos com volume suficiente, ou rastreio/consentimento falho.

## Fontes

Dossiê `trafego-pago-dossie.md`, seções 3, 7 e 8; WordStream/LocaliQ, Databox, Google Ads, RD Station, Opinion Box e documentação a que o dossiê vincula. Benchmarks em dólar ou de contas estrangeiras permanecem em dólar e são rotulados.
