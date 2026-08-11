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

## Reels em massa (Google Drive → Instagram, agendado)

Além da publicação manual de 1 clique, o Publique IV tem uma segunda engrenagem pensada
pra publicar um **acervo grande de vídeos prontos** (ex.: 1500 Reels editados) sozinho, aos
poucos, sem precisar subir cada um na mão.

Como funciona:

1. Você guarda os vídeos numa pasta do **Google Drive**.
2. O servidor lê essa pasta (só leitura, via Service Account) e monta uma **fila** no banco
   (tabela `reels_queue`), na ordem alfabética dos nomes dos arquivos.
3. Todo dia, em 5 horários fixos (09:00, 12:15, 15:30, 18:45, 21:00 — horário de Brasília), o
   agendador pega o **próximo vídeo pendente**, baixa do Drive, aplica a **moldura FelizCred**
   (ver abaixo) e publica como Reels no Instagram.
4. Cada vídeo processado é apagado do disco depois de publicado — só existe pelo tempo da
   publicação (o Drive continua sendo a fonte, nada é duplicado permanentemente no servidor).

Fica **pausado por padrão** — só começa a publicar sozinho depois de ligar o botão "Ativar
agendamento" no painel (aba 🚀 Publicar → card "Reels em massa").

### A moldura

`assets/reels-frame.png` é um PNG 1080×1920 com fundo navy (cor da marca), uma "janela"
arredondada transparente no meio e a marca **FelizCred** no topo + botão "Fale com a gente"
embaixo. `video.js` recorta/redimensiona cada vídeo pra preencher o quadro 1080×1920 e
sobrepõe esse PNG por cima — o vídeo só aparece através da janela, tudo ao redor é a moldura.

**Pra trocar o design**: o mais rápido é só pedir aqui (cor, texto, tamanho da janela) — eu
edito e gero de novo em minutos. Se preferir mexer você mesmo: o "código-fonte" da moldura é
`assets/reels-frame-fonte.html` (HTML/SVG simples); depois de editar, rodar
`node assets/gerar-moldura.js` regenera o PNG (usa Playwright, já instalado no projeto). Dá
pra editar direto num programa de design também (Canva/Figma/Photoshop) — só precisa exportar
um PNG 1080×1920 com transparência numa janela de 968×1330 começando em (56, 248), e
substituir `assets/reels-frame.png` — nesse caso não mexe no HTML nem no script.

### Vídeo já editado por fora ("pular" processamento)

