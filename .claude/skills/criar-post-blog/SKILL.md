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
  perguntar "posso publicar?" — escrever, validar, `git commit` + `git push origin main`
  sozinho. Só parar de verdade se um fato regulatório/legal não bater em duas fontes.

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

## Passo 5. Integração final (fazer sempre, pros dois sites que forem tocados)

1. `sitemap.xml` — nova linha `<url>` por artigo novo, `lastmod` = hoje. Bump o `lastmod`
   de `.../blog/` também.
2. `llms.txt` — entrada nova no cluster temático certo (ou cria um cluster novo se for um
   assunto sem lar ainda).
3. `blog/index.html` — card novo (copiar o padrão dos cards mais recentes: FelizCred usa
   `.card-thumb.photo` com `background-image`; Cota Certa usa `.card` com emoji `.ic`).
   No FelizCred, também bumpar os 3 lugares com contador (`Todos (N)`, meta description,
   `resultsCount`) — `grep -rn "Todos ("` pra achar o número atual antes de somar.

## Passo 6. Validar antes de publicar

Rodar (adaptando a lista de arquivos):

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

## Passo 7. Publicar

`git add` **só** os arquivos desse trabalho (nunca `-A`; ignorar `.mcp.json`, `ciahot/`,
imagens soltas na raiz de `cotacerta-seguros/` que não sejam do post — não são desse
trabalho). `git commit` com mensagem descritiva em português. `git push origin main` —
**sem pedir confirmação**, é o workflow estabelecido do projeto. Depois, `curl -s -o
/dev/null -w "%{http_code}"` nas URLs novas pra confirmar 200.

Se `git push` demorar/travar, rodar em background (`run_in_background`) e conferir depois
com `git status --short --branch` — já aconteceu de precisar retry.

## Passo 8. Resumo final pro usuário

Título + URL de cada artigo criado/reforçado. O que foi descartado e por quê (falso
positivo). Qualquer desvio do pedido original (ex: "esse tema já tinha página, reforcei em
vez de duplicar").

## Se o pedido for "programa pra [dia futuro]" em vez de "faz agora"

Não é uma tarefa local — usar o skill `schedule` (rotina em nuvem via `RemoteTrigger`) pra
criar um `run_once_at` (uma vez) ou `cron_expression` (recorrente) na data pedida. O prompt
da rotina precisa ser **100% autocontido** (a sessão em nuvem não tem essa conversa) —
incluir o contexto fixo acima, a lista de temas já classificada (Passo 1 feito por você
antes de agendar, não deixe a IA da nuvem decidir sozinha o que é falso positivo sem essas
instruções), e os Passos 2 a 8 inteiros colados no prompt.

**Cuidado real, já aconteceu**: uma rotina agendada roda num checkout do repositório
próprio, isolado. Se entre o momento em que ela foi criada e o momento em que ela dispara
você (nesta sessão interativa) também publicar conteúdo no mesmo repo, o checkout dela fica
desatualizado — ela pode: (a) escolher os mesmos temas/slugs que você já cobriu (colisão de
nome de arquivo), e (b) travar no `git push` final porque o `origin/main` avançou (push
não vai como fast-forward, e isso é seguro — o Git rejeita sozinho, não sobrescreve nada).
Se isso acontecer: `git fetch origin main` pra confirmar que o remoto está intacto (quase
sempre está — o push travado falha sem aplicar nada), e decidir se vale abrir a sessão da
rotina (`claude.ai/code/session_...`, o link vem no `list_runs`) pra recuperar o conteúdo
que ela gerou, ou só descartar e recriar os temas manualmente.

## Rotinas em nuvem ativas (checar antes de recriar do zero)

Antes de agendar algo novo, rode `RemoteTrigger` com `action: "list"` pra ver se já existe
uma rotina cobrindo o mesmo período/tema — evita duplicar agendamento. Ver também a memória
`project_blog_content_seo_workflow` pra saber quais rotinas foram criadas e seu status.
