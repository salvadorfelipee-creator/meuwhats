# Fundamentos técnicos e on-page

> Use este arquivo para auditorias, lançamentos, migrações e otimização de URLs. Base principal: Google Search Central e dossiê de SEO e Conteúdo. A ordem é rastrear → indexar → servir → converter; schema e acabamento vêm depois.

## Sumário

1. Modelo de diagnóstico
2. Auditoria em 10 passos
3. On-page por URL
4. Dados estruturados e acessibilidade
5. Backlog e critérios de aceite
6. Exemplo de auditoria
7. Fontes e limites

## 1. Modelo de diagnóstico

| Camada | Pergunta | Evidência mínima | Decisão inicial |
|---|---|---|---|
| Rastrear | Robôs conseguem descobrir e ler os recursos? | robots.txt, logs/amostras, renderização | corrigir bloqueio antes de pauta |
| Indexar | A URL é elegível e escolhida como canônica? | Search Console, status, canonical, sitemap | consolidar ou corrigir sinais |
| Servir | A página responde à intenção em mobile? | SERP, teste manual, CWV de campo/lab | remover fricção e melhorar resposta |
| Converter | O próximo passo funciona e é medido? | evento, UTM, CRM, teste de formulário/telefone | instrumentar antes de escalar |

**Regra de evidência:** “não indexada” pode significar bloqueio, duplicidade, baixa qualidade percebida ou atraso; não atribua causa sem inspeção. Dono: SEO/analista; prazo: 2 dias úteis para amostra; critério: causa registrada com URL e evidência.

## 2. Auditoria técnica em 10 passos

1. **Registre o contexto:** domínio, subdomínios, templates, CMS, regiões, idiomas, conversões e janela de dados. Dono: estrategista; prazo: dia 1; critério: inventário aprovado.
2. **Verifique Search Console:** propriedade, ações manuais, cobertura, desempenho, CWV e rich results. Dono: analista; prazo: dia 1; critério: exportação datada e sem ação manual ignorada.
3. **Rastreie uma amostra ou todo o site:** separe 200, 3xx, 4xx, 5xx, noindex, bloqueadas, órfãs e parâmetros. Dono: técnico; prazo: dia 2; critério: arquivo de URLs com status e origem.
4. **Inspecione templates:** home, categoria, produto/serviço, artigo, paginação, busca interna, parâmetro e página local. Dono: SEO + dev; prazo: dia 3; critério: cada template tem exemplo canônico.
5. **Confirme o conteúdo principal:** leia sem login, interação obrigatória ou JavaScript bloqueado; teste mobile. Dono: SEO; prazo: dia 3; critério: resposta principal acessível e legível.
6. **Audite sinais de URL:** canonical, hreflang quando aplicável, sitemap somente com URLs canônicas/indexáveis, robots e redirects. Dono: dev; prazo: dia 5; critério: zero conflito na amostra prioritária.
7. **Mapeie duplicidade e canibalização:** compare title, H1, intenção, SERP e conversão; decida manter, diferenciar, fundir ou redirecionar. Dono: estrategista; prazo: dia 7; critério: decisão por URL, sem apagar função comercial.
8. **Meça experiência sem fetichizar nota:** olhe dados de campo, mobile, acessibilidade, leitura, formulário e telefone. Dono: dev + UX; prazo: dia 10; critério: gargalo priorizado por impacto no uso.
9. **Valide JSON-LD elegível:** markup descreve conteúdo visível e correto; use Rich Results Test e registre tipo, URL e data. Dono: dev/SEO; prazo: dia 10; critério: sem erro crítico e sem promessa de exibição.
10. **Abra tickets revalidáveis:** impacto, esforço, dono, prazo, dependência, evidência, métrica e aceite. Dono: líder de projeto; prazo: dia 12; critério: backlog executável na sprint seguinte.

## 3. On-page por URL

| Elemento | Faça | Não faça | Dono/prazo/critério |
|---|---|---|---|
| Intenção | defina uma tarefa primária e uma ação de negócio | juntar aprender, comparar e comprar sem ordem | SEO; antes da redação; uma frase de intenção validada na SERP |
| Title | seja único, descritivo e honesto | repetir fórmula ou prometer o que não entrega | redator; briefing; CTR qualificado e ausência de aumento de rejeição como guarda |
| H1 | alinhe com a promessa e a pergunta | usar slogan genérico | redator; publicação; H1 coerente com title e resposta |
| URL | use caminho legível, estável e canônico | datas/sinônimos/parametrização sem necessidade | dev; antes do deploy; uma URL preferida documentada |
| H2/H3 | organize perguntas, passos e exceções | escrever subtítulos só para repetir palavra-chave | redator; rascunho; leitor encontra resposta em 30 segundos (hipótese operacional) |
| Corpo | entregue resposta, contexto, prova, limites e próximo passo | inflar tamanho ou copiar concorrente | especialista/revisor; data editorial; revisão factual aprovada |
| Imagem | use original ou licenciado, comprima e descreva alt | alt com lista de palavras-chave | design/SEO; publicação; imagem auxilia compreensão e carrega sem bloquear |
| Links internos | ligue cluster→pilar, pilar→cluster e próximos passos úteis | inserir âncora artificial em todo parágrafo | SEO/editor; publicação; URLs prioritárias recebem links contextuais |
| CTA | peça uma ação coerente com estágio | interromper resposta com vários CTAs | dono da conversão; publicação; evento/teste do CTA registrado |
| Schema | marque apenas conteúdo visível e elegível | inventar review, preço, FAQ ou evento | dev/SEO; antes/depois; validação sem erro crítico e conteúdo correspondente |

