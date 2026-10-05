# Mensuração, atribuição, otimização e escala

Use este arquivo na análise semanal ou quando alguém pedir diagnóstico de campanha, explicação de custo ou decisão de escala.

## 1. Camadas de verdade

| Camada | Responde | Fonte | Limite |
| --- | --- | --- | --- |
| Plataforma | entrega, leilão, criativo, conversão atribuída | Ads Manager/Google/TikTok/LinkedIn | janela e modelo próprios |
| Analytics | sessão, comportamento, landing, UTM | GA4/Clarity | consentimento, bloqueio e atribuição |
| CRM | qualificação, estágio, SLA, venda | CRM/planilha | disciplina e integração |
| Financeiro | receita líquida, custo, margem, reembolso | ERP/financeiro | fechamento e classificação |
| Incrementalidade | o que aconteceu por causa da mídia | holdout/geo lift/experimento | custo, amostra e desenho |

Reconcilie as quatro primeiras antes de comparar campanhas. Não some ROAS de plataformas como se fosse receita incremental.

## 2. Painel mínimo, no máximo 12 números

1. investimento; 2. leads/conversas; 3. custo por lead; 4. qualificados; 5. custo por qualificado; 6. agendamentos/oportunidades; 7. comparecimento; 8. vendas; 9. custo por venda/CAC pago; 10. receita líquida; 11. margem; 12. payback ou LTV/CAC.

Declare o denominador: CTR = cliques/impressões; CVR = conversões/cliques ou sessões; no-show = faltas/agendamentos; CAC = custo definido/clientes pagantes.

## 3. Diagnóstico por sintoma

| Sintoma | Hipóteses a investigar | Ação de primeiro nível | Decisão |
| --- | --- | --- | --- |
| Impressão baixa | orçamento, lance, audiência, política | auditar entrega e elegibilidade | ajustar antes de criativo |
| CTR baixo | hook, mensagem, busca, placement | testar ângulo e correspondência | manter só se custo final fechar |
| CPC/CPM alto | leilão, relevância, região, saturação | ampliar com controle ou melhorar peça | não subir verba automaticamente |
| Clique sem sessão | página lenta, URL, consentimento | testar celular, redirecionamento e evento | corrigir antes de otimizar |
| Lead barato e ruim | promessa ampla, formulário, público | pergunta qualificadora e oferta | decidir por custo qualificado |
| Lead bom sem venda | SLA, comercial, preço, prova | auditar chamadas e follow-up | não escalar mídia |
| Venda sem margem | desconto, mix, custo variável | revisar oferta e teto de CAC | congelar escala |
| Plataforma > CRM | duplicação, janela, identidade | reconciliação e deduplicação | marcar atribuição incerta |

## 4. Ritual semanal

1. Conferir gasto, pacing, entrega, tracking e discrepâncias.
2. Ler funil completo até venda e margem, segmentado por canal, campanha, oferta, região e coorte.
3. Identificar um gargalo e uma hipótese; não mudar orçamento, público e criativo simultaneamente.
4. Registrar hipótese: “Acreditamos que [mudança] gera [efeito] porque [evidência]”.
5. Definir métrica primária, guarda, dono, data, janela, volume mínimo e critério.
6. Decidir: **venceu** (melhora sem piorar guarda), **perdeu** (reverter), **inconclusivo** (estender ou arquivar).
7. Atualizar painel e comunicar ação da próxima semana.

| Situação | Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- | --- |
| tracking divergente | auditar eventos e CRM | analista/técnico | 48h | discrepância explicada ou escala congelada |
| custo acima do teto | investigar funil e pausar conjunto novo | mídia + vendas | 7 dias | duas leituras acima do teto = corte/ajuste |
| custo dentro e capacidade livre | aumentar gradualmente | mídia + operação | próximo ciclo | custo marginal e margem continuam dentro |
| fadiga | trocar ângulo, não apenas cor | criativo | 7 dias | frequência estabiliza e custo não piora |

Os prazos são padrão operacional; ajuste ao ciclo real e marque a alteração.

## 5. Escala e corte

### Escalar

Só escale se: tracking confiável; evento primário; CRM ligado à venda; capacidade; margem positiva; payback compatível com caixa; coortes recentes não deterioraram; e o custo marginal estiver aceitável. Aumente em degraus graduais, registre data e aguarde o ciclo de conversão antes do próximo degrau.

### Cortar ou congelar

Congele se evento falhar, política for reprovada, atendimento não existir, custo por venda exceder teto por dois ciclos com volume suficiente, qualidade/retensão cair, frequência saturar ou margem virar negativa. Antes de culpar plataforma, revise oferta, landing, SLA e atribuição.

## 6. Incrementalidade prática

| Método | Quando | Passos | Limite |
| --- | --- | --- | --- |
| Holdout de audiência | remarketing/CRM | dividir elegíveis aleatoriamente; medir venda e margem | contaminação e amostra |
| Geo lift | regiões comparáveis | escolher teste/controle; manter oferta; medir diferença | sazonalidade e mobilidade |
| Antes/depois com ressalvas | orçamento pequeno | definir janela, guardar mudanças e coorte | não prova causalidade sozinho |
| Venda offline | ciclo longo | importar oportunidade/ganho por ID | atraso e matching |

Relate: janela, evento, grupo, modelo, limitações e se o resultado é atribuído ou incremental.

## 7. Template de hipótese

> **Hipótese:** trocar o hook “atendimento de qualidade” por “receba diagnóstico e prazo antes de decidir” aumentará a conversão de conversa para oportunidade. **Evidência:** 12 de 20 perdas citaram falta de clareza. **Primária:** oportunidade/venda. **Guarda:** margem e no-show. **Dono:** mídia. **Janela:** próximo ciclo de conversão. **Decisão:** escalar se primária subir sem guarda piorar; caso contrário, reverter ou formular novo teste.

## Fontes e limites

Base: dossiê `trafego-pago-dossie.md`, seções 2.6 e 3; fórmulas e benchmark em `benchmarks-e-formulas.md`. Volume mínimo nunca é universal: sem amostra suficiente, declare inconclusivo.
