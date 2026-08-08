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

## Cota Certa Seguros já não vive aqui

Até 2026-07-30 existiu uma subpasta `cotacerta/` dentro deste projeto. Ela
foi **movida para `../cotacerta-seguros/`** (pasta irmã, fora de
`felizcred-site/`) quando a marca ganhou domínio e projeto Vercel próprios —
ver [`cotacerta-seguros/README.md`](../cotacerta-seguros/README.md).

`www.felizcred.com.br/cotacerta/*` hoje é só um **redirect 308 permanente**
(configurado no `vercel.json` abaixo, chave `redirects`) pra
`www.cotacertaseguros.com.br/*`. Isso só funciona porque a pasta `cotacerta/`
**não existe mais dentro de `felizcred-site/`** — enquanto ela existia aqui,
a Vercel servia o arquivo estático direto e ignorava o redirect (arquivo
real sempre vence sobre regra de redirect). Não recriar essa pasta aqui.

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

## Calculadoras (`blog/calculadora-*.html`)

11 ferramentas interativas (JS puro, sem backend): FGTS, rescisão, consignado,
margem consignável, férias, INSS, 13º salário, salário líquido, IRRF,
seguro-desemprego e aposentadoria. Todas seguem o mesmo template visual
(`calc-card`/`.tabs` conforme o caso) e o mesmo checklist de SEO/AEO:
`canonical` e `og:url` **sempre com `/blog/` no path** (erro já cometido uma
vez — ver histórico), `og:image` reaproveitando `og-image.jpg`, GA4
(`G-ZMXC2DFR5G` + `G-2WFDJBG3S2`), três blocos JSON-LD (`WebApplication`,
`BreadcrumbList`, `FAQPage` a partir das perguntas visíveis na página) e um
link `Ver todas as calculadoras →` para `/#calculadoras` na sidebar. Nova
calculadora = adicionar card em `index.html` (`#calculadoras`) e em
`blog/index.html` (`#calcGrid`/grid de calculadoras), mais uma linha em
`sitemap.xml` (prioridade 0.90, não 0.80 — são páginas de conversão) e em
`llms.txt`.

## Reforma Tributária 2027 (`blog/reforma-tributaria-2027.html` + 8 artigos)

Série sobre a Reforma Tributária do consumo (EC 132/2023, LC 214/2025), que
muda o sistema de impostos a partir de **1º de janeiro de 2027**: 1 página
hub (`reforma-tributaria-2027.html`) + 1 par PF/PJ pra cada um dos 3 impostos
novos — `cbs-pessoa-{fisica,juridica}.html`, `ibs-pessoa-{fisica,juridica}.html`,
`imposto-seletivo-pessoa-{fisica,juridica}.html` — + 1 par PF/PJ sobre o
mecanismo de **split payment** (`split-payment-pessoa-{fisica,juridica}.html`,
divisão automática do imposto no pagamento eletrônico, contra sonegação).
As 4 páginas PJ têm simulador/verificador interativo (JS puro, mesmo padrão
das calculadoras) — a de split payment simula o efeito no fluxo de caixa
(quanto fica retido automaticamente vs. quanto cai livre na conta).

**Regras de precisão que valem pra qualquer atualização futura desse
conteúdo**: datas/cronograma (2026 teste, 2027 CBS cheia + fim de PIS/Cofins/
IPI + início do Imposto Seletivo, 2029-32 transição de ICMS/ISS, 2033
extinção) e a existência dos 3 impostos são fatos estabelecidos na EC
132/2023 — cite com confiança. Já a **alíquota de referência somada
(~26,5% = ~8,8% CBS + ~17,7% IBS)** é uma estimativa divulgada pelo governo,
sujeita a ajuste por resolução do Senado — sempre rotular como estimativa,
nunca como valor definitivo. Os simuladores de CBS/IBS pra empresa usam
essas alíquotas de referência contra a alíquota atual informada pelo
usuário (ou presets ilustrativos de PIS/Cofins e ICMS/ISS) — são
comparações simplificadas sobre o valor total da operação, não substituem
cálculo contábil real (não modelam crédito de insumos específico). O
verificador do Imposto Seletivo é só qualitativo (a atividade entra ou não
na lista constitucional) porque as alíquotas por produto dependem de lei
ordinária ainda não totalmente definida.

## Imagens reais nos posts (`img/blog/*.webp`)

Posts de blog historicamente só tinham um emoji sobre um gradiente CSS como
"thumbnail" — sem foto de verdade. A partir de 2026-08-08, novos posts devem
ter uma foto real. Fluxo usado (repita pra cada post novo):

1. `WebSearch` por um termo descritivo em inglês (ex: "pixabay free photo
   industrial pollution chimney") — Pixabay é a fonte preferida porque a
   licença permite uso comercial livre **sem exigir atribuição**.
2. `WebFetch` na página do resultado pra extrair a URL direta
   `cdn.pixabay.com/photo/.../nome-ID_1280.jpg` (a maior versão disponível).
3. Baixar com `curl` pra um diretório temporário e **abrir com o Read tool
   antes de usar** — confirma visualmente que a imagem é relevante e
   apropriada (isso já pegou uma foto de formulário de IR americano que não
   fazia sentido pra conteúdo brasileiro).
4. Converter pra `.webp` com `ffmpeg -vf "scale=800:-1" -q:v 80` (arquivos
   ficam entre 15KB e 100KB, bem leves) e salvar em `img/blog/nome-descritivo.webp`.
5. Usar como `background-image` no `.card-thumb.photo` (listagem do blog,
   `blog/index.html`) e como `<img class="featured-img">` logo no início do
   `<article class="article-body">` de cada post (banner full-width, 280px
   de altura, `object-fit:cover`).

Uma mesma foto pode ser reaproveitada entre o par PF/PJ do mesmo assunto
(ex: `moeda-real.webp` nos dois posts de CBS) — o que diferencia
visualmente é o título e a cor da badge, não precisa foto exclusiva por
página. Fotos já disponíveis: `congresso-nacional.webp` (Reforma Tributária/
hub), `moeda-real.webp` (CBS), `mercado-prateleira.webp` (IBS),
`poluicao-industrial.webp` (Imposto Seletivo), `pagamento-cartao.webp`
(Split Payment) — reveja se alguma já serve antes de baixar uma nova.

## Rastreamento por IA (`robots.txt` + `llms.txt`)

`robots.txt` libera explicitamente os principais crawlers de IA (GPTBot,
ClaudeBot, PerplexityBot, Google-Extended etc.), além do `User-agent: *`
genérico que já cobria isso. `llms.txt` na raiz é o resumo estruturado do
site (produtos, calculadoras, blog, contato) no formato que agentes de IA
consomem — atualizar sempre que uma página/calculadora nova entrar no ar.
