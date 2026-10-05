# Ferramentas gratuitas para SEO e conteúdo

> Use este arquivo depois de definir decisão, dados, dono e métrica. Planos gratuitos mudam; confira o limite atual na fonte antes de recomendar. Uma planilha bem operada é melhor que ferramentas sem responsável.

## Sumário

1. Stack mínimo
2. Pesquisa e diagnóstico
3. Produção e distribuição
4. Decisão de adoção
5. Rotina de 30 dias
6. Anti-padrões e fontes

## 1. Stack mínimo

| Função | Ferramenta | O que mede/faz | Limite/risco | Dono, prazo e critério |
|---|---|---|---|---|
| Busca | Google Search Console | consultas, cliques, impressões, indexação, sitemap, CWV | não é crawler completo; exportação tem limites | analista; dia 1; propriedade e exportação testadas |
| Analytics | Google Analytics 4 | sessões, eventos e conversões | exige implementação/consentimento; não substitui CRM | dev/analista; dia 5; evento ponta a ponta |
| Local | Perfil da Empresa no Google | Maps, chamadas, rotas, site, avaliações, fotos | exige verificação e manutenção | gerente local; dia 3; dados reais e contato atendido |
| Tendência | Google Trends | tendência relativa, sazonalidade e região | não fornece volume absoluto | SEO; dia 3; decisão ligada a janela comercial |
| Demanda | Keyword Planner | ideias e estimativas de demanda | faixas amplas sem campanha ativa | SEO; dia 4; termos validados na SERP |
| Performance | PageSpeed/Lighthouse | laboratório de performance, acessibilidade e boas práticas | laboratório difere de campo; nota não é objetivo isolado | dev/UX; dia 5; gargalo priorizado por impacto |
| Schema | Rich Results Test | elegibilidade de tipos de rich result | válido não garante exibição | dev/SEO; antes de deploy; markup visível e sem erro crítico |
| Crawl | Screaming Frog SEO Spider | status, títulos, links, canonicals | versão gratuita tradicional limitada a 500 URLs; confirme limite | técnico; sprint 1; amostra cobre templates |
| Auditoria própria | Ahrefs Webmaster Tools | auditoria técnica e links do próprio site verificado | não é acesso ilimitado a concorrentes | SEO; semana 1; achados reproduzidos/qualificados |
| Painel | Looker Studio + Sheets | dashboard e inventário | conectores/atualização variam | analista; dia 10; painel com até 12 números |
| Base | Google Sheets/Notion | backlog, calendário, CRM simples | governança e versionamento manuais | líder; dia 2; próxima ação e dono preenchidos |

