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
- `blog/` — 7 artigos de SEO "seguro para motorista de app" (Onix, HB20,
  Kwid, Argo, Voyage, Prisma, Uno)
- `img/` — logo oficial, foto do hero, logos das seguradoras parceiras
  (Porto Seguro, Allianz, HDI, Bradesco, Mapfre — Tokio Marine e Zurich
  ainda usam iniciais coloridas por falta de arquivo oficial)

## Pendências conhecidas

- Registro SUSEP e dados legais da corretora ainda por confirmar antes de
  publicação definitiva (texto provisório no rodapé de `cotar/index.html`).
- Tokio Marine e Zurich sem logo oficial — usam fallback de iniciais.
