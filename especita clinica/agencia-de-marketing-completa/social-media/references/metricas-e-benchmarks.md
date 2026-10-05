# Métricas, atribuição e benchmarks de social media

Use para responder “funcionou?” sem confundir alcance com negócio. Toda tabela deve distinguir **[MEDIDO]** (fonte e período), **[META]** (alvo escolhido) e **[HIPÓTESE]** (ainda não verificada).

## 1. Dicionário de métricas

| Métrica | Fórmula | Leitura | Cuidado |
| --- | --- | --- | --- |
| Retenção | tempo médio assistido ÷ duração × 100 | permanência média | duração e definição variam por rede |
| Conclusão | views até o fim ÷ views iniciadas × 100 | história sustentou o vídeo | use mesma definição e janela |
| Share rate | compartilhamentos ÷ alcance × 100 | valor/distribuição | compare por formato |
| Save rate | salvamentos ÷ alcance × 100 | utilidade/intenção futura | não equivale a venda |
| Engajamento por alcance | (curtidas + comentários + saves + shares) ÷ alcance × 100 | reação relativa | alcance pode ter origem diferente |
| CTR | cliques ÷ impressões × 100 | resposta ao destino | não prova qualidade do lead |
| Conversão | vendas ou leads qualificados ÷ cliques/conversas × 100 | passagem para valor | defina evento e janela |
| Custo por conversa | gasto social atribuído ÷ conversas qualificadas | eficiência de conversa | inclua produção/creator quando fizer sentido |
| CAC social | (mídia + produção + creators + custo variável) ÷ clientes atribuídos | economia real | atribuição pode ser assistida |
| K-factor | convites médios por cliente × conversão dos convidados | loop de indicação | K>1 não garante retenção |
| Resposta | respostas dentro da janela ÷ mensagens recebidas | operação de comunidade | nunca prometa SLA que não existe |

## 2. Painel mínimo (até 12 números)

Use `templates/painel-social-semanal.csv` e mantenha uma linha por canal ou campanha, com período e fonte.

| Grupo | Indicadores recomendados |
| --- | --- |
| Distribuição | alcance qualificado, impressões/views |
| Qualidade | retenção ou conclusão, share rate, save rate |
| Ação | visitas, CTR, conversas qualificadas |
| Negócio | leads, vendas, receita/margem atribuída |
| Eficiência | custo por conversa, CAC social |
| Base | avaliações/UGC autorizados, reativação/indicação |

Se o painel exceder 12 números, escolha os que mudam uma decisão nesta semana. Curtidas podem ficar como contexto, não como objetivo principal.

## 3. Instrumentação passo a passo

