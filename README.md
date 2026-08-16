# WhatsApp Webhook + Painel

Servidor para receber e responder mensagens via API Oficial do WhatsApp (Meta Cloud API),
com um painel web simples para ver conversas, fotos, áudios e responder.

---

## ⚠️ Mapa dos sistemas neste repositório (leia antes de editar)

Este único repositório Git (`meuwhats` no GitHub) hospeda **três coisas
independentes**, cada uma com seu próprio deploy. Não são a mesma aplicação —
só compartilham o histórico do Git:

| Sistema | Pasta | Onde roda | Domínio |
|---|---|---|---|
| **Painel de WhatsApp/Instagram/Telegram** (este README) | raiz (`server.js`, `db.js`, `painel/`...) | **Render** (deploy automático a cada push) | `meuwhats.onrender.com` |
| **Site institucional FelizCred** | `felizcred-site/` | **Vercel**, projeto `meuwhats`, Root Directory = `felizcred-site` | `www.felizcred.com.br` |
| **Cota Certa Seguros** | `cotacerta-seguros/` | **Vercel**, projeto separado `cotacerta-seguros`, Root Directory = `cotacerta-seguros` | `cotacertaseguros.com.br` |

Detalhes de cada site estático ficam em
[`felizcred-site/README.md`](./felizcred-site/README.md) e
[`cotacerta-seguros/README.md`](./cotacerta-seguros/README.md). Regras
importantes pra não misturar:

- **Nenhum dos três compartilha código, banco de dados, variáveis de ambiente
  ou segredos** com os outros — são deploys 100% isolados, só o `git push`
  em `main` é comum a todos (cada um escuta e redeploya sozinho).
- `www.felizcred.com.br/cotacerta/*` (endereço antigo, de quando a Cota
  Certa vivia como subpasta) hoje é só um **redirect 308** pra
  `www.cotacertaseguros.com.br/*` (configurado no `vercel.json` de
  `felizcred-site/`). A pasta `cotacerta-seguros/` **não pode voltar** pra
  dentro de `felizcred-site/` — enquanto ela morou lá, a Vercel servia o
  arquivo estático real antes de checar o redirect, e o redirect nunca era
  alcançado. Todo link/imagem interno dentro de `cotacerta-seguros/` usa
  **caminho relativo** (`img/logo.png`, `cotar/`, `../blog/`) — nunca
  absoluto.
- Editar algo do painel de WhatsApp (este README, `server.js`, `db.js`) nunca
  afeta os sites, e vice-versa.

### 🚨 Se o site felizcred.com.br parecer desatualizado ou com posts "sumidos"

**NÃO é bug de código.** Antes de mexer em qualquer arquivo, confira o DNS —
foi exatamente isso que aconteceu em 13/08/2026: o domínio voltou a resolver
pra hospedagem antiga da Hostinger (servindo uma cópia congelada de 18/07,
com só 32 posts) em vez do Vercel, mesmo com o código/commits todos corretos
e publicados.

**Como confirmar rápido:** `nslookup felizcred.com.br` — se o IP não for
`216.198.79.1` (ou não resolver pro Vercel), é DNS, não código.

**Os registros corretos no Zone Editor da Hostinger** (painel da Hostinger →
domínio `felizcred.com.br` → DNS/Nameservers):

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `cname.vercel-dns.com` |

Todos os outros registros daquela tela (MX, os CNAME de `hostingermail-*`,
`brevo*._domainkey`, `autodiscover`, `autoconfig`, o TXT `_dmarc`/SPF/
`brevo-code`, o A de `ftp`) são de **e-mail e verificação**, não mexem no
site — nunca precisam mudar.

⚠️ **Nunca clicar em "Redefinir registros DNS"** no Zone Editor da Hostinger
— esse botão apaga os dois registros customizados acima e volta tudo pro
padrão de hospedagem deles (`ALIAS @` e `CNAME www` apontando pra
`*.cdn.hstgr.net`), causando exatamente esse sumiço. É a causa mais provável
do que aconteceu em 13/08.

Depois de corrigir, confirme no Vercel em **Project → Settings → Domains**:
`felizcred.com.br` e `www.felizcred.com.br` devem aparecer com selo verde
"Valid Configuration" (um selo laranja "DNS Change Recommended" é só
sugestão opcional, não erro — o site funciona normalmente assim).

---

## Funcionalidades

- Recebe mensagens (texto, imagem, áudio, vídeo, documento) via webhook
- Baixa e guarda mídias localmente (pasta `media/`)
- Guarda histórico (conversas e mensagens) no **Turso** (SQLite hospedado, gratuito)
- Painel web em `/painel` (protegido por usuário/senha) para ver conversas e responder,
  com status de conversa (Novo/Em andamento/Resolvido), notas por contato, respostas
  prontas reutilizáveis e busca por texto dentro das mensagens
- Suporta **múltiplos números de WhatsApp Business** ao mesmo tempo, com abas no painel
- Atualiza status de entrega/leitura das mensagens enviadas
- Envio em massa via **Template de Mensagem** (botão 📢 no painel), para contatos que ainda não conversaram
- **Atendimento automático com botões**: menu inicial para conversa nova/inativa há 24h + fluxo de triagem do anúncio de gerente (ver seção abaixo)
- Automações do **Instagram**: resposta automática a comentários, a replies de Story e boas-vindas na primeira DM
- **Publique IV** (aba 🚀 "Publicar" no painel): publica o mesmo conteúdo em Instagram, Facebook, X/Twitter e LinkedIn com um clique — ver [`PUBLIQUE-IV.md`](./PUBLIQUE-IV.md)

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
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Token de acesso da Página do Facebook (`pages_manage_posts` + `pages_manage_metadata`) | — |
| `FACEBOOK_PAGE_ID` | ID numérico da Página do Facebook | — |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Chaves do App no X Developer Portal | — |
| `TWITTER_ACCESS_TOKEN` / `TWITTER_ACCESS_SECRET` | Token de acesso da conta (gerado no mesmo App) | — |
| `LINKEDIN_ACCESS_TOKEN` | Token OAuth2 do App LinkedIn (escopo `w_member_social` ou `w_organization_social`) | — |
| `LINKEDIN_AUTHOR_URN` | `urn:li:person:XXX` (perfil) ou `urn:li:organization:XXX` (Página da empresa) | — |
| `R2_ENDPOINT` | Endpoint da conta no Cloudflare R2 (Reels em massa — ver PUBLIQUE-IV.md) | — |
| `R2_BUCKET` | Nome do bucket do R2 com os vídeos a publicar | — |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Token de API do R2 (permissão Object Read & Write) | — |
| `PUBLIC_URL` | URL pública do servidor (usada pelo auto-ping e pra montar a URL do vídeo que o Instagram busca) | `https://meuwhats.onrender.com` |

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