Fontes: [Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start), [Perfil da Empresa](https://business.google.com/br/business-profile/), [Structured Data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data), [RD: ferramentas de SEO](https://resultadosdigitais.com.br/blog/ferramentas-de-seo).

## 2. Pesquisa e diagnóstico

| Pergunta | Ferramenta gratuita | Procedimento | Critério de decisão |
|---|---|---|---|
| Quais consultas já geram impressão? | Search Console | exportar por página, consulta e data | atualizar URLs com demanda e conversão |
| O tema é sazonal? | Trends | comparar região/termos e janela | planejar publicação antes da janela, sem tratar índice como volume |
| O que concorrentes anunciam? | Meta Ad Library/Google Ads Transparency | observar oferta, formato e linguagem | usar como hipótese, não copiar texto/criativo |
| Qual dor aparece? | Reviews, comentários, atendimento | anonimizar e contar recorrências | virar CEP, FAQ ou redutor de risco |
| Há links quebrados/duplicados? | crawler + GSC | rastrear amostra/template | ticket com URL, dono e aceite |
| O schema é elegível? | Rich Results Test | validar e comparar com conteúdo visível | manter somente markup factual |

## 3. Produção e distribuição

| Função | Opções gratuitas | Uso seguro | Dono/critério |
|---|---|---|---|
| Texto/roteiro | editor Markdown/Docs + IA disponível | gerar rascunho, nunca publicar sem revisão e fontes | editor; checklist factual aprovado |
| Design | Canva/Photopea | diagrama, capa e imagens com licença | designer; arquivo e licença registrados |
| Imagem | celular próprio, Unsplash, Pexels, Pixabay | preferir prova real; atribuição/licença conforme uso | marketing; autorização conferida |
| Vídeo | CapCut/Clipchamp/DaVinci | derivar conteúdo sem copiar creator | social; legenda e CTA revisados |
| Áudio | Audacity | limpeza e corte | conteúdo; consentimento e arquivo de origem |
| Formulário | Google Forms | pesquisa, briefing e leads com consentimento | operação; acesso restrito e campos mínimos |
| Comunicação | newsletter/plataforma com plano inicial | distribuir a lista com opt-in e descadastro | marketing; taxa de entrega e reclamação monitoradas |
| UTMs | construtor de URL + planilha | padronizar origem/mídia/campanha/conteúdo | analista; sem UTM órfã |

## 4. Decisão de adoção

Antes de indicar qualquer ferramenta, responda:

1. **Qual decisão muda?** Se não muda backlog, conteúdo, canal ou venda, não adote. Dono: líder; prazo: 30 min; critério: decisão escrita.
2. **Quem opera na segunda-feira?** Se não houver dono, comece com planilha. Dono: gestor; prazo: antes da compra; critério: responsável nomeado.
3. **Qual o custo real?** Some configuração, manutenção, aprendizado e migração, mesmo que licença seja gratuita. Dono: gestor; prazo: antes de instalar; critério: estimativa registrada.
4. **Dá para provar valor em 30 dias?** Se não, defina experimento menor ou adie. Dono: analista; prazo: dia 1; critério: métrica e janela

## 5. Rotina de 30 dias sem licença paga

| Semana | Execução | Dono | Critério de decisão |
|---|---|---|---|
| 1 | verificar GSC, GA4, GBP, sitemap, eventos e acessos | analista + dev | rastreio mínimo validado ou lacuna aberta |
| 2 | exportar consultas, inventário e problemas técnicos | SEO | backlog com URL, evidência, impacto e esforço |
| 3 | produzir/atualizar 1 ativo prioritário e distribuir | editor + especialista | revisão, fontes, CTA e evento funcionando |
| 4 | ler cliques, consultas, ações locais, leads e qualidade | analista + negócio | manter, ajustar, consolidar ou pausar por critério |

## 6. Anti-padrões

- Instalar muitas ferramentas sem alguém lendo o painel.
- Comprar crawler ou CRM antes de corrigir definição de intenção, tracking e processo.
- Tratar plano gratuito como ilimitado; registre limite e data de verificação.
- Usar automação de WhatsApp sem opt-in, política e opção de saída.
- Usar IA para publicar texto genérico em escala ou copiar concorrentes.
- Fazer dashboard com dezenas de métricas que não mudam nenhuma decisão.

**Regra de atualização:** dono: administrador da stack; prazo: a cada 90 dias; critério: limites, URLs e permissões conferidos e documentados.

## 7. Exemplo concreto: clínica local sem ferramenta paga

**Situação:** clínica tem site, Perfil da Empresa e WhatsApp, mas não sabe se as consultas vêm do Google.

1. Analista verifica Search Console e exporta consultas/páginas; dono: analista; prazo: dia 1; critério: arquivo datado com cliques e impressões.
2. Dev cria eventos de clique em telefone, WhatsApp e formulário no GA4; dono: dev; prazo: 5 dias; critério: cada evento dispara em teste real e respeita consentimento.
3. Atendimento registra origem, serviço, etapa e venda em Sheets; dono: gerente; prazo: 7 dias; critério: 100% dos novos contatos têm origem ou “desconhecida”.
4. SEO usa Trends/Keyword Planner apenas para comparar “dor urgente” e “check-up”, validando a SERP local; dono: SEO; prazo: 3 dias; critério: pauta escolhida por intenção e capacidade, não por volume isolado.
5. Analista monta Looker Studio com impressões, cliques, leads, agendamentos, comparecimento, vendas, chamadas e receita; dono: analista; prazo: dia 10; critério: painel com no máximo 12 números e reunião semanal marcada.

**Decisão após 30 dias:** manter atualização local e conteúdo se ações locais e leads qualificados avançarem sem queda de qualidade; corrigir tracking se CRM e GA4 divergirem; não comprar ferramenta antes de provar qual decisão continua sem resposta.
