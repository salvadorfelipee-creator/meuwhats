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
- **Atendimento automático com botões**: menu inicial para conversa nova/inativa há 24h + fluxo de triagem do anúncio de gerente (ver seção abaixo)
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
| `INSTAGRAM_ACCOUNT_ID` | ID numérico da conta profissional do Instagram      | —                     |
| `INSTAGRAM_VERIFY_TOKEN` | Token de verificação do webhook do Instagram    | `meu_token_secreto_instagram` |
| `INSTAGRAM_MENU_MESSAGE` | Texto-base do menu de 5 opções (usado como padrão pelas duas variáveis abaixo) | (ver seção Instagram) |
| `INSTAGRAM_COMMENT_REPLY` | Texto enviado por DM ao comentar em um post — sobrescreve o menu se definido | `INSTAGRAM_MENU_MESSAGE` |
| `INSTAGRAM_WELCOME_MESSAGE` | Texto de boas-vindas (primeira DM / reply de story) — sobrescreve o menu se definido | `INSTAGRAM_MENU_MESSAGE` |
| `INSTAGRAM_WHATSAPP_NUMERO` | Número de WhatsApp (formato `55DDDNUMERO`, sem `+`/espaços) usado no link gerado quando o cliente escolhe uma opção do menu | `5547997059353` |
| `META_ADS_ACCESS_TOKEN` | Token de acesso da API de Marketing (campanhas de anúncios) | — |
| `META_AD_ACCOUNT_ID` | ID da conta de anúncios, formato `act_XXXXXXXXX`        | —                     |
| `TELEGRAM_BOT_TOKEN` | Token do bot, gerado pelo @BotFather                        | —                     |
| `TELEGRAM_WEBHOOK_SECRET` | Segredo opcional pra validar que o webhook vem do Telegram | — (sem validação) |
| `TELEGRAM_START_MESSAGE` | Texto enviado ao receber `/start` (com botão de compartilhar contato) | (ver seção Telegram) |
| `TELEGRAM_THANKS_MESSAGE` | Texto enviado depois que o usuário compartilha o contato | (ver seção Telegram) |

⚠️ Defina `PAINEL_USER`/`PAINEL_PASS` com valores próprios — o painel mostra suas conversas.

### Segurança: nenhum valor de credencial vai neste arquivo

Esta tabela lista só os **nomes** das variáveis — os **valores** ficam exclusivamente em
Render → Environment, nunca no README nem em nenhum arquivo commitado. Isso é intencional:
se um token vazasse no histórico do git, teria que ser revogado e trocado em todo lugar.

Quando uma conversa nova do Claude precisar checar algo que depende de um desses tokens:
- Se já existe uma rota no nosso servidor que faz a chamada por dentro (ex:
  `/painel/api/instagram/diagnostico`, ver seção Instagram), use essa rota — só precisa da
  senha do painel (`PAINEL_USER`/`PAINEL_PASS`), bem menos sensível que os tokens da Meta.
- Se não existe rota pronta e a tarefa realmente exigir uma chamada direta à API da Meta
  (Graph API), é esperado e correto pedir o valor ao usuário naquele momento do jeito que foi
  feito nesta sessão (gerar token novo no painel da Meta, copiar e colar no chat) — **isso não
  é uma falha do sistema de memória, é a forma correta de proceder.**

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

## Atendimento automático com botões (WhatsApp)

Implementado em 06/07/2026 direto no código (`FLUXO_BOTOES` e `menuInicial()` em `server.js`),
usando mensagens interativas da Cloud API (`whatsapp.js` → `sendButtons`, máx. 3 botões por
mensagem, título de botão com até 20 caracteres). Não usa nenhuma ferramenta externa de fluxo.

**Gatilho do menu inicial**: quando um contato manda qualquer mensagem (texto/mídia) e a
conversa é nova **ou** está sem atividade há mais de 24h (`HORAS_INATIVIDADE_MENU`), o servidor
responde com saudação conforme o horário de Brasília ("bom dia/boa tarde/boa noite") e dois
botões. Vale para **todos os números** configurados. Cliques em botão não redisparam o menu.
**Limite de 1 menu a cada 24h por contato**, garantido pela coluna `menu_sent_at` em
`conversations` com UPDATE condicional atômico (`tentarMarcarMenuEnviado` em `db.js`) —
corrige bug de 08/07/2026 em que uma rajada de mensagens (processadas em webhooks paralelos)
disparava um menu para cada mensagem. Tipos `unsupported`/`reaction` não disparam menu.

Fluxo (cada botão tem um `id` que aponta pro próximo passo em `FLUXO_BOTOES`) —
**reformulado em 11/07/2026** após analisar as conversas do 1º teste A/B:

- **Primeira mensagem** (todo contato novo/inativo 24h): "Olá, {saudação}! Você clicou no
  nosso anúncio voltado para quem trabalha ou já trabalhou como GERENTE ou SUPERVISOR..." →
  botões `TRABALHO/TRABALHEI` / `NUNCA TRABALHEI` (a triagem virou a primeira mensagem; o
  menu antigo `ANÚNCIO GERENTE`/`CONSIGNADO CLT` foi desativado, mas os passos
  `fluxo_gerente`/`fluxo_clt` seguem respondendo a botões antigos)
  - `TRABALHO/TRABALHEI` → pergunta se saiu do cargo há mais de 2 anos →
    - `NÃO PASSOU 2 ANOS` → oferece análise GRATUITA por escritório de advocacia parceiro →
      botão `AUTORIZO` → pede nome e cidade e avisa que o contato virá do (47) 99978-2256
    - `FAZ MAIS DE 2 ANOS` → explica que prescreveu e abre **lista de produtos** (era beco
      sem saída — 8 leads pararam aí no 1º teste)
  - `NUNCA TRABALHEI` → explica que não se aplica e abre a mesma **lista de produtos**
- **Lista de produtos** (`LISTA_PRODUTOS`, mensagem interativa tipo `list` via `sendList` —
  botões comuns só permitem 3 opções, lista permite até 10): CONSIGNADO CLT, CONSIGNADO
  INSS, SAQUE-ANIVERSÁRIO FGTS, CARRO EM GARANTIA, SEGURO VEICULAR → cada escolha
  (`prod_*`) confirma e avisa que um atendente assume.