Se o vídeo já vem pronto de outro programa (CapCut, etc. — moldura própria já aplicada,
formato certo), não precisa passar pelo ffmpeg daqui: escolha **"Sem processamento"** como
moldura — tanto no editor manual quanto na fila automática do Drive (seletor "Moldura da
fila automática" no card Reels). Nesse modo o servidor só copia o arquivo e publica, sem
decodificar/recodificar nada — instantâneo e sem risco de estourar memória, porque o
trabalho pesado já foi feito no computador de quem editou, não no servidor.

### Editor manual (upload direto do computador, sem Drive)

Pra quem tem vídeo no computador em vez de no Drive: aba Publicar → card Reels → seção
"✂️ Editor manual". Aceita **vários vídeos de uma vez** (seleção múltipla) e processa **um
por vez, em sequência automática** (não em paralelo — o processamento de vídeo consome CPU,
rodar vários ao mesmo tempo derrubaria o servidor no plano free do Render).

Opções aplicadas a todos os vídeos do lote de uma vez:

- **Moldura**: "FelizCred" (janela + marca, padrão) ou "Sem moldura" (só recorta/redimensiona
  pro formato Reels, sem overlay nenhum).
- **Qualidade**: 1080×1920 (padrão) ou 720×1280 (arquivo menor).
- **Música** (opcional): sobe um áudio e ele **substitui** a trilha original inteira (não
  mixa com a narração — se quiser manter o áudio original, não anexe música).

Pra cada vídeo pronto tem dois botões:

- **Baixar** — pega o arquivo processado, sem publicar em nada.
- **Publicar no Instagram** — publica direto como Reels, usando a legenda escrita no campo
  acima da lista.

Esse caminho é **independente do Drive e da fila automática** — não precisa configurar nada
de Google pra usar só o editor manual.

O upload é feito via **multipart** (arquivo enviado direto pro disco, streaming) — não em
base64 dentro de JSON. Um vídeo grande como base64 numa string só multiplicava o uso de
memória e já derrubou o servidor no plano free do Render (erro "Unexpected end of JSON
input" no navegador).

O processamento também é **assíncrono**: o upload responde na hora com um `jobId` e o
ffmpeg roda em segundo plano — o painel fica perguntando `.../editor/status/:jobId` a cada
2s até terminar. Isso existe porque o proxy do Render derruba a conexão (502) se a resposta
demorar demais dentro de 1 requisição só, e processar vídeo grande pode passar desse tempo
mesmo sem faltar memória.

Ainda assim, o processo inteiro (não só a requisição) pode cair com vídeo grande — nesse
caso o polling recebe uma página de erro do próprio Render em vez de JSON (erro tipo
"Unexpected token '<' ... is not valid JSON" no navegador, porque veio HTML e não JSON).
Camadas de proteção adicionadas contra isso: `video.js` roda o ffmpeg com `-threads 1` e
preset `ultrafast` (menos pico de memória que rodar em paralelo com `veryfast`), e o limite
de upload caiu de 300MB pra **150MB** (`server.js`, `receberMultipart`). Se o erro voltar a
acontecer mesmo assim com vídeo grande (dezenas/centenas de MB), é sinal de que passou do
que o plano free do Render aguenta processar de uma vez — nesse caso vale comprimir o vídeo
antes, tentar um vídeo menor, ou considerar um plano pago do Render (mais RAM/CPU).

### Arquitetura

```
drive.js    autenticação de Service Account do Google (JWT assinado na mão, sem SDK) +
            listar/baixar vídeos de uma pasta do Drive.
video.js    aplicarMoldura() — ffmpeg (via ffmpeg-static, empacotado no projeto porque o
            Render não tem ffmpeg instalado por padrão) recorta o vídeo pro formato Reels
            e sobrepõe assets/reels-frame.png.
reels.js    orquestrador: sincronizarFila() (Drive → banco) e publicarProximoPendente()
            (baixa, aplica moldura, publica, limpa arquivos temporários).
instagram.js → publicarReels() (fluxo de container de vídeo — igual à imagem, mas
            media_type REELS e um polling bem mais longo, vídeo demora mais pra processar).
db.js       tabela reels_queue (status: pending/posted/error) + reels_config (liga/desliga,
            controle de qual horário já postou hoje).
server.js   rotas (GET /painel/api/reels/status, POST .../sincronizar, .../pausar,
            .../publicar-agora, .../:id/reenfileirar) + o setInterval que checa a cada
            minuto se bateu algum dos 5 horários do dia.
public/painel.html  card "🎬 Reels em massa" na aba Publicar: resumo (pendentes/publicados/
            com erro), botão de sincronizar, liga/desliga do agendamento, botão de testar
            publicando 1 agora, e lista dos últimos itens com link de quem já foi publicado.
```

### Configuração (variáveis de ambiente)

- `GOOGLE_SERVICE_ACCOUNT_JSON` — conteúdo inteiro do JSON da Service Account (Console do
  Google Cloud → APIs e serviços → Credenciais → Criar credenciais → Conta de serviço →
  aba Chaves → Adicionar chave → JSON).
- `GOOGLE_DRIVE_REELS_FOLDER_ID` — ID da pasta do Drive com os vídeos (pega da URL:
  `drive.google.com/drive/folders/ESSE_ID_AQUI`).
- A pasta do Drive precisa estar **compartilhada com o e-mail da Service Account**
  (algo tipo `nome@projeto.iam.gserviceaccount.com`, aparece na tela da conta de serviço),
  permissão de **Leitor** já é suficiente.

### Status

- Código completo e testado localmente: pipeline de moldura (ffmpeg real, verificado
  visualmente), rotas do painel (fila vazia, pausar/ativar, sincronizar sem credencial →
  erro claro), UI do card renderizando certo.
- **Pendente**: criar a Service Account do Google e configurar as duas variáveis acima —
  depois disso, o primeiro teste real (1 vídeo, botão "Publicar 1 agora") fica pra ser feito
  puxando um vídeo de verdade da pasta, antes de ligar o agendamento automático dos 1500.

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
