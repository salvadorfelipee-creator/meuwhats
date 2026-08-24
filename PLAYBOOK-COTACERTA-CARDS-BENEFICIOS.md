# Playbook — Cards de Benefícios (Cota Certa Seguros)

Terceiro formato de conteúdo pro Instagram da Cota Certa, diferente dos outros
dois já existentes:
- `PLAYBOOK-COTACERTA-100-CAIXINHAS.md` — caixinha de pergunta sobre a foto
  real da moto (Story/Reels de áudio).
- `PLAYBOOK-COTACERTA.md` — carrossel formato print de tweet (feed).
- **Este aqui** — card branco de benefícios (título + badge + 5 coberturas +
  CTA de WhatsApp), sem foto, pros produtos institucionais/B2B: seguro
  empresarial, residencial, para funcionários, frotas.

## O formato

Card 100% texto/ícone (sem foto de marca), cores e fontes do site
`cotacerta-seguros/index.html`: Poppins nos títulos, Inter no corpo,
`--blue:#0066FF; --blue-dark:#0052CC; --blue-light:#EAF1FF; --green:#25D366;
--ink:#1A1D29; --muted:#666D80`.

Estrutura fixa:
1. **Título** (Poppins 700, azul-escuro) — ex: "Seguro de Empresa"
2. **Badge** (Poppins 800, pílula azul-escura, texto branco) — resumo curto
   das coberturas em 3-4 palavras, ex: "roubo, furto e vidro"
3. **5 benefícios** — bolinha azul + `<b>Título curto:</b> descrição em
   1-2 linhas`
4. **CTA** — card com borda verde, ícone de WhatsApp, texto curto em
   maiúsculas (ex: "PERSONALIZE SEU PLANO")

Cada tema vira **3 arquivos** (mesmo conteúdo, formato/dimensão diferente):

| Formato | Dimensão | Arquivo | Como é |
|---|---|---|---|
| Story | 1080×1920 | `insta-story-<slug>.png` | estático, `top:420px` |
| Feed | 1080×1350 | `feed-<slug>.png` | estático, conteúdo centralizado verticalmente (`.post{display:flex;align-items:center}`), fontes ~20% menores que o Story |
| Reels | 1080×1920 | `reels-<slug>-animado.mp4` | **animado** — ver seção abaixo |

Todos ficam em `cotacerta-seguros/social/`.

## Reels animado — como gerar

Regra do usuário: **narração só lê os títulos**, nunca a descrição inteira de
cada benefício (senão o vídeo passa de 1 minuto). E **máximo ~19 segundos**
de vídeo total. Botão de WhatsApp **pulsa** (animação contínua) assim que
aparece na tela. Efeito de **partículas** (bolinhas que estouram e somem) em
CADA bloco que aparece — título, badge, cada benefício e o CTA — não só no
botão.

Passo a passo (scripts em `cotacerta-seguros/social/_narracao.py` e
`_gravar_video.py`, editar pra cada tema novo):

1. **Narração por bloco** — `edge-tts`, voz `pt-BR-AntonioNeural`. Um mp3 por
   bloco: `intro` (título + badge), `b1`..`b5` (só o título em negrito de
   cada benefício, sem a descrição), `cta` (texto do botão). Editar a lista
   `BLOCOS` em `_narracao.py`.
2. **Medir duração de cada mp3** (`ffprobe -show_entries format=duration`) e
   montar a timeline: cada bloco começa onde o anterior termina + 0.1s de
   silêncio. Gerar esse silêncio com
   `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 0.1 ...` e concatenar tudo
   com `-filter_complex concat` num único `narracao_completa.mp3`. Se a soma
   passar de ~19s, cortar/reescrever os títulos (não a taxa de fala).
3. **HTML animado**: cada bloco começa com `opacity:0` (classe `.reveal`).
   Um `<script>` no fim da página tem um array `timeline = [[segundos, id,
   cor, nº de partículas], ...]` com os tempos calculados no passo 2, e
   `setTimeout` pra cada um chamar `reveal(id)` — que adiciona a classe
   `visible` (fade+scale via CSS transition) e dispara `burst()` (gera N
   `div.particle` no centro do elemento, cada uma anima até um ponto
   aleatório e some em 0.7s). O bloco `cta` também ganha a classe `pulsing`
   (box-shadow verde pulsando, `animation: pulse 1s infinite`).
