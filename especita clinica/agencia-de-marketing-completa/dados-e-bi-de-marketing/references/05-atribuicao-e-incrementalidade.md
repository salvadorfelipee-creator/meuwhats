# Atribuição e incrementalidade

Use quando a pergunta for "qual canal vendeu?", "quanto crédito dar a cada touchpoint?" ou "onde colocar orçamento?". Primeiro explique o que foi observado; depois estime o que foi causado.

## 1. Conceitos que não podem ser misturados

| Conceito | O que responde | Limitação | Uso correto |
|---|---|---|---|
| Atribuição de plataforma | quem a plataforma credita | autocentrada, janela própria | otimização interna |
| Atribuição analítica | como distribuir crédito observado | depende de identificabilidade | leitura comparativa |
| Venda financeira | o que foi aprovado/liquidado | pode perder origem | fonte de receita |
| Incrementalidade | o que não ocorreria sem a ação | requer contrafactual | orçamento e causalidade |

Frase operacional: **atribuição distribui crédito observado; incrementalidade estima efeito causal**. Fonte conceitual: [Avinash Kaushik](https://www.kaushik.net/avinash/marketing-analytics-attribution-is-not-incrementality/).

## 2. Fixe a definição antes de comparar

| Campo | Exemplo | Decisão se faltar |
|---|---|---|
| Conversão | venda aprovada, não lead | não comparar CPA de lead com CAC |
| Janela | 7 dias clique, 1 dia visualização | separar por janela |
| Fuso | America/Sao_Paulo | converter timestamps |
| Status | aprovado líquido de cancelamento | excluir/ajustar estornos |
| Modelo | last non-direct, data-driven, first touch | mostrar lado a lado |
| Escopo | branded vs non-branded | separar demanda existente |
| Duplicidade | `order_id` único | desduplicar antes de somar |

O dossiê registra janelas Meta de referência de 1 ou 7 dias de clique, 1 dia de visualização e 1 dia de engajamento conforme documentação da Meta; confirme a configuração atual da conta antes de usar.

## 3. Pacote mínimo de leitura

1. Extraia plataforma por campanha, conversão e janela.
2. Extraia GA4 por sessão/evento e modelo configurado.
3. Extraia CRM/financeiro por `lead_id`, `order_id`, status, margem e data.
4. Alinhe moeda, timezone, filtros e períodos.
5. Remova duplicidades e marque origem desconhecida.
6. Compare last non-direct, data-driven quando elegível e caminho completo.
7. Mostre sobreposição, direto, marca e não atribuído; não apague o papel do direto.
8. Calcule CAC e margem por fonte quando a chave permitir.
9. Relate intervalos, atraso, consentimento, modelagem e o que não se pode concluir.

A documentação Google Ads cita como referência para maior precisão do data-driven pelo menos 200 conversões e 2.000 interações em 30 dias em redes suportadas; trate como critério da plataforma, não como limiar universal. Fonte: [Google Ads](https://support.google.com/google-ads/answer/6394265?hl=en).

## 4. Tabela de reconciliação

| Canal | Plataforma | GA4 | CRM | Financeiro | Diferença explicada | Decisão |
|---|---:|---:|---:|---:|---|---|
| Search non-brand | 50 `[medido]` | 43 `[medido]` | 35 `[medido]` | 30 `[medido]` | janela, perda de origem, cancelamento | validar antes de escalar |
| Meta | 80 `[medido]` | 41 `[medido]` | 28 `[medido]` | 24 `[medido]` | atribuição da plataforma mais ampla | medir CAC financeiro |

Os números são exemplo e devem ser marcados `[hipótese]` quando usados fora de teste.

## 5. Escolha do teste incremental

| Contexto | Desenho | Unidade | Métrica primária | Guarda |
|---|---|---|---|---|
| Regiões suficientes | geo holdout | região pareada | vendas/margem incremental | atendimento/brand search |
| Audiências grandes | holdout aleatório | usuário elegível | conversão incremental | custo por venda |
| Plataforma com recurso | teste de conversão | audiência/conta | lift estimado | qualidade e cancelamento |
| Offline/pequeno | série temporal com controle | semana/região | diferença ajustada | sazonalidade |

**Passos:**
1. Defina hipótese: `Acreditamos que desligar/ativar X altera Y porque Z`.
2. Fixe população, período, unidade, tratamento, controle, orçamento e regra de parada.
3. Escolha métrica primária de negócio: venda aprovada ou margem; defina métricas de guarda.
4. Evite contaminar o controle, mudanças simultâneas e análise após escolher o resultado.
5. Estime duração e poder com analista/estatístico; não invente um limiar universal.
6. Faça QA de atribuição e atraso antes de ler.
7. Reporte efeito, intervalo/uncertainty, custo, limitações e decisão.
8. Escale somente se a margem incremental suportar o CAC incremental e a operação tiver capacidade.

## 6. Modelo de decisão

> **Ação:** manter/elevar Search non-brand. **Dono:** gerente de mídia. **Prazo:** após 30 dias de venda e retenção mínima observada. **Critério:** margem incremental positiva e CAC financeiro abaixo do teto definido pela margem; se houver apenas ROAS de plataforma, manter como hipótese e não escalar automaticamente.

## 7. Anti-padrões

- Somar conversões de Meta, Google e GA4.
- Comparar 7-day click de uma plataforma com last non-direct de outra sem declarar janelas.
- Chamar ROAS atribuído de venda incremental.
- Concluir causalidade de antes/depois sem controle.
- Remover direto/branded sem investigar demanda e assistência.
- Escolher modelo que confirma a opinião do time.
