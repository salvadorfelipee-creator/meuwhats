# Diagnóstico de desempenho — Google Ads

**Data da extração:** 03/10/2026  
**Modo:** somente leitura, usando o My Browser autenticado do usuário. Nenhuma campanha, anúncio, orçamento, lance, segmentação, conversão, público ou faturamento foi alterado.

## 1. Identificação da conta e escopo

- **Conta:** Especitá Clínica odontológica e Estética | Dentista em Brusque
- **Customer ID:** 113-943-9321
- **Moeda:** BRL (R$), conforme as métricas exibidas
- **Fuso horário:** GMT−03:00 — Horário Padrão de Brasília
- **Período exibido nos relatórios:** 28/02/2024 a 03/10/2026
- **Filtros/status:** campanhas e grupos na visualização atual, excluindo removidas; anúncios e palavras-chave com status ativado/pausado quando a tela permitiu; ações de conversão com `Status: Todos`; termos de pesquisa conforme o relatório padrão.

> Os relatórios do Google Ads informam que não são gerados em tempo real. As datas e horas seguem o fuso da conta.

## 2. Resumo executivo

A visualização principal contém **2 campanhas de Pesquisa**. No período selecionado, a visualização soma **16.392 impressões, 804 cliques, CTR de 4,90%, custo de R$ 3.069,65, 31 conversões e custo por conversão de R$ 99,02**.

A campanha `[pesquisa] 18/08 dentista` concentra **631 dos 804 cliques**, **27 das 31 conversões** e **R$ 2.007,73** de custo. Ela está **Qualificada (limitada)** e marcada como **limitada pelo orçamento**, com orçamento de R$ 65/dia e estratégia de CPA desejado.

A campanha `[pesquisa 28/07]` está **pausada**. Mesmo assim, o histórico exibido registra 173 cliques, 4 conversões, R$ 1.061,92 de custo e CPA de R$ 265,48. Não há evidência, nesta extração, de que ela esteja veiculando atualmente.

O tráfego é fortemente móvel: smartphones responderam por **748 cliques e 29 conversões** no detalhamento por dispositivo. Tablets tiveram volume praticamente nulo. A localização exibida é exclusivamente **Brusque, Santa Catarina, Brasil**.

Há problemas de mensuração que exigem validação antes de decisões: várias ações de conversão estão sem conversões recentes; `Lead Formulário`, `[Lead] [Botão WPP]` e `FORM SITE` aparecem com **Requer atenção** ou status que merece conferência; algumas ações GA4 estão removidas. O Google Ads também exibe totais de conta diferentes do total da visualização atual, portanto não se deve misturá-los.

## 3. Desempenho por campanha

| Campanha | Status | Impressões | Cliques | CTR | Custo | Conversões | CPA |
|---|---:|---:|---:|---:|---:|---:|---:|
| [pesquisa] 18/08 dentista | Qualificada (limitada; limitada pelo orçamento) | 13.509 | 631 | 4,67% | R$ 2.007,73 | 27 | R$ 74,36 |
| [pesquisa 28/07] | Pausada | 2.883 | 173 | 6,00% | R$ 1.061,92 | 4 | R$ 265,48 |
| **Total da visualização** | — | **16.392** | **804** | **4,90%** | **R$ 3.069,65** | **31** | **R$ 99,02** |

A tela também mostrou um **total de conta** de 100.136 impressões, 4.093 cliques, R$ 18.658,16 e 475 conversões. Esse total não é equivalente ao total das duas campanhas visíveis; foi mantido separado para evitar mistura de escopos.

## 4. Estrutura, anúncios e qualidade

- **2 grupos de anúncios** visíveis: `Grupo de anúncios 1` e `G01 - GERAL`.
- **2 anúncios responsivos de pesquisa** visíveis.
- O anúncio da campanha ativa tem qualidade **Bom**.
- O anúncio associado à campanha pausada tem qualidade **Médio** e status **Não qualificada — a campanha está pausada**.
- A campanha ativa possui pontuação de otimização de **82,8%**.
- O Google Ads recomendou adicionar imagens aos anúncios; isso é uma recomendação da plataforma, não uma alteração aplicada.

## 5. Palavras-chave

