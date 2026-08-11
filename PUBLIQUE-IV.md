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
14/dia ≈ 100/semana). Sem limite de quantos vídeos ficam na fila.

**Legenda**: campo de "Legenda padrão" no card (usada em todo vídeo que não tiver uma legenda
própria) + campo opcional por vídeo no upload (se deixar em branco, cai na padrão).

**Data mínima por vídeo (opcional)**: no upload, ou depois direto na fila, dá pra marcar
"não publicar antes de" uma data pra um vídeo específico — não é um horário exato obrigatório,
é um piso: o vídeo só entra na leva normal de publicação quando essa data chegar (sem data,
publica na ordem normal da fila). A seção **"📋 Fila"** no card mostra todo vídeo pendente com
uma **data prevista** (estimativa recalculada toda vez a partir da posição na fila + ritmo
configurado — não é gravada, muda se a quantidade/dia mudar), e por item:
- **Publicar agora** — publica esse vídeo específico na hora, fora da ordem (ignora a data
  mínima de propósito, é uma ação manual e explícita).
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
            publicarProximoPendente() (próximo elegível, respeita data mínima) e
            publicarItemEspecifico() (um vídeo específico, ignora ordem/data — botão
            manual), listarFilaComEstimativa() (fila + data prevista calculada),
            definirData()/removerItem() e limparAntigos() (apaga do R2 quem foi
            publicado há mais de 24h).
instagram.js → publicarReels() (fluxo de container de vídeo — media_type REELS, polling
            até o Instagram terminar de processar antes de publicar).
facebook.js → publicarReels() (API de Reels da Página — fluxo "hosted file": start →
            aponta a URL do vídeo → polling do status → finish/publish).
db.js       tabela reels_queue (coluna `drive_file_id` guarda a **key do objeto no R2** —
            nome mantido por compatibilidade, não é mais literalmente do Drive; status
            pending/posted/error, `arquivo_apagado` controla a limpeza de 24h,
            `agendado_para` é a data mínima opcional) + reels_config (liga/desliga,
            posts_por_dia, legenda_padrao, controle de horário).
server.js   rotas (POST /painel/api/reels/upload, GET .../status, GET .../fila,
            POST .../sincronizar, .../pausar, .../posts-por-dia, .../legenda-padrao,
            .../publicar-agora, .../:id/reenfileirar, .../:id/publicar-agora,
            .../:id/data, DELETE .../:id) + o setInterval que checa a cada minuto se
            bateu algum horário do dia (calcularHorariosDoDia() gera os horários
            dinamicamente a partir da quantidade configurada) + setInterval de hora em
            hora que roda a limpeza do R2. Upload usa multipart/streaming (`busboy`) —
            nunca base64/JSON.
public/painel.html  card "🎬 Reels em massa" na aba Publicar: legenda padrão, upload em
            lote com legenda + data mínima por vídeo, indicador de espaço usado no R2,
            quantidade/dia, resumo, seção "Fila" (pendentes com data prevista + publicar
            agora/remover por item), "Histórico recente" (publicado/erro).
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
