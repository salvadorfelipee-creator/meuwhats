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
  propositalmente **fora desta fase**. Envolve dinheiro real — será feito
  numa etapa separada, com mais tempo de teste antes de ir ao ar.
- **Artigo faltando**: `gerente-supervisor-horas-extras-direitos.html` está
  catalogado no site original (aparece no menu "Mais lidos" do blog) mas não
  veio no export — falta pedir esse arquivo específico para completar o blog.
- **Números de WhatsApp inconsistentes** no site original — preservados como
  estão, não eram problema desta migração:
  - Home: `wa.me/554797059353`
  - Blog: `wa.me/554796864687`
  - Guia/Seguro: `(47) 3514-3392` (`554735143392`)

## Deploy

Sem variáveis de ambiente, sem backend — deploy estático direto na Vercel
(zero config: cada pasta com `index.html` vira uma rota).
