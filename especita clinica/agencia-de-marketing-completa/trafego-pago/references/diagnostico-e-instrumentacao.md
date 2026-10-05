# Diagnóstico e instrumentação de mídia paga

Use esta referência antes de escolher plataforma, verba ou objetivo. A pergunta central é: **qual venda ou margem a mídia precisa produzir e como provaremos a origem?**

## 1. Entrada mínima e classificação

| Campo | Pergunta | Evidência aceitável | Rótulo |
| --- | --- | --- | --- |
| Objetivo | Quantas vendas, oportunidades ou agendamentos até quando? | meta aprovada | Meta |
| Oferta | O que é comprado, por quem, com qual condição? | página, preço, contrato | Medido/hipótese |
| Economia | ticket, custos variáveis, margem, retenção | financeiro/ERP/CRM | Medido |
| Demanda | onde o cliente busca e qual a urgência? | buscas, entrevistas, chamadas | Medido/hipótese |
| Capacidade | quantos pedidos/leads o time consegue atender? | agenda, estoque, SLA | Medido |
| Histórico | gasto, conversões, vendas por canal | exportação da conta + CRM | Medido |
| Consentimento | finalidade, base legal, opt-out e retenção | política/registro | Medido |

Se o campo estiver vazio, escreva **hipótese**, atribua dono e prazo para confirmar; não preencha com “média de mercado”.

## 2. Diagnóstico em cinco passos

1. **Desenhe a economia:** `margem = receita - custos variáveis`; calcule teto de CAC com margem e retenção conservadoras.
2. **Desenhe o funil:** impressão → clique → sessão/conversa → lead → qualificado → oportunidade/agendamento → comparecimento → venda → margem.
3. **Ache os vazamentos:** compare volume e taxa por etapa; marque os três maiores em valor perdido, não apenas em percentual.
4. **Cheque capacidade:** projete leads e vendas do teste; se exceder estoque, agenda ou atendimento, ajuste verba/oferta antes de publicar.
5. **Defina o primeiro entregável:** se não há origem ligada à venda, o entregável é rastreio + CRM, não campanha.

### Exemplo de leitura

| Etapa | Volume mensal | Taxa de passagem | Diagnóstico | Dono/prazo/critério |
| --- | ---: | ---: | --- | --- |
| Conversas | 200 | — | dado medido | mídia, semanal |
| Qualificados | 70 | 35% | qualificação fraca ou público amplo | comercial, 7 dias; subir para 45% sem reduzir vendas |
| Agendados | 42 | 60% | aceitável, mas confirmar SLA | atendimento, 7 dias; resposta ≤1h |
| Compareceram | 25 | 60% | no-show é vazamento principal | atendimento, 14 dias; reduzir em 20% contra baseline |
| Vendas | 8 | 32% | medir margem por venda | vendas, 30 dias; custo por venda abaixo do teto |

## 3. Dicionário de eventos

| Evento | Quando dispara | Parâmetros mínimos | Primário? |
| --- | --- | --- | --- |
| `page_view` | página carregada | URL, consentimento | não |
| `view_content` | oferta vista | produto/serviço, valor | não |
| `lead` | formulário validado ou conversa iniciada | ID, origem, campanha, consentimento | depende |
| `qualified_lead` | critérios de dor, região, prazo e escopo atendidos | status, motivo | sim em venda consultiva |
| `schedule` | horário confirmado | data, serviço, origem | apoio |
| `show` | comparecimento/pedido entregue | valor, data | sim para agenda |
| `purchase` | pagamento aprovado | valor, moeda, pedido | sim |
| `opportunity_won` | CRM confirma venda | valor líquido, margem, canal | sim |
| `refund/cancel` | devolução/cancelamento | valor, motivo, coorte | guarda |

**Regra:** envie somente dados necessários; não envie telefone/e-mail em texto cru para tags. Quando houver identificador, aplique hash e configuração permitida pela plataforma, com consentimento e revisão jurídica.

## 4. UTM e identificação

Use minúsculas, sem acentos e sem espaços. Padrão recomendado:

`utm_source=meta|google|tiktok|linkedin`
`utm_medium=paid_social|cpc|video|paid_search`
`utm_campaign=objetivo_publico_oferta`
`utm_content=angulo_formato_variacao`
`utm_term=termo_busca` (apenas quando aplicável)

| Exemplo | URL |
| --- | --- |
| Search | `?utm_source=google&utm_medium=paid_search&utm_campaign=leads_implante_campinas&utm_content=anuncio_a&utm_term=implante` |
| Meta | `?utm_source=meta&utm_medium=paid_social&utm_campaign=leads_urgencia_campinas&utm_content=prova_reels_v1` |

Guarde UTMs no primeiro contato do CRM e associe a `click_id`/ID de anúncio quando disponível. Não use `Facebook`, `fb`, `Meta` e `instagram` como fontes concorrentes.

## 5. Checklist de teste técnico

1. Gere uma visita de teste em celular e desktop.
2. Verifique consentimento antes de tags não essenciais.
3. Valide disparo uma única vez para cada evento; compare navegador, servidor e CRM.
4. Confirme valor, moeda, produto, pedido e janela de atribuição.
5. Envie lead de teste e confira UTM, responsável, próxima ação e prazo no CRM.
6. Faça uma compra/agendamento de teste quando possível; confirme evento offline.
7. Teste telefone, WhatsApp, formulário, agenda, página de obrigado e links.
8. Documente data, navegador, evidência e quem aprovou.

**Critério de publicação:** não publicar se evento primário duplicar, URL quebrar, consentimento faltar, lead não entrar no CRM ou ninguém estiver designado para responder.

## 6. Plano de ação de fundação

| Ação | Dono | Prazo | Critério de decisão |
| --- | --- | --- | --- |
| Definir evento primário e microeventos | estrategista + dono do negócio | D+1 | evento representa receita e tem definição escrita |
| Criar dicionário e nomenclatura | analista | D+3 | 100% dos eventos têm fonte e dono |
| Implementar tags/Pixel/GA4 | técnico | D+7 | teste passa em dois dispositivos |
| Capturar UTM e origem no CRM | vendas | D+7 | 100% dos novos leads têm origem ou motivo “desconhecida” |
| Auditar primeira venda | financeiro + analista | D+14 | CRM reconcilia com receita em ≥95% da amostra; se não, pausar escala |

95% é um **critério operacional proposto**, não benchmark; ajuste ao risco do negócio.

## Fontes e limites

Base: dossiê `trafego-pago-dossie.md`, seção 2.1; documentação de parâmetros Meta, Google Ads, TikTok Pixel e LinkedIn Conversions citada no dossiê. Políticas, consentimento e campos permitidos mudam; confira documentação vigente antes de implementação.
