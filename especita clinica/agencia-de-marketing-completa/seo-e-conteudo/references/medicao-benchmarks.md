# Medição, fórmulas e benchmarks de SEO e conteúdo

> Use para instrumentação, dashboards, auditorias de resultado, priorização e comunicação de expectativas. Benchmark é referência de ordem de grandeza; meta nasce do baseline do negócio. Todo número sem fonte explícita abaixo deve ser tratado como hipótese.

## Sumário

1. Instrumentação mínima
2. Fórmulas
3. Benchmarks com fonte
4. Calibração sem benchmark
5. Painel e atribuição
6. Cenários e decisões
7. Fontes e lacunas

## 1. Instrumentação mínima

| Camada | Configurar | Dono | Prazo | Critério de aceite |
|---|---|---|---|---|
| Search Console | propriedade, sitemap, cobertura, desempenho, CWV | analista | dia 1 | acesso e exportação datada |
| GA4 | eventos de formulário, telefone, WhatsApp, agenda e compra | dev/analista | dia 5 | teste em modo real e consentimento correto |
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | marketing | dia 3 | links padronizados sem parâmetros quebrados |
| CRM | origem, URL/campanha, etapa, próxima ação, venda e receita | comercial | dia 5 | venda atribuível a fonte ou “desconhecida” explícito |
| Call/WhatsApp | número, código, formulário ou marcador por campanha | operação | dia 7 | conversa ligada ao CRM sem depender de memória |
| Dashboard | no máximo 12 números e data de atualização | BI/analista | dia 10 | leitura em 15 minutos e fonte de cada métrica |

Se não for possível ligar orgânico a lead/venda, reporte essa lacuna e trate cliques como indicador intermediário, nunca como receita.

## 2. Fórmulas operacionais

| Métrica | Fórmula | Cuidado |
|---|---|---|
| CTR | cliques ÷ impressões | misturar marca, dispositivo e consulta distorce |
| Conversão | conversões ÷ sessões/cliques/leads, conforme definição | escreva denominador e janela |
| Lead qualificado | leads que atendem critérios ÷ leads | defina critérios antes de medir |
| CPL | custo ÷ leads | não confunda com CAC |
| CAC | custos incrementais de aquisição ÷ novos clientes pagantes | inclua custo relevante e coorte |
| Receita orgânica | receita atribuída/assistida conforme modelo | atribuição não é causalidade perfeita |
| Margem de contribuição | receita − custos variáveis | use margem, não receita bruta |
| LTV | ticket × frequência × margem × permanência (meses ÷ 12) | estimativa até haver coorte madura |
| LTV/CAC | LTV ÷ CAC | 3x é referência de disciplina, não lei |
| Payback | CAC ÷ margem mensal por cliente | compare com caixa e ciclo real |
| Taxa de link | links obtidos ÷ prospects contatados | qualidade importa mais que volume |
| ROI editorial | margem incremental ÷ custo editorial | registre custo de produção/distribuição |
| Recompra | clientes com segunda compra ÷ clientes ativos | coorte e janela são obrigatórias |

## 3. Benchmarks com fonte e uso correto

