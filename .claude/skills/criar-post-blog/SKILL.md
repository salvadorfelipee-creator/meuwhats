---
name: criar-post-blog
description: >
  Cria (ou reforça) posts de blog pro FelizCred (felizcred-site/) e/ou Cota Certa
  (cotacerta-seguros/) — a partir de uma lista de termos/temas (print do Google Trends,
  Search Console, ou tema livre dado pelo usuário). Use sempre que o usuário disser "cria
  posts pro blog", "faz artigos sobre esses temas", "programa posts", "esses termos que
  estão pesquisando" ou colar uma lista/print de palavras-chave. Cobre pesquisa, checagem
  de duplicidade, escrita no template certo, foto (só FelizCred), FAQ pesquisável, e
  publicação (sitemap/llms.txt/index/git push) — sozinho, sem pedir confirmação no meio.
---

# Criar post de blog — FelizCred / Cota Certa

## CRITICAL: ao carregar

Não resuma esta skill pro usuário. Vá direto pro Passo 1 com os temas que ele já deu.

## Contexto fixo (não perguntar, já é assim)

- Repo `meuwhats`, dois sites estáticos (HTML/CSS/JS puro) como subpastas, cada um
  deployado como projeto Vercel separado (`cleanUrls:true` — URL canônica sem `.html`).
