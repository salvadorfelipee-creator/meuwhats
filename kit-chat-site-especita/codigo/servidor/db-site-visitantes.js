// COLAR NO db.js DA ESPECITÁ (dentro do mesmo escopo onde existem `client` e `ready`, antes do module.exports).
// Depois exportar: siteVisitanteCriar, siteVisitanteObter, siteVisitanteSalvarOpcoes, siteVisitanteTocar.
//
// Por que uma tabela só para o site: as MENSAGENS do chat ficam nas tabelas que já existem (conversations/messages),
// com business_number_id = "site" — igual ao Instagram e ao e-mail. Assim o painel, o motor de fluxo, tags, pipeline
// e notas funcionam sem mudança. Esta tabela guarda apenas o que o WhatsApp não tem: a chave secreta do visitante.
//
// IMPORTANTE: o CREATE TABLE precisa rodar junto com os outros CREATE TABLE do arquivo (função de inicialização
// que alimenta `ready`). Se colar fora dela, chame `await client.execute(...)` dentro da mesma função.

async function criarTabelaSiteVisitantes() {
  await client.execute(`CREATE TABLE IF NOT EXISTS site_visitantes (
    id TEXT PRIMARY KEY,               -- uuid; a conversa no painel é phone = "site-" + id
    token_hash TEXT NOT NULL,          -- sha256 do segredo que só o navegador do visitante conhece
    nome TEXT,
    contato TEXT,
    email TEXT,
    page_url TEXT,
    ultimas_opcoes_json TEXT,          -- botões oferecidos na última resposta do fluxo: [{id,title}]
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER
  )`);
}

async function siteVisitanteCriar({ id, tokenHash, nome, contato, email, pageUrl }) {
  await ready;
  const agora = Date.now();
  await client.execute({
    sql: `INSERT INTO site_visitantes (id, token_hash, nome, contato, email, page_url, created_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, tokenHash, nome || null, contato || null, email || null, pageUrl || null, agora, agora],
  });
}

async function siteVisitanteObter(id) {
  await ready;
  const r = await client.execute({ sql: `SELECT * FROM site_visitantes WHERE id = ?`, args: [id] });
  return r.rows[0] || null;
}

async function siteVisitanteSalvarOpcoes(id, opcoes) {
  await ready;
  await client.execute({
    sql: `UPDATE site_visitantes SET ultimas_opcoes_json = ? WHERE id = ?`,
    args: [opcoes && opcoes.length ? JSON.stringify(opcoes) : null, id],
  });
}

async function siteVisitanteTocar(id) {
  await ready;
  await client.execute({ sql: `UPDATE site_visitantes SET last_seen_at = ? WHERE id = ?`, args: [Date.now(), id] });
}