### 3. Botões do template abrindo um fluxo automático próprio

Cada template pode ter até 3 botões de resposta rápida. Quando a pessoa clica, a Meta manda
o texto do botão pro webhook — o servidor casa esse texto (sem acento/maiúscula) no mapa
`RESPOSTAS_BOTAO` (`server.js`) e manda a resposta automática correspondente. Opcionalmente,
a entrada pode ter um `passo`, que marca a conversa nesse passo do fluxo pra a próxima
mensagem de texto da pessoa cair num `capturaTexto` dedicado — em vez de ficar solta sem
automação, ou pior, colidir com o fluxo do menu principal.

**Importante**: cada template novo precisa de textos de botão **diferentes** dos já usados
por outros templates. Se dois templates reusassem "QUERO SABER MAIS", não daria pra saber
qual campanha originou o clique — as duas cairiam na mesma resposta.

Exemplo já implementado — template `oferta_consignado_clt` (campanha genérica, **sem
variável nenhuma** — mesma mensagem curta pra toda a lista, categoria Marketing, a mais
barata pra essa conta):

- **Categoria**: Marketing
- **Corpo**: `Olá! 👋 Você pode ter uma condição especial de consignado CLT disponível. Quer saber mais?`
- **Botões**: `QUERO SIMULAR` (leva pro passo `campanha_clt_dados`, que pede nome/CPF/telefone/
  e-mail/data de nascimento e confirma assim que reconhece um CPF na resposta) e
  `NÃO TENHO INTERESSE` (só agradece, sem marcar passo — fluxo termina ali)
- **Contatos no painel**: só `telefone` por linha (sem variável, não precisa de segunda coluna)

Esse template ainda precisa ser criado manualmente no Gerenciador do WhatsApp (passo 1 acima)
e aprovado pela Meta antes do primeiro envio — o código já está pronto esperando por ele.

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

⚠️ **Arquivado em 12/08/2026, não é mais a entrada padrão** — ver "Funil de Consignado CLT"
logo abaixo pro que está ativo hoje. Fica documentado aqui porque o código continua intacto
(`menuInicialGerenteArquivado()` em `server.js`) pronto pra reativar quando quiser: é só trocar
o que `menuInicial()` retorna pelo conteúdo dessa função arquivada. Os passos `fluxo_gerente`/
`gerente_*`/`fluxo_clt` também continuam no `FLUXO_BOTOES`, então um clique num botão antigo
(de alguém que recebeu essa mensagem antes da troca) ainda funciona normalmente.

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

### Funil de Consignado CLT (12/08/2026, reformulado no mesmo dia) — entrada padrão atual do número Felizcred

Substituiu a triagem de gerente (arquivada acima) como `menuInicial()`. Baseado no padrão
real de atendimento manual, analisado a partir de conversas exportadas de leads reais
(pasta local `felizcred-site/logo/chats/`, não versionada — dados de cliente): o atendente
(Felipe) manda um menu numérico em texto puro (não botão), pergunta o tempo de carteira
assinada antes de pedir dados (mínimo aceito nos exemplos reais: 3 meses), e é assim que o
menu real que ele já usa manualmente foi copiado pro código.

- **Primeira mensagem** (`TEXTO_MENU_PRINCIPAL`, texto puro — a pessoa responde digitando
  "1"-"5" ou uma palavra, não clicando em botão, igual acontece de verdade): "Olá, me chamo
  Felipe: escolha uma das opções... 1 - CONSIGNADO CLT / 2 - SEGURO DE CARRO/MOTO /
  3 - EMPRÉSTIMO COM CARRO EM GARANTIA / 4 - FINANCIAR UM VEÍCULO / 5 - SAQUE DO FGTS" + aviso
  do FGTS + telefones + site. Reconhecimento em
  `detectarOpcaoMenuPrincipal`/`handlerMenuPrincipal`: número exato ou palavra-chave — mas
  **exige a mensagem inteira igual à palavra-chave** (`t === chave`, não `.includes()`), tanto
  aqui quanto em `detectarOpcaoMenuInstagram`: mandar só "fgts" aciona, mandar uma frase
  qualquer que contenha "fgts" no meio não aciona mais (mudou 12/08/2026 depois do usuário ver
  a palavra disparando dentro de frases sem intenção clara). Não reconhecer não responde nada
  automático (fica pro atendimento manual, e o lembrete sutil do passo `menu_inicial` continua
  tentando trazer a pessoa de volta).
  - ⚠️ **Bug corrigido 13/08/2026 — opção 5/FGTS não existia**: o aviso "ATENÇÃO: o saque do
    FGTS só pode ser simulado..." já citava FGTS desde sempre, mas nenhuma opção do menu
    tratava a palavra — quem digitasse "fgts" ficava sem resposta nenhuma (reportado pelo
    usuário testando ao vivo). Agora tem opção `5` própria, mesmo texto/fluxo já usado no
    Instagram (autorizar o banco BMS no app do FGTS, depois mandar o CPF — passo `fgts_cpf`,
    `handlerCapturaDadosFgts`, mesmo padrão paciente do CLT: só confirma achando um CPF de
    verdade, resto só reseta o lembrete).
  - ⚠️ **Bug corrigido 13/08/2026 — emoji de teclado não casava com o número**: o menu do
    Instagram manda os números como emoji "1️⃣ 2️⃣ 3️⃣..." (dígito + variation selector +
    combining enclosing keycap, 3 caracteres). Quem tocasse nesse emoji em vez de digitar "1"
    no teclado normal nunca tinha resposta — `normalizarTexto` só tirava acentos (faixa
    U+0300-036F), não esses dois caracteres invisíveis extras, então a comparação `t === "1"`
    sempre falhava pra quem usasse o emoji. `REGEX_ACENTOS` agora também remove
    variation selector (U+FE0E/U+FE0F) e combining enclosing keycap (U+20E3) — corrige nos
    dois canais (WhatsApp e Instagram usam a mesma `normalizarTexto`).
  - **Opção 1 (CLT)** → "Para simular o consignado CLT, precisa ter no mínimo 3 meses de
    carteira assinada..." com botões `3 MESES OU MAIS` / `MENOS DE 3 MESES` (passo
    `clt_pergunta_tempo`, esses dois continuam sendo botão de verdade, não texto).
    - `3 MESES OU MAIS` (`clt_3mais`) → pede nome completo, CPF, telefone, e-mail e data de
      nascimento numa mensagem só. `handlerCapturaDadosClt` só confirma e libera pro
      atendimento humano se achar um **CPF de verdade** na resposta (`REGEX_CPF`) — sem
      isso, **não reclama na hora**: só reafirma o passo (reseta o relógio do lembrete) e
      espera quieto, porque a pessoa pode estar mandando os 5 dados aos poucos, em mensagens
      separadas (nome numa, CPF em outra...). Só cobra de volta depois de ficar um tempo sem
      novidade nenhuma (`LEMBRETE_TEXTOS.clt_3mais`, 15 min). Antes disso ser corrigido, o bot
      confirmava QUALQUER texto como "dados recebidos" (bug real visto em teste: respondeu
      "Fgts" no meio do fluxo e o bot deu como recebida a simulação completa) e reclamava
      "não consegui identificar seu CPF" a cada mensagem parcial — os dois foram corrigidos
      no mesmo dia.
    - `MENOS DE 3 MESES` (`clt_menos3`) → explica o requisito, orienta a conferir a data de
      admissão no app da Carteira de Trabalho Digital, convida a voltar quando completar 3
      meses. **Terminal** — não pede dados, não tem lembrete de continuação.
  - **Opção 2 (seguro de carro/moto)** → confirmação padrão (`PRODUTO_CONFIRMACAO`) e passa
    pro atendimento humano — sem fluxo próprio ainda.
  - **Opções 3 e 4 (carro em garantia / financiamento)** → cada uma manda seu requisito
    (garantia: sem restrição no SPC/Serasa **e** carro não pode estar alienado; financiamento:
    sem restrição no SPC/Serasa) seguido da mesma lista de documentos (`DOCUMENTOS_VEICULO`):
    foto do documento do veículo (CRLV), endereço completo, profissão e renda, foto do
    documento pessoal (RG/CNH), e-mail. `handlerCapturaDadosCarroGarantia`/
    `handlerCapturaDadosFinanciamento` usam o mesmo padrão paciente do CLT, mas o sinal de
    "dados completos" é achar um **e-mail** na mensagem (`REGEX_EMAIL`) em vez de CPF — não
    têm CPF pedido, e-mail é o único campo com formato reconhecível na lista. ⚠️ Foto do
    documento não dispara nada automaticamente (captura de texto só roda pra mensagem de
    texto) — fica visível no histórico do painel pro Felipe conferir manualmente.