Depois do fim de cada ramo, quem assume é o atendimento humano pelo painel (não existe
"atribuir conversa" como em ferramentas de fluxo — toda conversa já aparece no painel).
No histórico do painel, as mensagens enviadas com botões mostram os botões como linhas "🔘".

**Lembretes e agenda (11/07/2026)** — para não perder lead sem pagar template depois das 24h:

- Quem responde o **nome/cidade** (passo `gerente_autorizo`) recebe confirmação automática;
  **no fim de semana** ela avisa: *"Na segunda-feira, às 9 horas, o escritório parceiro irá
  enviar uma mensagem explicando como eles irão analisar o seu caso"* (função
  `confirmacaoAgenda()` — em dia útil, mesma mensagem sem o "segunda às 9h").
- Quem **para de responder no meio do fluxo** recebe UM lembrete automático: 20 min no passo
  do nome/cidade ("para entrar na agenda preciso do seu nome e cidade"), 15 min nos demais
  passos ("toque em uma das opções acima"). Exceção de propósito: quem clicou **NUNCA
  TRABALHEI** não recebe lembrete (decisão do usuário).
- Implementação: colunas `fluxo_passo`/`fluxo_passo_at`/`fluxo_lembrete` em `conversations`,
  `setFluxoPasso`/`listarFluxosAguardando`/`tentarMarcarLembreteEnviado` em `db.js` (marcação
  atômica, sem duplicar), `setInterval` de 1 min no `server.js` (`LEMBRETE_MINUTOS`/
  `LEMBRETE_TEXTOS`). Resposta manual pelo painel **cancela** o lembrete pendente daquela
  conversa. ⚠️ No free tier do Render o servidor hiberna sem tráfego — o lembrete pode
  atrasar até o próximo despertar. **Mitigado em 11/07/2026** com auto-ping: o servidor
  chama `GET /ping` (rota pública, sem auth) pela própria URL pública a cada 10 min
  (`PUBLIC_URL`, padrão `https://meuwhats.onrender.com`), o que impede a hibernação
  enquanto o processo estiver de pé. Reforço externo **já configurado em 11/07/2026**:
  monitor no UptimeRobot (conta do usuário, plano grátis), tipo HTTP(s), URL
  `https://meuwhats.onrender.com/ping`, intervalo 5 min, alerta por e-mail — cobre também
  o caso de o serviço já ter dormido por algum motivo e avisa se o servidor cair.

---

## Automações do Instagram

Três automações via webhook nativo da Meta (sem polling), rodando no mesmo servidor:

| Automação | Quando dispara | Mensagem |
|---|---|---|
| Comentário → DM | Qualquer comentário em uma foto/post | menu de 5 opções (`INSTAGRAM_MENU_MESSAGE`, ver abaixo) |
| Reply de Story → DM | Alguém responde a um Story | mesmo menu |
| Primeira DM → Boas-vindas | Primeira mensagem direta de alguém (controle via tabela `instagram_dm_contacts`) | mesmo menu |

⚠️ **Não existe webhook de "curtida" nem de "novo seguidor"** na API do Instagram (Meta não
expõe esses eventos, só `comments`, `messages`, `mentions`, `story_insights` etc. — não é
limitação do código, é da plataforma). Por isso "primeira DM" funciona como o proxy prático de
"seguiu e chamou" — a grande maioria de quem segue acaba mandando mensagem (pelo botão do
anúncio, pelo link da bio, etc.). Curtida isolada sem comentário/DM não dispara nada.

### Menu de 5 opções (18/07/2026) → link direto pro WhatsApp

Pedido do usuário: quem interage manda a mesma mensagem com um menu de produtos; ao responder
com o número ou o nome da opção, o bot manda de volta um link `wa.me` já com o texto preenchido,
levando direto pra conversa no WhatsApp (`INSTAGRAM_WHATSAPP_NUMERO`, padrão `5547997059353`).

Texto padrão (`INSTAGRAM_MENU_MESSAGE`, usado tanto no comentário quanto na boas-vindas):

> Olá! 😊 Seja muito bem-vindo(a)!
>
> Podemos te ajudar com atendimento pessoal e sem burocracia. Somos correspondente bancário e trabalhamos com as melhores instituições do mercado.
>
> Escolha abaixo o que você procura que já te chamamos no WhatsApp:
>
> 1️⃣ 🚗 Seguro de veículo
> 2️⃣ 💼 Consignado CLT
> 3️⃣ 💰 Saque do FGTS
> 4️⃣ 🔑 Empréstimo com carro em garantia
> 5️⃣ 🚙 Financiamento de veículo
>
> É só responder com o número ou o nome da opção que a gente continua por lá! 📲

Reconhecimento da resposta (`detectarOpcaoMenuInstagram` em `server.js`): aceita o número
(`1`–`5`) ou uma palavra-chave por opção (`seguro`, `clt`/`consignado`, `fgts`/`saque`,
`garantia`, `financiamento`), sem diferenciar maiúscula/acento. Se não reconhecer, não responde
nada automaticamente (fica pro atendimento manual no painel). Ao reconhecer, envia:

> Perfeito! ✅ Clica no link pra continuar no WhatsApp sobre {produto}:
> https://wa.me/5547997059353?text=Olá%2C%20vim%20do%20Instagram%20e%20quero%20saber%20sobre%20{produto}

Cada texto (menu e mensagem de comentário) pode ser sobrescrito por variável de ambiente
(`INSTAGRAM_MENU_MESSAGE`, `INSTAGRAM_COMMENT_REPLY`, `INSTAGRAM_WELCOME_MESSAGE`) sem precisar
mudar código — as duas últimas caem no texto do menu se não forem definidas.

⚠️ **Ainda não testado em produção** — implementado e com sintaxe validada (`node --check`)
nesta sessão, mas precisa de um deploy + teste real (comentar num post e responder "3", por
exemplo) para confirmar o comportamento ponta a ponta.

### Como conseguir as credenciais (caminho oficial, sem risco de banimento)

Usamos a **API do Instagram com Login do Instagram** (`graph.instagram.com`), o fluxo mais novo
da Meta — direto na conta profissional, sem precisar de Página do Facebook.

1. A conta do Instagram precisa ser **Profissional** (Criador ou Empresa).
2. No app em developers.facebook.com → **Casos de uso → API do Instagram → "Configuração da
   API com login do Instagram"** (atenção: existe uma aba parecida "...com login do Facebook",
   que é outro fluxo, não é essa).
