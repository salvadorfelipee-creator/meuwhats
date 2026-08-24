# Fila de conteúdo do blog (publicação sem IA)

Este diretório é a fila de posts do blog (`felizcred-site` e `cotacerta-seguros`) que ainda
não foram ao ar. O conteúdo é escrito **uma vez, em lote** (isso sim usa Claude). A
publicação em si, dia a dia, é feita por um script Node determinístico
(`scripts/publish-content-queue.js`) rodando via GitHub Actions
(`.github/workflows/publish-content-queue.yml`) — **zero IA, zero custo de token**, roda de
graça pra sempre.

**Regra fixa do projeto: nunca criar uma rotina em nuvem do Claude (`RemoteTrigger`/
`schedule`) pra gerar ou publicar conteúdo recorrente.** Isso já causou gasto alto e
sessões travadas sem nunca publicar (ver memória `feedback_no_ai_scheduling_for_content`).
Este sistema de fila existe justamente pra substituir isso.

## Formato

```
content-queue/
  felizcred-site/
    <slug>/
      meta.json           obrigatório
      post.html            obrigatório
      card.html             obrigatório
      sitemap-entry.xml     obrigatório
      llms-entry.txt         opcional
  cotacerta-seguros/
    <slug>/
      (mesma coisa)
  _published/              criado automaticamente pelo script — arquivo do que já foi publicado
```

### `meta.json`

```json
{ "slug": "nome-do-post", "title": "Título Legível do Post", "publishDate": "2026-08-26" }
```

- `publishDate` em UTC, formato `YYYY-MM-DD`. O script publica no primeiro run em que a
  data de hoje (UTC) for `>= publishDate`.
- `slug` deve bater com o nome do arquivo final (`<site>/blog/<slug>.html`) e com os links
  usados em `card.html`/`sitemap-entry.xml`.

### `post.html`

A página completa do post, exatamente como ficaria em `<site>/blog/<slug>.html` — mesmas
convenções de sempre (título/meta/canonical=og:url sem `.html`, os 3 blocos JSON-LD,
TOC, FAQ, tag-list, footer). Ver `felizcred-site/COMO-CRIAR-POST.md` e os posts recentes de
cada site como referência de estrutura.

### `card.html`

O snippet exato que entra na listagem do blog:

- FelizCred: `<a href="/blog/<slug>" class="article-card" data-cat="..." data-tags="...">...</a>`
  (copiar o padrão dos cards mais recentes de `felizcred-site/blog/index.html`).
- Cota Certa: `<a href="<slug>" class="card">...</a>` (padrão de
  `cotacerta-seguros/blog/index.html`) — entra numa seção fixa "Publicados recentemente"
  no topo da página, criada especificamente pra isso.

### `sitemap-entry.xml`

Uma linha `<url>...</url>` pronta, com `lastmod` = `publishDate` (não a data em que foi
escrito).

### `llms-entry.txt` (opcional)

Uma ou mais linhas markdown (formato `- [Título](url): descrição`) pra entrar na seção
"Publicados recentemente" do `llms.txt` do site. Pode deixar de fora se não tiver um cluster
óbvio — o post ainda fica indexado normalmente via sitemap/blog.

## Como o publicador mecânico funciona

`node scripts/publish-content-queue.js` (sem flag = publica de verdade; `--dry-run` só
escreve os arquivos, sem `git add`/`commit`/`push` — útil pra testar):

1. Olha a data de hoje em UTC.
2. Pra cada `<site>/<slug>/` com `publishDate <= hoje`: copia `post.html` pro lugar certo,
   insere `card.html` no `blog/index.html` (no marcador `<!-- FILA-AUTO:NOVOS-AQUI -->`),
   insere a linha no `sitemap.xml`, insere a entrada no `llms.txt` (se existir), atualiza os
   contadores de posts do FelizCred, e move a pasta pra `content-queue/_published/`.
3. Se algo foi publicado: `git add` + `git commit` + `git push origin main`.
4. Se nada estava agendado pra hoje: não faz nada, não gera commit vazio.

Roda todo dia via GitHub Actions (cron `0 12 * * *`, meio-dia UTC) — também dá pra disparar
manualmente em Actions → "Publica fila de conteúdo (blog)" → Run workflow.

## Escrevendo um lote novo

Ver a skill `criar-post-blog` (`.claude/skills/criar-post-blog/SKILL.md`) — ela já cobre o
processo completo (pesquisa, checagem de duplicidade, escrita, e salvar aqui na fila em vez
de publicar direto).
