# Playbooks de plataformas de tráfego pago

Use somente o bloco da plataforma pedida. Comece com uma campanha que reúna sinal; evite pulverizar orçamento em estruturas que não atingem o volume de decisão.

## 1. Matriz de escolha

| Situação | Motor | Evento recomendado | Risco | Primeiro teste |
| --- | --- | --- | --- | --- |
| Busca explícita por serviço | Google Search | lead qualificado/venda | CPC e concorrência altos | tema + landing específica |
| Demanda latente, visual ou local | Meta | venda, conversa qualificada ou agendamento | lead barato/desqualificado | 3 ângulos + público amplo |
| Inventário Google com conversão confiável | PMax | compra/venda com valor | pouca transparência e aprendizagem | 1 asset group por oferta |
| Vídeo e descoberta | YouTube | ação mensurável + alcance | view-through superestimada | ABCD + remarketing |
| Conteúdo nativo curto | TikTok | lead/purchase validado | VTA e fadiga | creator + hook nativo |
| B2B por conta/cargo | LinkedIn | oportunidade/pipeline | audiência cara/pequena | lista de contas + prova |

Escolha um motor principal e no máximo dois apoios; o critério é custo por cliente e margem, não facilidade de configurar.

## 2. Google Search

### Implantação

1. Extraia termos do Keyword Planner, Search Console, chamadas e CRM; marque intenção e região.
2. Separe marca, serviço de alta intenção e descoberta; crie campanhas por tema e geografia.
3. Comece com poucos grupos coerentes e negativas como “grátis”, “emprego”, “curso” ou “segunda mão” quando irrelevantes.
4. Escreva ao menos três anúncios por grupo; alinhe termo, promessa, prova, diferenciais e CTA.
5. Envie cada grupo para landing correspondente; inclua telefone, WhatsApp ou agenda rastreáveis.
6. Configure conversões primárias, valores e importação de venda/oportunidade offline.
7. Nos primeiros 7 dias, revise termos, negativas, localização, horário, dispositivo e chamadas.
8. Após 14–30 dias, redistribua por custo por oportunidade/venda, não CTR.

| Elemento | Exemplo | Dono/prazo | Critério |
| --- | --- | --- | --- |
| Campanha | `SP_Search_Implante_NaoMarca` | mídia, D+2 | uma intenção e região por campanha |
| Negativa | `gratis`, `curso`, `emprego` | mídia, D+3 | zero consultas claramente irrelevantes após revisão semanal |
| Landing | `/implante-campinas` | web, D+5 | correspondência da promessa e evento validado |
| Conversão | `qualified_lead` + venda offline | analista, D+7 | CRM recebe origem e valor |

**Decisão:** manter se custo por venda e qualidade ficarem dentro do teto por dois ciclos; ajustar termos/landing primeiro; pausar se exceder teto por dois ciclos com volume suficiente ou se não houver atendimento.

## 3. Meta Ads (Instagram/Facebook)

### Estrutura inicial

1. Defina uma oferta e um evento: compra, lead qualificado, mensagem ou ligação.
2. Crie aquisição ampla ou com poucos sinais úteis e um remarketing com janelas/exclusões claras.
3. Produza cinco ângulos: demonstração, depoimento, problema, comparação honesta e oferta; adapte para 9:16 e 1:1.
4. Use legenda legível sem som; inclua CTA único e parâmetros de URL no anúncio.
5. Use pergunta qualificadora em formulário/conversa: região, necessidade, prazo ou orçamento.
6. Exclua compradores/leads convertidos da aquisição; limite janela e frequência no remarketing.
7. Deixe acumular sinais; troque ângulo antes de multiplicar públicos.

| Ângulo | Hook exemplo | Prova | CTA | Dono/prazo |
| --- | --- | --- | --- | --- |
| Problema | “A dor aparece sempre no fim do dia?” | pergunta real do CRM | agendar triagem | criativo, D+3 |
| Demonstração | “Veja como avaliamos em 3 passos” | vídeo próprio | ver disponibilidade | criativo, D+3 |
| Prova | “O que mudou após o atendimento” | depoimento autorizado | conversar | cliente, D+5 |
| Comparação | “O que muda entre A e B?” | quadro factual | receber orientação | copy, D+5 |
| Oferta | “Avaliação com plano e condição clara” | preço/escopo | escolher horário | mídia, D+5 |