3. Passo 1 da tela: clique **"Add all required permissions"** (adiciona `instagram_business_basic`,
   `instagram_business_manage_messages`, `instagram_business_manage_comments`). Adicione manualmente
   também `instagram_business_content_publish` e `instagram_business_manage_insights` em
   **Permissões e recursos** (não vêm no botão automático).
4. Passo 2: em **Funções do app → Funções → Adicionar pessoas**, adicione a própria conta do
   Instagram (e qualquer conta de teste) com a função **"Testador"** (a opção "Testador do
   Instagram" é de uma API antiga/diferente — não usar). A conta convidada precisa aceitar o
   convite pelo Instagram → Central de Contas → **Conexões de apps**.
5. Ainda no passo 2, clique **"Adicionar conta"** para gerar o `INSTAGRAM_ACCESS_TOKEN`.
6. Passo 3: configure o webhook — **URL de Callback**: `https://SEU_DOMINIO/webhook/instagram`,
   **Token de Verificação**: o mesmo valor de `INSTAGRAM_VERIFY_TOKEN`.
7. **Inscrever a conta nos campos do webhook** (passo que não aparece na UI, só via API —
   sem isso nada chega no servidor):
   ```bash
   curl -X POST "https://graph.instagram.com/v21.0/{INSTAGRAM_ACCOUNT_ID}/subscribed_apps" \
     -d "subscribed_fields=comments,messages" \
     -d "access_token={INSTAGRAM_ACCESS_TOKEN}"
   ```
8. Para achar o `INSTAGRAM_ACCOUNT_ID`:
   ```bash
   curl "https://graph.instagram.com/v21.0/me?fields=id,username&access_token={INSTAGRAM_ACCESS_TOKEN}"
   ```
9. Defina no Render: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_VERIFY_TOKEN`.

⚠️ **Limitação conhecida**: mesmo com tudo configurado certo (inscrição confirmada, testadores
aceitos, webhook validado), comentários/DMs de contas reais **não chegam** no servidor enquanto
o app estiver em modo de desenvolvimento (Acesso Padrão) — confirmado testando exaustivamente
(ver seção abaixo). Isso só é liberado depois que a Meta aprova o **Acesso Avançado** via
Análise do App. Não é bug do código.

---

## Automações do Telegram (captação de contatos)

Bot do Telegram (Bot API, grátis, sem aprovação de negócio) usado só pra captar leads —
não tem histórico de conversa no painel como o WhatsApp/Instagram, só a lista de contatos
captados (tela **📨 Telegram**).

Fluxo:
1. Alguém abre o bot (link direto `t.me/seubot` ou com parâmetro de origem
   `t.me/seubot?start=campanha123`, útil pra saber de qual anúncio/campanha veio) e aperta **Start**.
2. O servidor responde com `TELEGRAM_START_MESSAGE` e um botão nativo "Compartilhar meu contato".
3. Ao tocar no botão, o Telegram entrega o telefone direto (sem o usuário digitar nada) — o
   servidor salva em `telegram_contacts` (telefone, nome, username, chat_id, parâmetro de
   origem) e responde com `TELEGRAM_THANKS_MESSAGE`.

### Como configurar

1. Crie o bot conversando com **@BotFather** no Telegram: `/newbot` → escolha um nome e um
   username terminado em `bot` → ele devolve o `TELEGRAM_BOT_TOKEN`.
2. Defina `TELEGRAM_BOT_TOKEN` no Render (e `TELEGRAM_WEBHOOK_SECRET` se quiser, qualquer
   string aleatória — usada só para o Telegram provar que a requisição é dele mesmo).
3. Registre o webhook (uma vez só, depois do deploy — troque `{TELEGRAM_BOT_TOKEN}` e
   `{TELEGRAM_WEBHOOK_SECRET}` pelos valores reais, e `SEU_DOMINIO` pela URL do Render):
   ```bash
   curl -X POST "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook" \
     -d "url=https://SEU_DOMINIO/webhook/telegram" \
     -d "secret_token={TELEGRAM_WEBHOOK_SECRET}"
   ```
4. Teste abrindo `t.me/seubot` e apertando Start — o contato deve aparecer na aba 📨 Telegram
   do painel.

⚠️ Diferente do WhatsApp/Instagram, o bot **nunca pode iniciar conversa** com quem nunca apertou
Start — a captação sempre depende de um clique inicial (anúncio, link na bio, QR code etc.),
não dá pra mandar mensagem pra uma lista de contatos existente.

---

## Geração de leads via LinkedIn (20/07/2026) — decisão deliberada de não automatizar o LinkedIn

Pedido do usuário: gerar leads via LinkedIn com filtro de cargo + sinal de quem saiu/mudou de
emprego recentemente. **Decisão tomada**: não construir nenhum bot/scraper que faça login e
navegue no LinkedIn automaticamente (é o que ferramentas tipo Phantombuster/Waalaxy fazem) —
viola os Termos de Uso do LinkedIn independente do plano (grátis, trial do Sales Navigator ou
pago), e o risco real é banimento da conta. **Isso não é uma trava técnica, é uma trava de ToS**
— não reconsiderar essa decisão sem o usuário assumir explicitamente o risco de outra forma.

O que existe hoje (aba **🔗 LinkedIn** no painel, ver seção "Interface do painel" acima) é só o
destino manual dos leads — cadastro via colar em massa, sem nenhuma automação tocando o
LinkedIn.

**Caminho legal recomendado para achar os leads** (trabalho manual do usuário, não automatizado):

1. **Sales Navigator (tem período de trial gratuito, ~30 dias)**: monta busca salva com filtro
   de cargo + "Changed jobs" (mudou de emprego nos últimos 90 dias — é o mais próximo que existe
   de "data de saída", só disponível no Sales Navigator, não no LinkedIn grátis) e ativa
   **"Alert me about new results"** — isso é 100% automação legítima porque é feature nativa do
   próprio LinkedIn (não é bot de terceiros). Copiar os resultados manualmente pra aba LinkedIn
   do painel.
2. Alternativa sem Sales Navigator: buscar `#opentowork` (selo que a pessoa mesma ativa quando
   está buscando recolocação — sinal de intenção mais forte que "mudou de emprego", e gratuito).
