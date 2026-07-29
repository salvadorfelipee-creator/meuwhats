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

Não existe mais gerador automático (o `gerar-blog.php` do WordPress não
roda aqui — Vercel só serve arquivos estáticos). Cada novo post precisa
destes passos manuais:

1. **Criar o arquivo** em `blog/nome-do-slug.html` (sem acento, com hífen,
   minúsculo — ex: `seguro-residencial-vale-a-pena.html`). Copie a estrutura
   de um post existente (ex: `blog/emprestimo-consignado-clt.html`) como
   ponto de partida: header com logo + CTA WhatsApp, breadcrumb, hero com
   `<h1>`, TOC opcional, corpo do artigo, blocos de CTA, rodapé do artigo.

2. **Tags obrigatórias no `<head>`** (confira em qualquer post existente):
   - `<title>` único, até ~60 caracteres, terminando em `| FelizCred`
   - `<meta name="description">` até ~155 caracteres
   - `<link rel="canonical" href="https://www.felizcred.com.br/blog/SLUG">`
     — **sem `.html`** (é isso que o `cleanUrls` da Vercel serve de verdade)
   - Open Graph completo: `og:type=article`, `og:title`, `og:description`,
     `og:url` (igual ao canonical), `og:image` (pode reusar
     `https://www.felizcred.com.br/og-image.jpg` se não tiver imagem
     própria), `og:site_name`, `article:published_time`,
     `article:modified_time`, `article:section`
   - `<meta name="robots" content="index, follow">`

3. **Responsivo obrigatório**: use containers com `max-width` + `width:100%`
   (nunca `width` fixo em px para blocos grandes) e inclua pelo menos um
   `@media (max-width: 640px)` no final do `<style>` ajustando paddings do
   header/hero/CTA — copie o bloco de qualquer post existente como base.

4. **Adicionar o card na listagem** — abra `blog/index.html` e:
   - Adicione um `<a class="article-card" href="/blog/SLUG" data-cat="..."
     data-tags="...">` dentro de `#articlesGrid` (ou `#calcGrid` se for
     calculadora), seguindo o padrão dos cards existentes
   - Atualize o número total de itens no texto do hero/subtítulo, se quiser

5. **Adicionar ao `sitemap.xml`**: uma linha `<url><loc>` nova, igual às
   existentes, sem `.html`.

6. **Testar localmente antes de commitar**: abrir o arquivo no navegador,
   redimensionar pra largura de celular (~375px) e conferir que nada
   estoura a tela.

7. **Commit + push** na `main` — a Vercel republica sozinha.