**Fora do horário comercial** (`horarioComercialCotaCerta()` — mesma janela usada pela Cota
Certa, seg-sex 9h-18h/sáb até 12h, reaproveitada porque é a mesma equipe): em vez do menu, a
primeira mensagem vira um aviso pedindo pra escrever de novo dentro do horário — não faz
sentido abrir o funil se não tem ninguém pra rodar a simulação de crédito depois. A
confirmação de dados recebidos (`confirmarDadosRecebidos`, reaproveitada pelos 3 funis)
também ganha esse aviso (`avisoForaHorarioCotaCerta()`) quando cai fora do horário, pra não
prometer resposta rápida à toa.

⚠️ **Bug corrigido 13/08/2026 — lembrete cobrando uma opção que nunca foi mostrada**: fora do
horário, `menuInicial()` manda só o aviso "estamos fora do horário", não o menu numérico —
mas o código marcava o passo como `menu_inicial` do mesmo jeito de quem recebeu o menu de
verdade, então minutos depois o lembrete sutil mandava "responda com o número da opção que te
mandei ali em cima" pra alguém que nunca recebeu opção nenhuma. Reportado pelo usuário
testando com um cliente real (Mario). `menuInicial()` agora devolve `foraDeHorario: true`
quando cai nesse caso, e os dois lugares que chamam `menuInicial()` (mensagem nova e palavra
"menu") só marcam o passo `menu_inicial` quando **não** é esse caso — fora do horário o passo
fica `null`, sem lembrete nenhum.