3. **Descoberta via Google (ainda não implementada)**: script que consulta a API gratuita do
   Google Custom Search (100 buscas grátis/dia) com `site:linkedin.com/in "cargo" "cidade"` —
   não toca o LinkedIn diretamente (só consulta o Google), então não tem o mesmo risco de ToS.
   Precisa de: API key do Google Custom Search + Search Engine ID (ambos gratuitos, o usuário
   cria em console.cloud.google.com e programmablesearchengine.google.com).
4. **Enriquecimento de e-mail (ainda não implementado)**: Hunter.io tem plano grátis (~25
   verificações/mês) pra tentar achar e-mail a partir de nome + domínio da empresa. Precisa de
   uma API key do usuário (cadastro em hunter.io).

Os itens 3 e 4 dependem do usuário gerar as respectivas chaves de API antes de eu poder
implementar a automação real (descoberta + enriquecimento) — sem elas, o fluxo é 100% manual
(colar na aba LinkedIn do painel).

---

## Status da Análise do App (Instagram) — onde paramos

**Atualização (18/07/2026): APROVADA — automações do Instagram funcionando para contas reais.**
App FELIZCRED publicado (tela **Publicar** do developers.facebook.com mostra "Publicado").
Rodado `GET /painel/api/instagram/diagnostico` nesse dia e os três testes vieram `ok:true`:
`basic` (`@felizcred`), `manage_comments` (leu comentários do último post) e `manage_messages`
(leu 25 conversas reais). Ou seja, as 3 automações da tabela acima (comentário → DM, reply de
story → DM, primeira DM → boas-vindas) estão ativas de verdade, sem precisar mais de conta
testadora. As pendências de configuração do item 5 abaixo (ícone do app, nome de exibição)
podem não ter sido resolvidas — não foram checadas nesse teste, só o acesso via API.

**Atualização (26/06/2026): CORRIGIDO — a Análise ainda está PENDENTE, não foi aprovada.**
Uma anotação anterior nesta sessão dizia "aprovada" por engano (confusão entre "enviado" e
"aprovado"). O alerta real do App Dashboard (aba **Alertas**) mostra: *"Análise do app: O app
foi enviado e está com a análise pendente"* — status **Normal**, enviado ontem. Ou seja, ainda
esperando a decisão da Meta sobre `instagram_business_basic` + `instagram_business_manage_messages`
(a primeira leva enviada). `manage_comments`, `content_publish` e `manage_insights` continuam
sem ter sido submetidas (ver próximos passos).

**Descoberta importante**: o status de Acesso Avançado por permissão **não é exposto pela
Graph API** — testado gerando um App Access Token (com App ID + Secret) e chamando
`/{app-id}/permissions`, que retorna vazio. Isso só aparece na tela
**Casos de uso → API do Instagram → Permissões e recursos** do App Dashboard — só o usuário
consegue ver isso, não tem como confirmar por API. Por isso a rota de diagnóstico abaixo (que
testa o *comportamento real* da API, não o *status declarado*) é o caminho mais confiável pra
uma conversa nova confirmar progresso sem depender de prints.

### Como checar isso SEM precisar de token nem acesso ao painel da Meta

O servidor já guarda `INSTAGRAM_ACCESS_TOKEN` como variável de ambiente no Render — uma
conversa nova não precisa que o usuário repasse token nenhum pra testar se a Análise liberou
o acesso de verdade. Existe uma rota de diagnóstico pronta pra isso:

```bash
curl -u USUARIO_DO_PAINEL:SENHA_DO_PAINEL https://SEU_DOMINIO/painel/api/instagram/diagnostico
```

Ela tenta, na hora, ler o perfil (`basic`), os comentários do último post
(`manage_comments`) e as conversas (`manage_messages`) usando o token real do servidor, e
devolve `{ ok: true/false, detalhe }` pra cada um. Se `manage_comments`/`manage_messages`
vierem `ok:false` com erro de permissão, a Análise ainda não cobriu isso (ou não propagou).
Se vierem `ok:true` com dados reais, a liberação funcionou — **não precisa mais pedir token a
ninguém pra confirmar isso**.

⚠️ Pedir ao usuário a credencial do painel (usuário/senha do Basic Auth) quando for rodar esse
comando — ela não deve ficar escrita aqui nem em nenhum arquivo do repositório.

### Próximos passos (em ordem) — começar por aqui na próxima conversa

0. Checar a aba **Alertas** do App Dashboard (onde saiu o print "análise pendente") — se já
   tiver virado aprovação/rejeição, pedir ao usuário pra mandar o texto/print novo antes de
   continuar.
1. Rodar o diagnóstico acima. Isso substitui ter que abrir o painel da Meta manualmente pra
   conferir "Permissões e recursos" — funciona mesmo com a Análise ainda pendente (testa
   acesso real, não o status declarado).
2. Se `manage_comments`/`manage_messages` ainda derem `ok:false`: aí sim é preciso o **usuário**
   (não o Claude — não temos acesso à tela) ir em **Casos de uso → API do Instagram →
   Permissões e recursos** conferir se o contador de "chamada de API obrigatória" já fechou
   "1 de 1", e se sim, submeter uma segunda Análise só com as permissões que faltam
   (`instagram_business_manage_comments`, `instagram_business_content_publish`,
   `instagram_business_manage_insights`).
3. Enquanto isso, pedir ao usuário pra comentar numa foto e mandar uma DM nova de qualquer
   conta (não precisa mais ser testadora) — depois rodar o diagnóstico de novo pra confirmar
   que passou a aparecer dado real.
4. `content_publish` não tem um teste de só-leitura — só confirma publicando de fato (comando
   de publicação real já documentado/testado anteriormente nesta conversa).
5. Pendências de configuração do app que só o usuário pode editar (precisam de print pra eu
   orientar, não tenho acesso à tela): nome de exibição "Felizcred" (estava genérico "App"),
   ícone do app (ainda é o ícone padrão de balão de mensagem — falta logo real da Felizcred em
   formato quadrado 512-1024px), URL dos Termos de Serviço (`https://SEU_DOMINIO/termos`) e
   URL de exclusão de dados (`https://SEU_DOMINIO/privacidade`) — ambas estavam apontando por
   engano para facebook.com.

---

## Campanhas de Anúncios (API de Marketing)