O relatório mostrou **12 palavras-chave**, somando 2.956 impressões, 181 cliques, R$ 1.090,54 e 6 conversões na visualização atual. Destaques:

- `"implantes dentarios"`: 16 impressões, 6 cliques, CTR 37,50%, 2 conversões e CPA R$ 10,50.
- `"dentista brusque"`: 2.151 impressões, 142 cliques, R$ 927,17, índice de qualidade 3/10, 3 conversões e CPA R$ 309,06; está em campanha pausada.
- `dentista brusque sc`: índice de qualidade 1/10 e status de baixa frequência/pausada.
- `dentista em brusque`: 251 impressões e 18 cliques, sem conversões no relatório de palavra-chave.
- `"clinica odontológica"`, `"dentista infantil"`, `"odontopediatria"`, `"dor no dente"` e `"dentista perto de mim"` tiveram zero cliques ou volume muito baixo no período.

O total da conta do relatório de palavras-chave foi exibido separadamente: 54.755 impressões, 3.411 cliques, R$ 17.820,98 e 472 conversões.

## 6. Termos de pesquisa

O relatório indicou **1.907 linhas**, com 50 por página. A interface exibida permitiu ler o total do relatório e as primeiras linhas visíveis; o CSV entregue `05_termos_pesquisa_visiveis.csv` contém apenas essas linhas visíveis e está explicitamente identificado como amostra, sem omissão silenciosa.

Total exibido do relatório: **323 cliques, 6.610 impressões, CTR 4,89%, custo R$ 1.115,37, 17,50 conversões e CPA R$ 63,74**.

Termos visíveis relevantes:

- `dentista em brusque`: 10 cliques, 95 impressões, 1 conversão; marcado como adicionado.
- `dentista 24 horas brusque`: 11 cliques, 59 impressões, 1 conversão.
- `quanto um dentista cobra para extrair um dente`: 1 clique, 2 impressões, 1 conversão — intenção potencialmente informacional; validar qualidade do lead antes de qualquer ação.
- `dentista azambuja mais` e `clinica odontologica brusque`: 1 clique e 1 conversão cada, mas com custo por conversão de R$ 5,73 e R$ 6,64.

## 7. Conversões e valor

O resumo de metas exibiu:

- **Grupo 1:** 428 resultados, incluindo 423 contatos e 5 leads de chamada.
- **Grupo 2:** 33 resultados, todos em envio de formulários de lead.
- **Grupo 3:** sem meta medida no momento.

Foram encontradas **20 ações de conversão** em duas páginas. Entre as ações exibidas:

- `Lead Formulário`: 419 todas as conversões, valor 0, status **Requer atenção**.
- `FORM SITE`: 31 conversões, status Ativa, janela de clique de 90 dias, não incluída nas metas da conta.
- `[Lead] [Botão WPP]`: 18 conversões, valor 0, status **Requer atenção**.
- `Calls from ads`: 5 conversões, valor 5,00, sem conversões recentes segundo o status de acompanhamento.
- `Clicks to call`: 7 conversões, valor 7,00.
- `Local actions - Directions`: 107 conversões, hospedada pelo Google, sem conversões recentes.
- `Botão WPP Flutuante`, `Botão Whatsapp`, `[Leads] [Botão Flutuante]` e `Formulário` aparecem como removidas.

O total da tabela de ações de conversão exibido foi **1.365,00 todas as conversões e 928,00 de valor de todas as conversões**. Esses números não devem ser comparados diretamente com as 31 conversões da visualização de campanhas sem confirmar o escopo e as colunas de atribuição.

## 8. Dispositivos e locais

### Dispositivos

| Dispositivo/campanha | Cliques | Impressões | CTR | Custo | Conversões | CPA |
|---|---:|---:|---:|---:|---:|---:|
| Smartphones — ativa | 581 | 12.064 | 4,82% | R$ 1.853,84 | 26 | R$ 71,30 |
| Smartphones — pausada | 167 | 2.648 | 6,31% | R$ 1.022,11 | 3 | R$ 340,70 |
| Computadores — ativa | 50 | 1.423 | 3,51% | R$ 153,89 | 1 | R$ 153,89 |
| Computadores — pausada | 6 | 235 | 2,55% | R$ 39,81 | 1 | R$ 39,81 |
| Tablets | 0 | 0 ou 22 | — ou 0,00% | R$ 0,00 | 0 | — |

