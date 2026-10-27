// Preload (node -r): mock da Unnotech (https) + mock da ponte Facta (HTTP :4101) + controle (:4100). Estado em memória.
const https = require("https"), http = require("http"), { EventEmitter } = require("events");
const S = { facta: {}, unno: { phase: "awaiting_auth", apps: 0 }, log: [] };
// facta[cpf] = { modo: "fila"|"aprovado"|"sem_margem"|"nao_elegivel"|"telefone", autorizado:false }
const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => b += c); req.on("end", () => { try { r(JSON.parse(b || "{}")); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const b = await body(req);
  if (req.url === "/v1/facta/request") {
    const { path, query = {}, body: corpo = {} } = b;
    const cpf = String(query.cpf || corpo.cpf || "").replace(/\D/g, "");
    const f = S.facta[cpf] || (S.facta[cpf] = { modo: "fila", autorizado: false });
    S.log.push(`facta ${path} ${cpf.slice(0, 3)}* modo=${f.modo}`);
    if (path === "/solicita-autorizacao-consulta") {
      if (f.modo === "erro_auth") return send(res, 200, { ok: true, body: { erro: true, mensagem: "Serviço da Facta indisponível" } });
      if (f.modo === "telefone") return send(res, 200, { ok: true, body: { erro: true, mensagem: "Telefone já informado para outro CPF" } });
      return send(res, 200, { ok: true, body: { erro: false, mensagem: "Autorização enviada por WhatsApp" } });
    }
    if (path === "/consignado-trabalhador/autoriza-consulta") {
      if (f.modo === "fila" || !f.autorizado && f.modo !== "vigente") return send(res, 200, { ok: true, body: { erro: true, mensagem: "CPF está na fila de autorização" } });
      const mk = (el, margem) => ({ erro: false, dados_trabalhador: { dados: [{ elegivel: el, valorMargemDisponivel: margem, dataNascimento: "1980-01-01", valorTotalVencimentos: "3000,00", matricula: "123", motivoInelegibilidade_descricao: "Vínculo inelegível" }] } });
      if (f.modo === "sem_margem") return send(res, 200, { ok: true, body: mk("SIM", "0,00") });
      if (f.modo === "nao_elegivel") return send(res, 200, { ok: true, body: mk("NAO", "0,00") });
      return send(res, 200, { ok: true, body: mk("SIM", "500,00") });
    }
    if (path === "/consignado-trabalhador/analise-politica-credito") return send(res, 200, { ok: true, body: { erro: false, aprovado: f.modo === "politica" ? "0" : "1" } });
    if (path === "/proposta/operacoes-disponiveis") return send(res, 200, { ok: true, body: { erro: false, tabelas: [
      { codigoTabela: "71064", prazo: 36, parcela: 500, valor_liquido: 9000, contrato: 12000, taxa: 2.1 },
      { codigoTabela: "71056", prazo: 24, parcela: 500, valor_liquido: 7000, contrato: 9000, taxa: 2.0 } ] } });
    return send(res, 200, { ok: true, body: { erro: false } });
  }
  // controle
  if (req.url === "/ctl/facta") { S.facta[b.cpf] = { ...(S.facta[b.cpf] || {}), ...b.set }; return send(res, 200, S.facta[b.cpf]); }
  if (req.url === "/ctl/unno") { Object.assign(S.unno, b); return send(res, 200, S.unno); }
  if (req.url === "/ctl/log") return send(res, 200, S.log.splice(0));
  send(res, 404, {});
}).listen(4101, "127.0.0.1");
// um só porto de controle também em 4101 (/ctl/*)

const real = https.request;
const offers = [
  { offer_id: "o1", status: "AVAILABLE", table_name: "BUZIOS", installment_count: 36, installment_amount: 400, net_amount: 8000, gross_amount: 11000, monthly_interest_rate: 2.2, insurance_included: false },
  { offer_id: "o2", status: "AVAILABLE", table_name: "BUZIOS", installment_count: 24, installment_amount: 400, net_amount: 6000, gross_amount: 8000, monthly_interest_rate: 2.1, insurance_included: false } ];
function unnoReply(method, path) {
  const m = path.replace("/public", "");
  S.log.push(`unno ${method} ${m} phase=${S.unno.phase}`);
  if (m === "/api/v1/auth/token") return [200, { access_token: "t", expires_in: 3600 }];
  if (m === "/api/v1/clt/applications" && method === "POST") { S.unno.apps++; S.unno.phase = S.unno.fixo || "awaiting_auth"; return [201, { application_id: "app-" + S.unno.apps, status: "AWAITING_AUTHORIZATION", authorization: S.unno.semLink ? {} : { consent_url: "https://termo.mock/app-" + S.unno.apps } }]; }
  if (/\/status$/.test(m)) {
    const p = S.unno.phase;
    if (p === "awaiting_auth") return [200, { status: "AWAITING_AUTHORIZATION", authorization_status: "PENDING" }];
    if (p === "authorized") return [200, { status: "AWAITING_SIMULATION", authorization_status: "AUTHORIZED" }];
    if (p === "offers") return [200, { status: "OFFERS_AVAILABLE", authorization_status: "AUTHORIZED", quotes_pending: 0 }];
    if (p === "no_margin") return [200, { status: "NO_MARGIN", authorization_status: "AUTHORIZED" }];
    if (p === "not_available") return [200, { status: "AWAITING_AUTHORIZATION", authorization_status: "NOT_AVAILABLE" }];
  }
  if (/\/margin$/.test(m)) return [200, { employments: [{ employment_id: "e1", employer_name: "EMPRESA TESTE", available_margin: 400 }] }];
  if (/\/simulations$/.test(m)) { S.unno.phase = "offers"; return [202, {}]; }
  if (/\/clt\/applications\/[^/]+$/.test(m)) return [200, { authorization: S.unno.semLink && S.unno.linkDepois ? { consent_url: "https://termo.mock/tardio" } : {}, offers, quotes: [] }];
  return [404, { error: { code: "mock_sem_rota", path: m } }];
}
https.request = function (opts, cb) {
  if (!opts || opts.hostname !== "gtw.unnotech.com.br") return real.apply(this, arguments);
  const req = new EventEmitter(); let chunks = "";
  req.write = (c) => { chunks += c; }; req.setTimeout = () => {}; req.destroy = () => {};
  req.end = () => { const [code, obj] = unnoReply(opts.method, opts.path); const res = new EventEmitter(); res.statusCode = code; cb && cb(res); res.emit("data", JSON.stringify(obj)); res.emit("end"); };
  return req;
};
