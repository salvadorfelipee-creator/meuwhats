---
name: caixinha-pergunta-instagram
description: "Gera posts no formato de caixinha de pergunta nativa do Instagram (cabeçalho escuro + campo branco com a pergunta) sobre uma FOTO REAL da marca, para Instagram Story — com resposta escrita no rodapé OU resposta em áudio (e nesse caso também vira Reels). Use quando o usuário pedir 'post estilo pergunta e resposta', 'caixinha de pergunta', 'formato bate-bola', ou pedir pra repetir esse formato com perguntas/fotos novas. Já vem com as proporções da caixinha validadas pixel a pixel contra um exemplo real, o pipeline de áudio gratuito (edge-tts, sem conta) e o de vídeo (ffmpeg) prontos — só falta o conteúdo (perguntas/respostas) e a foto."
---

# Caixinha de pergunta do Instagram

Reproduz a caixinha NATIVA de pergunta do Instagram (não um card genérico de
propaganda) — cabeçalho escuro compacto + campo branco com a pergunta,
flutuando sobre uma foto real da marca. Validado ao vivo comparando pixel a
pixel com um exemplo real fornecido pelo usuário até bater exatamente:
largura 675px, cabeçalho 103px, campo da pergunta 189px, topo a 124px do
canto superior, `border-radius` 30px, tudo num canvas de Story 1080×1920.

⚠️ **Antes disso, duas tentativas erradas já foram feitas e rejeitadas**:
1. Um cartão grande tipo "card branco/preto" (proporção de anúncio, não de
   caixinha) — rejeitado como "totalmente errado".
2. O modelo com avatar circular + campo cinza "Digite algo..." (estilo do
   Canva de caixinha "em branco", pra quem ainda vai receber perguntas) — não
   é o que foi validado no final; o formato final é o do cabeçalho escuro
   (tipo "Bate bola") + pergunta já preenchida.

Se o usuário pedir esse formato de novo, usar direto as medidas abaixo — não
redesenhar do zero.

## Regra absoluta: foto real, nunca gerada

A foto de fundo é **sempre** uma foto real fornecida pelo usuário (produto,
veículo, loja, pessoa da equipe). Nunca gerar uma foto nova por IA nem
redesenhar/alterar a foto original — ela entra como background e a única
intervenção visual é a caixinha por cima.

### Se a marca não tiver nenhuma foto real (fallback: vídeo de fundo)

Já aconteceu (Felizcred) de a marca não ter nenhuma foto/vídeo real próprio
disponível. Antes de aceitar um vídeo de terceiro como fundo, **avisar
explicitamente o usuário** que isso quebra a regra acima e verificar a
origem (um vídeo baixado de um "downloader" de Pinterest/TikTok, com título
descolado do conteúdo e visual "liso demais", tem cara de IA e não tem
direito de uso comercial claro — ver `feedback_content_rights_video_sourcing.md`
na memória). Só usar se o usuário decidir conscientemente mesmo assim.

Tecnicamente, um vídeo de fundo funciona assim (em vez do `--foto` estático):
1. Gerar só o **overlay transparente** (caixinha + gradiente + resposta),
   sem a camada `.bg`, com `page.screenshot(..., omit_background=True)` no
   Playwright — vira um PNG com alfa.
2. Compor com ffmpeg por cima do vídeo de fundo, em loop:
   `ffmpeg -stream_loop -1 -i fundo.mp4 -loop 1 -i overlay.png -filter_complex
   "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg];[bg][1:v]overlay=0:0[v]"
   -map "[v]" -t 6 -an story.mp4` (Story mudo, 6s de loop) — ou com `-i
   resposta.mp3 -map "2:a" -shortest` no lugar de `-t 6 -an` pro Reels (dura o
   tempo do áudio).
2 vídeos de fundo → intercalar por paridade do índice (ímpar/par) evita
repetir sempre o mesmo clipe consecutivamente.

## Dois modos

| Modo | O que aparece na imagem | Onde a resposta vai | Vira Reels? |
|---|---|---|---|
| `texto` | Pergunta na caixinha + **resposta escrita** no rodapé, sobre gradiente escuro | Escrita na própria imagem | Não |
| `audio` | Pergunta na caixinha (+ resposta escrita, se o cliente pedir — ver variante abaixo) | Em áudio, narrada | **Sim** — Story **e** Reels usam o mesmo vídeo com áudio |

⚠️ **Histórico**: por muito tempo o modo `audio` teve duas regras fixas —
"a resposta nunca aparece escrita" (pedido repetido da Cota Certa) e "o
Story é mudo, só o Reels tem áudio" (decisão original de design, achando
que Story só serve pra ser um teaser). **A segunda regra foi revertida**:
tanto a Felizcred quanto a Cota Certa pediram que o Story pare de ser mudo
e passe a usar o mesmo vídeo com áudio do Reels — "se o Reels tem áudio,
por que o Story não tem?" foi a pergunta que gerou a mudança (18-21/08/2026).