### Local

O único local de segmentação exibido foi **Brusque, Santa Catarina, Brasil**, para as duas campanhas. Não foram identificadas exclusões de local ou outros locais na tabela visível.

## 9. Públicos, demografia e transparência

A página de públicos informa explicitamente: **“Você ainda não tem segmentos de público-alvo”**. Portanto, não foram encontrados públicos próprios, remarketing, segmentos personalizados ou associações em observação/segmentação na tabela atual.

Na visão geral, o Google Ads exibiu um resumo demográfico baseado em **82% das impressões com sexo e idade conhecidos**, mas não apresentou valores detalhados utilizáveis na tabela capturada. Não foram inferidos atributos sensíveis.

Performance Max, Display e Vídeo não foram identificadas entre as duas campanhas visíveis; os relatórios específicos desses tipos são, portanto, não aplicáveis à estrutura capturada.

## 10. Tendências e comparativos de período

O período selecionado na interface foi **28/02/2024–03/10/2026**. A série temporal foi exibida mensalmente/ao longo do período, mas os valores diários, semanais e mensais detalhados não foram exportados nesta rodada.

Os comparativos solicitados de **últimos 30 dias vs. 30 anteriores, 90 vs. 90, 365 vs. 365 e ano a ano** não foram gerados em arquivos separados nesta extração. Eles devem ser tratados como **não extraídos**, e não como zero ou sem dados. Os arquivos entregues preservam o período integral efetivamente exibido.

## 11. Recomendações priorizadas — não aplicadas

1. **Alta prioridade — auditar a mensuração de leads.** Validar a configuração e a origem de `Lead Formulário`, `FORM SITE` e `[Lead] [Botão WPP]`, pois há status **Requer atenção**, valores zerados ou inclusão divergente nas metas. Evidência: 419 conversões em `Lead Formulário` com valor 0 e status de atenção; 31 em `FORM SITE` fora das metas da conta.
2. **Alta prioridade — separar conversões de contato de microconversões.** `Local actions - Directions` (107) e ações de clique/rota podem inflar a leitura de resultado se forem comparadas diretamente a leads qualificados. Classificar a qualidade antes de usar CPA/ROAS agregado.
3. **Alta prioridade — revisar a dependência de smartphones.** A campanha ativa obteve 26 de 27 conversões em smartphones no detalhamento exibido. Auditar experiência móvel, velocidade e rastreamento da página de destino.
4. **Média prioridade — investigar a limitação por orçamento.** A campanha ativa está limitada pelo orçamento e o Google Ads sinaliza perda potencial de conversões. Qualquer mudança de orçamento ou lance deve ser decidida pelo responsável, não foi aplicada nesta tarefa.
5. **Média prioridade — revisar palavras-chave pausadas de baixo Índice de qualidade.** `"dentista brusque"` consumiu R$ 927,17 com CPA de R$ 309,06 e índice 3/10; `dentista brusque sc` tem 1/10. Tratar como hipótese de otimização, não como instrução automática.
6. **Média prioridade — classificar termos de pesquisa por intenção.** Consultas de concorrentes e consultas informacionais devem ser comparadas à qualidade real dos leads, não apenas a conversões importadas.
7. **Baixa prioridade — avaliar cobertura de públicos.** Não há segmentos de público associados. Antes de criar qualquer público, validar consentimento, elegibilidade e volume mínimo exigido pelo Google Ads.

## 12. Limitações e arquivos

- Os CSVs foram normalizados a partir das tabelas efetivamente visíveis no My Browser. O Google Ads não disponibilizou o download local do CSV dentro do ambiente de execução; por isso, o material não deve ser confundido com um export oficial completo da API.
- `05_termos_pesquisa_visiveis.csv` é amostra das linhas visíveis: o Google Ads indicou 1.907 linhas no total.
- Não houve dados de públicos associados; isso é uma ausência reportada pela interface, não uma inferência.
- Não foram extraídos comparativos de 30/90/365 dias nem séries diárias, semanais ou mensais detalhadas.
- Os totais da visualização, totais da conta e totais de ações de conversão têm escopos diferentes e foram mantidos separados.
- Nenhuma recomendação foi aplicada e nenhum dado da conta foi compartilhado fora desta entrega.
