# Ferramentas gratuitas para dados e BI de marketing

Use para propor uma stack inicial sem custo de licença. **Confirme limites e políticas atuais no produto antes de recomendar**; custo de operação, configuração e privacidade continua existindo.

## 1. Stack mínimo por função

| Função | Opção gratuita | Entrega | Limite/cuidado | Dono e prova em 30 dias |
|---|---|---|---|---|
| Analytics | Google Analytics 4 | eventos, aquisição, jornadas | retenção/exportação e limites variam | analista; 10 eventos validados |
| Tags | Google Tag Manager | tags, triggers, variáveis, versões | governança e QA são do time | analytics; release sem crítica |
| Busca | Search Console | consultas, cliques, indexação | não substitui GA4 | SEO; 3 páginas/termos acionáveis |
| Dashboard | Looker Studio | painel conectado a fontes | conectores/performance podem limitar | BI; painel com 12 KPIs |
| Dicionário/UTM | Google Sheets | governança, links, QA simples | volume e acesso | BI; 95% de links válidos `[hipótese]` |
| Warehouse/análise | BigQuery sandbox/export GA4 | SQL e dados brutos | quotas, retenção e custos ao sair do sandbox | dados; consulta reproduzível |
| UX | Microsoft Clarity | gravações e heatmaps | mascarar PII e respeitar consentimento | produto; 3 hipóteses testáveis |
| CRM leve | Sheets/Notion/CRM gratuito | origem, etapas, perdas | limites variam por usuários/contatos | vendas; 100% com próxima ação `[hipótese]` |
| Atendimento | WhatsApp Business | catálogo, etiquetas, respostas | opt-in, bloqueio e privacidade | comercial; SLA medido |
| Pesquisa | Google Forms | satisfação e motivos | proteger resposta e acesso | CS; 20 respostas válidas `[hipótese]` |
| Planilha/QA | Python padrão + CSV | cálculo e checagem | não substituir warehouse em escala | analista; relatório reproduzível |

## 2. Como escolher

Responda antes de instalar:

1. Qual decisão muda?
2. Quem opera na segunda-feira?
3. Qual é o custo de configuração, manutenção, acesso e exportação?
4. Qual latência é necessária?
5. Dá para provar valor em 30 dias?
6. Como serão consentimento, minimização, backup e rollback?

Se a resposta para a primeira pergunta for “nenhuma”, não adote a ferramenta.

## 3. Arquiteturas por maturidade

| Maturidade | Arquitetura | Quando usar | Primeiro risco |
|---|---|---|---|
| Inicial | GA4 + GTM + Sheets + CRM | poucos canais e baixa complexidade | planilha sem dono |
| Operacional | fontes → Sheets/BigQuery → Looker Studio | várias campanhas e CRM | definições divergentes |
| Escala | warehouse + ETL + BI governado | volume, histórico, offline e múltiplos países | custo e qualidade de pipeline |

**Passos de adoção:**
1. Defina decisão e dicionário.
2. Use a menor arquitetura que responda à decisão.
3. Configure fonte de verdade e acesso mínimo.
4. Faça teste de qualidade e latência.
5. Publique painel técnico antes do executivo.
6. Meça uso: decisões tomadas, não somente logins.
7. Migre apenas quando volume, governança ou SLA justificar.

## 4. Ferramentas por tarefa

| Tarefa | Stack inicial | Critério de troca |
|---|---|---|
| UTM e vocabulário | Sheets + validação de dados | erros persistentes ou controle de acesso insuficiente |
| Funil semanal | CSV/Sheets + `validar_painel.py` | volume/latência exigirem banco |
| Cohort/RFM | export CSV + `calculadora_bi.py` | atualização recorrente e muitas linhas |
| Dashboard | Looker Studio | consultas lentas, governança/linha incompatível |
| SQL | BigQuery sandbox | quotas/custo precisam de aprovação |
| Eventos | GTM + DebugView | complexidade exigir SDK/backend |

## 5. O que não fazer

- instalar uma ferramenta para substituir decisão;
- prometer que plano gratuito é ilimitado;
- colocar PII em Sheets, URLs, eventos ou dashboards compartilhados;
- criar automação antes de validar entrada, exceções e logs;
- usar plataforma de anúncios como única fonte de vendas;
- exportar uma base sem definir acesso, retenção e descarte.

## Fontes do dossiê

A lista foi consolidada a partir de `/home/ubuntu/pesquisa/dados-e-bi-de-marketing-dossie.md`, incluindo GA4, GTM, Search Console, Looker Studio, Sheets, BigQuery sandbox, Clarity, Matomo, CRM e plataformas de mídia. Limites e preços mudam: confirme na conta e nos sites oficiais antes de afirmar disponibilidade.
