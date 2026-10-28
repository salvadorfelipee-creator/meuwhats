# Integração no servidor da Especitá (server.js + db.js)

Todos os números de linha abaixo são da cópia da Especitá em 28/10/2026. **Confirme com `grep` antes de editar**: o arquivo muda.

## 1. Banco (db.js)
1. Cole o conteúdo de [db-site-visitantes.js](db-site-visitantes.js) no `db.js`, antes do `module.exports`.
2. Chame `await criarTabelaSiteVisitantes()` junto dos outros `CREATE TABLE` (a função de inicialização que alimenta `ready`).
3. Exporte: `siteVisitanteCriar, siteVisitanteObter, siteVisitanteSalvarOpcoes, siteVisitanteTocar`.

As mensagens do chat **não** ganham tabela nova: ficam em `conversations`/`messages` com `business_number_id = "site"` e `phone = "site-<uuid>"`.

## 2. Servidor (server.js)
1. Copie [site-canal.js](site-canal.js) para a raiz do projeto, ao lado do `server.js`.
2. Depois que `getFluxo`, `dispararInicioFluxo`, `bateuGatilhoDeFluxoDinamico`, `enviarRespostaAutomatica` e `normalizarTexto` existirem (são `function`, então sobem; crie o canal depois das constantes `PASSO_OPTOUT_BLOQUEADO` e `HORAS_INATIVIDADE_MENU`):
   ```js
   const { criarCanalSite } = require("./site-canal");
   const canalSite = criarCanalSite({
     db, getFluxo, dispararInicioFluxo, bateuGatilhoDeFluxoDinamico, enviarRespostaAutomatica, normalizarTexto,
     passoOptOut: PASSO_OPTOUT_BLOQUEADO, horasInatividadeMenu: HORAS_INATIVIDADE_MENU,
   });
   ```
3. **Saída do fluxo.** No começo de `enviarRespostaAutomatica` (hoje ~linha 970, onde já existe o `if (businessNumberId === "instagram")`), acrescente:
   ```js
   if (businessNumberId === "site") return canalSite.enviarRespostaSite(phone, texto, botoes, lista, cta);
   ```
   Isso é o que faz o chat usar **o mesmo fluxo do WhatsApp**: o motor (`avancarNoFluxoDinamico`, `dispararInicioFluxo`…) só chama `enviarRespostaAutomatica`.
4. **Rota pública.** No handler HTTP, logo depois de `const path_ = url.pathname` (~linha 3574) e **antes** de qualquer rota `/painel/api/*`:
   ```js
   if (await canalSite.rotaPublica(req, res, path_, { parseBody, send })) return;
   ```
5. **Resposta do atendente pelo painel.** Na rota `POST /painel/api/conversations/:businessId/:phone/reply` (~linha 4160):
   - na linha que normaliza o telefone (~4169), inclua `"site"` na lista que **não** passa por `normalizarTelefoneBR`: `businessId === "instagram" || businessId === EMAIL_CHANNEL_ID || businessId === "site"`;
   - antes do bloco `if (businessId === "instagram")`, acrescente:
     ```js
     if (businessId === "site") {
       if (body.imagemBase64 || body.videoBase64 || body.audioBase64 || body.documentBase64) {
         return send(res, 400, { error: "Envio de anexo pelo chat do site ainda não é suportado. Responda por texto." });
       }
       const agora = Date.now();
       await db.upsertConversation(phone, "site", null, agora);
       await db.insertMessage({ phone, business_number_id: "site", direction: "out", type: "text", body: texto, status: "sent", origem: "humano", respondido_por: usuarioAtual.nome, created_at: agora });
       atribuirResponsavelSeVazio("site", phone, usuarioAtual.nome).catch((err) => console.error("Responsável não atribuído:", err.message));
       return send(res, 200, { ok: true });
     }
     ```
     (é o mesmo desenho do bloco do e-mail logo abaixo; copie dele se o nome de algum helper mudou).
6. **Rótulos e canal.** `labelDoCanal` (~369): `if (businessNumberId === "site") return "Site";`. Nos mapeamentos `channel: c.business_number_id === "instagram" ? "instagram" : "whatsapp"` (~3894, 3955, 4052, 5361) acrescente o caso `"site"` → `"site"` (hoje o e-mail também cai em "whatsapp" ali? **confira** e trate igual ao e-mail).
7. **Procure todo `"instagram"` / `EMAIL_CHANNEL_ID` do server.js** (`grep -n '"instagram"\|EMAIL_CHANNEL_ID' server.js`, ~54 ocorrências) e decida, uma a uma, se o site se comporta como o e-mail (resposta só texto, sem janela de 24 h, sem template). Os pontos que **não** podem tratar o site como WhatsApp: janela de 24 h/template (`retomarBotPorJanelaDe24hFechada`), `normalizarTelefoneBR`, envio de campanha/broadcast, lembretes que chamam `wa.send*`. Se um lembrete do fluxo (`lembreteMinutos`) tentar mandar WhatsApp para `site-…`, ele quebra: bloqueie `site` ali.
8. **Variável de ambiente nova:** `SITE_CHAT_ORIGENS` (ver [../../ISOLAMENTO-E-CONEXOES.md](../../ISOLAMENTO-E-CONEXOES.md)).

## 3. Fluxo do canal "site"
`getFluxo("site", phone, passo)` usa `fluxoDinamicoAtivo(businessNumberId)`, que procura um fluxo marcado para aquele número/canal. Sem fluxo para `"site"` o chat funciona como **atendimento 100% humano** (a mensagem só aparece no painel). Para usar o mesmo fluxo do WhatsApp, crie/duplique o fluxo na tela **Fluxos** apontando para o canal "site" (confira como o Instagram foi ligado a um fluxo: `fluxoDinamicoAtivo("instagram")`). Se a tela ainda não deixa escolher "site", ajuste a consulta `fluxoDinamicoAtivo` para aceitar o novo id.

## 4. Teste sem banco real
`node kit-chat-site-especita/testes/smoke-site-canal.js` (roda com banco falso; deve imprimir "OK"). Depois do merge no projeto da Especitá, repita o teste manual: abrir o chat, clicar num botão, digitar texto, responder pelo painel e ver a resposta chegar no widget em até ~4 s.
