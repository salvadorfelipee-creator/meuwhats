# Prompt para colar na conversa da Especitá

Abra o Claude Code **na pasta `C:\Users\Salvador\Documents\whatsapp especita`** e cole o bloco abaixo inteiro.

---

```
Você está no projeto da Clínica Especitá (pasta whatsapp especita, repositório especitaodonto/Whatsappespecita). Leia o CLAUDE.md desta pasta antes de qualquer coisa e respeite o limite de projeto dele.

OBJETIVO
Colocar um chat no site da Especitá e fazer as conversas aparecerem ao vivo no painel, respondidas pelo mesmo painel, usando o MESMO fluxo do WhatsApp. O chat é só mais um canal de comunicação com os clientes, como Instagram e e-mail. NÃO vincular a conversa do site com a do WhatsApp do mesmo cliente.

KIT PRONTO (somente leitura, fica em outro projeto)
Pasta: C:\Users\Salvador\Documents\meuwhatsapp\kit-chat-site-especita\
Leia nesta ordem:
 1. LEIA-ME.md
 2. ISOLAMENTO-E-CONEXOES.md  (o que ligar à Especitá e o que nunca misturar)
 3. codigo\servidor\INTEGRACAO-SERVER.md  (passo a passo no server.js e db.js)
 4. codigo\painel\LEIA-ME-PAINEL.md  (passo a passo no painel-web)
 5. MAPA-ORIGEM-MEUWHATSAPP.md  (só se precisar de um detalhe do chat original)
Arquivos a COPIAR para esta pasta: codigo\servidor\site-canal.js, o bloco de codigo\servidor\db-site-visitantes.js (cola dentro do db.js), codigo\site\chat-widget.js e chat-widget.css (para o site).
A pasta do outro projeto é só para leitura: não edite, não commite e não rode nada nela.

DESENHO (já decidido, não reabra)
- Canal novo "site": business_number_id = "site", phone = "site-<uuid>", nas tabelas conversations/messages que já existem. Só uma tabela nova (site_visitantes) para a chave secreta de cada visitante.
- Saída do fluxo: enviarRespostaAutomatica ganha um desvio para "site". O motor de fluxo (getFluxo, dispararInicioFluxo, avancarNoFluxoDinamico) não muda.
- Painel: "Site" vira um canal na tela de Conversas, ao lado de Instagram e E-mail. Sem tela nova. Resposta do atendente pela rota /reply que já existe.
- Widget do site em JS puro, consulta o servidor só com o chat aberto e a aba visível (economia de banda).

REGRAS DE ISOLAMENTO (obrigatórias)
- Só infraestrutura da Especitá: Turso, R2, Render, domínio e variáveis dela. Nada do Meu WhatsApp/FelizCred/Cota Certa/Ciahot (domínio, token, ID, banco, WABA, número, texto).
- Nenhum valor de variável de ambiente no código. Variável nova: SITE_CHAT_ORIGENS (valor digitado por mim no Render da Especitá; você me diz exatamente o que colocar).
- Antes de cada commit rode as verificações do item 5 de ISOLAMENTO-E-CONEXOES.md. Commit e push com ESTA pasta como diretório de trabalho.

COMO TRABALHAR
1. Faça UMA pergunta só, no começo, com as 3 decisões abertas do final do MAPA-ORIGEM-MEUWHATSAPP.md (fluxo do site, domínio do site, pedir celular) e a recomendação de cada uma. Depois disso, não pare para pedir confirmação.
2. Implemente o servidor, depois o painel, depois o widget, seguindo os guias. Os números de linha dos guias podem ter mudado: confirme com grep.
3. Rode node kit-chat-site-especita\testes\smoke-site-canal.js (no outro projeto, só leitura) ou copie-o para um teste local. Rode npm run build no painel-web.
4. Teste ponta a ponta como cliente: abrir o chat, clicar num botão do fluxo, digitar texto, ver a conversa no painel, responder pelo painel e ver a resposta chegar no site. Confira no banco que as mensagens ficaram com business_number_id = "site". Confira que WhatsApp e Instagram continuam iguais. Só diga "pronto" depois de percorrer tudo isso.
5. Faça commit e push, confira o deploy no Render da Especitá e me diga em português simples o que mudou e o que eu preciso fazer (a variável SITE_CHAT_ORIGENS e colar as 2 linhas no site).
```

---

Fim do bloco. O que está acima é tudo que a outra conversa precisa.