1. Defina evento primário (por exemplo, conversa qualificada, agendamento comparecido ou compra paga).
2. Dê nome à origem no post, link, creator, campanha e CTA.
3. Use UTMs consistentes: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`; não coloque dado pessoal na URL.
4. Para DM/WhatsApp, use palavra-chave, formulário curto ou campo “origem” no CRM; respeite consentimento.
5. Registre data, canal, peça, etapa, responsável, evento e valor/margem quando autorizado.
6. Reconcilie Insights/Analytics com CRM; documente conversões assistidas e janelas.
7. Faça teste de link/código antes de publicar; mantenha versão de controle quando possível.
8. Revise semanalmente; corrija dado faltante antes de aumentar frequência ou verba.

## 4. Ritual de teste

| Campo | Exemplo |
| --- | --- |
| Hipótese | “Responder perguntas reais em vídeo aumenta saves e DMs” |
| Variável | hook; mantenha prova, CTA e formato |
| Primária | conversas qualificadas por 1.000 alcançados |
| Guarda | tempo de resposta e reclamações |
| Janela | 14 dias [HIPÓTESE OPERACIONAL] |
| Dono | social media |
| Critério de manter | superar baseline do período anterior sem piorar guarda |
| Próxima ação | replicar, ajustar ou arquivar com aprendizado |

Não declare vencedor com volume insuficiente. Em conta pequena, prefira direção + repetição + registro a precisão artificial.

## 5. Benchmarks com fonte e ressalva

| Referência | Número/faixa | Fonte | Como usar |
| --- | ---: | --- | --- |
| Instagram carrossel | 4,2% de engagement agregado | [Hootsuite](https://blog.hootsuite.com/social-media-benchmarks/) | contexto global/amostra; não meta brasileira |
| Facebook álbum | 2,9% agregado | [Hootsuite](https://blog.hootsuite.com/social-media-benchmarks/) | comparar somente definição equivalente |
| LinkedIn vídeo | 3,9% agregado | [Hootsuite](https://blog.hootsuite.com/social-media-benchmarks/) | direção, não previsão |
| TikTok vídeo | 1,5% agregado | [Hootsuite](https://blog.hootsuite.com/social-media-benchmarks/) | método/amostra podem diferir |
| Mediana de engajamento | Facebook 3,6%; Instagram 4,3%; TikTok 4,86%; X 2,15%; LinkedIn 6,5% | [Buffer](https://buffer.com/resources/social-media-benchmarks/) | fórmula follower-based; calcule também por alcance |
| Instagram frequência | mediana de 17 posts/mês | [Buffer](https://buffer.com/resources/social-media-benchmarks/) | amostra, não recomendação universal |
| TikTok criatividade | alta qualidade com 72% mais watch time acumulado por view no estudo citado | [TikTok Creator Academy](https://www.tiktok.com/creator-academy/articles/creation-tips) | definição de qualidade incompleta; direção, não causalidade |
| TikTok anúncio | proposta nos 3s, hook nos 6s, 9:16 e 720p mínimo | [TikTok Creative](https://ads.tiktok.com/resources/help/article/creative-best-practices) | recomendação de publicidade paga |
| YouTube Shorts | até 3 min para verticais/quadrados enviados após 15/10/2024 | [Google Support](https://support.google.com/youtube/answer/15424877) | confirme regra vigente e copyright |
| WhatsApp compra | 79% já conversaram com empresa; 66% contrataram serviço e 62% compraram produto | [Opinion Box 2024, citado no dossiê] | contexto declaratório; não é taxa de conversão |
| Resposta a comentário | 1 hora como meta operacional | dossiê/agência | **[HIPÓTESE]**, sem benchmark brasileiro comparável |
| Cadência PME | 3 posts + 5 blocos de Stories/semana | dossiê/agência | **[HIPÓTESE]**, dimensionar pela capacidade |

Os benchmarks Buffer/Hootsuite são globais ou proprietários, com definições e amostras distintas. Não transplante números para Brasil, setor ou conta sem baseline. Quando um número não tiver fonte no documento, marque **[HIPÓTESE]**.

## 6. Decisões por estágio

| Situação | Não conclua | Investigue | Decisão provisória |
| --- | --- | --- | --- |
| views altas, pouca ação | conteúdo vende | hook promete valor, CTA/rota funcionam? | testar CTA e prova mantendo hook |
| saves altos, baixa conversa | audiência não compra | existe oferta e próximo passo? | criar peça de consideração/conversão |
| CTR alto, venda baixa | canal é vencedor | landing, resposta, qualificação e margem | corrigir pós-clique antes de escalar |
| conversa alta, venda baixa | lead ruim apenas | oferta, capacidade, tempo de resposta e qualificação | auditar CRM e resposta |
| alcance baixo, retenção alta | conteúdo inútil | embalagem, distribuição e consistência | testar hooks/formato e não mudar tema sem evidência |

## Fontes consultadas

- Dossiê `social-media-dossie.md`, seções 3, 4, 5 e 8.
- [Hootsuite Social Media Benchmarks](https://blog.hootsuite.com/social-media-benchmarks/).
- [Buffer Social Media Benchmarks](https://buffer.com/resources/social-media-benchmarks/).
- [Meta: Best Practices for Creators](https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/).
- [Instagram Recommendation Guidelines](https://help.instagram.com/313829416281232/).
