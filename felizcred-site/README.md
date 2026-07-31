# felizcred-site

Site institucional da FelizCred (www.felizcred.com.br), migrado do WordPress
(Hostinger) para código estático puro — HTML/CSS/JS, sem framework, sem build
step. Deploy pensado para Vercel (free tier), git push = publica.

Este site vive como subpasta dentro do repositório `meuwhatsapp` (por decisão
da usuária, para reaproveitar o mesmo GitHub já usado no painel de
WhatsApp/Instagram/Telegram) — mas **não compartilha código, banco de dados
nem serviço de deploy** com o painel: o Render continua fazendo deploy do
`server.js` na raiz, e esta pasta é importada como um **projeto Vercel à
parte**, com "Root Directory" = `felizcred-site`.

## Conteúdo migrado (fase 1)

- `index.html` — página inicial (hero, produtos, simuladores CLT/FGTS,
  depoimentos, FAQ)
- `blog/` — listagem (`blog/index.html`) + 31 artigos/calculadoras
- `guia/` — página-isca "Guia Prático de Crédito"
- `seguro/` — funil de cotação de seguro auto (3 etapas, decorativo — o site
  original também só mostra R$ 0,00 nessa simulação, sem integração real de
  seguradora)
- `sitemap.xml` / `robots.txt` — regenerados a partir da lógica original de
  `gerar-sitemap.php`

Conteúdo copiado diretamente dos arquivos reais exportados do WordPress (via
WP File Manager / Save As), não recriado por aproximação — por isso o texto é
fiel ao site no ar.

## Pendências conhecidas

- **`/quiz` e `/obrigado` (diagnóstico de crédito + cobrança PIX de R$89,90)**:
  propositalmente **fora desta fase**. Hoje têm páginas provisórias que só
  mandam pro WhatsApp (pra não dar erro 404). A reconstrução completa, com
  cobrança PIX de verdade, fica pra uma etapa separada — envolve dinheiro
  real, precisa de um provedor de pagamento (Mercado Pago/Asaas) e mais
  tempo de teste antes de ir ao ar.
- **Artigo faltando**: `gerente-supervisor-horas-extras-direitos.html` está
  catalogado no site original (aparece no menu "Mais lidos" do blog) mas não
  veio no export — decidido deixar sem, por enquanto.
- **Números de WhatsApp inconsistentes** no site original — preservados como
  estão, não eram problema desta migração:
  - Home: `wa.me/554797059353`
  - Blog: `wa.me/554796864687`
  - Guia/Seguro: `(47) 3514-3392` (`554735143392`)
- **Formulário do `/seguro`**: usa EmailJS, mas as credenciais ainda são
  placeholder (`SEU_SERVICE_ID` etc. em `seguro/index.html`) — o envio de
  e-mail não está de fato configurado. Funciona hoje só como funil visual
  até virar WhatsApp.

## Cota Certa Seguros (`cotacerta/`)

A partir de 2026-07-30, a subpasta `cotacerta/` (home, `cotar/`, `blog/`)
virou um site **próprio e independente**, com domínio dedicado:

- **Projeto Vercel separado**: `otacerta-seguros`, importado do **mesmo
  repositório** `meuwhats`, com **Root Directory = `felizcred-site/cotacerta`**
  e Framework Preset = Other.
- **Domínio**: `cotacertaseguros.com.br` (DNS no Hostinger desde
  2026-07-30: `A @ → 216.198.79.1`,
  `CNAME www → 79c197869691e9f2.vercel-dns-017.com`).
- **`www.felizcred.com.br/cotacerta/*` não serve mais conteúdo** — desde
  2026-07-30 é só um **redirect 308 permanente** (configurado em
  `vercel.json`, chave `redirects`) pra `www.cotacertaseguros.com.br/*`. A
  pasta `cotacerta/` continua existindo neste repositório só porque é a
  fonte do outro projeto Vercel (o de domínio próprio) — **não edite nada
  aqui esperando que apareça em `felizcred.com.br`**, esse caminho só
  redireciona.
- `cotacerta/` tem seu **próprio** `sitemap.xml`, `robots.txt` e
  `vercel.json` (com `cleanUrls: true`, igual ao da raiz), todos apontando
  pra `cotacertaseguros.com.br` — são independentes dos arquivos de mesmo
  nome na raiz de `felizcred-site/`.

**Regra que não pode quebrar**: todo link/`src`/`href` dentro de
`cotacerta/**` é **caminho relativo** (`img/logo.png`, `cotar/`,
`../blog/...`), nunca absoluto (`/cotacerta/...` ou `/img/...`) — isso é
resquício de quando a pasta ainda era servida em dois endereços ao mesmo
tempo, mas manter relativo continua sendo a forma correta.

Ver também o mapa geral dos três sistemas no [README da raiz do
repositório](../README.md).

## Deploy

Site 100% estático (sem variáveis de ambiente, sem backend). Vive dentro do
repositório `meuwhats` (GitHub) como projeto Vercel separado:

- **Projeto Vercel**: `meuwhats`, com **Root Directory = `felizcred-site`**
  e Framework Preset = **Other**
- **Domínio em produção**: `www.felizcred.com.br` (DNS apontado no Hostinger
  desde 2026-07-29: `A @ → 216.198.79.1`,
  `CNAME www → 81f88eb053cd9a55.vercel-dns-017.com`)
- `git push` na branch `main` → redeploy automático
- `vercel.json` com `"cleanUrls": true` — arquivos `.html` ficam acessíveis
  sem a extensão (`/blog/algum-post`) e a versão com `.html` redireciona
  (308) pra essa forma limpa. **Isso é o que os `canonical` de cada post
  esperam — não remover essa config.**

## Como criar um novo post no blog

Ver [`COMO-CRIAR-POST.md`](./COMO-CRIAR-POST.md) — checklist separado deste
README de propósito (pra não precisar reler o resto do projeto toda vez que
o pedido for só "cria um post novo sobre X").
