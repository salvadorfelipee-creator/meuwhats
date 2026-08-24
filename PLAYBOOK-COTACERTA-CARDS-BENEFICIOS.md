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

## Reels animado — como funciona

Regra do usuário: **narração só lê os títulos**, nunca a descrição inteira de
cada benefício (senão o vídeo passa de 1 minuto). E **máximo ~19 segundos**
de vídeo total. Botão de WhatsApp **pulsa** (animação contínua) assim que
aparece na tela. Efeito de **partículas** (bolinhas que estouram e somem) em
CADA bloco que aparece — título, badge, cada benefício e o CTA — não só no
botão.

Internamente (gerador único faz tudo isso — ver seção seguinte):

1. **Narração por bloco** — `edge-tts`, voz `pt-BR-AntonioNeural`, `rate=
   "+8%"`. Um mp3 por bloco: `intro` (título + badge — o `badge_fala`, se
   informado, é uma versão mais curta só pra fala), `b1`..`b5` (o `fala` de
   cada benefício, se informado, senão o `titulo` mesmo — sem a `desc`),
   `cta` (texto do botão). Cada tema que passar de ~19s precisa de um
   `fala`/`badge_fala` mais curto no spec (não mexer na taxa de fala além
   de +8%, fica robótico).
2. Duração de cada mp3 medida via `ffprobe`, blocos concatenados com 0.1s de
   silêncio entre eles (`ffmpeg -f lavfi anullsrc` + `concat` filter) num
   único `narracao_completa.mp3`; a timeline de reveal (quando cada bloco
   aparece) é calculada a partir dessas durações reais, não hardcoded.
3. HTML animado: cada bloco começa com `opacity:0` (classe `.reveal`), um
   `<script>` com `timeline = [[segundos, id, cor, nº partículas], ...]`
   dispara `reveal(id)` no tempo certo — adiciona `.visible` (fade+scale) e
   `burst()` (N `div.particle` saindo do centro do elemento). O `cta` também
   ganha `.pulsing` (box-shadow verde em loop).
4. Gravação via Playwright (`record_video_dir`, 1080×1920) pela duração do
   áudio + margem; mux final com `ffmpeg -shortest` corta o vídeo pro
   tamanho exato do áudio.

## Gerador (script único, parametrizado)

`cotacerta-seguros/social/gerar_card_beneficios.py` — roda os 3 formatos de
todos os temas de uma vez. Pra adicionar um tema novo, editar a lista
`TEMAS` no fim do arquivo com esse formato:

```python
{
    "slug": "seguro-x-badge-curto",       # vira o nome dos arquivos
    "title": "Seguro X",
    "badge": "coisa a, coisa b e coisa c",       # texto na tela
    "badge_fala": "coisa a e coisa b",           # opcional, versão curta pra narração
    "bullets": [
        {"titulo": "Título do benefício", "fala": "versão curta", "desc": "descrição de 1-2 linhas."},
        # ... 5 no total. "fala" é opcional (usa o "titulo" se faltar).
    ],
    "cta_text": "PERSONALIZE SEU PLANO",
},
```

Depois: `python3 gerar_card_beneficios.py` — gera os 3 arquivos
(`insta-story-<slug>.png`, `feed-<slug>.png`, `reels-<slug>-animado.mp4`) e
avisa no terminal se a narração de algum tema passou de 19.5s (nesse caso,
editar `fala`/`badge_fala` do spec pra encurtar e rodar de novo).

Os scripts antigos `_narracao.py`/`_gravar_video.py` (usados na primeira
rodada, só pro tema Empresarial) foram **removidos** — esse gerador único
os substitui.

## O que já existe no Git (4 temas prontos nos 3 formatos)

1. **Seguro Empresarial** — badge "roubo, furto e vidro": Roubo e furto
   qualificado, Quebra de vidros, Cobertura para o estoque, Responsabilidade
   civil, Planos para PME.
2. **Seguro Residencial** — badge "incêndio, roubo e danos elétricos":
   Incêndio/raio/explosão, Roubo e furto qualificado, Danos elétricos,
   Responsabilidade civil familiar, Assistência residencial 24h.
3. **Seguro para Funcionários** — badge "vida em grupo e acidentes
   pessoais": Vida em grupo, Acidentes pessoais coletivo, Assistência
   funeral, Invalidez por acidente, Adesão facilitada.
4. **Seguro de Frotas** — badge "colisão, roubo e responsabilidade civil":
   Cobertura pra toda a frota, Colisão/roubo/furto, Responsabilidade civil
   facultativa, Carro reserva, Gestão simplificada.

Todos com CTA "PERSONALIZE SEU PLANO", arquivos em
`cotacerta-seguros/social/` (`insta-story-*.png`, `feed-*.png`,
`reels-*-animado.mp4` — o `.mp4` fica fora do Git, ver `.gitignore`, mas o
`.html`/`.py` que gera fica versionado).

Todo conteúdo é cobertura genérica/típica de mercado (sem inventar valor,
prazo ou regra de nenhuma seguradora específica) — mesma regra de segurança
factual usada no resto do conteúdo da Cota Certa.

## Agenda de publicação (feito em 24/08/2026)

Os 4 temas × 3 formatos (12 arquivos) foram agendados via
`/painel/api/agenda` (`contaId: "cotacerta"`), IDs 425–436. Script usado:
`cotacerta-seguros/social/agendar_cards_beneficios.py` (reaproveitável pra
próximos temas — só editar a lista `TEMAS`).

Cadência escolhida: 1 tema por semana, toda terça-feira, começando depois
que a agenda de agosto (carrosséis "formato tuiter" até 31/08 + 100
caixinhas até 26/08) libera espaço:

| Tema | Data | Feed (10h, insta+fb+threads) | Story (13h, insta_story) | Reels (18h30, insta_reels) |
|---|---|---|---|---|
| Empresarial | 01/09/2026 | id 425 | id 426 | id 427 |
| Residencial | 08/09/2026 | id 428 | id 429 | id 430 |
| Funcionários | 15/09/2026 | id 431 | id 432 | id 433 |
| Frotas | 22/09/2026 | id 434 | id 435 | id 436 |

Rede por formato: Reels → `instagram_reels`; Story → `instagram_story`;
Feed → `instagram`+`facebook`+`threads` (mesmo padrão dos carrosséis
"formato tuiter").