4. **Gravar o vídeo**: Playwright, `context = browser.new_context(viewport=
   {1080,1920}, record_video_dir=..., record_video_size={1080,1920})`,
   `page.goto(url)`, `page.wait_for_timeout(duração_do_áudio_ms + margem)`,
   fechar o context pra salvar o `.webm`.
5. **Juntar vídeo + áudio**: `ffmpeg -i video.webm -i narracao_completa.mp3
   -map 0:v -map 1:a -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a
   192k -shortest saida.mp4` — o `-shortest` corta o vídeo (gravado mais
   longo, com margem) pro tamanho exato do áudio.
6. Apagar arquivos intermediários (`_video_raw/`, frames de preview,
   `audio_partes/*.mp3` — esses ficam fora do Git, ver `.gitignore`).

## O que já existe no Git

- `_narracao.py`, `_gravar_video.py` — scripts genéricos, editar o conteúdo
  pra cada tema novo (não são parametrizados por JSON ainda — é edição
  manual dos textos/timeline a cada rodada).
- `reels-seguro-empresarial-animado.html`/`.mp4` — modelo de Reels validado
  (18.8s, narração só de títulos, partículas + botão pulsando).
- `insta-story-seguro-empresarial-roubo-furto-vidro.html`/`.png` — Story.
- `feed-seguro-empresarial-roubo-furto-vidro.html`/`.png` — Feed.

Conteúdo do primeiro tema (**Seguro Empresarial**, já pronto nos 3
formatos): badge "roubo, furto e vidro" — Roubo e furto qualificado, Quebra
de vidros, Cobertura para o estoque, Responsabilidade civil, Planos para
PME. CTA "PERSONALIZE SEU PLANO".

## Próximos temas (conteúdo já proposto, falta aprovação final do usuário)

**Seguro Residencial** — badge "incêndio, roubo e danos elétricos"
1. Incêndio, raio e explosão — proteção patrimonial contra sinistros graves na casa
2. Roubo e furto qualificado — indenização por bens subtraídos com arrombamento
3. Danos elétricos — cobertura para eletrodomésticos e equipamentos danificados por sobrecarga
4. Responsabilidade civil familiar — danos causados a terceiros dentro ou fora de casa
5. Assistência residencial 24h — chaveiro, eletricista e encanador de emergência

**Seguro para Funcionários** — badge "vida em grupo e acidentes pessoais"
1. Vida em grupo — indenização aos beneficiários em caso de morte do colaborador
2. Acidentes pessoais coletivo (APC) — cobertura por invalidez ou morte acidental
3. Assistência funeral — suporte à família em caso de falecimento
4. Invalidez por acidente — indenização proporcional ao grau da invalidez
5. Adesão facilitada — sem exames médicos, contratação simplificada pra empresa

**Seguro de Frotas** — badge "colisão, roubo e responsabilidade civil"
1. Cobertura para toda a frota — uma única apólice pra todos os veículos da empresa
2. Colisão, roubo e furto — proteção contra os principais sinistros da operação
3. Responsabilidade civil facultativa (RCF) — cobre danos a terceiros causados pelos veículos
4. Carro reserva — mantém a operação rodando enquanto o veículo é reparado
5. Gestão simplificada — um vencimento único pra toda a frota, sem controle apólice por apólice

Todos são coberturas genéricas/típicas de mercado (sem inventar valor, prazo
ou regra de nenhuma seguradora específica) — mesma regra de segurança
factual usada no resto do conteúdo da Cota Certa.

## Depois que os 3 temas forem aprovados

1. Gerar os 3 formatos (reels/story/feed) de cada tema novo, mesmo processo
   acima.
2. Criar a agenda de publicação em `/painel/api/agenda` (`contaId:
   "cotacerta"`) pros 4 temas × 3 formatos — **ainda faltam decidir com o
   usuário**: datas/horários (não colidir com a cadência dos carrosséis
   "formato tuiter", que já ocupa 15h dia-sim-dia-não até 31/08, nem com as
   100 caixinhas, que ocupam 8h/19h30 até 26/08), e se publica em quais
   redes por formato (Reels → `instagram_reels`; Story → `instagram_story`;
   Feed → provavelmente `instagram`+`facebook`+`threads` como os
   carrosséis). Não agendar/publicar nada sem essa conversa acontecer
   primeiro.