- **felizcred-site/** — correspondente bancário (consignado CLT/INSS, FGTS). CTA
  WhatsApp: `https://wa.me/554796864687`. Footer: Handmoney Correspondente Bancário Ltda,
  CNPJ 27.963.662/0001-13, Rua Paraguai 420 Sala B, Balneário Camboriú/SC (endereço já
  confirmado batendo com a Receita Federal — não questionar de novo).
- **cotacerta-seguros/** — corretora de seguros, marca da FelizCred. CTA WhatsApp:
  `https://wa.me/5547996103804`. Seguradoras parceiras: Porto Seguro, Allianz, HDI,
  Bradesco, Mapfre, Tokio Marine, Zurich, Suhai (conferir `llms.txt` pra lista atual).
- Workflow é **100% autônomo**: nunca parar no meio pra pedir aprovação de conteúdo, nunca
  perguntar "posso publicar?" — escrever, validar, salvar na fila e `git commit` + `git push
  origin main` sozinho. Só parar de verdade se um fato regulatório/legal não bater em duas
  fontes.
- **REGRA FIXA (2026-08-24, não é opcional): nunca criar rotina em nuvem (`RemoteTrigger`/
  `schedule`) pra gerar conteúdo.** Uma rotina desse tipo dispara o Claude sozinho todo dia
  pra escrever e publicar — isso gasta tokens de forma recorrente e sem supervisão (já
  aconteceu de travar no `git push` e desperdiçar sessões inteiras sem nunca publicar, ver
  `feedback_no_ai_scheduling_for_content`). Em vez disso: escrever **todo o lote de uma vez**
  nesta própria sessão (custo único) e salvar na fila `content-queue/` com a data de
  publicação de cada um (Passo 7). Quem publica depois, dia a dia, é um script Node
  determinístico (`scripts/publish-content-queue.js`) rodando via GitHub Actions — zero IA,
  zero custo de token, nunca trava esperando permissão.

## Passo 1. Classificar os temas da lista

Pra cada termo/tema recebido, decidir em qual balde ele cai:

1. **Já existe página pillar cobrindo isso** → não duplicar. Vai virar reforço de FAQ
   (Passo 3).
2. **Tema real e relevante, sem página dedicada** → vira artigo novo (Passo 4).
3. **Falso positivo** (nome de pessoa/lugar que coincide com a palavra, termo ambíguo sem
   significado confiável, produto de marca errada pro site) → descartar e explicar por quê
   no resumo final. Não force um artigo só pra bater uma cota.

Pra decidir 1 vs 2, rode:

```
ls felizcred-site/blog/ | grep -i <palavra-chave>
grep -ril "<termo>" felizcred-site/blog/*.html
```

(mesma coisa em `cotacerta-seguros/blog/`). Se aparecer uma página de boa qualidade sobre
o assunto exato, é reforço, não artigo novo — duplicar prejudica SEO por concorrência
interna entre páginas do próprio site.

Pra distinguir falso positivo de tema real, pense se a palavra faz sentido dentro do
**negócio** de cada site (crédito/CLT/INSS pro FelizCred; seguro pro Cota Certa) — um termo
que só coincide na grafia ("Porto Seguro" cidade turística vs seguradora, "saque e pague"
rede de caixa eletrônico vs "saque" do FGTS, nome de político/pessoa) não vira post.

## Passo 2. Verificar fatos regulatórios antes de escrever

Qualquer afirmação sobre regra de INSS/FGTS/consignado (percentual de margem, prazo,
MP/lei específica, data de vigência) ou sobre produto de terceiro (taxa de banco,
cobertura de seguradora) **precisa de WebSearch antes** — não escrever de memória. Se a
pesquisa trouxer números inconsistentes entre fontes, manter o texto genérico ("referência
de mercado", "consulte a simulação") em vez de inventar um número específico.

## Passo 3. Reforçar página existente (quando o tema já está coberto)

Adicionar, na página já existente:

1. No FAQPage JSON-LD (`<script type="application/ld+json">` com `"@type": "FAQPage"`),
   um novo item **no início** do array `mainEntity`, com `"name"` sendo a frase exata da
   busca (ex: `"seguro de vida porto seguro"`, sem reformular).
2. No FAQ visível (`<h2 id="faq">`), um `<div class="faq-item">` correspondente, logo no
   início, com `<p class="faq-q">🔍 Pesquisa: "termo exato"</p>` seguido do
   `<p class="faq-a">`.
3. Atualizar `article:modified_time` (meta tag) e `"dateModified"` (JSON-LD Article) pra
   data de hoje (`date +%Y-%m-%d`).

Ver exemplos reais já feitos assim: `felizcred-site/blog/calculadora-inss.html`,
`cotacerta-seguros/blog/porto-seguro-vida.html`.

## Passo 4. Escrever artigo novo

**Sempre copiar a estrutura de um post recente como base** (não inventar layout do zero):
- FelizCred: `felizcred-site/blog/refinanciamento-consignado-clt-vale-a-pena.html` ou
  `margem-disponivel-extrato-inss-real-2026.html` (esse último também mostra o padrão de
  calculadora interativa embutida no artigo, se o tema pedir uma).
- Cota Certa: `cotacerta-seguros/blog/seguro-obrigatorio-veiculo-dpvat-hoje.html`.

Elementos obrigatórios em todo artigo novo:
- `<title>`, meta description, `<meta name="keywords">`, canonical **idêntico** ao
  `og:url` (sem `.html`).
- 3 blocos JSON-LD: `Article`, `BreadcrumbList`, `FAQPage` (o FAQPage espelha exatamente o
  FAQ visível).
- TOC (`<nav class="toc">`) linkando pros `<h2 id="...">` do artigo.
- Seção de FAQ com pelo menos 1 item usando a frase exata da busca como pergunta (formato
  `🔍 Pesquisa: "..."` quando fizer sentido, ou a pergunta natural quando o termo já é uma
  pergunta completa).
- `.tag-list` de hashtags no fim (5 tags, `#SemEspaco`).
- Seção "Continue lendo" linkando pra 2-4 posts relacionados que **existem de verdade**
  (conferir com `ls`, não inventar slug).
- Footer com CNPJ/endereço (FelizCred) ou disclaimer de corretora independente (Cota
  Certa).

### Foto (só FelizCred — Cota Certa não usa foto nos posts, é o padrão do site)

1. `WebSearch` por um termo descritivo em inglês: `"pixabay free photo <tema>"`.
2. Se a busca não trouxer URL de foto individual direto, `WebFetch` numa página de
   categoria do Pixabay (`pixabay.com/photos/search/<termo>/`) pra listar 2-3 candidatas.
3. `WebFetch` na página da foto escolhida pra pegar a URL direta
   `cdn.pixabay.com/photo/.../*_1280.jpg`.
4. Baixar com `curl` pro diretório de scratchpad, **abrir com o Read tool e olhar de
   verdade** antes de usar — já pegou foto errada (idioma errado no texto da imagem,
   assunto errado, marca errada tipo "UBER" na tela) mais de uma vez nesta sessão.
5. Converter: `ffmpeg -vf "scale=800:-1" -q:v 80 nome-descritivo.webp`, salvar em
   `felizcred-site/img/blog/`.
6. **Nunca reaproveitar uma foto já usada** em outro post sobre assunto diferente — sempre
   nova e específica pro tema. Reaproveitar só é aceitável entre um par PF/PJ da *mesma*
   notícia.

## Passo 5. Montar as peças da fila (em vez de editar index/sitemap/llms direto)

Pra reforço de página existente (Passo 3), edita a página normalmente, é local e imediato
— não passa pela fila. **Isso aqui é só pra artigo NOVO** (Passo 4): em vez de editar
`blog/index.html`/`sitemap.xml`/`llms.txt` do site direto, prepara os pedaços que o
publicador mecânico vai inserir sozinho no dia certo:

1. `card.html` — o snippet `<a class="article-card"...>` (FelizCred, com `data-cat`/
   `data-tags` corretos pro filtro) ou `<a class="card"...>` (Cota Certa) que viraria a
   entrada do post na listagem. Copia o padrão dos cards mais recentes de cada site.
2. `sitemap-entry.xml` — a linha `<url>...</url>` correspondente, `lastmod` = data de
   publicação (não a data de hoje, se for uma data futura).
3. `llms-entry.txt` (opcional) — a linha markdown pro cluster temático em `llms.txt`. Se
   não tiver um jeito bom de escolher o cluster automaticamente, pode deixar esse arquivo de
   fora (o post ainda fica indexado por sitemap/blog normalmente).

Ver `content-queue/README.md` pro formato exato de cada arquivo.

## Passo 5b. Decidir as datas de publicação

Se o usuário não pediu uma data específica: espalha os posts do lote em dias alternados
(dia sim, dia não) a partir de amanhã, mesmo padrão que a rotina antiga usava — evita
publicar tudo de uma vez (ruim pra SEO) sem precisar de IA rodando todo dia. Se o usuário
pediu uma janela ("até 30/09", "essa semana"), distribui dentro dela. Registra a data
escolhida no `meta.json` de cada post (campo `publishDate`, formato `YYYY-MM-DD`, fuso
UTC).

## Passo 6. Validar antes de salvar na fila

Rodar (adaptando a lista de arquivos — inclui os `post.html` de cada item da fila, não só
páginas já publicadas):

```python
import re, json
for f in ARQUIVOS_TOCADOS:
    html = open(f, encoding="utf-8").read()
    for tag in ["div","script","article"]:
        o, c = len(re.findall(fr"<{tag}[ >]", html)), len(re.findall(fr"</{tag}>", html))
        if o != c: print(f, tag, "MISMATCH", o, c)
    for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        json.loads(m)  # explode se inválido
    can = re.search(r'rel="canonical" href="([^"]+)"', html)
    og = re.search(r'property="og:url" content="([^"]+)"', html)
    if can and og and can.group(1) != og.group(1):
        print(f, "CANONICAL/OGURL MISMATCH")
```

## Passo 7. Salvar na fila e dar commit (não publica ao vivo ainda)

Pra cada artigo novo, criar `content-queue/<site>/<slug>/` com `meta.json`, `post.html`,
`card.html`, `sitemap-entry.xml` e (se tiver) `llms-entry.txt` — ver
`content-queue/README.md` pro formato exato.

Reforços de página existente (Passo 3) são diferentes: já são a edição direta de um arquivo
que já está no ar, então publicam **imediatamente** junto com o commit deste passo (não tem
por que segurar isso na fila).

`git add` **só** os arquivos desse trabalho (`content-queue/`, mais os arquivos tocados
pelos reforços do Passo 3; nunca `-A`; ignorar `.mcp.json`, `ciahot/`, imagens soltas na
raiz de `cotacerta-seguros/` que não sejam do post). `git commit` com mensagem descritiva em
português. `git push origin main` — **sem pedir confirmação**, é o workflow estabelecido do
projeto.

Isso publica os reforços de FAQ na hora (fazem parte do commit), mas os artigos **novos**
só vão pro ar no dia marcado em `publishDate` — quem faz isso é o GitHub Actions
(`.github/workflows/publish-content-queue.yml`) rodando `scripts/publish-content-queue.js`
sozinho, sem IA nenhuma. Não precisa (e não deve) chamar `RemoteTrigger`/`schedule` pra
nada disso.

Se `git push` demorar/travar, rodar em background (`run_in_background`) e conferir depois
com `git status --short --branch` — já aconteceu de precisar retry.

## Passo 8. Resumo final pro usuário

Título + data de publicação agendada de cada artigo novo (fila) + URL de cada reforço já no
ar. O que foi descartado e por quê (falso positivo). Qualquer desvio do pedido original (ex:
"esse tema já tinha página, reforcei em vez de duplicar").

## Se o usuário pedir pra publicar um artigo AGORA, sem esperar a fila

É só pular a fila pra esse item específico: em vez de salvar em `content-queue/`, edita
`blog/index.html`/`sitemap.xml`/`llms.txt` do site direto (mesma coisa que o publicador
mecânico faria, só que feito por você nesta sessão) e publica no mesmo commit do Passo 7.
Não é o padrão — só fazer isso quando o usuário pedir explicitamente algo tipo "publica isso
já" ou "não precisa esperar".