**Decisão:** avaliar CTR e retenção como diagnóstico; manter/realocar por custo por lead qualificado, agendamento, venda e margem. CPL baixo sem venda é sinal de qualificação/oferta, não de vitória.

## 4. PMax e YouTube

**PMax:** confirme conversões primárias e valores; remova microeventos como objetivo principal. Organize asset groups por linha/oferta. Forneça, como referência oficial do dossiê, 15 headlines, 5 descrições, 7 imagens (3 paisagem, 3 quadradas, 1 retrato) e ao menos um vídeo por grupo. Evite mudanças frequentes: a recomendação oficial é observar nova campanha por pelo menos seis semanas e, após mudança importante, 1–2 semanas ou um ciclo de conversão.

**YouTube:** use ABCD — Attention (tensão/demonstração imediata), Branding (marca cedo), Connection (público e ideia humana) e Direction (CTA claro). Combine alcance com landing, UTMs e remarketing; separe clique, view-through e venda incremental.

| Checagem | Como fazer | Decisão |
| --- | --- | --- |
| Conversão | compra/oportunidade com valor, teste real | sem evento confiável, não lançar |
| Ativos | cobertura de formatos e mensagem por oferta | lacuna vira tarefa do criativo, não motivo para inventar claim |
| Aprendizagem | registrar cada alteração e ciclo de conversão | não alterar antes da janela salvo risco |
| Incrementalidade | comparar CRM, coorte e, se possível, holdout | atribuição da plataforma não é causalidade |

## 5. TikTok Ads

1. Defina awareness, consideration ou conversion; não misture eventos de valor diferente.
2. Estruture campaign → ad group → ad; instale Pixel e, quando viável, Events API.
3. Valide `ViewContent`, `AddToCart` e `Purchase`/`Lead`, incluindo deduplicação.
4. Crie vídeo nativo: primeira frase forte, creator/pessoa real, prova em uso, legendas e CTA.
5. Leia CTA e VTA separadamente; declare janela de atribuição no painel.
6. Teste hook, roteiro e edição; não apenas cor ou público.

| Hipótese | Métrica primária | Guarda | Prazo | Dono |
| --- | --- | --- | --- | --- |
| creator real aumenta qualificação | custo por lead qualificado | taxa de rejeição | 7–14 dias | criativo |
| hook de problema reduz CPC | custo por venda | margem | ciclo completo | mídia |

## 6. LinkedIn Ads e B2B

1. Defina ICP, lista de contas, cargos, senioridade e setor; evite audiência pequena demais.
2. Escolha Sponsored Content, Message, Dynamic ou Text conforme intenção e etapa.
3. Instale Insight Tag, conversões e importação de estágios do CRM; combine tag/API quando possível.
4. Ofereça diagnóstico, prova técnica ou caso comparável; não use formulário sem critério.
5. Exclua leads em negociação e leia oportunidade, pipeline e receita por conta.
6. Faça sincronização semanal entre marketing e vendas; registre motivo de perda e tempo de resposta.

| Nível | Mensagem | Evento | Critério |
| --- | --- | --- | --- |
| 1:many | dor por setor | conteúdo/visita | engajamento de contas-alvo |
| 1:few | prova por cluster | lead qualificado | reuniões por conta |
| 1:1 | hipótese de conta | oportunidade | pipeline e margem |

## 7. Regras de estrutura, naming e orçamento

Naming: `OBJETIVO_PÚBLICO_OFERTA_REGIÃO_DATA`; conjunto/grupo: `INTENÇÃO_JANELA_EXCLUSÃO`; anúncio: `ÂNGULO_FORMATO_VERSÃO`. Mantenha uma planilha de alterações.

Comece com orçamento que gere dados sem exceder o “máximo para perder” aprovado. O número é decisão do cliente, não benchmark. Aumente em degraus graduais somente quando tracking, capacidade, margem e custo por venda estiverem estáveis; reavalie o custo marginal depois de cada aumento.

## Fontes e limites

Base: dossiê `trafego-pago-dossie.md`, seções 1–3, com documentação oficial Meta, Google Ads, TikTok e LinkedIn indicada nele. Benchmarks e recomendações de volume devem ser tratados como referências, não garantias.
