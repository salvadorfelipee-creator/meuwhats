# Ferramentas gratuitas para operação de mídia paga

Use a ferramenta depois de definir canal, oferta e métrica. Planos gratuitos mudam; confirme limite e política no site antes de recomendar. A mídia em si continua sendo custo.

## 1. Stack mínimo

| Função | Ferramenta | Uso | Limite/risco | Dono/prazo |
| --- | --- | --- | --- | --- |
| Analytics | Google Analytics 4 | sessões, eventos, UTMs | não é CRM/verdade financeira | analista, D+7 |
| Tags | Google Tag Manager | publicar tags e triggers | duplicação sem governança | técnico, D+7 |
| Busca | Keyword Planner + Search Console | intenção, termos e negativas | volume é estimativa | mídia, D+3 |
| Dashboard | Looker Studio | painel conectado | conectores/histórico variam | analista, D+14 |
| CRM | Google Sheets/Notion ou CRM free | origem, etapa, perda, receita | disciplina e acesso | vendas, D+7 |
| Criativo | Canva/Photopea | imagens e layouts | não substitui prova real | criativo, D+5 |
| Vídeo | CapCut/DaVinci/Clipchamp | cortes, legendas, formatos | direitos e marca d’água | criativo, D+7 |
| UX | Microsoft Clarity | sessões e mapas de calor | não recebe dados sensíveis | web, D+10 |
| Transparência | Meta Ad Library/Google Ads Transparency | ofertas e formatos concorrentes | não mostra gasto/conversão completo | mídia, D+3 |
| Conversa | WhatsApp Business | catálogo, etiquetas, respostas | opt-in e bloqueio | atendimento, D+2 |

## 2. Como usar antes de gastar

1. Keyword Planner + Search Console: liste temas, localidades e negativas; compare com chamadas reais.
2. Ad Library/Transparency: registre promessa, formato, prova e CTA de concorrentes; não copie texto nem conclua performance.
3. GA4/GTM: documente eventos, teste consentimento, dispara uma vez e valide no modo debug.
4. Planilha/CRM: crie campos de origem, campanha, etapa, próxima ação, motivo de perda, valor e margem.
5. Looker Studio: mostre no máximo 12 números, com data de atualização e fonte.
6. Clarity: use gravações para hipóteses de UX; não declare causalidade por mapa de calor.

## 3. Escolha por decisão

| Pergunta | Se sim | Se não |
| --- | --- | --- |
| Qual decisão a ferramenta muda? | adote com dono | não instalar |
| Quem opera na segunda-feira? | atribua rotina | comece por planilha |
| Limite gratuito cobre a janela? | documente limite | compare custo ou alternativa |
| Dá para provar valor em 30 dias? | defina evento | reduza escopo |
| Há consentimento e acesso mínimo? | registre | não coletar |

## 4. Planilha mínima

Abas recomendadas: `dicionario_eventos`, `utm`, `crm`, `painel`, `experimentos`, `alteracoes`, `fontes`. Proteja campos pessoais, limite acesso e use IDs internos. Campos mínimos de CRM: data, nome/ID, canal, campanha, serviço, etapa, responsável, próxima ação/data, valor, venda, margem, motivo de perda e consentimento.

## 5. Plano de implantação

| Ação | Dono | Prazo | Critério |
| --- | --- | --- | --- |
| escolher stack mínimo | dono + analista | D+1 | cada ferramenta ligada a uma decisão |
| implementar GA4/GTM e UTMs | técnico | D+7 | eventos passam em celular/desktop |
| criar CRM/painel | vendas + analista | D+7 | 100% dos leads novos têm origem ou exceção |
| auditar limites e acesso | responsável LGPD | D+10 | acesso mínimo e retenção documentada |
| revisar valor | dono | D+30 | ferramenta muda decisão; senão remover |

## Fontes e limites

Base: dossiê `trafego-pago-dossie.md`, seção 4, e `growth-marketing-agency/references/ferramentas-gratuitas.md`. Limites e nomes de funcionalidades podem mudar; confirme no site oficial.