Gerenciamento de campanhas pagas (Instagram/Facebook) via Marketing API, pedido direto no chat
— sem formulário no painel. Módulo `ads.js`, rotas em `server.js`, visualização/controle no
painel (botão 📊 — lista campanhas com gasto/impressões/cliques/CTR, pausa/ativa).

### App FELIZCRED publicado (18/07/2026) — bloqueio de `POST /adcreatives` removido

O app saiu do modo de desenvolvimento (tela **Publicar** no developers.facebook.com mostra
status "Publicado"). Testado nesse dia com token avulso (`ads_management`+`ads_read`): o erro
1885183 ("app não publicado") **não ocorre mais** — `POST /adcreatives` agora responde com
erros normais de validação de parâmetro (ex: ID de mídia do Instagram desatualizado), não mais
com bloqueio de plataforma. Ou seja, a partir de agora **dá pra criar o criativo direto via API**
(`criarCreativoDePublicacaoInstagram` em `ads.js`), sem precisar mais do passo manual "usuário
cria o primeiro anúncio no Gerenciador" descrito na receita abaixo — mas a receita continua
documentada como fallback caso algo volte a travar.

Detalhe descoberto no teste: o `source_instagram_media_id` salvo de campanhas antigas
(`3588869927198956744`, post DHOOi8jxpzI) não é mais aceito ("must be a valid Instagram media
V2 ID") — precisa buscar o ID atual antes de reusar. Instagram Business ID da conta conectada:
`17841405493321848` (obtido via `GET /act_{AD_ACCOUNT_ID}/instagram_accounts`). Buscar a lista
de mídia (`GET /{instagram_business_id}/media`) exige um token com `instagram_business_basic`,
que o token de Marketing API (só `ads_management`/`ads_read`) não tem.

### Configuração já feita

- Caso de uso "Criar e gerenciar anúncios com a API de Marketing" adicionado ao app
  (`ads_management`, `ads_read`) — **não precisou de Análise do App**, diferente do Instagram,
  porque é a própria conta de anúncios do usuário (não de terceiros).
- Conta de anúncios: `act_945463391448600` (pessoal, moeda BRL, cartão configurado).
- Instagram `@felizcred` conectado a essa conta de anúncios (Business Manager → Contas do
  Instagram → "Conectar ativos" → Contas de anúncios) — necessário para anunciar publicações
  existentes do Instagram.
- Token de acesso trocado por um de **longa duração** (60 dias, gerado em 26/06/2026 —
  **expira por volta de 25/08/2026**). Pra renovar quando vencer: gerar um token curto em
  **Casos de uso → Ferramentas → Obter token de acesso** (marcar `ads_management` e
  `ads_read`) e trocar por um longo:
  ```bash
  curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN_CURTO}"
  ```
- Variáveis no Render: `META_ADS_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (`act_945463391448600`).

### Como pedir uma campanha nova

Não tem tela — basta pedir no chat (ex: "crie uma campanha de R$25/dia pra consignado CLT,
foco em gerentes de supermercado SC/RS"). Toda campanha é **criada pausada**; revisão e
ativação são manuais (painel → 📊, ou Gerenciador de Anúncios).

### Como pesquisar público (cargo, interesse, localização)

```bash
curl -G "https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/targetingsearch" \
  --data-urlencode "q={termo}" \
  --data-urlencode "type=adworktitle" \   # ou adinterest, adgeolocation
  --data-urlencode "access_token={TOKEN}"
```
Tipos úteis: `adworktitle` (cargo autodeclarado), `adinterest` (interesses/comportamentos),
`adgeolocation` (estado/cidade — usar `location_types=["region"]` pra estado).

Antes de criar o conjunto de anúncios, testar o tamanho do público:
```bash
curl -G "https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/delivery_estimate" \
  --data-urlencode "optimization_goal=CONVERSATIONS" \
  --data-urlencode "targeting_spec={JSON da segmentação}" \
  --data-urlencode "access_token={TOKEN}"
```

### O que aprendemos sobre público de nicho (gerente de supermercado/mercearia, SC+RS)

- O Meta **não tem** cargo "gerente de supermercado" nem targeting por rede/empregador
  (testamos Koch, Angeloni, Bistek — nada relevante). O mais próximo é o cargo genérico
  **"Gerente"** (id `137453372957907`, autodeclarado no perfil — não confundir com
  comportamento "Administrador de Página sobre Varejo", que é perfil de pequeno
  dono/comerciante, não de gerente contratado).
- Interesses do setor: **Supermercado** (`6003061708328`), **Mercearia** (`6003174128015`),
  **Frios** (`6003142965761`).
- **E** (Gerente E interesse no setor, SC+RS) = público minúsculo, **~3 mil pessoas** — risco
  real de não entregar.
- **OU** (Gerente OU interesse no setor) = público gigante, **~3,2 a 3,7 milhões** —
  praticamente igual a usar só os interesses soltos (provável causa da instabilidade nas
  campanhas antigas: CSV mostrava custo por resultado de R$0,27 a R$56,79, com vários
  "not_delivering").
- Interesses de liderança/gestão/MBA genéricos são enormes (200-560 milhões, não ajudam a
  filtrar) e como área de formação acadêmica são minúsculos no mundo todo (7-11 mil, não dão
  volume). Nenhuma combinação resolve o meio-termo — é limitação real da plataforma pra esse
  nicho, não falta de tentativa.
- **Decisão tomada**: seguir com uma série de testes A/B aceitando alguma imprecisão de
  público — a qualificação real do lead acontece **manualmente na conversa do WhatsApp**
  (perguntar/confirmar se quem respondeu é de fato gerente de supermercado/mercearia ali, não
  tentar resolver isso na segmentação do anúncio). Variantes definidas:
  - **A**: público restrito (Gerente E Supermercado/Mercearia/Frios, SC+RS, ~3 mil) como
    semente, com Expansão de Segmentação Detalhada do Meta ligada (deixa o algoritmo achar
    parecidos além da definição literal).
  - **B**: só localização (SC+RS) + idade 24-58, sem interesse/cargo nenhum — 100%
    Advantage+, deixando o Meta otimizar livre pra "Conversas por mensagem".
- Criativo: usar a publicação já existente do Instagram via `source_instagram_media_id`
  (ex: `3588869927198956744`) em vez de subir imagem nova — exige o Instagram conectado à
  conta de anúncios (já feito, ver acima).
- A funcionalidade de **Audiência Salva** (`/saved_audiences`) está bloqueada pro app
  ("Application does not have the capability") — não impede nada, só não dá pra salvar a
  segmentação como objeto reutilizável; ela vai direto no conjunto de anúncios na hora de criar.

### Teste A/B definido em 06/07/2026 (substitui o desenho anterior de 2 variantes)

6 campanhas, todas com **R$5,80/dia**, criadas **ativas**, rodando até **sexta 10/07/2026
23:59** (horário de Brasília), objetivo Conversas por mensagem (WhatsApp), criativo da
publicação existente do Instagram (`source_instagram_media_id: 3588869927198956744`,
mesma do link instagram.com/p/DHOOi8jxpzI):

| Campanha | Público |
|---|---|
| RS - Gerente - Homem | RS, homens 25+, cargo "Gerente" (`137453372957907`), sem interesses |
| RS - Gerente - Mulher | RS, mulheres 25+, idem |
| SC - Variante A - Homem | SC, homens 25+, Gerente **E** Supermercado/Mercearia/Frios, expansão ligada |
| SC - Variante A - Mulher | SC, mulheres 25+, idem |
| SC - Variante B - Homem | SC, homens 25+, sem cargo/interesse (Advantage+) |
| SC - Variante B - Mulher | SC, mulheres 25+, idem |

**Quinta-feira 09/07/2026 às 9h**: pausar a campanha de pior resultado (painel 📊 ou pedir no
chat). Sexta: comparar todas e decidir a vencedora.

### Status (06/07/2026 à noite): teste A/B COMPLETO e NO AR

As 6 campanhas estão completas (campanha + conjunto + anúncio), ativas, com o primeiro
anúncio já aprovado e os demais em revisão da Meta. O anúncio usa a publicação do Instagram
DHOOi8jxpzI com botão de WhatsApp (criativo `1028074113254702`, criado pelo usuário no
Gerenciador de Anúncios e **reaproveitado via API nos outros 5 conjuntos** — descoberta
importante: o bloqueio de app em desenvolvimento vale só pra `POST /adcreatives`; criar
`POST /ads` referenciando `creative_id` existente funciona normal).

### Detalhe da criação original (mantido para referência)

As 6 campanhas + conjuntos foram criados via API em 06/07/2026, **ativos**, orçamento
R$5,80/dia cada, término automático 10/07/2026 23:59. **Sem anúncio dentro** (não roda nem
gasta até ter anúncio). IDs:

| Campanha | ID campanha | ID conjunto |
|---|---|---|
| Felizcred RS - Gerente - Homem | 120248549614840006 | 120248549615270006 |
| Felizcred RS - Gerente - Mulher | 120248549615530006 | 120248549616760006 |
| Felizcred SC - A GerenteSetor - Homem | 120248549619110006 | 120248549620440006 |
| Felizcred SC - A GerenteSetor - Mulher | 120248549620730006 | 120248549620850006 |
| Felizcred SC - B Aberto - Homem | 120248549621090006 | 120248549621290006 |
| Felizcred SC - B Aberto - Mulher | 120248549621820006 | 120248549622090006 |

**Os anúncios em si o usuário cria no Gerenciador de Anúncios** (1 por conjunto, usando a
publicação existente do Instagram DHOOi8jxpzI + botão WhatsApp, e duplicando para os demais
conjuntos), porque a criação de criativos via API está bloqueada: **o app FELIZCRED está em
modo de desenvolvimento e a Meta bloqueia `POST /adcreatives` de apps não publicados**
(erro 1885183), inclusive com imagem própria. Publicar o app travou em "requisitos
incompletos" (o campo "Exclusão de dados do usuário" do Básico reverte sozinho para
facebook.com ao salvar — bug/validação da Meta não resolvido).

### RECEITA para criar anúncios em lote (processo combinado com o usuário)

Enquanto o app FELIZCRED estiver em modo de desenvolvimento, `POST /adcreatives` é bloqueado
(erro 1885183), mas `POST /ads` reaproveitando um `creative_id` existente **funciona**.
O processo combinado é:

1. Claude cria via API as campanhas + conjuntos (segmentação, orçamento, datas, destino
   WhatsApp) — isso nunca é bloqueado.
2. O **usuário cria só o PRIMEIRO anúncio** no Gerenciador de Anúncios, dentro de um dos
   conjuntos ("Usar posts existentes" → post do Instagram → botão WhatsApp). Sem aceitar
   nenhuma recomendação Advantage+ (elas desmontam a segmentação do teste).
3. Claude roda `listarAnuncios()` (`ads.js`) pra pegar o `creative{id}` do anúncio criado e
   replica nos demais conjuntos com `criarAnuncio({ conjuntoId, creativoId, status })` —
   1 chamada por conjunto, sem UI. Foi assim que os 5 anúncios restantes do teste de
   06/07/2026 foram criados (criativo `1028074113254702`).
4. Duplicar pelo Gerenciador **não** funciona bem entre campanhas diferentes (a cópia perde
   Página/Instagram/post e trava a edição) — não perder tempo com isso de novo.

### Aprendizados da API de Marketing (custou horas — não redescobrir)

- `POST /campaigns` agora **exige `is_adset_budget_sharing_enabled: true|false`** quando não
  usa orçamento de campanha (usamos `false` p/ teste A/B limpo).
- `POST /adsets` exige `bid_strategy` explícita (usamos `LOWEST_COST_WITHOUT_CAP`) e, p/ novos
  adsets, `targeting.targeting_automation.advantage_audience` (0 = mantém gênero/idade rígidos).
- `targeting_optimization` foi **removido** — a Expansão de Segmentação Detalhada agora é
  automática (a variante A ganha expansão sem configurar nada).
- Anúncio de WhatsApp (`destination_type: WHATSAPP`) exige `promoted_object: { page_id }` de
  Página com **WhatsApp Business** conectado (conta pessoal vinculada → erro 2446885).
  Criamos a Página **"Feliz cred correspondente bancario" (1119238764613554)** com o número
  +55 47 99686-4687 conectado como principal, e o @felizcred vinculado a ela.
- Chaves de região (`/search?type=adgeolocation&location_types=["region"]`): RS = 456, SC = 459.
- `source_instagram_media_id` exige o **ID Graph/V2** da mídia (ex: 18385327756113225 para o
  post DHOOi8jxpzI), não o ID decodificado do link. Dá pra obter via rota
  `/painel/api/instagram/publicacoes` (tem `media_url` também).
- Imagem já subida na conta de anúncios: hash `031e9c81e64cd593b5fdc74f3d02029a` (imagem do
  post DHOOi8jxpzI, "IMPORTANTE! Gerente ou supervisor").
- O rascunho antigo "Felizcred - Teste A/B Gerentes Varejo SC-RS [RASCUNHO]" (26/06, pausado,
  sem anúncios) continua lá — pode ser apagado quando o usuário quiser.

### RESULTADO FINAL do teste (06→10/07/2026, apurado 11/07)

Gasto total R$147,60 · 19 conversas iniciadas · média R$7,77/conversa:

| Campanha | Conversas | Custo/conversa | CTR |
|---|---|---|---|
| 🏆 SC - B Aberto - Homem | 8 | R$3,04 | 1,77% |
| RS - Gerente - Homem | 4 | R$6,17 | 0,86% |
| RS - Gerente - Mulher | 3 | R$8,19 | 0,77% |
| SC - A Gerente+Setor - Mulher | 2 | R$12,33 | 0,93% |
| SC - A Gerente+Setor - Homem | 1 | R$24,67 | 0,93% |
| SC - B Aberto - Mulher | 1 | R$24,66 | 0,99% |

**Rodada 2 (11→16/07/2026)**: reativadas em 11/07 as duas vencedoras — **SC - B Aberto -
Homem** e **RS - Gerente - Homem** — com R$7,70/dia cada (R$85 total dividido entre as
duas até quinta 16/07 23:59, pedido do usuário). Mesmos anúncios já aprovados (sem nova
revisão). O fluxo do WhatsApp reformulado em 11/07 recebe esses leads. Ainda em 11/07,
somaram-se:
- **RS - Gerente - Mulher** reativada: R$5,70/dia até terça 14/07 23:59 (R$20 total).
- **RS - Gerente Varejo - Homem** (NOVA, campanha `120248732836350006`): filtro diferente
  pra chegar em gerente de varejo — (cargos Supervisor `104372906264935` OU GERENTE
  COMERCIAL/DEP.VENDAS `257037871086800` OU Gerente Regional de Vendas `138347752858893`
  OU comportamento Administradores de lojas `6377178995383`) **E** interesses (Varejo
  `6003778400853` OU Supermercado OU Mercearia), RS, homens 25+, público-semente estimado
  4,6-5,4 mil. Orçamento mínimo da Meta (**piso descoberto: R$5,23/dia**) → R$5,30/dia,
  até quarta 15/07 23:59. Justificativa do usuário: no RS "é melhor fazer processo".
- Total no ar na rodada 2: 4 campanhas (~R$26,40/dia somadas, términos automáticos ter/qua/qui).

**RESULTADO da rodada 2 (11→16/07/2026, apurado 16/07)** — R$119,38 gastos, 14 conversas
(R$8,53/conversa; rodada 1 foi R$7,77):

| Campanha | Gasto | Conversas | Custo/conversa | Obs |
|---|---|---|---|---|
| SC - B Aberto - Homem | R$38,56 | 8 | R$4,82 | caiu de R$3,04; zerou nos 2 últimos dias |
| RS - Gerente - Homem | R$38,33 | 3 | R$12,78 | dobrou o custo (era R$6,17); frequência ~2 |
| RS - Gerente - Mulher | R$19,23 | 0 | — | zero; cortar de vez |
| RS - Gerente Varejo - Homem (novo) | R$23,26 | 3 | R$7,75 | CTR 0,75%; filtro não superou o aberto |

**Porém, no funil do WhatsApp o custo por lead QUALIFICADO melhorou**: 22 conversas novas
no painel, 15 clicaram TRABALHO/TRABALHEI (68%), 4 completaram até nome/cidade e 2
escolheram produto na lista nova (SAQUE FGTS e CARRO EM GARANTIA) = 6 leads aproveitáveis
→ **R$19,90/lead** vs R$24,60 na rodada 1. O fluxo reformulado + lembretes seguraram mais
gente até o fim.

**Diagnóstico da queda nas conversas**: fadiga de criativo/público — a mesma imagem (post
de março) rodou 10 dias seguidos nos mesmos públicos pequenos; frequência chegou a ~2 no
RS, CPM subiu (R$17-20) e a campeã zerou conversas em 15-16/07. **Próxima alavanca é
trocar o criativo** (nova imagem/vídeo, 2-3 variações no público vencedor SC aberto
homem), não testar mais públicos. Lookalike ainda não é viável (~50 contatos; precisa ~100).

**Conclusões** (rodada 1): (1) público aberto (Advantage) venceu a segmentação detalhada por 3x —
qualificar no fluxo do WhatsApp, não no targeting, foi a decisão certa; (2) homens
respondem muito mais a esse criativo (13 x 6 conversas); (3) a vencedora também teve
conversas mais profundas (6 first_reply e 3 leads registrados pela Meta); (4) RS só-cargo
ficou no meio-termo. **Próxima rodada sugerida** (não criada ainda): público aberto,
homens 25+, SC e RS (o aberto não chegou a ser testado no RS). Antes de escalar, conferir
no painel a **qualidade** das 19 conversas (quantas clicaram TRABALHO/TRABALHEI na triagem).
- Mais adiante (não decidido ainda): testar Público Semelhante (Lookalike) a partir dos
  contatos reais que já converteram no WhatsApp/Instagram — tende a performar melhor que
  qualquer combinação manual de cargo/interesse, mas precisa de volume mínimo de contatos
  (~100+) e ainda não foi avaliado se já temos isso no banco.

---

## Estado atual do projeto (resumo)

- Backend Node puro (`server.js`) + `db.js` (Turso) + `whatsapp.js` (chamadas à Graph API)
- Deploy no **Render** (free tier), repositório em `github.com/salvadorfelipee-creator/meuwhats`
- Histórico de conversas no **Turso** (permanente); mídias (fotos/áudios/vídeos) só no disco
  do Render (não permanente — ver aviso acima)
- Dois números WhatsApp Business conectados, com abas no painel
- Envio em massa via template implementado (botão 📢 no painel) — template `aviso_taxa_clt`
  aprovado e testado
- Resposta automática aos botões do template (`Quero saber mais` / `Não quero receber mais`)
- Automações do Instagram implementadas no código (comentário→DM, story reply→DM, primeira
  DM→boas-vindas), publicação e leitura de insights via API — Análise do App **aprovada**
  (confirmado via diagnóstico em 18/07/2026, ver seção "Status da Análise do App"). Rota
  `/painel/api/instagram/diagnostico` criada pra checar acesso real sem precisar de prints do
  App Dashboard. Mensagem trocada por um **menu de 5 opções** que gera link `wa.me` pro
  WhatsApp conforme a escolha (ver seção "Automações do Instagram") — implementado em
  18/07/2026, **ainda não testado em produção** (falta deploy + teste real).
- Páginas públicas de Política de Privacidade (`/privacidade`) e Termos de Uso (`/termos`)
  publicadas, usadas na Análise do App
- Gerenciamento de campanhas de anúncios via API de Marketing implementado (`ads.js` + rotas +
  botão 📊 no painel) — conta de anúncios e Instagram conectados e testados; pesquisa de
  público (cargo/interesse/localização) feita e documentada na seção "Campanhas de Anúncios"
  acima; falta decidir orçamento e criar de fato a campanha A/B (pausada)
- Atendimento automático com botões no WhatsApp implementado em 06/07/2026 (menu inicial para
  conversa nova/inativa 24h + fluxo do anúncio de gerente — ver seção própria acima). Pendente:
  o usuário vai definir o fluxo do botão CONSIGNADO CLT (hoje é resposta provisória).
- Aba **🔗 LinkedIn** no painel implementada em 20/07/2026 pra cadastro manual de leads (colar em
  massa) — ver seção "Geração de leads via LinkedIn" pra entender por que não existe automação de
  scraping do LinkedIn (decisão deliberada de ToS) e quais os próximos passos (script de
  descoberta via Google + enriquecimento de e-mail via Hunter.io), ambos pendentes de o usuário
  gerar as respectivas chaves de API grátis.

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
| `GET /privacidade`                                               | Política de privacidade (pública)           |
| `GET /termos`                                                    | Termos de uso (pública)                     |
| `GET /painel/api/instagram/perfil`                               | Perfil do Instagram conectado (auth)        |
| `GET /painel/api/instagram/insights`                             | Métricas do último post (auth)              |
| `POST /painel/api/instagram/reset-boasvindas`                    | Limpa quem já recebeu boas-vindas (auth)    |
| `GET /painel/api/instagram/diagnostico`                          | Testa basic/manage_comments/manage_messages de verdade, sem precisar de token (auth) |
| `GET /painel/api/instagram/comentarios`                          | Comentários do último post (auth)           |
| `GET /painel/api/instagram/conversas`                            | Lista conversas (DMs) do Instagram (auth)   |
| `GET /painel/api/ads/campanhas`                                  | Lista campanhas de anúncios com métricas (auth) |
| `POST /painel/api/ads/:id/status`                                | Pausa/ativa campanha, conjunto ou anúncio (auth) |
| `POST /webhook/telegram`                                          | Recebe updates do bot do Telegram (`/start`, contato compartilhado) |
| `GET /painel/api/telegram/contacts`                               | Lista contatos captados pelo bot do Telegram (auth) |
| `GET /painel/api/linkedin/leads`                                  | Lista leads do LinkedIn adicionados manualmente (auth) |
| `POST /painel/api/linkedin/leads`                                 | Adiciona um ou mais leads colados do Sales Navigator (auth) |
| `POST /painel/api/linkedin/leads/:id/status`                      | Marca lead como contatado/descartado (auth) |

### Interface do painel (`public/painel.html`)

Redesenhado em 26/06/2026 para um layout minimalista (paleta neutra/terracota, sem
dependências novas — continua HTML/CSS/JS puro, sem build step) com uma navegação lateral
de ícones que troca entre três telas dentro da mesma página:

- **💬 WhatsApp** — lista de conversas + chat (era a tela única antes), envio em massa
  continua em modal.
- **📸 Instagram** — perfil conectado, métricas do último post, comentários do último post
  e lista de conversas (DMs), botão de resetar boas-vindas (usa as rotas
  `/comentarios` e `/conversas` criadas junto com esse redesign).
- **📊 Ads Manager** — lista de campanhas (era um modal antes, agora é página própria),
  pausar/ativar.
- **📨 Telegram** — lista de contatos (leads) captados pelo bot, com telefone, username e
  parâmetro de origem (campanha) quando disponível.
- **🔗 LinkedIn** — lista de leads (nome, cargo, empresa, e-mail, link do perfil) adicionados
  manualmente via botão "Adicionar leads" (cola em massa, um por linha, formato
  `nome,cargo,empresa,email,link`). Existe pra dar suporte ao fluxo de geração de leads pelo
  LinkedIn (ver seção própria abaixo) — não há automação de scraping do LinkedIn em si (decisão
  deliberada, ver seção "Geração de leads via LinkedIn"), só o cadastro/acompanhamento manual dos
  leads encontrados por lá. Cada lead tem status `novo`/`contatado`/`descartado`, ajustável pelos
  botões no card.

**Notificações de mensagem nova (WhatsApp)** — botão 🔔 no cabeçalho da aba WhatsApp pede
permissão de notificação do navegador (`Notification` API). Com permissão concedida, toda
mensagem recebida (em qualquer um dos números configurados em `PHONE_NUMBERS_JSON`, mesmo
o que não está com a aba aberta no momento) dispara uma notificação do navegador e marca um
indicador visual (bolinha laranja) na aba do número e no ícone 💬 do menu lateral; clicar na
notificação leva direto pra conversa. Implementado via polling de 5s (`verificarNovasMensagens`
em `painel.html`) comparando `last_message_at`/`last_direction` de `/painel/api/conversations/:businessId`
— precisou adicionar `last_direction` na query `listConversations` em `db.js` pra saber se a
última mensagem foi recebida (não notifica para mensagens que você mesmo enviou). Funciona
só com a aba do navegador aberta (sem service worker / push em segundo plano).

Se quiser ir além de HTML/CSS/JS puro no futuro (ex.: migrar para React/Tailwind/shadcn),
isso é uma mudança de arquitetura grande (build step novo, mudar como `server.js` serve os
arquivos) — converse com o usuário antes, não assuma.
