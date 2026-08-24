#!/usr/bin/env node
/**
 * Publica automaticamente (sem IA) os posts da fila de conteúdo cujo publishDate já chegou.
 * Roda via GitHub Actions (cron diário) — não chama a API do Claude nem nenhuma outra IA.
 *
 * Fila esperada em content-queue/<site>/<slug>/:
 *   meta.json           { "slug": "...", "title": "...", "publishDate": "YYYY-MM-DD" }
 *   post.html           página completa, pronta pra ir em <site>/blog/<slug>.html
 *   card.html           snippet <a class="card"|"article-card">...</a> pra inserir no index.html
 *   sitemap-entry.xml   linha <url>...</url> pra inserir no sitemap.xml
 *   llms-entry.txt      (opcional) linha(s) markdown pra inserir no llms.txt
 *
 * Ver content-queue/README.md pro formato completo.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const QUEUE_ROOT = path.join(ROOT, "content-queue");
const PUBLISHED_ARCHIVE = path.join(QUEUE_ROOT, "_published");
const MARKER = "<!-- FILA-AUTO:NOVOS-AQUI -->";

const SITES = [
  { dir: "felizcred-site", hasCounter: true },
  { dir: "cotacerta-seguros", hasCounter: false },
];

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function insertAfterMarker(content, snippet) {
  if (!content.includes(MARKER)) {
    throw new Error(`marcador "${MARKER}" não encontrado`);
  }
  return content.replace(MARKER, `${MARKER}\n${snippet.trim()}\n`);
}

function publishOne(site, slug, queueDir) {
  const metaPath = path.join(queueDir, "meta.json");
  const meta = readJSON(metaPath);

  const siteDir = path.join(ROOT, site.dir);
  const postDest = path.join(siteDir, "blog", `${meta.slug}.html`);
  if (fs.existsSync(postDest)) {
    console.warn(`[pular] ${site.dir}/${meta.slug}: já existe blog/${meta.slug}.html, não sobrescrevendo`);
    return null;
  }

  // 1. página do post
  const postHtml = fs.readFileSync(path.join(queueDir, "post.html"), "utf8");
  fs.writeFileSync(postDest, postHtml, "utf8");

  // 2. card no index.html
  const indexPath = path.join(siteDir, "blog", "index.html");
  let indexHtml = fs.readFileSync(indexPath, "utf8");
  const cardHtml = fs.readFileSync(path.join(queueDir, "card.html"), "utf8");
  indexHtml = insertAfterMarker(indexHtml, cardHtml);

  // 2b. cotacerta-seguros: revela a seção "Publicados recentemente" se ainda estiver escondida
  indexHtml = indexHtml.replace(
    'class="section hidden-until-populated"',
    'class="section"'
  );

  fs.writeFileSync(indexPath, indexHtml, "utf8");

  // 3. sitemap.xml
  const sitemapPath = path.join(siteDir, "sitemap.xml");
  let sitemapXml = fs.readFileSync(sitemapPath, "utf8");
  const sitemapEntry = fs.readFileSync(path.join(queueDir, "sitemap-entry.xml"), "utf8").trim();
  if (!sitemapXml.includes("</urlset>")) {
    throw new Error(`${site.dir}/sitemap.xml sem tag </urlset>`);
  }
  sitemapXml = sitemapXml.replace("</urlset>", `  ${sitemapEntry}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemapXml, "utf8");

  // 4. llms.txt (opcional)
  const llmsEntryPath = path.join(queueDir, "llms-entry.txt");
  if (fs.existsSync(llmsEntryPath)) {
    const llmsPath = path.join(siteDir, "llms.txt");
    let llmsTxt = fs.readFileSync(llmsPath, "utf8");
    const llmsEntry = fs.readFileSync(llmsEntryPath, "utf8");
    llmsTxt = insertAfterMarker(llmsTxt, llmsEntry);
    fs.writeFileSync(llmsPath, llmsTxt, "utf8");
  }

  // 5. arquiva a pasta da fila (evita repetir publicação em runs futuros)
  const archiveDir = path.join(PUBLISHED_ARCHIVE, site.dir, slug);
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  fs.renameSync(queueDir, archiveDir);

  return { site: site.dir, slug: meta.slug, title: meta.title || meta.slug };
}

function fixCounters(site) {
  if (!site.hasCounter) return;
  const indexPath = path.join(ROOT, site.dir, "blog", "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const total = (html.match(/class="article-card"/g) || []).length;
  html = html.replace(/Todos \(\d+\)/, `Todos (${total})`);
  html = html.replace(/<strong>\d+<\/strong> itens encontrados/, `<strong>${total}</strong> itens encontrados`);
  fs.writeFileSync(indexPath, html, "utf8");
}

function git(...args) {
  execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const today = todayUTC();
  const published = [];

  for (const site of SITES) {
    const siteQueueDir = path.join(QUEUE_ROOT, site.dir);
    if (!fs.existsSync(siteQueueDir)) continue;

    const slugs = fs
      .readdirSync(siteQueueDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const slug of slugs) {
      const queueDir = path.join(siteQueueDir, slug);
      const metaPath = path.join(queueDir, "meta.json");
      if (!fs.existsSync(metaPath)) continue;

      const meta = readJSON(metaPath);
      if (!meta.publishDate || meta.publishDate > today) continue; // ainda não chegou o dia

      try {
        const result = publishOne(site, slug, queueDir);
        if (result) published.push(result);
      } catch (err) {
        console.error(`[erro] ${site.dir}/${slug}: ${err.message}`);
      }
    }

    fixCounters(site);
  }

  if (published.length === 0) {
    console.log(`Nada agendado pra hoje (${today}). Nenhuma publicação.`);
    return;
  }

  console.log(`Publicando ${published.length} post(s) de ${today}:`);
  for (const p of published) console.log(`  - [${p.site}] ${p.title}`);

  if (dryRun) {
    console.log("(--dry-run: arquivos escritos, mas sem git add/commit/push)");
    return;
  }

  git("add", "content-queue", "felizcred-site", "cotacerta-seguros");
  const msgLines = [
    `Fila de conteúdo: publica ${published.length} post(s) agendado(s) (${today})`,
    "",
    ...published.map((p) => `- [${p.site}] ${p.title}`),
  ];
  git("commit", "-m", msgLines.join("\n"));
  git("push", "origin", "main");
  console.log("Publicado e enviado (git push).");
}

main();
