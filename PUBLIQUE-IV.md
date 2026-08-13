# Publique IV

Sistema interno de publicação — publica o mesmo conteúdo em várias redes sociais com um
clique, direto do painel (`/painel`, aba 🚀 "Publicar"). Cada rede usa só o que ela aceita
daquele conteúdo (Instagram exige imagem, LinkedIn usa o link pra gerar a prévia, etc.).

## Objetivo

Você escreve **um** post (texto + opcionalmente imagem e/ou link) e escolhe quais redes
recebem. O sistema publica em paralelo lógico (uma rede por vez, mas nenhuma trava as
outras) e devolve o resultado individual de cada uma, com **link direto pra publicação** —
se uma falhar (token vencido, rede sem credencial, etc.) as demais continuam normalmente.
A imagem é **upload direto do computador** (arrastar ou clicar) — não precisa ter a foto
hospedada em algum lugar antes.

Hoje cobre: **Instagram, Facebook, Threads, X/Twitter e LinkedIn.**

Além de publicar, também dá pra editar o **perfil da Página do Facebook** (capa, foto de
perfil, texto "Sobre") pelo mesmo painel. **O Instagram não tem essa opção**: a API pública
da Meta (`graph.instagram.com`) não expõe escrita de bio/foto de perfil — só leitura. Trocar
esses campos do Instagram continua sendo manual, direto no app.

## Como o conteúdo é adaptado por rede

| Rede | Texto | Imagem | Link |
|---|---|---|---|
| Instagram | vira a legenda | **obrigatória** — sem imagem, a publicação falha com erro claro | ignorado (Instagram não aceita link em post de feed) |
| Facebook | mensagem do post | se tiver, publica como foto (`/photos`); sem imagem, publica como texto/link (`/feed`) | usado só quando não há imagem |
| X/Twitter | corpo do tweet (corta em 280 caracteres se passar, e avisa no resultado) | opcional, sobe como mídia do tweet | não tem campo próprio — se quiser, inclua no texto |
| LinkedIn | `commentary` do post | sobe (`content.media`, 1 imagem) ou várias (`content.multiImage`, 2–20 imagens) via Images API — ver seção Carrossel | usado só quando não há imagem (`content.article`, LinkedIn gera a prévia/thumbnail do site) |
| Threads | vira o texto do post | opcional, sobe como mídia (`media_type: IMAGE`) | ignorado (Threads não tem campo de link próprio) |

## Arquitetura

```
publique.js          orquestrador: sabe quais contas existem e quais redes cada uma
                      tem configurada; publicarEmTodos() chama os adaptadores certos.
instagram.js          → publicarImagem()   (Instagram Graph API)
facebook.js           → publicar(), atualizarCapa(), atualizarFotoPerfil(),
                        atualizarSobre()   (Facebook Graph API)
twitter.js            → publicar()         (X API v2 + upload de mídia v1.1, OAuth 1.0a)
linkedin.js           → publicar()         (LinkedIn Posts API, /rest/posts)
server.js             rotas:
                      POST /painel/api/publicar               → publica nas redes marcadas
                      GET  /painel/api/publicar/contas         → lista contas/redes disponíveis
                      POST /painel/api/publicar/perfil-facebook → capa/foto/"sobre" da Página
                      GET  /publicar-media/:arquivo            → serve a imagem enviada (sem
                                                                  login — Meta precisa buscá-la)
public/painel.html    aba "Publicar" (🚀): upload com preview + pré-visualização ao vivo do
                      post + chips de rede + card "Perfil da Página (Facebook)"
```

Cada rede-adaptador é uma função pura: recebe `{ texto, imagemUrl, link }` +
credenciais explícitas, e não lê `process.env` diretamente (exceto `instagram.js`, que
mantém compatibilidade com as funções antigas de leitura que já existiam antes do Publique
IV — se nenhuma credencial for passada, cai no token/conta padrão do Instagram). Cada
adaptador de publicação também busca e devolve `link` (o permalink da publicação), pra
mostrar no painel.

### Upload de imagem — como funciona por baixo

