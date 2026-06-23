# WhatsApp Webhook Mínimo

Servidor para receber mensagens via API Oficial do WhatsApp (Meta Cloud API).  
Zero dependências — só Node.js puro.

---

## Como usar

### 1. Rodar localmente

```bash
VERIFY_TOKEN=meu_token_secreto node server.js
```

### 2. Expor localmente para testes (ngrok)

```bash
npx ngrok http 3000
# vai gerar algo como: https://abc123.ngrok.io
```

### 3. Configurar no Meta for Developers

1. Acesse: https://developers.facebook.com
2. Seu App → WhatsApp → Configuração → Webhooks
3. Preencha:
   - **URL do Callback**: `https://SEU_DOMINIO/webhook`
   - **Token de Verificação**: o mesmo valor de `VERIFY_TOKEN`
4. Clique em **Verificar e Salvar**
5. Assine o campo: `messages`

---

## Deploy no Railway (recomendado)

1. Crie conta em https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Adicione a variável de ambiente:
   - `VERIFY_TOKEN` = qualquer string secreta sua
4. A URL gerada pelo Railway é o seu webhook

---

## Variáveis de ambiente

| Variável       | Descrição                        | Padrão               |
|----------------|----------------------------------|----------------------|
| `PORT`         | Porta do servidor                | `3000`               |
| `VERIFY_TOKEN` | Token de verificação do webhook  | `meu_token_secreto`  |

---

## Próximos passos

Para **responder mensagens**, você precisa fazer um POST para:
```
https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
```
Com o header `Authorization: Bearer {ACCESS_TOKEN}` e body:
```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Olá!" }
}
```
