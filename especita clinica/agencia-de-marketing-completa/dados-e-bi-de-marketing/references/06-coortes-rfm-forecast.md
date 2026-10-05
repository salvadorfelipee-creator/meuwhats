# Coortes, RFM e forecast de marketing

Use para olhar valor ao longo do tempo, não apenas a conversão do dia. A decisão deve privilegiar coortes que retêm e geram margem, não o canal com mais leads imediatos.

## 1. Cohort de aquisição/ativação

Defina a safra pela primeira compra ou ativação, mês de entrada, canal, campanha, oferta, região e perfil. Não misture novos clientes com recorrentes.

| Cohort | M0 clientes | M1 ativos | M2 ativos | Retenção M1 | Receita acumulada | Margem acumulada | CAC |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-01 / Search | 100 | 55 | 40 | 55% | R$ 80.000 | R$ 28.000 | R$ 300 |
| 2026-01 / Meta | 100 | 35 | 20 | 35% | R$ 65.000 | R$ 20.000 | R$ 260 |

Números são exemplo `[hipótese]`; use dados aprovados para decisão.

**Fórmulas:**
- Retenção Mx = clientes ativos da safra em Mx ÷ clientes da safra em M0.
- Receita acumulada = soma líquida de pedidos da safra até Mx.
- Margem acumulada = receita líquida − custos variáveis e cancelamentos.
- Payback da coorte = primeiro Mx em que margem acumulada ≥ CAC total da safra.

**Passos:**
1. Limpe cancelamentos, estornos, duplicidades e clientes sem chave.
2. Defina data de corte e timezone.
3. Identifique primeiro pedido/ativação e atribuição da coorte com regra fixa.
4. Calcule M0–M12 e separe cliente, receita, margem e churn.
5. Compare por canal/campanha/oferta apenas se mudar decisão.
6. Liste coortes com melhor margem e pior retenção; investigue causas.
7. Mude orçamento ou lifecycle só após janela compatível com ciclo de recompra.

## 2. RFM para retenção e reativação

Calcule na janela definida e prefira margem no valor monetário quando disponível.

| Dimensão | Cálculo | Direção boa | Exemplo |
|---|---|---|---|
| Recência (R) | dias desde última compra | menor | 12 dias |
| Frequência (F) | compras válidas no período | maior | 5 |
| Monetary (M) | receita ou margem acumulada | maior | R$ 2.400 |

Pontue cada dimensão em quintis **dentro da própria base**; não compare pontuação entre empresas.

| Segmento | Sinal RFM | Ação | Canal | Controle | Critério |
|---|---|---|---|---|---|
| VIP | R alta, F alta, M alta | benefício e pedido de indicação | CRM/WhatsApp opt-in | 10% holdout `[hipótese]` | margem incremental |
| Leal | R alta, F média/alta | cross-sell/recorrência | e-mail/CRM | grupo sem oferta | recompra líquida |
| Novo | R alta, F baixa | onboarding e segunda compra | e-mail/WhatsApp | controle | taxa de 2ª compra |
| Em risco | R baixa, histórico bom | win-back contextual | CRM | controle | reativação e descadastro |
| Inativo | R muito baixa | oferta de saída ou pesquisa | CRM | controle | margem > custo da ação |

**Passos:** exporte pedidos sem CPF/e-mail no painel; deduplique; remova estornos; escolha corte; calcule R/F/M; nomeie segmentos; aplique oferta; meça recompra incremental, margem e descadastro; mantenha só ações que melhoram resultado líquido.

## 3. Forecast de funil e caixa

| Campo | Conservador | Base | Agressivo | Status |
|---|---:|---:|---:|---|
| Investimento/mês | R$ 5.000 | R$ 8.000 | R$ 12.000 | informado/meta |
| Leads | 150 | 250 | 340 | medido/estimado |
| Conversão lead→venda | 5% | 8% | 10% | baseline/hipótese |
| Ticket | R$ 500 | R$ 550 | R$ 600 | medido/hipótese |
| Margem | 35% | 40% | 42% | financeiro |
| Cancelamento | 10% | 7% | 5% | hipótese |

**Passos:**
1. Extraia CRM/ERP: clientes novos, recorrentes, perdidos, receita, margem, CAC e capacidade.
2. Modele por semana/mês: tráfego → leads → oportunidades → vendas aprovadas → receita líquida.
3. Varie somente premissas declaradas: volume, conversão, ticket, churn, CAC e atraso.
4. Compare realizado vs previsto; registre erro e causa, sem reescrever o passado.
5. Reestime capacidade, atendimento e caixa antes de aumentar tráfego.
6. Defina gatilho de escala e gatilho de contenção por cenário.

## 4. Exemplo de decisão com controle

> **Ação:** reativar segmento “em risco”. **Dono:** CRM. **Prazo:** lançar em 7 dias e ler em 30 dias. **Hipótese:** uma mensagem contextual aumenta a recompra porque a queda de recência concentra 40% da receita histórica `[hipótese até calcular]`. **Métrica primária:** margem incremental por contato. **Guarda:** descadastro e reclamações. **Critério:** manter somente se margem incremental superar custo da operação e o grupo controle não mostrar o mesmo efeito.

## 5. Limitações

- Cohort muda com janela, definição de primeira compra, cancelamento, canal e atribuição.
- RFM segmenta comportamento passado; não prova propensão futura.
- Forecast não é promessa; atualize ao menos mensalmente ou quando houver quebra de premissa.
- Sem chave de cliente/pedido confiável, entregue a lacuna e priorize instrumentação.
