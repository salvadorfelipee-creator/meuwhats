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
| `INSTAGRAM_ACCOUNT_ID` | ID numérico da conta profissional do Instagram      | —                     |
| `INSTAGRAM_VERIFY_TOKEN` | Token de verificação do webhook do Instagram    | `meu_token_secreto_instagram` |
| `INSTAGRAM_COMMENT_REPLY` | Texto enviado por DM ao comentar em um post    | (ver seção Instagram) |
| `INSTAGRAM_WELCOME_MESSAGE` | Texto de boas-vindas (primeira DM / reply de story) | (ver seção Instagram) |
| `META_ADS_ACCESS_TOKEN` | Token de acesso da API de Marketing (campanhas de anúncios) | — |
| `META_AD_ACCOUNT_ID` | ID da conta de anúncios, formato `act_XXXXXXXXX`        | —                     |

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

## Status da Análise do App (Instagram) — onde paramos

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

### Pendente

- Decidir orçamento diário de cada variante (A e B) e criar de fato campanha + conjuntos +
  anúncios (pausados) via `ads.js` (`criarCampanha`, `criarConjuntoAnuncios`, `criarCreativo`
  com `source_instagram_media_id`, `criarAnuncio`).
- Ativar manualmente depois de revisar (painel → 📊 ou Gerenciador de Anúncios).
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
  DM→boas-vindas), publicação e leitura de insights via API — Análise do App **ainda
  pendente** (enviada, sem decisão da Meta até 26/06/2026; ver seção "Status da Análise do
  App", é o ponto de partida da próxima conversa). Rota `/painel/api/instagram/diagnostico`
  criada pra checar acesso real sem precisar de prints do App Dashboard.
- Páginas públicas de Política de Privacidade (`/privacidade`) e Termos de Uso (`/termos`)
  publicadas, usadas na Análise do App
- Gerenciamento de campanhas de anúncios via API de Marketing implementado (`ads.js` + rotas +
  botão 📊 no painel) — conta de anúncios e Instagram conectados e testados; pesquisa de
  público (cargo/interesse/localização) feita e documentada na seção "Campanhas de Anúncios"
  acima; falta decidir orçamento e criar de fato a campanha A/B (pausada)
- Pendente/possível próximo passo (mais antigo, não retomado ainda): mensagem automática com
  botões para conversas inativas há mais de 24h no WhatsApp (decisão de igual/diferente por
  número em aberto)

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
| `GET /painel/api/ads/campanhas`                                  | Lista campanhas de anúncios com métricas (auth) |
| `POST /painel/api/ads/:id/status`                                | Pausa/ativa campanha, conjunto ou anúncio (auth) |
