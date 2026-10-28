# Mapa: onde está o chat do site no Meu WhatsApp (só para consulta)

O kit **não copia** esses arquivos: o chat original está preso à FelizCred (CLT, Facta, Brevo, e-mails, "Felipe"). O kit reimplementa a ideia de forma genérica. Este mapa serve para a sessão da Especitá **ler** o original quando precisar de um detalhe. A pasta fica em `C:\Users\Salvador\Documents\meuwhatsapp` e é **somente leitura**: nunca editar, commitar nem rodar nada lá a partir da Especitá.

## O que existe lá e o que o kit fez com cada parte
| Peça no original | Onde (linhas de 28/10/2026) | No kit |
|---|---|---|
| Widget do site (formulário em passos, polling, anexos, áudio) | `felizcred-site/chat.js` (514 linhas), `chat.css` (422) | Reescrito enxuto: [chat-widget.js](codigo/site/chat-widget.js), [chat-widget.css](codigo/site/chat-widget.css). Sem CLT, CPF, gaveta, áudio. |
| Rotas públicas do visitante (`/site-chat/*`) | `server.js` 7126–7260 (iniciar, presença, acesso), 7578–7790 (mensagens) | Reescrito: [site-canal.js](codigo/servidor/site-canal.js) (`/site/chat/iniciar`, `/mensagens`, `/enviar`) |
| Chave secreta por visitante (token em hash, `timingSafeEqual`) | `server.js` 90–98 `siteChatTokenValido`; `db.js` 3862 `siteChatCriar` | Mesma ideia, tabela mínima: [db-site-visitantes.js](codigo/servidor/db-site-visitantes.js) |
| CORS por lista de origens, limite de uso por IP | `server.js` 50–88 | Mesma ideia dentro do `site-canal.js` |
| Tabelas do chat (`site_chat_conversations`, `site_chat_messages`) | `db.js` 122–145 e migrações até ~270 | **Não usadas**: na Especitá as mensagens vão para `conversations`/`messages` com canal `"site"` |
| Telas do painel (lista + conversa do site) | `painel-web/src/pages/site-chat.tsx` (260 linhas) | **Não usada**: o canal "Site" aparece na tela de Conversas existente. Ver [LEIA-ME-PAINEL.md](codigo/painel/LEIA-ME-PAINEL.md) |
| Rotas do atendente (`/painel/api/site-chat/*`: listar, responder, bot, status, pipeline) | `server.js` 7796–7880 | **Não usadas**: o painel da Especitá já tem `/painel/api/conversations/:canal/:fone/reply`, status, tags, pipeline |
| Pausa do assistente quando humano responde | `server.js` ~7600 (`bot_pausado_ate`), 7811 (`SITE_CHAT_BOT_PAUSA_MS`) | Fora do kit v1. Na Especitá o fluxo só avança por botão/texto esperado (`fluxo_passo`); humano responde por cima. Ver "Decisões abertas" |
| Presença "entrou/saiu" | `server.js` 7137, 105–143 | Fora do kit v1 (opcional) |
| Regras de repetição/horário comercial | `site-chat-rules.js` | Não copiar (traz o WhatsApp da FelizCred fixo) |
| Respostas por IA (Gemini) | `gemini.js` `responderConversaSite` | Não copiar. A Especitá tem o próprio `gemini.js`; ligar só se o Salvador pedir |
| Fluxo único para os canais | **não existe** lá | Já existe na Especitá: `getFluxo` / `dispararInicioFluxo` / `enviarRespostaAutomatica` (server.js ~970, 1945, 2641) e o Instagram é o modelo de canal (~3290–3420) |

## Por que o desenho é diferente do original
No Meu WhatsApp o chat do site nasceu separado e depois ganhou ponte para o WhatsApp. Pedido da Especitá: **o chat é só mais um canal, com o mesmo fluxo e sem vincular conversas**. A cópia da Especitá já tem esse padrão (Instagram e e-mail são canais com `business_number_id` fixo), então o caminho de menor risco e menos código é um canal `"site"`.

## Decisões abertas (a sessão da Especitá deve confirmar com o Salvador, em uma pergunta só, antes de construir)
1. **Fluxo do site**: reaproveitar o fluxo ativo do WhatsApp principal ou duplicar para o canal "site"? Recomendado: duplicar (podem divergir depois, e botões/listas do WhatsApp têm limites que o site não tem).
2. **Domínio do site** que vai em `SITE_CHAT_ORIGENS`.
3. **Pedir celular** no início (`data-pedir-contato`)? Recomendado: sim, para o time poder chamar no WhatsApp se o visitante sair do site.
