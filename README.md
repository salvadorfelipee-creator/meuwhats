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

⚠️ Defina `PAINEL_USER`/`PAINEL_PASS` com valores próprios — o painel mostra suas conversas.

### Como obter `ACCESS_TOKEN` e `PHONE_NUMBER_ID`

1. No app em developers.facebook.com → **WhatsApp → Configuração da API**
2. `PHONE_NUMBER_ID` aparece nessa mesma tela, junto do número de telefone
3. O token mostrado por padrão lá expira em 24h — para não precisar trocar toda hora,
   gere um **token permanente** (link "Saiba como criar um token permanente" na mesma página),
   que é feito criando um usuário de sistema (System User) no Gerenciador de Negócios

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
| `GET /media/:arquivo`                                           | Serve uma mídia salva (auth)                |
