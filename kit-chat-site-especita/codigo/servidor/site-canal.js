// Canal "site" do painel: o chat do site vira mais um canal, como Instagram e e-mail.
// Arquivo novo, na raiz do projeto da Especitá, ao lado do server.js. Não tem nome de empresa, domínio, token nem ID.
//
//   const { criarCanalSite } = require("./site-canal");
//   const canalSite = criarCanalSite({ db, getFluxo, dispararInicioFluxo, bateuGatilhoDeFluxoDinamico,
//     enviarRespostaAutomatica, normalizarTexto, passoOptOut: PASSO_OPTOUT_BLOQUEADO, horasInatividadeMenu: HORAS_INATIVIDADE_MENU });
//
// Tudo que o fluxo precisa vem por parâmetro (injeção). Nada é importado do server.js, para não haver dependência circular.
const crypto = require("crypto");

const CANAL = "site";
const prefixoFone = (id) => `site-${id}`; // chave da conversa no painel (coluna phone)

function criarCanalSite(deps) {
  const {
    db, getFluxo, dispararInicioFluxo, bateuGatilhoDeFluxoDinamico, enviarRespostaAutomatica, normalizarTexto,
    passoOptOut = null,
    horasInatividadeMenu = 12,
    // Origens (https://dominio) autorizadas a falar com a API. Vem da variável SITE_CHAT_ORIGENS, separada por vírgula.
    origensPermitidas = String(process.env.SITE_CHAT_ORIGENS || "").split(",").map((s) => s.trim()).filter(Boolean),
    log = console,
  } = deps;

  const limites = new Map(); // ip -> [timestamps]
  function limiteOk(req, chave, max, janelaMs) {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const k = `${chave}:${ip}`;
    const agora = Date.now();
    const recentes = (limites.get(k) || []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= max) return false;
    recentes.push(agora);
    limites.set(k, recentes);
    if (limites.size > 5000) for (const [kk, v] of limites) if (!v.some((t) => agora - t < janelaMs)) limites.delete(kk);
    return true;
  }

  function cors(req) {
    const origem = req.headers.origin || "";
    if (!origensPermitidas.includes(origem)) return {};
    return {
      "Access-Control-Allow-Origin": origem,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Chat-Id, X-Chat-Token",
    };
  }

  function tokenValido(visitante, token) {
    if (!visitante || !token) return false;
    const recebido = crypto.createHash("sha256").update(String(token)).digest();
    const esperado = Buffer.from(String(visitante.token_hash), "hex");
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
  }

  // ── Saída: o motor de fluxo chama enviarRespostaAutomatica("site", ...). No server.js, o início dessa função ganha:
  //   if (businessNumberId === "site") return canalSite.enviarRespostaSite(phone, texto, botoes, lista, cta);
  async function enviarRespostaSite(phone, texto, botoes, lista, cta) {
    const opcoes = (lista ? lista.opcoes : botoes) || [];
    const agora = Date.now();
    // Mesmo formato dos outros canais no histórico do painel: texto + uma linha "🔘 título" por opção.
    const body = cta
      ? `${texto}\n\n🔗 ${cta.buttonText}: ${cta.url}`
      : opcoes.length ? `${texto}\n\n${opcoes.map((b) => `🔘 ${b.title}`).join("\n")}` : texto;
    await db.upsertConversation(phone, CANAL, null, agora);
    await db.insertMessage({ phone, business_number_id: CANAL, direction: "out", type: "text", body, status: "sent", origem: "automatico", created_at: agora });
    await db.siteVisitanteSalvarOpcoes(phone.slice("site-".length), opcoes.map((o) => ({ id: o.id, title: o.title })));
  }

  async function registrarEntrada(phone, texto, quando, tipo = "text") {
    await db.upsertConversation(phone, CANAL, null, quando);
    await db.insertMessage({ phone, business_number_id: CANAL, direction: "in", type: tipo, body: texto, status: "received", created_at: quando });
  }

  // ── Entrada de texto livre (espelha handleInstagramMessaging, que já usa getFluxo/dispararInicioFluxo)
  async function tratarMensagemSite(phone, texto) {
    const quando = Date.now();
    await registrarEntrada(phone, texto, quando);
    const conversa = await db.getConversation(phone, CANAL);
    const fluxo = await getFluxo(CANAL, phone, conversa?.fluxo_passo);
    const temFluxo = !!(fluxo.aoIniciar || fluxo.menuInicial);
    if (!temFluxo) return; // sem fluxo configurado para "site": atendimento 100% humano, só aparece no painel
    if (normalizarTexto(texto) === "menu") return dispararInicioFluxo(fluxo, phone, CANAL);
    if (await bateuGatilhoDeFluxoDinamico(CANAL, texto, phone)) return;
    const handler = fluxo.capturaTexto?.[conversa?.fluxo_passo];
    if (handler) return handler(phone, CANAL, texto);
    // Reabre o menu se a pessoa ficou sumida (mesmo gatilho de inatividade do WhatsApp/Instagram). O "iniciar" já marca o
    // menu como enviado, então a primeira mensagem logo depois da abertura não repete o menu.
    const anterior = await db.ultimasMensagens(phone, CANAL, 50);
    const entradas = anterior.filter((m) => m.direction === "in");
    const penultima = entradas.length > 1 ? Number(entradas[entradas.length - 2].created_at) : null;
    const inativa = penultima !== null && quando - penultima > horasInatividadeMenu * 3600_000;
    if (inativa && conversa?.fluxo_passo !== passoOptOut) {
      const podeEnviar = await db.tentarMarcarMenuEnviado(phone, CANAL, horasInatividadeMenu * 3600_000);
      if (podeEnviar) await dispararInicioFluxo(fluxo, phone, CANAL);
    }
  }

  // ── Clique num botão do fluxo (espelha processarQuickReplyInstagram)
  async function tratarOpcaoSite(phone, opcao) {
    await registrarEntrada(phone, opcao.title || "[opção escolhida]", Date.now(), "button");
    const conversa = await db.getConversation(phone, CANAL);
    const fluxo = await getFluxo(CANAL, phone, conversa?.fluxo_passo);
    const passo = fluxo.fluxoBotoes?.[opcao.id];
    if (!passo) return;
    if (typeof passo === "function") return passo(phone, CANAL);
    const texto = typeof passo.texto === "function" ? passo.texto() : passo.texto;
    await enviarRespostaAutomatica(CANAL, phone, texto, passo.botoes, passo.lista);
    await db.setFluxoPasso(phone, CANAL, fluxo.lembreteMinutos?.[opcao.id] ? opcao.id : null);
  }

  // ── Rotas públicas /site/chat/* (o navegador do visitante). Retorna true se tratou a rota.
  async function rotaPublica(req, res, path_, { parseBody, send }) {
    if (!path_.startsWith("/site/chat/")) return false;
    const h = cors(req);
    if (!h["Access-Control-Allow-Origin"]) { send(res, 403, { error: "Origem não permitida" }); return true; }
    if (req.method === "OPTIONS") { res.writeHead(204, h); res.end(); return true; }

    if (req.method === "POST" && path_ === "/site/chat/iniciar") {
      if (!limiteOk(req, "iniciar", 6, 10 * 60_000)) { send(res, 429, { error: "Muitas tentativas. Aguarde alguns minutos." }, h); return true; }
      const b = await parseBody(req);
      const nome = String(b.nome || "").trim().slice(0, 80);
      const contato = String(b.contato || "").replace(/\D/g, "").slice(0, 13);
      const email = String(b.email || "").trim().toLowerCase().slice(0, 160);
      if (nome.length < 2) { send(res, 400, { error: "Informe seu nome." }, h); return true; }
      const id = crypto.randomUUID();
      const token = crypto.randomBytes(32).toString("hex");
      await db.siteVisitanteCriar({ id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), nome, contato, email, pageUrl: String(b.pageUrl || "").slice(0, 500) });
      const phone = prefixoFone(id);
      await db.upsertConversation(phone, CANAL, nome, Date.now());
      send(res, 201, { id, token }, h);
      // O fluxo de boas-vindas (menu) começa na hora, como no WhatsApp. Se não houver fluxo para "site", nada é enviado.
      try {
        const fluxo = await getFluxo(CANAL, phone, null);
        if (fluxo.aoIniciar || fluxo.menuInicial) {
          await db.tentarMarcarMenuEnviado(phone, CANAL, horasInatividadeMenu * 3600_000);
          await dispararInicioFluxo(fluxo, phone, CANAL);
        }
      } catch (err) { log.error("Fluxo inicial do chat do site falhou:", err.message); }
      return true;
    }

    // As demais rotas exigem id + token do visitante.
    const id = String(req.headers["x-chat-id"] || "");
    const visitante = /^[a-f0-9-]{36}$/.test(id) ? await db.siteVisitanteObter(id) : null;
    if (!tokenValido(visitante, req.headers["x-chat-token"])) { send(res, 404, { error: "Conversa não encontrada" }, h); return true; }
    const phone = prefixoFone(id);

    if (req.method === "GET" && path_ === "/site/chat/mensagens") {
      const desde = Number(new URL(req.url, "http://x").searchParams.get("desde") || 0);
      const todas = await db.listMessages(phone, CANAL);
      const novas = todas.filter((m) => Number(m.id) > desde).map((m) => ({ id: m.id, direction: m.direction, body: m.body, created_at: m.created_at, type: m.type }));
      db.siteVisitanteTocar(id).catch(() => {});
      let opcoes = [];
      try { opcoes = JSON.parse(visitante.ultimas_opcoes_json || "[]"); } catch {}
      send(res, 200, { nome: visitante.nome, mensagens: novas, opcoes }, h);
      return true;
    }

    if (req.method === "POST" && path_ === "/site/chat/enviar") {
      if (!limiteOk(req, "enviar", 20, 60_000)) { send(res, 429, { error: "Muitas mensagens. Aguarde um instante." }, h); return true; }
      const b = await parseBody(req);
      if (b.opcaoId) {
        let ofertadas = [];
        try { ofertadas = JSON.parse(visitante.ultimas_opcoes_json || "[]"); } catch {}
        const opcao = ofertadas.find((o) => o.id === String(b.opcaoId)); // só aceita o que o fluxo realmente ofereceu
        if (!opcao) { send(res, 400, { error: "Opção inválida" }, h); return true; }
        await tratarOpcaoSite(phone, opcao);
      } else {
        const texto = String(b.texto || "").trim().slice(0, 2000);
        if (!texto) { send(res, 400, { error: "Escreva uma mensagem." }, h); return true; }
        await tratarMensagemSite(phone, texto);
      }
      send(res, 201, { ok: true }, h);
      return true;
    }

    send(res, 404, { error: "Rota não encontrada" }, h);
    return true;
  }

  return { CANAL, prefixoFone, rotaPublica, enviarRespostaSite, tratarMensagemSite, tratarOpcaoSite };
}

module.exports = { criarCanalSite, CANAL };
