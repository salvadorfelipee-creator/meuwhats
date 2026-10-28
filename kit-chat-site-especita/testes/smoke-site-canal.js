// Teste de fumaça do site-canal.js com banco e motor de fluxo FALSOS (não toca em nenhum banco real).
// Rodar: node kit-chat-site-especita/testes/smoke-site-canal.js
const assert = require("assert");
const http = require("http");
const { criarCanalSite } = require("../codigo/servidor/site-canal");

const conversas = new Map(), mensagens = [], visitantes = new Map();
let seq = 0, menusMarcados = 0;
const db = {
  async upsertConversation(p, c, nome) { conversas.set(`${p}|${c}`, { ...(conversas.get(`${p}|${c}`) || {}), phone: p, nome }); },
  async insertMessage(m) { mensagens.push({ ...m, id: ++seq }); },
  async getConversation(p, c) { return conversas.get(`${p}|${c}`); },
  async setFluxoPasso(p, c, passo) { conversas.get(`${p}|${c}`).fluxo_passo = passo; },
  async ultimasMensagens(p, c) { return mensagens.filter((m) => m.phone === p && m.business_number_id === c); },
  async listMessages(p, c) { return mensagens.filter((m) => m.phone === p && m.business_number_id === c); },
  async getUltimaMensagemRecebida() { return null; },
  async tentarMarcarMenuEnviado() { menusMarcados++; return true; },
  async siteVisitanteCriar(v) { visitantes.set(v.id, { token_hash: v.tokenHash, nome: v.nome, ultimas_opcoes_json: null }); },
  async siteVisitanteObter(id) { return visitantes.get(id) || null; },
  async siteVisitanteSalvarOpcoes(id, o) { visitantes.get(id).ultimas_opcoes_json = o.length ? JSON.stringify(o) : null; },
  async siteVisitanteTocar() {},
};

let canal;
const fluxo = {
  menuInicial: () => ({ texto: "Olá! Como podemos ajudar?", botoes: [{ id: "implante", title: "Implante" }, { id: "limpeza", title: "Limpeza" }] }),
  fluxoBotoes: { implante: { texto: "Ótimo, implante! Qual o seu melhor horário?" }, limpeza: async (p, c) => { await canal.enviarRespostaSite(p, "Limpeza anotada."); } },
  lembreteMinutos: {}, capturaTexto: {},
};
canal = criarCanalSite({
  db, getFluxo: async () => fluxo,
  dispararInicioFluxo: async (f, de, c) => { const m = f.menuInicial(); await canal.enviarRespostaSite(de, m.texto, m.botoes); await db.setFluxoPasso(de, c, "menu_inicial"); },
  bateuGatilhoDeFluxoDinamico: async () => false,
  enviarRespostaAutomatica: async (c, p, t, b, l, cta) => canal.enviarRespostaSite(p, t, b, l, cta),
  normalizarTexto: (t) => String(t).toLowerCase().trim(),
  origensPermitidas: ["https://site.exemplo"],
  log: { error() {} },
});

const parseBody = (req) => new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d ? JSON.parse(d) : {})); });
const send = (res, st, body, h = {}) => { res.writeHead(st, { "Content-Type": "application/json", ...h }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  const path_ = new URL(req.url, "http://x").pathname;
  if (!(await canal.rotaPublica(req, res, path_, { parseBody, send }))) send(res, 404, {});
});

function chamar(porta, metodo, caminho, { corpo, headers = {}, origem = "https://site.exemplo" } = {}) {
  return new Promise((ok, falha) => {
    const r = http.request({ port: porta, method: metodo, path: caminho, headers: { Origin: origem, "Content-Type": "application/json", ...headers } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => ok({ status: res.statusCode, body: d ? JSON.parse(d) : null }));
    });
    r.on("error", falha); if (corpo) r.write(JSON.stringify(corpo)); r.end();
  });
}

server.listen(0, async () => {
  const porta = server.address().port;
  try {
    assert.strictEqual((await chamar(porta, "POST", "/site/chat/iniciar", { corpo: { nome: "Ana" }, origem: "https://outro.com" })).status, 403, "origem estranha deve ser barrada");
    const ini = await chamar(porta, "POST", "/site/chat/iniciar", { corpo: { nome: "Ana", contato: "(47) 99999-0000" } });
    assert.strictEqual(ini.status, 201);
    const h = { "X-Chat-Id": ini.body.id, "X-Chat-Token": ini.body.token };
    let m = await chamar(porta, "GET", "/site/chat/mensagens", { headers: h });
    assert.strictEqual(m.body.mensagens.length, 1, "menu inicial enviado");
    assert.deepStrictEqual(m.body.opcoes.map((o) => o.id), ["implante", "limpeza"]);
    assert.strictEqual(menusMarcados, 1, "menu marcado como enviado na abertura");
    assert.strictEqual((await chamar(porta, "GET", "/site/chat/mensagens", { headers: { ...h, "X-Chat-Token": "errado" } })).status, 404, "token errado");
    assert.strictEqual((await chamar(porta, "POST", "/site/chat/enviar", { headers: h, corpo: { opcaoId: "inventada" } })).status, 400, "opção que o fluxo não ofereceu");
    assert.strictEqual((await chamar(porta, "POST", "/site/chat/enviar", { headers: h, corpo: { opcaoId: "implante" } })).status, 201);
    assert.strictEqual((await chamar(porta, "POST", "/site/chat/enviar", { headers: h, corpo: { texto: "Quero sexta às 10h" } })).status, 201);
    m = await chamar(porta, "GET", "/site/chat/mensagens?desde=1", { headers: h });
    assert.ok(m.body.mensagens.every((x) => x.id > 1), "polling incremental");
    assert.ok(mensagens.every((x) => x.business_number_id === "site" && x.phone === `site-${ini.body.id}`), "tudo gravado no canal site");
    assert.ok(mensagens.some((x) => x.direction === "in" && x.body === "Quero sexta às 10h"));
    console.log("OK — site-canal.js passou em todos os cenários");
  } catch (e) { console.error("FALHOU:", e.message); process.exitCode = 1; }
  server.close();
});
