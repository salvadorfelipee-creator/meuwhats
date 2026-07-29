# Como criar um novo post no blog (felizcred-site)

Não existe gerador automático — o `gerar-blog.php` do WordPress não roda
aqui, a Vercel só serve arquivos estáticos. Cada novo post precisa destes
passos manuais:

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
   - O `data-cat`/`data-tags` é o que faz o post aparecer na busca e nos
     filtros de categoria da página do blog (o JS lê todos os
     `.article-card` da página, não é uma lista fixa) — capriche nas tags
   - Atualize o número total de itens no texto do hero/subtítulo, se quiser

5. **Adicionar ao `sitemap.xml`**: uma linha `<url><loc>` nova, igual às
   existentes, sem `.html`.

6. **Testar localmente antes de commitar**: abrir o arquivo no navegador,
   redimensionar pra largura de celular (~375px) e conferir que nada
   estoura a tela.

7. **Commit + push** na `main` — a Vercel republica sozinha.
