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

Hoje cobre: **Instagram, Facebook, X/Twitter e LinkedIn.**

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
| LinkedIn | `commentary` do post | **não sobe imagem própria** (exigiria o fluxo de registro de upload da LinkedIn — não implementado) | se tiver, LinkedIn gera a prévia/thumbnail automática do site |

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

## Reels em massa (Google Drive → Instagram + Facebook, agendado)

Além da publicação manual de 1 clique, o Publique IV tem uma segunda engrenagem pensada
pra publicar um **acervo grande de vídeos já prontos** (editados fora — CapCut, etc., moldura
e tudo já aplicado) sozinho, aos poucos, sem precisar subir cada um na mão.

**Decisão importante (11/08/2026)**: esse sistema **não processa vídeo nenhum** — não tem
mais ffmpeg, moldura, editor manual, nem qualquer coisa parecida. O vídeo já vem pronto de
fora; o servidor só baixa e publica. Isso foi uma escolha deliberada: rodar ffmpeg no plano
free do Render derrubava o processo por falta de memória em vídeos de tamanho normal (~78MB já
bastava) — ver `feedback_content_rights_video_sourcing` e o histórico da conversa de
11/08/2026 pra detalhes de todas as tentativas de correção que não resolveram de vez. Sem
processamento nenhum, esse problema simplesmente não existe mais, e não precisa de nenhuma
infraestrutura extra (chegou a se cogitar Oracle Cloud pra rodar o ffmpeg à parte — descartado
junto com a decisão de sempre editar por fora).

Como funciona:

1. Você edita os vídeos por fora (moldura, cortes, tudo).
2. Sobe pra fila **direto pelo painel** — botão "Escolher vídeo(s)" no card, aceita vários de
   uma vez. Por baixo dos panos o servidor manda cada um pro Google Drive (`drive.js` →
   `enviarVideo()`), que é só o "depósito" — você nunca precisa abrir o Drive manualmente, é
   tudo pelo painel mesmo. (Também dá pra jogar vídeo direto na pasta do Drive por fora, se
   preferir, e clicar em "Sincronizar de novo".)
3. O servidor lê essa pasta e monta uma **fila** no banco (tabela `reels_queue`), na ordem
   alfabética dos nomes dos arquivos.
4. Ao longo do dia, em horários espalhados entre **08:00 e 22:00** (horário de Brasília), o
   agendador pega o **próximo vídeo pendente**, baixa do Drive e publica como Reels — **no
   Instagram e no Facebook ao mesmo tempo** (as duas contam como sucesso independente uma da
   outra; se uma falhar, a outra publica normalmente).
5. O vídeo baixado é apagado do disco logo depois de publicar — só existe pelo tempo da
   publicação (o Drive continua sendo a fonte/backup, nada fica duplicado permanentemente no
   servidor — importante porque o disco do Render é efêmero e não aguentaria guardar uma fila
   de semanas).

**Quantidade por dia é configurável** (campo "Quantos posts por dia" no card) — os horários
são recalculados automaticamente, espalhados entre 08:00–22:00 conforme a quantidade (ex.:
14/dia ≈ 100/semana). Sem limite de quantos vídeos ficam na fila — pode sincronizar a pasta
do Drive com quantos vídeos quiser, o agendador vai consumindo no ritmo configurado.

Fica **pausado por padrão** — só começa a publicar sozinho depois de ligar o botão "Ativar
agendamento" no painel (aba 🚀 Publicar → card "Reels em massa").

### Arquitetura