O navegador redimensiona a imagem (máx. 1600px do lado maior, JPEG) e manda como
`imagemBase64` no mesmo POST /painel/api/publicar. O servidor decodifica, salva em
`media/publicar/` (pasta própria, separada de `media/` que guarda mídia de clientes do
WhatsApp) e gera uma URL pública tipo `https://SEU_DOMINIO/publicar-media/xxxx.jpg` —
o Instagram e o Facebook buscam a imagem por essa URL na hora de publicar. Essa rota
**não exige login** (diferente de `/media/`) porque as redes sociais precisam acessá-la de
fora; como a imagem já vai virar uma publicação pública mesmo, isso não é uma exposição
nova de dado sensível. O disco do Render é efêmero (perde arquivo a cada deploy), mas isso
não é problema aqui — a imagem só precisa existir pelos segundos que a Meta leva pra buscá-la.

## Reels em massa (Cloudflare R2 → Instagram + Facebook, agendado)

Além da publicação manual de 1 clique, o Publique IV tem uma segunda engrenagem pensada
pra publicar um **acervo grande de vídeos já prontos** (editados fora — CapCut, etc., moldura
e tudo já aplicado) sozinho, aos poucos, sem precisar subir cada um na mão.

**Decisão 1 (11/08/2026)**: esse sistema **não processa vídeo nenhum** — não tem ffmpeg,
moldura, editor manual, nem nada parecido. O vídeo já vem pronto de fora; o servidor só
publica. Rodar ffmpeg no plano free do Render derrubava o processo por falta de memória em
vídeos de tamanho normal (~78MB já bastava) — ver `feedback_content_rights_video_sourcing` e
o histórico da conversa de 11/08/2026.

**Decisão 2 (11/08/2026)**: o "depósito" dos vídeos é a **Cloudflare R2**, não o Google
Drive. Drive foi tentado primeiro (Service Account do Google lendo/publicando de uma pasta),
mas trombou num limite real e definitivo do Google: **Service Account não tem cota de
armazenamento própria** fora do Google Workspace — consegue *ler* arquivo que alguém
compartilha com ela, mas não consegue *criar* arquivo novo (erro `storageQuotaExceeded`,
confirmado ao vivo tentando em duas pastas diferentes). Não tinha como contornar isso sem OAuth
delegado (mais complexo) — R2 resolve sem esse problema, tem SDK S3-compatível padrão, e o
plano free (10GB, permanente, não expira em 12 meses) é mais que suficiente pra uma fila de
vídeos que roda e limpa sozinha.

Como funciona:

1. Você edita os vídeos por fora (moldura, cortes, tudo).
2. Sobe pra fila **direto pelo painel** — botão "Escolher vídeo(s)" no card, aceita vários de
   uma vez, com um campo de legenda opcional por vídeo. Por baixo dos panos o servidor manda
   cada um pro bucket do R2 (`r2.js` → `enviarVideo()`) e já sincroniza a fila.
3. Ao longo do dia, em horários espalhados entre **08:00 e 22:00** (horário de Brasília), o
   agendador pega o **próximo vídeo pendente**, gera uma **URL assinada temporária** do R2 (o
   servidor nunca baixa o vídeo pro próprio disco — a Meta busca direto do R2) e publica como
   Reels — **no Instagram e no Facebook ao mesmo tempo** (contam como sucesso independente uma
   da outra; se uma falhar, a outra publica normalmente).
4. O arquivo fica no R2 por **24h depois de publicado**, depois é apagado sozinho (limpeza
   automática de hora em hora, `reels.limparAntigos()`) — não acumula espaço/custo.

**Bloqueio de espaço**: antes de cada upload, o servidor confere quanto já está usado no
bucket — a partir de 9GB (de um limite grátis de 10GB) recusa novo upload com aviso claro, em
vez de deixar estourar e começar a cobrar.

**Quantidade por dia é configurável** (campo "Quantos posts por dia" no card) — os horários
são recalculados automaticamente, espalhados entre 08:00–22:00 conforme a quantidade (ex.:
14/dia ≈ 100/semana). Sem limite de quantos vídeos ficam na fila. Isso é o **piloto
automático** — vale pra todo vídeo que não tiver um horário próprio marcado.

