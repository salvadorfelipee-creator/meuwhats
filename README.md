# WhatsApp Webhook + Painel

Servidor para receber e responder mensagens via API Oficial do WhatsApp (Meta Cloud API),
com um painel web simples para ver conversas, fotos, áudios e responder.

---

## Funcionalidades

- Recebe mensagens (texto, imagem, áudio, vídeo, documento) via webhook
- Baixa e guarda mídias localmente (pasta `media/`)
- Guarda histórico (conversas e mensagens) no **Turso** (SQLite hospedado, gratuito)
- Painel web em `/painel` (protegido por usuário/senha) para ver conversas e responder
- Suporta **múltiplos números de WhatsApp Business** ao mesmo tempo, com abas no painel
- Atualiza status de entrega/leitura das mensagens enviadas
- Envio em massa via **Template de Mensagem** (botão 📢 no painel), para contatos que ainda não conversaram
- Automações do **Instagram**: resposta automática a comentários, a replies de Story e boas-vindas na primeira DM

⚠️ **Sobre mídias (fotos/áudios/vídeos)**: os arquivos em si ainda ficam só no disco local
do servidor (pasta `media/`), que no plano free do Render não é permanente — podem ser
perdidos se o serviço reiniciar/redeployar. O **texto e os metadados** das conversas,
porém, ficam seguros no Turso, independente de reinícios.

---

## Variáveis de ambiente

| Variável         | Descrição                                              | Padrão               |
|------------------|---------------------------------------------------------|-----------------------|
| `PORT`           | Porta do servidor                                       | `3000`                |
| `VERIFY_TOKEN`   | Token de verificação do webhook (Meta)                  | `meu_token_secreto`  |
| `ACCESS_TOKEN`   | Token de acesso da API do WhatsApp (permanente)         | —                     |
| `PHONE_NUMBER_ID`| ID de um único número (use isso OU `PHONE_NUMBERS_JSON`) | —                     |
| `PHONE_NUMBERS_JSON` | Lista de números em JSON: `[{"id":"123","label":"Principal"},{"id":"456","label":"Outro"}]` | —  |
| `PAINEL_USER`    | Usuário para acessar o painel `/painel`                 | `admin`               |
| `PAINEL_PASS`    | Senha para acessar o painel `/painel`                   | `admin`               |
| `TURSO_DATABASE_URL` | URL do banco no Turso (turso.tech)                  | —                     |
| `TURSO_AUTH_TOKEN`   | Token de autenticação do banco no Turso             | —                     |
| `INSTAGRAM_ACCESS_TOKEN` | Token de acesso da API do Instagram (Graph API) | —                     |
| `INSTAGRAM_VERIFY_TOKEN` | Token de verificação do webhook do Instagram    | `meu_token_secreto_instagram` |
| `INSTAGRAM_COMMENT_REPLY` | Texto enviado por DM ao comentar em um post    | (ver seção Instagram) |
| `INSTAGRAM_WELCOME_MESSAGE` | Texto de boas-vindas (primeira DM / reply de story) | (ver seção Instagram) |

⚠️ Defina `PAINEL_USER`/`PAINEL_PASS` com valores próprios — o painel mostra suas conversas.

### Como obter `ACCESS_TOKEN` e `PHONE_NUMBER_ID`

1. No app em developers.facebook.com → **WhatsApp → Configuração da API**
2. `PHONE_NUMBER_ID` aparece nessa mesma tela, junto do número de telefone
3. O token mostrado por padrão lá expira em 24h — para não precisar trocar toda hora,
   gere um **token permanente** (link "Saiba como criar um token permanente" na mesma página),
   que é feito criando um usuário de sistema (System User) no Gerenciador de Negócios

---

## Como adicionar um novo número de WhatsApp Business

Todos os números configurados usam o mesmo `ACCESS_TOKEN` (desde que pertençam à mesma
conta de negócios/WABA). Só é preciso achar o `PHONE_NUMBER_ID` do número novo e atualizar
uma variável de ambiente — nenhuma mudança de código é necessária.

1. **Achar o `PHONE_NUMBER_ID` do número novo**: no Gerenciador do WhatsApp
   (business.facebook.com → Contas do WhatsApp → escolha a conta → aba "Phone numbers"),
   clique no número e veja "Identificação do número de telefone".