| Métrica/achado | Número | Fonte e interpretação |
|---|---:|---|
| Tempo para efeitos de SEO | horas a vários meses; avaliar após algumas semanas | [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide); não prometer 15 dias |
| Contratação de SEO | normalmente 4 meses a 1 ano para benefícios | [Google “Do I need SEO?”](https://developers.google.com/search/docs/fundamentals/do-i-need-seo?hl=pt-br); faixa de planejamento, não garantia |
| CTR posição 1 | 27,6% | [Backlinko](https://backlinko.com/google-ctr-stats), estudo observacional de ~4 milhões de resultados; varia por SERP |
| CTR top 3 | 54,4% | Backlinko; não aplicar como meta universal |
| CTR página 2 | 0,63% | Backlinko; correlação, não diagnóstico causal |
| Títulos 40–60 caracteres | 33,3% maior CTR que fora da faixa no estudo | Backlinko; hipótese de teste, Google não fixa tamanho |
| Consultas de 10–15 palavras | 1,76× mais cliques que termos de uma palavra | Backlinko; sinal de intenção, não regra de ranking |
| Clusters por pilar | cerca de 10–30 como sugestão | [Rock Content](https://rockcontent.com/br/blog/topic-clusters/); faixa de planejamento, não regra |
| Rich results | cases: 25% CTR (Rotten Tomatoes), 35% visitas (Food Network), 82% CTR (Nestlé) | [Google](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data); cases não uniformes, testar localmente |
| GEO visibility | até 40% no GEO-bench | [Aggarwal et al.](https://arxiv.org/abs/2311.09735); benchmark acadêmico inicial, não previsão |
| Outreach | 5 links em 100 e-mails pode ser considerado bom | [Ahrefs](https://ahrefs.com/seo/link-building); observação editorial, não meta universal |
| Regra 95:5 B2B | até 95% fora do mercado no trimestre | [Ehrenberg-Bass](https://marketingscience.info/news-and-insights/ehrenberg-bass-95-of-b2b-buyers-are-not-in-the-market-for-your-products); depende do ciclo |
| Atividade local | 1 atualização semanal e resposta em 2 dias úteis | **hipótese operacional** do dossiê, não benchmark do Google |
| Alocação editorial 70/20/10 | 70% atualizar, 20% novo, 10% teste | **hipótese operacional** do dossiê, calibrar por capacidade |
| Entrevistas | 5–10 clientes | **hipótese de amostra** do dossiê, não garantia de representatividade |

**Regra:** ao citar um número, informe fonte, ano/data, amostra, país/vertical e o que ele não prova.

## 4. Calibrar metas sem benchmark confiável

1. Fixe baseline de 28 dias (ou ciclo suficiente) por URL, consulta, canal e conversão. Dono: analista; prazo: primeiro ciclo; critério: dados sem quebra crítica.
2. Separe medido, estimado, meta e hipótese em colunas distintas. Dono: líder; prazo: antes de apresentar; critério: nenhum número sem etiqueta.
3. Rode teste pequeno e controlado, sem mudar intenção, tracking e oferta ao mesmo tempo. Dono: SEO/editor; prazo: 28–90 dias; critério: métrica primária e métrica de guarda definidas.
4. Revise por coorte e maturidade, não por um dia ou posição média isolada. Dono: analista; prazo: ritual mensal; critério: decisão registrada.
5. Cancele ou ajuste se a hipótese não avançar ou se qualidade/conversão cair. Dono: responsável de negócio; prazo: reunião mensal; critério: custo/oportunidade explicitado.

## 5. Painel máximo de 12 números

| Grupo | Indicadores recomendados |
|---|---|
| Descoberta | impressões, cliques, CTR |
| Conteúdo | URLs publicadas/atualizadas, consultas não-marca |
| Negócio | leads qualificados, vendas, receita/margem assistida |
| Local | chamadas, rotas, cliques no site/WhatsApp |
| Qualidade | páginas com erro crítico, conversão, tempo de resposta |
| Autoridade | referring domains relevantes, menções/citações qualificadas |

Use três camadas: **primária** (vendas/leads/margem), **intermediária** (cliques/ações) e **guarda** (qualidade, conversão, custo). A posição média pode ser diagnóstico, não objetivo.

## 6. Cenários e decisões

| Resultado do ciclo | Critério | Próxima ação | Dono/prazo |
|---|---|---|---|
| Venceu | melhora na métrica primária sem piorar guarda e tracking íntegro | padronizar e ampliar em URLs semelhantes | líder; 14 dias |
| Perdeu | piora clara ou custo acima do limite | reverter, explicar e registrar | dono da mudança; 3 dias |
| Inconclusivo | volume insuficiente ou ruído | estender só se valor esperado justificar | analista; decisão em 7 dias |
| Tracking inválido | divergência CRM/Analytics ou evento quebrado | congelar conclusão e corrigir medição | dev/BI; 5 dias |

### Exemplo de decisão

“Atualizar title em 5 URLs” só vence se: (a) impressões suficientes para comparar, (b) CTR qualificado melhorar, (c) leads/vendas não piorarem, (d) alteração anotada e (e) janela de 28 dias ou maturidade compatível. Se só CTR subir e conversão cair, reverter ou testar mensagem mais específica.

## 7. Fontes e lacunas

- [Google Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Backlinko CTR Study](https://backlinko.com/google-ctr-stats)
- [GEO paper](https://arxiv.org/abs/2311.09735)
- [Ahrefs Content Audit](https://ahrefs.com/blog/content-audit/)

Lacunas: não existe benchmark universal confiável para quantidade de palavras, posts/mês, densidade de keywords, links, velocidade, avaliações ou taxa de citação em IA. Não há dados privados de CRM/Search Console de uma empresa sem acesso; marque qualquer estimativa como hipótese.
