# cotacerta-seguros

Site da **Cota Certa Seguros**, sub-marca de seguros da FelizCred — home,
funil de cotação (`cotar/`) e blog de SEO (`blog/`). Código estático puro
(HTML/CSS/JS, sem framework, sem build step), mesmo espírito de
`felizcred-site/`.

## Histórico

Nasceu em 2026-07-29 como subpasta `felizcred-site/cotacerta/`, servida em
`www.felizcred.com.br/cotacerta/`. Em 2026-07-30 a usuária registrou o
domínio próprio `cotacertaseguros.com.br` e esta pasta foi **movida pra fora
de `felizcred-site/`**, para este local atual — precisava deixar de existir
dentro de `felizcred-site/` porque a Vercel serve arquivo estático real antes
de aplicar qualquer `redirect` do `vercel.json`; enquanto a pasta morava lá
dentro, o redirect de `/cotacerta/*` pro domínio novo nunca era alcançado.

Todo link/`src`/`href` interno usa **caminho relativo**
(`img/logo.png`, `cotar/`, `../blog/...`), nunca absoluto — assim a pasta
funciona igual não importa a partir de qual Root Directory/domínio a Vercel
a serve.

## Deploy

- **Projeto Vercel**: `otacerta-seguros`, importado do repositório
  `meuwhats` (mesmo GitHub do `felizcred-site/` e do painel de WhatsApp),
  com **Root Directory = `cotacerta-seguros`** e Framework Preset = Other.
- **Domínio**: `cotacertaseguros.com.br` (DNS no Hostinger desde
  2026-07-30: `A @ → 216.198.79.1`,
  `CNAME www → 79c197869691e9f2.vercel-dns-017.com`).
- `git push` na branch `main` → redeploy automático (independente do
  `felizcred-site/` e do painel — não compartilham build nem env vars).
- `vercel.json` com `"cleanUrls": true` — os artigos do blog têm `canonical`
  sem `.html`, essa config é o que faz isso funcionar.
- `sitemap.xml` / `robots.txt` próprios desta pasta, apontando pra
  `cotacertaseguros.com.br` (não confundir com os arquivos de mesmo nome em
  `felizcred-site/`).

Ver o mapa geral dos três sistemas no [README da raiz do
repositório](../README.md).

## Conteúdo

- `index.html` — home (hero, seguradoras parceiras, produtos)
- `cotar/` — funil de cotação em 3 etapas (tipo de seguro → detalhes →
  contato), termina em link `wa.me` pro WhatsApp dedicado da Cota Certa
- `blog/` — artigos de SEO: 7 sobre "seguro para motorista de app" (Onix,
  HB20, Kwid, Argo, Voyage, Prisma, Uno) + 7 sobre produtos Porto Seguro
  (`porto-seguro-*.html` — auto, residencial, vida, saúde, odonto, viagem,
  consórcio) + 3 sobre vida/invalidez/renda protegida
- `img/` — logo oficial, foto do hero, logos das seguradoras parceiras
  (Porto Seguro, Allianz, HDI, Bradesco, Mapfre — Tokio Marine e Zurich
  ainda usam iniciais coloridas por falta de arquivo oficial)
- `llms.txt` — resumo estruturado do site (produtos, artigos, contato) no
  formato que agentes de IA consomem primeiro; atualizar sempre que um
  artigo ou produto novo entrar no ar, mesma regra do `sitemap.xml`

## Artigos "Porto Seguro produto por produto" (`blog/porto-seguro-*.html`)

Cada um dos 7 artigos segue o mesmo template do
`seguro-invalidez-permanente.html` (TOC, `dark-box`/`teal-box`/`warning-box`,
tabela de coberturas, FAQ visível) e o mesmo checklist de SEO/AEO: 3 blocos
JSON-LD (`Article` + `BreadcrumbList` + `FAQPage`, extraída das perguntas
visíveis na página), `canonical`/`og:url` **sempre sem `.html`**, GA4
(`G-TW0TZC72WF`) e Pixel (`1060589406422111`) iguais aos demais posts, CTA
pro WhatsApp (`5547996103804`) e link `../cotar/?tipo=X` no header. Conteúdo
é deliberadamente genérico/educativo (coberturas típicas, fatores de preço)
em vez de números ou condições específicas da Porto Seguro — a corretora não
é a seguradora e não deve afirmar termos contratuais que só a Porto Seguro
pode confirmar. Todo artigo novo = card em `blog/index.html`, linha em
`sitemap.xml` (prioridade 0.90) e entrada em `llms.txt`.

## Rastreamento por IA (`robots.txt` + `llms.txt`)

`robots.txt` libera explicitamente os principais crawlers de IA (GPTBot,
ClaudeBot, PerplexityBot, Google-Extended etc.), além do `User-agent: *`
genérico que já cobria isso — mesmo padrão do `felizcred-site/`.

## Pendências conhecidas

- Registro SUSEP e dados legais da corretora ainda por confirmar antes de
  publicação definitiva (texto provisório no rodapé de `cotar/index.html`).
- Tokio Marine e Zurich sem logo oficial — usam fallback de iniciais.