### Exemplo curto de melhoria

**Pedido:** “otimize página de fisioterapia para dor lombar em Campinas”.

- Intenção: pessoa quer avaliar tratamento local, não ler definição genérica.
- Promessa: “Como avaliar dor lombar e escolher fisioterapia em Campinas: sinais, primeira consulta e próximos passos”.
- Resposta inicial: esclarecer que sinais de alerta exigem avaliação profissional e que a página descreve processo, não diagnóstico individual.
- Prova: método da clínica, formação do profissional, caso autorizado, faixa de atendimento e acesso real.
- CTA: agendar avaliação; registrar `cta_agendar_lombar` e origem.
- Donos: especialista valida saúde em 3 dias; redator revisa em 5; dev publica em 7; critério: evento funcionando, revisão aprovada e nenhuma afirmação sem fonte.

## 4. Dados estruturados e acessibilidade

1. Liste o tipo de conteúdo visível e selecione apenas markup elegível documentado pelo Google. Dono: SEO; prazo: antes do desenvolvimento; critério: tipo e propriedades mapeados para elementos visíveis.
2. Gere JSON-LD com valores atuais, autorais e consistentes com a página. Dono: dev; prazo: no deploy; critério: Rich Results Test sem erro crítico.
3. Teste teclado, contraste, zoom, foco, alt, headings e formulário; acessibilidade é qualidade de uso, não atalho de ranking. Dono: UX/QA; prazo: até 2 dias após deploy; critério: checklist de barreiras críticas zerado.
4. Monitore elegibilidade e cliques, sem prometer rich result. Dono: analista; prazo: 28 dias; critério: decisão de manter/ajustar baseada em dados e não só em ferramenta.

## 5. Backlog e critérios de aceite

Use este formato em cada ticket:

| Campo | Exemplo |
|---|---|
| Achado | 38 URLs de serviço apontam canonical para a home |
| Evidência | exportação GSC em 03/10/2026 + amostra `/servicos/` |
| Hipótese de impacto | sinais conflitantes reduzem a escolha da URL correta |
| Ação | gerar canonical autorreferente no template de serviço |
| Dono | desenvolvedor responsável pelo CMS |
| Prazo | 5 dias úteis após acesso ao repositório |
| Métrica | URLs prioritárias elegíveis na inspeção; cliques e conversão sem queda |
| Critério de aceite | deploy validado, 0 canonical conflitante na amostra e reprocessamento solicitado |
| Plano B | separar URLs ainda duplicadas e bloquear criação de novas variações |

**Prioridade operacional:** `impacto (1–5) × demanda (1–5) × confiança (1–5) ÷ esforço (1–5)`. É hipótese de gestão; valide com o script e reordene após evidência.

## 6. Exemplo de matriz de decisão

| Achado | Não faça | Faça | Decisão em |
|---|---|---|---|
| 5 páginas com mesma intenção | publicar a sexta | consolidar ou diferenciar por público/estágio | estrategista em 3 dias; critério: uma promessa por URL |
| sitemap com 4xx | adicionar mais URLs | remover não indexáveis e corrigir origem | dev em 2 dias; critério: somente URLs elegíveis |
| CWV ruim mas formulário não funciona | perseguir nota perfeita | corrigir conversão quebrada primeiro | produto em 1 dia; critério: teste ponta a ponta aprovado |
| title com CTR baixo | trocar todo o site | testar 5 URLs com impressão suficiente | SEO em 28 dias; critério: CTR qualificado e conversão de guarda |

## 7. Fontes e limites

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Dados estruturados](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [Mozlow’s Hierarchy / Moz](https://moz.com/beginners-guide-to-seo)

O Google informa que mudanças podem aparecer de horas a vários meses; avalie após algumas semanas, conforme maturidade e tipo de alteração. Não existe tamanho ideal de texto nem nota única de velocidade que garanta ranking. Marque qualquer faixa interna como hipótese.