```
drive.js    autenticação de Service Account do Google (JWT assinado na mão, sem SDK) +
            listar/baixar/**enviar** vídeos numa pasta do Drive.
reels.js    orquestrador: enviarVideo() (upload do painel → Drive → sincroniza),
            sincronizarFila() (Drive → banco) e publicarProximoPendente() (baixa, publica
            em Instagram + Facebook, limpa o arquivo temporário).
instagram.js → publicarReels() (fluxo de container de vídeo — media_type REELS, polling
            até o Instagram terminar de processar antes de publicar).
facebook.js → publicarReels() (API de Reels da Página — fluxo "hosted file": start →
            aponta a URL pública do vídeo → polling do status → finish/publish).
db.js       tabela reels_queue (status: pending/posted/error, guarda o resultado por rede
            em JSON) + reels_config (liga/desliga, posts_por_dia, controle de que horário
            já postou hoje).
server.js   rotas (POST /painel/api/reels/upload, GET .../status, POST .../sincronizar,
            .../pausar, .../posts-por-dia, .../publicar-agora, .../:id/reenfileirar) + o
            setInterval que checa a cada minuto se bateu algum horário do dia
            (calcularHorariosDoDia() gera os horários dinamicamente a partir da
            quantidade configurada). Upload usa multipart/streaming (`busboy`) igual o
            resto do projeto pra arquivo grande — nunca base64 dentro de JSON.
public/painel.html  card "🎬 Reels em massa" na aba Publicar: botão de enviar vídeo(s)
            direto (upload em lote, sequencial), campo de quantidade/dia, resumo
            (pendentes/publicados/com erro), sincronizar manual, liga/desliga, testar
            publicando 1 agora, lista dos últimos itens com link de cada rede publicada.
```

**Facebook Reels ainda não testado contra API real** (código escrito seguindo a documentação
oficial da Meta, mesmo padrão do resto do projeto pra funcionalidade nova) — só vai ser
confirmado quando o primeiro vídeo de verdade passar pela fila com o agendamento ligado.
Instagram Reels já está testado e funcionando (ver seção Status mais abaixo).

### Configuração (variáveis de ambiente)

- `GOOGLE_SERVICE_ACCOUNT_JSON` — conteúdo inteiro do JSON da Service Account (Console do
  Google Cloud → APIs e serviços → Credenciais → Criar credenciais → Conta de serviço →
  aba Chaves → Adicionar chave → JSON).
- `GOOGLE_DRIVE_REELS_FOLDER_ID` — ID da pasta do Drive com os vídeos (pega da URL:
  `drive.google.com/drive/folders/ESSE_ID_AQUI`).
- A pasta do Drive precisa estar **compartilhada com o e-mail da Service Account**
  (algo tipo `nome@projeto.iam.gserviceaccount.com`, aparece na tela da conta de serviço),
  permissão de **Editor** (não só Leitor — desde que o upload direto do painel existe, o
  servidor também precisa escrever na pasta, não só ler).

### Status

- Google Drive: Service Account criada e autenticação testada de verdade pra **leitura**
  (11/08/2026, `drive.listarVideos()` confirmado funcionando). `GOOGLE_SERVICE_ACCOUNT_JSON`
  já configurado no Render, escopo trocado de `drive.readonly` pra `drive` completo (precisa
  de escrita agora pro upload). `enviarVideo()` (upload) é código novo, **ainda sem teste
  real** — depende da pasta estar compartilhada em Editor e do `GOOGLE_DRIVE_REELS_FOLDER_ID`
  configurado, nenhum dos dois pronto ainda.
- `GOOGLE_DRIVE_REELS_FOLDER_ID` ainda **não configurado** — falta o usuário criar/escolher a
  pasta real, compartilhar com a Service Account em **Editor** e passar o ID.
- Rotas do painel testadas localmente (fila vazia, pausar/ativar, quantidade/dia, sincronizar
  sem credencial → erro claro).
- Publicação: Instagram Reels já testado e funcionando em produção. Facebook Reels é código
  novo (11/08/2026), seguindo a documentação oficial, mas **ainda sem teste real** — só vai
  confirmar quando rodar com um vídeo de verdade.

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

Pendências de conta/chave: ver `CHAVES-LOCAL.md`.