⚠️ **Isso não era limitação técnica do Instagram** — Stories aceitam vídeo
com áudio normalmente (mesmo mecanismo do Reels, ver seção de
`instagram.publicarStory` abaixo). O Story saía mudo porque o ffmpeg
cortava o áudio de propósito (`-an`) como escolha de design, não porque a
API exigisse isso. Se pedirem Story mudo de novo, é uma escolha válida (ver
"Story como teaser" abaixo), mas não é mais o padrão.

### Padrão atual: Story = Reels (mesmo vídeo, mesmo áudio)

- Gerar **um vídeo só** por item de áudio (caixinha + pergunta [+ resposta
  escrita, se pedido] + selo de som + narração), publicado **duas vezes**:
  uma vez com `redes: ["instagram_story"]` (texto do post vazio — Story não
  aceita legenda) e outra com `redes: ["instagram_reels"]` (legenda rica,
  ver seção de SEO abaixo).
- Não precisa compor um `story.mp4` mudo separado — é o mesmo arquivo nos
  dois posts.

### Resposta escrita: pedir ao usuário, não assumir

Continua sendo uma escolha por cliente se a resposta aparece escrita na
imagem além de narrada (Felizcred pediu que sim; Cota Certa manteve só
pergunta na imagem, resposta só falada). Perguntar antes de gerar em lote.

### Story como teaser mudo (variante antiga, só se pedirem de volta)

Se algum cliente especificamente quiser voltar ao Story mudo (só pergunta,
sem áudio, como incentivo pra ir ver o Reels completo): compor um
`story.mp4` separado com `-an` no ffmpeg, sem o selo de som (colocar selo
sem áudio de verdade engana o espectador).

### Selo "Ative o som" (em qualquer post que realmente tenha áudio)

Sem nenhum indicativo visual, o espectador assiste mudo sem saber que tem
voz falando. Adicionar um selo fixo (canto superior direito, ~52px do
topo) em todo vídeo que realmente carregar áudio (hoje isso é Story **e**
Reels, já que os dois usam o mesmo arquivo):

```html
<div style="position:absolute; top:52px; right:40px; background:rgba(0,0,0,0.55); color:#fff; font-weight:600; font-size:22px; padding:10px 20px; border-radius:999px; display:flex; align-items:center; gap:10px;">
  <div style="display:flex; align-items:center; gap:3px; height:20px;">
    <span style="width:4px; height:8px; background:#fff; border-radius:2px;"></span>
    <span style="width:4px; height:18px; background:#fff; border-radius:2px;"></span>
    <span style="width:4px; height:12px; background:#fff; border-radius:2px;"></span>
    <span style="width:4px; height:20px; background:#fff; border-radius:2px;"></span>
    <span style="width:4px; height:10px; background:#fff; border-radius:2px;"></span>
  </div>
  Ative o som
</div>
```

As barrinhas de altura variável (estilo equalizador/onda sonora) reforçam
"tem alguém falando aqui" de forma mais intuitiva que só o emoji de
alto-falante sozinho.

## Passo a passo

### 1. Preparar o conteúdo

JSON com a lista de perguntas/respostas:

```json
[
  { "pergunta": "Seguro de moto cobre roubo e furto?", "resposta": "Sim. O seguro pode oferecer cobertura para roubo e furto, mas isso depende das condições da apólice contratada." }
]
```

Se o usuário fornecer um documento fonte (cartilha, FAQ, blog), usar o
conteúdo real de lá — não inventar coberturas/dados, principalmente em
contexto de seguros/produtos financeiros (ver regra de responsabilidade do
próprio negócio, se houver um Manual Mestre ou cartilha no projeto).

### 2. Gerar as imagens

```bash
python3 "C:\Users\Salvador\.claude\skills\caixinha-pergunta-instagram\generate.py" conteudo.json \
  --foto "caminho/da/foto-real.png" --modo texto --out ./saida --titulo "Bate bola"
```

`--titulo` é o texto do cabeçalho escuro (default `"Bate bola"` — trocar só
se o usuário pedir outro texto/marca específica). `--modo audio` pra série
com áudio.

Cada item vira uma pasta `NNN/` dentro de `--out`, com `arte.png` +
`pergunta.txt` + (`resposta.txt` ou `resposta_audio.txt`).

### 3. Se for modo áudio: gerar o áudio

```bash
python3 "C:\Users\Salvador\.claude\skills\caixinha-pergunta-instagram\gerar_audio.py" ./saida --voz pt-BR-AntonioNeural
```

Usa **edge-tts** — motor de voz gratuito, sem conta nem API key, com vozes
brasileiras nativas de qualidade neural (mesma tecnologia da Azure).

⚠️ **Não usar ElevenLabs por padrão pra esse formato**: contas no plano
gratuito não conseguem gerar áudio de vozes de biblioteca via API (erro
`payment_required`, testado e confirmado — inclusive vozes que já tinham
funcionado antes pra outro projeto pararam de funcionar). Só considerar
ElevenLabs se o usuário pedir explicitamente ou fizer upgrade de plano.

Vozes pt-BR já confirmadas: `pt-BR-AntonioNeural` (masculina, default),
`pt-BR-FranciscaNeural` (feminina), `pt-BR-ThalitaMultilingualNeural`
(feminina). Ver todas com `python3 -m edge_tts --list-voices`.

