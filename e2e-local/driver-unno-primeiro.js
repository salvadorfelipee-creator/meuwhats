// Varredura do fluxo "Unnotech na frente, Facta em paralelo" (ver rodar.sh: DRIVER=driver-unno-primeiro.js bash e2e-local/rodar.sh).
const API = "http://localhost:3000", ORIGIN = "http://localhost:8000";
const AUTH = "Basic " + Buffer.from("admin:admin").toString("base64");
let ipN = 40;
const mk = () => { const ip = "10.9.1." + (ipN++); return async (method, path, body, token) => {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Forwarded-For": ip, ...(token ? { "X-Chat-Token": token } : {}), Authorization: AUTH }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { s: r.status, j }; }; };
const ctl = (p, b) => fetch("http://127.0.0.1:4101/ctl/" + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cpfs = ["52998224725", "11144477735", "39053344705", "16899535009", "12345678909", "98765432100"];
const R = [];
const check = (cen, nome, ok, det = "") => { R.push({ cen, nome, ok }); console.log(`  ${ok ? "OK   " : "FALHA"} ${nome}${det ? " — " + det : ""}`); };
const { createClient } = require("../node_modules/@libsql/client");
const db = createClient({ url: "file:" + __dirname.replace(/\\/g, "/") + "/e2e.db" });
const paralelo = async (id) => { const r = await db.execute({ sql: "SELECT facta_paralelo_json p FROM site_chat_clt WHERE conversation_id=?", args: [id] }); try { return JSON.parse(r.rows[0]?.p || "{}").estado || null; } catch { return null; } };
const logs = () => ctl("log", {});

async function cliente(cen, i, telefone) {
  const f = mk();
  const phone = telefone || "4799911" + String(1000 + i);
  const c = await f("POST", "/site-chat/conversations", { name: "Cliente Teste " + cen, contact: phone, email: `u${i}@teste.com`, message: "Tenho interesse em: Empréstimo CLT", pageUrl: "http://localhost:8000/minha-simulacao/?novo=clt", whatsappOptIn: true });
  const id = c.j.conversation?.id, token = c.j.token;
  return { f, id, token, cpf: cpfs[i], phone,
    clt: () => f("GET", `/site-chat/conversations/${id}/clt/status`, null, token).then((r) => r.j.clt),
    start: () => f("POST", `/site-chat/conversations/${id}/clt/start`, { cpf: cpfs[i], phone, name: "Cliente Teste " + cen }, token),
    confirmar: () => f("POST", `/site-chat/conversations/${id}/clt/confirm-authorization`, {}, token),
    msgs: async () => { const r = await f("GET", `/painel/api/site-chat/conversations/${id}`); return (r.j.messages || []).map((m) => String(m.body)); },
  };
}

(async () => {
  await logs();
  console.log("\n[A] Unnotech na frente: o cadastro abre a Unnotech, sem pedir a Facta ainda");
  await ctl("unno", { phase: "awaiting_auth", semLink: false, travarSimulacao: false });
  let a = await cliente("A", 0); await ctl("facta", { cpf: a.cpf, set: { modo: "fila", autorizado: false } });
  let st = await a.start();
  check("A", "start devolve Unnotech aguardando autorização com link", st.s === 201 && st.j.clt.provider === "unnotech" && st.j.clt.etapa === "autorizacao_enviada" && !!st.j.clt.consentUrl, `${st.s} ${st.j.clt?.provider}/${st.j.clt?.etapa}`);
  let m = await a.msgs();
  check("A", "mensagem com o link e 'Pronto, já autorizei'", m.some((t) => /termo\.mock/.test(t)) && m.some((t) => /Pronto, já autorizei/.test(t)), m.join(" | ").slice(0, 300));
  let lg = (await logs()).join(" ; ");
  check("A", "Facta NÃO foi acionada para enviar autorização ainda", !/solicita-autorizacao/.test(lg), lg.slice(0, 200));

  console.log("\n[B] Cliente autoriza a Unnotech: aviso de espera + Facta pedida; Unnotech libera primeiro");
  await ctl("unno", { phase: "authorized" });
  let c = await a.clt();
  m = await a.msgs();
  check("B", "mensagem 'aguardar uns minutos enquanto o banco analisa'", m.some((t) => /aguardar uns minutos enquanto o banco analisa/.test(t)), "");
  check("B", "mensagem de que a autorização da Facta foi enviada no WhatsApp", m.some((t) => /autorização do Facta no seu WhatsApp/.test(t)), "");
  lg = (await logs()).join(" ; ");
  check("B", "Facta recebeu o pedido de autorização", /solicita-autorizacao/.test(lg), lg.slice(0, 200));
  check("B", "estado paralelo = aguardando", (await paralelo(a.id)) === "aguardando", await paralelo(a.id));
  await sleep(9000); c = await a.clt();
  check("B", "Unnotech libera ofertas (Facta ainda sem autorização)", c.provider === "unnotech" && c.etapa === "ofertas_disponiveis" && (c.offers || []).length > 0, `${c.provider}/${c.etapa}`);
  await sleep(1000); await a.clt();
  check("B", "Facta descartada depois que a Unnotech liberou", (await paralelo(a.id)) === "descartada", await paralelo(a.id));

  console.log("\n[C] Facta libera antes da Unnotech");
  await ctl("unno", { phase: "awaiting_auth", travarSimulacao: true });
  a = await cliente("C", 1); await ctl("facta", { cpf: a.cpf, set: { modo: "fila", autorizado: false } });
  await a.start(); await ctl("unno", { phase: "authorized" }); await a.clt(); await logs();
  check("C", "paralelo aguardando", (await paralelo(a.id)) === "aguardando", await paralelo(a.id));
  await ctl("facta", { cpf: a.cpf, set: { modo: "aprovado", autorizado: true } });
  const t0 = Date.now();
  c = await a.clt();
  check("C", "antes de 5s a Facta ainda não é consultada (continua Unnotech)", Date.now() - t0 < 5000 ? c.provider === "unnotech" : true, `${c.provider}/${c.etapa}`);
  await sleep(6000); c = await a.clt();
  for (let k = 0; k < 3 && c.provider !== "facta"; k++) { await sleep(9000); c = await a.clt(); }
  check("C", "Facta vence: ofertas da Facta na tela", c.provider === "facta" && c.etapa === "ofertas_disponiveis" && (c.offers || []).length > 0, `${c.provider}/${c.etapa} ofertas=${(c.offers || []).length}`);
  check("C", "estado paralelo = facta_venceu", (await paralelo(a.id)) === "facta_venceu", await paralelo(a.id));
  m = await a.msgs(); check("C", "cliente avisado da autorização da Facta", m.some((t) => /Autorização da Facta confirmada/.test(t)), "");

  console.log("\n[D] Unnotech sem margem enquanto a Facta ainda não autorizou: passa a aguardar só a Facta");
  await ctl("unno", { phase: "awaiting_auth", travarSimulacao: true });
  a = await cliente("D", 2); await ctl("facta", { cpf: a.cpf, set: { modo: "fila", autorizado: false } });
  await a.start(); await ctl("unno", { phase: "authorized" }); await a.clt();
  await ctl("unno", { phase: "no_margin" }); await sleep(9000); c = await a.clt();
  for (let k = 0; k < 3 && c.provider !== "facta"; k++) { await sleep(9000); c = await a.clt(); }
  check("D", "troca para Facta aguardando autorização", c.provider === "facta" && c.etapa === "autorizacao_enviada", `${c.provider}/${c.etapa}`);
  await ctl("facta", { cpf: a.cpf, set: { modo: "aprovado", autorizado: true } });
  await a.confirmar(); c = await a.clt();
  check("D", "depois que a Facta é autorizada: ofertas", c.provider === "facta" && c.etapa === "ofertas_disponiveis" && (c.offers || []).length > 0, `${c.provider}/${c.etapa}`);

  console.log("\n[E] Celular de outro CPF na Facta: segue só com a Unnotech, sem falar da Facta");
  await ctl("unno", { phase: "awaiting_auth", travarSimulacao: false });
  a = await cliente("E", 3); await ctl("facta", { cpf: a.cpf, set: { modo: "telefone" } });
  await a.start(); await ctl("unno", { phase: "authorized" }); c = await a.clt();
  m = await a.msgs();
  check("E", "paralelo indisponível", (await paralelo(a.id)) === "indisponivel", await paralelo(a.id));
  check("E", "nenhuma mensagem sobre a Facta", !m.some((t) => /Facta/.test(t)), "");
  await sleep(9000); c = await a.clt(); check("E", "Unnotech segue normalmente", c.provider === "unnotech" && ["simulando", "ofertas_disponiveis"].includes(c.etapa), `${c.provider}/${c.etapa}`);

  console.log("\n[F] Mesmo cliente abre outro chat: o antigo é encerrado");
  await ctl("unno", { phase: "awaiting_auth", travarSimulacao: false });
  const velho = await cliente("F1", 4, "47999120000"); await ctl("facta", { cpf: velho.cpf, set: { modo: "fila", autorizado: false } });
  await velho.start();
  const novo = await cliente("F2", 4, "47999120000"); await novo.start();
  const r = await db.execute({ sql: "SELECT status FROM site_chat_conversations WHERE id=?", args: [velho.id] });
  check("F", "chat antigo do mesmo celular/CPF ficou encerrado", r.rows[0]?.status === "closed", r.rows[0]?.status);
  const r2 = await db.execute({ sql: "SELECT status FROM site_chat_conversations WHERE id=?", args: [novo.id] });
  check("F", "chat novo continua aberto", r2.rows[0]?.status === "open", r2.rows[0]?.status);

  console.log("\n[G] Oferta pronta, mas uma financeira ainda cotando (quotes_pending > 0): mostra depois da espera, sem prender o cliente");
  await ctl("unno", { phase: "awaiting_auth", travarSimulacao: false, aposSimulacao: "offers_pending" });
  const g = await cliente("G", 5); await ctl("facta", { cpf: g.cpf, set: { modo: "fila", autorizado: false } });
  await g.start(); await ctl("unno", { phase: "authorized" }); await g.clt(); await sleep(3000); let cg = await g.clt();
  check("G", "com cotação pendente, logo no começo ainda espera", cg.etapa === "simulando", cg.etapa);
  await sleep(6000); cg = await g.clt();
  check("G", "passada a espera, mostra as ofertas que já chegaram", cg.provider === "unnotech" && cg.etapa === "ofertas_disponiveis" && (cg.offers || []).length > 0, `${cg.provider}/${cg.etapa}`);
  await ctl("unno", { aposSimulacao: null });

  console.log("\nRESUMO:", R.filter((x) => x.ok).length + "/" + R.length, "ok");
  console.log("FALHAS:\n  " + R.filter((x) => !x.ok).map((x) => `[${x.cen}] ${x.nome}`).join("\n  "));
})().catch((e) => console.error("ERRO NO DRIVER", e));
