# Ferramentas gratuitas para operação de clientes

## Índice

1. Stack mínimo  
2. Escolha e implantação  
3. Segurança e LGPD  
4. Exemplos por porte  
5. Limites

## 1. Stack mínimo

Escolha depois de definir processo, canal, métrica e responsável. Uma planilha bem mantida supera uma pilha sem dono.

| Função | Opção gratuita ou inicial | Use para | Dono | Prazo de implantação | Critério de valor em 30 dias |
| --- | --- | --- | --- | --- | --- |
| briefing/cronograma | Google Sheets/Drive | contexto, plano, SLA, health | PM | 2 dias | todos os marcos têm dono e data |
| Kanban | Trello, Notion, Jira Free, ClickUp Free ou Asana Personal | tarefas, status, WIP | PM | 3 dias | aging e bloqueios são visíveis |
| reunião/ata | Google Meet + Docs | kickoff, weekly e decisões | account lead | 1 dia | ata enviada em 24h |
| painel | Looker Studio + Sheets | KPIs, fontes e filtros | dados | 7 dias | atualização e fontes testadas |
| analytics | GA4 + Search Console | origem, eventos e busca | dados | 7 dias | evento de conversão testado |
| CRM simples | Sheets, Notion ou HubSpot CRM Free | origem, etapa, próxima ação e perda | vendas/cliente | 3 dias | 100% dos leads têm próxima ação |
| atendimento | WhatsApp Business | etiquetas, catálogo e respostas | cliente | 2 dias | resposta e origem registradas |
| pesquisa | Google Forms/Typeform Free | CSAT/NPS e entrevistas | account lead | 1 dia | respostas ligadas a ação |
| criativos | Canva/Photopea/CapCut | peças e versões | especialista | conforme plano | arquivo editável e link final |

## 2. Como decidir

Responda antes de recomendar:

1. Qual decisão a ferramenta muda?
2. Quem vai operar na segunda-feira?
3. Qual o custo real de configurar, manter e treinar?
4. É possível provar valor em 30 dias?
5. Qual é o plano de saída/exportação se o limite mudar?

### Score de adoção simples

Use 0–2 em cada critério e registre a fonte da nota:

| Critério | 0 | 1 | 2 |
| --- | --- | --- | --- |
| clareza de decisão | não muda decisão | muda ocasionalmente | muda decisão semanal |
| dono | ninguém | dono parcial | dono explícito |
| facilidade | equipe não consegue operar | treinamento necessário | rotina simples |
| exportação | sem saída | saída limitada | exportação validada |
| valor em 30 dias | não demonstrável | incerto | teste claro |

**Regra:** adote se score ≥7 `[hipótese operacional]`; abaixo disso, comece com planilha ou não adote.

## 3. Segurança e LGPD

| Prática | Faça | Não faça | Dono |
| --- | --- | --- | --- |
| acesso | use permissões mínimas e gerenciador seguro | envie senha em chat | cliente + PM |
| dados pessoais | registre finalidade e consentimento quando aplicável | exporte base inteira sem necessidade | dados |
| compartilhamento | use pastas com acesso por função | link público com CRM | PM |
| automação | valide entrada, exceção e log | disparo em massa sem opt-in | responsável do canal |
| saída | revogue acesso e cumpra retenção definida | manter cópia indefinidamente | líder |

A atribuição não é verdade única: combine UTMs, CRM e conversões offline; registre janela, consentimento e limitação.

## 4. Exemplos por operação

### Agência pequena, até 10 contas `[exemplo operacional]`

- Drive com pastas padronizadas.
- Sheets para briefing, SLA, health e painel.
- Trello com uma board por operação ou cliente, WIP 3 `[hipótese]`.
- Meet + Docs para weekly.

| Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| criar estrutura de pasta | PM | 1 dia | todas as contas têm template |
| importar backlog | PM | 2 dias | nenhum cartão sem dono/data |
| rodar piloto em duas contas | líder | 30 dias | aging e ata medidos |

### Operação com dados mais maduros `[exemplo]`

- Looker Studio para visualização.
- CRM com origem e próxima ação obrigatória.
- Jira/ClickUp somente se a equipe usar WIP e métricas.

Não adote ferramenta pesada para compensar processo ausente.

## 5. Limites e fontes

Os planos gratuitos de Trello, Notion, Jira, ClickUp, Asana, HubSpot e Meet mudam por data, região e conta. Confirme a página de preços vigente antes da implantação; não escreva limite como fato permanente.

Fontes:

- Dossiê local, seção 4.
- Referência da skill irmã: `growth-marketing-agency/references/ferramentas-gratuitas.md`.
- GA4: https://analytics.google.com/.
- Search Console: https://search.google.com/search-console/.
- Looker Studio: https://lookerstudio.google.com/.
