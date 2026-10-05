# Unit economics de aquisição para growth de PMEs brasileiras

## 1. Tese central (o que esta fonte afirma sobre crescimento)

Crescimento saudável não é comprar mais leads; é comprar clientes cujo **lucro de contribuição acumulado** supera o custo de adquiri-los, em prazo compatível com o caixa. A a16z resume a lógica: LTV:CAC maior implica margens maiores e mais capacidade de reinvestir; em seu exemplo, elevar a razão de 2x para 3x pode quase triplicar a valuation, embora seja uma evidência de empresas públicas de consumer internet, não uma promessa para PMEs brasileiras ([a16z](https://a16z.com/why-do-investors-care-so-much-about-ltvcac/)).

A unidade correta deve ser uma coorte de clientes pagantes, segmentada por canal, campanha, região, produto e perfil. **CAC paid** mede apenas mídia paga (e, idealmente, custos diretamente incrementais daquele canal); **CAC blended** inclui todo o motor de aquisição: mídia, agência, ferramentas, criação, salários alocados de marketing/vendas e comissões, dividido por novos clientes pagantes. O primeiro serve para otimizar campanhas; o segundo revela a economia real. Contar cadastro, trial ou lead como cliente reduz artificialmente o CAC ([Paddle/ProfitWell](https://www.paddle.com/resources/cac-ltv-ratio)).

LTV é receita ou, de preferência, margem de contribuição esperada durante a vida do cliente. Para assinatura, uma aproximação é `ARPA mensal × margem de contribuição ÷ churn mensal`; para negócios transacionais, `ticket médio × compras esperadas × margem – custos variáveis de servir`. Margem de contribuição desconta produto/mercadoria, gateway, frete subsidiado, atendimento variável e comissão variável; não é margem bruta “bonita” nem faturamento. A razão `LTV/CAC` deve mirar 3:1 como regra de disciplina, não como lei universal: abaixo de 1 destrói valor; acima de 3 pode indicar escala, desde que retenção e payback sejam bons. Payback é `CAC ÷ margem de contribuição mensal inicial`; ele limita o capital necessário e deve ser analisado junto da razão.

Retenção é o motor que sustenta LTV. Reforge trata retenção como o núcleo do growth: medir a porcentagem que permanece ativa em períodos definidos, encontrar o comportamento de valor e agir sobre ativação, engajamento e ressurreição ([Reforge](https://www.reforge.com/artifacts/c/growth/retention)). Portanto, o painel de PME deve responder “qual coorte, canal e segmento retém e dá lucro?”, e não apenas “qual anúncio tem menor CPL?”.

## 2. Frameworks nomeados (nome, componentes, como usar passo a passo)

**Fully Loaded CAC (Paddle/ProfitWell).** (1) Defina “cliente adquirido” como primeiro pagante, não lead. (2) Some mídia, produção, software, agência, salários e comissões de aquisição. (3) Divida pelos novos pagantes do mesmo período; use blended para o negócio e paid para diagnóstico de mídia. (4) Compare por coorte e canal, evitando atribuir vendas antigas à mídia do mês.

**LTV:CAC 3:1 (a16z/Paddle).** (1) Calcule LTV com margem de contribuição e retenção observada. (2) Calcule CAC fully loaded. (3) Divida LTV por CAC. (4) Faça cenário conservador com churn maior, margem menor e atraso de venda. (5) Só libere orçamento quando a razão histórica ou projetada sobreviver ao cenário pessimista.

**CAC Payback.** (1) Determine a margem de contribuição mensal do cliente novo. (2) Divida CAC por essa margem, incluindo ramp-up real (ex.: primeiro mês menor). (3) Compare com limite de caixa: SaaS pode aceitar 12 meses como referência de exemplo do Paddle; serviço local precisa normalmente ser muito mais curto, mas não há benchmark universal confiável. (4) Reduza payback com preço, cobrança antecipada, onboarding e mix de canais, não somente com lance de mídia.

**Cohort-based retention / Retention strategy (Reforge).** (1) Agrupe clientes pela semana/mês de primeira compra e dimensão (canal, cidade, persona). (2) Meça retenção de receita, clientes e uso em D7/D30/D90 ou ciclos apropriados. (3) Defina o evento de ativação que prediz recompra/renovação. (4) Crie ações de onboarding, uso recorrente e win-back. (5) Leia a coorte até maturar antes de declarar vitória; CAC barato com churn precoce é falso crescimento.

**Growth accounting e SLA Marketing–Vendas.** Aplique o funil Leads → MQL/lead qualificado → oportunidade → venda → recompra. Para cada passagem registre volume, conversão, tempo de resposta e receita. O Panorama RD Station 2026 reporta que 62% não têm SLA; entre empresas com SLA, 39% bateram metas comerciais contra 20% sem acordo ([RD Station](https://www.rdstation.com/blog/marketing/panoramas-marketing-vendas/)).

**ROAS versus ROI.** ROAS = receita atribuída à mídia ÷ gasto de mídia; não desconta custos. ROI de aquisição = `(margem de contribuição atribuída – custos totais de aquisição) ÷ custos totais`; use margem, não receita. Para e-commerce, acompanhe ROAS de primeira compra e ROAS de coorte (incluindo recompra), com janela e modelo de atribuição explícitos.

## 3. Métricas e benchmarks (tabela: metrica | valor ou faixa | fonte | como medir)

| metrica | valor ou faixa | fonte | como medir |
|---|---:|---|---|
| LTV:CAC de referência | 3:1; a16z usa 3x como benchmark aproximado | [a16z](https://a16z.com/why-do-investors-care-so-much-about-ltvcac/) / [Paddle](https://www.paddle.com/resources/cac-ltv-ratio) | LTV em margem de contribuição ÷ CAC fully loaded |
| Payback ilustrativo | 4 meses (5x), 12 meses (3x), 20 meses (1x) em exemplos Paddle | [Paddle](https://www.paddle.com/resources/cac-ltv-ratio) | CAC ÷ margem mensal; não tratar como benchmark setorial |
| Google Search CPC mediano (USD, amostra EUA 2017–18) | Saúde $2,62; educação $2,40; seguros/finanças $3,44; jurídico $6,75; imobiliário $2,37; e-commerce $1,16 | [WordStream](https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks) | custo ÷ cliques; converter para BRL só com cautela |
| Google Search CPA mediano (USD, mesma amostra) | Saúde $78,09; educação $72,70; finanças/seguros $81,93; jurídico $86,02; imobiliário $116,61; e-commerce $45,27 | [WordStream](https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks) | custo ÷ conversão definida pelo anunciante; não equivale necessariamente a venda |
| Google Search CVR | média 3,75%; saúde 3,36%; educação 3,39%; jurídico 6,98%; imobiliário 2,47%; e-commerce 2,81% | [WordStream](https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks) | conversões ÷ cliques |
| Facebook CPA mediano (USD, EUA 2016–17) | saúde $12,31; educação $7,85; finanças/seguros $41,43; jurídico $28,70; imobiliário $16,92; beleza $25,49; varejo $21,47 | [WordStream](https://www.wordstream.com/blog/ws/2017/02/28/facebook-advertising-benchmarks) | custo ÷ ação; amostra inclui objetivos e ações heterogêneos |
| Facebook CVR | média 9,21%; educação 13,58%; saúde 11%; imobiliário 10,68%; varejo 3,26% | [WordStream](https://www.wordstream.com/blog/ws/2017/02/28/facebook-advertising-benchmarks) | conversões ÷ cliques, com janela da plataforma |
| E-commerce Brasil | faturamento projetado 2025 R$235,52 bi; ticket médio R$536,60; 438,92 mi pedidos | [ABComm/Abiacom](https://dados.abcomm.org/previsao-de-vendas-online) | usar para contexto de mercado, não como CAC |
| Operação brasileira RD | base 1,3 bi conversões; 2.790 profissionais; 38% não sabem tempo de primeiro contato; automações têm CTOR 12% vs 8% campanhas pontuais | [RD Station](https://www.rdstation.com/blog/marketing/panoramas-marketing-vendas/) | medir tempo de resposta, CTOR e pipeline por fonte |

Os benchmarks de CPL/CPA públicos brasileiros, abertos e comparáveis por saúde, odontologia, educação, imobiliário, jurídico, seguros e e-commerce são escassos. Os números WordStream são **direcionais**, antigos, em USD e baseados em contas dos EUA; não devem virar meta em reais. A prática correta é criar baseline local de 4–8 semanas por segmento e registrar definição de conversão, praça, oferta, atribuição e qualidade do lead.

## 4. Taticas e playbooks acionaveis (por canal e funil, com passos)

**Google Search (intenção).** Separe marca, alta intenção e descoberta; use páginas por serviço e região; registre chamada, WhatsApp e formulário como conversões distintas; importe venda qualificada/offline; corte termos sem margem; escale conjuntos cujo CPA de cliente e payback estejam abaixo do limite.

**Meta/Instagram (demanda e remarketing).** Teste três ângulos de oferta e criativos por segmento; use formulário curto apenas para diagnóstico inicial; valide telefone e intenção no CRM; faça remarketing de visitantes e leads não agendados; otimize para venda, não para lead barato. Em saúde, jurídico e seguros, respeite regras de publicidade e consentimento.

**Orgânico, CRM e WhatsApp.** Publique conteúdo que responde objeções de compra; capture origem com UTMs; automatize nutrição por estágio; defina SLA de minutos/horas, responsável e número de tentativas; reative clientes antes do churn. O RD reporta WhatsApp usado por 72% dos times de Marketing e CTOR superior em fluxos automatizados, reforçando a combinação mídia + canal próprio.

**E-commerce.** Acompanhe margem por SKU, contribuição após frete e devolução; faça teste de primeira compra sem sacrificar margem; acompanhe CAC de novos e receita de recompra por coorte; use remarketing com limite de frequência; desligue campanhas com ROAS aparente alto, mas contribuição negativa.

**Regra operacional de escala/corte.** Escale 15–30% por vez quando houver volume mínimo, rastreamento confiável, margem positiva, payback dentro do caixa e coortes recentes sem deterioração. Corte ou congele quando CPA de cliente exceder o teto por dois ciclos, qualidade/retensão cair, frequência saturar ou o tracking divergir do CRM. Antes de culpar mídia, audite oferta, velocidade comercial, conversão de página e atribuição.

## 5. Casos reais (empresa, o que fez, resultado, licao)

**Empresas consumer internet analisadas pela a16z.** A análise de mais de 60 companhias públicas modelou margem e valuation com LTV como lucro bruto e CAC como S&M. O exemplo mostra margem operacional de longo prazo de cerca de 16% em 2x LTV:CAC contra 33% em 3x, sob hipóteses constantes de R&D e G&A. Lição: otimizar aquisição só vale se a margem de contribuição estiver corretamente definida; não confundir o exemplo com previsão de PME.

**Panorama RD Station (mercado brasileiro).** A pesquisa reúne dados de milhares de profissionais, 1,3 bilhão de conversões e 97 milhões de negociações. Empresas com SLA de Marketing–Vendas tiveram taxa de atingimento de metas de 39%, ante 20% sem SLA. Lição: o gargalo de crescimento pode estar no handoff e no tempo de resposta, não no orçamento de anúncios.

**Exemplos Paddle.** Três empresas hipotéticas com mesmo CAC, margem e churn alcançam payback de 4, 12 e 20 meses conforme monetização e LTV mudam. Lição: preço, embalagem, cobrança e retenção são alavancas de aquisição; CAC isolado não explica caixa.

## 6. Erros comuns e anti-padroes

- Chamar CPL de CAC e contar lead, trial ou usuário gratuito como cliente.
- Usar só mídia no CAC “oficial”, omitindo salários, agência, ferramentas e comissão.
- Calcular LTV em receita, sem margem, churn, devolução, frete ou custo de servir.
- Misturar canais e segmentos, atribuir toda venda ao último clique e comparar períodos com maturidade diferente.
- Escalar ROAS de primeira compra sem coorte de recompra e payback.
- Adotar benchmark estrangeiro antigo como meta brasileira sem baseline local.
- Medir churn apenas agregado: separar logo/segmento, canal, região, plano e coorte.
- Comprar tecnologia antes de corrigir tracking, SLA, oferta, página e processo comercial.

## 7. Como aplicar num plano de cliente (exemplo curto em um segmento)

Para uma clínica odontológica, começaria com três coortes: Google alta intenção, Meta e indicação/orgânico; definiria cliente como consulta paga e depois tratamento iniciado. Mediria CAC paid e blended, taxa lead→agendamento→comparecimento→tratamento, margem de contribuição por procedimento, payback do primeiro tratamento e retenção/recompra em 90 dias. O teto de CAC seria margem esperada do tratamento inicial mais margem conservadora de retorno, e o plano escalaria apenas campanhas com CRM, ligação/WhatsApp rastreados e SLA curto; leads de Meta seriam julgados por tratamento iniciado, não por formulário.

## 8. Fontes (lista de URLs)

- https://a16z.com/why-do-investors-care-so-much-about-ltvcac/
- https://a16z.com/16-startup-metrics/
- https://www.paddle.com/resources/cac-ltv-ratio
- https://www.reforge.com/artifacts/c/growth/retention
- https://www.saas-capital.com/research/private-saas-company-growth-rate-benchmarks/
- https://www.rdstation.com/blog/marketing/panoramas-marketing-vendas/
- https://dados.abcomm.org/previsao-de-vendas-online
- https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks
- https://www.wordstream.com/blog/ws/2017/02/28/facebook-advertising-benchmarks
