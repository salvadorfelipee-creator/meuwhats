# Painel (painel-web) da Especitá: canal "Site"

Aqui **não há arquivo novo para copiar**. A tela de Conversas (`chats.tsx`) já mostra Instagram e e-mail como canais. O site entra como um terceiro canal e reaproveita a lista, o chat, as notas, tags, pipeline e responsável. Isso evita a segunda tela que o Meu WhatsApp tem (`site-chat.tsx`), que existe só porque lá o chat foi construído antes do padrão de canais.

Números de linha da cópia da Especitá em 28/10/2026. Confirme com `grep`.

## 1. `src/lib/channel-context.tsx`
- Tipo: `kind: "whatsapp" | "instagram" | "email" | "site"`.
- Na lista `channels`, depois do e-mail: `{ id: "site", label: "Site", kind: "site" as const },`

## 2. `src/components/app-sidebar.tsx` (~229–270)
O seletor de canal tem um bloco por tipo (`kind === "instagram"`, `"email"`). Repita o bloco do e-mail para `"site"` (ícone `Globe` ou `MessageCircle` do lucide-react, rótulo "Site").

## 3. `src/pages/chats.tsx`
Procure `"instagram"` e `"email"` (`grep -n '"instagram"\|"email"' src/pages/chats.tsx`; pontos conhecidos: ~1067, 1089, 1610, 2031, 3977, 4092, 4296–4298, 4521, 4699). Para cada um:
- **Funções só do WhatsApp** (modelo/template, janela de 24 h, "iniciar conversa", botão de ligar, envio de mídia): inclua `"site"` na condição que já exclui o e-mail. Exemplo: `businessId !== "instagram" && businessId !== "email"` → `... && businessId !== "site"`.
- **Cabeçalho/etiqueta do canal** (~4296): `current.kind === "site" ? "Site" : ...`, com uma cor própria (ex.: `#0f766e`).
- **Nome do canal** (~3977): `if (id === "site") return "Site"`.
- **Telefone exibido:** a chave da conversa é `site-<uuid>`. Não mostre isso ao atendente: onde a lista exibe o telefone, para `site` mostre o nome do visitante (`name`), que o servidor grava em `conversations.name`.

## 4. `src/lib/unread-context.tsx` (~135)
`const chId = c.channel === "instagram" ? "instagram" : c.business_number_id`: garanta que conversas do site contem como não lidas no canal `"site"` (o servidor deve devolver `channel: "site"`; ver INTEGRACAO-SERVER passo 6).

## 5. `src/lib/api.ts`
Se `PhoneNumber`/`Conversation` tem união de canais, inclua `"site"`. O envio já usa `/painel/api/conversations/:businessId/:phone/reply`, então **não precisa de função nova**. O servidor trata `site` (INTEGRACAO-SERVER passo 5).

## 6. Atualização "ao vivo" no painel
O painel já se atualiza por consulta periódica (confira o intervalo atual em `chats.tsx`). O chat do site herda esse mesmo ritmo. Não crie WebSocket nem consulta de poucos segundos no painel: no projeto original o Render foi suspenso por estouro de banda (ver ISOLAMENTO, item "banda").

## 7. Conferir no navegador
1. `npm run build` em `painel-web` sem erro de tipos.
2. Abrir o painel, escolher "Site", ver a conversa criada pelo widget, responder, ver chegar no site.
3. Abrir também um canal WhatsApp e um Instagram e conferir que nada mudou neles.