**Legenda**: campo de "Legenda padrão" no card (usada em todo vídeo que não tiver uma legenda
própria) + campo opcional por vídeo no upload (se deixar em branco, cai na padrão).

**Horário exato por vídeo (opcional)** — pra quem quer controle fino (ex.: "esses 5 vídeos
saem hoje, cada um numa hora diferente"): no upload, ou depois direto na fila, dá pra marcar
**dia e hora exatos** de publicação pra um vídeo específico. Esse vídeo sai do piloto
automático — o agendador checa a cada minuto se algum vídeo com horário marcado já venceu, e
publica na hora (com ~1min de margem), furando a fila automática. Sem horário marcado, o
vídeo continua no piloto automático normal.

A seção **"📋 Fila"** no card mostra todo vídeo pendente: quem tem horário marcado mostra
esse horário exato (⏰ agendado), quem não tem mostra uma **data prevista** (estimativa do
piloto automático, recalculada toda vez a partir da posição na fila + ritmo configurado —
não é gravada, muda se a quantidade/dia mudar). Por item:
- **Agendar para** — campo de data+hora pra marcar (ou limpar, deixando em branco) o
  horário exato daquele vídeo específico.
- **Publicar agora** — publica esse vídeo específico na hora, fora da ordem e ignorando
  qualquer horário marcado (é uma ação manual e explícita).
- **Remover** — tira da fila e apaga do R2 (usuário mudou de ideia sobre aquele vídeo).

Fica **pausado por padrão** — só começa a publicar sozinho depois de ligar o botão "Ativar
agendamento" no painel (aba 🚀 Publicar → card "Reels em massa").

### Arquitetura

```
r2.js       cliente S3-compatível pro Cloudflare R2 (SDK oficial da AWS, @aws-sdk/client-s3
            + @aws-sdk/s3-request-presigner — R2 é compatível com a API do S3) — enviar,
            listar, gerar URL assinada temporária, apagar, somar uso total do bucket.
reels.js    orquestrador: enviarVideo() (upload do painel → R2 → sincroniza, bloqueia se
            espaço quase cheio), sincronizarFila() (R2 → banco), publicarItem()
            (função compartilhada: URL assinada → publica em Instagram + Facebook),
            publicarProximoPendente() (piloto automático — só quem NÃO tem horário
            marcado), publicarProximoAgendado() (quem TEM horário marcado e já venceu —
            checado a cada minuto, tem prioridade) e publicarItemEspecifico() (um vídeo
            específico, ignora ordem/horário — botão manual "Publicar agora"),
            listarFilaComEstimativa() (fila + horário exato ou data prevista calculada),
            definirData()/removerItem() e limparAntigos() (apaga do R2 quem foi
            publicado há mais de 24h).
instagram.js → publicarReels() (fluxo de container de vídeo — media_type REELS, polling
            até o Instagram terminar de processar antes de publicar).
facebook.js → publicarReels() (API de Reels da Página — fluxo "hosted file": start →
            aponta a URL do vídeo → polling do status → finish/publish).
db.js       tabela reels_queue (coluna `drive_file_id` guarda a **key do objeto no R2** —
            nome mantido por compatibilidade, não é mais literalmente do Drive; status
            pending/posted/error, `arquivo_apagado` controla a limpeza de 24h,
            `agendado_para` é o horário exato opcional — data+hora, não só data) +
            reels_config (liga/desliga, posts_por_dia, legenda_padrao, controle de horário).
server.js   rotas (POST /painel/api/reels/upload, GET .../status, GET .../fila,
            POST .../sincronizar, .../pausar, .../posts-por-dia, .../legenda-padrao,
            .../publicar-agora, .../:id/reenfileirar, .../:id/publicar-agora,
            .../:id/data, DELETE .../:id) + o setInterval que a cada minuto primeiro
            checa se algum vídeo com horário marcado já venceu (publicarProximoAgendado,
            tem prioridade) e só depois checa se bateu algum horário do piloto automático
            (calcularHorariosDoDia() gera os horários dinamicamente a partir da
            quantidade configurada) + setInterval de hora em
            hora que roda a limpeza do R2. Upload usa multipart/streaming (`busboy`) —
            nunca base64/JSON.
public/painel.html  card "🎬 Reels em massa" na aba Publicar: legenda padrão, upload em
            lote com legenda + horário exato opcional por vídeo, indicador de espaço
            usado no R2, quantidade/dia (piloto automático), seção "Fila" (pendentes com
            horário exato ou data prevista, agendar/publicar agora/remover por item),
            "Histórico recente" (publicado/erro). Sem botão de "publicar 1 de teste"
            solto — cada ação de publicar-fora-da-ordem agora é por item específico na
            Fila, mais claro do que um botão genérico.
```

**Facebook Reels ainda não testado contra API real** (código escrito seguindo a documentação
oficial da Meta) — só vai confirmar quando o primeiro vídeo de verdade passar pela fila.
Instagram Reels já está testado e funcionando (ver seção Status).

### Configuração (variáveis de ambiente)

- `R2_ENDPOINT` — endpoint da conta na Cloudflare (aparece nas configurações do bucket, algo
  tipo `https://SEUID.r2.cloudflarestorage.com`; se colar com o nome do bucket no final o
  código corta sozinho, não precisa editar).
- `R2_BUCKET` — nome do bucket (ex. `felizcred-reels`).
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — gerados em R2 → Manage R2 API Tokens →
  Create API Token, permissão **Object Read & Write** no bucket.

### Status

- Cloudflare R2: ✅ ao vivo e testado (11/08/2026) — token gerado, as 4 variáveis
  configuradas no Render, e testado direto contra a API real (enviar, listar, gerar URL
  assinada, apagar), tudo funcionando. Primeiros vídeos reais já enviados pelo painel.
- Fila avançada (data mínima por vídeo, "Publicar agora" de um item específico, "Remover")
  testada de ponta a ponta contra a API real do R2 (upload com legenda+data, listar com
  data prevista, limpar data, remover — confirmado sumindo do R2 também).
- Google Drive (tentativa anterior, abandonada): Service Account e pasta continuam existindo
  mas não são mais usadas por nada no código — `GOOGLE_SERVICE_ACCOUNT_JSON` e
  `GOOGLE_DRIVE_REELS_FOLDER_ID` podem ser removidas do Render quando quiser.
- Publicação: Instagram Reels já testado e funcionando em produção. Facebook Reels é código
  novo (11/08/2026), seguindo a documentação oficial, mas **ainda sem teste real** — falta
  publicar um vídeo de verdade pra confirmar.

## Agenda de publicações (posts multi-rede com dia+hora exatos)

Adicionada 12/08/2026. Diferente dos Reels (vídeo, sempre Instagram+Facebook, com "piloto
automático" espalhando N por dia), aqui é o **usuário quem escolhe o dia e a hora exatos de
cada post**, de texto/imagem, em **qualquer combinação de redes** — sem limite de quantos
agendar. Pensada pra criar uma leva grande de posts de uma vez (ex. 50 no mês), um a um.

### Como funciona

O próprio formulário de "Publicar agora" (topo da aba) ganhou um campo **"Agendar para"**
(`<input type="datetime-local">`) e um segundo botão, **"📅 Agendar"**, ao lado do
"Publicar agora" de sempre. Preencher esse campo e clicar em "Agendar" (em vez de publicar
na hora) manda o post pra fila da Agenda, que aparece logo abaixo, em vez de publicar
imediatamente — o formulário se limpa sozinho (mantendo conta e redes marcadas) pra já deixar
pronto pro próximo post.

- `agenda.js` — orquestra criação/publicação/remoção, reaproveitando `publique.publicarEmTodos()`
  por baixo (mesmo critério de sucesso: publica se ao menos uma rede der certo).
- `posts_agendados` (tabela nova no banco) — cada linha guarda `redes` como array (JSON),
  `agendado_para` **obrigatório** (sem "piloto automático" aqui — é sempre escolha explícita).
- Imagem: mesmo bucket R2 dos Reels, mas sob o prefixo `posts/` — `reels.js` filtra esse
  prefixo no `sincronizarFila()` pra não confundir imagem de post com vídeo de Reels na fila
  errada.
- Agendador: checado a cada minuto (mesmo `setInterval` dos Reels agendados, mas
  independente — não depende do "pausado" dos Reels, que é outro sistema).
- Limpeza automática apaga a imagem do R2 24h depois de publicada, mesma lógica dos Reels.
- Painel: card **"Agenda de publicações"** com "Fila (pendentes)" — reagendar, publicar agora
  fora de ordem, remover — e "Histórico recente", reaproveitando os mesmos componentes
  visuais já usados na fila de Reels.
- **"Fila" é um calendário de mês, não uma lista corrida.** Primeira versão listava tudo "um
  debaixo do outro" — usuário apontou que com 200 posts agendados isso vira uma rolagem
  inútil ("por que que não tem uma agenda... imagine se eu tiver duzentas publicações").
  Redesenhado no mesmo dia: grade do mês com navegação ‹ › entre meses, cada dia mostra um
  badge com a quantidade de posts marcados, clicar num dia abre só os posts daquele dia (com
  os controles de reagendar/publicar agora/remover). Ao abrir a aba, já pula pro mês do
  próximo post agendado.

### Status

✅ Testado ponta a ponta (12/08/2026): criar, listar, reagendar, publicar-agora e remover
confirmados contra o R2 real (via banco de teste local) e via HTTP local no servidor de
verdade — incluindo a garantia de que a imagem de um post não vaza pra fila de Reels. O
calendário foi testado visualmente com Playwright (34 posts de teste espalhados no mês,
navegação entre meses, seleção de dia, histórico com erros reais) — pegou e corrigiu um bug
real (histórico usava a função crua do banco em vez do wrapper que parseia `redes` pra
array).

## Carrossel (várias imagens deslizáveis)

Adicionado 13/08/2026, pra publicar o carrossel "distribuição de lucros 2026" (10 imagens
prontas em `felizcred-site/logo/reels/`). `publicarEmTodos()` aceita `imagemUrls` (array, 2+
imagens) além do `imagemUrl` único de sempre — quando vem `imagemUrls`, cada adaptador decide
se sabe publicar carrossel ou recusa com um erro claro (não faz sentido postar só o texto
numa rede que não suporta o formato pedido).

**Suportam carrossel**: Instagram (`publicarCarrossel()` em `instagram.js` — até 10 imagens),
Facebook (`publicarCarrossel()` em `facebook.js` — sobe cada foto `published:false` e cria o
post via `attached_media`, sem limite fixo documentado), Threads (`publicarCarrossel()` em
`threads.js` — até 20 imagens), LinkedIn (`publicar()` em `linkedin.js` detecta `imagemUrls` e
usa `content.multiImage` — 2 a 20 imagens, ver abaixo). **Não suporta**: Instagram Stories
(formato de uma imagem só, sem swipe entre várias) e X/Twitter (não implementado neste
sistema) — nesses o adaptador lança erro em vez de publicar o post fora do formato pedido.

**Gotcha do Threads**: diferente do Instagram, o Threads recusa o container "pai" (`media_type
CAROUSEL`) se algum item filho ainda não tiver terminado de processar — dá erro "children
inválidos/inexistentes". `threads.js` espera cada filho ficar `FINISHED`
(`aguardarContainerPronto`) antes de seguir pro próximo, um por um; o Instagram não precisa
disso (aceita children ainda processando).

**LinkedIn ganhou upload de imagem de verdade** (13/08/2026) — antes não subia imagem nenhuma
(exigiria o fluxo de registro de upload da Images API, que não existia aqui). Agora
`linkedin.js` tem `subirImagem()`: registra o upload (`POST /rest/images?action=
initializeUpload`, corpo `{ initializeUploadRequest: { owner: autorUrn } }`) pra ganhar uma
`uploadUrl` temporária + o URN final (`urn:li:image:...`), baixa os bytes da `imagemUrl`
recebida (mesmo padrão do resto do sistema — a imagem já está hospedada em algum lugar público,
ex. R2) e manda esses bytes crus via `PUT` pra `uploadUrl`. Com 1 imagem vira
`content.media: { id: urn }`; com 2+ (`imagemUrls`) vira `content.multiImage: { images: [...]
}` — o equivalente do LinkedIn a um carrossel (não é swipe visual como Instagram/Threads, é
uma grade/carrossel de miniaturas, mas é o formato nativo deles pra várias imagens no mesmo
post).

**Gotcha de versão descoberto publicando isso**: o comentário antigo em `linkedin.js` dizia
que a `LinkedIn-Version` só aceitava o mês atual (verdade pro `/rest/posts`, testado
10/08/2026) — mas testando o `/rest/images` em 13/08/2026, esse endpoint recusou o mês atual
(`426 NONEXISTENT_VERSION`) e só aceitou de 1 a 3 meses atrás. Cada recurso da API do LinkedIn
parece ativar a versão do mês corrente num momento diferente. Resolvido de vez (não só pra
essa vez): `request()` em `linkedin.js` agora tenta o mês atual e recua mês a mês (até 3)
automaticamente sempre que a resposta for `NONEXISTENT_VERSION`, pra não quebrar de novo
assim que o calendário virar ou um recurso novo entrar.

**Como qualquer adaptador recebe as imagens**: mesmo padrão do resto do Publique IV — precisa
de URLs públicas (Instagram/Facebook/Threads buscam direto; LinkedIn baixa os bytes e
reenvia). Pra publicar o carrossel de lucros 2026 não passou pelo painel (upload de várias
imagens de uma vez ainda não tem UI própria) — foi um script único, direto no Node, que subiu
as 10 imagens pro mesmo bucket R2 dos Reels/Agenda (prefixo `temp-publish/`, apagado do R2
logo depois de publicar) e chamou `publique.publicarEmTodos()`/`linkedin.publicar()` com
`imagemUrls`. Se carrossel virar algo recorrente, vale construir upload múltiplo no painel
reaproveitando esse mesmo prefixo R2 — não foi feito ainda porque não foi pedido.

**Publicado ao vivo em 13/08/2026** (carrossel real "A distribuição de lucros mudou em 2026",
Lei nº 15.270/2025) em Instagram, Facebook, Threads e LinkedIn (perfil pessoal) — as quatro
confirmadas com link real do post. Threads e LinkedIn precisaram de um ajuste em cima da hora
(gotchas acima) antes de funcionar. X/Twitter ficou de fora (sem credencial ainda).

## Contas — como adicionar uma nova

Todo o roteamento de "qual credencial usar" mora num único lugar: o array `CONTAS` no topo
de `publique.js`. Adicionar uma conta nova (outra marca, ex. Cota Certa Seguros) é:

1. Criar a conta/app em cada rede que for usar (ver seção seguinte).
2. Colocar as credenciais em variáveis de ambiente novas, com um sufixo pra não colidir com
   as da Felizcred — ex. `INSTAGRAM_COTACERTA_ACCESS_TOKEN`, `INSTAGRAM_COTACERTA_ACCOUNT_ID`.
3. Copiar o bloco `{ id: "felizcred", ... }` dentro de `CONTAS`, trocar `id`/`nome` e apontar
   pras variáveis novas.

Nenhum outro arquivo muda. Uma rede sem credencial simplesmente não aparece marcável no
painel para aquela conta (fica descrito como "sem credencial configurada").

```js
// publique.js
const CONTAS = [
  { id: "felizcred", nome: "Felizcred", redes: { /* ... */ } },
  {
    id: "cotacerta",
    nome: "Cota Certa Seguros",
    redes: {
      instagram: process.env.INSTAGRAM_COTACERTA_ACCESS_TOKEN && process.env.INSTAGRAM_COTACERTA_ACCOUNT_ID
        ? { accessToken: process.env.INSTAGRAM_COTACERTA_ACCESS_TOKEN, accountId: process.env.INSTAGRAM_COTACERTA_ACCOUNT_ID }
        : null,
      facebook: null, // ainda sem Página própria
      twitter: null,
      linkedin: null,
    },
  },
];
```

## Onde criar as credenciais de cada rede

### Facebook (Página) — publicar + capa/foto/"sobre"

Usa o mesmo App da Meta já existente (`1046810638003047`, "Felizcred correspondente
bancario" — o mesmo do Instagram e dos anúncios). Passo a passo:

1. Ir em developers.facebook.com → esse App → **Ferramentas → Explorador da API Graph**.
2. No seletor "Usuário ou Página" (canto superior direito do Explorador), trocar de
   "Usuário" pra **a Página do Facebook da Felizcred**.
3. Em **Permissões**, marcar `pages_manage_posts` (publicar), `pages_manage_metadata`
   (trocar capa/foto/"sobre") e `pages_read_engagement`.
4. Clicar **"Gerar Token de Acesso"** — copiar o **Token de Acesso da Página** (esse é de
   curta duração, ~1-2h).
5. Trocar por um de longa duração (~60 dias), mesmo processo já usado pro
   `META_ADS_ACCESS_TOKEN` (troca via `fb_exchange_token` com o App ID/Secret — ver
   `CHAVES-LOCAL.md`).
6. Pegar o **ID da Página** (aparece no próprio Explorador ou em Configurações da Página →
   Sobre).
7. Passar pra mim o token + o Page ID pra eu deixar anotado e você definir no Render:
   `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`.

Instagram usa outro fluxo (Login do Instagram direto, sem precisar de Página) — já
documentado na seção "Instagram" do README principal, `INSTAGRAM_ACCESS_TOKEN` já existe.

### X/Twitter

Criar um App em developer.x.com (plano Free serve — 50 posts/dia), ativar permissão de
leitura+escrita, gerar API Key/Secret do App e Access Token/Secret da conta que vai postar
(não do App).

### LinkedIn

Criar um App em linkedin.developer.com, pedir o produto "Share on LinkedIn" (libera
`w_member_social`), gerar um Access Token OAuth2 e pegar o URN do autor
(`urn:li:person:...` pra perfil pessoal, `urn:li:organization:...` pra Página da empresa —
esse exige o produto "Community Management API" aprovado).

### Threads

Usa o mesmo App da Meta já existente (`1046810638003047`), com o produto **"Threads API"**
adicionado a ele (caso de uso à parte, não vem junto com Instagram/Facebook). Depois de
cadastrar `felizcred` como Testador do Threads (Funções do app) e aceitar o convite dentro do
Threads, o token sai direto pelo botão **"Gerador de token do usuário"** na própria tela do
caso de uso — já em longa duração, sem precisar do fluxo OAuth manual. ID do usuário do
Threads via `GET /me` (não é o mesmo ID do Instagram, mesmo sendo a mesma conta). Passo a
passo completo em `CHAVES-LOCAL.md`.

## Status

- **Instagram e Facebook**: ✅ ao vivo e testado (10/08/2026) — publicação real feita e
  confirmada nas duas redes, incluindo o card de perfil da Página (capa/foto/"sobre"/telefone).
- **LinkedIn (perfil pessoal)**: ✅ ao vivo e testado (10/08/2026) — post real publicado e
  confirmado. Token expira em ~60 dias (sem troca por longa duração como o Facebook — precisa
  refazer o login OAuth quando vencer, ver `CHAVES-LOCAL.md`).
- **LinkedIn (Página da empresa)**: Página criada, formulário de acesso ao "Community
  Management API" enviado em 11/08/2026 (App separado, exigência da própria LinkedIn — esse
  produto não pode dividir App com outros). Aguardando aprovação da LinkedIn (pode pedir
  verificação por e-mail via "Microsoft Vetting Services") — ver `CHAVES-LOCAL.md`.
- **X/Twitter**: código escrito seguindo a documentação oficial, mas **ainda não testado
  contra API real** — a conta de desenvolvedor não existe ainda.
- **Threads**: ✅ token gerado e confirmado ao vivo (12/08/2026, `GET /me` retornou a conta
  `@felizcred` de verdade). Falta só o usuário salvar `THREADS_ACCESS_TOKEN` e
  `THREADS_USER_ID` no Render (ver `CHAVES-LOCAL.md`) pra aparecer marcável no painel.

Pendências de conta/chave: ver `CHAVES-LOCAL.md`.
