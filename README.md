# WhatsApp Webhook + Painel

Servidor para receber e responder mensagens via API Oficial do WhatsApp (Meta Cloud API),
com um painel web simples para ver conversas, fotos, áudios e responder.

---

## Funcionalidades

- Recebe mensagens (texto, imagem, áudio, documento) via webhook
- Baixa e guarda mídias localmente (pasta `media/`)
- Guarda histórico em SQLite (`data.db`)
- Painel web em `/painel` (protegido por usuário/senha) para ver conversas e responder
- Atualiza status de entrega/leitura das mensagens enviadas

⚠️ **Importante sobre o histórico**: o arquivo `data.db` e a pasta `media/` ficam no disco
local do servidor. No plano free do Render, esse disco **não é garantido como permanente** —
pode ser perdido quando o serviço reinicia ou é redeployado. Para histórico realmente
permanente seria necessário um banco de dados externo (ex: Render PostgreSQL).

---

## Variáveis de ambiente

| Variável         | Descrição                                              | Padrão               |
|------------------|---------------------------------------------------------|-----------------------|
| `PORT`           | Porta do servidor                                       | `3000`                |
| `VERIFY_TOKEN`   | Token de verificação do webhook (Meta)                  | `meu_token_secreto`  |
| `ACCESS_TOKEN`   | Token de acesso da API do WhatsApp (permanente)         | —                     |
| `PHONE_NUMBER_ID`| ID do número de telefone do WhatsApp Business            | —                     |
| `PAINEL_USER`    | Usuário para acessar o painel `/painel`                 | `admin`               |
| `PAINEL_PASS`    | Senha para acessar o painel `/painel`                   | `admin`               |

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

| Rota                                              | Descrição                                  |
|----------------------------------------------------|---------------------------------------------|
| `GET /webhook`                                      | Verificação do Meta                         |
| `POST /webhook`                                     | Recebe mensagens/status                     |
| `GET /painel`                                       | Painel web (auth)                           |
| `GET /painel/api/conversations`                     | Lista conversas (auth)                      |
| `GET /painel/api/conversations/:phone/messages`     | Mensagens de uma conversa (auth)            |
| `POST /painel/api/conversations/:phone/reply`       | Envia resposta de texto (auth)              |
| `GET /media/:arquivo`                               | Serve uma mídia salva (auth)                |