**Lembretes ("gancho") são sutis e só disparam pra quem parou no meio de uma resposta
automática** — se o Felipe já respondeu manualmente pelo painel, `setFluxoPasso(...null)`
zera o passo e cancela qualquer lembrete pendente daquela conversa (mesmo mecanismo de
sempre, ver "Lembretes e agenda" acima). Passos: `menu_inicial` (15 min, "responda com
o número da opção"), `clt_pergunta_tempo` (15 min), `clt_3mais` (15 min), `carro_garantia_dados`
(15 min), `financiamento_dados` (15 min), `fgts_cpf` (15 min).

**O que fica de fora de propósito** (evidenciado nas conversas analisadas, mas não
automatizável com o que existe hoje): a simulação de crédito de verdade é feita pelo Felipe
operando o portal de um banco parceiro (C6 ou Facta) em tempo real — manda SMS de 6 dígitos
ou link de autorização, o cliente responde na hora, o código expira em ~2 min. Não existe
integração/API dessa consulta no código; é atendimento manual a partir da captura de dados.
A mensagem de proposta final também segue um padrão (várias opções de parcela + aviso fixo
de taxa de R$95 só se aprovado + documentos pra fechar) mas ainda não virou resposta pronta
no painel — candidato natural pra próxima melhoria, usando a funcionalidade que já existe em
⚡ Respostas prontas.

### Fluxo por número — Cota Certa Seguros (30/07/2026)

O número **"felizcred n"** (`phone_number_id` `518007084723311`, WhatsApp `5547996103804`)
tem seu **próprio fluxo**, diferente do fluxo padrão (FGTS/gerente) acima. Mecanismo:
`FLUXOS_POR_NUMERO` mapeia `businessNumberId → objeto de fluxo` (`menuInicial`, `fluxoBotoes`,
`lembreteMinutos`, `lembreteTextos`, `capturaTexto`); `getFluxo(businessNumberId)` cai no
fluxo padrão (`FLUXO_FELIZCRED`) pra qualquer número não mapeado. Toda a lógica de roteamento
em `processarEntry` usa o objeto retornado por `getFluxo`, então adicionar um novo número com
fluxo próprio é só acrescentar uma entrada em `FLUXOS_POR_NUMERO`.

O fluxo da Cota Certa (`FLUXO_COTACERTA`) tem duas entradas:

- **Veio do site** (`cotacerta-seguros/`): o botão "Cotar agora" e o popup de callback
  montam um link `wa.me/5547996103804?text=...` com o texto já pronto ("Olá! Quero cotar..."
  ou "Olá! Quero receber uma ligação..."). O servidor reconhece esses prefixos
  (`REGEX_SITE_COTACAO`/`REGEX_SITE_CALLBACK`) e responde confirmando o recebimento, **sem**
  mandar o menu — a mensagem já contém tudo (produto, dados do veículo etc.), só falta o
  atendimento humano assumir pelo painel.
- **Mensagem direta** (contato novo ou inativo há 24h, sem vir do site): recebe o menu
  (`menuInicialCotaCerta`, mensagem tipo `list` — 4 opções não cabem nos 3 botões da API) com
  Seguro Auto, Seguro de Vida, Outros seguros e Consórcio. Só o **Auto** tem um fluxo de
  perguntas completo (é o produto principal): tipo de veículo → modelo/ano/placa (texto livre)
  → financiado? → uso do veículo → CEP + renovação (texto livre) → encerra avisando que um
  especialista vai assumir. Vida/Consórcio/Outros só confirmam e já passam pro humano.

⚠️ Se o número do WhatsApp da Cota Certa mudar, atualizar `COTACERTA_NUMBER_ID` em `server.js`
**e também** o `WA_NUM`/links `wa.me` em todo `cotacerta-seguros/` (home, `/cotar`,
blog) — são duas coisas independentes que precisam apontar pro mesmo número.

### Fluxo por número — Ciahot (16/08/2026)

Número do negócio **Ciahot** (site de anúncios classificados na região do Vale — negócio
diferente da Felizcred/Cota Certa, `phone_number_id` `1264737673394463`, confirmar em
`/painel/api/numbers` se o número mudar). Diferente dos outros fluxos, **não é um menu** —
é uma sequência linear disparada por campanha de Marketing:

1. Broadcast do painel manda o template aprovado (ex.: `bom_dia`, "Olá, boa tarde!") pro
   número/lista de leads.
2. Quando a pessoa responde qualquer coisa, o fluxo espera **15 segundos** e manda "Espero
   que esteja bem! Meu nome é Felipe."
3. Em seguida manda a oferta (anúncio grátis no site) com um botão de link — **"Visitar
   site"** (`cta_url`) — e, em mensagem separada, um botão de resposta rápida **"Falar com
   atendimento"**. A API do WhatsApp não deixa misturar botão de link com botão de resposta
   na mesma mensagem interativa, por isso são duas mensagens.
4. Clique em "Falar com atendimento" → responde "Aguarde, em breve irei te responder." e
   encerra a automação (humano assume pelo painel).
5. Se ninguém tocar em nenhum botão em **17 minutos**, manda um lembrete único: "O site
   CIAHOT pode gerar mais contatos pra você...".
6. Clique em "Visitar site" **é rastreado**: o botão não aponta direto pra
   `www.ciahot.com.br`, aponta pra `GET /ciahot/site?to=<telefone>` do próprio servidor, que
   registra o clique e redireciona (302) pro site de verdade — só assim dá pra saber que a
   pessoa clicou, já que a Meta **não avisa clique em botão `cta_url`** via webhook (só avisa
   clique em botão de resposta rápida). 5 minutos depois do clique, manda a oferta com selo
   **VIP** ("Fazer anúncio" / "No momento não").
7. "Fazer anúncio" → manda o link do formulário (`ciahot.com.br/anunciar/`, outro botão de
   link) +, em mensagem separada, botão "Anúncio concluído!". Ao concluir, confirma e pede
   pra salvar o contato + e-mail de suporte (`contato@ciahot.com.br`). "No momento não" só
   confirma e encerra.

Implementado com `FLUXO_CIAHOT.aoIniciar` (função assíncrona) no lugar de `menuInicial` —
`dispararInicioFluxo` (usado tanto na reabertura por "menu" quanto no disparo automático por
inatividade) chama `aoIniciar` quando ele existe, em vez do menu síncrono padrão. Botão de
link novo: `wa.sendCtaUrl` em `whatsapp.js`, e `enviarRespostaAutomatica` ganhou um 6º
parâmetro opcional `cta: { buttonText, url }`. Entradas de `fluxoBotoes` também podem ser uma
função (em vez do formato declarativo `{texto, botoes, lista}`) quando o passo precisa mandar
mais de uma mensagem ou lógica própria — ver `handlerCiahotAnuncioSim` e
`db.tentarAvancarFluxoPasso` (compare-and-swap, evita duplicar o disparo dos 5min se o link
de rastreio for acessado mais de uma vez).

### Aviso de horário comercial (31/07/2026)

Toda mensagem automática que promete "um especialista vai te chamar" na Cota Certa
(`respostaSiteCotacao`, `respostaSiteCallback`, fim do fluxo Auto, Vida, Consórcio, Outros,
Falar com atendimento, e o lembrete de manter a janela aberta às 20h) agora anexa um aviso
quando enviada **fora do horário comercial**, gerado por `avisoForaHorarioCotaCerta()`:

- **Horário assumido** (não confirmado com o usuário — ajustar em
  `horarioComercialCotaCerta()` se for diferente na prática): seg-sex 9h-18h, sábado 9h-12h,
  domingo fechado.
- **Fora do horário num dia de semana normal**: aviso simples dizendo que a resposta foi
  automática e que um especialista fala assim que abrir o expediente.
- **Sábado depois do meio-dia ou domingo** (o próximo expediente, segunda de manhã, fica a
  mais de 24h de distância): aviso reforçado, avisando que o atendimento só volta segunda e
  pedindo pra mandar um "oi" nesse dia caso a conversa feche — porque a janela de resposta
  livre do WhatsApp fecha 24h após a última mensagem do cliente, e sem isso a empresa
  precisaria pagar por um template pra reabrir.
- Implementação: `texto` nos passos terminais de `FLUXO_BOTOES_COTACERTA` (e em
  `LEMBRETE_TEXTOS_COTACERTA.manter_janela`) virou função em vez de string fixa, resolvida na
  hora do envio (`typeof passo.texto === "function" ? passo.texto() : passo.texto`) — assim
  o aviso reflete o horário real de quando a mensagem sai, não de quando o servidor subiu.

### Captura de lead por e-mail (01/08/2026)

O formulário de cotação (`cotacerta-seguros/cotar/index.html`) e o popup de callback só
montavam um link `wa.me` — se a pessoa preenchia tudo mas não clicava pra abrir o WhatsApp, o
lead se perdia. Agora, ao clicar em "Quero receber no WhatsApp" ou "Quero receber uma ligação",
o formulário também dispara (fire-and-forget, não bloqueia o fluxo) um `POST` pra
`https://meuwhats.onrender.com/cotacerta/lead` com os dados preenchidos.

- **Servidor** (`server.js`, rota `POST /cotacerta/lead`, pública/CORS liberado pra qualquer
  origem — é só um formulário de entrada, sem dado sensível de saída): salva o lead na tabela
  `cotacerta_leads` (`db.js` → `salvarLeadCotaCerta`/`listarLeadsCotaCerta`, sem UI no painel
  ainda, consulta é via script/SQL direto por enquanto) **e** manda um e-mail de aviso pro time
  via API do Brevo (`email.js` → `notificarLeadCotaCerta`, usa `https` puro, sem SDK).
- **Domínio de e-mail**: `cotacertaseguros.com.br` foi autenticado no Brevo em 01/08/2026
  (SPF mesclado com o Hostinger, DKIM 1 e 2 do Brevo, DMARC com `rua=mailto:contato@...`) —
  necessário pra `contato@cotacertaseguros.com.br` conseguir mandar e-mail transacional sem
  cair em spam.
- **Variáveis de ambiente necessárias no Render** (ver `CHAVES-LOCAL.md` — precisam ser geradas
  manualmente no painel do Brevo, não dá pra automatizar): `BREVO_API_KEY`, `LEAD_EMAIL_TO`
  (pra onde o aviso é mandado) e, opcionalmente, `BREVO_EMAIL_FROM`/`BREVO_EMAIL_FROM_NOME`
  (default `contato@cotacertaseguros.com.br` / "Cota Certa Seguros"). Sem `BREVO_API_KEY` o
  envio de e-mail falha silenciosamente (só loga erro) mas o lead **continua sendo salvo** no
  banco — o `try/catch` em volta do e-mail não bloqueia o `try/catch` em volta do save.

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

### Menu de 5 opções (18/07/2026, fluxo próprio por opção desde 12/08/2026)

Pedido do usuário: quem interage manda a mesma mensagem com um menu de produtos; ao responder
com o número ou o nome da opção, cada uma tem seu próprio comportamento
(`INSTAGRAM_OPCOES_MENU` em `server.js`):

| Opção | Resposta | Depois |
|---|---|---|
| 1️⃣ Seguro de veículo | Direciona pro site `cotacertaseguros.com.br` (formulário → atendimento) | Encerra ali |
| 2️⃣ Consignado CLT | Explica o requisito (3 meses de carteira assinada) e pede nome, CPF, nascimento, e-mail e telefone | Espera a pessoa mandar os dados |
| 3️⃣ Saque do FGTS | Pede pra autorizar o banco **BMS** no app do FGTS e mandar o CPF | Espera a pessoa mandar o CPF |
| 4️⃣ Empréstimo com carro em garantia | Link `wa.me` já com o texto preenchido | Continua no WhatsApp |
| 5️⃣ Financiamento de veículo | Link `wa.me` já com o texto preenchido | Continua no WhatsApp |

Opções 2 e 3 usam captura de dados: a próxima mensagem da pessoa (qualquer texto) é tratada
como os dados pedidos — o bot responde `INSTAGRAM_DADOS_RECEBIDOS_MESSAGE` ("Recebemos seus
dados, aguarde o atendimento") e a partir daí o atendimento é manual, pelo histórico já visível
na aba Instagram de 💬 Conversas (não há validação de CPF/e-mail, só captura o texto cru).
Implementado reaproveitando as MESMAS colunas `fluxo_passo`/`fluxo_passo_at` que o WhatsApp já
usa em `conversations` (a tabela é compartilhada, `business_number_id = "instagram"`) — mesmo
padrão de `capturaTexto` do fluxo do WhatsApp, só que sem um dispatcher por passo (só dois
passos possíveis: `"consignado_clt"` e `"saque_fgts"`).

Opções 4 e 5 continuam mandando um link `wa.me` já com o texto preenchido, levando direto pra
conversa no WhatsApp (`INSTAGRAM_WHATSAPP_NUMERO`, padrão `5547997059353`).

A palavra-chave **"menu"** reabre o menu inicial a qualquer momento (mesmo pra quem já foi
saudado antes, ou está no meio de uma captura de dados — não cancela a captura em andamento,
só reenvia o menu).

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
`garantia`, `financiamento`), sem diferenciar maiúscula/acento — inclusive dentro de uma frase
solta ("quero simular o FGTS" reconhece `fgts`). Se não reconhecer nem estiver no meio de uma
captura de dados, não responde nada automaticamente (fica pro atendimento manual no painel).
Ao reconhecer, cada opção responde o texto da tabela acima (só 4️⃣/5️⃣ ainda mandam o link
`wa.me`, ex.: `https://wa.me/5547997059353?text=Olá%2C%20vim%20do%20Instagram%20e%20quero%20saber%20sobre%20{produto}`).

Cada texto (menu e mensagem de comentário) pode ser sobrescrito por variável de ambiente
(`INSTAGRAM_MENU_MESSAGE`, `INSTAGRAM_COMMENT_REPLY`, `INSTAGRAM_WELCOME_MESSAGE`) sem precisar
mudar código — as duas últimas caem no texto do menu se não forem definidas. As respostas das
opções 1-3 e a de dados recebidos ainda não têm variável de ambiente própria (ficam só no
código, em `INSTAGRAM_OPCOES_MENU`/`INSTAGRAM_DADOS_RECEBIDOS_MESSAGE`).

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

## Geração de leads via LinkedIn — tentado e descartado (20/07/2026)

Usuário pediu leads via LinkedIn (filtro de cargo + sinal de quem saiu/mudou de emprego). Foi
implementada uma aba **🔗 LinkedIn** no painel pra cadastro manual dos leads (cargo, empresa,
e-mail público, link do perfil) com fila priorizando quem ainda não tinha e-mail checado — mas
o usuário decidiu não seguir com esse canal e pediu pra **remover** a aba (removida nesse mesmo
dia; sem tabela/rotas/UI no código atual).

**Decisão que vale manter mesmo sem a feature**: em nenhum momento foi construído (nem deve ser,
se o assunto voltar) um bot/scraper que faça login e navegue no LinkedIn automaticamente — viola
os Termos de Uso independente do plano (grátis, trial do Sales Navigator ou pago) ou do ritmo
(o usuário chegou a pedir throttling a "10 por dia" pra tentar ficar embaixo do radar de
detecção — recusado, throttling não torna a automação permitida, só mais difícil de detectar).
Se um pedido futuro reabrir esse tema, os caminhos legítimos discutidos foram: busca salva +
alerta nativo do Sales Navigator (feature própria do LinkedIn, não bot), `#opentowork` como
sinal gratuito de intenção, e — só pra descoberta/enriquecimento fora do LinkedIn — script de
Google Custom Search (`site:linkedin.com/in "cargo"`) e Hunter.io, nenhum dos dois implementado.

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
- **Bug crítico encontrado em 31/07/2026 no `graphRequest` de `ads.js`**: requests POST sem
  header `Content-Length` explícito saem com `Transfer-Encoding: chunked` (comportamento
  padrão do `https` do Node quando não se define o tamanho do corpo) e a Graph API às vezes
  **perde/derruba um parâmetro do meio do corpo** nesse modo — ex: `special_ad_categories`
  chegava como "obrigatório e ausente" mesmo sendo enviado corretamente (confirmado
  comparando byte a byte com um `curl --data-urlencode` idêntico, que funcionava). Corrigido
  adicionando `"Content-Length": Buffer.byteLength(body)` no header de toda request com
  corpo. Se voltar a aparecer erro "parâmetro obrigatório" com um parâmetro que claramente
  foi enviado, é isso — não é bug de payload.

### Campanhas "Cota Certa Seguros" criadas em 31/07/2026 (site/produto novo, primeira leva)

Pedido do usuário: instalar o Pixel do Meta no site `cotacertaseguros.com.br` e criar 4
campanhas de tráfego pro site (`/cotar/`), R$30/dia no total dividido entre elas
(R$7,50/dia cada), copy no estilo "descubra agora quanto fica o seguro do seu carro, em
apenas 2 minutos". Todas **criadas pausadas** (padrão do projeto — ativação é manual).

- **Pixel**: criado no ato, `Cota Certa Seguros`, ID `1060589406422111`. Instalado no
  `<head>` das 13 páginas de `cotacerta-seguros/` (home, `/cotar/`, blog) — dispara
  `PageView` em toda página e `Lead` customizado nos dois pontos de conversão do funil
  (fim da cotação completa e popup "quero que me liguem"). **Sem `pages_read_engagement`
  suficiente pra confirmar disparo real via teste automatizado** (headless browser é
  bloqueado pelo próprio anti-fraude do `fbevents.js`) — confirmar disparo de verdade no
  Gerenciador de Eventos → Testar Eventos, com navegador normal, antes de confiar 100% nos
  dados de conversão.
- **Criativos**: sem banco de fotos/design pronto pro produto de seguro, então os 4
  criativos foram gerados localmente (HTML+screenshot, 1080×1350) reaproveitando os assets
  reais do site — logo, as 4 logos de seguradora parceira (`img/porto.webp` etc.) e a foto
  `img/hero-auto.jpg`. **São um placeholder funcional, não a versão final** — o ideal é
  trocar por fotos reais (motorista de app de verdade pro criativo de nicho, por exemplo)
  antes de escalar o orçamento.
- **Página do anúncio**: usada a única Página confirmada utilizável com este token,
  `1119238764613554` ("Feliz cred correspondente bancario") — **problema conhecido**: o
  anúncio aparece com esse nome de página (marca errada pra um anúncio de seguro). Criar uma
  Página própria "Cota Certa Seguros" no Business Manager e trocar o `page_id` nos 4
  criativos antes de ativar é o ideal (ativar como está funciona, mas confunde quem vê).
- Objetivo `OUTCOME_TRAFFIC`, `optimization_goal: LINK_CLICKS`, `destination_type: WEBSITE`,
  link `https://www.cotacertaseguros.com.br/cotar/`, `bid_strategy:
  LOWEST_COST_WITHOUT_CAP`, público SC+RS (mesmas regiões 459/456 do teste de consignado).

| Campanha | Público | ID campanha | ID conjunto | ID anúncio |
|---|---|---|---|---|
| Cota Certa - Comparacao 7 Seguradoras | SC+RS, 25-55, interesse "Seguro de veículo" (`6003633149383`) | 120249252547780006 | 120249252547910006 | 120249252548190006 |
| Cota Certa - Descubra o Preco (2 min) | SC+RS, 25-55, aberto (sem interesse) | 120249252548300006 | 120249252548400006 | 120249252548570006 |
| Cota Certa - Corretor de Verdade | SC+RS, 25-55, interesse "Seguro de veículo" | 120249252548660006 | 120249252548710006 | 120249252548940006 |
| Cota Certa - Nicho Motorista de App | SC+RS, 21-50, interesse "Uber (empresa)" (`6004675264764`) | 120249252549080006 | 120249252549200006 | 120249252549440006 |

**Antes de ativar**: revisar os 4 anúncios no Gerenciador (imagem/texto/página), e
idealmente resolver o `page_id` genérico acima primeiro.

### Atualização 31/07/2026 (mesmo dia) — troca de Página tentada, criativos redesenhados

Pedido do usuário: usar a Página "Solutions Engineering Team" (`105193575892026`) em vez da
"Feliz cred correspondente bancario", e trocar o visual de fundo dos criativos por uma foto
de carro batido que o usuário colou no chat.

- **Foto colada no chat: sem acesso a ela por arquivo — resolvido.** Confirmado (busca
  exaustiva em `AppData/Local/Temp`, `Downloads`, `Pictures`, caches do próprio Claude Code)
  que imagens coladas direto na conversa não ficam disponíveis como arquivo; só existem como
  conteúdo de visão dentro da mensagem. Não é bloqueio de permissão, é limitação real do
  canal. O usuário salvou a imagem (gerada por ele no ChatGPT) em
  `felizcred-site/logo/ChatGPT Image 31 de jul. de 2026, 18_33_01.png` e apontou o caminho —
  copiada pra `cotacerta-seguros/img/acidente-carro.png` e usada como fundo real dos 3
  criativos com foto (substituindo o grafismo de vidro trincado). Hashes atualizados:
  `0ae08920dae518f29aa356639baf42d7` (preço), `8b10380be88faba11b2d7ffe2b65b738` (corretor),
  `77a7c34ec8398d024368d03a4d587161` (nicho app). Preview real conferido de novo, ok.
- **"Solutions Engineering Team" não funcionava pra criar anúncio — resolvido pelo usuário.**
  `POST /adcreatives` retornava `error_subcode 1815202` — "a Página não tem acesso à conta do
  Instagram". Tentei contornar restringindo o conjunto de anúncios só pro posicionamento
  Facebook (`publisher_platforms: ["facebook"]`), mas o erro acontecia na validação do
  criativo em si, antes de posicionamento entrar em jogo — não adiantou, e o token não tem
  `pages_read_engagement` pra sequer inspecionar a Página. O usuário resolveu manualmente no
  Business Manager: criou/vinculou a conta do Instagram **@cotacertaseguros**
  (`17841437674153172`) a essa Página. Testei de novo com `POST /adcreatives` simples (sem
  `instagram_actor_id` — passar esse campo explicitamente dá erro "must be a valid Instagram
  account id", token não tem escopo pra isso, mas **não precisa**: só ter a Página com IG
  vinculado já resolve o erro original) e funcionou. Os 4 anúncios foram atualizados pra usar
  `page_id: 105193575892026` (Solutions Engineering Team). Preview real conferido, ok.
- **Pendência final**: o anúncio agora mostra o nome "Solutions Engineering Team" como
  anunciante (é o nome de exibição da própria Página, não muda s vinculando Instagram).
  Tentei renomear via `POST /{page_id}` com `name` — bloqueado: `"Application does not have
  the capability to make this API call"` (falta permissão de app tipo `pages_manage_metadata`,
  igual ao histórico de Instagram desta mesma seção do README). **Sem contorno por API** —
  o usuário precisa renomear a Página manualmente (Business Manager → Configurações →
  Páginas → Solutions Engineering Team → editar nome pra "Cota Certa Seguros"); depois disso
  atualiza sozinho em todos os 4 anúncios, sem precisar mexer em mais nada.
- **O que foi feito em vez disso**: os 3 criativos com foto (Descubra o Preço, Corretor de
  Verdade, Nicho Motorista de App) foram redesenhados com um grafismo de "vidro
  trincado"/impacto (SVG, sem foto real) sobre fundo vermelho-escuro + selo "⚠️ ATENÇÃO",
  reforçando o gancho de aversão à perda, e reenviados como novos criativos (mesma
  campanha/conjunto/anúncio, `creative_id` trocado via `POST /{ad_id}`). O de "Comparação 7
  Seguradoras" manteve a imagem original (grid de logos, não usa foto). Novos hashes de
  imagem: `c795e6b51cbbc6ba7cb5729ceb9877e5` (preço), `780e8e57db81a0e159d2747f9dab03f3`
  (corretor), `3d9e00e8c793bfe3c06a9e3a523e5faa` (nicho app). Preview real conferido, tudo
  renderizando certo.

### Ativadas em 31/07/2026 (mesmo dia) — as 4 campanhas estão no ar

Usuário decidiu manter o nome "Solutions Engineering Team" como está (não é prioridade
resolver agora) e pediu pra ativar. Confirmado o público com o usuário antes de ativar
(puxado direto da API, não da memória da conversa) e as 4 campanhas + conjuntos + anúncios
foram ativados via `POST /{id}` com `status: ACTIVE` nos três níveis. Confirmado depois via
`GET .../campaigns?fields=status,effective_status` que as 4 estão `ACTIVE`/`ACTIVE`:

| Campanha | Público | Orçamento |
|---|---|---|
| Comparação 7 Seguradoras | SC+RS, 25-55, interesse "Seguro de veículo" | R$7,50/dia |
| Descubra o Preço (2 min) | SC+RS, 25-55, aberto (sem interesse) | R$7,50/dia |
| Corretor de Verdade | SC+RS, 25-55, interesse "Seguro de veículo" | R$7,50/dia |
| Nicho Motorista de App | SC+RS, 21-50, interesse "Uber (empresa)" | R$7,50/dia |

Total R$30/dia. Próximo passo natural (não pedido ainda): acompanhar gasto/resultado pelos
próximos dias (painel → 📊, ou pedir no chat) e decidir se pausa a de pior desempenho, mesmo
padrão usado no teste A/B do consignado abaixo.

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

---

## Rodar localmente

```bash
npm install
npm run build   # builda o painel novo (painel-web/, React) — gera painel-web/dist
VERIFY_TOKEN=meu_token_secreto ACCESS_TOKEN=xxx PHONE_NUMBER_ID=xxx PAINEL_USER=eu PAINEL_PASS=minhasenha node server.js
```

Acesse `http://localhost:3000/painel`. Diferente de antes, essa tela **não** pede o prompt
nativo do navegador — abre uma tela de login própria (mesmo usuário/senha de sempre,
`PAINEL_USER`/`PAINEL_PASS`), porque a autenticação agora acontece por chamada de API, não
mais na página HTML em si.

### Painel novo (`painel-web/`) — React + Tailwind + shadcn/ui

A partir de 2026-08-14, o painel deixou de ser HTML/CSS/JS puro (decisão de reformular o
visual pra um layout tipo WhatsApp Web, inspirado num template do 21st.dev) e passou a ser
uma SPA em `painel-web/` (Vite + React + TypeScript + Tailwind v4 + shadcn/ui), buildada e
servida como estático pelo próprio `server.js` (rotas `GET /painel`, `GET /painel/assets/*`
— ver `server.js`). O backend (`server.js`, `db.js`, `whatsapp.js` etc.) **não mudou**: é o
mesmo de sempre, só o front-end do `/painel` foi reescrito.

- **Onde mexer**: `painel-web/src/pages/chats.tsx` é a tela principal (conversas). Layout
  (barra lateral de ícones + seletor de canal WhatsApp/Instagram) fica em
  `painel-web/src/components/app-sidebar.tsx`. Cliente de API (Basic Auth) em
  `painel-web/src/lib/api.ts`.
- **Rodar em modo desenvolvimento** (hot reload, aponta pro backend local na porta 3000):
  ```bash
  cd painel-web
  npm install
  npm run dev
  ```
  Abre em `http://localhost:5173/painel/` (o `base: "/painel/"` do `vite.config.ts` é de
  propósito, pra bater com o path real em produção).
- **Deploy no Render**: o *Build Command* precisa incluir o build do painel novo. Configurar
  em Render → Environment → Build Command: `npm install && npm run build` (o `npm run build`
  da raiz já builda o `painel-web` — ver `package.json`). Sem isso, o deploy sobe o backend
  mas `painel-web/dist/` não existe e `/painel` quebra.
- **`GET /painel-antigo`**: o painel HTML antigo (`public/painel.html`) continua no ar como
  plano B, com o mesmo Basic Auth de sempre, enquanto o painel novo é validado em produção.
  Remover essa rota (e o arquivo) quando não precisar mais dele.
- **As 5 abas já estão portadas**: Conversas, Agenda (calendário + fila + histórico),
  Publicar (publicação direta multi-rede), Reels em massa (upload, fila com estimativa,
  piloto automático, espaço usado no R2) e Funil (ver abaixo) — todas ligadas às mesmas
  rotas que já existiam, backend sem mudança nenhuma (exceto o Funil, que é rota nova).

### Funil de qualificação (aba "Funil") e lembrete em 2 toques

Adicionado em 2026-08-15. Duas peças:

1. **Rastreio de funil** — cada transição-chave do funil de CLT (escolheu CLT no menu →
   confirmou 3+ meses → completou os dados; e a mesma sequência pra quem entra pela campanha
   de WhatsApp) grava 1 linha em `funil_eventos` (`db.funilRegistrarEvento`, chamado via
   `logFunil()` nos pontos exatos em `server.js` — não é dedução por texto de mensagem, é
   evento explícito). A aba Funil (`GET /painel/api/funil?dias=7|30`) mostra a contagem de
   pessoas únicas por etapa e a taxa de conversão entre elas.
2. **Lembrete em 2 toques** (só nos passos `clt_3mais` e `campanha_clt_dados`, que são onde
   mais se perde lead — pedir 5 dados de uma vez assusta) — `LEMBRETE_MINUTOS`/`LEMBRETE_TEXTOS`
   agora aceitam um **array** por passo em vez de só um valor: primeiro toque em 15min (mesmo
   texto de sempre), segundo em 4h com um ângulo diferente (reduz o atrito — "pode mandar só
   nome e CPF primeiro" — em vez de repetir o mesmo pedido, que é o padrão que soa insistente).
   Todos os outros passos continuam com 1 toque só, sem mudança de comportamento. `fluxo_lembrete`
   no banco virou contador (0, 1, 2...) em vez de flag — qualquer mensagem nova da pessoa
   zera o contador (mesmo mecanismo de sempre), só quem fica em silêncio de verdade avança
   pro próximo toque.

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
| `GET /painel/api/inbox`                                          | Conversas de todos os números + Instagram juntas — usada pelo polling de notificação/indicador "tem novas" de cada aba (auth) |
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
| `POST /painel/api/instagram/importar-historico`                  | Importa DMs anteriores ao deploy da gravação automática (idempotente — auth) |
| `GET /painel/api/instagram/comentarios`                          | Comentários do último post (auth)           |
| `GET /painel/api/instagram/conversas`                            | Lista conversas (DMs) do Instagram via Graph API — bruta, sem texto; não usada mais pelo painel, as DMs de verdade vêm por `/painel/api/inbox` (auth) |
| `GET /painel/api/ads/campanhas`                                  | Lista campanhas de anúncios com métricas (auth) |
| `POST /painel/api/ads/:id/status`                                | Pausa/ativa campanha, conjunto ou anúncio (auth) |
| `POST /webhook/telegram`                                          | Recebe updates do bot do Telegram (`/start`, contato compartilhado) |
| `GET /painel/api/telegram/contacts`                               | Lista contatos captados pelo bot do Telegram (auth) |

### Interface do painel (`public/painel.html`)

Redesenhado em 26/06/2026 para um layout minimalista (paleta neutra/terracota, sem
dependências novas — continua HTML/CSS/JS puro, sem build step) com uma navegação lateral
de ícones que troca entre três telas dentro da mesma página:

- **💬 Conversas** — lista de conversas + chat, com uma aba por conta no topo: cada número de
  WhatsApp configurado (cada um com seu próprio fluxo de atendimento automático — Felizcred e
  Cota Certa são contas/fluxos diferentes) e agora também uma aba **Instagram** (12/08/2026),
  já que as DMs passaram a ser gravadas de verdade (ver abaixo). Trocar de aba troca a lista e
  quem recebe a resposta — chat, status, nota e busca funcionam igual nas duas. Envio de
  imagem continua exclusivo do WhatsApp (a API de DM do Instagram usada aqui só manda texto).
  Envio em massa continua em modal, com um seletor de "Enviar pelo número" (só WhatsApp,
  broadcast usa template — Instagram não entra nessa).
- **📸 Instagram** — perfil conectado, métricas do último post e comentários do último post,
  botão de resetar boas-vindas. As DMs saíram daqui (ver acima).
- **📊 Ads Manager** — lista de campanhas (era um modal antes, agora é página própria),
  pausar/ativar.
- **📨 Telegram** — lista de contatos (leads) captados pelo bot, com telefone, username e
  parâmetro de origem (campanha) quando disponível.

**Como as DMs do Instagram são gravadas**: usam as MESMAS tabelas `conversations`/`messages`
do WhatsApp, com `business_number_id` fixo `"instagram"` (ver `logInstagramInbound`/
`logInstagramOutbound` em `server.js`) — por isso todas as rotas de conversa
(`/painel/api/conversations/:businessId/...`) já funcionam pra Instagram sem rota nova,
bastando passar `businessId=instagram`. Responder requer a permissão
`instagram_manage_messages` aprovada (Acesso Avançado) — cheque com
`/painel/api/instagram/diagnostico` antes de confiar no botão de resposta (ver status dessa
aprovação na seção "Status da Análise do App" mais abaixo — foi aprovada em 18/07/2026).

**Importante — a gravação só vale pra DMs a partir do deploy**: quem já tinha conversas
antes disso (ex.: os 25 threads que o diagnóstico já lia via API em 18/07) não aparece
sozinho na aba Instagram — a aba fica vazia até alguém importar. Botão **"Importar DMs
existentes"** na tela 📸 Instagram (rota `POST /painel/api/instagram/importar-historico`,
função `instagramImportarHistorico` em `server.js`) busca todas as conversas via
`ig.getConversas()` + `ig.getMensagensConversa()` (que lê o texto de cada thread — a
`getConversas()` sozinha só traz participantes/data, sem corpo de mensagem) e grava o que
ainda não existe, usando o id nativo da mensagem do Instagram (`msg.id`, coluna
`wa_message_id` — nome herdado do WhatsApp mas guarda o id de qualquer canal) pra não
duplicar quem já chegou por webhook. Idempotente, pode clicar de novo à vontade.

**Notificações de mensagem nova** — botão 🔔 no cabeçalho da caixa de entrada pede permissão
de notificação do navegador (`Notification` API). Com permissão concedida, toda mensagem
recebida (em qualquer número configurado em `PHONE_NUMBERS_JSON` ou no Instagram, mesmo sem
a aba aberta) dispara uma notificação do navegador e marca um indicador visual (bolinha
laranja) no ícone 💬 do menu lateral; clicar na notificação leva direto pra conversa.
Implementado via polling de 5s (`verificarNovasMensagens` em `painel.html`) comparando
`last_message_at`/`last_direction` de `/painel/api/inbox` — precisou adicionar
`last_direction` na query `listConversations` em `db.js` pra saber se a última mensagem foi
recebida (não notifica para mensagens que você mesmo enviou). Funciona só com a aba do
navegador aberta (sem service worker / push em segundo plano).

Se quiser ir além de HTML/CSS/JS puro no futuro (ex.: migrar para React/Tailwind/shadcn),
isso é uma mudança de arquitetura grande (build step novo, mudar como `server.js` serve os
arquivos) — converse com o usuário antes, não assuma.
