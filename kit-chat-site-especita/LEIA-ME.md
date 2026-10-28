# Kit: chat do site + conversa ao vivo no painel (para a Especitá)

Montado em 28/10/2026 a partir do Meu WhatsApp, **sem segredos, IDs ou domínios**. Serve para a conversa que trabalha na pasta `whatsapp especita` construir o chat do site sem inventar nada e sem misturar os dois projetos.

## Como usar (Salvador)
1. Abra o Claude Code na pasta `C:\Users\Salvador\Documents\whatsapp especita`.
2. Cole o bloco de [PROMPT-PARA-ESPECITA.md](PROMPT-PARA-ESPECITA.md).
3. A conversa lê o resto sozinha e faz uma pergunta curta no começo.

## O que tem aqui
| Arquivo | Para quê |
|---|---|
| [PROMPT-PARA-ESPECITA.md](PROMPT-PARA-ESPECITA.md) | O pedido pronto para colar |
| [ISOLAMENTO-E-CONEXOES.md](ISOLAMENTO-E-CONEXOES.md) | O que a Especitá liga (repositório, Render, banco, domínio), o que nunca copiar, verificações antes do commit |
| [MAPA-ORIGEM-MEUWHATSAPP.md](MAPA-ORIGEM-MEUWHATSAPP.md) | Onde está o chat original no Meu WhatsApp, e o que o kit aproveitou ou descartou |
| [codigo/servidor/site-canal.js](codigo/servidor/site-canal.js) | Canal "site": rotas do visitante, entrada e saída do fluxo (testado) |
| [codigo/servidor/db-site-visitantes.js](codigo/servidor/db-site-visitantes.js) | Tabela da chave do visitante, para colar no `db.js` |
| [codigo/servidor/INTEGRACAO-SERVER.md](codigo/servidor/INTEGRACAO-SERVER.md) | Onde encaixar no `server.js` e `db.js` |
| [codigo/painel/LEIA-ME-PAINEL.md](codigo/painel/LEIA-ME-PAINEL.md) | Onde encaixar no `painel-web` (canal "Site" na tela de Conversas) |
| [codigo/site/chat-widget.js](codigo/site/chat-widget.js), [chat-widget.css](codigo/site/chat-widget.css) | O balão de chat do site, sem dependências, com cores trocáveis |
| [testes/smoke-site-canal.js](testes/smoke-site-canal.js) | Teste do servidor com banco falso (`node kit-chat-site-especita/testes/smoke-site-canal.js`) |

## A ideia em uma frase
O chat do site entra no painel como um **canal novo** (como Instagram e e-mail), nas mesmas tabelas e com o mesmo motor de fluxo do WhatsApp. Por isso quase não há código novo no painel, e as conversas do site não se misturam com as do WhatsApp.

## O que foi verificado e o que não foi
- Verificado: `site-canal.js` passa no teste de fumaça (origem barrada, token errado, botão inventado recusado, polling incremental, tudo gravado no canal `site`).
- **Não verificado**: encaixe no `server.js`/`db.js`/`painel-web` reais da Especitá (nada foi alterado lá), o widget no navegador, e o fluxo da tela "Fluxos" para o canal `site`. Esses passos são da conversa da Especitá, com os testes ponta a ponta do prompt.