Se o usuário quiser narrar com a própria voz: ou (a) ele grava e manda o
áudio pra usar direto, sem TTS nenhum, ou (b) clona a voz dele no ElevenLabs
(clonagem de voz funciona no plano free, diferente das vozes de biblioteca) e
usa a API do ElevenLabs normalmente a partir daí.

### 4. Se for modo áudio: gerar o vídeo de Reels

```bash
python3 "C:\Users\Salvador\.claude\skills\caixinha-pergunta-instagram\gerar_reels.py" ./saida
```

Junta `arte.png` + `resposta.mp3` num `reels.mp4` (ffmpeg, imagem estática +
trilha de áudio, 1080×1920, dura o tempo do áudio).

### 5. Mostrar pro usuário revisar

Antes de agendar/publicar, mostrar pelo menos um exemplo de cada modo (Read
tool na imagem) — só seguir depois de aprovado, igual ao fluxo já validado.

## Publicar / agendar (Publique IV)

Via `POST /painel/api/agenda` (`https://meuwhats.onrender.com`, auth básica —
ver `CHAVES-LOCAL.md` na raiz do projeto `meuwhatsapp`):

- **Modo texto** → Story só:
  ```json
  { "contaId": "cotacerta", "texto": "...", "redes": ["instagram_story"], "data": "2026-08-20T08:00", "imagemBase64": "data:image/png;base64,..." }
  ```
- **Modo áudio** → Story (a imagem) **+ Reels (o vídeo)**, dois posts separados na agenda:
  ```json
  { "contaId": "cotacerta", "texto": "pergunta", "redes": ["instagram_story"], "data": "2026-08-20T08:00", "imagemBase64": "data:image/png;base64,..." }
  { "contaId": "cotacerta", "texto": "pergunta + CTA leve", "redes": ["instagram_reels"], "data": "2026-08-20T08:06", "videoBase64": "data:video/mp4;base64,..." }
  ```

`redes: ["instagram_reels"]` só funciona pra contas que já têm
`INSTAGRAM_*_ACCESS_TOKEN`/`INSTAGRAM_*_ACCOUNT_ID` configurados (reaproveita
a mesma credencial do Instagram feed/Story — não precisa de nada extra). Ver
`agenda.js`/`publique.js` — suporte a vídeo (`video_key`, `videoBase64`)
adicionado especificamente pra esse formato.

⚠️ **Story com fundo em vídeo (não foto estática) precisa de
`instagram.publicarStory` aceitar `videoUrl`** — isso foi adicionado depois
que a Felizcred testou (a versão original só aceitava `imagemUrl` e dava
"Story exige uma imagem"). Se `instagram.js` não tiver esse suporte, é só
adicionar `video_url` no `media_type: "STORIES"` do container, igual ao
Reels — testado e funcionando ao vivo em 18/08/2026.

### Legenda / SEO: só o Reels aceita, o Story não

O Instagram **não tem parâmetro de legenda pra Story via API** (nem pra post
manual — o que a pessoa "escreve" ao postar um Story vira texto desenhado
na imagem, não uma legenda separada). Então, se o usuário pedir texto
otimizado pra busca/algoritmo na legenda:
- **Reels**: pode e deve — legenda rica com pergunta + resposta por escrito
  + hashtags do tema (ex: `#FGTS #FGTS2026 #TrabalhadorCLT`), ajuda tanto o
  algoritmo do Instagram quanto indexação externa.
- **Story**: impossível via API — explicar isso ao usuário antes de tentar,
  não prometer o que a plataforma não permite.

## Se for produzir em lote (dezenas/centenas de itens)

Ver o exemplo real completo em `PLAYBOOK-COTACERTA-100-CAIXINHAS.md` (raiz do
projeto `meuwhatsapp`) — inclui: como escolher quais perguntas viram áudio
(gancho/curiosidade mais forte, espalhadas ao longo da série pra não
concentrar tudo de áudio num trecho só) e como intercalar temas/dias.

## Detalhes de fidelidade visual (não mexer sem re-validar contra referência real)

- Fonte: **Poppins** (600 no cabeçalho e na pergunta, 400 na resposta)
- Cabeçalho: fundo `#151515`, texto branco, 103px de altura, ~26px de fonte
- Campo da pergunta: fundo branco, texto `#111111`, ~30px de fonte, mínimo
  189px de altura
- Caixa inteira: 675px de largura (~62% de 1080), `border-radius` 30px,
  sombra suave, começando a 124px do topo, centralizada horizontalmente
- Modo texto: gradiente escuro só no rodapé (~46% da altura), resposta em
  branco ~30px, sem destaque colorido (mantém simples/legível em lote)
- Posição da resposta: `bottom:15%` (**não** 5.5%, valor antigo) — um Story
  real publicado (Felizcred, 18/08/2026) mostrou o texto colidindo com a
  barra nativa "Responder a [conta]..." que o Instagram sobrepõe no rodapé
  de todo Story. 15% deixa a resposta dentro da zona segura recomendada pela
  Meta (~250px de margem inferior num canvas de 1920px).