2. **Verificar se está `CONNECTED`** na Cloud API (não "Offline"/"Disconnected"). Para checar:
   ```bash
   curl "https://graph.facebook.com/v21.0/{WABA_ID}/phone_numbers?fields=id,display_phone_number,status" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"
   ```
   Se aparecer `"status":"DISCONNECTED"`, o número precisa ser registrado antes de usar:
   ```bash
   # 1. Pede um código por SMS/voz
   curl -X POST "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/request_code" \
     -H "Authorization: Bearer {ACCESS_TOKEN}" -d "code_method=SMS" -d "language=pt_BR"

   # 2. Confirma o código recebido
   curl -X POST "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/verify_code" \
     -H "Authorization: Bearer {ACCESS_TOKEN}" -d "code=123456"

   # 3. Registra (pin pode ser qualquer numero de 6 digitos se a verificacao em duas etapas estiver desativada)
   curl -X POST "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/register" \
     -H "Authorization: Bearer {ACCESS_TOKEN}" -d "messaging_product=whatsapp" -d "pin=123456"
   ```
3. **Inscrever o app para receber webhooks desse WABA** (só precisa fazer uma vez por WABA,
   não por número — se o número novo já é da mesma conta dos outros, pule este passo):
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps" \
     -H "Authorization: Bearer {ACCESS_TOKEN}"
   ```
4. **Atualizar a variável `PHONE_NUMBERS_JSON` no Render**, adicionando o novo número à lista:
   ```json
   [
     {"id":"524457590747945","label":"Felizcred (principal)"},
     {"id":"518007084723311","label":"felizcred n"},
     {"id":"NOVO_PHONE_NUMBER_ID","label":"Nome que quiser"}
   ]
   ```
5. Salvar — o Render redeploya automaticamente, e uma nova aba aparece no painel.

---

## Envio em massa (Template de Mensagem)

A API oficial do WhatsApp **não permite texto livre para quem não te escreveu nas últimas 24h**.
Para avisar uma lista de contatos novos (ex: divulgar uma taxa, promoção etc.), é preciso usar
um **Template de Mensagem** pré-aprovado pela Meta.

### 1. Criar o template na Meta

No Gerenciador do WhatsApp (business.facebook.com → Contas do WhatsApp → escolha a conta →
**Modelos de mensagem** → Criar modelo):

- **Categoria**: Marketing (mais barata que Utilidade/Autenticação)
- **Nome**: ex. `aviso_taxa_clt` (sem espaços, minúsculo)
- **Idioma**: Português (BR)
- **Corpo**: ex. `Olá {{1}}! Temos uma novidade para você: a taxa para CLT mudou para 3,98%. Fale com a gente para saber mais.`
- Envie para aprovação (geralmente minutos a algumas horas)

### 2. Usar no painel

1. Escolha a aba do número que vai enviar
2. Clique no botão 📢 (canto superior da lista de conversas)
3. Preencha: nome do template, idioma, o texto do template (com `{{1}}` no lugar do nome —
   isso é só para salvar bonito no histórico, não é enviado de novo) e a lista de contatos,
   um por linha, no formato `telefone,nome` (nome é opcional)
4. Clique em **Enviar** — o sistema manda um a um (com uma pequena pausa entre cada) e mostra
   quantos enviaram com sucesso e quais falharam

⚠️ Cada número de WhatsApp Business tem um **limite diário de mensagens iniciadas** (cresce
conforme a "qualidade"/uso do número — começa em 250/dia). Evite listas gigantes de uma vez só.

---

## Automações do Instagram

Três automações via webhook nativo da Meta (sem polling), rodando no mesmo servidor:

| Automação | Quando dispara | Mensagem |
|---|---|---|
| Comentário → DM | Qualquer comentário em uma foto/post | "Olá! 😊 Para saber mais, acesse www.felizcred.com.br ou fale com a gente pelo WhatsApp que está na nossa bio!" |
| Reply de Story → DM | Alguém responde a um Story | mesma mensagem de boas-vindas abaixo |
| Primeira DM → Boas-vindas | Primeira mensagem direta de alguém (controle via tabela `instagram_dm_contacts`) | "Olá! 👋 Agradecemos por nos seguir!\n\nNo nosso blog você encontra as principais novidades sobre empréstimo. Por aqui você também pode simular:\n\n💼 Consignado CLT\n💡 Empréstimo na conta de luz\n💰 Saque do FGTS\n🏛️ Empréstimo consignado do INSS\n\nÉ só responder essa mensagem que a gente te ajuda!" |

Os textos têm um padrão no código, mas podem ser sobrescritos por variável de ambiente
(`INSTAGRAM_COMMENT_REPLY`, `INSTAGRAM_WELCOME_MESSAGE`) sem precisar mudar código.

### Como conseguir as credenciais (caminho oficial, sem risco de banimento)

Tudo isso usa a **API oficial do Instagram via Graph API da Meta** — o mesmo tipo de
integração usada pelo WhatsApp neste projeto, então é seguro e dentro dos termos da Meta
(diferente de bots não-oficiais que automatizam ações simulando um navegador).

1. **A conta do Instagram precisa ser Profissional** (Criador ou Empresa) e estar
   **conectada a uma Página do Facebook** (Configurações do Instagram → Contas conectadas).
2. No mesmo App em developers.facebook.com que já é usado para o WhatsApp, adicione o produto
   **Instagram Graph API** (ou "Instagram" nas configurações do produto).
3. Em **Permissões e recursos**, solicite/ative:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `pages_messaging`
   Enquanto o app estiver em modo de desenvolvimento, isso já funciona normalmente para
   contas adicionadas como **testador** (Função de testador no painel do App) — não precisa
   esperar a Revisão do App da Meta para uso próprio.
4. Gere o **token de acesso** em Ferramentas → Explorador da API Graph (ou reaproveite o
   token de sistema já criado para o WhatsApp, se o mesmo App tiver as permissões acima).
5. Configure o webhook: App → **Webhooks** → produto **Instagram**:
   - **URL de Callback**: `https://SEU_DOMINIO/webhook/instagram`
   - **Token de Verificação**: o mesmo valor de `INSTAGRAM_VERIFY_TOKEN`
   - Assine os campos: `comments` e `messages`
