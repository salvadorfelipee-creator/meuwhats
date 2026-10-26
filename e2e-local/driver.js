const API = "http://localhost:3000", ORIGIN = "http://localhost:8000";
const AUTH = "Basic " + Buffer.from("admin:admin").toString("base64");
let ipN = 10;
const mk = () => { const ip = "10.9.0." + (ipN++); return async (method, path, body, token) => {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Forwarded-For": ip, ...(token ? { "X-Chat-Token": token } : {}), Authorization: AUTH }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { s: r.status, j }; }; };
const ctl = (p, b) => fetch("http://127.0.0.1:4101/ctl/" + p, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cpfs = ["52998224725", "11144477735", "39053344705", "16899535009", "12345678909", "98765432100", "71428793860", "45317828791"];
const R = [];
const check = (cen, nome, ok, det = "") => { R.push({ cen, nome, ok }); console.log(`  ${ok ? "OK   " : "FALHA"} ${nome}${det ? " — " + det : ""}`); };

async function cliente(cen, i) {
  const f = mk();
  const phone = "4799900" + String(1000 + i);
  const c = await f("POST", "/site-chat/conversations", { name: "Cliente Teste " + cen, contact: phone, email: `t${i}@teste.com`, message: "Tenho interesse em: Empréstimo CLT", pageUrl: "http://localhost:8000/minha-simulacao/?novo=clt", whatsappOptIn: true });
  const id = c.j.conversation?.id, token = c.j.token;
  return { f, id, token, cpf: cpfs[i], phone,
    clt: () => f("GET", `/site-chat/conversations/${id}/clt/status`, null, token).then((r) => r.j.clt),
    start: () => f("POST", `/site-chat/conversations/${id}/clt/start`, { cpf: cpfs[i], phone, name: "Cliente Teste " + cen }, token),
    say: (m) => f("POST", `/site-chat/conversations/${id}`, { message: m }, token),
    atendente: async () => { const r = await f("GET", `/painel/api/site-chat/conversations/${id}`); return r.j; } };
}
const textos = (a) => (a.messages || []).map((m) => `${m.direction === "visitor" ? "CLIENTE" : "ASSIST."}: ${String(m.body).slice(0, 140)}`);

(async () => {
  console.log("\n[1] Facta: espera autorização e depois libera ofertas");
  let a = await cliente("1", 0); await ctl("facta", { cpf: a.cpf, set: { modo: "fila", autorizado: false } });
  let st = await a.start(); check(1, "start devolve 201 e etapa autorizacao_enviada", st.s === 201 && st.j.clt.etapa === "autorizacao_enviada", `${st.s} ${st.j.clt?.etapa}`);
  let c1 = await a.clt(); check(1, "'CPF está na fila de autorização' NÃO vira erro (continua aguardando)", c1.etapa === "autorizacao_enviada" && c1.provider === "facta", `${c1.provider}/${c1.etapa} erro=${c1.error}`);
  await sleep(13000); c1 = await a.clt(); check(1, "continua aguardando após nova verificação", c1.etapa === "autorizacao_enviada", c1.etapa);
  await ctl("facta", { cpf: a.cpf, set: { modo: "aprovado", autorizado: true } });
  await a.f("POST", `/site-chat/conversations/${a.id}/clt/confirm-authorization`, {}, a.token);
  c1 = await a.clt(); check(1, "após autorizar: ofertas_disponiveis com ofertas", c1.etapa === "ofertas_disponiveis" && (c1.offers || []).length > 0, `${c1.etapa} ofertas=${(c1.offers || []).length}`);
  let at = await a.atendente(); console.log("   atendente vê:", textos(at).join(" | ").slice(0, 600));

  console.log("\n[2] Facta sem margem: segue sozinho para a Unnotech");
  await ctl("unno", { phase: "awaiting_auth", semLink: false });
  a = await cliente("2", 1); await ctl("facta", { cpf: a.cpf, set: { modo: "sem_margem", autorizado: true } });
  await a.start(); await sleep(500); let c2 = await a.clt();
  check(2, "troca para Unnotech sozinha", c2.provider === "unnotech", `${c2.provider}/${c2.etapa}`);
  check(2, "link de autorização Unnotech existe no cliente", !!c2.consentUrl, c2.consentUrl);
  at = await a.atendente(); const ms = textos(at);
  check(2, "atendente vê o LINK da Unnotech na conversa", ms.some((t) => /termo\.mock/.test(t)), "");
  check(2, "não manda 'Enviamos autorização da Facta' + 'Facta não liberou' juntas", !(ms.some((t) => /Enviamos a autoriza/.test(t)) && ms.some((t) => /Facta n.o liberou/.test(t))), "");
  console.log("   atendente vê:", ms.join(" | ").slice(0, 900));
  for (const m of ["Quero", a.cpf, a.phone]) { await a.say(m); await sleep(2500); }
  at = await a.atendente(); const apos = textos(at).slice(ms.length);
  console.log("   respostas ao cliente digitar no chat:", apos.join(" | ").slice(0, 900));
  check(2, "chat não fala 'formulário'/'Facta' nem pede CPF de novo depois da Unnotech", !apos.some((t) => /ASSIST.*(formul|Facta)/i.test(t)), "");
  await ctl("unno", { phase: "authorized" }); await a.clt(); await sleep(300); await a.clt(); await sleep(300);
  c2 = await a.clt(); check(2, "após autorizar: avança (simulando/ofertas)", ["simulando", "ofertas_disponiveis", "consultando_margem"].includes(c2.etapa), c2.etapa);
  for (let k = 0; k < 4 && c2.etapa !== "ofertas_disponiveis"; k++) { await sleep(9000); c2 = await a.clt(); }
  check(2, "chega em ofertas_disponiveis com ofertas", c2.etapa === "ofertas_disponiveis" && (c2.offers || []).length > 0, `${c2.etapa} ofertas=${(c2.offers || []).length}`);

  console.log("\n[3] Facta inelegível e Unnotech sem margem");
  await ctl("unno", { phase: "awaiting_auth" });
  a = await cliente("3", 2); await ctl("facta", { cpf: a.cpf, set: { modo: "nao_elegivel", autorizado: true } });
  await a.start(); await sleep(300); let c3 = await a.clt();
  check(3, "vai para Unnotech", c3.provider === "unnotech", `${c3.provider}/${c3.etapa}`);
  await sleep(9000); await ctl("unno", { phase: "no_margin" }); c3 = await a.clt();
  check(3, "termina em sem_margem com mensagem ao cliente", c3.etapa === "sem_margem" && !!c3.error, `${c3.etapa} | ${c3.error}`);
  at = await a.atendente(); console.log("   atendente vê:", textos(at).join(" | ").slice(0, 700));

  console.log("\n[4] Facta recusa o telefone");
  a = await cliente("4", 3); await ctl("facta", { cpf: a.cpf, set: { modo: "telefone" } });
  st = await a.start(); const c4 = st.j.clt; check(4, "etapa erro_autorizacao com mensagem clara", c4?.etapa === "erro_autorizacao" && !!c4.error, `${c4?.etapa} | ${c4?.error}`);
  at = await a.atendente(); console.log("   atendente vê:", textos(at).join(" | ").slice(0, 600));

  console.log("\n[5] Unnotech demora a gerar o link");
  await ctl("unno", { phase: "awaiting_auth", semLink: true, linkDepois: true });
  a = await cliente("5", 4); await ctl("facta", { cpf: a.cpf, set: { modo: "sem_margem", autorizado: true } });
  await a.start(); let c5 = await a.clt(); check(5, "tela mostra 'preparando' (sem link ainda) sem quebrar", c5.provider === "unnotech" && !c5.consentUrl, `${c5.etapa}`);
  await sleep(300); c5 = await a.clt(); check(5, "link aparece depois", !!c5.consentUrl, c5.consentUrl);
  at = await a.atendente(); check(5, "atendente vê o link na conversa", textos(at).some((t) => /tardio/.test(t)), ""); console.log("   atendente vê:", textos(at).join(" | ").slice(0, 600));
  await ctl("unno", { semLink: false, linkDepois: false });

  console.log("\n[6] Chat: antes do formulário");
  a = await cliente("6", 5); await sleep(300);
  await a.say("Ainda não tenho 3 meses"); await sleep(1500); at = await a.atendente(); const t6 = textos(at);
  check(6, "responde 'volte quando completar 3 meses'", t6.some((t) => /3 meses no trabalho atual, volte/.test(t)), t6.at(-1));
  a = await cliente("6b", 6); await a.say("Sim, tenho mais de 3 meses"); await sleep(1500); at = await a.atendente();
  check(6, "pede o CPF depois de confirmar 3 meses", textos(at).some((t) => /digite seu CPF/.test(t)), textos(at).at(-1));
  await a.say(a.cpf); await sleep(2500); at = await a.atendente(); console.log("   atendente vê:", textos(at).join(" | ").slice(0, 700));

  console.log("\nRESUMO:", R.filter((x) => x.ok).length + "/" + R.length, "ok");
  console.log("FALHAS:\n  " + R.filter((x) => !x.ok).map((x) => `[${x.cen}] ${x.nome}`).join("\n  "));
})().catch((e) => console.error("ERRO NO DRIVER", e));