6. Defina as variáveis de ambiente no Render: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_VERIFY_TOKEN`.

---

## Estado atual do projeto (resumo)

- Backend Node puro (`server.js`) + `db.js` (Turso) + `whatsapp.js` (chamadas à Graph API)
- Deploy no **Render** (free tier), repositório em `github.com/salvadorfelipee-creator/meuwhats`
- Histórico de conversas no **Turso** (permanente); mídias (fotos/áudios/vídeos) só no disco
  do Render (não permanente — ver aviso acima)
- Dois números WhatsApp Business conectados, com abas no painel
- Envio em massa via template implementado (botão 📢 no painel)
- Pendente/possível próximo passo: mensagem automática com botões para conversas inativas
  há mais de 24h (ainda não implementada — decisão de igual/diferente por número em aberto)

---

## Rodar localmente

```bash
npm install
VERIFY_TOKEN=meu_token_secreto ACCESS_TOKEN=xxx PHONE_NUMBER_ID=xxx PAINEL_USER=eu PAINEL_PASS=minhasenha node server.js
```

Acesse `http://localhost:3000/painel` (vai pedir usuário/senha).

---

## Configurar no Meta for Developers

1. App → **WhatsApp → Configuração**
2. **URL de Callback**: `https://SEU_DOMINIO/webhook`
3. **Token de Verificação**: o mesmo valor de `VERIFY_TOKEN`
4. Clique em **Verificar e Salvar**
5. Assine o campo: `messages`

---

## Rotas

| Rota                                                          | Descrição                                  |
|----------------------------------------------------------------|---------------------------------------------|
| `GET /webhook`                                                  | Verificação do Meta                         |
| `POST /webhook`                                                 | Recebe mensagens/status                     |
| `GET /painel`                                                   | Painel web (auth)                           |
| `GET /painel/api/numbers`                                       | Lista números configurados (auth)           |
| `GET /painel/api/conversations/:businessId`                     | Lista conversas de um número (auth)         |
| `GET /painel/api/conversations/:businessId/:phone/messages`     | Mensagens de uma conversa (auth)            |
| `POST /painel/api/conversations/:businessId/:phone/reply`       | Envia resposta de texto (auth)              |
| `POST /painel/api/broadcast/:businessId`                        | Envio em massa via template (auth)          |
| `GET /media/:arquivo`                                           | Serve uma mídia salva (auth)                |
| `GET /webhook/instagram`                                        | Verificação do Meta (Instagram)             |
| `POST /webhook/instagram`                                       | Recebe comentários/DMs do Instagram         |
