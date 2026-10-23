const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const busboy = require("busboy");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const db = require("./db");
const wa = require("./whatsapp");
const ig = require("./instagram");
const ads = require("./ads");
const tg = require("./telegram");
const publique = require("./publique");
const reels = require("./reels");
const agenda = require("./agenda");
const backup = require("./backup");
const banda = require("./banda");
const r2 = require("./r2");
const unnotech = require("./unnotech");
const novosaque = require("./novosaque");
const facta = require("./facta");
const flowCrypto = require("./flow-crypto");
const google = require("./google");
const mcp = require("./mcp");
const gemini = require("./gemini");
const siteChatRules = require("./site-chat-rules");
const { garantirListaBrevo, garantirModelosBrevo, enviarModeloFelizcred, salvarContatoBrevo, notificarLeadCotaCerta, enviarBoasVindasFelizcred, enviarInicioChatFelizcred, enviarAtualizacaoChatFelizcred, enviarAcessoSimulacaoFelizcred, enviarEmail } = require("./email");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "meu_token_secreto";
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "meu_token_secreto_instagram";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const PAINEL_USER = process.env.PAINEL_USER || "admin";
const PAINEL_PASS = process.env.PAINEL_PASS || "admin";

const SITE_CHAT_ORIGINS = new Set([
  "https://www.felizcred.com.br",
  "https://felizcred.com.br",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:8000", "http://127.0.0.1:8000"]),
]);
const siteChatRate = new Map();
const siteChatRecoveryRate = new Map();

function siteChatCors(req) {
  const origin = req.headers.origin || "";
  return SITE_CHAT_ORIGINS.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Chat-Token",
      }
    : {};
}

function siteChatRateLimit(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const now = Date.now();
  const recent = (siteChatRate.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  siteChatRate.set(ip, recent);
  return true;
}

function siteChatRecoveryRateLimit(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const now = Date.now();
  const recent = (siteChatRecoveryRate.get(ip) || []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= 5) return false;
  recent.push(now);
  siteChatRecoveryRate.set(ip, recent);
  return true;
}

function siteChatTokenValido(conversation, token) {
  if (!conversation || !token) return false;
  const recebido = crypto.createHash("sha256").update(token).digest();
  const esperado = Buffer.from(String(conversation.visitor_token_hash), "hex");
  return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
}

function siteChatCltPublico(row) {
  if (!row) return null;
  let offers = [];
  try { offers = JSON.parse(row.offers_json || "[]"); } catch {}
  if (row.provider === "facta") {
    let worker = {};
    let selectedOffer = null;
    try { worker = JSON.parse(row.facta_worker_json || "{}"); } catch {}
    try { selectedOffer = JSON.parse(row.facta_offer_json || "null"); } catch {}
    return {
      provider: "facta",
      etapa: row.etapa,
      status: row.status_novosaque || null,
      waitingSince: row.authorization_requested_at || row.created_at || null,
      checkedAt: row.authorization_checked_at || null,
      maxInstallment: Number(row.margem_disponivel || 0),
      offers: selecionarOfertasFacta(offers).map((o, index) => ({
        // A mesma tabela aparece em vários prazos: o id precisa incluir o prazo, senão escolher 36x selecionava o 24x.
        id: `${o.codigoTabela ?? index}:${o.prazo}`,
        tableCode: o.codigoTabela,
        tableName: o.tabela,
        installments: Number(o.prazo || 0),
        installmentValue: Number(o.parcela || 0),
        disbursedAmount: Number(o.valor_liquido || o.contrato || 0),
        contractValue: Number(o.contrato || 0),
        rate: Number(o.taxa || 0),
        insuranceValue: Number(o.valor_seguro || 0),
      })),
      selectedOffer: selectedOffer ? {
        installments: Number(selectedOffer.prazo || 0),
        installmentValue: Number(selectedOffer.parcela || 0),
        disbursedAmount: Number(selectedOffer.valor_liquido || selectedOffer.contrato || 0),
      } : null,
      customerDefaults: {
        nome: worker.nome || "",
        sexo: worker.sexo_codigo || "",
        data_nascimento: worker.dataNascimento || "",
        renda: worker.valorTotalVencimentos || "",
        nome_mae: worker.nomeMae || "",
        matricula: worker.matricula || "",
        cnpj_empregador: worker.numeroInscricaoEmpregador || "",
        data_admissao: worker.dataAdmissao || "",
        celular: row.phone || "",
      },
      contractLink: row.contract_link || null,
      proposalCode: row.codigo_proposta || null,
      error: row.error_message || null,
      trackingUrl: row.tracking_token ? `https://www.felizcred.com.br/proposta/?token=${encodeURIComponent(row.tracking_token)}` : null,
    };
  }
  return {
    provider: row.provider || "novosaque",
    etapa: row.etapa,
    status: row.status_novosaque || null,
    termsLink: row.terms_link || null,
    contractLink: row.contract_link || null,
    waitingSince: row.created_at || null,
    offers: offers.map((o) => ({
      simulationId: o.simulation_id,
      installments: o.installments,
      installmentValue: o.installment_value,
      disbursedAmount: o.disbursed_amount,
      interestRateMonthly: o.interest_rate_monthly,
      cetMonthlyRate: o.cet_monthly_rate,
      firstPaymentDate: o.first_payment_date,
    })),
    error: row.error_message || null,
    preQualificado: row.provider === "facta" && Number(row.margem_disponivel || 0) > 0,
  };
}

function acompanhamentoCltPublico(row, conversation) {
  const finais = ["proposta_concluida", "proposta_cancelada", "nao_elegivel", "sem_margem", "sem_oferta", "politica_reprovada"];
  return {
    customerName: String(conversation?.name || "Cliente").trim().split(/\s+/)[0],
    proposalCode: row.codigo_proposta || null,
    stage: row.etapa || "inicio",
    provider: row.provider === "facta" ? "Facta" : "Instituição financeira",
    status: row.status_novosaque || null,
    updatedAt: row.updated_at || null,
    isFinal: finais.includes(row.etapa),
    contractLink: row.etapa === "aguardando_assinatura_facta" ? row.contract_link || null : null,
    supportUrl: "https://www.felizcred.com.br/?chat=abrir&utm_source=acompanhamento&utm_medium=portal",
  };
}

async function garantirTrackingToken(row) {
  if (!row || row.tracking_token) return row;
  return db.siteChatCltAtualizar(row.conversation_id, { tracking_token: crypto.randomBytes(32).toString("base64url") });
}

function numeroFacta(value) {
  const raw = String(value ?? "").trim().replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function simFacta(value) {
  return /^(s|sim|true|1|elegivel|elegível)$/i.test(String(value ?? "").trim());
}

function classificarBaseOfflineFacta(response) {
  const rows = Array.isArray(response?.dados) ? response.dados : [];
  if (!rows.length) return { etapa: "analise_manual", status: "SEM_DADOS", margemDisponivel: 0 };
  const elegiveis = rows.filter((row) => simFacta(row.elegivel));
  const melhor = elegiveis.sort((a, b) => numeroFacta(b.valorMargemDisponivel) - numeroFacta(a.valorMargemDisponivel))[0];
  if (!melhor) return { etapa: "nao_elegivel", status: "INELEGIVEL", margemDisponivel: 0 };
  const margemDisponivel = numeroFacta(melhor.valorMargemDisponivel);
  return {
    etapa: margemDisponivel > 0 ? "pre_qualificado" : "sem_margem",
    status: margemDisponivel > 0 ? "MARGEM_IDENTIFICADA" : "SEM_MARGEM",
    margemDisponivel,
    offlineUpdatedAt: melhor.updated_at || melhor.created_at || null,
    possuiAlertas: melhor.possuiAlertas || null,
    matricula: melhor.matricula || null,
  };
}

function mensagemFacta(payload, fallback = "A Facta não conseguiu concluir esta etapa.") {
  return String(payload?.mensagem || payload?.message || fallback).trim();
}

function motivoPublicoErroFacta(err) {
  const status = Number(err?.httpStatus) || 0;
  const message = String(err?.message || "");
  const upstreamMessage = String(err?.factaResponse?.mensagem || err?.factaResponse?.message || "").trim().slice(0, 280);
  if (/FACTA_BRIDGE_URL|FACTA_BRIDGE_SECRET|FACTA_LOGIN_CERTIFICADO|FACTA_PROPOSAL_ENABLED|não configurados/i.test(message)) return "A integração do correspondente está em configuração. Nossa equipe já pode conferir pelo chat.";
  if (/timeout|timed out|aborted|tempo limite/i.test(message) || [408, 504].includes(status)) return "A Facta demorou mais que o esperado para responder. Tente novamente em alguns instantes.";
  if (status === 429) return "A Facta limitou temporariamente novas consultas por excesso de solicitações. Aguarde um instante e tente novamente.";
  if (status >= 500) return `A Facta informou indisponibilidade temporária${status ? ` (código ${status})` : ""}. Tente novamente em alguns instantes.`;
  if ([401, 403].includes(status)) return "A Facta não autorizou a conexão neste momento. Nossa equipe já pode conferir pelo chat.";
  if (status >= 400 && upstreamMessage) return `A Facta respondeu: ${upstreamMessage}`;
  if (status >= 400) return `A Facta não aceitou esta etapa da consulta (código ${status}). Confira os dados ou tente novamente.`;
  return "A Facta não concluiu esta etapa da consulta. Tente novamente; se persistir, continue falando conosco aqui.";
}

function respostaFactaComErro(payload) {
  return payload?.erro === true || payload?.erro === "true" || payload?.success === false;
}

function dadosTrabalhadorFacta(payload) {
  const rows = payload?.dados_trabalhador?.dados || payload?.dados?.dados || payload?.dados || [];
  return Array.isArray(rows) ? rows : [];
}

// Comissão da Facta por tabela do banco e prazo (% sobre o valor líquido), da tela de convênios de 23/10/2026.
// Chave "tabela:prazo". O que não está aqui tem comissão menor que a menor da lista (2,70%) e fica por último.
const COMISSAO_FACTA = {
  "71080:60": 6.75, "71072:48": 5.85, "71064:36": 5.4, "71218:60": 5.4, "71218:48": 4.95, "71129:60": 4.95,
  "71110:48": 4.5, "71056:24": 4.5, "71218:36": 4.5, "71218:24": 4.05, "71102:36": 4.05, "71153:48": 4.05,
  "71196:48": 4.05, "71145:36": 3.85, "71188:36": 3.6, "71226:60": 3.6, "71226:48": 3.15, "71099:24": 3.15,
  "71137:24": 3.15, "71234:48": 2.95, "71234:36": 2.95, "71226:36": 2.95, "71226:24": 2.7,
};

function comissaoOfertaFacta(o) {
  const tabelaBanco = String(o?.tabela || "").match(/[0-9]+/)?.[0];
  return COMISSAO_FACTA[`${tabelaBanco}:${Number(o?.prazo)}`] ?? 0;
}

// Regra de apresentação: sempre a tabela de maior comissão em cada prazo. Duas opções: o MAIOR prazo e o de 24 meses
// (se não houver 24, o menor prazo disponível). Só um prazo disponível = só uma opção.
function selecionarOfertasFacta(offers) {
  const valor = (o) => Number(o.valor_liquido || o.contrato || 0);
  const melhorDoPrazo = (prazo) => offers
    .filter((o) => Number(o.prazo) === prazo)
    .sort((a, b) => comissaoOfertaFacta(b) - comissaoOfertaFacta(a) || valor(b) - valor(a))[0];
  const prazos = [...new Set(offers.map((o) => Number(o.prazo)))].sort((a, b) => a - b);
  if (!prazos.length) return [];
  const maior = prazos[prazos.length - 1];
  const segundo = prazos.includes(24) ? 24 : prazos[0];
  return [...new Set([maior, segundo])].map(melhorDoPrazo).filter(Boolean);
}

function ofertasFacta(payload) {
  const rows = payload?.tabelas || payload?.dados || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((o) => o && o.codigoTabela && Number(o.prazo) > 0 && Number(o.parcela) > 0 && Number(o.valor_liquido || o.contrato) > 0)
    .sort((a, b) => Number(a.prazo) - Number(b.prazo) || Number(b.valor_liquido || b.contrato) - Number(a.valor_liquido || a.contrato));
}

function formatarCelularFacta(phone) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function normalizarDataFacta(value) {
  const raw = String(value || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw;
}

function somenteCamposFacta(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, String(source?.[field] ?? "").trim()]));
}

async function notificarContratoCltNoWhatsApp(row) {
  if (!row?.contract_link || !row.phone || row.whatsapp_notified_at) return;
  if (row.whatsapp_notify_attempt_at && Date.now() - Number(row.whatsapp_notify_attempt_at) < 60 * 60 * 1000) return;
  await db.siteChatCltAtualizar(row.conversation_id, { whatsapp_notify_attempt_at: Date.now() });
  const phone = normalizarTelefoneBR(row.phone);
  const businessId = process.env.NOVOSAQUE_SITE_WHATSAPP_BUSINESS_ID || "1335976862924566";
  const template = process.env.NOVOSAQUE_SITE_WHATSAPP_TEMPLATE || "contrato_clt_em_andamento";
  try {
    const result = await wa.sendTemplate(businessId, phone, template, "pt_BR");
    const now = Date.now();
    await db.upsertConversation(phone, businessId, null, now);
    await db.insertMessage({ phone, business_number_id: businessId, direction: "out", type: "template", body: "Sua contratação CLT está em andamento. Continue pelo chat seguro no site.", status: "sent", wa_message_id: result.messages?.[0]?.id || null, created_at: now });
    await db.siteChatCltAtualizar(row.conversation_id, { whatsapp_notified_at: now });
  } catch (err) {
    console.error(`Template CLT do site ainda não enviado (${row.conversation_id}):`, err.message);
  }
}

async function notificarEtapaFactaNoWhatsApp(row, etapa) {
  if (!row?.phone) return;
  const templates = {
    proposta_em_analise: process.env.FACTA_SITE_WHATSAPP_ANALISE_TEMPLATE,
    proposta_concluida: process.env.FACTA_SITE_WHATSAPP_CONCLUIDA_TEMPLATE,
    proposta_cancelada: process.env.FACTA_SITE_WHATSAPP_ENCERRADA_TEMPLATE,
  };
  const template = String(templates[etapa] || "").trim();
  if (!template) return;
  const textos = {
    proposta_em_analise: "Sua assinatura foi recebida e a proposta Facta está em análise.",
    proposta_concluida: "A Facta confirmou o pagamento da sua proposta. Confira a conta informada na contratação.",
    proposta_cancelada: "Seu contrato não foi finalizado. Aguarde nosso atendimento para mais detalhes.",
  };
  const phone = normalizarTelefoneBR(row.phone);
  const businessId = process.env.NOVOSAQUE_SITE_WHATSAPP_BUSINESS_ID || "1335976862924566";
  try {
    const conversation = row.conversation_id ? await db.siteChatObter(row.conversation_id) : null;
    const firstName = String(conversation?.name || "cliente").trim().split(/\s+/)[0];
    const bodyParameters = etapa === "proposta_cancelada"
      ? [firstName, row.codigo_proposta || "em acompanhamento"]
      : [firstName, row.codigo_proposta || "em acompanhamento", "Facta"];
    const components = [{
      type: "body",
      parameters: bodyParameters.map((text) => ({ type: "text", text: String(text) })),
    }];
    const result = await wa.sendTemplate(businessId, phone, template, "pt_BR", components);
    const now = Date.now();
    await db.upsertConversation(phone, businessId, null, now);
    await db.insertMessage({ phone, business_number_id: businessId, direction: "out", type: "template", body: textos[etapa], status: "sent", wa_message_id: result.messages?.[0]?.id || null, created_at: now });
  } catch (err) {
    console.error(`Notificação WhatsApp da etapa ${etapa} não enviada (${row.conversation_id}):`, err.message);
  }
}

async function notificarEtapaFactaPorEmail(row, etapa) {
  const conversation = row?.conversation_id ? await db.siteChatObter(row.conversation_id) : null;
  if (!conversation?.email) return;
  const conteudo = {
    aguardando_assinatura_facta: ["Sua proposta está pronta para assinatura", "Abra o chat da FelizCred para revisar as condições e acessar a assinatura segura da Facta."],
    proposta_em_analise: ["Sua proposta Facta está em análise", "A assinatura foi recebida. Você pode acompanhar cada atualização pelo chat da FelizCred."],
    proposta_concluida: ["Sua proposta Facta foi concluída", "Confira o crédito na conta informada. Se precisar, converse conosco pelo chat do site."],
    proposta_cancelada: ["Seu contrato não foi finalizado", "Nossa equipe recebeu a atualização e verificará os detalhes. Aguarde nosso atendimento pelo chat da FelizCred."],
  }[etapa];
  if (!conteudo) return;
  await enviarAtualizacaoChatFelizcred({ nome: conversation.name, email: conversation.email, titulo: conteudo[0], mensagem: conteudo[1] });
}

// E-mail de cliente de verdade: fora endereços de teste (example.com, domínio da própria FelizCred, "teste"/"auditoria").
function emailDeClienteReal(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  return !/@example\.|@felizcred\.com\.br$|^teste|auditoria|^salvador\.felipe/.test(e); // inclui os e-mails do próprio dono
}

// Varredura: cliente do chat do site que parou no meio (2h a 48h sem escrever) recebe UM e-mail de retomada, conforme
// a situação: autorização pendente, problema na consulta ou simulação salva. Marca antes de enviar, para nunca repetir.
async function enviarRetomadasDoSite() {
  if (process.env.EMAIL_RETOMADA_ATIVA !== "true") return; // só liga depois que os modelos forem aprovados
  const agora = Date.now();
  const candidatas = await db.siteChatParaRetomada(agora - 48 * 3600_000, agora - 2 * 3600_000);
  for (const c of candidatas) {
    if (!emailDeClienteReal(c.email)) continue;
    const etapa = String(c.etapa || "");
    const modelo = /^(autorizacao_enviada|aguardando_autorizacao)$/.test(etapa) ? "felizcred-autorizacao-pendente"
      : /^erro/.test(etapa) ? "felizcred-problema-na-consulta"
      : "felizcred-retomar-simulacao";
    try {
      await db.siteChatEmailMarcar(c.id, "email_retomada_at", Date.now());
      await enviarModeloFelizcred({ modelo, email: c.email, nome: c.name });
      console.log(`E-mail de retomada (${modelo}) enviado para a conversa ${c.id}`);
    } catch (err) {
      console.error(`E-mail de retomada não enviado (${c.id}):`, err.message);
    }
  }
}
setInterval(() => { enviarRetomadasDoSite().catch((err) => console.error("Erro na varredura de retomada por e-mail:", err.message)); }, 15 * 60_000);

// Quem parou no meio da simulação do site (e aceitou receber WhatsApp) recebe UMA mensagem: "mudou de ideia ou ficou
// com dúvida?", com 3 botões. Só das 9h às 20h (Brasília), de segunda a sábado, no máximo 3 por rodada e nada para quem
// já conversa conosco pelo WhatsApp. Depende do template aprovado na Meta; enquanto não existir, nada é enviado.
// v2: o primeiro modelo (felizcred_site_retomada) foi cadastrado na Meta com acentos corrompidos; o nome v2 contém o antigo,
// então o reconhecimento de quem já recebeu (recebeuTemplate usa LIKE) continua funcionando para os dois.
const RETOMADA_SITE_TEMPLATE = process.env.RETOMADA_SITE_WHATSAPP_TEMPLATE || "felizcred_site_retomada_v2";
async function enviarRetomadasSiteWhatsapp() {
  if (process.env.RETOMADA_SITE_WHATSAPP_ATIVA === "false") return;
  const agoraBr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(new Date());
  const hora = Number(agoraBr.find((p) => p.type === "hour").value) % 24;
  const diaSemana = agoraBr.find((p) => p.type === "weekday").value;
  if (hora < 9 || hora >= 20 || diaSemana === "Sun") return;
  const agora = Date.now();
  const businessId = process.env.NOVOSAQUE_SITE_WHATSAPP_BUSINESS_ID || CAMPANHA_CLT_NUMBER_ID;
  const candidatas = await db.siteChatParaRetomadaWhatsapp(agora - 8 * 24 * 3600_000, agora - 2 * 3600_000);
  let enviados = 0;
  for (const c of candidatas) {
    if (enviados >= 3) break;
    const phone = normalizarTelefoneBR(c.clt_phone || c.contact);
    if (!phone) { await db.siteChatMarcarRetomadaWhatsapp(c.id); continue; }
    let jaConversa = false;
    for (const numero of NUMEROS_CONSIGNADO) {
      const conversa = await db.getConversation(phone, numero);
      if (conversa?.last_inbound_at && agora - Number(conversa.last_inbound_at) < 8 * 24 * 3600_000) jaConversa = true;
    }
    if (jaConversa) { await db.siteChatMarcarRetomadaWhatsapp(c.id); continue; }
    if (!(await db.siteChatMarcarRetomadaWhatsapp(c.id))) continue;
    const primeiroNome = String(c.name || "").trim().split(/\s+/)[0] || "tudo bem";
    const resultado = await enviarUmBroadcast(businessId, { phone, name: primeiroNome, template: RETOMADA_SITE_TEMPLATE, language: "pt_BR", params: [primeiroNome] });
    if (resultado.ok) { enviados++; continue; }
    if (/132001|does not exist|n[aã]o existe|not approved/i.test(String(resultado.error))) {
      await db.siteChatDesmarcarRetomadaWhatsapp(c.id); // template ainda não aprovado: tenta de novo mais tarde
      console.error("Retomada do site pelo WhatsApp: template ainda não disponível na Meta.");
      return;
    }
    console.error(`Retomada do site pelo WhatsApp não enviada (${c.id}): ${resultado.error}`);
  }
}
setInterval(() => { enviarRetomadasSiteWhatsapp().catch((err) => console.error("Erro na retomada do site pelo WhatsApp:", err.message)); }, 10 * 60_000);

// A autorização do cliente na Facta vale por um tempo. Antes de pedir uma nova, confere se a consulta já
// responde com dados do trabalhador: se sim, o cliente pula a etapa de autorizar de novo.
async function autorizacaoFactaVigente(cpf) {
  try {
    const resposta = await facta.consultarTrabalhador(cpf);
    return !respostaFactaComErro(resposta) && dadosTrabalhadorFacta(resposta).length > 0;
  } catch {
    return false;
  }
}

async function sincronizarSiteChatFacta(row) {
  if (!row) return row;
  if (["aguardando_assinatura_facta", "proposta_em_analise"].includes(row.etapa) && row.codigo_proposta) {
    if (row.authorization_checked_at && Date.now() - Number(row.authorization_checked_at) < 30_000) return row;
    await db.siteChatCltAtualizar(row.conversation_id, { authorization_checked_at: Date.now() });
    const progress = await facta.consultarAndamentoProposta(row.codigo_proposta);
    if (respostaFactaComErro(progress)) return db.siteChatCltAtualizar(row.conversation_id, { error_message: mensagemFacta(progress) });
    const proposal = Array.isArray(progress?.propostas) ? progress.propostas[0] : null;
    if (!proposal) return row;
    const status = String(proposal.status_proposta || proposal.status_crivo || "PROPOSTA EM ACOMPANHAMENTO").trim();
    const changes = { status_novosaque: status, error_message: null };
    if (/cancelad|reprovad|recusad/i.test(status)) {
      changes.etapa = "proposta_cancelada";
      const occurrences = await facta.consultarOcorrenciasProposta(row.codigo_proposta).catch(() => null);
      const lastOccurrence = Array.isArray(occurrences?.ocorrencias) ? occurrences.ocorrencias.at(-1) : null;
      changes.error_message = lastOccurrence?.obs || "A Facta encerrou a proposta. Um atendente pode conferir o motivo com você.";
    } else if (/\b16\b.*pag|pago|efetivad|liquidad/i.test(status) || proposal.data_pgto_cliente) {
      changes.etapa = "proposta_concluida";
      await db.siteChatDefinirPipeline(row.conversation_id, "aprovado");
    } else if (!/aguardando assinatura|assinatura digital$/i.test(status)) {
      changes.etapa = "proposta_em_analise";
    }
    const updated = await db.siteChatCltAtualizar(row.conversation_id, changes);
    if (updated.etapa !== row.etapa) {
      if (updated.etapa === "proposta_em_analise") {
        await db.siteChatFunilEvento(row.conversation_id, "assinatura_concluida", "proposta_em_analise", "facta");
        await db.siteChatDefinirPipeline(row.conversation_id, "analise");
        await db.siteChatMensagemAtendente(row.conversation_id, "Assistente FelizCred", "Sua assinatura foi recebida. A proposta agora está em análise na Facta; você pode acompanhar o andamento por aqui sem preencher os dados novamente.");
      } else if (updated.etapa === "proposta_concluida") {
        await db.siteChatFunilEvento(row.conversation_id, "proposta_concluida", "proposta_concluida", "facta");
        await db.siteChatMensagemAtendente(row.conversation_id, "Assistente FelizCred", `A Facta confirmou o pagamento da proposta ${updated.codigo_proposta || ""}. Confira a conta informada na contratação e fale com a gente se precisar de ajuda.`);
      } else if (updated.etapa === "proposta_cancelada") {
        await db.siteChatFunilEvento(row.conversation_id, "saida", "proposta_cancelada", "facta", "proposta_cancelada");
        await db.siteChatDefinirPipeline(row.conversation_id, "perdido");
        await db.siteChatConfirmarHumano(row.conversation_id);
        await db.siteChatMensagemAtendente(row.conversation_id, "Assistente FelizCred", "Seu contrato não foi finalizado. Nossa equipe já recebeu a atualização; aguarde o atendimento para mais detalhes.");
      }
      notificarEtapaFactaNoWhatsApp(updated, updated.etapa).catch(() => {});
      notificarEtapaFactaPorEmail(updated, updated.etapa).catch((err) => console.error(`E-mail da etapa ${updated.etapa} não enviado (${row.conversation_id}):`, err.message));
    }
    return updated;
  }
  if (!["autorizacao_enviada", "aguardando_autorizacao"].includes(row.etapa)) return row;
  if (row.authorization_checked_at && Date.now() - Number(row.authorization_checked_at) < 12_000) return row;
  await db.siteChatCltAtualizar(row.conversation_id, { authorization_checked_at: Date.now() });
  const response = await facta.consultarTrabalhador(row.cpf);
  if (respostaFactaComErro(response)) {
    const message = mensagemFacta(response);
    if (/token expirado|necess[aá]rio.*autoriza|n[aã]o autoriz/i.test(message)) {
      return db.siteChatCltAtualizar(row.conversation_id, { status_novosaque: "AGUARDANDO_AUTORIZACAO", error_message: null });
    }
    // Lentidão da Facta não é fim da simulação: tenta de novo na próxima verificação (até 10 min desde o pedido).
    if (/demorou|tempo esgotado|timeout|indispon/i.test(message) && Date.now() - Number(row.authorization_requested_at || 0) < 10 * 60_000) {
      return db.siteChatCltAtualizar(row.conversation_id, { status_novosaque: "AGUARDANDO_AUTORIZACAO", error_message: null });
    }
    return db.siteChatCltAtualizar(row.conversation_id, { etapa: "erro_consulta", status_novosaque: "ERRO_CONSULTA", error_message: message });
  }

  const rows = dadosTrabalhadorFacta(response);
  const elegiveis = rows.filter((item) => simFacta(item.elegivel));
  const worker = elegiveis.sort((a, b) => numeroFacta(b.valorMargemDisponivel) - numeroFacta(a.valorMargemDisponivel))[0];
  if (!worker) {
    const reason = rows.map((item) => item.erro_mensagem || item.motivoInelegibilidade_descricao).find(Boolean);
    return db.siteChatCltAtualizar(row.conversation_id, { etapa: "nao_elegivel", status_novosaque: "INELEGIVEL", error_message: reason || null });
  }
  const margem = numeroFacta(worker.valorMargemDisponivel);
  if (margem <= 0) return db.siteChatCltAtualizar(row.conversation_id, { etapa: "sem_margem", status_novosaque: "SEM_MARGEM", margem_disponivel: 0, facta_worker_json: JSON.stringify(worker), error_message: null });

  const operations = await facta.consultarOperacoes({
    opcao_valor: 2,
    valor_parcela: margem.toFixed(2),
    cpf: row.cpf,
    data_nascimento: normalizarDataFacta(worker.dataNascimento),
    valor_renda: numeroFacta(worker.valorTotalVencimentos).toFixed(2),
  });
  if (respostaFactaComErro(operations)) {
    return db.siteChatCltAtualizar(row.conversation_id, { etapa: "sem_oferta", status_novosaque: "SEM_OPERACOES", margem_disponivel: margem, facta_worker_json: JSON.stringify(worker), error_message: mensagemFacta(operations) });
  }
  const offers = ofertasFacta(operations);
  if (!offers.length) {
    await db.siteChatFunilEvento(row.conversation_id, "saida", "sem_oferta", "facta", "sem_oferta");
    return db.siteChatCltAtualizar(row.conversation_id, { etapa: "sem_oferta", status_novosaque: "SEM_OPERACOES", margem_disponivel: margem, facta_worker_json: JSON.stringify(worker), error_message: null });
  }
  // Duas sincronizações simultâneas chegavam aqui juntas e a mensagem saía duplicada: relê a etapa antes de registrar.
  const jaRegistrada = await db.siteChatCltObter(row.conversation_id);
  if (jaRegistrada?.etapa === "ofertas_disponiveis") return jaRegistrada;
  await db.siteChatFunilEvento(row.conversation_id, "oferta_disponivel", "ofertas_disponiveis", "facta");
  await db.siteChatDefinirPipeline(row.conversation_id, "proposta");
  await db.siteChatMensagemAtendente(row.conversation_id, "Assistente FelizCred", "Autorização confirmada. Encontramos condições para você escolher. Os valores ainda passam pela política final da Facta.");
  return db.siteChatCltAtualizar(row.conversation_id, {
    etapa: "ofertas_disponiveis",
    status_novosaque: "OFERTAS_DISPONIVEIS",
    margem_disponivel: margem,
    facta_worker_json: JSON.stringify(worker),
    offers_json: JSON.stringify(offers),
    error_message: null,
  });
}

async function sincronizarSiteChatClt(row) {
  if (row?.provider === "facta") {
    try {
      return await sincronizarSiteChatFacta(row);
    } catch (err) {
      console.error(`Erro ao sincronizar Facta no site (${row.conversation_id}):`, err.message);
      const retornoFacta = `${err.message} ${JSON.stringify(err.factaResponse || "")}`;
      if (/token expirado|necess[aá]rio.*autoriza|n[aã]o autoriz|sem autoriza/i.test(retornoFacta)) {
        return db.siteChatCltAtualizar(row.conversation_id, {
          status_novosaque: "AGUARDANDO_AUTORIZACAO",
          error_message: "Ainda não vimos sua autorização. Abra a mensagem da Facta no WhatsApp, toque no link para autorizar e depois toque aqui de novo.",
        }).catch(() => row);
      }
      return db.siteChatCltAtualizar(row.conversation_id, {
        error_message: "Não conseguimos confirmar sua autorização agora. Aguarde um instante e tente novamente.",
      }).catch(() => row);
    }
  }
  if (!row?.transaction_id || ["concluido", "sem_oferta", "erro"].includes(row.etapa)) return row;
  try {
    const contract = await novosaque.consultarContratoClt(row.transaction_id);
    const changes = { status_novosaque: contract.summary_status || contract.stage || null, error_message: null };
    if (contract.terms_link) changes.terms_link = contract.terms_link;
    if (contract.contract_link) {
      changes.contract_link = contract.contract_link;
      changes.etapa = "aguardando_assinatura";
    }
    const offers = (Array.isArray(contract.simulation_results) ? contract.simulation_results : []).filter((o) => o.success !== false && o.simulation_id);
    if (offers.length && !["formalizando", "aguardando_assinatura"].includes(row.etapa)) {
      changes.offers_json = JSON.stringify(offers);
      changes.etapa = "oferta_disponivel";
    }
    const margem = contract.balance_check_result;
    if (contract.summary_status === "Offer unavailable" || (margem?.success === true && Number(margem.balance_value) <= 0)) changes.etapa = "sem_oferta";
    const falha = falhaNovoSaque(contract);
    if (falha) changes.error_message = "O banco recebeu a autorização, mas não conseguiu concluir a análise. Nossa equipe pode verificar a proposta para você.";
    if (["Contract paid", "Collateral sended"].includes(contract.summary_status)) changes.etapa = "concluido";
    const updated = await db.siteChatCltAtualizar(row.conversation_id, changes);
    if (updated.contract_link) notificarContratoCltNoWhatsApp(updated).catch(() => {});
    return updated;
  } catch (err) {
    console.error(`Erro ao sincronizar CLT do site (${row.conversation_id}):`, err.message);
    return db.siteChatCltAtualizar(row.conversation_id, {
      etapa: "erro_integracao",
      status_novosaque: "ERRO_INTEGRACAO",
      error_message: "A conexão com a Facta está indisponível agora. Seus dados ficaram salvos; tente novamente em alguns instantes ou continue falando conosco pelo chat.",
    }).catch(() => row);
  }
}

// Cache em memória dos usuários do painel (login por pessoa) — isAuthorized precisa ser síncrona
// (Node só tem 1 thread, e toda requisição autenticada passa por ali), então não dá pra consultar
// o banco a cada chamada. Recarregado sempre que um usuário é criado/editado/desativado/tem senha
// redefinida pelas rotas de administração abaixo. PAINEL_USER/PAINEL_PASS continuam valendo como
// fallback de bootstrap/recuperação (ver isAuthorized) — nunca removidos, pra nunca deixar a
// equipe sem acesso se a tabela de usuários ficar vazia ou o banco cair.
let usuariosCache = [];
async function recarregarUsuariosCache() {
  try {
    usuariosCache = await db.usuarioListar();
  } catch (err) {
    console.error("Erro ao carregar usuários do banco (login por pessoa fica indisponível, só o fallback PAINEL_USER/PAINEL_PASS funciona):", err.message);
  }
}

const TELEGRAM_START_MESSAGE =
  process.env.TELEGRAM_START_MESSAGE ||
  "Olá! 👋 Para continuar seu atendimento, toque no botão abaixo pra compartilhar seu contato.";

const TELEGRAM_THANKS_MESSAGE =
  process.env.TELEGRAM_THANKS_MESSAGE ||
  "Recebemos seu contato, obrigado! Em breve alguém da nossa equipe vai falar com você. 🙌";

const INSTAGRAM_MENU_MESSAGE =
  process.env.INSTAGRAM_MENU_MESSAGE ||
  "Olá! 😊 Seja muito bem-vindo(a)!\n\n" +
  "Podemos te ajudar com atendimento pessoal e sem burocracia. Somos correspondente bancário " +
  "e trabalhamos com as melhores instituições do mercado.\n\n" +
  "Escolha abaixo o que você procura que já te chamamos no WhatsApp:\n\n" +
  "1️⃣ 🚗 Seguro de veículo\n2️⃣ 💼 Consignado CLT\n3️⃣ 💰 Saque do FGTS\n" +
  "4️⃣ 🔑 Empréstimo com carro em garantia\n5️⃣ 🚙 Financiamento de veículo\n\n" +
  "É só responder com o número ou o nome da opção que a gente continua por lá! 📲";

const INSTAGRAM_COMMENT_REPLY = process.env.INSTAGRAM_COMMENT_REPLY || INSTAGRAM_MENU_MESSAGE;
const INSTAGRAM_WELCOME_MESSAGE = process.env.INSTAGRAM_WELCOME_MESSAGE || INSTAGRAM_MENU_MESSAGE;

const INSTAGRAM_WHATSAPP_NUMERO = process.env.INSTAGRAM_WHATSAPP_NUMERO || "5547997059353";

// Opções do menu do Instagram → produto, palavras-chave aceitas na resposta do cliente
// (número da opção sempre aceito; palavras são comparadas sem acento/maiúscula), e o que
// acontece ao escolher. Sem `resposta` própria, cai no padrão: link pra continuar no
// WhatsApp (`linkWhatsAppInstagram`) — é o caso de garantia/financiamento, que continuam
// indo direto pro WhatsApp. Com `aguardaDados`, a próxima mensagem da pessoa é tratada como
// os dados pedidos (ver handleInstagramMessaging) em vez de tentar casar com outra opção.
const INSTAGRAM_OPCOES_MENU = [
  {
    produto: "Seguro de veículo",
    chaves: ["1", "seguro"],
    resposta:
      "Para fazer a cotação do seu seguro, é só acessar o site 🔗 www.cotacertaseguros.com.br, " +
      "preencher o formulário rapidinho e você já é direcionado(a) para o atendimento com um atendente. 😊",
  },
  {
    produto: "Consignado CLT",
    chaves: ["2", "clt", "consignado"],
    resposta:
      "Para fazer a simulação do consignado CLT, é necessário ter no mínimo 3 meses de carteira " +
      "assinada no trabalho atual.\n\nPra simular, me envia:\n• Nome completo\n• CPF\n" +
      "• Data de nascimento\n• E-mail\n• Telefone com WhatsApp",
    aguardaDados: "consignado_clt",
  },
  {
    produto: "Saque do FGTS",
    chaves: ["3", "fgts", "saque"],
    resposta:
      "Para fazer a simulação do saque do FGTS, é necessário autorizar a *J17* lá no aplicativo " +
      "do FGTS (Meu FGTS > Autorizações). Depois de autorizar, é só me informar o seu CPF que a gente já " +
      "parte pro atendimento. 😊",
    aguardaDados: "saque_fgts",
  },
  { produto: "Empréstimo com carro em garantia", chaves: ["4", "garantia"] },
  { produto: "Financiamento de veículo", chaves: ["5", "financiamento"] },
];

// Mensagem de confirmação depois que a pessoa manda os dados pedidos (CPF do FGTS, ou o
// pacote de dados do consignado CLT) — mesma pros dois fluxos, encerra a captura automática.
const INSTAGRAM_DADOS_RECEBIDOS_MESSAGE =
  "Perfeito! ✅ Recebemos seus dados, é só aguardar que um atendente já vai continuar por aqui. 🙌";

// Além dos acentos (faixa de combining diacritics), também tira variation selector (️/︎)
// e o combining enclosing keycap (⃣) — sem isso, alguém que responde tocando no emoji
// "1️⃣" que a GENTE MESMO manda no menu (em vez de digitar "1" no teclado) nunca casava com
// a chave "1": o emoji de teclado é o dígito + esses dois caracteres invisíveis, que ficavam
// intactos e faziam a comparação `t === chave` falhar sempre. Bug real, confirmado testando.
const REGEX_ACENTOS = new RegExp("[̀-ͯ︎️⃣]", "g");

function normalizarTexto(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(REGEX_ACENTOS, "")
    .toLowerCase()
    .trim();
}

// Celular brasileiro tem o "9º dígito" (55 + DDD + 9 + 8 dígitos = 13 no total), mas número
// digitado à mão (ex.: colado numa lista de campanha antiga) às vezes vem sem ele (55 + DDD +
// 8 = 12). Sem normalizar, os dois formatos viram DUAS conversas diferentes pro mesmo contato
// real — bug reportado 2026-08-18 (Larissa Cardoso aparecendo duplicada no painel). Todo
// telefone precisa passar por aqui antes de virar chave de conversations/messages.
function normalizarTelefoneBR(telefone) {
  const digitos = (telefone || "").replace(/\D/g, "");
  if (/^55\d{10}$/.test(digitos)) {
    const ddd = digitos.slice(2, 4);
    const resto = digitos.slice(4);
    return `55${ddd}9${resto}`;
  }
  return digitos;
}

// Exige a mensagem inteira igual à palavra-chave (não só "conter" a palavra em algum lugar
// de uma frase maior) — "fgts" sozinho aciona, "por que o fgts não caiu" não aciona (pedido
// do usuário depois de ver a palavra disparando dentro de frases sem intenção clara).
function detectarOpcaoMenuInstagram(texto) {
  const t = normalizarTexto(texto);
  if (!t) return null;
  for (const opcao of INSTAGRAM_OPCOES_MENU) {
    for (const chave of opcao.chaves) {
      if (t === chave) return opcao;
    }
  }
  return null;
}

function linkWhatsAppInstagram(produto) {
  const texto = `Olá, vim do Instagram e quero saber sobre ${produto}`;
  return `https://wa.me/${INSTAGRAM_WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
}

const PHONE_NUMBERS = process.env.PHONE_NUMBERS_JSON
  ? JSON.parse(process.env.PHONE_NUMBERS_JSON)
  : process.env.PHONE_NUMBER_ID
  ? [{ id: process.env.PHONE_NUMBER_ID, label: "Principal" }]
  : [];

// Business Manager da Felizcred — dono da maioria das WABAs configuradas e, além disso,
// destinatário do compartilhamento cross-portfólio da WABA da Ciahot (por isso o envio em
// massa consegue descobrir a WABA de QUALQUER número configurado, mesmo os de outro
// portfólio, sem precisar cadastrar isso em lugar nenhum — ver resolverWabaDoNumero).
const META_BUSINESS_ID = "599219759208171";

// Cache em memória (10min) do mapa phone_number_id → waba_id — evita rechamar a Meta a cada
// clique no painel; listarTemplates já é rápido, mas listar TODAS as WABAs + números de cada
// uma pra descobrir a dona de UM número é bem mais chamada de API do que vale a pena repetir.
let cacheWabaPorNumero = null;
let cacheWabaPorNumeroEm = 0;
async function resolverWabaDoNumero(businessNumberId) {
  const agora = Date.now();
  if (!cacheWabaPorNumero || agora - cacheWabaPorNumeroEm > 10 * 60 * 1000) {
    const wabas = await wa.listarWabasDoNegocio(META_BUSINESS_ID);
    const mapa = {};
    await Promise.all(
      wabas.map(async (waba) => {
        try {
          const numeros = await wa.listarNumerosDaWaba(waba.id);
          for (const n of numeros) mapa[n.id] = waba.id;
        } catch (err) {
          console.error(`Erro ao listar números da WABA ${waba.id}:`, err.message);
        }
      })
    );
    cacheWabaPorNumero = mapa;
    cacheWabaPorNumeroEm = agora;
  }
  return cacheWabaPorNumero[businessNumberId] || null;
}

// Não manda template de campanha pro MESMO contato de novo dentro desse prazo — trava contra
// lista repetida colada por engano num disparo posterior (caso real 2026-08-24: contato que já
// tinha respondido e passado pelo fluxo inteiro no dia 21 recebeu o MESMO "bom_dia" de novo no
// dia 24, porque a lista do segundo disparo se sobrepunha com a do primeiro sem o operador
// perceber). Só conta mensagem de SAÍDA tipo 'template' (o próprio broadcast) — não bloqueia
// nada do fluxo automático de resposta que vem depois.
const DIAS_BLOQUEIO_REENVIO_TEMPLATE = 30;

// Troca {{nome}}/{{data}} dentro de UM parâmetro de template — usado quando o chamador passa
// `params` customizado (ex.: template de aniversário com 2+ variáveis) em vez de confiar no
// preenchimento automático de 1 variável só (nome, comportamento antigo abaixo).
function resolverTokenParametro(texto, nome) {
  const agoraBrt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dataFmt = `${String(agoraBrt.getUTCDate()).padStart(2, "0")}/${String(agoraBrt.getUTCMonth() + 1).padStart(2, "0")}`;
  return String(texto).replace(/\{\{nome\}\}/g, nome || "Cliente").replace(/\{\{data\}\}/g, dataFmt);
}

// Envia 1 mensagem de template de broadcast e grava na conversa — usado tanto pelo envio
// imediato (POST /painel/api/broadcast) quanto pelo agendador de envios intercalados (ver
// setInterval do broadcast_agendado, mais abaixo). Retorna { ok, error }, nunca lança.
// `params` (opcional): lista de textos, 1 por variável {{1}},{{2}}... do template, cada um
// podendo usar os tokens {{nome}}/{{data}} — sem isso, mantém o padrão antigo (só {{1}}=nome).
const TEMPLATES_SEM_VARIAVEIS = ["bomdia", "boatarde"];
async function enviarUmBroadcast(businessId, { phone, name, template, language, bodyPreview, params }) {
  const telefoneLimpo = normalizarTelefoneBR(phone);
  const nome = (name || "").trim();
  if (!telefoneLimpo) return { ok: false, error: "telefone inválido" };
  if (await db.jaRecebeuTemplateRecente(telefoneLimpo, businessId, DIAS_BLOQUEIO_REENVIO_TEMPLATE)) {
    return {
      ok: false,
      error: `Bloqueado: esse número já recebeu template desse canal nos últimos ${DIAS_BLOQUEIO_REENVIO_TEMPLATE} dias`,
    };
  }
  try {
    // bomdia/boatarde não têm variável no corpo: mandar o nome como parâmetro faz o Meta recusar
    // (erro #132000). Por isso esses dois não recebem componentes.
    const semVariaveis = TEMPLATES_SEM_VARIAVEIS.includes(template);
    const components =
      semVariaveis ? undefined :
      params && params.length
        ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: resolverTokenParametro(p, nome) })) }]
        : nome
        ? [{ type: "body", parameters: [{ type: "text", text: nome }] }]
        : undefined;
    const result = await wa.sendTemplate(businessId, telefoneLimpo, template, language || "pt_BR", components);
    const waId = result.messages?.[0]?.id || null;
    const now = Date.now();
    const texto = bodyPreview ? bodyPreview.replace(/\{\{1\}\}/g, nome || "Cliente") : `[template] ${template}`;
    await db.upsertConversation(telefoneLimpo, businessId, nome || null, now);
    await db.insertMessage({
      phone: telefoneLimpo,
      business_number_id: businessId,
      direction: "out",
      type: "template",
      body: texto,
      wa_message_id: waId,
      status: "sent",
      created_at: now,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const MEDIA_DIR = path.join(__dirname, "media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Imagens enviadas pelo Publique IV (ver PUBLIQUE-IV.md) — pasta separada da mídia do
// WhatsApp porque essas precisam ficar acessíveis SEM login: Instagram/Facebook exigem uma
// URL pública pra buscar a imagem na hora de publicar.
const PUBLICAR_MEDIA_DIR = path.join(MEDIA_DIR, "publicar");
fs.mkdirSync(PUBLICAR_MEDIA_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "audio/mp4": "m4a",
  // webm só aparece se o navegador não conseguiu gravar audio/ogg;codecs=opus (ver gravação de
  // áudio no painel) — o WhatsApp não aceita webm como nota de voz, mas ao menos salva com a
  // extensão certa em vez de mentir "ogg" num arquivo que não é (o antigo fallback genérico).
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

// Caminho inverso de EXT_BY_MIME — usado por quem SERVE o arquivo de volta (GET /media/... e
// GET /publicar-media/...) pra mandar o Content-Type certo. Sem isso, `send()` não define
// Content-Type nenhum pra um Buffer (ver função send), e a plataforma cai no default
// "application/octet-stream" — que o WhatsApp recusa quando busca a imagem pra reenviar
// (erro "Unsupported Image mime type application/octet-stream").
const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  amr: "audio/amr",
  m4a: "audio/mp4",
  webm: "audio/webm",
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function mimeDoArquivo(nomeArquivo) {
  const ext = path.extname(nomeArquivo).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
// Recebe 1 vídeo (+ campos de texto opcionais "legenda" e "data") enviado via
// multipart/form-data e grava o vídeo direto em disco via streaming (não acumula o arquivo
// inteiro na memória) — usado pelo upload direto de Reels no painel (POST
// /painel/api/reels/upload). Devolve o caminho do arquivo temporário, o nome original, a
// legenda e a data mínima (se vieram). Importante: os campos de texto precisam vir ANTES
// do arquivo no FormData do cliente, senão podem chegar depois do "finish" e serem perdidos.
function receberVideoTemp(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = busboy({ headers: req.headers, limits: { fileSize: 150 * 1024 * 1024 } });
    } catch (err) {
      return reject(err);
    }
    let recebeuArquivo = false;
    let legenda = "";
    let dataMinima = "";
    bb.on("field", (nome, valor) => {
      if (nome === "legenda") legenda = valor;
      if (nome === "data") dataMinima = valor;
    });
    bb.on("file", (_campo, stream, info) => {
      recebeuArquivo = true;
      const arquivoPath = path.join(os.tmpdir(), `reel-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
      const writeStream = fs.createWriteStream(arquivoPath);
      let estourouLimite = false;
      stream.on("limit", () => (estourouLimite = true));
      stream.pipe(writeStream);
      writeStream.on("finish", () => {
        if (estourouLimite) {
          fs.unlink(arquivoPath, () => {});
          return reject(new Error("Vídeo muito grande (limite 150MB)"));
        }
        resolve({ arquivoPath, nomeOriginal: info.filename || "video.mp4", legenda, dataMinima });
      });
      writeStream.on("error", reject);
    });
    bb.on("error", reject);
    bb.on("close", () => {
      if (!recebeuArquivo) reject(new Error("Nenhum arquivo enviado"));
    });
    req.pipe(bb);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// Decodifica uma imagem em data URL (formato que o <input type="file"> + FileReader do
// navegador gera) e salva em PUBLICAR_MEDIA_DIR. Usado pelo upload do Publique IV.
function salvarImagemPublicar(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de imagem inválido");
  const ext = EXT_BY_MIME[match[1]] || "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(PUBLICAR_MEDIA_DIR, filename), Buffer.from(match[2], "base64"));
  return filename;
}

// Igual a salvarImagemPublicar, mas vídeo — usado pelo anexo de vídeo no reply do painel
// (POST /painel/api/conversations/:businessId/:phone/reply).
function salvarVideoPublicar(dataUrl) {
  const match = /^data:(video\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de vídeo inválido");
  const ext = EXT_BY_MIME[match[1]] || "mp4";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(PUBLICAR_MEDIA_DIR, filename), Buffer.from(match[2], "base64"));
  return filename;
}

// Igual a salvarVideoPublicar, mas áudio — usado pelo anexo de áudio no reply do painel.
// (?:;[^,]*)? absorve parâmetro extra antes do ";base64," (ex: "audio/ogg;codecs=opus" — o
// MediaRecorder do navegador manda o mimeType completo assim). Sem isso todo áudio GRAVADO no
// painel falhava com "Formato de áudio inválido" (só anexo por arquivo passava).
function decodificarAudioBase64(dataUrl) {
  const match = /^data:(audio\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de áudio inválido");
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1], ext: EXT_BY_MIME[match[1]] || "ogg" };
}

// Todo áudio vira MP3 mono antes de ir pro WhatsApp: o Chrome grava em WebM (a Meta recusa) e o Ogg/Opus gerado
// pelo ffmpeg chegava no celular com "algo de errado com o arquivo de áudio" (testado em Android, 23/10/2026).
// MP3 toca em qualquer celular (aparece como arquivo de áudio, não como nota de voz).
function transcodarParaMp3(buffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ["-i", "pipe:0", "-vn", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", "pipe:1"]);
    const chunks = [];
    let stderr = "";
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else reject(new Error(`Não deu pra converter o áudio pro formato do WhatsApp (ffmpeg ${code}): ${stderr.slice(-400)}`));
    });
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.stdin.end(buffer);
  });
}

// Converte se preciso e grava no R2 (clientes/) — persiste a deploy, o painel toca via /media/.
// Devolve { url (assinada, pro WhatsApp buscar), mediaPath (persistente, pro painel) }.
async function salvarAudioR2(dataUrl) {
  const decodificado = decodificarAudioBase64(dataUrl);
  const buffer = await transcodarParaMp3(decodificado.buffer);
  const contentType = "audio/mpeg";
  const ext = "mp3";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await r2.enviarVideo(`clientes/${filename}`, buffer, contentType);
  return { url: await r2.urlAssinada(`clientes/${filename}`, 900), mediaPath: `/media/${filename}`, buffer };
}

// Versão em disco, só pro chat do site (salvarMidiaSite) — não passa pelo WhatsApp.
function salvarAudioPublicar(dataUrl) {
  const { buffer, ext } = decodificarAudioBase64(dataUrl);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(PUBLICAR_MEDIA_DIR, filename), buffer);
  return filename;
}

// Igual a salvarVideoPublicar, mas documento (PDF, planilha, etc.) — usado pelo anexo de
// documento no reply do painel. Diferente dos outros, aceita qualquer mime type (não só um
// prefixo fixo tipo "image/"), já que documento cobre formatos bem variados.
function salvarDocumentoPublicar(dataUrl) {
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de documento inválido");
  const ext = EXT_BY_MIME[match[1]] || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(PUBLICAR_MEDIA_DIR, filename), Buffer.from(match[2], "base64"));
  return filename;
}

function salvarMidiaSite(req, body) {
  const dataUrl = body.imagemBase64 || body.videoBase64 || body.audioBase64 || body.documentBase64;
  if (dataUrl && String(dataUrl).length > 21_000_000) throw new Error("O arquivo deve ter no máximo 15 MB");
  let filename = null;
  let type = "text";
  let mime = "";
  if (body.imagemBase64) { filename = salvarImagemPublicar(body.imagemBase64); type = "image"; mime = String(body.imagemBase64).slice(5).split(";")[0]; }
  else if (body.videoBase64) { filename = salvarVideoPublicar(body.videoBase64); type = "video"; mime = String(body.videoBase64).slice(5).split(";")[0]; }
  else if (body.audioBase64) { filename = salvarAudioPublicar(body.audioBase64); type = "audio"; mime = String(body.audioBase64).slice(5).split(";")[0]; }
  else if (body.documentBase64) { filename = salvarDocumentoPublicar(body.documentBase64); type = "document"; mime = String(body.documentBase64).slice(5).split(";")[0]; }
  return filename ? { type, mime, fileName: String(body.fileName || "").slice(0, 180), url: `https://${req.headers.host}/publicar-media/${filename}` } : {};
}

// Igual a salvarImagemPublicar, mas devolve o buffer decodificado em vez de gravar em disco —
// usado pela agenda de publicações, que guarda a imagem no R2 (precisa sobreviver a um
// deploy/restart do Render, diferente da publicação imediata que só precisa durar segundos).
function decodificarImagemBase64(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de imagem inválido");
  const ext = EXT_BY_MIME[match[1]] || "jpg";
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1], nomeArquivo: `imagem.${ext}` };
}

// Igual a decodificarImagemBase64, mas pra vídeo (Reels agendado pela agenda multi-rede).
function decodificarVideoBase64(dataUrl) {
  const match = /^data:(video\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de vídeo inválido");
  const ext = match[1] === "video/quicktime" ? "mov" : "mp4";
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1], nomeArquivo: `video.${ext}` };
}

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, headers);
    return res.end(body);
  }
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}

// <audio>/<video> usam Range para descobrir duração, reproduzir e permitir seek.
// Sem estes headers o Chrome pode reportar duration=Infinity.
function sendMediaBuffer(req, res, buffer, contentType) {
  const total = buffer.length;
  const range = req.headers.range;
  const base = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  if (!range) {
    res.writeHead(200, { ...base, "Content-Length": total });
    return req.method === "HEAD" ? res.end() : res.end(buffer);
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, { ...base, "Content-Range": `bytes */${total}` });
    return res.end();
  }

  let start;
  let end;
  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      res.writeHead(416, { ...base, "Content-Range": `bytes */${total}` });
      return res.end();
    }
    start = Math.max(0, total - suffixLength);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= total || end < start) {
    res.writeHead(416, { ...base, "Content-Range": `bytes */${total}` });
    return res.end();
  }

  const chunk = buffer.subarray(start, end + 1);
  res.writeHead(206, {
    ...base,
    "Content-Length": chunk.length,
    "Content-Range": `bytes ${start}-${end}/${total}`,
  });
  return req.method === "HEAD" ? res.end() : res.end(chunk);
}

// Login por pessoa (cada atendente com seu próprio usuário/senha) — PAINEL_USER/PAINEL_PASS
// continua funcionando como fallback de bootstrap/recuperação mesmo com usuários reais
// cadastrados, nunca é removido. Devolve o usuário autenticado (objeto, nunca só `true`) ou
// `null` — quem só precisa saber "está logado?" usa como antes
// (`if (!requireAuth(req, res)) return;`, objeto é truthy); rotas que precisam saber QUEM é
// (admin-only, /painel/api/me, filtro de canal por pessoa, "atribuídas a mim") leem o retorno.
// Continua 100% síncrona (sem acessar o banco) — compara contra usuariosCache, recarregado pelas
// rotas de administração sempre que um usuário muda (ver recarregarUsuariosCache).
function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  const [user, pass] = Buffer.from(encoded, "base64").toString("utf8").split(":");
  if (user === PAINEL_USER && pass === PAINEL_PASS) {
    return { id: null, nome: "Admin", usuario: PAINEL_USER, papel: "admin", canais_padrao: null, ativo: 1 };
  }
  const registro = usuariosCache.find((u) => u.usuario === user && u.ativo);
  if (!registro) return null;
  if (!db.verificarSenha(pass || "", registro.senha_hash)) return null;
  return registro;
}

function requireAuth(req, res) {
  const usuario = isAuthorized(req);
  if (usuario) return usuario;
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="painel"' });
  res.end("Authorization required");
  return false;
}

// Lê `canais_padrao` (TEXT JSON no banco, ou já `null` no admin sintético/fallback) de forma
// resiliente — null/vazio/JSON quebrado tudo cai em "sem restrição" (nunca trava alguém de fora
// por um dado mal formado).
function canaisPermitidosDoUsuario(usuarioAtual) {
  if (!usuarioAtual || usuarioAtual.papel === "admin") return null; // null = sem restrição
  const bruto = usuarioAtual.canais_padrao;
  if (!bruto) return null;
  try {
    const lista = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    if (!Array.isArray(lista) || lista.length === 0) return null;
    return lista;
  } catch {
    return null;
  }
}

// Lê `etapas_notificacao` (TEXT JSON no banco) de forma resiliente — null/vazio/JSON quebrado
// tudo cai em `[]` (nunca força notificação urgente por etapa a partir de dado mal formado).
function etapasNotificacaoDoUsuario(usuarioAtual) {
  const bruto = usuarioAtual?.etapas_notificacao;
  if (!bruto) return [];
  try {
    const lista = typeof bruto === "string" ? JSON.parse(bruto) : bruto;
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// Token de mídia — `<img src="/media/...">`/`<audio src="...">` não conseguem mandar o header
// Authorization (é um recurso de navegador, não um fetch com header customizado), então mídia
// atrás de Basic Auth não carregava sozinha dentro de elementos nativos. O painel busca 1 token
// assinado (HMAC, só esse processo conhece o segredo) logo após o login e embute como `?token=`
// em toda URL de mídia — GET /media/:filename aceita esse token como alternativa ao Basic Auth.
// Secret gerado 1x no boot (nunca persistido): token para de valer depois de um restart/deploy,
// tudo bem, o painel busca um novo sozinho na próxima vez que loga.
const MEDIA_TOKEN_SECRET = crypto.randomBytes(32);
const MEDIA_TOKEN_VALIDADE_MS = 24 * 60 * 60 * 1000;

function gerarTokenMedia(usuario) {
  const expiraEm = Date.now() + MEDIA_TOKEN_VALIDADE_MS;
  const payload = `${usuario}.${expiraEm}`;
  const assinatura = crypto.createHmac("sha256", MEDIA_TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${assinatura}`).toString("base64url");
}

function validarTokenMedia(token) {
  try {
    const [usuario, expiraEmStr, assinatura] = Buffer.from(token, "base64url").toString("utf8").split(".");
    const expiraEm = Number(expiraEmStr);
    if (!usuario || !expiraEm || Date.now() > expiraEm || !assinatura) return false;
    const esperada = crypto.createHmac("sha256", MEDIA_TOKEN_SECRET).update(`${usuario}.${expiraEm}`).digest("hex");
    const bufEsperada = Buffer.from(esperada, "hex");
    const bufRecebida = Buffer.from(assinatura, "hex");
    return bufEsperada.length === bufRecebida.length && crypto.timingSafeEqual(bufEsperada, bufRecebida);
  } catch {
    return false;
  }
}

function safeFilename(waMessageId, ext) {
  const safe = waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safe}.${ext}`;
}

function normalizar(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Respostas automáticas para os botões de resposta rápida dos templates de campanha.
// `passo` (opcional) marca a conversa nesse passo do fluxo pra a próxima mensagem de texto
// da pessoa cair num capturaTexto dedicado (ver FLUXO_FELIZCRED.capturaTexto), em vez de
// ficar solta sem automação. Chaves de templates diferentes usam textos de botão diferentes
// de propósito — se dois templates reusassem "QUERO SABER MAIS", não daria pra saber qual
// campanha originou o clique, e as duas cairiam na mesma resposta/fluxo aqui.
const RESPOSTAS_BOTAO = {
  // Template aviso_taxa_clt
  "quero saber mais": {
    texto:
      "Para simular o consignado CLT precisamos de alguns dados para gerar a autorização, após enviar é só aguardar que um atendente irá vir te atender. Enquanto aguarda, visite nosso site www.felizcred.com.br",
  },
  "nao quero receber mais": {
    texto: "Não iremos mais enviar mensagem e fique à vontade para nos chamar quando precisar!",
  },
  // Template oferta_consignado_clt (campanha genérica, sem variável — mesma mensagem pra
  // todo mundo, categoria Marketing, o mais barata e simples de disparar em massa)
  "quero simular": {
    texto:
      "Show! 😊 Pra simular seu consignado CLT, preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só:\n" +
      "• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento",
    passo: "campanha_clt_dados",
  },
  "nao tenho interesse": {
    texto: "Sem problemas! Fique à vontade para nos chamar quando precisar 😊",
  },
};

async function enviarRespostaAutomatica(businessNumberId, phone, texto, botoes, lista, cta) {
  // Atendente humano respondeu pelo painel: bot pausado nessa conversa até religar ou vencer a janela.
  if (await db.botEstaPausado(phone, businessNumberId)) return;
  // Botão de link recusado pela Meta (texto longo, URL inválida...): o cliente não pode ficar sem resposta, então
  // manda o mesmo texto com o link escrito.
  let result = null;
  if (cta) {
    try {
      result = await wa.sendCtaUrl(businessNumberId, phone, texto, cta.buttonText, cta.url);
    } catch (err) {
      console.error("Botão de link recusado, enviando o link em texto:", err.message);
      return enviarRespostaAutomatica(businessNumberId, phone, `${texto}

${cta.url}`);
    }
  } else {
    result = lista
      ? await wa.sendList(businessNumberId, phone, texto, lista.botao, lista.opcoes)
      : botoes
      ? await wa.sendButtons(businessNumberId, phone, texto, botoes)
      : await wa.sendText(businessNumberId, phone, texto);
  }
  const waId = result.messages?.[0]?.id || null;
  const now = Date.now();
  // No histórico do painel, botões/opções (ou o link do cta) aparecem listados abaixo do texto
  const opcoes = lista ? lista.opcoes : botoes;
  const bodySalvo = cta
    ? `${texto}\n\n🔗 ${cta.buttonText}: ${cta.url}`
    : opcoes
    ? `${texto}\n\n${opcoes.map((b) => `🔘 ${b.title}`).join("\n")}`
    : texto;
  await db.upsertConversation(phone, businessNumberId, null, now);
  await db.insertMessage({
    phone,
    business_number_id: businessNumberId,
    direction: "out",
    type: "text",
    body: bodySalvo,
    wa_message_id: waId,
    status: "sent",
    created_at: now,
  });
}

// Quando um template de campanha (broadcast frio — "Olá, boa tarde" etc.) chega como 'failed'
// (às vezes bem depois do envio parecer ok, ver processarEntry), apaga a conversa se a pessoa
// nunca respondeu nada: não é uma conversa de verdade, é lixo de número inválido/inexistente
// sujando o histórico do painel — pedido do usuário em 26/09/2026. Nunca mexe numa conversa que
// já teve troca de verdade (checa last_inbound_at antes) nem numa mensagem que não era template
// (ex.: falha de entrega no meio de um atendimento normal continua só marcada, não apaga nada).
async function limparBroadcastNuncaRespondido(waMessageId, businessNumberId) {
  const msg = await db.getMensagemPorWaId(waMessageId);
  if (!msg || msg.type !== "template" || msg.direction !== "out") return;
  const conversa = await db.getConversation(msg.phone, businessNumberId);
  if (conversa?.last_inbound_at) return;
  await db.apagarConversa(msg.phone, businessNumberId);
  console.log(`🧹 Conversa apagada (template não entregue, nunca respondida): ${msg.phone} / ${businessNumberId}`);
}

// Registra um evento do funil de qualificação pro painel (aba Funil) — nunca deixa o erro
// derrubar o fluxo de atendimento de verdade, só loga (mesmo espírito do markAsRead).
function logFunil(businessNumberId, phone, etapa) {
  db.funilRegistrarEvento(phone, businessNumberId, etapa).catch((err) =>
    console.error("Falha ao registrar evento de funil:", err.message)
  );
}

// ─── FLUXO DE MENSAGENS AUTOMÁTICAS COM BOTÕES ───────────────────────────────
// Menu inicial enviado quando um contato manda mensagem e a conversa está
// inativa há mais de 24h (ou é a primeira mensagem dele). Cada botão leva ao
// próximo passo do fluxo, identificado pelo id do botão clicado.
const HORAS_INATIVIDADE_MENU = 24;

// Sentinela salva em fluxo_passo quando o contato pede explicitamente pra parar de receber
// mensagem (ex.: botão BLOQUEAR da campanha de indicação FGTS). Genérico de propósito — não é
// específico de nenhuma campanha — pra qualquer fluxo futuro poder reaproveitar o mesmo opt-out
// sem precisar de coluna nova no banco. Único efeito: barra o reenvio automático do início do
// fluxo por inatividade (ver checagem perto de TIPOS_COM_MENU); a pessoa ainda pode reabrir na
// mão digitando "menu", porque aí a iniciativa é dela.
const PASSO_OPTOUT_BLOQUEADO = "bloqueado_optout";
const WHATSAPP_OPT_IN_VERSION = "site-chat-v1-2026-10-17";
const WHATSAPP_OPT_IN_TEXT = "Aceito receber no WhatsApp mensagens da FelizCred sobre esta simulação e futuras oportunidades. Posso cancelar a qualquer momento.";

// Primeiro nome do perfil do WhatsApp, só se parecer um nome de verdade (nada de emoji sozinho,
// nome vazio ou símbolo) — usado pra personalizar a abertura da campanha fria sem alongar o
// texto (troca "Meu nome é Felipe" por "Oi, Marcos! Meu nome é Felipe").
function extrairPrimeiroNome(nomeCompleto) {
  const primeiro = (nomeCompleto || "").trim().split(/\s+/)[0] || "";
  return /^[A-Za-zÀ-ÿ]{2,}$/.test(primeiro) ? primeiro : null;
}

function saudacaoDoDia() {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date())
  );
  if (hora >= 5 && hora < 12) return "bom dia";
  if (hora >= 12 && hora < 18) return "boa tarde";
  return "boa noite";
}

// Triagem do anúncio de gerente/supervisor (revisão de FGTS via escritório parceiro) — foi
// a entrada padrão de 11/07/2026 até 12/08/2026. ARQUIVADA, não desativada: guardada aqui
// pronta pra virar `menuInicial` de novo (é só trocar a referência abaixo), com todos os
// passos (fluxo_gerente/gerente_*) intactos no FLUXO_BOTOES.
function menuInicialGerenteArquivado() {
  return {
    texto:
      `Olá, ${saudacaoDoDia()}! Você clicou no nosso anúncio voltado para quem trabalha ou já trabalhou ` +
      "como GERENTE ou SUPERVISOR. Para saber se você tem direito a receber FGTS, ou se deixou de receber, " +
      "preciso de algumas informações para te direcionar ao atendimento especializado. Vamos lá, é bem rápido!",
    botoes: [
      { id: "gerente_trabalhou", title: "TRABALHO/TRABALHEI" },
      { id: "gerente_nunca", title: "NUNCA TRABALHEI" },
    ],
  };
}

// Menu principal (texto exato pedido pelo usuário, é o que o Felipe já manda manualmente
// hoje — ver felizcred-site/logo/chats/) — respondido por número/palavra em texto livre
// (detectarOpcaoMenuPrincipal), não por botão, porque é assim que o cliente responde de
// verdade ("1", "clt" etc.).
const TEXTO_MENU_PRINCIPAL =
  "Olá, me chamo Felipe:\n\n" +
  "Escolha uma das opções para ser atendido:\n" +
  "Digite a opção desejada:\n\n" +
  "1 - CONSIGNADO CLT\n" +
  "2 - SEGURO DE CARRO/MOTO\n" +
  "3 - EMPRÉSTIMO COM CARRO EM GARANTIA\n" +
  "4 - FINANCIAR UM VEÍCULO\n" +
  "5 - SAQUE DO FGTS\n\n" +
  "ATENÇÃO: O saque do FGTS só pode ser simulado se não foi realizado neste ano. A Caixa alterou as regras.\n\n" +
  "✅ (47) 99705-9353\n" +
  "✅ (47) 99274-7368\n" +
  "✅ (47) 3514-3392\n" +
  "🌐 http://www.felizcred.com.br";

// Entrada híbrida usada nos dois números da FelizCred: CLT segue para o chat seguro do site;
// os demais produtos continuam no WhatsApp. Uma mensagem genérica recebe uma única lista.
function menuInicial() {
  return {
    texto:
      "Olá! Aqui é o Felipe, da FelizCred. Qual produto você procura? O consignado CLT continua no chat seguro do site; os demais atendimentos seguem por aqui.",
    lista: {
      botao: "Escolher produto",
      opcoes: [
        { id: "prod_clt", title: "Empréstimo CLT", description: "Simulação pelo chat seguro" },
        { id: "prod_fgts", title: "Antecipação FGTS", description: "Continue pelo WhatsApp" },
        { id: "prod_seguro", title: "Seguro de veículo", description: "Continue pelo WhatsApp" },
        { id: "prod_carro", title: "Carro em garantia", description: "Continue pelo WhatsApp" },
        { id: "prod_financiamento", title: "Financiar veículo", description: "Continue pelo WhatsApp" },
      ],
    },
  };
}

async function encaminharCltParaSite(de, businessNumberId) {
  // O chat do site ainda não está pronto: o CLT segue pela mesma oferta/simulação no WhatsApp da Campanha CLT.
  logFunil(businessNumberId, de, "clt_direcionado_site");
  await iniciarOfertaConsignado(de, businessNumberId);
}

// Reconhece a opção do menu principal em texto livre — número (1-4) ou palavra-chave.
// Exige a mensagem inteira igual à palavra-chave, não só "conter" a palavra em algum lugar
// de uma frase maior — "fgts" sozinho aciona, "por que o fgts não caiu" não aciona (pedido
// do usuário depois de ver a palavra disparando dentro de frases sem intenção clara).
const OPCOES_MENU_PRINCIPAL = [
  { id: "1", chaves: ["1", "clt", "consignado"] },
  { id: "2", chaves: ["2", "seguro"] },
  { id: "3", chaves: ["3", "garantia"] },
  { id: "4", chaves: ["4", "financiar", "financiamento"] },
  // Adicionado 13/08/2026: o menu já citava FGTS no aviso ("ATENÇÃO: o saque do FGTS...")
  // mas ninguém tratava a palavra — quem digitasse "fgts" ficava sem resposta nenhuma
  // (reportado pelo usuário). Mesmas chaves já usadas no menu do Instagram, pra manter os
  // dois canais consistentes.
  { id: "5", chaves: ["5", "fgts", "saque"] },
];

function detectarOpcaoMenuPrincipal(texto) {
  const t = normalizarTexto(texto);
  if (!t) return null;
  for (const opcao of OPCOES_MENU_PRINCIPAL) {
    for (const chave of opcao.chaves) {
      if (t === chave) return opcao.id;
    }
  }
  return null;
}

function pediuConsignadoClt(texto) {
  const t = normalizarTexto(texto);
  if (/\binss\b/.test(t)) return false;
  return /\b(clt|consignado|credito do trabalhador|emprestimo do trabalhador|carteira assinada)\b/.test(t);
}

function pediuPararMensagens(texto) {
  return /^(parar mensagens|nao quero receber mais|sair|cancelar mensagens|pare)$/i.test(normalizarTexto(texto));
}

// Documentos pedidos em garantia/financiamento — mesma lista pros dois (só muda a frase de
// requisito antes). "Foto do documento" fica sem automação de verdade: capturaTexto só roda
// pra mensagens de texto, então uma foto sozinha não confirma nada — fica visível no
// histórico do painel pro Felipe conferir manualmente.
const DOCUMENTOS_VEICULO =
  "\n\nPra simular, me envia:\n" +
  "• Foto do documento do veículo (CRLV)\n" +
  "• Endereço completo\n" +
  "• Profissão e renda\n" +
  "• Foto do seu documento (RG ou CNH)\n" +
  "• E-mail";

// Resposta de quem clicou/digitou a opção do menu principal. Não reconhecer não responde
// nada automático (fica pro atendimento manual, mesma filosofia do menu do Instagram).
async function handlerMenuPrincipal(de, businessNumberId, corpo) {
  const escolha = detectarOpcaoMenuPrincipal(corpo);
  if (escolha === "1") {
    await encaminharCltParaSite(de, businessNumberId);
  } else if (escolha === "2") {
    await enviarRespostaAutomatica(businessNumberId, de, PRODUTO_CONFIRMACAO("o SEGURO DE CARRO/MOTO") + avisoForaHorarioCotaCerta());
    await db.setFluxoPasso(de, businessNumberId, null);
  } else if (escolha === "3") {
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Para fazer a simulação do empréstimo com carro em garantia, você não pode ter restrição de crédito " +
        "no SPC/Serasa, e o carro não pode estar alienado." +
        DOCUMENTOS_VEICULO
    );
    await db.setFluxoPasso(de, businessNumberId, "carro_garantia_dados");
  } else if (escolha === "4") {
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Se você já escolheu o modelo do veículo que quer financiar, pra fazer a simulação você não pode ter " +
        "restrição de crédito no SPC/Serasa." +
        DOCUMENTOS_VEICULO
    );
    await db.setFluxoPasso(de, businessNumberId, "financiamento_dados");
  } else if (escolha === "5") {
    await iniciarFluxoFgtsMenu(de, businessNumberId);
  }
  // Não reconheceu a opção → fica no passo menu_inicial (mantém o lembrete sutil ativo)
}

// ─── REGRA: FGTS JÁ CONSULTADO ───────────────────────────────────────────────
// A Caixa só permite o saque-aniversário uma vez a cada 12 meses. Quem já foi atendido sobre FGTS (CPF consultado
// ou resposta de "já sacou" do atendente) ganha a tag abaixo; se voltar a escolher FGTS dentro de 12 meses, recebe a
// explicação automática e a oferta do consignado CLT, em vez de repetir o fluxo.
const TAG_FGTS_CONSULTADO = "FGTS já consultado";
const DOZE_MESES_MS = 365 * 24 * 3600 * 1000;

async function marcarFgtsConsultado(de, businessNumberId) {
  try {
    const tagId = await db.tagEncontrarOuCriar(businessNumberId, TAG_FGTS_CONSULTADO, "#b45309");
    await db.adicionarTagConversa(businessNumberId, de, tagId, "automatico");
  } catch (err) {
    console.error("Erro ao marcar FGTS já consultado:", err.message);
  }
}

async function fgtsJaConsultado(de, businessNumberId) {
  try {
    const desde = await db.tagDaConversaDesde(businessNumberId, de, TAG_FGTS_CONSULTADO);
    return desde != null && Date.now() - desde < DOZE_MESES_MS;
  } catch {
    return false;
  }
}

// Explica a regra e oferece o consignado CLT (mesmos botões e continuação do fluxo do consignado).
async function responderFgtsJaConsultado(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Oi! Como você já fez a consulta do FGTS esse ano, não será possível fazer novamente agora. " +
      "A Caixa só permite o saque uma vez a cada 12 meses, contando da data do último saque."
  );
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Mas posso simular o *consignado CLT* para você, com o primeiro desconto apenas para *60 dias*. Quer simular?",
    BOTOES_OFERTA_CONSIGNADO
  );
  await db.setFluxoPasso(de, businessNumberId, "consignado_oferta");
  try {
    const tagId = await db.tagEncontrarOuCriar(businessNumberId, "Consignado CLT", "#15803D");
    await db.adicionarTagConversa(businessNumberId, de, tagId, "automatico");
  } catch (err) {
    console.error("Erro ao adicionar tag do consignado:", err.message);
  }
}

// Extraído da opção "5" do menu principal pra poder ser chamado direto — sem passar pelo menu
// inteiro primeiro — quando a pessoa já escreve "fgts"/"saque" na primeira mensagem (ver
// checagem em processarEntry, mesmo espírito da palavra-chave "menu"). Mesmo texto/fluxo já
// usado no Instagram (autorizar a J17, depois mandar o CPF) — consistência entre os dois canais,
// ver INSTAGRAM_OPCOES_MENU.
const TEXTO_PERGUNTA_JA_SACOU =
  "Antes de começar: o saque do FGTS só pode ser feito *uma vez por ano*. Você já sacou este ano?";
const BOTOES_JA_SACOU = [
  { id: "fgts_sacou_sim", title: "Sim, já saquei" },
  { id: "fgts_sacou_nao", title: "Não sacei" },
  { id: "fgts_sacou_nao_lembro", title: "Não lembro" },
];
const TEXTO_AUTORIZAR_J17 =
  "Para fazer a simulação do saque do FGTS, é necessário autorizar a *J17* lá no aplicativo do FGTS " +
  "(Meu FGTS > Autorizações). Depois de autorizar, é só me mandar o seu CPF que a gente já parte " +
  "pro atendimento. 😊";

async function iniciarFluxoFgtsMenu(de, businessNumberId) {
  if (await fgtsJaConsultado(de, businessNumberId)) return responderFgtsJaConsultado(de, businessNumberId);
  // Felizcred e Campanha CLT: pergunta logo no início se já sacou este ano, para não gastar atendente com quem não pode.
  if (NUMEROS_CONSIGNADO.includes(businessNumberId)) {
    await enviarRespostaAutomatica(businessNumberId, de, TEXTO_PERGUNTA_JA_SACOU, BOTOES_JA_SACOU);
    await db.setFluxoPasso(de, businessNumberId, "fgts_sacou");
    return;
  }
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    TEXTO_AUTORIZAR_J17 + "\n\n" +
      "*Atenção:* o saque do FGTS só pode ser feito uma vez por ano. Quem já sacou este ano não consegue " +
      "fazer de novo. Se você não lembra se já sacou, é só me avisar que eu te explico como conferir."
  );
  await db.setFluxoPasso(de, businessNumberId, "fgts_cpf");
}

// Cliente que "não lembra" se já sacou no ano: ensina onde ver a data do último saque no app e espera a data.
// Quem não responde é encerrado (lembrete do passo fgts_data_saque) — muita gente só repete a consulta.
const REGEX_NAO_LEMBRA_SAQUE = /n[ãa]o\s+(me\s+)?(lembro|recordo|sei)|nem\s+lembro|esqueci/i;
const REGEX_DATA_SAQUE =
  /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b|\b\d{1,2}[\/.\-]\d{4}\b|\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s*(de\s+)?\d{2,4}\b/i;
const TEXTO_COMO_VER_DATA_SAQUE =
  "Tudo bem! Abra o aplicativo do FGTS, toque em *Mais* (no rodapé) e depois em *Empréstimos realizados*. " +
  "Lá aparece a data do seu último saque. Me informe essa data aqui, por favor. 😊\n\n" +
  "Lembrando: quem já sacou este ano não consegue fazer de novo.";
const TEXTO_RECEBEU_DATA_SAQUE =
  "Obrigado! Anotei a data do último saque. Agora é só aguardar que a gente confere e te responde por aqui. 😊";
const TEXTO_ENCERRA_SEM_DATA_SAQUE =
  "Como não recebi a data do último saque, vou encerrar este atendimento por aqui. " +
  "Quando tiver a data, é só me chamar de novo que a gente continua. 😊";

async function handlerDataSaqueFgts(de, businessNumberId, corpo) {
  if (REGEX_DATA_SAQUE.test(corpo)) {
    logFunil(businessNumberId, de, "fgts_data_saque_informada");
    await enviarRespostaAutomatica(businessNumberId, de, TEXTO_RECEBEU_DATA_SAQUE);
    await db.setFluxoPasso(de, businessNumberId, null);
    return;
  }
  if ((corpo.match(REGEX_CPF) || [])[0]) return handlerCapturaDadosFgts(de, businessNumberId, corpo);
  // Qualquer outra coisa: não repete a explicação, só continua esperando (e reinicia o relógio do encerramento).
  await db.setFluxoPasso(de, businessNumberId, "fgts_data_saque");
}

async function encerrarFgtsSemData(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, TEXTO_ENCERRA_SEM_DATA_SAQUE);
  await db.setFluxoPasso(de, businessNumberId, null);
  logFunil(businessNumberId, de, "fgts_encerrado_sem_data");
}

// Lista de produtos oferecida quando a revisão de FGTS não se aplica
// (título de linha tem limite de 24 caracteres — o nome completo vai na descrição)
const LISTA_PRODUTOS = {
  botao: "Ver opções",
  opcoes: [
    { id: "prod_clt", title: "CONSIGNADO CLT", description: "Empréstimo consignado CLT" },
    { id: "prod_inss", title: "CONSIGNADO INSS", description: "Empréstimo consignado INSS" },
    { id: "prod_fgts", title: "SAQUE-ANIVERSÁRIO FGTS", description: "Antecipação do saque-aniversário" },
    { id: "prod_carro", title: "CARRO EM GARANTIA", description: "Empréstimo com carro em garantia" },
    { id: "prod_seguro", title: "SEGURO VEICULAR", description: "Cotação de seguro para seu veículo" },
  ],
};

function PRODUTO_CONFIRMACAO(produto) {
  return (
    `Perfeito! Anotado: ${produto}. Um atendente vai falar com você em instantes para fazer a simulação.\n\n` +
    "Enquanto isso, conheça nosso site: www.felizcred.com.br"
  );
}

// ─── LEMBRETES PARA QUEM PARA NO MEIO DO FLUXO ──────────────────────────────
// Minutos de silêncio até mandar lembrete, por passo — um número manda só 1 toque (padrão
// de sempre); um array manda vários, cada um contado a partir de fluxo_passo_at (não é
// incremental do lembrete anterior, pra não acumular atraso). Qualquer mensagem nova da
// pessoa reresta o relógio E o contador de toques (ver db.setFluxoPasso/handlers de
// captura) — só quem fica em silêncio de verdade recebe o próximo toque.
// Quem clicou NUNCA TRABALHEI (gerente_nunca) fica de fora de propósito — decisão do usuário.
//
// clt_3mais e campanha_clt_dados usam 2 toques de propósito (15min + 4h): é o passo que
// mais perde lead (pedir 5 dados de uma vez assusta) e é onde a campanha paga por lead — os
// outros passos continuam com 1 toque só, sem mudar comportamento deles.
const LEMBRETE_MINUTOS = {
  menu_inicial: 15,
  fluxo_gerente: 15,
  gerente_trabalhou: 15,
  gerente_menos2: 15,
  gerente_mais2: 15,
  gerente_autorizo: 20,
  clt_pergunta_tempo: 15,
  clt_3mais: [15, 240],
  carro_garantia_dados: 15,
  financiamento_dados: 15,
  fgts_cpf: 15,
  fgts_data_saque: 60,
  campanha_clt_dados: [15, 240],
  cltorig_cpf: 15,
  cltorig_email: 15,
};

const LEMBRETE_TEXTOS = {
  gerente_autorizo:
    "Olá! Para entrar na agenda de atendimento do escritório parceiro, preciso do seu nome e da sua " +
    "cidade — é só responder aqui 😊",
  // menu_inicial é texto livre (não botão) — o lembrete padrão ("toque em uma das opções")
  // não se aplica aqui, por isso tem o seu próprio, sutil, sem pressionar.
  menu_inicial:
    "Olá! Vi que você parou no meio do atendimento 😊 Pra continuar, é só responder com o número da " +
    "opção (1 a 4) que te mandei ali em cima.",
  clt_pergunta_tempo:
    "Olá! Ainda por aí? 😊 Pra eu simular o consignado CLT, só preciso saber se você tem 3 meses ou " +
    "mais de carteira assinada no seu trabalho atual.",
  // 2 toques: o primeiro só lembra (mesmo texto de sempre); o segundo, 4h depois, muda de
  // abordagem — em vez de repetir o pedido de dados (não pede CPF de novo, fica pesado),
  // oferece um caminho mais fácil: falar com um atendente humano. Qualquer resposta a esse
  // 2º toque (não só "sim") é tratada como aceite e encaminha pro atendimento — ver
  // handlerCapturaDadosClt, que checa fluxo_lembrete >= 2. Nunca insiste 2x com o mesmo
  // texto — atendimento repetitivo é o padrão "agressivo" que queremos evitar.
  clt_3mais: [
    "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso desses dados 😊\n" +
      "Nome completo, CPF, telefone, e-mail e data de nascimento — pode mandar tudo numa mensagem só.",
    "Sem compromisso nenhum 😊 Você deseja falar com um atendente humano pra simular? É só responder " +
      "aqui que eu já te encaminho.",
  ],
  carro_garantia_dados:
    "Olá! Só lembrando que pra eu simular seu empréstimo com carro em garantia, preciso desses dados 😊\n" +
    "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
  financiamento_dados:
    "Olá! Só lembrando que pra eu simular o financiamento do seu veículo, preciso desses dados 😊\n" +
    "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
  fgts_cpf:
    "Olá! Só lembrando que pra eu simular o saque do FGTS, preciso do seu CPF 😊 (depois de você já ter " +
    "autorizado a J17 lá no aplicativo do FGTS).",
  cltorig_cpf: "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso do seu CPF 😊",
  cltorig_email: "Olá! Só lembrando que pra eu abrir sua solicitação de consignado CLT, preciso do seu e-mail 😊",
  campanha_clt_dados: [
    "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso desses dados 😊\n" +
      "Nome completo, CPF, telefone, e-mail e data de nascimento — pode mandar tudo numa mensagem só.",
    "Sem compromisso nenhum 😊 Você deseja falar com um atendente humano pra simular? É só responder " +
      "aqui que eu já te encaminho.",
  ],
  padrao:
    "Olá! Vi que você parou no meio do atendimento. Para continuar, é só tocar em uma das opções da " +
    "mensagem acima 👆",
  manter_janela: "Olá! Ainda por aí? É só responder aqui que a gente continua o atendimento 😊",
};

// Resposta quando a pessoa manda o nome/cidade (passo gerente_autorizo).
// No fim de semana avisa que o escritório parceiro escreve na segunda às 9h —
// assim não é preciso pagar template pra reabrir a conversa depois das 24h.
function confirmacaoAgenda() {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  const fimDeSemana = dia === "Sat" || dia === "Sun";
  return fimDeSemana
    ? "Perfeito, obrigado! Seus dados já entraram na agenda de atendimento. Na segunda-feira, às 9 horas, " +
      "o escritório parceiro irá enviar uma mensagem explicando como eles irão analisar o seu caso."
    : "Perfeito, obrigado! Seus dados já entraram na agenda de atendimento. O escritório parceiro irá " +
      "enviar uma mensagem explicando como eles irão analisar o seu caso.";
}

const FLUXO_BOTOES = {
  // Botões da oferta apresentada pelo verificador de originação FGTS (ver processarEtapaAbrindo).
  fgtsorig_contratar: handlerFgtsOrigContratar,
  fgtsorig_agora_nao: handlerFgtsOrigAgoraNao,
  // Botões da originação automática de consignado CLT (ver bloco CLT_ORIGINATION_ATIVO acima).
  cltorig_escolher_opcao: handlerCltOrigEscolherOpcao,
  cltorig_parcela_mais_baixa: handlerCltOrigParcelaMaisBaixa,
  cltorig_contratar: handlerCltOrigContratar,
  cltorig_agora_nao: handlerCltOrigAgoraNao,
  fluxo_gerente: {
    texto:
      "Olá! Vejo que você clicou no nosso anúncio direcionado para GERENTE/SUPERVISOR. " +
      "Preciso saber algumas informações antes de te direcionar ao atendimento especializado.",
    botoes: [
      { id: "gerente_trabalhou", title: "TRABALHO/TRABALHEI" },
      { id: "gerente_nunca", title: "NUNCA TRABALHEI" },
    ],
  },
  gerente_trabalhou: {
    texto:
      "Certo! Agora preciso saber: faz mais de 2 anos que você saiu do seu trabalho como GERENTE ou SUPERVISOR?",
    botoes: [
      { id: "gerente_menos2", title: "NÃO PASSOU 2 ANOS" },
      { id: "gerente_mais2", title: "FAZ MAIS DE 2 ANOS" },
    ],
  },
  gerente_menos2: {
    texto:
      "Ótimo! Acredito que você possa ter algum valor a receber. Nesse caso, para realizarmos uma análise técnica, " +
      "direcionamos o atendimento a um escritório de advocacia parceiro, especializado no assunto.\n\n" +
      "Caso deseje falar com eles de forma GRATUITA e tirar suas dúvidas, posso encaminhar seu contato.",
    botoes: [{ id: "gerente_autorizo", title: "AUTORIZO" }],
  },
  gerente_autorizo: {
    texto:
      "Qual é o seu nome e de qual cidade você fala?\n\n" +
      "Após informar, é só aguardar o contato deles — será através do número de WhatsApp (47) 99978-2256.",
  },
  gerente_mais2: {
    texto:
      "No seu caso, como já passou mais de 2 anos, o direito de reaver algum valor pendente infelizmente já " +
      "prescreveu. Mas ainda podemos simular outras opções para você — toque no botão abaixo e escolha:",
    lista: LISTA_PRODUTOS,
  },
  gerente_nunca: {
    texto:
      "Nesse caso, infelizmente não é possível verificar, pois a revisão só se aplica a quem trabalha ou já " +
      "trabalhou como gerente ou supervisor. Mas podemos simular outras opções para você — toque no botão " +
      "abaixo e escolha:",
    lista: LISTA_PRODUTOS,
  },
  // Escolhas da lista de produtos → confirma e passa pro atendimento humano
  prod_clt: encaminharCltParaSite,
  prod_inss: { texto: PRODUTO_CONFIRMACAO("o EMPRÉSTIMO CONSIGNADO INSS") },
  prod_fgts: async (de, businessNumberId) => {
    if (await fgtsJaConsultado(de, businessNumberId)) return responderFgtsJaConsultado(de, businessNumberId);
    await enviarRespostaAutomatica(businessNumberId, de, PRODUTO_CONFIRMACAO("o SAQUE-ANIVERSÁRIO FGTS"));
    await db.setFluxoPasso(de, businessNumberId, null);
  },
  prod_carro: { texto: PRODUTO_CONFIRMACAO("o EMPRÉSTIMO COM CARRO EM GARANTIA") },
  prod_seguro: { texto: PRODUTO_CONFIRMACAO("o SEGURO VEICULAR") },
  prod_financiamento: { texto: PRODUTO_CONFIRMACAO("o FINANCIAMENTO DE VEÍCULO") },
  // Resposta provisória — o fluxo completo do consignado CLT ainda vai ser definido
  fluxo_clt: {
    texto:
      "Perfeito! Para simular o consignado CLT, é só aguardar um instante que um atendente vai falar com você.\n\n" +
      "Enquanto isso, você pode conhecer nosso site: www.felizcred.com.br",
  },
  // Funil de Consignado CLT (12/08/2026) — resposta da qualificação de tempo de carteira
  // assinada, enviada por handlerMenuPrincipal (opção 1). Virou função (handlerCltTresMaisMeses)
  // em 26/09/2026 pra poder decidir entre a automação Unnotech (em standby) e o comportamento
  // manual de sempre (handlerCapturaDadosClt); clt_menos3 é terminal, sem mais nada esperado da
  // pessoa, continua igual.
  clt_3mais: handlerCltTresMaisMeses,
  clt_menos3: {
    texto:
      "Como você ainda não completou 3 meses no seu trabalho atual, não é possível simular agora. " +
      "Dá uma olhada no app da Carteira de Trabalho Digital pra conferir a data de admissão certinha " +
      "— no dia que completar os 3 meses, é só me chamar de novo que eu já simulo. 😊\n\n" +
      "Deixa meu contato salvo: aqui é o Felipe, pode me chamar sempre que precisar!",
  },
};

// CPF em qualquer formato (com ou sem pontuação) — sinal de "isso parece dado de verdade",
// não valida dígito verificador (não é o objetivo aqui).
const REGEX_CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/;
// E-mail — usado como sinal de conclusão nos funis de garantia/financiamento (não têm um
// campo tão identificável quanto o CPF, mas todos pedem e-mail no fim da lista).
const REGEX_EMAIL = /\S+@\S+\.\S+/;

// Dispara em paralelo ao atendimento humano assim que um funil termina de coletar dados e a
// mensagem tem um e-mail nela: cria o contato no Google Contacts (nome + telefone, já
// capturados antes, ver linha do webhook que lê contatos[].profile.name) e manda um e-mail de
// boas-vindas via Brevo. Roda em segundo plano (fire-and-forget) — nunca deve atrasar nem
// quebrar a resposta automática pro cliente no WhatsApp, por isso cada chamada externa tem seu
// próprio try/catch e a função inteira nunca lança. Marca contato_salvo_em ANTES de chamar as
// APIs externas pra não duplicar contato se a pessoa completar outro funil depois.
// `prefixo` identifica o funil na frente do nome só dentro do Google Contacts (ex. "CLT",
// "GARANTIA") — pedido do usuário pra distinguir os produtos dentro de um Google único, já
// que Felizcred (empréstimo) e Cota Certa (seguro) salvam contato na mesma conta Google. O
// e-mail de boas-vindas continua usando o nome puro (não faz sentido saudar "Olá, CLT João!").
async function capturarContatoEBoasVindas(de, businessNumberId, nome, email, prefixo) {
  try {
    await db.marcarContatoSalvo(de, businessNumberId, email);
  } catch (err) {
    console.error("Erro ao marcar contato salvo:", err.message);
    return; // sem marcar, melhor não tentar criar/enviar (evita duplicar numa corrida)
  }
  // Salva na conversa (não só no Google Contacts) pra reusar depois em retorno/campanha de
  // e-mail sem precisar pedir de novo — ver atualizarEmailConversa/retornos.
  db.atualizarEmailConversa(de, businessNumberId, email).catch((err) => console.error("Erro ao salvar e-mail na conversa:", err.message));
  try {
    const nomeGoogle = prefixo && nome ? `${prefixo} - ${nome}` : prefixo ? prefixo : nome;
    await google.criarContato({ nome: nomeGoogle, telefone: de, email });
  } catch (err) {
    console.error("Erro ao criar contato no Google:", err.message);
  }
  try {
    await enviarBoasVindasFelizcred({ nome, email });
  } catch (err) {
    console.error("Erro ao enviar e-mail de boas-vindas:", err.message);
  }
}

// Sincronização com o Google Contatos a cada mensagem recebida (fire-and-forget, nunca lança):
// se o telefone JÁ está salvo no Google, o nome do Google passa a ser o nome da conversa no
// painel (em todos os canais do mesmo telefone); se NÃO está, salva lá (nome do perfil do
// WhatsApp, ou só o telefone). Ciahot fica de fora — é outro negócio, não mistura com os
// contatos da Felizcred/Cota Certa. Sem Google configurado/autorizado, não faz nada.
const googleSyncIgnora = (businessNumberId) => businessNumberId === CIAHOT_NUMBER_ID;
// Regra do CPF: quem digita o CPF e ainda não está no Google Contatos é salvo como
// "FGTS <nome> <CPF>" (ou "FGTS <CPF>" quando não há nome). Vale pra campanha, site e qualquer entrada.
function extrairCpfDaMensagem(texto) {
  const candidatos = String(texto || "").match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/g) || [];
  return candidatos.map((c) => c.replace(/\D/g, "")).find((c) => novosaque.cpfValido(c)) || null;
}
function nomeContatoComCpf(cpf, nome) {
  const nomeLimpo = String(nome || "").trim();
  const nomeReal = nomeLimpo && !/^\+?[\d\s()-]+$/.test(nomeLimpo) ? nomeLimpo : "";
  return ["FGTS", nomeReal, cpf].filter(Boolean).join(" ");
}

async function sincronizarContatoGoogle(telefone, businessNumberId, nomePerfil, nomeNovo) {
  if (!google.configurado() || googleSyncIgnora(businessNumberId)) return;
  try {
    const r = await google.garantirContato({ telefone, nomePerfil: nomeNovo || nomePerfil });
    if (!r) return;
    if (r.resourceName) db.salvarGoogleContactResourceName(telefone, businessNumberId, r.resourceName).catch(() => {});
    if (r.existente && r.nome) {
      await db.renomearConversa(telefone, businessNumberId, r.nome);
      await db.propagarIdentidadeContato(telefone, businessNumberId, { nome: r.nome });
    }
  } catch (err) {
    console.error("Erro ao sincronizar contato com o Google:", err.message);
  }
}

// Confirmação de dados recebidos + aviso de horário — reaproveitada pelos funis que pedem
// dados e entregam pro atendimento humano (CLT, carro em garantia, financiamento, FGTS).
// `corpo` é a mensagem que completou os dados — se tiver e-mail nela e ainda não tivermos
// salvo contato pra essa conversa, dispara capturarContatoEBoasVindas em paralelo. `prefixo`
// (ex. "CLT", "GARANTIA", "FINANC") é só pra identificar o funil no nome salvo no Google.
// `textoConfirmacao` é opcional — por padrão manda a mensagem genérica de sempre; fluxos que
// precisam de um texto próprio (ex.: Amigo Indicou) passam o deles, sempre com o aviso de fora
// do horário comercial anexado no final (mesma regra pra todo mundo).
async function confirmarDadosRecebidos(de, businessNumberId, corpo, prefixo, textoConfirmacao) {
  const email = (corpo || "").match(REGEX_EMAIL)?.[0]?.replace(/[.,;]+$/, "");
  if (email) {
    const conversa = await db.getConversation(de, businessNumberId);
    if (!conversa?.contato_salvo_em) {
      capturarContatoEBoasVindas(de, businessNumberId, conversa?.name, email, prefixo).catch(() => {});
    }
  }
  const texto =
    textoConfirmacao ||
    "Perfeito! ✅ Já anotei tudo, agora é só aguardar atendimento — em breve eu, Felipe, vou te responder " +
      "por aqui pra fazer sua simulação. 🙌";
  await enviarRespostaAutomatica(businessNumberId, de, texto + avisoForaHorarioCotaCerta());
  await db.setFluxoPasso(de, businessNumberId, null);
}

// Resposta de quem respondeu ao 2º toque do lembrete ("deseja falar com atendente humano pra
// simular?") sem mandar os dados — a pergunta já é sim/não, então qualquer resposta conta
// como aceite e encaminha, sem checar CPF. Ver handlerCapturaDadosClt/CampanhaClt.
async function confirmarEncaminhamentoHumano(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Perfeito! 😊 Já vou te colocar com um atendente — em breve eu, Felipe, te chamo por aqui pra fazer " +
      "sua simulação. 🙌" +
      avisoForaHorarioCotaCerta()
  );
  await db.setFluxoPasso(de, businessNumberId, null);
}

// Depois que a pessoa manda os dados pedidos em clt_3mais — confirma e libera pro
// atendimento humano (Felipe assume dali pra frente, com os dados já visíveis no
// histórico da conversa no painel).
//
// Antes confirmava QUALQUER texto como "dados recebidos" (bug real: testado em produção
// respondendo "Fgts" no passo de dados, e o bot confirmou como se fosse a simulação
// completa) — e reclamava na hora se a pessoa mandasse os 5 dados aos poucos, em mensagens
// separadas (ex.: só o nome primeiro), em vez de esperar. Agora: cada mensagem sem CPF só
// reseta o relógio do lembrete (fica quieto, sem incomodar) — só cobra de volta depois de um
// tempo sem novidade (LEMBRETE_TEXTOS.clt_3mais), nunca na hora.
async function handlerCapturaDadosClt(de, businessNumberId, corpo) {
  if (REGEX_CPF.test(corpo || "")) {
    logFunil(businessNumberId, de, "clt_dados_completos");
    await confirmarDadosRecebidos(de, businessNumberId, corpo, "CLT");
    return;
  }
  // Já mandamos os 2 toques (o 2º pergunta se quer falar com atendente humano) — qualquer
  // resposta aqui, mesmo sem CPF, conta como aceite e encaminha pro atendimento.
  const conversa = await db.getConversation(de, businessNumberId);
  if (Number(conversa?.fluxo_lembrete) >= 2) {
    await confirmarEncaminhamentoHumano(de, businessNumberId);
    return;
  }
  await db.setFluxoPasso(de, businessNumberId, "clt_3mais"); // reafirma o passo, reseta o lembrete
}

// Mesmo padrão do handlerCapturaDadosClt acima, mas passo próprio (campanha_clt_dados) pra
// quem respondeu à campanha do template oferta_consignado_clt — não reaproveita "clt_3mais"
// de propósito, senão essa conversa ficaria indistinguível de quem entrou pelo menu normal
// (mesmo passo, mesmo lembrete), o que ia contra o pedido de manter a campanha fora do fluxo
// já cadastrado do menu principal.
async function handlerCapturaDadosCampanhaClt(de, businessNumberId, corpo) {
  if (REGEX_CPF.test(corpo || "")) {
    logFunil(businessNumberId, de, "campanha_dados_completos");
    await confirmarDadosRecebidos(de, businessNumberId, corpo, "CLT");
    return;
  }
  const conversa = await db.getConversation(de, businessNumberId);
  if (Number(conversa?.fluxo_lembrete) >= 2) {
    await confirmarEncaminhamentoHumano(de, businessNumberId);
    return;
  }
  await db.setFluxoPasso(de, businessNumberId, "campanha_clt_dados");
}

// Mesmo padrão do CLT, mas pros funis de carro em garantia e financiamento — sinal de
// conclusão é achar um e-mail na mensagem (não têm CPF pedido). Fotos de documento não
// disparam nada aqui (capturaTexto só roda pra mensagem de texto) — ficam visíveis no
// histórico do painel pro Felipe conferir.
async function handlerCapturaDadosCarroGarantia(de, businessNumberId, corpo) {
  if (!REGEX_EMAIL.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "carro_garantia_dados");
    return;
  }
  await confirmarDadosRecebidos(de, businessNumberId, corpo, "GARANTIA");
}

async function handlerCapturaDadosFinanciamento(de, businessNumberId, corpo) {
  if (!REGEX_EMAIL.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "financiamento_dados");
    return;
  }
  await confirmarDadosRecebidos(de, businessNumberId, corpo, "FINANC");
}

const FGTSORIG_TEXTO_SEM_OFERTA = {
  autorizacao:
    "Não encontrei oferta disponível agora — provavelmente falta autorizar a J17 no app Meu " +
    "FGTS (Autorizações). Autoriza lá e manda 'menu' que eu tento de novo.",
  sem_saldo:
    "Pelo que vi, você já usou o saque-aniversário nos últimos 12 meses — a regra só permite " +
    "1 vez nesse período. Pode tentar de novo depois desse prazo.",
  desconhecido:
    "No momento não encontrei condições disponíveis pro seu FGTS. Se quiser, tenta de novo " +
    "mais tarde.",
};

// Chamada pelo verificador (setInterval mais abaixo) pra cada linha em etapa 'abrindo'. Consulta
// o status; se tiver oferta J17, apresenta valor/condições; se não tiver (ou só de outro banco),
// classifica o motivo e avisa o cliente, fechando a solicitação.
async function processarEtapaAbrindo(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (status.status === "OFFERS_AVAILABLE") {
    const completa = await unnotech.consultarSolicitacaoCompleta(row.application_id);
    const oferta = unnotech.filtrarOfertaJ17(completa.offers);
    if (!oferta) {
      await finalizarSemOferta(row, completa);
      return;
    }
    const parcela = oferta.installments?.[0]?.amount;
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      // Number(...) antes do toFixed — se a API mandar o valor como string (não documentado com
      // certeza), toFixed direto quebraria e travaria a linha em 'abrindo' pra sempre.
      `Simulação pronta! 🎉 Você tem *R$ ${Number(oferta.net_amount).toFixed(2)}* liberado, em ` +
        `${oferta.installments?.length || 0}x de R$ ${parcela ? Number(parcela).toFixed(2) : "-"}, taxa de ` +
        `${oferta.monthly_interest_rate}% ao mês. Quer contratar?`,
      [
        { id: "fgtsorig_contratar", title: "QUERO CONTRATAR" },
        { id: "fgtsorig_agora_nao", title: "AGORA NÃO" },
      ]
    );
    await db.fgtsOriginationAtualizar(row.id, {
      etapa: "oferta_apresentada",
      offer_id: oferta.offer_id,
      status_unnotech: status.status,
    });
    await db.setFluxoPasso(row.phone, row.business_number_id, "fgtsorig_oferta_apresentada");
  } else if (status.status === "NO_OFFERS" || status.status === "EXPIRED") {
    const completa = await unnotech.consultarSolicitacaoCompleta(row.application_id);
    await finalizarSemOferta(row, completa);
  } else if (Date.now() - Number(row.created_at) > FGTSORIG_PRAZO_OFERTA_MS) {
    // Achado na revisão final: sem limite de tempo, uma cotação presa num status desconhecido
    // (nem OFFERS_AVAILABLE, nem NO_OFFERS/EXPIRED) ficava sendo consultada a cada 30s pra
    // sempre, sem nunca avisar o cliente nem escalar. Cotação normal é rápida — passado o mesmo
    // prazo da validade da oferta (1h30 de folga), trata como falha técnica.
    await db.fgtsOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de cotação travada (linha #${row.id}):`, err.message);
    }
  } else {
    // Ainda QUOTING (ou outro estado intermediário) — só atualiza o status guardado, o
    // verificador tenta de novo no próximo ciclo.
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}

async function finalizarSemOferta(row, completa) {
  // Prioriza o motivo da PRÓPRIA J17 (é o único banco que importa aqui) — achado na revisão
  // final: pegava o motivo de qualquer cotação/oferta, então uma recusa de outro banco na
  // mesma cotação podia classificar a mensagem errado. Só cai pra "qualquer uma" se a J17
  // especificamente não tiver motivo registrado.
  const motivoTexto =
    completa.quotes?.find((q) => q.source === "J17" && q.reason)?.reason ||
    completa.offers?.find((o) => o.source === "J17" && o.rejection_reason)?.rejection_reason?.message ||
    completa.quotes?.find((q) => q.reason)?.reason ||
    completa.offers?.find((o) => o.rejection_reason)?.rejection_reason?.message ||
    "";
  const categoria = unnotech.classificarRecusa(motivoTexto);
  await enviarRespostaAutomatica(row.business_number_id, row.phone, FGTSORIG_TEXTO_SEM_OFERTA[categoria]);
  await db.fgtsOriginationAtualizar(row.id, { etapa: "sem_oferta" });
  await db.setFluxoPasso(row.phone, row.business_number_id, null);
}

// Ponto de entrada único pras origens de FGTS que JÁ chamam essa função: o menu padrão
// (handlerCapturaDadosFgts) e o fluxo do anúncio (handlerFgtsAnuncioCapturaCpf). O Instagram
// NÃO converge aqui — achado na revisão final, corrigindo uma suposição errada da spec/plano: o
// DM do Instagram roda em processarEntryInstagram, um caminho totalmente separado, que só manda
// "dados recebidos" (INSTAGRAM_DADOS_RECEBIDOS_MESSAGE) e nunca chama iniciarOriginacaoFgts —
// e nem poderia hoje sem mudança de produto, já que WhatsApp Flow (o formulário) não existe no
// Instagram. Quem pede FGTS pelo Instagram ainda cai no atendimento manual de sempre. Se já
// existir uma solicitação aberta pra esse contato (nas 2 origens que chamam isto), não abre
// outra — só confirma que já está em andamento.
// Oferta da Unnotech vale por 1h (ver spec) — dá folga até 1h30 antes de considerar uma
// solicitação parada em "oferta_apresentada"/"formulario" como abandonada de vez.
const FGTSORIG_PRAZO_OFERTA_MS = 90 * 60 * 1000;
// 'enviando_kyc' entra aqui também como rede de segurança: se o servidor cair bem no meio do
// processamento da submissão do Flow (reivindicado mas nunca terminou), essa etapa nunca é
// revisitada pelo verificador — sem isso, a linha ficaria travada aqui pra sempre.
const FGTSORIG_ETAPAS_COM_PRAZO = ["oferta_apresentada", "formulario", "enviando_kyc"];

async function iniciarOriginacaoFgts(de, businessNumberId, cpf) {
  if (unnotech.cpfValido(cpf)) await marcarFgtsConsultado(de, businessNumberId);
  if (!unnotech.cpfValido(cpf)) {
    // Achado na revisão final: REGEX_CPF só confere formato (11 dígitos), não dígito
    // verificador — sem essa checagem, um número de celular de 11 dígitos digitado por engano
    // abria solicitação de verdade na Unnotech, gastando cota (100/dia) à toa.
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Esse CPF não parece válido — confere os números e manda de novo, por favor. 😊"
    );
    return;
  }
  const existente = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  if (existente) {
    const expirada =
      FGTSORIG_ETAPAS_COM_PRAZO.includes(existente.etapa) &&
      Date.now() - Number(existente.updated_at) > FGTSORIG_PRAZO_OFERTA_MS;
    if (!expirada) {
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        "Você já tem uma simulação em andamento — já já eu te aviso por aqui assim que tiver novidade. 😊"
      );
      return;
    }
    // Achado na revisão final: sem isso, quem ignorasse a oferta ou abandonasse o formulário
    // ficava bloqueado PRA SEMPRE (a checagem acima nunca deixava simular de novo). Não trava
    // 'aguardando_assinatura'/'aguardando_pagamento' — esses legitimamente levam dias, e ali a
    // mensagem "já em andamento" é a resposta certa, não uma trava indevida.
    await db.fgtsOriginationAtualizar(existente.id, { etapa: "sem_oferta" });
    await db.setFluxoPasso(de, businessNumberId, null);
  }
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Já estou consultando seu FGTS, isso leva só um minutinho ⏳");
  try {
    const idempotencyKey = crypto.randomUUID();
    const app = await unnotech.criarSolicitacao(cpf, idempotencyKey);
    await db.fgtsOriginationCriar(de, businessNumberId, app.application_id, cpf, idempotencyKey);
  } catch (err) {
    console.error("Erro ao abrir solicitação FGTS na Unnotech:", err.message);
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}

// Envia o WhatsApp Flow de coleta de dados (formulário nativo) — o `flow_token` carrega o id da
// linha de fgts_origination, pra saber a qual solicitação a submissão pertence quando ela voltar
// (ver processarSubmissaoFormularioFgts).
async function enviarFormularioFgts(de, businessNumberId, row) {
  // Token aleatório (não o id sequencial) — achado na revisão final, ver comentário da migração
  // de flow_token em db.js.
  const flowToken = crypto.randomUUID();
  await db.fgtsOriginationAtualizar(row.id, { flow_token: flowToken });
  await wa.sendFlow(businessNumberId, de, {
    flowId: process.env.FGTS_FLOW_ID,
    flowToken,
    bodyText: "Show! Só preciso de mais alguns dados pra fechar a contratação. Toca no botão abaixo:",
    ctaText: "Preencher dados",
    screenId: "DADOS_PESSOAIS",
  });
}

// Depois do aceite, o proposal_uuid pode demorar um pouco pra aparecer no status — só busca a
// proposta quando ele já estiver lá. Manda o botão de assinatura assim que o signature_link
// vier preenchido (só 1 vez — controla isso checando se já tinha proposal_uuid salvo antes).
async function processarEtapaAguardandoAssinatura(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (!status.proposal_uuid) {
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
    return;
  }
  // proposal_uuid muda a cada nova tentativa de contratação (ex.: depois de um requote por
  // oferta expirada) — sempre atualiza, não só na primeira vez que aparece.
  if (row.proposal_uuid !== status.proposal_uuid) {
    await db.fgtsOriginationAtualizar(row.id, { proposal_uuid: status.proposal_uuid, status_unnotech: status.status });
  }
  if (status.status === "SIGNED" || status.status === "ENDORSED") {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Contrato assinado! 🎉 Agora é só aguardar o depósito — te aviso assim que cair na sua conta."
    );
    await db.fgtsOriginationAtualizar(row.id, { etapa: "aguardando_pagamento", status_unnotech: status.status });
    return;
  }
  if (["CONTRACT_REJECTED", "FAILED", "REJECTED", "CANCELLED"].includes(status.status)) {
    // Estado no banco primeiro — mesmo cuidado do processarSubmissaoFormularioFgts: se o envio
    // falhar, a linha não pode ficar presa nessa etapa pro verificador tentar de novo a cada 30s
    // pra sempre.
    await db.fgtsOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema pra finalizar essa contratação. Vou te colocar com um atendente pra ver o que aconteceu."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente da recusa de contrato (linha #${row.id}):`, err.message);
    }
    return;
  }
  // Trava própria (coluna link_assinatura_enviado_em), não "já tinha proposal_uuid" — o
  // proposal_uuid costuma aparecer antes do signature_link (geração assíncrona), então a trava
  // antiga quase sempre dava como "já mandou" num tick em que o link ainda nem existia, e o
  // cliente nunca recebia o botão de assinar (achado na revisão final).
  if (row.link_assinatura_enviado_em) return;
  const proposta = await unnotech.consultarProposta(status.proposal_uuid);
  if (proposta.signature_link) {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Seu contrato está pronto! ✍️ Assim que você assinar, eu te aviso por aqui."
    );
    // texto de verdade no cta (nunca null) — mesmo padrão do resto do código (ex.:
    // handlerAmigoIndicouConhecer/handlerCiahotVisitarSite), a API do WhatsApp exige um body.text
    // não vazio numa mensagem de botão de link.
    await enviarRespostaAutomatica(row.business_number_id, row.phone, "Toque no botão abaixo pra assinar:", null, null, {
      buttonText: "Assinar contrato",
      url: proposta.signature_link,
    });
    await db.fgtsOriginationAtualizar(row.id, { link_assinatura_enviado_em: Date.now() });
  }
}

async function processarEtapaAguardandoPagamento(row) {
  const status = await unnotech.consultarStatus(row.application_id);
  if (status.status === "DISBURSED") {
    await enviarRespostaAutomatica(row.business_number_id, row.phone, "O valor já caiu! 💰 Qualquer coisa, é só me chamar.");
    await db.fgtsOriginationAtualizar(row.id, { etapa: "concluido", status_unnotech: status.status });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
  } else if (["FAILED", "REJECTED", "CANCELLED"].includes(status.status)) {
    // Achado na revisão final: essa etapa não tinha ramo nenhum de falha — uma averbação que dá
    // errado depois de assinado (existe, na prática) ficaria consultando pra sempre sem nunca
    // avisar o cliente nem escalar pra humano.
    await db.fgtsOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema depois da assinatura do seu contrato. Vou te colocar com um atendente pra resolver."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de falha pós-assinatura (linha #${row.id}):`, err.message);
    }
  } else {
    await db.fgtsOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}

async function processarSubmissaoFormularioFgts(flowToken, de, businessNumberId, dados) {
  if (!flowToken) return;
  const row = await db.fgtsOriginationBuscarPorFlowToken(flowToken);
  if (!row) return; // token desconhecido/reaproveitado, ignora
  // Confere que quem mandou a submissão é o mesmo contato da linha — achado na revisão final:
  // o /webhook não valida assinatura da Meta, então sem essa checagem um POST forjado (mesmo
  // com um flow_token válido roubado de outra conversa) podia trocar os dados bancários de
  // outra pessoa. Não é proteção contra tudo (ainda depende do token não vazar), mas fecha o
  // caso óbvio de usar o flow_token de um contato pra submeter em nome de outro.
  if (row.phone !== de || row.business_number_id !== businessNumberId) {
    console.error(`Submissão de Flow FGTS com remetente divergente da linha #${row.id} (esperado ${row.phone}, veio ${de}) — ignorada.`);
    return;
  }
  // Reivindicação atômica: só quem conseguir mudar a etapa de 'formulario' pra 'enviando_kyc'
  // segue — evita processar a MESMA submissão duas vezes se a Meta reentregar o webhook (achado
  // na revisão final; a checagem antiga só lia a etapa, sem travar contra corrida).
  const reivindicou = await db.fgtsOriginationReivindicar(row.id, "formulario", "enviando_kyc");
  if (!reivindicou) return; // já em processamento (ou já processado) por outra entrega do webhook
  // Tudo daqui pra baixo cai no catch de fora em qualquer falha técnica (KYC recusado, erro de
  // rede, 5xx) — achado na revisão final: antes só logava e o cliente ficava esperando pra
  // sempre, sem ninguém olhar de novo pra essa linha (o verificador só cobre 'abrindo',
  // 'aguardando_assinatura', 'aguardando_pagamento', nunca 'formulario'/'enviando_kyc').
  try {
    const kyc = unnotech.montarPayloadKyc(row.cpf, dados);
    await unnotech.enviarKyc(row.application_id, kyc);
    const idempotencyKey = crypto.randomUUID();
    try {
      await unnotech.aceitarOferta(row.application_id, row.offer_id, idempotencyKey);
    } catch (err) {
      // Formato exato do código de erro não confirmado ainda (item em aberto da spec) — casa
      // tanto por `err.codigo` quanto pelo texto da mensagem, pra não perder a detecção se a
      // Unnotech devolver num formato diferente do esperado.
      const expirou = err.codigo === "OFFER_EXPIRED" || /OFFER_EXPIRED/.test(err.message || "");
      if (expirou) {
        await unnotech.requotar(row.application_id, crypto.randomUUID());
        await enviarRespostaAutomatica(
          row.business_number_id,
          row.phone,
          "A oferta expirou enquanto você preenchia — já busquei uma nova simulação, só um instante..."
        );
        await db.fgtsOriginationAtualizar(row.id, { etapa: "abrindo", offer_id: null, idempotency_key_atual: idempotencyKey });
        return;
      }
      throw err;
    }
    // Estado no banco ANTES de avisar (achado na revisão da originação CLT, mesmo risco aqui:
    // se o aviso falhar depois do aceite já ter sido feito de verdade na Unnotech, a linha não
    // pode cair em 'erro' — senão o verificador para de acompanhar um contrato já em andamento).
    await db.fgtsOriginationAtualizar(row.id, { etapa: "aguardando_assinatura", idempotency_key_atual: idempotencyKey });
    // Fim da coleta de dados — daqui em diante o acompanhamento é só pelo verificador (etapa da
    // linha), não pela conversa; limpa o fluxo_passo pra não ficar preso em "fgtsorig_formulario"
    // (achado na revisão final: senão o lembrete de formulário abandonado dispararia errado
    // durante a espera de assinatura/pagamento).
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Perfeito, só um instante que já preparo seu contrato...");
    } catch (err) {
      console.error(`Erro ao avisar cliente do aceite FGTS (linha #${row.id}):`, err.message);
    }
  } catch (err) {
    console.error(`Erro ao processar formulário FGTS (linha #${row.id}):`, err.message);
    // Estado no banco primeiro, tentativa de aviso ao cliente depois — achado testando local:
    // se o envio de confirmarEncaminhamentoHumano também falhar (rede fora, por exemplo), sem
    // essa ordem a linha nunca chegava a virar 'erro' e ficava presa em 'enviando_kyc'.
    await db.fgtsOriginationAtualizar(row.id, { etapa: "erro" });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente do encaminhamento (linha #${row.id}):`, err2.message);
    }
  }
}

async function handlerFgtsOrigContratar(de, businessNumberId) {
  const row = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  // Botão fica clicável no histórico da conversa pra sempre — achado na revisão final: sem
  // checar a etapa, um clique tardio num "QUERO CONTRATAR" antigo (enquanto o pedido já estava
  // assinando ou aguardando pagamento) voltava a linha pra "formulario" e o verificador parava
  // de acompanhar assinatura/pagamento. Só reage se ainda estiver mesmo esperando essa decisão.
  if (!row || row.etapa !== "oferta_apresentada") return;
  await enviarFormularioFgts(de, businessNumberId, row);
  await db.fgtsOriginationAtualizar(row.id, { etapa: "formulario" });
  await db.setFluxoPasso(de, businessNumberId, "fgtsorig_formulario");
}

async function handlerFgtsOrigAgoraNao(de, businessNumberId) {
  const row = await db.fgtsOriginationBuscarAberta(de, businessNumberId);
  if (row && row.etapa !== "oferta_apresentada") return; // mesmo cuidado do handler acima
  await enviarRespostaAutomatica(businessNumberId, de, "Sem problemas! 😊 Fico à disposição se mudar de ideia.");
  await db.setFluxoPasso(de, businessNumberId, null);
  if (row) await db.fgtsOriginationAtualizar(row.id, { etapa: "sem_oferta" });
}

// ─── ORIGINAÇÃO AUTOMÁTICA DE CONSIGNADO CLT VIA UNNOTECH ──────────────────────────────────
// Ver docs/superpowers/specs/2026-09-26-clt-unnotech-design.md pro desenho completo. Mesmo
// papel que o bloco de FGTS acima (tabela própria clt_origination + verificador de 30s), mas
// com 3 portões que o FGTS não tem: autorização do trabalhador, consulta de margem por
// vínculo, e escolha entre parcela/valor líquido antes de simular.
//
// Trava de standby — a Unnotech ainda não liberou credencial de produção pro parceiro (mesma
// pendência que já bloqueia o FGTS). Enquanto false, "3 MESES OU MAIS" continua se comportando
// exatamente como hoje (pede os 5 dados em texto livre, atendimento humano). Pra ativar: (1)
// confirme que UNNOTECH_CLIENT_ID/UNNOTECH_CLIENT_SECRET são válidos, (2) publique
// flows/clt-cadastro.json no WhatsApp Manager → Flows e configure CLT_FLOW_ID, (3) troque esta
// constante pra true e faça o deploy — ver README, seção "Originação automática de consignado
// CLT via Unnotech".
const CLT_ORIGINATION_ATIVO = false;

const CLTORIG_TEXTO_TERMINAL = {
  autorizacao_indisponivel:
    "Não consegui confirmar sua autorização — pelo visto seu CPF ainda não está disponível pra " +
    "consulta na Carteira de Trabalho Digital agora. Se quiser, tenta de novo mais tarde ou fala " +
    "com um atendente.",
  sem_margem:
    "No momento você não tem margem disponível pra consignado CLT. Isso pode mudar mês a mês — " +
    "se quiser, tenta de novo depois.",
  desconhecido:
    "No momento não encontrei condições disponíveis pro seu consignado CLT. Se quiser, tenta de " +
    "novo mais tarde.",
};

async function finalizarCltSemOferta(row, categoria) {
  // Estado no banco ANTES de avisar (achado na revisão final: mandar a mensagem primeiro fazia
  // o verificador refazer a MESMA consulta e reenviar a MESMA mensagem a cada 30s pra sempre se
  // o envio falhasse por qualquer motivo — ex.: janela de 24h do WhatsApp fechada).
  await db.cltOriginationAtualizar(row.id, { etapa: "sem_oferta" });
  await db.setFluxoPasso(row.phone, row.business_number_id, null);
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      CLTORIG_TEXTO_TERMINAL[categoria] || CLTORIG_TEXTO_TERMINAL.desconhecido
    );
  } catch (err) {
    console.error(`Erro ao avisar cliente de encerramento sem oferta CLT (linha #${row.id}):`, err.message);
  }
}

// Prazo pra etapas que esperam uma resposta RÁPIDA do cliente (escolher vínculo, escolher base,
// digitar valor, decidir a oferta, preencher o formulário) — mesma folga de 1h30 já usada no
// FGTS. Inclui também os estados transitórios reivindicados (abrindo_solicitacao/
// simulando_pendente/retentando_oferta) como rede de segurança contra um crash no meio do
// processamento (mesmo espírito de 'enviando_kyc' no FGTS).
const CLTORIG_PRAZO_MS = 90 * 60 * 1000;
const CLTORIG_ETAPAS_COM_PRAZO_CURTO = [
  "aguardando_email",
  "abrindo_solicitacao",
  "escolhendo_vinculo",
  "simulando_pendente",
  "apresentando_prazos",
  "escolhendo_prazo",
  "aguardando_valor",
  "oferta_apresentada",
  "formulario",
  "enviando_kyc",
  "retentando_oferta",
];
// 'aguardando_autorizacao' tem prazo PRÓPRIO, bem mais longo — achado na revisão final: a
// versão anterior não expirava essa etapa nunca, então quem nunca assinasse o termo (uma fração
// grande dos leads, esperado) ficava bloqueado PRA SEMPRE de tentar de novo (toda nova tentativa
// de CPF caía em "já em andamento"). Assinar o termo é ação do cliente fora do nosso controle,
// mas não é infinita — 72h é generoso sem travar o lead pro resto da vida.
const CLTORIG_PRAZO_AUTORIZACAO_MS = 72 * 60 * 60 * 1000;
// Pós-assinatura/pagamento — processos do banco (averbação, liquidação) podem legitimamente
// levar alguns dias úteis; 5 dias de folga antes de escalar como travado (achado na revisão
// final: as etapas de assinatura/pagamento não tinham NENHUM teto pra status desconhecido).
const CLTORIG_PRAZO_LONGO_MS = 5 * 24 * 60 * 60 * 1000;
// A consulta de margem tem retentativa automática do lado da Unnotech por até 30min (ver guia)
// — 45min de folga antes de tratar como travada de vez.
const CLTORIG_PRAZO_MARGEM_MS = 45 * 60 * 1000;

// Mensagem (e passo de captura de texto, se houver um esperando) pra quem manda o CPF de novo
// enquanto já tem uma solicitação em andamento — achado na revisão final: a versão anterior
// respondia "já em andamento" pra QUALQUER etapa, mesmo nas que literalmente esperam uma ação
// do próprio cliente (escolher vínculo, digitar valor, decidir a oferta...), e nunca corrigia o
// fluxo_passo, então a próxima mensagem da pessoa podia cair no lugar errado.
const CLTORIG_ETAPA_REENTRADA = {
  escolhendo_vinculo: { texto: "Ainda esperando você escolher o vínculo na lista que te mandei ali acima 😊", passo: null },
  apresentando_prazos: { texto: "Ainda esperando você escolher uma opção ou pedir uma parcela mais baixa, nos botões que te mandei ali acima 😊", passo: null },
  escolhendo_prazo: { texto: "Ainda esperando você escolher o prazo na lista que te mandei ali acima 😊", passo: null },
  aguardando_valor: { texto: "Ainda esperando você me mandar o valor — pode mandar só o número? 😊", passo: "cltorig_valor" },
  oferta_apresentada: { texto: "Já te mandei sua oferta ali acima — toca em QUERO CONTRATAR ou AGORA NÃO 😊", passo: null },
  formulario: { texto: "Ainda esperando você preencher o formulário que te mandei ali acima 😊", passo: null },
};

// Extrai um valor em reais de texto livre. Achado na revisão final: a versão anterior tratava
// QUALQUER ponto como separador decimal — "3.000" (do jeito que brasileiro digita 3 mil) virava
// 3, não 3000. Ponto seguido de exatamente 3 dígitos até o fim do número (sem vírgula no meio) é
// separador de milhar, nunca decimal; "2 mil"/"3 mil reais" também é reconhecido. Undefined/null
// se não achar nada que pareça número (a mensagem tem que COMEÇAR com um dígito de verdade —
// "R$. 500" não confundia mais o "." solto com o número).
function extrairValorReais(texto) {
  const t = String(texto || "");
  const m = t.match(/\d[\d.,]*/);
  if (!m) return null;
  const s = m[0];
  let n;
  if (s.includes(",")) {
    n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    n = parseFloat(s.replace(/\./g, ""));
  } else {
    n = parseFloat(s);
  }
  if (Number.isFinite(n) && /\bmil\b/i.test(t)) n *= 1000;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Clique em "3 MESES OU MAIS" — substitui o antigo passo declarativo (FLUXO_BOTOES.clt_3mais)
// por uma função pra poder decidir entre a automação nova e o comportamento manual de sempre.
async function handlerCltTresMaisMeses(de, businessNumberId) {
  if (CLT_ORIGINATION_ATIVO) {
    await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Pra eu simular, me manda o seu CPF, por favor 😊");
    await db.setFluxoPasso(de, businessNumberId, "cltorig_cpf");
    return;
  }
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Show! 😊 Pra simular preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só:\n" +
      "• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento"
  );
  await db.setFluxoPasso(de, businessNumberId, "clt_3mais");
}

// Rascunho (CPF) → e-mail → abre a solicitação de verdade. O CLT exige e-mail já na abertura
// (a FGTS não), então precisa desses 2 passos antes de existir application_id — ver
// cltOriginationCriarRascunho em db.js.
async function handlerCltOrigCapturaCpf(de, businessNumberId, corpo) {
  const cpfBruto = (corpo.match(REGEX_CPF) || [])[0];
  if (!cpfBruto) {
    await db.setFluxoPasso(de, businessNumberId, "cltorig_cpf"); // reafirma, reseta o lembrete
    return;
  }
  const cpf = cpfBruto.replace(/\D/g, "");
  if (!unnotech.cpfValido(cpf)) {
    await enviarRespostaAutomatica(businessNumberId, de, "Esse CPF não parece válido — confere os números e manda de novo, por favor. 😊");
    return;
  }
  const existente = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (existente) {
    const prazoAplicavel =
      existente.etapa === "aguardando_autorizacao"
        ? CLTORIG_PRAZO_AUTORIZACAO_MS
        : CLTORIG_ETAPAS_COM_PRAZO_CURTO.includes(existente.etapa)
        ? CLTORIG_PRAZO_MS
        : null; // 'aguardando_pagamento' etc — sem prazo aqui, essas legitimamente levam dias
    const expirada =
      prazoAplicavel !== null && Date.now() - Number(existente.etapa_em || existente.updated_at) > prazoAplicavel;
    if (!expirada) {
      if (existente.etapa === "aguardando_email") {
        // Corrige o CPF sem trocar de etapa — permite corrigir um typo sem esperar o prazo
        // inteiro (achado na revisão final).
        await db.cltOriginationAtualizar(existente.id, { cpf });
        await enviarRespostaAutomatica(businessNumberId, de, "CPF atualizado! Agora me manda seu e-mail, por favor 😊");
        await db.setFluxoPasso(de, businessNumberId, "cltorig_email");
        return;
      }
      if (existente.etapa === "aguardando_autorizacao") {
        const linkTexto = existente.consent_url ? `\n${existente.consent_url}` : "";
        await enviarRespostaAutomatica(businessNumberId, de, `Ainda esperando você assinar o termo de autorização.${linkTexto}`);
        return;
      }
      const info = CLTORIG_ETAPA_REENTRADA[existente.etapa];
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        info?.texto ||
          "Você já tem uma simulação de consignado CLT em andamento — já já eu te aviso por aqui assim que tiver novidade. 😊"
      );
      await db.setFluxoPasso(de, businessNumberId, info?.passo ?? null);
      return;
    }
    await db.cltOriginationAtualizar(existente.id, { etapa: "sem_oferta" });
  }
  await db.cltOriginationCriarRascunho(de, businessNumberId, cpf);
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Agora me manda seu e-mail, por favor 😊");
  await db.setFluxoPasso(de, businessNumberId, "cltorig_email");
}

async function handlerCltOrigCapturaEmail(de, businessNumberId, corpo) {
  const email = (corpo.match(REGEX_EMAIL) || [])[0]?.replace(/[.,;]+$/, "");
  if (!email) {
    await db.setFluxoPasso(de, businessNumberId, "cltorig_email");
    return;
  }
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row) {
    // Sessão perdida entre as 2 mensagens (ex.: reinício do servidor) — pede pra recomeçar em
    // vez de travar em silêncio.
    await enviarRespostaAutomatica(businessNumberId, de, "Deu uma falha aqui do meu lado — pode mandar seu CPF de novo pra eu recomeçar? 🙏");
    await db.setFluxoPasso(de, businessNumberId, "cltorig_cpf");
    return;
  }
  // Reivindicação atômica antes de chamar a Unnotech (achado na revisão final: sem isso, uma
  // reentrega do mesmo webhook pela Meta, ou o cliente mandando o e-mail 2x rápido, abria 2
  // solicitações de verdade na Unnotech pra mesma pessoa).
  const reivindicou = await db.cltOriginationReivindicar(row.id, "aguardando_email", "abrindo_solicitacao");
  if (!reivindicou) return;
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Só um instante enquanto eu abro sua solicitação... ⏳");
  try {
    const idempotencyKey = crypto.randomUUID();
    const telefone = de.replace(/\D/g, "");
    const app = await unnotech.criarSolicitacaoClt(row.cpf, telefone, email, idempotencyKey);
    const consentUrl = app.authorization?.consent_url || null;
    await db.cltOriginationAtualizar(row.id, {
      application_id: app.application_id,
      etapa: "aguardando_autorizacao",
      idempotency_key_atual: idempotencyKey,
      consent_url: consentUrl,
    });
    // Guarda contra consent_url ausente (achado na revisão final: sem isso, uma resposta sem o
    // link virava "assine:\nundefined" pro cliente).
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      consentUrl
        ? `Para verificar a disponibilidade é preciso autorizar a consulta. Clique no link abaixo para fazer ` +
            `a autorização:\n${consentUrl}\n\nAssim que autorizar, eu continuo automaticamente por aqui. 😊`
        : "Para verificar a disponibilidade é preciso autorizar a consulta — já já eu te mando o link. 😊"
    );
    await db.setFluxoPasso(de, businessNumberId, null);
  } catch (err) {
    console.error("Erro ao abrir solicitação CLT na Unnotech:", err.message);
    await db.cltOriginationAtualizar(row.id, { etapa: "erro" });
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}

async function processarEtapaCltAguardandoAutorizacao(row) {
  const status = await unnotech.consultarStatusClt(row.application_id);
  if (status.authorization_status === "AUTHORIZED") {
    await db.cltOriginationAtualizar(row.id, { etapa: "consultando_margem", status_unnotech: status.status });
    return;
  }
  // Achado na revisão final: só checava NOT_AVAILABLE — se o `status` geral da solicitação
  // virasse EXPIRED/CANCELLED/FAILED por qualquer motivo do lado da Unnotech, a linha continuava
  // sendo consultada pra sempre (o teto de tempo abaixo cobre o resto, mas um status terminal
  // conhecido não precisa esperar o prazo inteiro).
  if (status.authorization_status === "NOT_AVAILABLE" || ["EXPIRED", "CANCELLED", "FAILED"].includes(status.status)) {
    await finalizarCltSemOferta(row, "autorizacao_indisponivel");
    return;
  }
  if (Date.now() - Number(row.etapa_em || row.created_at) > CLTORIG_PRAZO_AUTORIZACAO_MS) {
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de autorização travada (linha CLT #${row.id}):`, err.message);
    }
    return;
  }
  await db.cltOriginationAtualizar(row.id, { status_unnotech: status.status });
}

// Depois de escolher/receber o vínculo (1 só ou escolhido numa lista), já simula automaticamente
// no valor MÁXIMO de parcela permitido (a margem inteira) — pedido do usuário: não pergunta mais
// "parcela ou valor líquido" antes, o cliente já vê de cara o que cabe no salário dele, com a
// opção de pedir um valor mais baixo depois (ver processarEtapaCltSimulando/
// handlerCltOrigParcelaMaisBaixa). Reivindicação atômica a partir da etapa de ORIGEM (que varia:
// 'consultando_margem' quando só tem 1 vínculo, 'escolhendo_vinculo' quando veio de uma lista) —
// mesmo cuidado contra reentrega de webhook que os outros passos automáticos já têm.
async function prosseguirComVinculoClt(row, vinculo) {
  const margem = Number(vinculo.available_margin || 0);
  if (margem <= 0) {
    await finalizarCltSemOferta(row, "sem_margem");
    return;
  }
  const reivindicou = await db.cltOriginationReivindicar(row.id, row.etapa, "simulando_pendente");
  if (!reivindicou) return;
  await db.cltOriginationAtualizar(row.id, {
    employment_id: vinculo.employment_id,
    margem_disponivel: margem,
  });
  try {
    const idempotencyKey = crypto.randomUUID();
    await unnotech.simularClt(row.application_id, { employmentId: vinculo.employment_id, basis: "INSTALLMENT", valor: margem }, idempotencyKey);
    await db.cltOriginationAtualizar(row.id, { basis: "INSTALLMENT", valor_desejado: margem, etapa: "simulando", idempotency_key_atual: idempotencyKey });
  } catch (err) {
    console.error(`Erro ao simular CLT no valor máximo (linha #${row.id}):`, err.message);
    await db.cltOriginationAtualizar(row.id, { etapa: "erro" });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente (linha CLT #${row.id}):`, err2.message);
    }
  }
}

async function processarEtapaCltConsultandoMargem(row) {
  const status = await unnotech.consultarStatusClt(row.application_id);
  if (status.status === "NO_MARGIN") {
    await finalizarCltSemOferta(row, "sem_margem");
    return;
  }
  if (["EXPIRED", "CANCELLED", "FAILED"].includes(status.status)) {
    await finalizarCltSemOferta(row, "desconhecido");
    return;
  }
  if (status.status !== "AWAITING_SIMULATION") {
    // Ainda processando (MARGIN_QUERY ou outro status intermediário) — achado na revisão final:
    // a versão anterior só media o prazo quando o status era LITERALMENTE "MARGIN_QUERY"; se a
    // API devolvesse qualquer outro status intermediário não mapeado, o relógio de 45min nunca
    // rodava e a linha ficava consultando pra sempre.
    if (Date.now() - Number(row.etapa_em || row.created_at) > CLTORIG_PRAZO_MARGEM_MS) {
      await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
      try {
        await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
      } catch (err) {
        console.error(`Erro ao avisar cliente de consulta de margem travada (linha CLT #${row.id}):`, err.message);
      }
      return;
    }
    await db.cltOriginationAtualizar(row.id, { status_unnotech: status.status });
    return;
  }
  const margem = await unnotech.consultarMargemClt(row.application_id);
  const vinculos = margem.employments || [];
  if (!vinculos.length) {
    await finalizarCltSemOferta(row, "sem_margem");
    return;
  }
  if (vinculos.length === 1) {
    await db.cltOriginationAtualizar(row.id, { employments_cache: JSON.stringify(vinculos), status_unnotech: status.status });
    await prosseguirComVinculoClt(row, vinculos[0]);
    return;
  }
  // Lista limitada a 10 (limite do WhatsApp) — ordena pelas maiores margens primeiro pra não
  // esconder os melhores vínculos de quem tiver mais de 10 (achado na revisão final).
  const ordenados = [...vinculos].sort((a, b) => Number(b.available_margin || 0) - Number(a.available_margin || 0));
  // Estado no banco ANTES de mandar a lista (achado na revisão final: mandar primeiro fazia o
  // verificador refazer a MESMA consulta de margem e reenviar a MESMA lista a cada 30s se o
  // envio falhasse por qualquer motivo).
  await db.cltOriginationAtualizar(row.id, {
    employments_cache: JSON.stringify(vinculos),
    status_unnotech: status.status,
    etapa: "escolhendo_vinculo",
  });
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Encontrei mais de um vínculo de trabalho no seu nome — qual você quer usar pra simular?",
      null,
      {
        botao: "Escolher vínculo",
        opcoes: ordenados.slice(0, 10).map((v, i) => ({
          id: `cltorig_vinculo_${v.employment_id}`,
          title: (v.employer_name || `Vínculo ${i + 1}`).slice(0, 24),
          description: `Margem disponível: R$ ${Number(v.available_margin || 0).toFixed(2)}`,
        })),
      }
    );
  } catch (err) {
    console.error(`Erro ao mandar lista de vínculos CLT (linha #${row.id}):`, err.message);
  }
}

// Clique numa linha da lista de vínculos — id dinâmico ("cltorig_vinculo_<employment_id>"), por
// isso não é um botão estático registrado em FLUXO_BOTOES (ver despacho no webhook).
async function handlerCltOrigEscolherVinculo(de, businessNumberId, employmentId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "escolhendo_vinculo") return;
  let vinculos = [];
  try {
    vinculos = JSON.parse(row.employments_cache || "[]");
  } catch {
    vinculos = [];
  }
  // String() dos dois lados (achado na revisão final: employmentId vem sempre como string do
  // id do botão, mas nada garante que a API devolve employment_id como string também — uma
  // comparação estrita ia deixar a pessoa travada em silêncio se viesse número).
  const vinculo = vinculos.find((v) => String(v.employment_id) === employmentId);
  if (!vinculo) return;
  await prosseguirComVinculoClt(row, vinculo);
}

// Pedido do cliente (ao vivo, sem digitar valor ainda) pra pagar menos que o máximo — só
// pergunta o número, a simulação de verdade acontece em handlerCltOrigCapturaValor.
async function handlerCltOrigParcelaMaisBaixa(de, businessNumberId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "apresentando_prazos") return;
  await db.cltOriginationAtualizar(row.id, { etapa: "aguardando_valor" });
  await enviarRespostaAutomatica(businessNumberId, de, "Quanto você quer pagar de parcela por mês? Me manda só o número (ex.: 300).");
  await db.setFluxoPasso(de, businessNumberId, "cltorig_valor");
}

async function handlerCltOrigCapturaValor(de, businessNumberId, corpo) {
  const valor = extrairValorReais(corpo);
  if (!valor) {
    // Achado na revisão final: quando não reconhecia nenhum valor, a versão anterior não
    // mandava mensagem nenhuma (só resetava o passo) — quem digitasse algo que não parecesse
    // número ficava em silêncio total, sem saber o que fazer.
    await enviarRespostaAutomatica(businessNumberId, de, "Não consegui entender esse valor — me manda só o número, por favor (ex.: 300 ou 3000). 😊");
    await db.setFluxoPasso(de, businessNumberId, "cltorig_valor");
    return;
  }
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "aguardando_valor") return;
  if (row.margem_disponivel && valor > Number(row.margem_disponivel)) {
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      `Esse valor passa da sua margem disponível (R$ ${Number(row.margem_disponivel).toFixed(2)} por mês). ` +
        "Me manda um valor de parcela até esse limite, por favor."
    );
    await db.setFluxoPasso(de, businessNumberId, "cltorig_valor");
    return;
  }
  // Reivindicação atômica (achado na revisão final: mesmo risco de duplo-processamento do
  // e-mail — mensagem repetida/reentregue podia disparar 2 simulações pro mesmo pedido).
  const reivindicou = await db.cltOriginationReivindicar(row.id, "aguardando_valor", "simulando_pendente");
  if (!reivindicou) return;
  await enviarRespostaAutomatica(businessNumberId, de, "Simulando... isso leva só um minutinho ⏳");
  try {
    const idempotencyKey = crypto.randomUUID();
    await unnotech.simularClt(row.application_id, { employmentId: row.employment_id, basis: "INSTALLMENT", valor }, idempotencyKey);
    await db.cltOriginationAtualizar(row.id, { valor_desejado: valor, etapa: "simulando", idempotency_key_atual: idempotencyKey });
    await db.setFluxoPasso(de, businessNumberId, null);
  } catch (err) {
    if (err.codigo === "INSTALLMENT_EXCEEDS_MARGIN" || /INSTALLMENT_EXCEEDS_MARGIN/.test(err.message || "")) {
      // Volta pra 'aguardando_valor' (tínhamos reivindicado 'simulando_pendente' acima) —
      // achado na revisão final: sem isso a linha ficava presa nesse estado transitório.
      const maxTexto = row.margem_disponivel ? ` (limite: R$ ${Number(row.margem_disponivel).toFixed(2)} por mês)` : "";
      await enviarRespostaAutomatica(businessNumberId, de, `Esse valor passa da sua margem disponível${maxTexto} — me manda um valor de parcela menor, por favor.`);
      await db.cltOriginationAtualizar(row.id, { etapa: "aguardando_valor" });
      await db.setFluxoPasso(de, businessNumberId, "cltorig_valor");
      return;
    }
    console.error("Erro ao simular CLT:", err.message);
    await db.cltOriginationAtualizar(row.id, { etapa: "erro" });
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}

// Mantém só a MELHOR oferta (a primeira, já que offers[] vem ordenada por net_amount desc — ver
// unnotech.escolherMelhorOferta) por prazo distinto — pra parcela fixa, cada bancarizadora/tabela
// pode topar um número de parcelas diferente, e o cliente escolhe entre elas (pedido do usuário:
// mostrar "12x/24x/36x" em vez de só a melhor condição isolada). Ordenado do prazo mais curto pro
// mais longo — ordem de leitura natural, não a ordem de "melhor oferta" da API.
function ofertasPorPrazoClt(offers) {
  const vistos = new Set();
  const unicas = [];
  for (const o of offers || []) {
    if (o.status !== "AVAILABLE") continue;
    if (vistos.has(o.installment_count)) continue;
    vistos.add(o.installment_count);
    unicas.push(o);
  }
  return unicas.sort((a, b) => Number(a.installment_count) - Number(b.installment_count));
}

// Confirmação final de UMA oferta específica (a única do menu, ou a que o cliente escolheu na
// lista de prazos) — mesma mensagem/botões de sempre, reaproveitada pelos 2 caminhos.
async function apresentarOfertaEscolhidaClt(row, oferta) {
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      `Simulação pronta! 🎉 Você tem *R$ ${Number(oferta.net_amount).toFixed(2)}* liberado, em ` +
        `${oferta.installment_count}x de R$ ${Number(oferta.installment_amount).toFixed(2)}, taxa de ` +
        `${oferta.monthly_interest_rate}% ao mês. Quer contratar?`,
      [
        { id: "cltorig_contratar", title: "QUERO CONTRATAR" },
        { id: "cltorig_agora_nao", title: "AGORA NÃO" },
      ]
    );
  } catch (err) {
    console.error(`Erro ao apresentar oferta CLT escolhida (linha #${row.id}):`, err.message);
  }
  await db.cltOriginationAtualizar(row.id, {
    etapa: "oferta_apresentada",
    offer_id: oferta.offer_id,
    tentativas_offer_ids: JSON.stringify([]),
  });
  await db.setFluxoPasso(row.phone, row.business_number_id, "cltorig_oferta_apresentada");
}

async function processarEtapaCltSimulando(row) {
  const status = await unnotech.consultarStatusClt(row.application_id);
  // Achado na revisão final: reagir a OFFERS_AVAILABLE sem checar quotes_pending podia ler um
  // menu PARCIAL (a primeira bancarizadora respondeu, as outras ainda estão cotando) — a doc é
  // clara que essa etapa espera quotes_pending chegar a 0.
  if (status.status === "OFFERS_AVAILABLE" && Number(status.quotes_pending || 0) === 0) {
    const completa = await unnotech.consultarSolicitacaoCompletaClt(row.application_id);
    const porPrazo = ofertasPorPrazoClt(completa.offers);
    if (!porPrazo.length) {
      await finalizarCltSemOferta(row, "desconhecido");
      return;
    }
    await db.cltOriginationAtualizar(row.id, { offers_cache: JSON.stringify(completa.offers || []), status_unnotech: status.status });
    if (porPrazo.length === 1) {
      await apresentarOfertaEscolhidaClt(row, porPrazo[0]);
      return;
    }
    // Mais de um prazo aprovado — pedido do usuário: primeiro uma mensagem informativa com o
    // "cardápio" (sem botão), depois a explicação de desembolso/primeiro desconto, só então a
    // pergunta com os botões de ação.
    const ehPrimeiraSimulacao = Number(row.valor_desejado || 0) >= Number(row.margem_disponivel || 0);
    try {
      const linhas = porPrazo.map((o) => `${o.installment_count}x de R$ ${Number(o.net_amount).toFixed(2)}`).join("\n");
      await enviarRespostaAutomatica(row.business_number_id, row.phone, `Tenho aprovado pra você:\n${linhas}`);
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Esse valor é liberado em até 40 minutos na sua conta, via PIX. O primeiro desconto só acontece " +
          "depois de 60 dias, direto no seu salário."
      );
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        ehPrimeiraSimulacao
          ? `Sua parcela máxima permitida é de R$ ${Number(row.margem_disponivel).toFixed(2)} por mês. Você quer ` +
              "contratar com uma dessas opções ou prefere simular um valor de parcela mais baixo?"
          : "Você quer contratar com uma dessas opções ou prefere simular um valor ainda mais baixo?",
        [
          { id: "cltorig_escolher_opcao", title: "ESCOLHER UMA OPÇÃO" },
          { id: "cltorig_parcela_mais_baixa", title: "PARCELA MAIS BAIXA" },
        ]
      );
    } catch (err) {
      console.error(`Erro ao apresentar cardápio de prazos CLT (linha #${row.id}):`, err.message);
    }
    await db.cltOriginationAtualizar(row.id, { etapa: "apresentando_prazos" });
  } else if (status.status === "NO_OFFERS" || status.status === "EXPIRED") {
    await finalizarCltSemOferta(row, "desconhecido");
  } else if (Date.now() - Number(row.etapa_em || row.created_at) > CLTORIG_PRAZO_MS) {
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de cotação CLT travada (linha #${row.id}):`, err.message);
    }
  } else {
    await db.cltOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}

// Clique em "ESCOLHER UMA OPÇÃO" — manda a lista dos prazos já calculados (do offers_cache,
// sem chamar a Unnotech de novo).
async function handlerCltOrigEscolherOpcao(de, businessNumberId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "apresentando_prazos") return;
  let ofertas = [];
  try {
    ofertas = JSON.parse(row.offers_cache || "[]");
  } catch {
    ofertas = [];
  }
  const porPrazo = ofertasPorPrazoClt(ofertas);
  if (!porPrazo.length) return; // não deveria acontecer (só chega aqui com >=2 prazos), rede de segurança
  await db.cltOriginationAtualizar(row.id, { etapa: "escolhendo_prazo" });
  try {
    await enviarRespostaAutomatica(businessNumberId, de, "Qual prazo você quer?", null, {
      botao: "Escolher prazo",
      opcoes: porPrazo.map((o) => ({
        id: `cltorig_prazo_${o.offer_id}`,
        title: `${o.installment_count}x de R$ ${Number(o.installment_amount).toFixed(2)}`,
        description: `Você recebe R$ ${Number(o.net_amount).toFixed(2)}`,
      })),
    });
  } catch (err) {
    console.error(`Erro ao mandar lista de prazos CLT (linha #${row.id}):`, err.message);
  }
}

// Clique numa linha da lista de prazos — id dinâmico ("cltorig_prazo_<offer_id>"), por isso não
// é um botão estático em FLUXO_BOTOES (mesmo padrão de cltorig_vinculo_*, ver despacho no webhook).
async function handlerCltOrigEscolherPrazo(de, businessNumberId, offerId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "escolhendo_prazo") return;
  let ofertas = [];
  try {
    ofertas = JSON.parse(row.offers_cache || "[]");
  } catch {
    ofertas = [];
  }
  const oferta = ofertas.find((o) => o.offer_id === offerId);
  if (!oferta) return;
  await apresentarOfertaEscolhidaClt(row, oferta);
}

async function handlerCltOrigContratar(de, businessNumberId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "oferta_apresentada") return;
  const flowToken = crypto.randomUUID();
  try {
    // Manda o Flow ANTES de gravar a etapa (achado na revisão final: a ordem inversa deixava a
    // linha travada em 'formulario' pra sempre se o envio falhasse — ex.: CLT_FLOW_ID errado ou
    // Flow não publicado — porque a guarda de etapa acima passa a ignorar um 2º clique).
    await wa.sendFlow(businessNumberId, de, {
      flowId: process.env.CLT_FLOW_ID,
      flowToken,
      bodyText: "Show! Só preciso de mais alguns dados pra fechar a contratação. Toca no botão abaixo:",
      ctaText: "Preencher dados",
      screenId: "DADOS_PESSOAIS",
    });
  } catch (err) {
    console.error(`Erro ao enviar Flow CLT (linha #${row.id}):`, err.message);
    try {
      // Achado na revisão final da integração Novo Saque (mesma lição, aplicada aqui também):
      // sem isso, o cliente clica em QUERO CONTRATAR e não recebe nada.
      await enviarRespostaAutomatica(businessNumberId, de, "Deu um probleminha aqui pra abrir o formulário — pode tocar em QUERO CONTRATAR de novo, por favor? 🙏");
    } catch (err2) {
      console.error(`Erro ao avisar cliente da falha de Flow CLT (linha #${row.id}):`, err2.message);
    }
    return;
  }
  await db.cltOriginationAtualizar(row.id, { flow_token: flowToken, etapa: "formulario" });
  await db.setFluxoPasso(de, businessNumberId, "cltorig_formulario");
}

async function handlerCltOrigAgoraNao(de, businessNumberId) {
  const row = await db.cltOriginationBuscarAberta(de, businessNumberId);
  if (row && row.etapa !== "oferta_apresentada") return;
  await enviarRespostaAutomatica(businessNumberId, de, "Sem problemas! 😊 Fico à disposição se mudar de ideia.");
  await db.setFluxoPasso(de, businessNumberId, null);
  if (row) await db.cltOriginationAtualizar(row.id, { etapa: "sem_oferta" });
}

async function processarSubmissaoFormularioClt(flowToken, de, businessNumberId, dados) {
  if (!flowToken) return;
  const row = await db.cltOriginationBuscarPorFlowToken(flowToken);
  if (!row) return;
  if (row.phone !== de || row.business_number_id !== businessNumberId) {
    console.error(`Submissão de Flow CLT com remetente divergente da linha #${row.id} (esperado ${row.phone}, veio ${de}) — ignorada.`);
    return;
  }
  const reivindicou = await db.cltOriginationReivindicar(row.id, "formulario", "enviando_kyc");
  if (!reivindicou) return;
  try {
    const kyc = unnotech.montarPayloadKycClt(row.cpf, dados);
    await unnotech.enviarKycClt(row.application_id, kyc);
    const idempotencyKeyAceite = crypto.randomUUID();
    try {
      await unnotech.aceitarOfertaClt(row.application_id, row.offer_id, idempotencyKeyAceite);
    } catch (err) {
      const expirou = err.codigo === "OFFER_EXPIRED" || /OFFER_EXPIRED/.test(err.message || "");
      if (expirou) {
        // Sem endpoint de "requote" no CLT (a doc é explícita) — a única forma de renovar o menu
        // é simular de novo com os mesmos parâmetros já escolhidos (vínculo, base, valor). Chave
        // de idempotência NOVA (achado na revisão final: reaproveitar a do /accept que acabou de
        // falhar arriscava a Unnotech tratar como replay daquela chamada, não como simulação nova).
        const idempotencyKeySimulacao = crypto.randomUUID();
        await unnotech.simularClt(
          row.application_id,
          { employmentId: row.employment_id, basis: row.basis, valor: row.valor_desejado },
          idempotencyKeySimulacao
        );
        await db.cltOriginationAtualizar(row.id, { etapa: "simulando", offer_id: null, idempotency_key_atual: idempotencyKeySimulacao });
        try {
          await enviarRespostaAutomatica(
            row.business_number_id,
            row.phone,
            "A oferta expirou enquanto você preenchia — já busquei uma nova simulação, só um instante..."
          );
        } catch (err2) {
          console.error(`Erro ao avisar cliente de reoferta CLT (linha #${row.id}):`, err2.message);
        }
        return;
      }
      throw err;
    }
    // Estado no banco ANTES de avisar o cliente (achado na revisão final: se o aviso falhar
    // depois do aceite já ter sido feito de verdade na Unnotech, a linha não pode cair em 'erro'
    // — senão o verificador para de acompanhar um contrato que já está em andamento de verdade).
    await db.cltOriginationAtualizar(row.id, { etapa: "aguardando_assinatura", idempotency_key_atual: idempotencyKeyAceite });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Perfeito, só um instante que já preparo seu contrato...");
    } catch (err) {
      console.error(`Erro ao avisar cliente do aceite CLT (linha #${row.id}):`, err.message);
    }
  } catch (err) {
    console.error(`Erro ao processar formulário CLT (linha #${row.id}):`, err.message);
    await db.cltOriginationAtualizar(row.id, { etapa: "erro" });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente do encaminhamento CLT (linha #${row.id}):`, err2.message);
    }
  }
}

// Diferente do FGTS, CONTRACT_REJECTED não é terminal aqui (a doc é explícita: aceitando outra
// oferta do mesmo menu a solicitação volta a CONTRACTING) — tenta a próxima oferta elegível
// automaticamente, sem precisar pedir nada de novo ao cliente (o KYC já está salvo na
// Unnotech). Só escala pro humano quando esgotar o menu inteiro.
async function processarEtapaCltAguardandoAssinatura(row) {
  const status = await unnotech.consultarStatusClt(row.application_id);
  if (status.status === "CONTRACT_REJECTED") {
    // Reivindicação atômica ANTES de tentar a próxima oferta — achado na revisão final: sem
    // isso, se o aceite anterior ainda não tivesse "pegado" do lado da Unnotech quando o próximo
    // tick rodasse, dois ticks liam CONTRACT_REJECTED em sequência e aceitavam 2 ofertas
    // diferentes, queimando o menu à toa.
    const reivindicou = await db.cltOriginationReivindicar(row.id, "aguardando_assinatura", "retentando_oferta");
    if (!reivindicou) return; // outro tick já está tratando essa recusa
    await tratarOfertaRecusadaClt(row);
    return;
  }
  if (!status.proposal_uuid) {
    // Achado na revisão final: essa etapa não tinha teto de tempo nenhum pra status que não é
    // nem CONTRACT_REJECTED nem terminal — um estado inesperado travava pra sempre.
    if (Date.now() - Number(row.etapa_em || row.created_at) > CLTORIG_PRAZO_LONGO_MS) {
      await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
      try {
        await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
      } catch (err) {
        console.error(`Erro ao avisar cliente de assinatura travada CLT (linha #${row.id}):`, err.message);
      }
      return;
    }
    await db.cltOriginationAtualizar(row.id, { status_unnotech: status.status });
    return;
  }
  if (row.proposal_uuid !== status.proposal_uuid) {
    await db.cltOriginationAtualizar(row.id, { proposal_uuid: status.proposal_uuid, status_unnotech: status.status });
  }
  if (status.status === "SIGNED" || status.status === "ENDORSED") {
    // Estado no banco antes do aviso (achado na revisão final, mesmo padrão do resto do bloco).
    await db.cltOriginationAtualizar(row.id, { etapa: "aguardando_pagamento", status_unnotech: status.status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Contrato assinado! 🎉 Agora é só aguardar a averbação e o depósito — te aviso assim que cair na sua conta."
      );
    } catch (err) {
      console.error(`Erro ao avisar cliente de assinatura CLT (linha #${row.id}):`, err.message);
    }
    return;
  }
  if (["FAILED", "REJECTED", "CANCELLED"].includes(status.status)) {
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema pra finalizar essa contratação. Vou te colocar com um atendente pra ver o que aconteceu."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente da recusa de contrato CLT (linha #${row.id}):`, err.message);
    }
    return;
  }
  if (row.link_assinatura_enviado_em) return;
  const proposta = await unnotech.consultarProposta(status.proposal_uuid);
  if (proposta.signature_link) {
    await db.cltOriginationAtualizar(row.id, { link_assinatura_enviado_em: Date.now() });
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Seu contrato está pronto! ✍️ Assim que você assinar, eu te aviso por aqui.");
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Toque no botão abaixo pra assinar:", null, null, {
        buttonText: "Assinar contrato",
        url: proposta.signature_link,
      });
    } catch (err) {
      console.error(`Erro ao mandar link de assinatura CLT (linha #${row.id}):`, err.message);
    }
  }
}

// Extraído de processarEtapaCltAguardandoAssinatura pra rodar só depois da reivindicação
// atômica (ver comentário lá). Busca o menu de ofertas AO VIVO — achado na revisão final: usar
// o offers_cache (a foto tirada no momento da simulação) pra escolher a próxima tentativa é
// arriscado, porque na hora da recusa a Unnotech já reavaliou KYC/crédito, e o `expires_at`
// daquela foto provavelmente já passou — o offers_cache é só ATUALIZADO com o menu novo, nunca
// mais usado como fonte pra escolher.
async function tratarOfertaRecusadaClt(row) {
  let tentadas = [];
  try {
    tentadas = JSON.parse(row.tentativas_offer_ids || "[]");
  } catch {
    tentadas = [];
  }
  if (row.offer_id && !tentadas.includes(row.offer_id)) tentadas.push(row.offer_id);
  let ofertasVivas;
  try {
    const completa = await unnotech.consultarSolicitacaoCompletaClt(row.application_id);
    ofertasVivas = completa.offers || [];
  } catch (err) {
    console.error(`Erro ao rebuscar ofertas CLT após recusa (linha #${row.id}):`, err.message);
    // Volta pra 'aguardando_assinatura' (reivindicamos 'retentando_oferta' antes de chamar esta
    // função) — tenta de novo no próximo tick, sem perder o registro do que já foi tentado.
    await db.cltOriginationAtualizar(row.id, { etapa: "aguardando_assinatura", tentativas_offer_ids: JSON.stringify(tentadas) });
    return;
  }
  const proxima = unnotech.escolherMelhorOferta(ofertasVivas, tentadas);
  if (!proxima) {
    // 'sem_oferta' (não 'erro') — recusa de todo o menu é desfecho de negócio, não falha técnica.
    await db.cltOriginationAtualizar(row.id, { etapa: "sem_oferta", tentativas_offer_ids: JSON.stringify(tentadas) });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Nenhuma das ofertas foi aprovada pelos bancos. Vou te colocar com um atendente pra ver outras opções."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de recusa total CLT (linha #${row.id}):`, err.message);
    }
    return;
  }
  try {
    const idempotencyKey = crypto.randomUUID();
    await unnotech.aceitarOfertaClt(row.application_id, proxima.offer_id, idempotencyKey);
    // Zera proposal_uuid/link — a nova aceitação gera uma proposta NOVA (achado na revisão
    // final: sem isso, a trava "já mandei o link" impedia mandar o link do CONTRATO NOVO, e o
    // cliente ficava só com o link do contrato já recusado).
    await db.cltOriginationAtualizar(row.id, {
      etapa: "aguardando_assinatura",
      offer_id: proxima.offer_id,
      offers_cache: JSON.stringify(ofertasVivas),
      tentativas_offer_ids: JSON.stringify(tentadas),
      idempotency_key_atual: idempotencyKey,
      proposal_uuid: null,
      link_assinatura_enviado_em: null,
    });
    try {
      // Achado na revisão final (ruling amendado): a oferta nova pode ter termos diferentes da
      // que o cliente aceitou antes (valor, parcela, taxa, até banco) — avisar em vez de trocar
      // em silêncio.
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        `A oferta anterior não foi aprovada pelo banco, mas encontrei outra opção: *R$ ${Number(proxima.net_amount).toFixed(2)}* ` +
          `liberado, em ${proxima.installment_count}x de R$ ${Number(proxima.installment_amount).toFixed(2)}, taxa de ` +
          `${proxima.monthly_interest_rate}% ao mês. Vou seguir com essa — se preferir não continuar, é só me avisar. 😊`
      );
    } catch (err) {
      console.error(`Erro ao avisar cliente da nova oferta CLT (linha #${row.id}):`, err.message);
    }
  } catch (err) {
    console.error(`Erro ao tentar próxima oferta CLT (linha #${row.id}):`, err.message);
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", tentativas_offer_ids: JSON.stringify(tentadas) });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente (linha CLT #${row.id}):`, err2.message);
    }
  }
}

async function processarEtapaCltAguardandoPagamento(row) {
  const status = await unnotech.consultarStatusClt(row.application_id);
  if (status.status === "DISBURSED") {
    await db.cltOriginationAtualizar(row.id, { etapa: "concluido", status_unnotech: status.status });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "O valor já caiu! 💰 Qualquer coisa, é só me chamar.");
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento CLT (linha #${row.id}):`, err.message);
    }
  } else if (["FAILED", "REJECTED", "CANCELLED"].includes(status.status)) {
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema depois da assinatura do seu contrato. Vou te colocar com um atendente pra resolver."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de falha pós-assinatura CLT (linha #${row.id}):`, err.message);
    }
  } else if (Date.now() - Number(row.etapa_em || row.created_at) > CLTORIG_PRAZO_LONGO_MS) {
    // Achado na revisão final: essa etapa também não tinha teto de tempo nenhum.
    await db.cltOriginationAtualizar(row.id, { etapa: "erro", status_unnotech: status.status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento travado CLT (linha #${row.id}):`, err.message);
    }
  } else {
    await db.cltOriginationAtualizar(row.id, { status_unnotech: status.status });
  }
}

// ─── ORIGINAÇÃO AUTOMÁTICA DE CONSIGNADO CLT VIA NOVO SAQUE ────────────────────────────────
// 2º banco integrado (01/10/2026) — a Unnotech segue em standby esperando a credencial dela
// (ver bloco acima); essa é uma integração nova e INDEPENDENTE, testada ponta a ponta contra o
// sandbox real da Novo Saque (não só a doc — ver
// docs/superpowers/specs/2026-10-01-novosaque-clt-design.md). Fluxo mais enxuto que o da
// Unnotech: só o CPF abre a simulação (sem e-mail antes), e não tem portão de "escolher
// vínculo"/"escolher base de simulação" — a 1ª simulação já sai pronta sozinha depois da
// autorização, confirmado ao vivo.
//
// Entrada: botão "Simulação" do fluxo arquivado FLUXO_CAMPANHA_CLT (ver
// handlerCampanhaCLTSimular mais abaixo) — é o pitch de "consignado já aprovado" já desenhado
// pro número Campanha CLT, só que esse fluxo está ARQUIVADO hoje (o número roda a campanha
// ativa de Indicação FGTS no lugar, ver FLUXOS_POR_NUMERO/escolherVarianteCampanhaCLT). Ativar
// essa automação NÃO reativa sozinho o FLUXO_CAMPANHA_CLT — são 2 decisões separadas de
// propósito, pra não trocar o destino de tráfego pago ao vivo sem confirmação explícita.
// Standby operacional: no momento, somente a Facta origina propostas automaticamente.
const NOVOSAQUE_ORIGINATION_ATIVO = false;

const NSORIG_TEXTO_TERMINAL = {
  sem_margem:
    "No momento você não tem margem disponível pra consignado CLT. Isso pode mudar mês a mês — " +
    "se quiser, tenta de novo depois.",
  desconhecido:
    "No momento não encontrei condições disponíveis pro seu consignado CLT. Se quiser, tenta de " +
    "novo mais tarde.",
};

async function finalizarNsSemOferta(row, categoria) {
  await db.novosaqueOriginationAtualizar(row.id, { etapa: "sem_oferta" });
  await db.setFluxoPasso(row.phone, row.business_number_id, null);
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      NSORIG_TEXTO_TERMINAL[categoria] || NSORIG_TEXTO_TERMINAL.desconhecido
    );
  } catch (err) {
    console.error(`Erro ao avisar cliente de encerramento sem oferta Novo Saque (linha #${row.id}):`, err.message);
  }
}

const NSORIG_PRAZO_MS = 90 * 60 * 1000; // etapas de resposta rápida do cliente
// Consentimento é ação do cliente fora do nosso controle (pode levar dias) — mesma folga de
// 72h já usada na Unnotech, mesmo raciocínio (ver spec do CLT/Unnotech).
const NSORIG_PRAZO_AUTORIZACAO_MS = 72 * 60 * 60 * 1000;
// Pós-assinatura/pagamento — averbação e liquidação bancária podem legitimamente levar dias.
const NSORIG_PRAZO_LONGO_MS = 5 * 24 * 60 * 60 * 1000;

const NSORIG_ETAPAS_COM_PRAZO_CURTO = [
  "abrindo",
  "oferta_apresentada",
  "aguardando_valor",
  "simulando_pendente",
  "formulario",
  "enviando_kyc",
];

const NSORIG_ETAPA_REENTRADA = {
  oferta_apresentada: { texto: "Já te mandei sua oferta ali acima — toca em QUERO CONTRATAR ou PARCELA MAIS BAIXA 😊", passo: null },
  aguardando_valor: { texto: "Ainda esperando você me mandar o valor — pode mandar só o número? 😊", passo: "nsorig_valor" },
  formulario: { texto: "Ainda esperando você preencher o formulário que te mandei ali acima 😊", passo: null },
};

// Varre sub-resultados da Novo Saque que são TERMINAIS de verdade quando success:false —
// achado testando ao vivo: um erro real de validação (ccb_creation_result, "insurance_amount -
// must be less than 1500") não aparece em "stage"/"summary_status", só dentro do sub-objeto.
// Achado na revisão final: a lista original incluía campos que têm um caminho PRÓPRIO e mais
// amigável em outro lugar do código (balance_check_result → "Offer unavailable"/margem,
// disbursement_result → "Payment returned") — escanear esses aqui também corria o risco de
// disparar o encaminhamento genérico ANTES da mensagem certa rodar, ou de dar falso positivo
// num sub-objeto que legitimamente começa "success: false" antes da etapa dele nem ter
// rodado ainda. E os 3 campos "*_send_result" são o envio de link por e-mail/SMS que a PRÓPRIA
// Novo Saque faz (a gente já manda o link pelo WhatsApp de qualquer jeito) — uma falha ali não
// é motivo pra abortar um contrato válido.
function falhaNovoSaque(contract) {
  const campos = ["ccb_creation_result", "signature_result", "signature_submission_result", "registry_result", "disbursement_reprocessing_result"];
  for (const campo of campos) {
    const r = contract[campo];
    if (r && r.success === false) {
      // reason nem sempre é array (achado na revisão final) — Array.isArray antes do join, senão
      // um formato inesperado derruba a checagem inteira (e trava a linha, já que o catch de
      // fora só loga e não deixa o teto de tempo rodar).
      const motivo = Array.isArray(r.reason) ? r.reason.join("; ") : r.reason || r.error || "falha desconhecida";
      return `${campo}: ${motivo}`;
    }
  }
  return null;
}

// Tolerância pra confirmar que uma simulação é a RESPOSTA do pedido de "parcela mais baixa", não
// a oferta antiga ainda em cache do lado da Novo Saque — achado na revisão final: nada garante
// que GET logo depois de um PUT já reflete o valor novo (a doc não documenta isso), então sem
// essa checagem o cliente podia pedir uma parcela menor e receber de volta a oferta MAIOR de
// antes, sem perceber. `valorAlvo` null (1ª simulação, sem pedido de valor específico ainda)
// sempre passa.
function dentroDaToleranciaNs(oferta, valorAlvo) {
  if (!valorAlvo) return true;
  const diff = Math.abs(Number(oferta.installment_value || 0) - Number(valorAlvo));
  return diff <= Math.max(5, Number(valorAlvo) * 0.05);
}

// Volta pra 'oferta_apresentada' com a ÚLTIMA oferta boa conhecida (salva em oferta_cache toda
// vez que apresentarOfertaEscolhidaNs roda) — achado na revisão final: se um pedido de "parcela
// mais baixa" não achar nada (ou não conseguir confirmar que a simulação é a nova mesmo), a
// versão anterior simplesmente encerrava com "sem oferta", matando um negócio que continuava
// válido. Se o simulation_id antigo tiver sido invalidado do lado da Novo Saque nesse meio
// tempo, o pior caso é a formalização falhar depois e escalar pro humano — ainda melhor que
// encerrar na hora sem tentar.
async function voltarParaOfertaAnteriorNs(row, motivo) {
  let ofertaAnterior = null;
  try {
    ofertaAnterior = row.oferta_cache ? JSON.parse(row.oferta_cache) : null;
  } catch {
    ofertaAnterior = null;
  }
  if (!ofertaAnterior) {
    await finalizarNsSemOferta(row, "desconhecido");
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, {
    etapa: "oferta_apresentada",
    simulation_id: ofertaAnterior.simulation_id,
    valor_parcela: ofertaAnterior.installment_value,
  });
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      `${motivo} Sua oferta anterior continua valendo: *R$ ${Number(ofertaAnterior.disbursed_amount).toFixed(2)}* liberado, em ` +
        `${ofertaAnterior.installments}x de R$ ${Number(ofertaAnterior.installment_value).toFixed(2)}.`,
      [
        { id: "nsorig_contratar", title: "QUERO CONTRATAR" },
        { id: "nsorig_parcela_mais_baixa", title: "PARCELA MAIS BAIXA" },
      ]
    );
  } catch (err) {
    console.error(`Erro ao voltar pra oferta anterior Novo Saque (linha #${row.id}):`, err.message);
  }
  await db.setFluxoPasso(row.phone, row.business_number_id, "nsorig_oferta_apresentada");
}

async function handlerNsOrigCapturaCpf(de, businessNumberId, corpo) {
  const cpfBruto = (corpo.match(REGEX_CPF) || [])[0];
  if (!cpfBruto) {
    await db.setFluxoPasso(de, businessNumberId, "nsorig_cpf"); // reafirma, reseta o lembrete
    return;
  }
  const cpf = cpfBruto.replace(/\D/g, "");
  if (!novosaque.cpfValido(cpf)) {
    await enviarRespostaAutomatica(businessNumberId, de, "Esse CPF não parece válido — confere os números e manda de novo, por favor. 😊");
    return;
  }
  const existente = await db.novosaqueOriginationBuscarAberta(de, businessNumberId);
  if (existente) {
    const prazoAplicavel =
      existente.etapa === "aguardando_autorizacao"
        ? NSORIG_PRAZO_AUTORIZACAO_MS
        : NSORIG_ETAPAS_COM_PRAZO_CURTO.includes(existente.etapa)
        ? NSORIG_PRAZO_MS
        : null;
    const expirada =
      prazoAplicavel !== null && Date.now() - Number(existente.etapa_em || existente.updated_at) > prazoAplicavel;
    if (!expirada) {
      if (existente.etapa === "aguardando_autorizacao") {
        const linkTexto = existente.terms_link ? `\n${existente.terms_link}` : "";
        await enviarRespostaAutomatica(businessNumberId, de, `Ainda esperando você assinar o termo de autorização.${linkTexto}`);
        return;
      }
      const info = NSORIG_ETAPA_REENTRADA[existente.etapa];
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        info?.texto ||
          "Você já tem uma simulação de consignado CLT em andamento — já já eu te aviso por aqui assim que tiver novidade. 😊"
      );
      await db.setFluxoPasso(de, businessNumberId, info?.passo ?? null);
      return;
    }
    await db.novosaqueOriginationAtualizar(existente.id, { etapa: "sem_oferta" });
  }
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Só um instante enquanto eu abro sua simulação... ⏳");
  // Rascunho ANTES de chamar a API (achado na revisão final — ver comentário em
  // novosaqueOriginationCriarRascunho em db.js): fecha a janela de corrida de uma reentrega de
  // webhook ou mensagem duplicada abrindo 2 transações reais na Novo Saque pra mesma pessoa.
  const rascunhoId = await db.novosaqueOriginationCriarRascunho(de, businessNumberId, cpf);
  const ganhou = await db.novosaqueOriginationEhOMaisAntigoAberto(de, businessNumberId, rascunhoId);
  if (!ganhou) {
    // Outra mensagem (quase simultânea) já está processando esse mesmo pedido — essa desiste
    // em silêncio, sem mandar mensagem nenhuma (a outra já está cuidando da conversa).
    await db.novosaqueOriginationAtualizar(rascunhoId, { etapa: "sem_oferta" });
    return;
  }
  try {
    const transactionId = await novosaque.criarSimulacaoClt(cpf);
    await db.novosaqueOriginationAtualizar(rascunhoId, { transaction_id: transactionId, etapa: "aguardando_autorizacao" });
    await db.setFluxoPasso(de, businessNumberId, null);
    // O link de autorização ainda não existe nesse exato instante (achado ao vivo: leva alguns
    // segundos pra aparecer) — o verificador manda assim que aparecer (ver
    // processarEtapaNsAguardandoAutorizacao).
  } catch (err) {
    console.error("Erro ao abrir simulação CLT na Novo Saque:", err.message);
    await db.novosaqueOriginationAtualizar(rascunhoId, { etapa: "erro" });
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}

// Confirmação final de UMA oferta (normalmente só vem 1 tabela — ver escolherMelhorOferta em
// novosaque.js) — mesma mensagem/botões em qualquer caminho que chegar aqui (1ª simulação
// automática ou depois de pedir parcela mais baixa). Guarda a oferta em oferta_cache — ver
// voltarParaOfertaAnteriorNs.
async function apresentarOfertaEscolhidaNs(row, contract, oferta) {
  await db.novosaqueOriginationAtualizar(row.id, {
    etapa: "oferta_apresentada",
    simulation_id: oferta.simulation_id,
    valor_parcela: oferta.installment_value,
    oferta_cache: JSON.stringify(oferta),
    margem_disponivel: contract.balance_check_result?.balance_value ?? row.margem_disponivel,
    status_novosaque: contract.summary_status,
  });
  try {
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      `Tenho aprovado pra você: *R$ ${Number(oferta.disbursed_amount).toFixed(2)}* liberado, em ` +
        `${oferta.installments}x de R$ ${Number(oferta.installment_value).toFixed(2)}.`
    );
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Esse valor é liberado em até 40 minutos na sua conta, via PIX. O primeiro desconto só acontece " +
        "depois de 60 dias, direto no seu salário."
    );
    await enviarRespostaAutomatica(
      row.business_number_id,
      row.phone,
      "Quer contratar com esse valor ou prefere simular uma parcela mais baixa?",
      [
        { id: "nsorig_contratar", title: "QUERO CONTRATAR" },
        { id: "nsorig_parcela_mais_baixa", title: "PARCELA MAIS BAIXA" },
      ]
    );
  } catch (err) {
    console.error(`Erro ao apresentar oferta Novo Saque (linha #${row.id}):`, err.message);
  }
  await db.setFluxoPasso(row.phone, row.business_number_id, "nsorig_oferta_apresentada");
}

async function processarEtapaNsAguardandoAutorizacao(row) {
  let contract;
  try {
    contract = await novosaque.consultarContratoClt(row.transaction_id);
  } catch (err) {
    console.error(`Erro ao consultar contrato Novo Saque (linha #${row.id}):`, err.message);
    return;
  }
  // terms_link não vem na resposta da criação — leva alguns segundos pra aparecer (achado ao
  // vivo) — manda assim que a gente vir ele pela 1ª vez. Checado ANTES de qualquer outra coisa:
  // é sempre seguro mandar de novo (guard "!row.terms_link"), e não compete com nenhum outro
  // caminho.
  if (contract.terms_link && !row.terms_link) {
    await db.novosaqueOriginationAtualizar(row.id, { terms_link: contract.terms_link, status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        `Para verificar a disponibilidade é preciso autorizar a consulta. Clique no link abaixo para fazer ` +
          `a autorização:\n${contract.terms_link}\n\nAssim que autorizar, eu continuo automaticamente por aqui. 😊`
      );
    } catch (err) {
      console.error(`Erro ao avisar cliente do termo Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  // Margem indisponível — checado ANTES da varredura genérica de falha (achado na revisão
  // final: balance_check_result tem motivo PRÓPRIO de dar success:false sem ser um erro de
  // verdade, então ficou de fora de falhaNovoSaque; aqui cobrimos tanto o summary_status
  // explícito quanto uma margem zerada/negativa que a Novo Saque confirme sem marcar como
  // "Offer unavailable").
  const margem = contract.balance_check_result;
  if (contract.summary_status === "Offer unavailable" || (margem && margem.success === true && Number(margem.balance_value) <= 0)) {
    await finalizarNsSemOferta(row, "sem_margem");
    return;
  }
  const falha = falhaNovoSaque(contract);
  if (falha) {
    console.error(`Falha reportada pela Novo Saque (linha #${row.id}): ${falha}`);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente de falha Novo Saque (linha #${row.id}):`, err2.message);
    }
    return;
  }
  // Autorizado + margem + simulação prontas, tudo automático (achado ao vivo: a 1ª simulação
  // já sai sozinha depois da autorização, sem precisar pedir nada ao cliente). row.valor_parcela
  // ainda é null aqui (nenhum pedido de valor específico foi feito) — dentroDaToleranciaNs
  // sempre deixa passar nesse caso.
  const oferta = novosaque.escolherMelhorOferta(contract.simulation_results);
  if (oferta && dentroDaToleranciaNs(oferta, row.valor_parcela)) {
    await apresentarOfertaEscolhidaNs(row, contract, oferta);
    return;
  }
  if (Date.now() - Number(row.etapa_em || row.created_at) > NSORIG_PRAZO_AUTORIZACAO_MS) {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de autorização travada Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, {
    status_novosaque: contract.summary_status,
    margem_disponivel: margem?.balance_value ?? row.margem_disponivel,
  });
}

// Mesma lógica de processarEtapaNsAguardandoAutorizacao a partir do ponto "simulação pronta",
// usada depois de um pedido de parcela mais baixa (a autorização já tinha sido dada antes,
// então não precisa checar terms_link/margem de novo). Diferente dali: aqui row.valor_parcela
// JÁ tem o valor pedido, então dentroDaToleranciaNs entra em ação de verdade — e se o prazo
// estourar sem confirmar, volta pra oferta anterior em vez de encerrar (ver C1 da revisão final).
async function processarEtapaNsSimulando(row) {
  let contract;
  try {
    contract = await novosaque.consultarContratoClt(row.transaction_id);
  } catch (err) {
    console.error(`Erro ao consultar contrato Novo Saque (linha #${row.id}):`, err.message);
    return;
  }
  if (contract.summary_status === "Offer unavailable") {
    await voltarParaOfertaAnteriorNs(row, "Não encontrei uma condição pra esse valor.");
    return;
  }
  const falha = falhaNovoSaque(contract);
  if (falha) {
    console.error(`Falha reportada pela Novo Saque (linha #${row.id}): ${falha}`);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente de falha Novo Saque (linha #${row.id}):`, err2.message);
    }
    return;
  }
  const oferta = novosaque.escolherMelhorOferta(contract.simulation_results);
  if (oferta && dentroDaToleranciaNs(oferta, row.valor_parcela)) {
    await apresentarOfertaEscolhidaNs(row, contract, oferta);
    return;
  }
  if (Date.now() - Number(row.etapa_em || row.created_at) > NSORIG_PRAZO_MS) {
    await voltarParaOfertaAnteriorNs(row, "Não consegui confirmar uma condição nova pra esse valor.");
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, { status_novosaque: contract.summary_status });
}

async function handlerNsOrigParcelaMaisBaixa(de, businessNumberId) {
  const row = await db.novosaqueOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "oferta_apresentada") return;
  await db.novosaqueOriginationAtualizar(row.id, { etapa: "aguardando_valor" });
  await enviarRespostaAutomatica(businessNumberId, de, "Quanto você quer pagar de parcela por mês? Me manda só o número (ex.: 300).");
  await db.setFluxoPasso(de, businessNumberId, "nsorig_valor");
}

async function handlerNsOrigCapturaValor(de, businessNumberId, corpo) {
  const valor = extrairValorReais(corpo);
  if (!valor) {
    await enviarRespostaAutomatica(businessNumberId, de, "Não consegui entender esse valor — me manda só o número, por favor (ex.: 300). 😊");
    await db.setFluxoPasso(de, businessNumberId, "nsorig_valor");
    return;
  }
  const row = await db.novosaqueOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "aguardando_valor") return;
  if (row.margem_disponivel && valor > Number(row.margem_disponivel)) {
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      `Esse valor passa da sua margem disponível (R$ ${Number(row.margem_disponivel).toFixed(2)} por mês). ` +
        "Me manda um valor até esse limite, por favor."
    );
    await db.setFluxoPasso(de, businessNumberId, "nsorig_valor");
    return;
  }
  const reivindicou = await db.novosaqueOriginationReivindicar(row.id, "aguardando_valor", "simulando_pendente");
  if (!reivindicou) return;
  await enviarRespostaAutomatica(businessNumberId, de, "Simulando... isso leva só um minutinho ⏳");
  try {
    await novosaque.resimularClt(row.transaction_id, valor);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "simulando", valor_parcela: valor });
    await db.setFluxoPasso(de, businessNumberId, null);
  } catch (err) {
    console.error("Erro ao re-simular CLT na Novo Saque:", err.message);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro" });
    await confirmarEncaminhamentoHumano(de, businessNumberId);
  }
}

async function handlerNsOrigContratar(de, businessNumberId) {
  const row = await db.novosaqueOriginationBuscarAberta(de, businessNumberId);
  if (!row || row.etapa !== "oferta_apresentada") return;
  const flowToken = crypto.randomUUID();
  try {
    // Manda o Flow ANTES de gravar a etapa (mesmo cuidado já aprendido no CLT/Unnotech: se o
    // envio falhar, a linha fica em 'oferta_apresentada' e o cliente pode clicar de novo).
    await wa.sendFlow(businessNumberId, de, {
      flowId: process.env.NOVOSAQUE_FLOW_ID,
      flowToken,
      bodyText: "Show! Só preciso de mais alguns dados pra fechar a contratação. Toca no botão abaixo:",
      ctaText: "Preencher dados",
      screenId: "DADOS_PESSOAIS",
    });
  } catch (err) {
    console.error(`Erro ao enviar Flow Novo Saque (linha #${row.id}):`, err.message);
    try {
      // Achado na revisão final: sem isso, o cliente clica em QUERO CONTRATAR e não recebe
      // nada — a etapa fica em 'oferta_apresentada' (pode clicar de novo), mas em silêncio.
      await enviarRespostaAutomatica(businessNumberId, de, "Deu um probleminha aqui pra abrir o formulário — pode tocar em QUERO CONTRATAR de novo, por favor? 🙏");
    } catch (err2) {
      console.error(`Erro ao avisar cliente da falha de Flow Novo Saque (linha #${row.id}):`, err2.message);
    }
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, { flow_token: flowToken, etapa: "formulario" });
  await db.setFluxoPasso(de, businessNumberId, "nsorig_formulario");
}

async function processarSubmissaoFormularioNovoSaque(flowToken, de, businessNumberId, dados) {
  if (!flowToken) return;
  const row = await db.novosaqueOriginationBuscarPorFlowToken(flowToken);
  if (!row) return;
  if (row.phone !== de || row.business_number_id !== businessNumberId) {
    console.error(`Submissão de Flow Novo Saque com remetente divergente da linha #${row.id} (esperado ${row.phone}, veio ${de}) — ignorada.`);
    return;
  }
  const reivindicou = await db.novosaqueOriginationReivindicar(row.id, "formulario", "enviando_kyc");
  if (!reivindicou) return;
  try {
    const customerData = novosaque.montarCustomerData(row.cpf, dados);
    await novosaque.enviarFormalizacaoClt(row.transaction_id, row.simulation_id, customerData);
    // Estado no banco ANTES de avisar (mesmo cuidado do CLT/Unnotech: se o aviso falhar depois
    // da formalização já ter sido aceita de verdade, a linha não pode cair em 'erro').
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "aguardando_assinatura" });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Perfeito, só um instante que já preparo seu contrato...");
    } catch (err) {
      console.error(`Erro ao avisar cliente do aceite Novo Saque (linha #${row.id}):`, err.message);
    }
  } catch (err) {
    console.error(`Erro ao processar formulário Novo Saque (linha #${row.id}):`, err.message);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro" });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente do encaminhamento Novo Saque (linha #${row.id}):`, err2.message);
    }
  }
}

async function processarEtapaNsAguardandoAssinatura(row) {
  let contract;
  try {
    contract = await novosaque.consultarContratoClt(row.transaction_id);
  } catch (err) {
    console.error(`Erro ao consultar contrato Novo Saque (linha #${row.id}):`, err.message);
    return;
  }
  const falha = falhaNovoSaque(contract);
  if (falha) {
    console.error(`Falha reportada pela Novo Saque (linha #${row.id}): ${falha}`);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema pra finalizar essa contratação. Vou te colocar com um atendente pra ver o que aconteceu."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente da falha de contratação Novo Saque (linha #${row.id}):`, err2.message);
    }
    return;
  }
  if (contract.contract_link && !row.link_assinatura_enviado_em) {
    await db.novosaqueOriginationAtualizar(row.id, { link_assinatura_enviado_em: Date.now(), status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Seu contrato está pronto! ✍️ Assim que você assinar, eu te aviso por aqui.");
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "Toque no botão abaixo pra assinar:", null, null, {
        buttonText: "Assinar contrato",
        url: contract.contract_link,
      });
    } catch (err) {
      console.error(`Erro ao mandar link de assinatura Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  // Achado na revisão final: se por algum motivo o cliente já estiver com o pagamento CAÍDO
  // (summary_status "Contract paid") quando essa etapa roda de novo — por exemplo, 2 ticks bem
  // próximos onde o 1º ainda não tinha visto "registry" mas o 2º já pulou direto pra pago —, vai
  // direto pro "concluido" em vez de passar pela mensagem intermediária de "assinado, aguarde".
  if (contract.summary_status === "Contract paid") {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "concluido", status_novosaque: contract.summary_status });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "O valor já caiu! 💰 Qualquer coisa, é só me chamar.");
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  // Achado ao vivo: depois de assinado, o `stage` avança pra "registry" (averbação) sem passar
  // por nenhum status específico de "assinado" nos campos que a gente lê — a mudança de stage
  // em si já é o sinal.
  if (["registry", "disbursement", "pay-commission", "collateral"].includes(contract.stage)) {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "aguardando_pagamento", status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Contrato assinado! 🎉 Agora é só aguardar a averbação e o depósito — te aviso assim que cair na sua conta."
      );
    } catch (err) {
      console.error(`Erro ao avisar cliente de assinatura Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  if (Date.now() - Number(row.etapa_em || row.created_at) > NSORIG_PRAZO_LONGO_MS) {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de assinatura travada Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, { status_novosaque: contract.summary_status });
}

async function processarEtapaNsAguardandoPagamento(row) {
  let contract;
  try {
    contract = await novosaque.consultarContratoClt(row.transaction_id);
  } catch (err) {
    console.error(`Erro ao consultar contrato Novo Saque (linha #${row.id}):`, err.message);
    return;
  }
  const falha = falhaNovoSaque(contract);
  if (falha) {
    console.error(`Falha reportada pela Novo Saque (linha #${row.id}): ${falha}`);
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema depois da assinatura do seu contrato. Vou te colocar com um atendente pra resolver."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err2) {
      console.error(`Erro ao avisar cliente de falha pós-assinatura Novo Saque (linha #${row.id}):`, err2.message);
    }
    return;
  }
  if (contract.summary_status === "Contract paid") {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "concluido", status_novosaque: contract.summary_status });
    await db.setFluxoPasso(row.phone, row.business_number_id, null);
    try {
      await enviarRespostaAutomatica(row.business_number_id, row.phone, "O valor já caiu! 💰 Qualquer coisa, é só me chamar.");
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  if (contract.summary_status === "Payment returned") {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await enviarRespostaAutomatica(
        row.business_number_id,
        row.phone,
        "Tivemos um problema no pagamento (dados bancários incorretos, por exemplo). Vou te colocar com um atendente pra resolver."
      );
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento devolvido Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  if (Date.now() - Number(row.etapa_em || row.created_at) > NSORIG_PRAZO_LONGO_MS) {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
    try {
      await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
    } catch (err) {
      console.error(`Erro ao avisar cliente de pagamento travado Novo Saque (linha #${row.id}):`, err.message);
    }
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, { status_novosaque: contract.summary_status });
}

// ─── Recuperação de etapas transitórias travadas ───────────────────────────────────────────
// Achado na revisão final: 'abrindo', 'simulando_pendente' e 'enviando_kyc' são etapas que um
// HANDLER (não o verificador) deveria terminar de processar rapidinho — mas se o processo
// reiniciar (deploy do Render) bem no meio, a linha fica presa nelas pra sempre: o verificador
// não tinha nenhum `else if` pra elas, e a única saída era o cliente mandar o CPF de novo (o que
// só acontece se ele perceber que parou de responder). Essas 3 funções dão ao verificador uma
// chance de destravar sozinho depois do prazo curto normal, sem esperar o cliente notar.

async function processarEtapaNsAbrindoTravada(row) {
  if (Date.now() - Number(row.etapa_em || row.created_at) <= NSORIG_PRAZO_MS) return; // ainda dentro do tempo normal
  // Nada foi aberto na Novo Saque ainda (transaction_id é null nessa etapa) — só encerra.
  await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro" });
}

async function processarEtapaNsSimulandoPendenteTravada(row) {
  if (Date.now() - Number(row.etapa_em || row.created_at) <= NSORIG_PRAZO_MS) return;
  // Deixa o processarEtapaNsSimulando normal assumir a partir daqui — ele já sabe lidar com
  // "ainda não vejo simulação nova" (volta pra oferta anterior) e com uma falha de verdade.
  await db.novosaqueOriginationAtualizar(row.id, { etapa: "simulando" });
}

async function processarEtapaNsEnviandoKycTravada(row) {
  if (Date.now() - Number(row.etapa_em || row.created_at) <= NSORIG_PRAZO_MS) return;
  // Pode ter travado DEPOIS de formalizar com sucesso (202) e ANTES de gravar a etapa nova —
  // confere no parceiro antes de desistir, pra não abandonar um contrato que já está em
  // andamento de verdade do lado deles.
  let contract;
  try {
    contract = await novosaque.consultarContratoClt(row.transaction_id);
  } catch (err) {
    console.error(`Erro ao reconferir contrato Novo Saque travado em enviando_kyc (linha #${row.id}):`, err.message);
    return;
  }
  if (contract.contract_link || ["create-contract", "sign-contract", "registry", "disbursement", "pay-commission", "collateral"].includes(contract.stage)) {
    await db.novosaqueOriginationAtualizar(row.id, { etapa: "aguardando_assinatura", status_novosaque: contract.summary_status });
    return;
  }
  await db.novosaqueOriginationAtualizar(row.id, { etapa: "erro", status_novosaque: contract.summary_status });
  try {
    await confirmarEncaminhamentoHumano(row.phone, row.business_number_id);
  } catch (err) {
    console.error(`Erro ao avisar cliente de KYC travado Novo Saque (linha #${row.id}):`, err.message);
  }
}

// Mesmo padrão do CLT/garantia/financiamento: só confirma quando reconhece um CPF de
// verdade na mensagem — qualquer outra coisa só reseta o relógio do lembrete, sem confirmar
// nada errado (mesmo cuidado do handlerCapturaDadosClt, ver comentário lá em cima).
async function handlerCapturaDadosFgts(de, businessNumberId, corpo) {
  const cpf = (corpo.match(REGEX_CPF) || [])[0]?.replace(/\D/g, "");
  if (!cpf) {
    if (REGEX_NAO_LEMBRA_SAQUE.test(corpo) || REGEX_DATA_SAQUE.test(corpo)) {
      if (REGEX_DATA_SAQUE.test(corpo)) return handlerDataSaqueFgts(de, businessNumberId, corpo);
      await enviarRespostaAutomatica(businessNumberId, de, TEXTO_COMO_VER_DATA_SAQUE);
      await db.setFluxoPasso(de, businessNumberId, "fgts_data_saque");
      return;
    }
    await db.setFluxoPasso(de, businessNumberId, "fgts_cpf");
    return;
  }
  logFunil(businessNumberId, de, "fgts_dados_completos");
  await db.setFluxoPasso(de, businessNumberId, null);
  await iniciarOriginacaoFgts(de, businessNumberId, cpf);
}

// ─── FLUXO COTA CERTA SEGUROS (número "felizcred n") ────────────────────────
// Número dedicado à Cota Certa Seguros. Duas entradas possíveis:
//  1) Cliente preencheu o formulário do site (felizcred.com.br/cotacerta) e a
//     mensagem já chega pronta ("Olá! Quero cotar..." / "...receber uma
//     ligação...") — nesse caso só confirmamos o recebimento, sem menu.
//  2) Cliente manda mensagem direto pro número — recebe o menu com os tipos
//     de seguro; só o Auto tem um fluxo de perguntas (é o produto principal).
// Migrado em 2026-09-21 para a WABA "Cotacerta seguros" (959964999950985): o ID antigo
// (518007084723311) estava na WABA felizcred n, presa a linha de crédito do ManyChat.
const COTACERTA_NUMBER_ID = "1337870802740904";

const REGEX_SITE_COTACAO = /^Ol[áa]!\s*Quero cotar/i;
const REGEX_SITE_CALLBACK = /^Ol[áa]!\s*Quero receber uma liga[çc][ãa]o/i;

// ─── FLUXO CIAHOT (número "Ciahot") ──────────────────────────────────────────
// Negócio diferente da Felizcred: CIAHOT é um site de anúncios classificados na região do
// Vale. O disparo é sempre por campanha de Marketing (template aprovado, mandado pelo
// broadcast do painel) — o fluxo abaixo só cuida do que acontece DEPOIS que a pessoa
// responde esse template. Não é um menu (não tem opções pra escolher), é uma sequência
// linear: aquece, oferece o anúncio grátis com link pro site + botão de atendimento, e
// cutuca 1x se ninguém tocar em nada em 17 minutos.
const CIAHOT_NUMBER_ID = "1264737673394463";
const CIAHOT_SITE_URL = "https://www.ciahot.com.br";
const CIAHOT_ANUNCIAR_URL = "https://ciahot.com.br/anunciar/";

// Apresentação + objetivo eram 2 mensagens separadas; viraram 1 só em 02/10/2026 — cada
// mensagem de serviço passou a ser cobrada à parte pela Meta (ver pricing update de 01/10), e
// esses 2 textos nunca tiveram motivo pra ser balões diferentes (é só a mesma apresentação
// continuando, sem botão nem pausa proposital entre eles).
const CIAHOT_TEXTO_BOAS_VINDAS =
  "Espero que esteja bem! 😊 Meu nome é Felipe, aqui é do escritório do site CIAHOT — um site de " +
  "anúncios da região do Vale. 📣\n\n" +
  "Nosso objetivo é criar anúncios premium e gerar mais atendimentos para você, e facilitar a gestão " +
  "do seu anúncio.";

const CIAHOT_TEXTO_OFERTA =
  "Estamos liberando um anúncio *gratuito* pra você divulgar seu perfil e conseguir mais clientes! " +
  "Te convido a visitar nosso site pra ver como será seu anúncio — se desejar fazer, em 1 min você vê " +
  "e faz seu anúncio *premium*!";

const CIAHOT_TEXTO_VIP =
  "Você pode fazer seu anúncio gratuito, sem custo! 🎉 E ainda pode ganhar o selo *VIP* na campanha " +
  "que está ativa agora. Faça seu anúncio que ele já é liberado pela nossa equipe!";

const CIAHOT_TEXTO_ANUNCIO_CONCLUIDO_RESPOSTA =
  "Ótimo! Agora é só aguardar a liberação, vamos te avisar por aqui. 📌 Já salva esse contato e " +
  "também nosso e-mail de suporte: contato@ciahot.com.br";
const CIAHOT_TEXTO_ANUNCIO_AGORA_NAO = "Sem problemas! 😊 Vamos ficar à disposição, pode nos chamar se tiver alguma dúvida.";

// Dispara depois que a pessoa responde o template de campanha (ver dispararInicioFluxo).
// Espera 15s (tempo de "digitando..." natural) antes de mandar, e só então marca o passo que
// liga o lembrete de 17min. Tenta de novo 1x (3s depois) antes de desistir — sem isso, um erro
// passageiro (rede, rate limit momentâneo da Meta) derrubava o envio sem nenhum vestígio na
// conversa (nada chegava a ser gravado), e só "menu" reabria manualmente.
async function enviarComUmRetry(fn) {
  try {
    await fn();
  } catch (err) {
    console.error("Falha ao enviar, tentando 1x de novo em 3s:", err.message);
    await new Promise((r) => setTimeout(r, 3000));
    await fn();
  }
}

// REDESENHADO em 02/10/2026 a pedido do usuário, pra cortar ao máximo mensagem de serviço
// cobrada (boa parte do tráfego passa a vir por template, sem a janela grátis de 72h).
// "Conhecer site" virou link direto de verdade (cta_url) em vez de botão de resposta — a
// pessoa já cai no site ao tocar, sem precisar de uma 2ª mensagem só pra entregar o link.
// Só que um clique em cta_url NÃO gera evento de webhook (diferente de botão de resposta), não
// dá pra saber se/quando a pessoa clicou — por isso a mensagem seguinte (oferta VIP, com o link
// do anúncio já embutido como texto, mesmo motivo técnico) sai sempre 5s depois, sem esperar
// clique nenhum. "Falar com atendimento" não cabia na 1ª mensagem (cta_url só aceita 1 botão,
// não mistura com botão de resposta) — foi pra 2ª, junto com "Fazer anúncio"/"No momento não".
async function iniciarFluxoCiahot(de, businessNumberId) {
  setTimeout(async () => {
    try {
      await enviarComUmRetry(() =>
        enviarRespostaAutomatica(
          businessNumberId,
          de,
          `${CIAHOT_TEXTO_BOAS_VINDAS}\n\n${CIAHOT_TEXTO_OFERTA}`,
          null,
          null,
          { buttonText: "Conhecer site", url: CIAHOT_SITE_URL }
        )
      );
      await new Promise((r) => setTimeout(r, 5000));
      await enviarComUmRetry(() =>
        enviarRespostaAutomatica(
          businessNumberId,
          de,
          `${CIAHOT_TEXTO_VIP}\nÉ só acessar: ${CIAHOT_ANUNCIAR_URL}`,
          [
            { id: "ciahot_anuncio_sim", title: "Anúncio feito" },
            { id: "ciahot_anuncio_nao", title: "No momento não" },
          ]
        )
      );
      await db.setFluxoPasso(de, businessNumberId, "ciahot_oferta");
    } catch (err) {
      console.error("Erro ao iniciar fluxo Ciahot:", err.message);
    }
  }, 15000);
}

const FLUXO_BOTOES_CIAHOT = {
  // "Anúncio feito" (antes "Fazer anúncio") — pedido do usuário em 02/10/2026: nome mais fiel
  // ao que o clique de fato confirma (o link do formulário já veio embutido na mensagem
  // anterior, ver iniciarFluxoCiahot). "Falar com atendimento" saiu dessa mensagem — não sobrou
  // nenhum botão apontando pra esse id, tirei do fluxo.
  ciahot_anuncio_sim: { texto: CIAHOT_TEXTO_ANUNCIO_CONCLUIDO_RESPOSTA },
  ciahot_anuncio_nao: { texto: CIAHOT_TEXTO_ANUNCIO_AGORA_NAO },
};

const LEMBRETE_MINUTOS_CIAHOT = {
  ciahot_oferta: 17,
};

const LEMBRETE_HANDLERS_CIAHOT = {};

const LEMBRETE_TEXTOS_CIAHOT = {
  padrao:
    "O site CIAHOT pode gerar mais contatos para você! 🚀 Não deixe de conferir e fazer seu anúncio " +
    `de forma gratuita: ${CIAHOT_SITE_URL}`,
  // Sem manter_janela de propósito — ver semAvisoJanela em FLUXO_CIAHOT: só esse lembrete de
  // 17min e nada além disso, mesmo perto das 24h de silêncio.
};

// ─── HORÁRIO COMERCIAL (Cota Certa) ──────────────────────────────────────────
// Assumido seg-sex 9h-18h, sábado 9h-12h, domingo fechado (não confirmado com o
// usuário — ajustar aqui se o horário real da equipe for diferente).
function horarioComercialCotaCerta(data = new Date()) {
  const tz = "America/Sao_Paulo";
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(data);
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "numeric", hour12: false }).format(data)
  );
  if (dia === "Sun") return false;
  if (dia === "Sat") return hora >= 9 && hora < 12;
  return hora >= 9 && hora < 18;
}

// Aviso pra anexar em qualquer mensagem automática que prometa contato de um
// especialista — deixa claro que a resposta é automática e quando o atendimento
// humano volta. No fim de semana prolongado (sábado à tarde ou domingo) reforça
// o aviso da janela de 24h do WhatsApp, porque aí o próximo expediente (segunda
// de manhã) fica a mais de 24h de distância — se o especialista não conseguir
// responder a tempo, a conversa fecha e só reabre com o cliente mandando
// mensagem de novo.
function avisoForaHorarioCotaCerta(data = new Date()) {
  if (horarioComercialCotaCerta(data)) return "";
  const tz = "America/Sao_Paulo";
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(data);
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "numeric", hour12: false }).format(data)
  );
  const finalDeSemanaProlongado = dia === "Sun" || (dia === "Sat" && hora >= 12);
  if (finalDeSemanaProlongado) {
    return (
      "\n\n⏰ Essa resposta foi automática — nossa equipe atende de segunda a sexta das 9h às 18h e aos " +
      "sábados até o meio-dia, e por hoje já encerramos. Um especialista fala com você segunda-feira. Como " +
      'as conversas no WhatsApp fecham depois de 24h sem resposta, se a gente não conseguir voltar a tempo ' +
      'é só mandar um "oi" aqui na segunda que a gente retoma o atendimento na hora! 😊'
    );
  }
  return (
    "\n\n⏰ Essa resposta foi automática — nossa equipe atende de segunda a sexta das 9h às 18h e aos " +
    "sábados até o meio-dia. Um especialista fala com você assim que abrir o expediente."
  );
}

function respostaSiteCotacao() {
  return (
    "Show, recebemos as informações da sua cotação por aqui! 👍 Um especialista da Cota Certa já vai te " +
    "chamar pra fechar as melhores condições com a seguradora parceira ideal. Só um instante!" +
    avisoForaHorarioCotaCerta()
  );
}

function respostaSiteCallback() {
  return (
    "Perfeito, já anotamos seu pedido! 📞 Um especialista da Cota Certa vai te ligar em instantes." +
    avisoForaHorarioCotaCerta()
  );
}

function menuInicialCotaCerta() {
  return {
    texto:
      `Olá, ${saudacaoDoDia()}! 👋 Aqui é da Cota Certa Seguros. Comparamos as melhores seguradoras ` +
      "parceiras do Brasil pra você. Qual seguro você quer cotar?\n\n" +
      '(a qualquer momento, digite "menu" pra ver essas opções de novo)',
    lista: {
      botao: "Escolher seguro",
      opcoes: [
        { id: "cc_auto", title: "🚗 Seguro Auto", description: "O mais procurado — carro, moto ou caminhão" },
        { id: "cc_vida", title: "❤️ Seguro de Vida", description: "Proteção pra você e sua família" },
        { id: "cc_outros", title: "📋 Outros seguros", description: "Saúde, residencial, odonto ou viagem" },
        { id: "cc_consorcio", title: "🔑 Consórcio", description: "Cartas de imóvel, veículo ou serviços" },
        { id: "cc_atendimento", title: "💬 Falar com atendimento", description: "Já fiz minha cotação, quero falar com alguém" },
      ],
    },
  };
}

const LEMBRETE_MINUTOS_COTACERTA = {
  menu_inicial: 15,
  cc_auto: 15,
  cc_v_carro: 15,
  cc_v_moto: 15,
  cc_v_caminhao: 15,
  cc_pular_dados: 15,
  cc_aguardando_financ: 15,
  cc_fin_sim: 15,
  cc_fin_nao: 15,
  cc_uso_particular: 15,
  cc_uso_trabalho: 15,
  cc_uso_app: 15,
  cc_pular_cep: 15,
  cc_aguardando_renov: 15,
  cc_outros: 15,
};

const LEMBRETE_TEXTOS_COTACERTA = {
  padrao:
    "Olá! Vi que você parou no meio da cotação. Pra continuar, é só responder a mensagem acima ou tocar " +
    "em uma das opções 👆",
  // Função (não string fixa) pra poder incluir o aviso de fim de semana prolongado
  // quando esse lembrete de 20h cair perto do fechamento da janela de 24h.
  manter_janela: () =>
    'Ainda por aí? 😊 Sua cotação continua aberta — é só responder aqui que a gente continua de onde ' +
    'parou (ou digite "menu" pra recomeçar).' +
    avisoForaHorarioCotaCerta(),
};

// Pergunta se o veículo é financiado — reaproveitada tanto pela captura de texto
// (modelo/ano/placa) quanto pelo botão "Pular" da mesma etapa.
const PERGUNTA_FINANCIADO = {
  texto: "Perfeito, anotado! O veículo é financiado ou já quitado?",
  botoes: [
    { id: "cc_fin_sim", title: "Financiado" },
    { id: "cc_fin_nao", title: "Já quitado" },
  ],
};

// Pergunta se é seguro novo ou renovação — reaproveitada pela captura de texto
// (CEP) e pelo botão "Pular" da mesma etapa.
const PERGUNTA_RENOVACAO = {
  texto: "Só mais uma coisa: é seguro novo ou renovação de um que você já tinha?",
  botoes: [
    { id: "cc_renov_novo", title: "Seguro novo" },
    { id: "cc_renov_existente", title: "Renovação" },
  ],
};

const MENSAGEM_FINAL_AUTO = () =>
  "Perfeito! 🎉 Já tenho tudo que preciso. Vou chamar um especialista agora pra fechar sua cotação com " +
  "a seguradora parceira ideal — só um instante! 👍" +
  avisoForaHorarioCotaCerta();

// Depois que o cliente manda o modelo/ano/placa (texto livre), pergunta se é financiado.
async function handlerDadosVeiculo(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, PERGUNTA_FINANCIADO.texto, PERGUNTA_FINANCIADO.botoes);
  await db.setFluxoPasso(de, businessNumberId, "cc_aguardando_financ");
}

// Depois que o cliente manda o CEP (texto livre), pergunta se é novo ou renovação.
async function handlerCep(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, PERGUNTA_RENOVACAO.texto, PERGUNTA_RENOVACAO.botoes);
  await db.setFluxoPasso(de, businessNumberId, "cc_aguardando_renov");
}

// "Outros seguros" — descobre qual produto e já passa pro atendimento humano.
async function handlerOutrosSeguros(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Perfeito, anotado! Um especialista vai falar com você em instantes pra te ajudar. 👍" +
      avisoForaHorarioCotaCerta()
  );
  await db.setFluxoPasso(de, businessNumberId, null);
}

const FLUXO_BOTOES_COTACERTA = {
  cc_auto: {
    texto: "Boa escolha! 🚗 Vamos deixar isso rapidinho. Qual tipo de veículo?",
    botoes: [
      { id: "cc_v_carro", title: "Carro" },
      { id: "cc_v_moto", title: "Moto" },
      { id: "cc_v_caminhao", title: "Caminhão" },
    ],
  },
  cc_v_carro: {
    texto: "Show! Me passa rapidinho: qual o modelo, ano e placa? (ex: Onix 2021, ABC1234)",
    botoes: [{ id: "cc_pular_dados", title: "Não sei / pular" }],
  },
  cc_v_moto: {
    texto: "Show! Me passa rapidinho: qual o modelo, ano e placa? (ex: Fazer 250 2021, ABC1234)",
    botoes: [{ id: "cc_pular_dados", title: "Não sei / pular" }],
  },
  cc_v_caminhao: {
    texto: "Show! Me passa rapidinho: qual o modelo, ano e placa? (ex: VW Delivery 2021, ABC1234)",
    botoes: [{ id: "cc_pular_dados", title: "Não sei / pular" }],
  },
  // Botão "pular" da etapa modelo/ano/placa — leva direto pra pergunta de financiado.
  cc_pular_dados: PERGUNTA_FINANCIADO,
  cc_fin_sim: {
    texto: "Certo! E qual o uso do veículo?",
    botoes: [
      { id: "cc_uso_particular", title: "Particular" },
      { id: "cc_uso_trabalho", title: "Trabalho" },
      { id: "cc_uso_app", title: "App" },
    ],
  },
  cc_fin_nao: {
    texto: "Certo! E qual o uso do veículo?",
    botoes: [
      { id: "cc_uso_particular", title: "Particular" },
      { id: "cc_uso_trabalho", title: "Trabalho" },
      { id: "cc_uso_app", title: "App" },
    ],
  },
  cc_uso_particular: {
    texto: "Só mais uma coisa: qual o CEP onde o veículo fica à noite?",
    botoes: [{ id: "cc_pular_cep", title: "Não sei / pular" }],
  },
  cc_uso_trabalho: {
    texto: "Só mais uma coisa: qual o CEP onde o veículo fica à noite?",
    botoes: [{ id: "cc_pular_cep", title: "Não sei / pular" }],
  },
  cc_uso_app: {
    texto: "Só mais uma coisa: qual o CEP onde o veículo fica à noite?",
    botoes: [{ id: "cc_pular_cep", title: "Não sei / pular" }],
  },
  // Botão "pular" da etapa CEP — leva direto pra pergunta de renovação.
  cc_pular_cep: PERGUNTA_RENOVACAO,
  cc_renov_novo: { texto: MENSAGEM_FINAL_AUTO },
  cc_renov_existente: { texto: MENSAGEM_FINAL_AUTO },
  cc_vida: {
    texto: () =>
      "Perfeito! Um especialista em Seguro de Vida vai falar com você em instantes pra entender sua " +
      "necessidade e buscar a melhor condição. 👍" +
      avisoForaHorarioCotaCerta(),
  },
  cc_consorcio: {
    texto: () =>
      "Perfeito! Um especialista em Consórcio vai falar com você em instantes pra apresentar as melhores " +
      "cartas disponíveis. 👍" +
      avisoForaHorarioCotaCerta(),
  },
  cc_outros: {
    // Sem aviso de horário aqui — essa etapa só pede qual seguro é (o aviso vem
    // depois, na resposta de handlerOutrosSeguros, quando de fato promete contato).
    texto:
      "Me conta rapidinho qual seguro você precisa (Saúde, Residencial, Odonto ou Viagem) que já chamo um " +
      "especialista pra te ajudar.",
  },
  cc_atendimento: {
    texto: () =>
      "Perfeito! Já vou chamar um especialista pra continuar seu atendimento. Só um instante! 👍" +
      avisoForaHorarioCotaCerta(),
  },
};

// Adapta confirmacaoAgenda() (só monta o texto) pro formato padrão de handler
// de captura de texto (recebe de/businessNumberId e cuida de enviar + limpar o passo).
async function handlerConfirmacaoAgenda(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, confirmacaoAgenda());
  await db.setFluxoPasso(de, businessNumberId, null);
}

const FLUXO_FELIZCRED = {
  menuInicial,
  fluxoBotoes: FLUXO_BOTOES,
  lembreteMinutos: LEMBRETE_MINUTOS,
  lembreteTextos: LEMBRETE_TEXTOS,
  lembreteHandlers: { fgts_data_saque: encerrarFgtsSemData },
  capturaTexto: {
    fgts_data_saque: handlerDataSaqueFgts,
    gerente_autorizo: handlerConfirmacaoAgenda,
    menu_inicial: handlerMenuPrincipal,
    clt_3mais: handlerCapturaDadosClt,
    carro_garantia_dados: handlerCapturaDadosCarroGarantia,
    financiamento_dados: handlerCapturaDadosFinanciamento,
    fgts_cpf: handlerCapturaDadosFgts,
    campanha_clt_dados: handlerCapturaDadosCampanhaClt,
    cltorig_cpf: handlerCltOrigCapturaCpf,
    cltorig_email: handlerCltOrigCapturaEmail,
    cltorig_valor: handlerCltOrigCapturaValor,
  },
};

const FLUXO_COTACERTA = {
  menuInicial: menuInicialCotaCerta,
  fluxoBotoes: FLUXO_BOTOES_COTACERTA,
  lembreteMinutos: LEMBRETE_MINUTOS_COTACERTA,
  lembreteTextos: LEMBRETE_TEXTOS_COTACERTA,
  // Aviso de manter-janela ("sua cotação continua aberta") não faz sentido pra quem nunca
  // passou do menu inicial — a pessoa recebeu o menu e não escolheu nenhuma opção, não hávia
  // cotação nenhuma aberta pra "continuar". Ver setInterval do verificador de janela de 24h.
  semAvisoJanelaEmPassos: ["menu_inicial"],
  capturaTexto: {
    cc_v_carro: handlerDadosVeiculo,
    cc_v_moto: handlerDadosVeiculo,
    cc_v_caminhao: handlerDadosVeiculo,
    cc_uso_particular: handlerCep,
    cc_uso_trabalho: handlerCep,
    cc_uso_app: handlerCep,
    cc_outros: handlerOutrosSeguros,
  },
};

const FLUXO_CIAHOT = {
  // Sem menuInicial — fluxo linear disparado por campanha, usa aoIniciar no lugar
  // (ver dispararInicioFluxo).
  aoIniciar: iniciarFluxoCiahot,
  fluxoBotoes: FLUXO_BOTOES_CIAHOT,
  lembreteMinutos: LEMBRETE_MINUTOS_CIAHOT,
  lembreteTextos: LEMBRETE_TEXTOS_CIAHOT,
  lembreteHandlers: LEMBRETE_HANDLERS_CIAHOT,
  capturaTexto: {},
  // Teto de mensagens automáticas: as 3 iniciais + 1 lembrete (17min) e nada mais — sem o
  // segundo aviso de manter-janela (20h) que os outros fluxos mandam.
  semAvisoJanela: true,
};

// ─── FLUXO CAMPANHA CLT (número "Campanha CLT") ─────────────────────────────
// "Campanha CLT" no painel = "Correspondente bancario" (+55 47 9274-7368) no Business Manager.
const CAMPANHA_CLT_NUMBER_ID = "1335976862924566";

// ARQUIVADO em 15/09/2026 — trocado pelo funil "Indicação FGTS → horas extras" logo abaixo.
// Não apagado de propósito (mesmo padrão do menuInicialGerenteArquivado): é só reatribuir
// FLUXOS_POR_NUMERO[CAMPANHA_CLT_NUMBER_ID] pra FLUXO_CAMPANHA_CLT (este aqui) pra reativar
// o pitch de "consignado já aprovado".
const CAMPCLT_TEXTO_APRESENTACAO =
  "Meu nome é Felipe e sou consultor de vendas na FelizCred, uma empresa parceira de alguns " +
  "bancos, como Banco Pan, Banco C6, Banco BMG, Facta...";

const CAMPCLT_TEXTO_PROPOSTA =
  "O motivo do meu contato é que você tem uma proposta de *CONSIGNADO CLT APROVADA*, com o " +
  "primeiro desconto somente daqui a 60 dias.";

const CAMPCLT_TEXTO_SIMULAR =
  "Show! 😊 Pra simular seu consignado CLT, preciso de mais 5 coisinhas, pode mandar tudo numa " +
  "mensagem só ou em mensagens separadas:\n• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento";

const CAMPCLT_TEXTO_NAO_DESEJO = "Sem problemas! 😊 Fico à disposição se mudar de ideia.";

const CAMPCLT_TEXTO_DUVIDA = "Ainda por aí? 😊 Ficou com alguma dúvida que te fez não seguir com a simulação?";

// Espera 4s (pedido explícito) depois da resposta ao template, manda apresentação (com botão
// de link pro site) + a proposta (com os 2 botões), e marca o passo que liga o lembrete de 7min.
async function iniciarFluxoCampanhaCLT(de, businessNumberId) {
  setTimeout(async () => {
    try {
      await enviarRespostaAutomatica(businessNumberId, de, CAMPCLT_TEXTO_APRESENTACAO, null, null, {
        buttonText: "Conhecer site",
        url: "https://www.felizcred.com.br",
      });
      await enviarRespostaAutomatica(businessNumberId, de, CAMPCLT_TEXTO_PROPOSTA, [
        { id: "campclt_simular", title: "Simulação" },
        { id: "campclt_nao_desejo", title: "Não desejo" },
      ]);
      await db.setFluxoPasso(de, businessNumberId, "campclt_oferta");
    } catch (err) {
      console.error("Erro ao iniciar fluxo Campanha CLT:", err.message);
    }
  }, 4000);
}

async function handlerCampanhaCLTSimular(de, businessNumberId) {
  // Standby: ver NOVOSAQUE_ORIGINATION_ATIVO. Enquanto false, comportamento inalterado (pede
  // os 5 dados em texto livre, atendimento humano).
  if (NOVOSAQUE_ORIGINATION_ATIVO) {
    await enviarRespostaAutomatica(businessNumberId, de, "Perfeito! Pra eu simular, me manda o seu CPF, por favor 😊");
    await db.setFluxoPasso(de, businessNumberId, "nsorig_cpf");
    return;
  }
  await enviarRespostaAutomatica(businessNumberId, de, CAMPCLT_TEXTO_SIMULAR);
  await db.setFluxoPasso(de, businessNumberId, "campclt_aguardando_dados");
}

// Mesmo sinal de conclusão do resto do CLT (CPF em algum lugar da mensagem — ver REGEX_CPF),
// funciona tanto pra quem manda tudo numa mensagem só quanto em várias soltas (cada mensagem é
// checada por conta própria enquanto o passo estiver aberto). Sem CPF ainda, só ignora e
// continua esperando — é o lembrete de 7min (não uma reafirmação a cada mensagem solta) que
// cuida de quem trava no meio.
async function handlerCapturaDadosCampanhaCLTNova(de, businessNumberId, corpo) {
  if (!REGEX_CPF.test(corpo || "")) return;
  logFunil(businessNumberId, de, "campanha_dados_completos");
  setTimeout(async () => {
    try {
      await confirmarDadosRecebidos(de, businessNumberId, corpo, "CLT");
    } catch (err) {
      console.error("Erro ao confirmar dados da Campanha CLT:", err.message);
    }
  }, 4000);
}

async function handlerLembreteDuvidaCampanhaCLT(phone, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, phone, CAMPCLT_TEXTO_DUVIDA, [
    { id: "campclt_com_duvidas", title: "Estou com dúvidas" },
  ]);
}

const FLUXO_BOTOES_CAMPANHA_CLT = {
  campclt_simular: handlerCampanhaCLTSimular,
  campclt_nao_desejo: { texto: CAMPCLT_TEXTO_NAO_DESEJO },
  // Reaproveita confirmarEncaminhamentoHumano (mesma mensagem de "já vou te colocar com um
  // atendente" usada no resto do CLT) — clicar em "dúvidas" já conta como pedido de humano.
  campclt_com_duvidas: confirmarEncaminhamentoHumano,
  // Botões da originação automática via Novo Saque (ver NOVOSAQUE_ORIGINATION_ATIVO acima).
  nsorig_contratar: handlerNsOrigContratar,
  nsorig_parcela_mais_baixa: handlerNsOrigParcelaMaisBaixa,
};

const LEMBRETE_MINUTOS_CAMPANHA_CLT = {
  campclt_aguardando_dados: 7,
};

const LEMBRETE_HANDLERS_CAMPANHA_CLT = {
  campclt_aguardando_dados: handlerLembreteDuvidaCampanhaCLT,
};

const FLUXO_CAMPANHA_CLT = {
  aoIniciar: iniciarFluxoCampanhaCLT,
  fluxoBotoes: FLUXO_BOTOES_CAMPANHA_CLT,
  lembreteMinutos: LEMBRETE_MINUTOS_CAMPANHA_CLT,
  lembreteTextos: {},
  lembreteHandlers: LEMBRETE_HANDLERS_CAMPANHA_CLT,
  capturaTexto: {
    campclt_aguardando_dados: handlerCapturaDadosCampanhaCLTNova,
    nsorig_cpf: handlerNsOrigCapturaCpf,
    nsorig_valor: handlerNsOrigCapturaValor,
  },
  // Sem manter_janela definido — igual ao Ciahot, sem o segundo aviso de "ainda por aí?" perto
  // das 24h (só o lembrete de 7min e nada além disso).
  semAvisoJanela: true,
};

// ─── FLUXO INDICAÇÃO FGTS → HORAS EXTRAS (novo padrão do número Campanha CLT) ───────────────
// Mensagem fria via indicação (não clique de anúncio): a pessoa recebe um template "Olá, boa
// tarde." mandado por fora desse código (broadcast manual/Business Manager) — esse fluxo só
// cuida do que acontece DEPOIS que ela responde qualquer coisa (aoIniciar dispara na primeira
// mensagem recebida).
//
// Critério de "batia ponto?" REVISADO em 18/09/2026 a pedido do usuário (alinhado com o
// escritório parceiro) — é o OPOSTO do funil do anúncio antigo (menuInicialGerenteArquivado):
// aqui, quem BATIA PONTO é o caso que não é aceito (a diferença é calculada justamente pra quem
// NÃO tem controle de ponto registrado). Não confundir os dois critérios se for mexer de novo.
//
// Sem lembrete de silêncio nenhum por enquanto (lembreteMinutos/Textos/Handlers vazios) — pedido
// explícito do usuário: contato frio não deve ser cutucado, só quem responde continua andando.
//
// Todos os passos são botão→botão (roteados pelo id clicado, ver fluxo.fluxoBotoes[reply.id] no
// processamento do webhook) — nenhum depende de fluxo_passo salvo, porque a mensagem final
// (ind_autoriza_sim) não pede mais nome/cidade, só avisa que a equipe liga pelo número que já
// está na conversa. Por isso capturaTexto fica vazio: não sobrou nenhum passo de texto livre.
// Apresentação + pitch iam em 2 mensagens; viraram 1 só em 02/10/2026 — cada mensagem de
// serviço passou a ser cobrada à parte pela Meta a partir de 01/10 (antes só a conversa toda
// contava), e essas duas sempre foram só uma apresentação continuando, sem motivo pra
// separar. O texto não mudou, só juntou num balão com os 3 botões já embutidos.
async function iniciarFluxoIndicacaoFGTS(de, businessNumberId) {
  setTimeout(async () => {
    try {
      const conversa = await db.getConversation(de, businessNumberId);
      const primeiroNome = extrairPrimeiroNome(conversa?.name);
      const saudacaoNome = primeiroNome ? `Oi, ${primeiroNome}! ` : "";
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        `${saudacaoNome}Meu nome é Felipe, sou consultor na empresa FelizCred, correspondente ` +
          "bancário — somos especialistas em crédito do FGTS. Atendemos muitas pessoas por " +
          "indicação, recebemos o seu contato assim, e vou ser breve pra não tomar seu tempo.\n\n" +
          "Muitas pessoas que ocuparam cargo de confiança, como gerente, supervisor ou afins, " +
          "podem ter diferenças a receber, como FGTS, e acabam nem sabendo desse direito. " +
          "Podemos fazer uma análise gratuita pra ver se é o seu caso.",
        [
          { id: "ind_saber_mais", title: "SABER MAIS" },
          { id: "ind_sair", title: "SAIR" },
          { id: "ind_bloquear", title: "BLOQUEAR" },
        ]
      );
    } catch (err) {
      console.error("Erro ao iniciar fluxo Indicação FGTS:", err.message);
    }
  }, 5000);
}

// Mesma economia de 02/10/2026: "Perfeito, é rápido" + a pergunta viraram 1 mensagem só.
async function handlerIndSaberMais(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, "Perfeito. É bem rápido.\n\nVocê ainda trabalha como gerente ou supervisor?", [
    { id: "ind_trabalha_sim", title: "SIM" },
    { id: "ind_trabalha_nao", title: "NÃO" },
  ]);
}

// BLOQUEAR precisa ser handler (não objeto estático) porque, além de responder, marca o opt-out
// permanente — exigência da própria política de mensageria da Meta, não só educação.
async function handlerIndBloquear(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Combinado, você não vai mais receber mensagens da gente por aqui. Se mudar de ideia, é só " +
      "me chamar. 🙏"
  );
  await db.setFluxoPasso(de, businessNumberId, PASSO_OPTOUT_BLOQUEADO);
  await db.siteChatRegistrarOptOut(de);
}

const PERGUNTA_BATEU_PONTO = "Nesse cargo, você batia ponto?";
const BOTOES_BATEU_PONTO = [
  { id: "ind_ponto_sim", title: "SIM" },
  { id: "ind_ponto_nao", title: "NÃO" },
];

const FLUXO_BOTOES_CAMPANHA_CLT_INDICACAO_FGTS = {
  ind_saber_mais: handlerIndSaberMais,
  ind_sair: { texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia — é só me chamar por aqui." },
  ind_bloquear: handlerIndBloquear,
  ind_trabalha_sim: {
    texto:
      "Já fez uma avaliação com profissionais para saber se há diferenças a receber do seu " +
      "contrato, como por exemplo, de FGTS?",
    botoes: [
      { id: "ind_fgts_sim", title: "SIM" },
      { id: "ind_fgts_nao", title: "NÃO" },
    ],
  },
  ind_trabalha_nao: {
    // "empresa" em vez de "cargo" — pedido do usuário em 18/09/2026, só nessa variante (a 2 fica
    // com a redação original, ver mais abaixo).
    texto: "Entendi. Faz mais de 2 anos que você saiu dessa empresa?",
    botoes: [
      { id: "ind_saiu_sim", title: "SIM" },
      { id: "ind_saiu_nao", title: "NÃO" },
    ],
  },
  ind_fgts_sim: {
    texto:
      "Que bom! 😊 Mesmo assim, existem detalhes que quase ninguém verifica, que podem valer " +
      "ainda mais que o FGTS. Caso queira saber dos detalhes mencionados, precisamos que " +
      "responda a mais uma pergunta:\n" +
      PERGUNTA_BATEU_PONTO,
    botoes: BOTOES_BATEU_PONTO,
  },
  ind_fgts_nao: {
    texto: "Isso é bastante comum. Vamos começar com a seguinte pergunta:\n" + PERGUNTA_BATEU_PONTO,
    botoes: BOTOES_BATEU_PONTO,
  },
  ind_saiu_sim: {
    texto:
      "Infelizmente, existe um prazo previsto em lei para que se possa buscar os direitos — " +
      "baseado na sua resposta, o seu já passou 😕. Caso queira, podemos avaliar essa questão " +
      "do prazo, basta que nos envie um print do contrato de trabalho encerrado.",
  },
  ind_saiu_nao: {
    texto: "Ótimo, ainda dá tempo! Só mais uma pergunta rápida antes de encaminhar:\n" + PERGUNTA_BATEU_PONTO,
    botoes: BOTOES_BATEU_PONTO,
  },
  // Critério revisado (ver comentário no topo da seção): bater ponto = NÃO aceito.
  ind_ponto_sim: {
    texto:
      "Infelizmente, neste caso, não podemos te ajudar, pois as diferenças são calculadas " +
      "justamente para quem não tem controle de ponto.",
  },
  ind_ponto_nao: {
    texto: "Este é exatamente o caso em que podemos ajudar. Podemos te conectar com a equipe responsável?",
    botoes: [
      { id: "ind_autoriza_sim", title: "AUTORIZO" },
      { id: "ind_autoriza_nao", title: "AGORA NÃO" },
    ],
  },
  ind_autoriza_sim: {
    texto:
      "A equipe técnica te chamará no WhatsApp pelo número (47) 99978-2256 — sem compromisso. " +
      "Se quiser, já pode salvar este número na sua agenda de contatos.",
  },
  ind_autoriza_nao: {
    texto:
      "Sem problemas! 😊 Fico à disposição se quiser retomar, é só me chamar por aqui. Só " +
      "lembrando, existe um prazo limite previsto em lei, quanto antes avaliar, melhor.",
  },
};

const FLUXO_CAMPANHA_CLT_INDICACAO_FGTS = {
  aoIniciar: iniciarFluxoIndicacaoFGTS,
  fluxoBotoes: FLUXO_BOTOES_CAMPANHA_CLT_INDICACAO_FGTS,
  // Vazios de propósito: sem lembrete de silêncio nenhum por enquanto (pedido do usuário).
  lembreteMinutos: {},
  lembreteTextos: {},
  lembreteHandlers: {},
  capturaTexto: {},
  semAvisoJanela: true,
};

// ─── VARIANTE 2 (teste A/B contra a variante 1 acima) ───────────────────────────────────────
// Reconstrução fiel da PRIMEIRA versão desse funil (antes da rodada de edições de texto e da
// inversão do critério do ponto em 18/09/2026): revelação positiva (bater ponto = pode ter
// direito a horas extras) e pede nome/cidade antes de encaminhar. Único ajuste pedido pro teste
// valer: tirou a lista de produtos do final do ramo "prescrito" (mesmo pedido da variante 1) —
// resto é literalmente a redação original, "empresa"/"cargo" incluso (não trocado aqui de
// propósito, só na variante 1).
// Mesma economia de 02/10/2026 da variante 1 (cada mensagem de serviço passou a ser cobrada à
// parte pela Meta, ver pricing update de 01/10): apresentação+pitch e revelação+pergunta cada
// uma virou 1 mensagem só, texto sem alteração nenhuma.
async function iniciarFluxoIndicacaoFGTSV2(de, businessNumberId) {
  setTimeout(async () => {
    try {
      const conversa = await db.getConversation(de, businessNumberId);
      const primeiroNome = extrairPrimeiroNome(conversa?.name);
      const saudacaoNome = primeiroNome ? `Oi, ${primeiroNome}! ` : "";
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        `${saudacaoNome}Meu nome é Felipe, sou consultor na empresa FelizCred, correspondente ` +
          "bancário — somos especialistas em crédito do FGTS. Atendemos muitas pessoas por " +
          "indicação, recebemos o seu contato assim, e vou ser breve pra não tomar seu tempo.\n\n" +
          "*Uma coisa no seu FGTS pode ter passado despercebido por anos.*\n" +
          "Muitas pessoas que ocuparam cargo de confiança como Gerente ou Supervisor deixaram de " +
          "receber FGTS e acabam nem sabendo desse direito. Caso você tenha trabalhado em uma " +
          "dessas funções, eu posso fazer uma análise gratuita pra ver se é o seu caso!",
        [
          { id: "ind_saber_mais", title: "SABER MAIS" },
          { id: "ind_sair", title: "SAIR" },
          { id: "ind_bloquear", title: "BLOQUEAR" },
        ]
      );
    } catch (err) {
      console.error("Erro ao iniciar fluxo Indicação FGTS (variante 2):", err.message);
    }
  }, 5000);
}

async function handlerIndRevelacaoV2(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Isso muda bastante o seu caso 👀\n\nQuando alguém é registrado como gerente ou supervisor " +
      "mas bate ponto igual a qualquer outro funcionário, a lei entende que na prática não tinha " +
      "a autonomia que o cargo de confiança exige — e isso costuma dar direito a receber as " +
      "horas extras não pagas desses anos, não só o FGTS.\n\n" +
      "O escritório parceiro analisa os dois pontos juntos, de graça, só pra te dizer se é o seu " +
      "caso. Posso encaminhar?",
    [
      { id: "ind_autoriza_sim", title: "AUTORIZO" },
      { id: "ind_autoriza_nao", title: "AGORA NÃO" },
    ]
  );
}

async function handlerIndAutorizaV2(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Show! Só preciso do seu nome e da cidade onde mora, que eu já encaminho pro escritório.\n\n" +
      "Eles analisam o FGTS e as possíveis horas extras juntos, e te chamam por aqui pelo número " +
      "(47) 99978-2256 — sem compromisso."
  );
  await db.setFluxoPasso(de, businessNumberId, "ind_autorizo");
}

const PERGUNTA_BATEU_PONTO_V2 =
  "Nesse cargo, você batia ponto ou tinha horário fixo de entrada e saída controlado?";
const BOTOES_BATEU_PONTO_V2 = [
  { id: "ind_ponto_sim", title: "SIM, BATIA PONTO" },
  { id: "ind_ponto_nao", title: "NÃO, ERA LIVRE" },
];

const FLUXO_BOTOES_CAMPANHA_CLT_INDICACAO_FGTS_V2 = {
  ind_saber_mais: handlerIndSaberMais,
  ind_sair: { texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia — é só me chamar por aqui." },
  ind_bloquear: handlerIndBloquear,
  ind_trabalha_sim: {
    texto: "Você sabe se o seu FGTS foi depositado corretamente?",
    botoes: [
      { id: "ind_fgts_sim", title: "SIM" },
      { id: "ind_fgts_nao", title: "NÃO" },
    ],
  },
  ind_trabalha_nao: {
    texto: "Entendi. Faz mais de 2 anos que você saiu desse cargo?",
    botoes: [
      { id: "ind_saiu_sim", title: "SIM" },
      { id: "ind_saiu_nao", title: "NÃO" },
    ],
  },
  ind_fgts_sim: {
    texto:
      "Que bom que você fica de olho nisso! 😊 Mesmo assim, tem um detalhe que quase ninguém " +
      "verifica e que pode valer ainda mais que o FGTS — só mais uma pergunta rápida:\n\n" +
      PERGUNTA_BATEU_PONTO_V2,
    botoes: BOTOES_BATEU_PONTO_V2,
  },
  ind_fgts_nao: {
    texto:
      "Isso é mais comum do que parece, viu? 😳 Vale a pena checar direitinho — só mais uma " +
      "pergunta rápida antes:\n\n" +
      PERGUNTA_BATEU_PONTO_V2,
    botoes: BOTOES_BATEU_PONTO_V2,
  },
  ind_saiu_sim: {
    texto:
      "Preciso ser honesto: como já passou de 2 anos desde que você saiu, o prazo legal pra " +
      "reaver tanto o FGTS quanto eventuais horas extras já passou (prescrição de 2 anos) 😕",
  },
  ind_saiu_nao: {
    texto: "Ótimo, ainda dá tempo! Só mais uma pergunta rápida antes de encaminhar:\n\n" + PERGUNTA_BATEU_PONTO_V2,
    botoes: BOTOES_BATEU_PONTO_V2,
  },
  ind_ponto_sim: handlerIndRevelacaoV2,
  ind_ponto_nao: {
    texto:
      "Entendi! Mesmo assim, vale avaliar o FGTS com quem entende do assunto — às vezes tem " +
      "outros detalhes do contrato que pesam.\n\nPosso encaminhar seu caso pro escritório " +
      "parceiro, sem custo nenhum?",
    botoes: [
      { id: "ind_autoriza_sim", title: "AUTORIZO" },
      { id: "ind_autoriza_nao", title: "AGORA NÃO" },
    ],
  },
  ind_autoriza_sim: handlerIndAutorizaV2,
  ind_autoriza_nao: {
    texto:
      "Sem problemas! 😊 Fico à disposição se quiser retomar, é só me chamar por aqui.\n\n" +
      "Só lembrando: esse prazo de 2 anos é real — quanto antes avaliar, melhor.",
  },
};

const FLUXO_CAMPANHA_CLT_INDICACAO_FGTS_V2 = {
  aoIniciar: iniciarFluxoIndicacaoFGTSV2,
  fluxoBotoes: FLUXO_BOTOES_CAMPANHA_CLT_INDICACAO_FGTS_V2,
  lembreteMinutos: {},
  lembreteTextos: {},
  lembreteHandlers: {},
  capturaTexto: {
    ind_autorizo: handlerConfirmacaoAgenda,
  },
  semAvisoJanela: true,
};

// ─── FLUXO "AMIGO INDICOU" (número Felizcred principal, +55 47 9686-4687) ───────────────────
// Disparado pelo template `amigo_indicou` ("Oi, tudo bem? um amigo indic...") — mas, diferente
// da Campanha CLT/Ciahot, esse número TAMBÉM recebe tráfego orgânico e de anúncio o dia todo
// (é o número principal, FLUXO_FELIZCRED por padrão). Por isso esse fluxo não pode entrar em
// FLUXOS_POR_NUMERO (isso trocaria o menu padrão pra TODO MUNDO, não só quem veio da campanha)
// — em vez disso, `getFluxo` checa (ver função abaixo) se aquele contato específico já recebeu
// o template `amigo_indicou` alguma vez (`db.recebeuTemplate`, sticky pro resto da conversa,
// mesmo padrão de detecção usado pelos links do site na Cota Certa). Pedido explícito do
// usuário 25/09/2026: NÃO mexer no fluxo da Campanha CLT, só nesse número.
const FELIZCRED_PRINCIPAL_NUMBER_ID = "1265497659990803";

const AMIGOIND_TEXTO_APRESENTACAO =
  "Eu me chamo Felipe, fiz o crédito do trabalhador para um colega seu que trabalha na mesma " +
  "empresa, e recebemos seu contato como indicação!";

const AMIGOIND_TEXTO_OFERTA =
  "Caso deseje, posso verificar o valor que está aprovado para você! Trabalhamos com vários " +
  "bancos, e vejo qual tem a melhor oferta.";

const AMIGOIND_TEXTO_SIMULAR =
  "Certo! Para simular, preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só ou em " +
  "mensagens separadas:\n• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento";

const AMIGOIND_TEXTO_LINK_SITE = "Claro! Você pode conhecer melhor a empresa no nosso site:";
const AMIGOIND_SITE_URL = "https://www.felizcred.com.br";

const AMIGOIND_TEXTO_BLOQUEADO = "Combinado, você foi bloqueado e não vai mais receber mensagens da gente por aqui.";

async function iniciarFluxoAmigoIndicou(de, businessNumberId) {
  setTimeout(async () => {
    try {
      await enviarComUmRetry(() => enviarRespostaAutomatica(businessNumberId, de, AMIGOIND_TEXTO_APRESENTACAO));
      await enviarComUmRetry(() =>
        enviarRespostaAutomatica(businessNumberId, de, AMIGOIND_TEXTO_OFERTA, [
          { id: "amigoind_simular", title: "DESEJO SIMULAR" },
          { id: "amigoind_conhecer", title: "CONHECER A EMPRESA" },
          { id: "amigoind_bloquear", title: "BLOQUEAR" },
        ])
      );
      await db.setFluxoPasso(de, businessNumberId, "amigoind_oferta");
    } catch (err) {
      console.error("Erro ao iniciar fluxo Amigo Indicou:", err.message);
    }
  }, 5000);
}

async function handlerAmigoIndicouSimular(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, AMIGOIND_TEXTO_SIMULAR);
  await db.setFluxoPasso(de, businessNumberId, "amigoind_aguardando_dados");
}

// "CONHECER A EMPRESA" é botão de resposta (não link direto) só pra poder ficar lado a lado
// com os outros dois botões — a API não deixa misturar botão de link com botão de resposta na
// mesma mensagem (mesmo motivo do "Visitar site" do Ciahot). O link de verdade vem agora, numa
// mensagem própria, como botão cta_url. Fica esperando no mesmo passo "amigoind_oferta" —
// clicar de novo em "DESEJO SIMULAR"/"BLOQUEAR" depois continua funcionando normalmente.
async function handlerAmigoIndicouConhecer(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, AMIGOIND_TEXTO_LINK_SITE, null, null, {
    buttonText: "Conhecer site",
    url: AMIGOIND_SITE_URL,
  });
}

// Exigência da política de mensageria da Meta (opt-out precisa ser respeitado de verdade, não
// só cosmético) — mesmo padrão do handlerIndBloquear da Campanha CLT.
async function handlerAmigoIndicouBloquear(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, AMIGOIND_TEXTO_BLOQUEADO);
  await db.setFluxoPasso(de, businessNumberId, PASSO_OPTOUT_BLOQUEADO);
}

// Mesmo padrão de espera-paciente-por-CPF do resto do CLT (funciona numa mensagem só ou
// espalhado em várias) — ver handlerCapturaDadosCampanhaCLTNova.
const AMIGOIND_TEXTO_CONFIRMACAO = "Certo! Agora é só aguardar um minuto.";

async function handlerAmigoIndicouCapturaDados(de, businessNumberId, corpo) {
  if (!REGEX_CPF.test(corpo || "")) return;
  setTimeout(async () => {
    try {
      await confirmarDadosRecebidos(de, businessNumberId, corpo, "CLT", AMIGOIND_TEXTO_CONFIRMACAO);
    } catch (err) {
      console.error("Erro ao confirmar dados do Amigo Indicou:", err.message);
    }
  }, 4000);
}

const FLUXO_BOTOES_AMIGO_INDICOU = {
  amigoind_simular: handlerAmigoIndicouSimular,
  amigoind_conhecer: handlerAmigoIndicouConhecer,
  amigoind_bloquear: handlerAmigoIndicouBloquear,
};

const FLUXO_AMIGO_INDICOU = {
  aoIniciar: iniciarFluxoAmigoIndicou,
  fluxoBotoes: FLUXO_BOTOES_AMIGO_INDICOU,
  lembreteMinutos: {},
  lembreteTextos: {},
  lembreteHandlers: {},
  capturaTexto: {
    amigoind_aguardando_dados: handlerAmigoIndicouCapturaDados,
  },
  // Sem manter_janela — mesmo espírito do Ciahot/Campanha CLT: contato de campanha não é
  // cutucado por padrão.
  semAvisoJanela: true,
};

// ─── FLUXO "FGTS via anúncio do Instagram" (número principal) ───────────────────────────────
// Clique num anúncio impulsionado do Instagram chega no WhatsApp com um campo `referral` no
// webhook (source_type "ad"/"post", headline, body, ctwa_clid etc.) — diferente do template de
// campanha, aqui NADA é disparado por nós, é a Meta que anexa esse campo na primeira mensagem
// de quem veio do anúncio. Pedido do usuário 25/09/2026: quem vem de um anúncio sobre FGTS
// pula o menu padrão inteiro (as 5 opções) e cai direto nesse fluxo dedicado.
// Detecção: `msg.referral` presente + "fgts" no headline OU no body (case-insensitive) — ver
// REGEX_FGTS_ANUNCIO e o trecho que checa isso em processarEntry. Só a MENSAGEM QUE CHEGOU COM
// o referral aciona a entrada nesse fluxo; depois disso, `getFluxo` mantém a pessoa nele
// enquanto o `fluxo_passo` começar com "fgtsad_" (mesma ideia "sticky" do Amigo Indicou, só que
// via passo salvo em vez de template recebido — não tem template nenhum aqui).
const REGEX_FGTS_ANUNCIO = /fgts/i;

const FGTSAD_TEXTO_APRESENTACAO =
  "Olá, me chamo Felipe e vou dar continuidade no seu atendimento! Para simular o saque do seu " +
  "FGTS, você precisa autorizar a *J17* no app do FGTS (Meu FGTS > Autorizações).";

const FGTSAD_TEXTO_PEDIR_CPF = "Certo! Agora me informa o CPF pra eu poder simular.";

async function iniciarFluxoFgtsAnuncio(de, businessNumberId) {
  try {
    if (await fgtsJaConsultado(de, businessNumberId)) return await responderFgtsJaConsultado(de, businessNumberId);
    await enviarRespostaAutomatica(businessNumberId, de, FGTSAD_TEXTO_APRESENTACAO, [
      { id: "fgtsad_autorizei", title: "JÁ AUTORIZEI" },
    ]);
    await db.setFluxoPasso(de, businessNumberId, "fgtsad_aguardando_autorizacao");
  } catch (err) {
    console.error("Erro ao iniciar fluxo FGTS via anúncio:", err.message);
  }
}

async function handlerFgtsAnuncioAutorizei(de, businessNumberId) {
  await enviarRespostaAutomatica(businessNumberId, de, FGTSAD_TEXTO_PEDIR_CPF);
  await db.setFluxoPasso(de, businessNumberId, "fgtsad_aguardando_cpf");
}

// Mesmo padrão paciente do resto do CLT/FGTS: só reage quando encontra um CPF no que a pessoa
// mandou, funciona numa mensagem só ou espalhado em várias.
async function handlerFgtsAnuncioCapturaCpf(de, businessNumberId, corpo) {
  const cpf = (corpo.match(REGEX_CPF) || [])[0]?.replace(/\D/g, "");
  if (!cpf) return;
  await db.setFluxoPasso(de, businessNumberId, null);
  await iniciarOriginacaoFgts(de, businessNumberId, cpf);
}

const FLUXO_FGTS_ANUNCIO = {
  // A entrada de verdade é pela detecção do `referral` em processarEntry (que já chama
  // iniciarFluxoFgtsAnuncio direto), não pelo mecanismo padrão de conversaInativa. `aoIniciar`
  // fica definido mesmo assim só pra cobrir quem digitar "menu" enquanto está PRESO nesse
  // fluxo (dispararInicioFluxo exige aoIniciar OU menuInicial, senão dá erro silencioso) — nesse
  // caso reabre do zero a apresentação + botão "JÁ AUTORIZEI".
  aoIniciar: iniciarFluxoFgtsAnuncio,
  fluxoBotoes: { fgtsad_autorizei: handlerFgtsAnuncioAutorizei },
  lembreteMinutos: {},
  lembreteTextos: {},
  lembreteHandlers: {},
  capturaTexto: { fgtsad_aguardando_cpf: handlerFgtsAnuncioCapturaCpf },
  semAvisoJanela: true,
};

// CAMPANHA_CLT_NUMBER_ID é resolvido à parte em getFluxo para preservar originações CLT
// já abertas e usar a entrada híbrida da FelizCred para as novas conversas.
const FLUXOS_POR_NUMERO = {
  [COTACERTA_NUMBER_ID]: FLUXO_COTACERTA,
  [CIAHOT_NUMBER_ID]: FLUXO_CIAHOT,
};

// Divide contato por contato entre a variante 1 (ativa) e a 2 (nova, em teste) da Campanha CLT —
// último dígito do telefone par vai pra 1, ímpar pra 2. Fixo por número de telefone (não por
// hora nem ordem de resposta): não importa quando cada pessoa responde ao template, ela sempre
// cai na mesma variante em toda a conversa.
function escolherVarianteCampanhaCLT(phone) {
  const ultimoDigito = Number(String(phone || "").slice(-1));
  return ultimoDigito % 2 === 0 ? FLUXO_CAMPANHA_CLT_INDICACAO_FGTS : FLUXO_CAMPANHA_CLT_INDICACAO_FGTS_V2;
}

// Agora async: a checagem do Amigo Indicou (número principal) precisa consultar o banco pra
// saber se ESSE contato específico já recebeu aquele template — sem isso o fluxo trocaria pra
// todo mundo que manda mensagem nesse número, orgânico incluso. "Sticky": uma vez que a pessoa
// recebeu o template, ela sempre cai nesse fluxo (nunca mais no menu padrão), mesmo dias depois.
// `fluxoPassoAtual` é opcional — quando o chamador já tem o `fluxo_passo` em mãos (ex.:
// processarEntry, que já buscou a conversa), evita uma consulta a mais. Passo começando com
// "fgtsad_" manda pro fluxo do anúncio de FGTS (sticky por passo salvo, não por template).
async function getFluxo(businessNumberId, phone, fluxoPassoAtual) {
  // Retorno/campanha em massa com um fluxo CONECTADO (ver retornos.fluxo_id/broadcast_agendado.fluxo_id
  // e "Conectar a um fluxo" no painel) — a PRÓXIMA resposta do contato, seja qual for o texto,
  // deve cair nesse fluxo específico, não no padrão do número (que pode nem ser dinâmico — vale
  // pra qualquer número, Felizcred/Cota Certa/Ciahot incluso). Checado ANTES de tudo, de
  // propósito. O disparo de verdade acontece via o mecanismo já existente de "conversa inativa
  // → manda o fluxo" (ver processarEntry) — aqui só resolve QUAL fluxo usar.
  if (String(fluxoPassoAtual || "").startsWith("aguardando_fluxo_")) {
    const fluxoId = Number(fluxoPassoAtual.slice("aguardando_fluxo_".length));
    const fluxoAguardado = await db.fluxoDinamicoObter(fluxoId);
    if (fluxoAguardado) return montarFluxoDinamico(fluxoAguardado);
  }
  if (businessNumberId === CAMPANHA_CLT_NUMBER_ID) {
    // Sticky pra quem entrou pelo atalho "clt1" (ver handlerCampanhaCLTSimular/nsorig_*): sem
    // isso, a resposta da pessoa (CPF, ou os botões QUERO CONTRATAR/PARCELA MAIS BAIXA) cai no
    // objeto de fluxo errado (a variante de Indicação FGTS, cujo capturaTexto/fluxoBotoes não
    // tem essas chaves) e a conversa trava em silêncio — bug real encontrado ao vivo em
    // 01/10/2026. Dois sinais porque fluxo_passo fica null entre a criação da transação e a
    // apresentação da oferta (ver handlerNsOrigCapturaCpf) — nessa janela só a linha aberta em
    // novosaque_origination identifica que a pessoa está nesse sub-fluxo.
    if (String(fluxoPassoAtual || "").startsWith("nsorig_")) return FLUXO_CAMPANHA_CLT;
    if (await db.novosaqueOriginationBuscarAberta(phone, businessNumberId)) return FLUXO_CAMPANHA_CLT;
    return FLUXO_FELIZCRED;
  }
  if (businessNumberId === FELIZCRED_PRINCIPAL_NUMBER_ID) {
    if (String(fluxoPassoAtual || "").startsWith("fgtsad_")) return FLUXO_FGTS_ANUNCIO;
    // ARQUIVADO em 21/10/2026 — campanha anterior ("amigo_indicou"). Desligado a pedido: quem recebeu
    // o template não cai mais nesse fluxo. Código mantido (mesmo padrão dos outros arquivados).
    // if (await db.recebeuTemplate(phone, businessNumberId, "amigo_indicou")) return FLUXO_AMIGO_INDICOU;
  }
  if (FLUXOS_POR_NUMERO[businessNumberId]) return FLUXOS_POR_NUMERO[businessNumberId];
  // Número sem fluxo fixo escrito em código (ex.: número novo de um cliente) — tenta o motor
  // de fluxo dinâmico (dado no banco, criado via ferramentas MCP — ver mcp.js/README). Não
  // muda NADA pros números já listados acima, de propósito: zero risco pro que já roda.
  // Contato "preso" num fluxo dinâmico específico (não necessariamente o único "ativo=1" do
  // negócio — pode ter entrado nele por gatilho de palavra-chave, ver bateuGatilhoDeFluxoDinamico)
  // continua NELE, nunca no fluxo padrão — sem isso, os botões da 2ª mensagem em diante não
  // batiam (fluxoBotoes só tem os ids do fluxo que foi montado aqui).
  if (String(fluxoPassoAtual || "").startsWith("fluxo_dinamico_")) {
    const noId = Number(fluxoPassoAtual.slice("fluxo_dinamico_".length));
    const no = await db.fluxoNoObter(noId);
    const fluxoDoContato = no && (await db.fluxoDinamicoObter(no.fluxo_id));
    if (fluxoDoContato) return montarFluxoDinamico(fluxoDoContato);
  }
  const fluxoDinamico = await db.fluxoDinamicoAtivo(businessNumberId);
  if (fluxoDinamico) return montarFluxoDinamico(fluxoDinamico);
  return FLUXO_FELIZCRED;
}

// ─── Motor de fluxo dinâmico ─────────────────────────────────────────────────────────────
// "Anda" pelo grafo salvo no banco a partir de um nó: nó 'acao' executa o efeito (tag/etapa
// do pipeline) e segue direto pro próximo nó sem parar; nó 'mensagem' manda o texto (+ botões,
// se tiver) e PÁRA ali, esperando resposta — mesmo padrão de qualquer fluxo fixo do sistema.
async function avancarNoFluxoDinamico(noId, de, businessNumberId, fluxoId) {
  const no = await db.fluxoNoObter(noId);
  if (!no) return;

  if (no.tipo === "acao") {
    if (no.acao_tipo === "tag") await db.adicionarTagConversa(businessNumberId, de, Number(no.acao_valor));
    else if (no.acao_tipo === "pipeline") await db.atualizarPipelineConversa(de, businessNumberId, no.acao_valor);
    if (no.proximo_no_id) return avancarNoFluxoDinamico(no.proximo_no_id, de, businessNumberId, fluxoId);
    await db.setFluxoPasso(de, businessNumberId, null);
    return;
  }

  if (no.tipo === "horarios") {
    const config = await db.agendaCalendarioConfigObter(businessNumberId);
    let slots = [];
    try {
      slots = await google.horariosDisponiveis({
        calendarioId: config?.calendario_id,
        horaInicio: config?.hora_inicio,
        horaFim: config?.hora_fim,
        duracaoMinutos: config?.duracao_minutos,
      });
    } catch (err) {
      console.error("Erro ao buscar horários do Google Agenda:", err.message);
    }
    if (!slots.length) {
      await enviarRespostaAutomatica(
        businessNumberId,
        de,
        "No momento não encontrei horário disponível na agenda — um atendente vai te ajudar a marcar. 🙏"
      );
      await db.setFluxoPasso(de, businessNumberId, null);
      return;
    }
    const opcoesHorario = slots.map((s) => ({ id: `hor_${noId}_${s.inicio}`, title: formatarSlotBrt(s.inicio) }));
    await enviarRespostaAutomatica(businessNumberId, de, no.texto || "Escolha um dos horários disponíveis:", undefined, {
      botao: "Ver horários",
      opcoes: opcoesHorario,
    });
    await db.fluxoEstadoContatoDefinir(businessNumberId, de, fluxoId, noId);
    await db.setFluxoPasso(de, businessNumberId, `fluxo_dinamico_${noId}`);
    return;
  }

  const opcoes = await db.fluxoOpcoesDoNo(noId);
  const botoes = opcoes.length ? opcoes.map((o) => ({ id: o.botao_id, title: o.botao_titulo })) : undefined;
  await enviarRespostaAutomatica(businessNumberId, de, no.texto || "", botoes);
  await db.fluxoEstadoContatoDefinir(businessNumberId, de, fluxoId, noId);
  await db.setFluxoPasso(de, businessNumberId, `fluxo_dinamico_${noId}`);
}

// Formata um horário ISO (UTC) igual está gravado no evento/slot como "Seg 05/10 14:00" em
// horário de Brasília — cabe no limite de 24 caracteres de título de linha do WhatsApp. Inverso
// do +3 de timestampDeDataHora (agenda.js): aqui subtrai 3h do UTC pra voltar a Brasília.
function formatarSlotBrt(iso) {
  const brt = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mi = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${dias[brt.getUTCDay()]} ${dd}/${mm} ${hh}:${mi}`;
}

// Reply de um nó 'horarios' (id "hor_<noId>_<inicioISO>") — cria o evento de verdade na Google
// Agenda pro horário escolhido, confirma pro cliente e segue pro próximo nó do fluxo (se tiver).
async function confirmarEscolhaDeHorario(replyId, de, businessNumberId, conversaAnterior, nomeContato) {
  const m = replyId.match(/^hor_(\d+)_(.+)$/);
  if (!m) return;
  const noId = Number(m[1]);
  const inicioISO = m[2];
  const no = await db.fluxoNoObter(noId);
  if (!no) return;
  const config = await db.agendaCalendarioConfigObter(businessNumberId);
  const duracaoMinutos = config?.duracao_minutos || 60;
  const fimISO = new Date(new Date(inicioISO).getTime() + duracaoMinutos * 60 * 1000).toISOString();
  const nome = conversaAnterior?.name || nomeContato || de;
  try {
    await google.criarEvento({
      calendarioId: config?.calendario_id,
      titulo: `Consulta - ${nome}`,
      descricao: `Agendado pelo WhatsApp (${de}).`,
      inicioISO,
      fimISO,
      attendeeEmail: conversaAnterior?.email || undefined,
    });
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      `Prontinho! ✅ Agendado para ${formatarSlotBrt(inicioISO)} (horário de Brasília). Qualquer coisa, é só chamar por aqui.`
    );
  } catch (err) {
    console.error("Erro ao criar evento na Google Agenda:", err.message);
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Não consegui confirmar esse horário agora — um atendente vai te ajudar a marcar por aqui mesmo. 🙏"
    );
    return;
  }
  if (no.proximo_no_id) {
    await avancarNoFluxoDinamico(no.proximo_no_id, de, businessNumberId, no.fluxo_id);
  } else {
    await db.setFluxoPasso(de, businessNumberId, null);
  }
}

// Monta um objeto de fluxo compatível com o resto do dispatcher (mesma forma de FLUXO_CIAHOT
// etc: aoIniciar + fluxoBotoes) a partir do grafo salvo no banco — assim o resto do código
// (dispararInicioFluxo, clique de botão) não precisa saber que esse fluxo é dinâmico.
async function montarFluxoDinamico(fluxoRow) {
  const todasOpcoes = await db.fluxoOpcoesDoFluxo(fluxoRow.id);
  const fluxoBotoes = {};
  for (const opcao of todasOpcoes) {
    fluxoBotoes[opcao.botao_id] = (de, businessNumberId) =>
      avancarNoFluxoDinamico(opcao.proximo_no_id, de, businessNumberId, fluxoRow.id);
  }
  return {
    aoIniciar: (de, businessNumberId) => avancarNoFluxoDinamico(fluxoRow.no_inicial_id, de, businessNumberId, fluxoRow.id),
    fluxoBotoes,
    lembreteMinutos: {}, // sem "espera"/lembrete de inatividade ainda — gap conhecido, ver README
    lembreteTextos: {},
    lembreteHandlers: {},
  };
}

// Roteamento de fluxo dinâmico por palavra-chave (ver fluxo_gatilhos/README) — permite ter
// VÁRIOS fluxos dinâmicos por número (um por assunto/produto/origem), cada um disparado quando
// a pessoa manda o texto exato do gatilho, em vez de só um único fluxo "ativo" por número.
// 100% opt-in: só age quando existe alguma linha em fluxo_gatilhos pra esse negócio (criada via
// ferramenta MCP fluxo_gatilho_criar) — sem isso, não muda nada pra nenhum número existente.
// Oferta do consignado CLT para quem responde aos templates bomdia/boatarde. Estados guardados em
// conversations.fluxo_passo: consignado_oferta (aguardando o botão) → consignado_chat (link do chat
// enviado) ou consignado_encerrado (disse "no momento não"). Quem já está em outro funil não entra aqui.
// O texto gravado do envio é o preview do template ("Olá bom dia!", "Olá, boa tarde!"), não o nome técnico —
// por isso se confere também o texto com espaço.
const TEMPLATES_CONSIGNADO = ["bomdia", "bom dia", "boatarde", "boa tarde"];
const NUMEROS_CONSIGNADO = [CAMPANHA_CLT_NUMBER_ID, FELIZCRED_PRINCIPAL_NUMBER_ID];
const TEXTO_APRESENTACAO_CONSIGNADO =
  "Oi, tudo bem? Quem fala é o Felipe, consultor da FelizCred, parceira de bancos como Pan, C6, BMG e Facta.";
const TEXTO_OFERTA_CONSIGNADO = "Você tem um valor disponível para empréstimo consignado CLT, com o primeiro desconto apenas para *60 dias*.";
const BOTOES_OFERTA_CONSIGNADO = [
  { id: "consig_simular", title: "Desejo simular" },
  { id: "consig_nao", title: "No momento não" },
];
const TEXTO_INICIAR_CONSIGNADO = "Para fazer a simulação, eu só preciso de algumas informações para gerar um link de autorização de consulta.";
const BOTOES_INICIAR_CONSIGNADO = [{ id: "consig_iniciar", title: "Iniciar a simulação" }];
// Modo da simulação do consignado depois de "Desejo simular": por padrão, o cliente vai para o CHAT DO SITE (botão
// "Falar com atendimento", celular já preenchido). CONSIGNADO_MODO=whatsapp volta a coletar nome/CPF/nascimento pelo WhatsApp.
const CONSIGNADO_MODO_SITE = process.env.CONSIGNADO_MODO !== "whatsapp";
const TEXTO_IR_PARA_CHAT_CONSIGNADO = "Para fazer a simulação, toque no botão abaixo e continue pelo chat seguro do site. Lá pedimos só o necessário e você acompanha cada etapa.";
const REGEX_INTENCAO_FGTS = /fgts|saque|antecip/i;
// Mensagem automática de outra empresa (ex.: "X agradece seu contato"): não responde, não abre fluxo, não manda lembrete.
// Se uma pessoa de verdade escrever depois, a conversa começa normalmente.
const REGEX_AUTORESPOSTA_EMPRESA = /agradece (o |seu )?contato|mensagem autom[aá]tica|resposta autom[aá]tica|estamos fora do hor[aá]rio de atendimento|no momento n[aã]o (podemos|estamos) (atender|dispon)/i;
// O texto do botão cta_url aceita no máximo 20 caracteres: acima disso a Meta recusa a mensagem e o cliente fica sem
// resposta ("Falar com atendimento" tem 21 e travou o fluxo em 23/10/2026).
const CTA_CHAT_CONSIGNADO = { buttonText: "Abrir atendimento" };

function linkChatConsignado(phone) {
  const digitos = String(phone || "").replace(/\D/g, "").replace(/^55/, "");
  return `https://www.felizcred.com.br/?chat=abrir&wa=${digitos}&utm_source=whatsapp&utm_medium=consignado`;
}

const BOTOES_CONFIRMA_CONSIGNADO = [
  { id: "consig_ok", title: "Confirmo" },
  { id: "consig_corrigir", title: "Corrigir" },
];

// Apresentação + oferta do consignado CLT (2 mensagens), marca o passo e põe a tag do produto na conversa.
// Nunca repete a mesma oferta duas vezes seguidas: se a última mensagem enviada já foi a oferta (ou uma variação
// dela), manda uma variação diferente da última. Cliente que manda várias mensagens seguidas não gasta a janela
// gratuita com 3 textos iguais. Mensagens simultâneas do mesmo contato são tratadas uma por vez (trava em memória).
const VARIACOES_OFERTA_CONSIGNADO = [
  "Para continuar, é só tocar em *Desejo simular* que eu já te passo o próximo passo. 😊",
  "Se ainda quiser ver o valor liberado para você, toque em *Desejo simular*. Se preferir deixar para depois, toque em *No momento não*.",
  "Posso simular agora para você? É rápido e sem compromisso. Toque em *Desejo simular* para começar.",
];
const ofertaConsignadoEmAndamento = new Set();

// A última mensagem enviada a esse contato (automática ou não) foi há menos de `minutos`?
async function respondeuHaPouco(de, businessNumberId, minutos) {
  const [ultima] = (await db.ultimasMensagens(de, businessNumberId, 5)).filter((m) => m.direction === "out" && m.status !== "failed").slice(-1);
  return !!ultima && Date.now() - Number(ultima.created_at) < minutos * 60 * 1000;
}

async function iniciarOfertaConsignado(de, businessNumberId) {
  const chave = `${businessNumberId}:${de}`;
  if (ofertaConsignadoEmAndamento.has(chave)) return;
  ofertaConsignadoEmAndamento.add(chave);
  try {
    const ultimo = String((await db.getUltimoCorpoEnviado(de, businessNumberId)) || "");
    const repetiria =
      ultimo.startsWith(TEXTO_OFERTA_CONSIGNADO) ||
      ultimo.startsWith(TEXTO_APRESENTACAO_CONSIGNADO) ||
      VARIACOES_OFERTA_CONSIGNADO.some((v) => ultimo.startsWith(v));
    if (repetiria) {
      const variacao = VARIACOES_OFERTA_CONSIGNADO.find((v) => !ultimo.startsWith(v));
      await enviarRespostaAutomatica(businessNumberId, de, variacao, BOTOES_OFERTA_CONSIGNADO);
    } else {
      await enviarRespostaAutomatica(businessNumberId, de, TEXTO_APRESENTACAO_CONSIGNADO);
      await enviarRespostaAutomatica(businessNumberId, de, TEXTO_OFERTA_CONSIGNADO, BOTOES_OFERTA_CONSIGNADO);
    }
  } finally {
    ofertaConsignadoEmAndamento.delete(chave);
  }
  await db.setFluxoPasso(de, businessNumberId, "consignado_oferta");
  try {
    const tagId = await db.tagEncontrarOuCriar(businessNumberId, "Consignado CLT", "#15803D");
    await db.adicionarTagConversa(businessNumberId, de, tagId, "automatico");
  } catch (err) {
    console.error("Erro ao adicionar tag do consignado:", err.message);
  }
}

// Quem tocou em "Desejo simular" ganha a tag "Interessado" (o fluxo continua pelo passo normal).
const TAG_SIMULACAO_CONSIGNADO = "Interessado";
async function marcarInteressadoConsignado(de, businessNumberId) {
  try {
    const tagId = await db.tagEncontrarOuCriar(businessNumberId, TAG_SIMULACAO_CONSIGNADO, "#2563EB");
    await db.adicionarTagConversaSeAusente(businessNumberId, de, tagId, "automatico");
  } catch (err) {
    console.error("Erro ao adicionar tag de interesse no consignado:", err.message);
  }
}

// Template bomdia/boatarde lido pelo cliente que não respondeu em 30 min: registra na nota e finaliza a
// conversa (mesmo tratamento de "No momento não"). Varredura a cada 10 min; só olha o último dia (usa índice em last_message_at, para não ler a tabela toda).
const SITE_CHAT_BOT_PAUSA_MS = 30 * 60 * 1000;
const CONSIGNADO_SEM_RESPOSTA_MS = 30 * 60 * 1000;
const NOTA_CONSIGNADO_SEM_RESPOSTA = "Consignado CLT: leu a mensagem e não respondeu em 30 min";
let encerrandoLidosSemResposta = false;
async function encerrarLidosSemResposta() {
  if (encerrandoLidosSemResposta) return;
  encerrandoLidosSemResposta = true;
  try {
    const conversas = await db.templatesLidosSemResposta(NUMEROS_CONSIGNADO, TEMPLATES_CONSIGNADO, CONSIGNADO_SEM_RESPOSTA_MS, 24 * 60 * 60 * 1000);
    for (const c of conversas) {
      try {
        if (!String(c.nota || "").includes(NOTA_CONSIGNADO_SEM_RESPOSTA)) {
          await db.atualizarNotaConversa(c.phone, c.business_number_id, [c.nota, NOTA_CONSIGNADO_SEM_RESPOSTA].filter(Boolean).join("\n"));
        }
        await db.atualizarStatusConversa(c.phone, c.business_number_id, "resolvido");
      } catch (err) {
        console.error(`Erro ao encerrar conversa lida sem resposta ${c.phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro ao encerrar conversas lidas sem resposta:", err.message);
  } finally {
    encerrandoLidosSemResposta = false;
  }
}
// Uma única vez ao subir: completa a tag de quem escolheu "Desejo simular" antes de ela existir.
setTimeout(async () => {
  try {
    for (const c of await db.conversasConsignadoSemTag(NUMEROS_CONSIGNADO, TAG_SIMULACAO_CONSIGNADO)) {
      await marcarInteressadoConsignado(c.phone, c.business_number_id);
    }
  } catch (err) {
    console.error("Erro ao completar tag de interesse no consignado:", err.message);
  }
}, 2 * 60 * 1000);
setTimeout(encerrarLidosSemResposta, 60 * 1000);
setInterval(encerrarLidosSemResposta, 10 * 60 * 1000);

function cpfDeTexto(texto) {
  const digitos = String(texto || "").replace(/\D/g, "");
  return novosaque.cpfValido(digitos) ? digitos : null;
}

function nomeCompletoDeTexto(texto) {
  const nome = String(texto || "").trim().replace(/\s+/g, " ");
  const partes = nome.split(" ").filter(Boolean);
  return partes.length >= 2 && nome.length <= 120 && /^[\p{L} .'-]+$/u.test(nome) ? nome : null;
}

// Data dd/mm/aaaa válida e idade entre 18 e 100 anos.
function nascimentoDeTexto(texto) {
  const m = String(texto || "").trim().match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  const idade = (Date.now() - data.getTime()) / (365.25 * 24 * 3600 * 1000);
  return idade >= 18 && idade <= 100 ? `${m[1]}/${m[2]}/${m[3]}` : null;
}

// Oferta do consignado CLT para quem responde aos templates bomdia/boatarde. Estado guardado em
// conversations.fluxo_passo, no formato "estado|dado1|dado2". Fluxo:
//   consignado_oferta → consignado_iniciar → consignado_nome → consignado_cpf → consignado_nasc → consignado_confirma → consignado_concluido
//   consignado_oferta → consignado_encerrado ("no momento não")
// Quem já está em outro funil não entra aqui.
async function tratarRespostaConsignado({ de, businessNumberId, tipo, msg, conversaAnterior, base }) {
  if (!NUMEROS_CONSIGNADO.includes(businessNumberId)) return false;
  const texto =
    tipo === "text" ? msg.text?.body || "" :
    tipo === "button" ? msg.button?.text || "" :
    tipo === "interactive" ? msg.interactive?.button_reply?.title || "" : "";
  if (!texto || pediuPararMensagens(texto)) return false;
  if (await db.botEstaPausado(de, businessNumberId)) return false; // atendente humano em atendimento
  if (tipo === "text" && texto.length >= 25 && REGEX_AUTORESPOSTA_EMPRESA.test(texto)) {
    await db.insertMessage({ ...base, type: "text", body: texto });
    await db.tentarMarcarInstagramLembreteEnviado(de, businessNumberId); // também não recebe o lembrete do Instagram
    return true;
  }

  const passoCompleto = String(conversaAnterior?.fluxo_passo || "");
  const ehConsignado = passoCompleto.startsWith("consignado_") || passoCompleto === "fgts_sacou";
  if (!ehConsignado && passoCompleto && passoCompleto !== "menu_inicial") return false;
  // Quem escreve sobre FGTS/saque/antecipação (texto livre) vai para o fluxo do FGTS em vez da oferta do consignado,
  // inclusive depois de "No momento não". Antes o Gemini respondia "um atendente vai te ajudar" e o fluxo do FGTS
  // (autorizar a J17 e mandar o CPF) nunca abria. Quem já deu os dados do consignado (concluído) segue com atendente.
  const estadoAtual = passoCompleto.split("|")[0];
  const querFgts = tipo === "text" && REGEX_INTENCAO_FGTS.test(texto);
  if (querFgts && ["", "menu_inicial", "consignado_oferta", "consignado_encerrado"].includes(estadoAtual)) {
    await db.insertMessage({ ...base, type: "text", body: texto });
    await iniciarFluxoFgtsMenu(de, businessNumberId);
    return true;
  }
  // Resposta à mensagem "mudou de ideia ou ficou com dúvida?" (quem parou a simulação no site): 3 botões.
  if (["", "menu_inicial"].includes(estadoAtual) && (await db.recebeuTemplate(de, businessNumberId, RETOMADA_SITE_TEMPLATE))) {
    await db.insertMessage({ ...base, type: tipo === "text" ? "text" : "button", body: texto });
    const resposta = normalizar(texto);
    // Aceita também o texto com acento corrompido do modelo antigo ("N?o quero mais").
    if (/n.{1,3}o quero|quero mais/.test(resposta)) {
      await enviarRespostaAutomatica(businessNumberId, de, "Tudo bem! Se mudar de ideia, é só chamar por aqui 😊");
      await db.setFluxoPasso(de, businessNumberId, "consignado_encerrado");
      await db.atualizarNotaConversa(de, businessNumberId, [conversaAnterior?.nota, "Site: parou a simulação e disse que não quer mais"].filter(Boolean).join("\n"));
      await db.atualizarStatusConversa(de, businessNumberId, "resolvido");
    } else if (resposta.includes("continuar")) {
      await enviarRespostaAutomatica(businessNumberId, de, "Que bom! Toque no botão abaixo para continuar de onde você parou 😊", null, null, { ...CTA_CHAT_CONSIGNADO, url: linkChatConsignado(de) });
      await db.setFluxoPasso(de, businessNumberId, "consignado_chat");
    } else {
      // "Tenho uma dúvida" ou qualquer texto: um atendente assume (a conversa pulsa no painel).
      await enviarRespostaAutomatica(businessNumberId, de, "Claro! Me conta qual é a sua dúvida por aqui que um atendente já te responde 😊");
      await db.setFluxoPasso(de, businessNumberId, "consignado_concluido");
      await db.atualizarStatusConversa(de, businessNumberId, "andamento");
      try {
        const tagId = await db.tagEncontrarOuCriar(businessNumberId, "Consignado CLT", "#15803D");
        await db.adicionarTagConversa(businessNumberId, de, tagId, "automatico");
      } catch (err) {
        console.error("Erro ao adicionar tag na retomada do site:", err.message);
      }
    }
    return true;
  }
  if (!ehConsignado) {
    // Os dois números usam a mesma oferta: quem recebeu o template (ou escreve texto livre, sem
    // anúncio/palavra-chave de outro fluxo) entra nela. Histórico de template pode ter sido limpo.
    const textoLivre = tipo === "text" && !msg.referral && !["menu", "fgts", "saque", "clt1"].includes(normalizarTexto(texto));
    const recebeu = textoLivre || (await Promise.all(TEMPLATES_CONSIGNADO.map((t) => db.recebeuTemplate(de, businessNumberId, t)))).some(Boolean);
    if (!recebeu) return false;
  }

  const [estado, ...dados] = passoCompleto.split("|");
  const t = normalizar(texto);
  const responder = (corpo, botoes, cta) => enviarRespostaAutomatica(businessNumberId, de, corpo, botoes, null, cta);
  const irPara = (passo) => db.setFluxoPasso(de, businessNumberId, passo);

  try {
    await db.insertMessage({ ...base, type: tipo === "text" ? "text" : "button", body: texto });
    if (!ehConsignado) {
      await iniciarOfertaConsignado(de, businessNumberId);
      return true;
    }
    switch (estado) {
      case "fgts_sacou": {
        // Resposta à pergunta "já sacou este ano?" (botões ou texto livre).
        if (t.includes("lembro")) {
          await responder(TEXTO_COMO_VER_DATA_SAQUE);
          await irPara("fgts_data_saque");
        } else if (t.startsWith("nao") || t.includes("nao sa")) {
          await responder(TEXTO_AUTORIZAR_J17);
          await irPara("fgts_cpf");
        } else if (t.startsWith("sim") || t.includes("ja sa") || t.includes("sacei")) {
          await responder(
            "Entendi! Quem já sacou este ano não consegue sacar de novo agora: a Caixa só libera uma vez a cada 12 meses, " +
              "contando da data do último saque."
          );
          await responder(
            "Mas posso simular o *consignado CLT* para você, com o primeiro desconto apenas para *60 dias*. Quer simular?",
            BOTOES_OFERTA_CONSIGNADO
          );
          await irPara("consignado_oferta");
        } else {
          const ultimoCorpo = String((await db.getUltimoCorpoEnviado(de, businessNumberId)) || "");
          if (!ultimoCorpo.startsWith("Antes de começar")) await responder(TEXTO_PERGUNTA_JA_SACOU, BOTOES_JA_SACOU);
        }
        break;
      }
      case "consignado_oferta":
        if (t.includes("desejo") || t.includes("simular")) {
          await marcarInteressadoConsignado(de, businessNumberId);
          if (CONSIGNADO_MODO_SITE) {
            await responder(TEXTO_IR_PARA_CHAT_CONSIGNADO, null, { ...CTA_CHAT_CONSIGNADO, url: linkChatConsignado(de) });
            await irPara("consignado_chat");
          } else {
            await responder(TEXTO_INICIAR_CONSIGNADO, BOTOES_INICIAR_CONSIGNADO);
            await irPara("consignado_iniciar");
          }
        } else if (t.includes("no momento")) {
          await responder("Sem problemas! Fique à vontade para nos chamar quando precisar 😊");
          await irPara("consignado_encerrado");
          // Não quis: registra na nota e finaliza a conversa (sai dos atendimentos em aberto).
          await db.atualizarNotaConversa(de, businessNumberId, [conversaAnterior?.nota, "Consignado CLT: não quis simular"].filter(Boolean).join("\n"));
          await db.atualizarStatusConversa(de, businessNumberId, "resolvido");
        } else {
          // Texto livre sem escolher botão: lembra das opções uma vez só (não é chat, não repete a cada mensagem).
          const ultimoCorpo = String((await db.getUltimoCorpoEnviado(de, businessNumberId)) || "");
          if (!ultimoCorpo.startsWith("Quer saber as condições?")) {
            await responder("Quer saber as condições? Toque em uma das opções abaixo.", BOTOES_OFERTA_CONSIGNADO);
          }
        }
        break;
      case "consignado_iniciar":
        if (t.includes("iniciar") || t.includes("simula")) {
          await responder("Ótimo! Me manda seu *nome completo*, como está no documento.");
          await irPara("consignado_nome");
        } else {
          await responder("Toque no botão abaixo para iniciar a simulação.", BOTOES_INICIAR_CONSIGNADO);
        }
        break;
      case "consignado_nome": {
        const nome = nomeCompletoDeTexto(texto);
        if (!nome) {
          await responder("Preciso do nome completo, com nome e sobrenome, como está no documento.");
        } else {
          await responder("Obrigado! Agora me manda seu *CPF*, só os números.");
          await irPara(`consignado_cpf|${nome}`);
        }
        break;
      }
      case "consignado_cpf": {
        const cpf = cpfDeTexto(texto);
        if (!cpf) {
          await responder("Esse CPF não parece válido. Pode digitar de novo, só os números?");
        } else {
          await responder("Perfeito. Qual é a sua *data de nascimento*? (dd/mm/aaaa)");
          await irPara(`consignado_nasc|${dados[0]}|${cpf}`);
        }
        break;
      }
      case "consignado_nasc": {
        const nasc = nascimentoDeTexto(texto);
        if (!nasc) {
          await responder("Não entendi a data. Manda no formato dd/mm/aaaa, por exemplo 15/03/1985.");
        } else {
          const [nome, cpf] = dados;
          await responder(
            `Confira seus dados:\n\nNome: ${nome}\nCPF: ${cpf}\nNascimento: ${nasc}\n\n` +
              "Ao confirmar, você autoriza a consulta do seu vínculo e margem para a simulação. Isso não é contratação.",
            BOTOES_CONFIRMA_CONSIGNADO
          );
          await irPara(`consignado_confirma|${nome}|${cpf}|${nasc}`);
        }
        break;
      }
      case "consignado_confirma": {
        const [nome, cpf, nasc] = dados;
        if (t.includes("confirmo")) {
          // Sem nota automática: nome, CPF e nascimento já estão na conversa e no nome do contato.
          await db.atualizarStatusConversa(de, businessNumberId, "andamento");
          // Cliente confirmou os dados: entra em qualificação, para aparecer na etapa certa do pipeline.
          await db.atualizarPipelineConversa(de, businessNumberId, "qualificacao", "fluxo_consignado");
          if (google.configurado()) {
            google.garantirContato({ telefone: de, nomePerfil: nomeContatoComCpf(cpf, nome) })
              .catch((err) => console.error("Erro ao salvar contato do consignado no Google:", err.message));
          }
          await responder("Recebi seus dados, obrigado! Um atendente vai verificar sua situação e continuar com você por aqui.");
          await irPara("consignado_concluido");
        } else if (t.includes("corrigir")) {
          await responder("Sem problema. Me manda seu *nome completo*, como está no documento.");
          await irPara("consignado_nome");
        } else {
          await responder("Toque em Confirmo para seguir, ou em Corrigir para ajustar os dados.", BOTOES_CONFIRMA_CONSIGNADO);
        }
        break;
      }
      case "consignado_chat":
        // Já recebeu o link do chat do site: reenvia o botão, mas no máximo 1 vez a cada 30 min (não gasta mensagem
        // repetindo o mesmo link para quem manda várias mensagens seguidas).
        if (await respondeuHaPouco(de, businessNumberId, 30)) break;
        await responder("Para continuar a simulação, toque no botão abaixo e fale com a gente pelo chat do site.", null, { ...CTA_CHAT_CONSIGNADO, url: linkChatConsignado(de) });
        break;
      default: {
        // consignado_encerrado e consignado_concluido: a pessoa já passou pelo fluxo e escreveu de novo.
        // Não recomeça o fluxo: responde de acordo com a conversa (e avisa o horário, se for o caso).
        const situacao = estado === "consignado_concluido"
          ? "O cliente já escolheu simular, enviou nome, CPF e data de nascimento e autorizou a consulta. Está aguardando um atendente continuar o atendimento."
          : "O cliente disse que no momento não quer simular o consignado CLT. Seja cordial; se ele mudar de ideia, um atendente retoma.";
        const horario = horarioComercialCotaCerta()
          ? "Estamos dentro do horário de atendimento (seg a sex 9h-18h, sáb 9h-12h). O atendente pode levar alguns minutos para responder."
          : "Estamos FORA do horário (atendimento seg a sex 9h-18h, sáb 9h-12h). Avise que o atendente retorna no próximo expediente.";
        // Fluxo já terminou e um atendente vai assumir: no máximo 1 resposta automática a cada 3 h, para não gastar
        // mensagem (nem irritar o cliente) a cada nova mensagem enquanto ninguém humano respondeu.
        if (await respondeuHaPouco(de, businessNumberId, 180)) break;
        let resposta = "";
        try {
          resposta = await gemini.responderConversaWhatsapp({
            mensagens: await db.ultimasMensagens(de, businessNumberId, 15),
            situacao,
            horarioAtendimento: horario,
          });
        } catch (err) {
          console.error("Gemini não respondeu no consignado:", err.message);
        }
        if (!resposta) {
          resposta = estado === "consignado_concluido"
            ? "Já recebi seus dados! Um atendente continua com você por aqui assim que possível 😊"
            : "Tudo bem! Se mudar de ideia, é só chamar por aqui 😊";
        }
        await responder(resposta);
        break;
      }
    }
    return true;
  } catch (err) {
    console.error("Erro ao tratar resposta do consignado:", err.message);
    return true;
  }
}

async function bateuGatilhoDeFluxoDinamico(businessNumberId, corpo, de) {
  try {
    const gatilhos = await db.fluxoGatilhosDoNegocio(businessNumberId);
    const gatilho = gatilhos.find(
      (g) => g.tipo === "palavra_chave" && g.valor && normalizarTexto(g.valor) === normalizarTexto(corpo)
    );
    if (!gatilho) return false;
    const fluxoAlvo = await db.fluxoDinamicoObter(gatilho.fluxo_id);
    if (!fluxoAlvo) return false;
    await dispararInicioFluxo(await montarFluxoDinamico(fluxoAlvo), de, businessNumberId);
    return true;
  } catch (err) {
    console.error("Erro ao checar gatilho de fluxo dinâmico:", err.message);
    return false;
  }
}

// Ponto de entrada padrão de um fluxo: por padrão manda o menu inicial na hora (função
// síncrona `menuInicial`, todos os fluxos baseados em menu). Fluxos lineares disparados por
// campanha (ex.: Ciahot) definem `aoIniciar` no lugar — um handler assíncrono que cuida de
// tudo, inclusive marcar o fluxo_passo. Reaproveitado tanto na reabertura por "menu" quanto
// no disparo automático por inatividade, pra não duplicar a lógica dos dois lugares.
async function dispararInicioFluxo(fluxo, de, businessNumberId) {
  // Menu antigo de 5 opções aposentado nos números da oferta do consignado CLT: "menu", "reabrir fluxo" e a entrada
  // padrão agora abrem a mesma oferta dos dois números.
  if (fluxo === FLUXO_FELIZCRED && NUMEROS_CONSIGNADO.includes(businessNumberId)) {
    await iniciarOfertaConsignado(de, businessNumberId);
    return;
  }
  if (fluxo.aoIniciar) {
    await fluxo.aoIniciar(de, businessNumberId);
    return;
  }
  const menu = fluxo.menuInicial();
  await enviarRespostaAutomatica(businessNumberId, de, menu.texto, menu.botoes, menu.lista, menu.cta);
  await db.setFluxoPasso(de, businessNumberId, menu.foraDeHorario || menu.encaminhaSite ? null : "menu_inicial");
}

// ─── PROCESSAR MENSAGENS RECEBIDAS ───────────────────────────────────────────
async function processarEntry(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      const contatos = value.contacts || [];
      const mensagens = value.messages || [];
      const businessNumberId = value.metadata?.phone_number_id;

      for (const msg of mensagens) {
        const de = normalizarTelefoneBR(msg.from);
        const tipo = msg.type;
        const nome = contatos.find((c) => c.wa_id === de)?.profile?.name;
        const quando = Number(msg.timestamp) * 1000 || Date.now();

        // Marca como lida no WhatsApp do cliente (dois tiques azuis) — não bloqueia o
        // processamento da mensagem se a chamada falhar.
        wa.markAsRead(businessNumberId, msg.id).catch((err) =>
          console.error("Falha ao marcar mensagem como lida:", err.message)
        );

        const conversaAnterior = await db.getConversation(de, businessNumberId);
        // Por telefone, não por número de negócio, porque a Campanha CLT hoje divide o
        // contato entre 2 variantes (teste 1 x 2), e o número principal pode ter o contato
        // "preso" num fluxo de anúncio (fluxo_passo) — ver getFluxo.
        const fluxo = await getFluxo(businessNumberId, de, conversaAnterior?.fluxo_passo);
        // Baseado na última mensagem RECEBIDA, não em conversations.last_message_at (que
        // também é tocado pelo NOSSO envio, ex.: template de campanha) — ver
        // db.getUltimaMensagemRecebida. Sem isso, quem respondia rápido a uma campanha nunca
        // disparava o fluxo automático, porque o próprio envio da campanha (segundos antes) já
        // fazia a conversa parecer "ativa".
        const ultimaRecebida = await db.getUltimaMensagemRecebida(de, businessNumberId);
        const conversaInativa = !ultimaRecebida || quando - Number(ultimaRecebida) > HORAS_INATIVIDADE_MENU * 60 * 60 * 1000;

        await db.upsertConversation(de, businessNumberId, nome, quando);
        const cpfNaMensagem = tipo === "text" ? extrairCpfDaMensagem(msg.text?.body) : null;
        sincronizarContatoGoogle(de, businessNumberId, nome, cpfNaMensagem ? nomeContatoComCpf(cpfNaMensagem, nome) : null);
        // Tag "Consignado CLT" automática: quem fala com a Campanha CLT, ou cita CLT/consignado/carteira
        // assinada, ganha a tag sem depender de ter passado pelo botão do menu.
        if (businessNumberId !== CIAHOT_NUMBER_ID && (businessNumberId === CAMPANHA_CLT_NUMBER_ID || (tipo === "text" && /(clt|consignado|carteira assinada)/i.test(msg.text?.body || "")))) {
          db.tagEncontrarOuCriar(businessNumberId, "Consignado CLT", "#15803D")
            .then((tagId) => db.adicionarTagConversaSeAusente(businessNumberId, de, tagId, "automatico"))
            .catch((err) => console.error("Erro ao aplicar tag Consignado CLT:", err.message));
        }

        const base = {
          phone: de,
          business_number_id: businessNumberId,
          direction: "in",
          wa_message_id: msg.id,
          created_at: quando,
          status: "received",
        };

        let mensagemJaTratada = false;

        // Quem responde aos templates bomdia/boatarde (Campanha CLT e Felizcred principal) recebe a
        // oferta do consignado CLT. Vem antes dos fluxos antigos; quem já está no meio de outro funil
        // continua nele (ver tratarRespostaConsignado).
        if (await tratarRespostaConsignado({ de, businessNumberId, tipo, msg, conversaAnterior, base })) {
          mensagemJaTratada = true;
        } else if (tipo === "text") {
          await db.insertMessage({ ...base, type: "text", body: msg.text?.body });
          const corpo = msg.text?.body || "";
          // Diagnóstico: loga QUALQUER referral de anúncio que chegar (mesmo sem bater "fgts"),
          // pra conferir nos logs do Render os campos reais (headline/body) caso o fluxo abaixo
          // não dispare como esperado — sem precisar mudar código às cegas.
          if (msg.referral) console.log(`📣 Referral recebido de ${de} (${businessNumberId}):`, JSON.stringify(msg.referral));
          // Palavra-chave "menu" reabre o menu inicial do fluxo a qualquer momento,
          // não importa em que passo a conversa está.
          if (pediuPararMensagens(corpo)) {
            try {
              await handlerIndBloquear(de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao registrar saída de mensagens:", err.message);
            }
          } else if (normalizarTexto(corpo) === "menu") {
            try {
              await db.pausarBot(de, businessNumberId, null);
              await dispararInicioFluxo(fluxo, de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao reabrir menu inicial:", err.message);
            }
          } else if (
            [CAMPANHA_CLT_NUMBER_ID, FELIZCRED_PRINCIPAL_NUMBER_ID].includes(businessNumberId) &&
            pediuConsignadoClt(corpo) &&
            (!conversaAnterior?.fluxo_passo || conversaAnterior.fluxo_passo === "menu_inicial" || conversaInativa)
          ) {
            try {
              await encaminharCltParaSite(de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao encaminhar CLT para o site:", err.message);
            }
          } else if (businessNumberId === CAMPANHA_CLT_NUMBER_ID && normalizarTexto(corpo) === "clt1") {
            // Gatilho dedicado pra entrar na originação automática (Novo Saque) sem mexer no
            // roteamento padrão do número (getFluxo → escolherVarianteCampanhaCLT) — a campanha
            // de Indicação FGTS que roda nele hoje fica 100% intocada, só quem mandar "clt1" (de
            // propósito, ex.: vindo de um anúncio/link específico) entra aqui. Reaproveita
            // handlerCampanhaCLTSimular: com NOVOSAQUE_ORIGINATION_ATIVO ligado, já manda direto
            // pro pedido de CPF.
            try {
              await handlerCampanhaCLTSimular(de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao iniciar atalho clt1:", err.message);
            }
          } else if (await bateuGatilhoDeFluxoDinamico(businessNumberId, corpo, de)) {
            mensagemJaTratada = true;
          } else if (fluxo === FLUXO_FELIZCRED && ["fgts", "saque"].includes(normalizarTexto(corpo)) && ["fgts_cpf", "fgts_data_saque"].includes(conversaAnterior?.fluxo_passo)) {
            // Já recebeu a explicação do FGTS e está esperando o CPF/data: repetir "fgts" não manda a mesma explicação de novo.
            mensagemJaTratada = true;
          } else if (fluxo === FLUXO_FELIZCRED && ["fgts", "saque"].includes(normalizarTexto(corpo))) {
            // "fgts"/"saque" funciona como atalho a qualquer momento (mesmo espírito do "menu"
            // acima) — antes só funcionava DEPOIS do menu completo já ter sido mandado (checado
            // via capturaTexto[menu_inicial]), então quem mandasse "fgts" como primeira mensagem
            // caía no menu inteiro, ignorando o que a pessoa pediu. Só no fluxo padrão
            // (FLUXO_FELIZCRED) — os outros números já têm entrada própria.
            try {
              await iniciarFluxoFgtsMenu(de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao iniciar atalho de FGTS:", err.message);
            }
          } else if (businessNumberId === COTACERTA_NUMBER_ID && REGEX_SITE_COTACAO.test(corpo)) {
            try {
              await enviarRespostaAutomatica(businessNumberId, de, respostaSiteCotacao());
              await db.setFluxoPasso(de, businessNumberId, null);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao responder cotação vinda do site:", err.message);
            }
          } else if (businessNumberId === COTACERTA_NUMBER_ID && REGEX_SITE_CALLBACK.test(corpo)) {
            try {
              await enviarRespostaAutomatica(businessNumberId, de, respostaSiteCallback());
              await db.setFluxoPasso(de, businessNumberId, null);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao responder pedido de ligação vindo do site:", err.message);
            }
          } else if (
            businessNumberId === FELIZCRED_PRINCIPAL_NUMBER_ID &&
            msg.referral &&
            REGEX_FGTS_ANUNCIO.test(`${msg.referral.headline || ""} ${msg.referral.body || ""}`)
          ) {
            // Clique num anúncio impulsionado do Instagram sobre FGTS — pula o menu padrão
            // inteiro (o referral já foi logado acima).
            try {
              await iniciarFluxoFgtsAnuncio(de, businessNumberId);
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao iniciar fluxo FGTS via anúncio:", err.message);
            }
          } else {
            // Passo aguardando resposta em texto livre (ex.: nome/cidade, modelo do
            // veículo, CEP, opção do menu principal) — cada fluxo define os seus próprios
            // passos de captura. `corpo` é repassado pra quem precisa decidir com base no
            // que a pessoa digitou (ex.: handlerMenuPrincipal); handlers mais simples que
            // sempre respondem a mesma coisa (ex.: handlerConfirmacaoAgenda) ignoram.
            const handler = fluxo.capturaTexto?.[conversaAnterior?.fluxo_passo];
            if (handler) {
              try {
                await handler(de, businessNumberId, corpo);
              } catch (err) {
                console.error("Erro ao processar captura de texto do fluxo:", err.message);
              }
            }
          }
        } else if (tipo === "button") {
          const textoBotao = msg.button?.text || msg.button?.payload || "";
          await db.insertMessage({ ...base, type: "button", body: textoBotao });
          if (pediuPararMensagens(textoBotao)) {
            await handlerIndBloquear(de, businessNumberId);
            continue;
          }
          const resposta = RESPOSTAS_BOTAO[normalizar(textoBotao)];
          if (resposta) {
            try {
              if (resposta.passo === "campanha_clt_dados") logFunil(businessNumberId, de, "campanha_clique");
              await enviarRespostaAutomatica(businessNumberId, de, resposta.texto);
              await db.setFluxoPasso(de, businessNumberId, resposta.passo || null);
            } catch (err) {
              console.error("Erro ao enviar resposta automática:", err.message);
            }
          }
        } else if (tipo === "interactive" && msg.interactive?.nfm_reply) {
          // Submissão de um WhatsApp Flow (formulário nativo) — é como a Meta manda a resposta
          // de um Flow ESTÁTICO, sem endpoint, direto nesse webhook normal (diferente do Flow
          // com endpoint da Task 13, que responde por outro caminho). flow_token vem DENTRO do
          // response_json, não é campo irmão de nfm_reply (achado na revisão final: lendo do
          // lugar errado, toda submissão de Flow era descartada em silêncio). É um token
          // aleatório (não mais o id sequencial da linha) — busca por ele, não por número.
          let dados;
          try {
            dados = JSON.parse(msg.interactive.nfm_reply.response_json);
          } catch (err) {
            console.error("Erro ao interpretar resposta do Flow (JSON inválido):", err.message);
            dados = null;
          }
          await db.insertMessage({ ...base, type: "button", body: "[formulário preenchido]" });
          if (dados) {
            const token = String(dados.flow_token || "");
            try {
              await processarSubmissaoFormularioFgts(token, de, businessNumberId, dados);
            } catch (err) {
              console.error("Erro ao processar formulário FGTS:", err.message);
            }
            try {
              await processarSubmissaoFormularioClt(token, de, businessNumberId, dados);
            } catch (err) {
              console.error("Erro ao processar formulário CLT:", err.message);
            }
            try {
              await processarSubmissaoFormularioNovoSaque(token, de, businessNumberId, dados);
            } catch (err) {
              console.error("Erro ao processar formulário Novo Saque:", err.message);
            }
          }
        } else if (tipo === "interactive" && (msg.interactive?.list_reply?.id || "").startsWith("cltorig_vinculo_")) {
          // Escolha de vínculo empregatício (ver processarEtapaCltConsultandoMargem) — id
          // dinâmico por vínculo, por isso não é um botão estático em FLUXO_BOTOES.
          const reply = msg.interactive.list_reply;
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[vínculo escolhido]" });
          try {
            await handlerCltOrigEscolherVinculo(de, businessNumberId, reply.id.slice("cltorig_vinculo_".length));
          } catch (err) {
            console.error("Erro ao processar escolha de vínculo CLT:", err.message);
          }
        } else if (tipo === "interactive" && (msg.interactive?.list_reply?.id || "").startsWith("cltorig_prazo_")) {
          // Escolha de prazo no "cardápio" de ofertas (ver handlerCltOrigEscolherOpcao) — id
          // dinâmico por oferta, mesmo padrão de cltorig_vinculo_ acima.
          const reply = msg.interactive.list_reply;
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[prazo escolhido]" });
          try {
            await handlerCltOrigEscolherPrazo(de, businessNumberId, reply.id.slice("cltorig_prazo_".length));
          } catch (err) {
            console.error("Erro ao processar escolha de prazo CLT:", err.message);
          }
        } else if (tipo === "interactive" && (msg.interactive?.list_reply?.id || "").startsWith("hor_")) {
          // Escolha de horário oferecido por um nó 'horarios' do fluxo dinâmico (ver
          // avancarNoFluxoDinamico) — id dinâmico (não vem de fluxo_opcoes, é gerado na hora a
          // partir do Google Agenda), por isso trata separado do resto dos botões/listas.
          const reply = msg.interactive.list_reply;
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[horário escolhido]" });
          try {
            await confirmarEscolhaDeHorario(reply.id, de, businessNumberId, conversaAnterior, nome);
          } catch (err) {
            console.error("Erro ao confirmar horário escolhido:", err.message);
          }
        } else if (tipo === "interactive") {
          // Clique em um botão do fluxo automático (mensagens interativas)
          const reply = msg.interactive?.button_reply || msg.interactive?.list_reply || {};
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[botão]" });
          if (pediuPararMensagens(reply.title || reply.id)) {
            await handlerIndBloquear(de, businessNumberId);
            continue;
          }
          const passo = fluxo.fluxoBotoes[reply.id];
          if (passo) {
            try {
              if (reply.id === "clt_3mais") logFunil(businessNumberId, de, "clt_qualificado");
              if (typeof passo === "function") {
                // Passo "handler": função própria cuida de tudo (inclui casos que precisam
                // mandar mais de uma mensagem — ver iniciarFluxoCiahot), inclusive marcar o
                // fluxo_passo.
                await passo(de, businessNumberId);
              } else {
                const textoPasso = typeof passo.texto === "function" ? passo.texto() : passo.texto;
                await enviarRespostaAutomatica(businessNumberId, de, textoPasso, passo.botoes, passo.lista);
                // Marca (ou limpa) o passo em que a conversa fica aguardando resposta
                await db.setFluxoPasso(de, businessNumberId, fluxo.lembreteMinutos[reply.id] ? reply.id : null);
              }
            } catch (err) {
              console.error("Erro ao enviar passo do fluxo de botões:", err.message);
            }
          }
        } else if (tipo === "image" || tipo === "audio" || tipo === "video" || tipo === "document" || tipo === "sticker") {
          const media = msg[tipo];
          try {
            const { buffer, mimeType } = await wa.downloadMedia(media.id);
            const ext = EXT_BY_MIME[mimeType] || "bin";
            const filename = safeFilename(msg.id, ext);
            // R2 em vez de disco local: o disco do Render é apagado a cada deploy/restart, o
            // que fazia a foto/áudio/vídeo do cliente sumir do painel pouco depois de chegar.
            await r2.enviarVideo(`clientes/${filename}`, buffer, mimeType);
            await db.insertMessage({
              ...base,
              type: tipo,
              body: media.caption || media.filename || null,
              media_path: `/media/${filename}`,
              media_mime: mimeType,
            });
          } catch (err) {
            console.error("Erro ao baixar mídia:", err.message);
            await db.insertMessage({ ...base, type: tipo, body: "[mídia indisponível]" });
          }
        } else if (tipo === "location") {
          // body guarda JSON {latitude, longitude, name?, address?} — o painel usa isso pra
          // montar o link do Google Maps (ver chats.tsx).
          const loc = msg.location || {};
          await db.insertMessage({
            ...base,
            type: "location",
            body: JSON.stringify({
              latitude: loc.latitude,
              longitude: loc.longitude,
              name: loc.name || null,
              address: loc.address || null,
            }),
          });
        } else if (tipo === "contacts") {
          // WhatsApp manda um array (pode compartilhar vários contatos de uma vez) — guarda só
          // nome + telefone de cada um, já simplificado (não o vCard inteiro).
          const lista = Array.isArray(msg.contacts) ? msg.contacts : [];
          const simplificados = lista.map((c) => ({
            nome: c.name?.formatted_name || null,
            telefone: c.phones?.[0]?.phone || null,
          }));
          await db.insertMessage({ ...base, type: "contacts", body: JSON.stringify(simplificados) });
        } else if (tipo === "reaction") {
          // context_wa_id aqui aponta pra mensagem REAGIDA (reaproveita a mesma coluna da
          // citação/reply) — body guarda só o emoji (vazio = reação removida).
          await db.insertMessage({
            ...base,
            type: "reaction",
            body: msg.reaction?.emoji || "",
            context_wa_id: msg.reaction?.message_id || null,
          });
        } else {
          await db.insertMessage({ ...base, type: tipo, body: `[mensagem do tipo ${tipo}]` });
        }

        // Menu inicial automático: conversa nova ou parada há mais de 24h, no máximo
        // 1x a cada 24h por contato (marcação atômica no banco — mensagens em rajada
        // ou processadas em paralelo não duplicam o menu).
        // Cliques em botão não contam (continuação do fluxo), nem "unsupported"/"reaction"
        // (costumam vir de números de sistema que não aceitam resposta).
        const TIPOS_COM_MENU = ["text", "image", "audio", "video", "document", "sticker"];
        if (
          !mensagemJaTratada &&
          conversaInativa &&
          TIPOS_COM_MENU.includes(tipo) &&
          conversaAnterior?.fluxo_passo !== PASSO_OPTOUT_BLOQUEADO
        ) {
          try {
            const podeEnviar = await db.tentarMarcarMenuEnviado(
              de,
              businessNumberId,
              HORAS_INATIVIDADE_MENU * 60 * 60 * 1000
            );
            if (podeEnviar) {
              await dispararInicioFluxo(fluxo, de, businessNumberId);
            }
          } catch (err) {
            console.error("Erro ao enviar menu inicial:", err.message);
          }
        }

        console.log(`📩 [${new Date(quando).toLocaleString("pt-BR")}] ${de} (${tipo})`);
      }

      for (const status of value.statuses || []) {
        const erro = status.errors?.[0];
        const erroTexto = erro
          ? `${erro.title || erro.code}${erro.error_data?.details ? " — " + erro.error_data.details : ""}`
          : null;
        await db.updateStatusByWaId(status.id, status.status, erroTexto);
        // 'failed' pode chegar bem depois do envio parecer ok (ver limparBroadcastNuncaRespondido)
        // — roda em segundo plano, nunca atrasa nem quebra o processamento do webhook.
        if (status.status === "failed") {
          limparBroadcastNuncaRespondido(status.id, businessNumberId).catch((err) =>
            console.error("Erro ao limpar conversa de broadcast não entregue:", err.message)
          );
        }
        console.log(
          `✅ Status: ${status.status} — para ${status.recipient_id}` + (erroTexto ? ` (motivo: ${erroTexto})` : "")
        );
      }
    }
  }
}

// ─── PROCESSAR EVENTOS DO INSTAGRAM ──────────────────────────────────────────
// DMs do Instagram são gravadas nas MESMAS tabelas conversations/messages do WhatsApp,
// usando business_number_id fixo "instagram" — isso deixa reaproveitar todas as rotas do
// painel (/painel/api/conversations/:businessId/...) sem duplicar nada, e é o que alimenta
// a caixa de entrada unificada (WhatsApp + Instagram juntos).
async function logInstagramInbound(senderId, texto, quando, idExterno) {
  const conversaAnterior = await db.getConversation(senderId, "instagram");
  let nome = conversaAnterior?.name || null;
  if (!nome) {
    try {
      const perfil = await ig.getPerfilUsuario(senderId);
      nome = perfil.username ? `@${perfil.username}` : perfil.name || null;
    } catch {
      // segue sem nome — o painel mostra o ID do Instagram no lugar
    }
  }
  await db.upsertConversation(senderId, "instagram", nome, quando);
  await db.insertMessage({
    phone: senderId,
    business_number_id: "instagram",
    direction: "in",
    type: "text",
    body: texto,
    status: "received",
    wa_message_id: idExterno || null,
    created_at: quando,
  });
}

async function logInstagramOutbound(recipientId, texto, idExterno) {
  const now = Date.now();
  await db.upsertConversation(recipientId, "instagram", null, now);
  await db.insertMessage({
    phone: recipientId,
    business_number_id: "instagram",
    direction: "out",
    type: "text",
    body: texto,
    status: "sent",
    wa_message_id: idExterno || null,
    created_at: now,
  });
}

// Importa o histórico de DMs que já existiam ANTES da gravação automática via webhook
// (logInstagramInbound/Outbound acima) começar a rodar — sem isso, só mensagem nova a
// partir do deploy aparece na caixa de entrada. Rodar uma vez só, pelo botão no painel
// (idempotente: pode rodar de novo sem duplicar, graças ao dedup por wa_message_id).
async function instagramImportarHistorico() {
  const conversas = await ig.getConversas();
  let conversasImportadas = 0;
  let mensagensNovas = 0;
  for (const conversa of conversas) {
    const participantes = conversa.participants?.data || [];
    const outro = participantes.find((p) => p.id !== ig.ACCOUNT_ID);
    if (!outro) continue;

    let mensagens;
    try {
      mensagens = await ig.getMensagensConversa(conversa.id);
    } catch (err) {
      console.error(`Falha ao importar conversa ${conversa.id} do Instagram:`, err.message);
      continue;
    }
    if (!mensagens.length) continue;

    let ultimaData = 0;
    // A Graph API devolve mais recente primeiro — grava em ordem cronológica (mais antiga primeiro)
    for (const msg of mensagens.slice().reverse()) {
      const quando = new Date(msg.created_time).getTime() || Date.now();
      ultimaData = Math.max(ultimaData, quando);
      if (await db.mensagemExistePorId(msg.id)) continue; // já veio por webhook ou importação anterior

      const direction = msg.from?.id === outro.id ? "in" : "out";
      await db.insertMessage({
        phone: outro.id,
        business_number_id: "instagram",
        direction,
        type: "text",
        body: msg.message || "[mensagem sem texto]",
        status: direction === "out" ? "sent" : "received",
        wa_message_id: msg.id,
        created_at: quando,
      });
      mensagensNovas++;
    }

    const nome = outro.username ? `@${outro.username}` : outro.name || null;
    await db.upsertConversation(outro.id, "instagram", nome, ultimaData);
    conversasImportadas++;
  }
  return { conversasImportadas, mensagensNovas };
}

async function handleInstagramComment(value) {
  const userId = value.from?.id;
  if (!userId) return;
  try {
    const result = await ig.sendDM(userId, INSTAGRAM_COMMENT_REPLY);
    await logInstagramOutbound(userId, INSTAGRAM_COMMENT_REPLY, result.message_id);
    console.log(`📸 Comentário de ${value.from?.username || userId} → DM enviada`);
  } catch (err) {
    console.error("Erro ao responder comentário do Instagram:", err.message);
  }
}

async function handleInstagramMessaging(messaging) {
  const senderId = messaging.sender?.id;
  if (!senderId || messaging.message?.is_echo) return; // is_echo = eco da própria mensagem que a gente mandou

  const texto = messaging.message?.text || "";
  const quando = Number(messaging.timestamp) || Date.now();
  await logInstagramInbound(
    senderId,
    texto || (messaging.message?.attachments ? "[anexo recebido]" : "[mensagem sem texto]"),
    quando,
    messaging.message?.mid
  );

  // Palavra-chave "menu" reabre o menu inicial a qualquer momento — mesmo pra quem já foi
  // saudado antes (sem isso, alguém que já recebeu a mensagem de boas-vindas uma vez nunca
  // mais recebe nada automático, igual aconteceu no teste: "oi" de novo ficou sem resposta).
  // Espelha o mesmo atalho que já existe no fluxo do WhatsApp (processarEntry).
  if (normalizarTexto(texto) === "menu") {
    try {
      const result = await ig.sendDM(senderId, INSTAGRAM_MENU_MESSAGE);
      await logInstagramOutbound(senderId, INSTAGRAM_MENU_MESSAGE, result.message_id);
      console.log(`📸 ${senderId} pediu "menu" → menu reenviado`);
    } catch (err) {
      console.error("Erro ao reenviar menu do Instagram:", err.message);
    }
    return;
  }

  // Conversa esperando os dados de um fluxo (CPF do FGTS, ou pacote de dados do consignado
  // CLT) — a mensagem atual É os dados pedidos, não tenta casar com outra opção do menu.
  // Espelha o mesmo padrão do WhatsApp (fluxo_passo / capturaTexto em processarEntry),
  // reaproveitando as MESMAS colunas da tabela conversations (fluxo já existe pro Instagram
  // desde que ele passou a usar business_number_id "instagram").
  const conversaAnterior = await db.getConversation(senderId, "instagram");
  if (conversaAnterior?.fluxo_passo === "saque_fgts" || conversaAnterior?.fluxo_passo === "consignado_clt") {
    await db.setFluxoPasso(senderId, "instagram", null);
    try {
      const result = await ig.sendDM(senderId, INSTAGRAM_DADOS_RECEBIDOS_MESSAGE);
      await logInstagramOutbound(senderId, INSTAGRAM_DADOS_RECEBIDOS_MESSAGE, result.message_id);
      console.log(`📸 ${senderId} enviou os dados de "${conversaAnterior.fluxo_passo}" → confirmado`);
    } catch (err) {
      console.error("Erro ao confirmar recebimento de dados (Instagram):", err.message);
    }
    return;
  }

  const opcao = detectarOpcaoMenuInstagram(texto);
  if (opcao) {
    const resposta =
      opcao.resposta ||
      `Perfeito! ✅ Clica no link pra continuar no WhatsApp sobre ${opcao.produto}:\n${linkWhatsAppInstagram(opcao.produto)}`;
    try {
      const result = await ig.sendDM(senderId, resposta);
      await logInstagramOutbound(senderId, resposta, result.message_id);
      if (opcao.aguardaDados) await db.setFluxoPasso(senderId, "instagram", opcao.aguardaDados);
      console.log(`📸 ${senderId} escolheu "${opcao.produto}" → resposta enviada`);
    } catch (err) {
      console.error("Erro ao responder opção do menu (Instagram):", err.message);
    }
    return;
  }

  const isStoryReply = !!messaging.message?.reply_to?.story;
  if (isStoryReply) {
    try {
      const result = await ig.sendDM(senderId, INSTAGRAM_WELCOME_MESSAGE);
      await logInstagramOutbound(senderId, INSTAGRAM_WELCOME_MESSAGE, result.message_id);
      console.log(`📸 Reply de story de ${senderId} → DM enviada`);
    } catch (err) {
      console.error("Erro ao responder reply de story do Instagram:", err.message);
    }
    return;
  }

  const jaFoiSaudado = await db.instagramJaFoiSaudado(senderId);
  if (jaFoiSaudado) return;

  await db.instagramMarcarSaudado(senderId);
  try {
    const result = await ig.sendDM(senderId, INSTAGRAM_WELCOME_MESSAGE);
    await logInstagramOutbound(senderId, INSTAGRAM_WELCOME_MESSAGE, result.message_id);
    console.log(`📸 Primeira DM de ${senderId} → boas-vindas enviada`);
  } catch (err) {
    console.error("Erro ao enviar boas-vindas do Instagram:", err.message);
  }
}

async function processarEntryInstagram(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      if (change.field === "comments") {
        await handleInstagramComment(change.value || {});
      }
    }
    for (const messaging of e.messaging || []) {
      if (messaging.message) {
        await handleInstagramMessaging(messaging);
      }
    }
  }
}

// ─── PROCESSAR UPDATES DO TELEGRAM ───────────────────────────────────────────
async function processarUpdateTelegram(update) {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  if (!chatId) return;

  if (msg.contact) {
    const contato = msg.contact;
    await db.telegramUpsertContact({
      chat_id: String(chatId),
      telegram_user_id: contato.user_id ? String(contato.user_id) : String(msg.from?.id || ""),
      first_name: contato.first_name || msg.from?.first_name,
      last_name: contato.last_name || msg.from?.last_name,
      username: msg.from?.username,
      phone: contato.phone_number,
      created_at: Date.now(),
    });
    console.log(`📨 Contato do Telegram captado: ${contato.phone_number}`);
    try {
      await tg.sendMessage(chatId, TELEGRAM_THANKS_MESSAGE, tg.removerTeclado());
    } catch (err) {
      console.error("Erro ao confirmar contato no Telegram:", err.message);
    }
    return;
  }

  const texto = msg.text || "";
  if (texto.startsWith("/start")) {
    const startParam = texto.split(" ")[1] || null;
    await db.telegramUpsertContact({
      chat_id: String(chatId),
      telegram_user_id: String(msg.from?.id || ""),
      first_name: msg.from?.first_name,
      last_name: msg.from?.last_name,
      username: msg.from?.username,
      start_param: startParam,
      created_at: Date.now(),
    });
    try {
      await tg.sendMessage(chatId, TELEGRAM_START_MESSAGE, tg.botaoCompartilharContato("📱 Compartilhar meu contato"));
    } catch (err) {
      console.error("Erro ao enviar boas-vindas no Telegram:", err.message);
    }
  }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path_ = url.pathname;

  try {
    // GET /ping — usado pelo auto-ping (e por monitores externos) pra manter o Render acordado
    if (req.method === "GET" && path_ === "/ping") {
      return send(res, 200, { ok: true });
    }

    // POST /mcp/:token — servidor MCP (ver mcp.js) pra um Claude externo (conector customizado
    // no claude.ai, inclusive conta grátis) chamar ações reais do painel: agendar campanha de
    // WhatsApp, publicar na Agenda, criar/gerenciar campanha de anúncio. O token no PRÓPRIO path
    // é a autenticação (claude.ai manda só a URL, sem header customizado, a não ser que se
    // configure OAuth — token na URL é o jeito simples recomendado pra conector pessoal).
    const matchMcp = path_.match(/^\/mcp\/([^/]+)$/);
    if (req.method === "POST" && matchMcp) {
      if (!process.env.MCP_ACCESS_TOKEN || matchMcp[1] !== process.env.MCP_ACCESS_TOKEN) {
        return send(res, 404, "Not found");
      }
      const rpcBody = await parseBody(req);
      const resposta = await mcp.handleRpc(rpcBody, {
        db,
        wa,
        ads,
        agenda,
        google,
        PHONE_NUMBERS,
        resolverWabaDoNumero,
        normalizarTelefoneBR,
        enviarUmBroadcast,
        enviarEmail,
      });
      if (resposta === null) return send(res, 202, "");
      return send(res, 200, resposta);
    }

    // GET /webhook — verificação do Meta
    if (req.method === "GET" && path_ === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verificado pelo Meta!");
        return send(res, 200, challenge);
      }
      console.warn("❌ Verificação falhou — token incorreto");
      return send(res, 403, "Forbidden");
    }

    // POST /webhook — mensagens recebidas
    if (req.method === "POST" && path_ === "/webhook") {
      const body = await parseBody(req);
      if (body.object === "whatsapp_business_account") {
        await processarEntry(body.entry || []);
        return send(res, 200, "OK");
      }
      return send(res, 404, "Not found");
    }

    // POST /webhook/flow-data — endpoint de dados do WhatsApp Flow de FGTS (autopreenchimento
    // de CEP). Sem requireAuth de propósito: é a Meta chamando (com criptografia própria do
    // protocolo de Flow), não o navegador do painel. Ver flow-crypto.js.
    if (req.method === "POST" && path_ === "/webhook/flow-data") {
      const body = await parseBody(req);
      // Descriptografia falhou (chave errada/corrompida) — Meta espera 421 especificamente
      // aqui, não 500, pra saber que precisa buscar a chave pública de novo (achado na revisão
      // final: sem esse try, isso ia parar no catch genérico do servidor, devolvendo 500).
      let decrypted;
      try {
        decrypted = flowCrypto.decrypt(body.encrypted_flow_data, body.encrypted_aes_key, body.initial_vector);
      } catch (err) {
        console.error("Falha ao descriptografar requisição do Flow:", err.message);
        return send(res, 421, "Failed to decrypt");
      }
      const { request, aesKey, iv } = decrypted;
      let respostaPayload;
      if (request.action === "ping") {
        respostaPayload = { data: { status: "active" } };
      } else if (request.action === "data_exchange" && request.screen === "ENDERECO" && /^\d{8}$/.test(String(request.data?.cep || "").replace(/\D/g, ""))) {
        const cepLimpo = String(request.data.cep).replace(/\D/g, "");
        try {
          const viaCepResp = await new Promise((resolve, reject) => {
            const reqViaCep = https
              .get(`https://viacep.com.br/ws/${cepLimpo}/json/`, (r) => {
                let buf = "";
                r.on("data", (c) => (buf += c));
                r.on("end", () => {
                  // JSON.parse aqui dentro (callback de evento, fora da pilha síncrona da
                  // Promise) derrubava o processo inteiro se a resposta não fosse JSON válido —
                  // achado na revisão final. try/catch + reject em vez de deixar escapar.
                  try {
                    resolve(JSON.parse(buf));
                  } catch (err) {
                    reject(err);
                  }
                });
              })
              .on("error", reject);
            reqViaCep.setTimeout(8000, () => reqViaCep.destroy(new Error("Timeout ao consultar ViaCEP")));
          });
          respostaPayload = {
            screen: "ENDERECO",
            data: {
              rua: viaCepResp.logradouro || "",
              bairro: viaCepResp.bairro || "",
              cidade: viaCepResp.localidade || "",
              uf: viaCepResp.uf || "",
            },
          };
        } catch (err) {
          console.error("Falha ao consultar ViaCEP:", err.message);
          respostaPayload = { screen: "ENDERECO", data: { rua: "", bairro: "", cidade: "", uf: "" } };
        }
      } else {
        respostaPayload = { screen: request.screen, data: {} };
      }
      const respostaCriptografada = flowCrypto.encrypt(respostaPayload, aesKey, iv);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(respostaCriptografada);
      return;
    }

    // GET /webhook/instagram — verificação do Meta
    if (req.method === "GET" && path_ === "/webhook/instagram") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === INSTAGRAM_VERIFY_TOKEN) {
        console.log("✅ Webhook do Instagram verificado pelo Meta!");
        return send(res, 200, challenge);
      }
      console.warn("❌ Verificação do Instagram falhou — token incorreto");
      return send(res, 403, "Forbidden");
    }

    // POST /webhook/instagram — comentários e DMs recebidos
    if (req.method === "POST" && path_ === "/webhook/instagram") {
      const body = await parseBody(req);
      if (body.object === "instagram") {
        await processarEntryInstagram(body.entry || []);
        return send(res, 200, "OK");
      }
      return send(res, 404, "Not found");
    }

    // POST /webhook/telegram — updates do bot (mensagens, /start, contato compartilhado)
    if (req.method === "POST" && path_ === "/webhook/telegram") {
      if (TELEGRAM_WEBHOOK_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== TELEGRAM_WEBHOOK_SECRET) {
        return send(res, 401, "Unauthorized");
      }
      const body = await parseBody(req);
      await processarUpdateTelegram(body);
      return send(res, 200, "OK");
    }

    // Chat próprio do site FelizCred. A parte pública usa um segredo aleatório por conversa;
    // atendentes acessam a caixa de entrada pelas rotas autenticadas do painel.
    if (path_.startsWith("/site-chat/")) {
      const corsHeaders = siteChatCors(req);
      if (req.method === "OPTIONS") {
        if (!corsHeaders["Access-Control-Allow-Origin"]) return send(res, 403, { error: "Origem não permitida" });
        res.writeHead(204, corsHeaders);
        return res.end();
      }
      if (!corsHeaders["Access-Control-Allow-Origin"]) return send(res, 403, { error: "Origem não permitida" });

      const trackingMatch = path_.match(/^\/site-chat\/proposal\/([A-Za-z0-9_-]{40,})$/);
      if (req.method === "GET" && trackingMatch) {
        if (!siteChatRateLimit(req)) return send(res, 429, { error: "Muitas consultas. Aguarde um instante." }, corsHeaders);
        let row = await db.siteChatCltObterPorTrackingToken(trackingMatch[1]);
        if (!row) return send(res, 404, { error: "Link de acompanhamento inválido." }, corsHeaders);
        row = await sincronizarSiteChatClt(row);
        const conversation = await db.siteChatObter(row.conversation_id);
        return send(res, 200, { proposal: acompanhamentoCltPublico(row, conversation) }, corsHeaders);
      }

      // Entrada pelo link do e-mail ("Acessar minha simulação"): troca o código do link por uma sessão nova do chat e
      // confirma o e-mail. Funciona em qualquer aparelho; vale por 30 dias desde a última atividade.
      if (req.method === "POST" && path_ === "/site-chat/access") {
        if (!siteChatRecoveryRateLimit(req)) return send(res, 429, { error: "Muitas tentativas. Aguarde dez minutos e tente novamente." }, corsHeaders);
        const body = await parseBody(req);
        const cltAcesso = await db.siteChatCltObterPorTrackingToken(String(body.token || ""));
        const conversaAcesso = cltAcesso ? await db.siteChatObter(cltAcesso.conversation_id) : null;
        if (!conversaAcesso || Date.now() - Number(conversaAcesso.updated_at || 0) > 30 * 24 * 3600_000) {
          return send(res, 404, { error: "Esse link expirou. Abra o chat e informe seus dados para continuar." }, corsHeaders);
        }
        const token = crypto.randomBytes(32).toString("hex");
        const conversation = await db.siteChatRenovarToken(conversaAcesso.id, crypto.createHash("sha256").update(token).digest("hex"));
        await db.siteChatMarcarEmailConfirmado(conversation.id);
        const clt = await garantirTrackingToken(await sincronizarSiteChatClt(cltAcesso));
        return send(res, 200, {
          conversation: { id: conversation.id, name: conversation.name, contact: conversation.contact, email: conversation.email, status: conversation.status },
          token,
          messages: await db.siteChatMensagens(conversation.id),
          clt: siteChatCltPublico(clt),
        }, corsHeaders);
      }

      if (req.method === "POST" && path_ === "/site-chat/recover") {
        if (!siteChatRecoveryRateLimit(req)) return send(res, 429, { error: "Muitas tentativas. Aguarde dez minutos e tente novamente." }, corsHeaders);
        const body = await parseBody(req);
        const cpf = String(body.cpf || "").replace(/\D/g, "");
        const referencia = String(body.reference || "").replace(/\D/g, "");
        if (!novosaque.cpfValido(cpf)) return send(res, 400, { error: "Digite um CPF válido." }, corsHeaders);
        if (referencia.length < 4) return send(res, 400, { error: "Informe o número da proposta ou o celular usado no atendimento." }, corsHeaders);
        const found = await db.siteChatRecuperarClt(cpf, referencia);
        if (!found?.conversation || !found?.clt) return send(res, 404, { error: "Não encontramos uma solicitação com esses dados. Confira e tente novamente." }, corsHeaders);
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const conversation = await db.siteChatRenovarToken(found.conversation.id, tokenHash);
        const clt = await garantirTrackingToken(await sincronizarSiteChatClt(found.clt));
        return send(res, 200, {
          conversation: { id: conversation.id, name: conversation.name, contact: conversation.contact, email: conversation.email, status: conversation.status },
          token,
          messages: await db.siteChatMensagens(conversation.id),
          clt: siteChatCltPublico(clt),
        }, corsHeaders);
      }

      if (req.method === "POST" && path_ === "/site-chat/conversations") {
        if (!siteChatRateLimit(req)) return send(res, 429, { error: "Muitas mensagens. Aguarde um instante." }, corsHeaders);
        const body = await parseBody(req);
        const name = String(body.name || "").trim().slice(0, 80);
        const contact = String(body.contact || "").trim().slice(0, 160);
        const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
        const message = String(body.message || "").trim().slice(0, 2000);
        const pageUrl = String(body.pageUrl || "").trim().slice(0, 500);
        const whatsappOptIn = body.whatsappOptIn === true;
        const celularValido = /^\d{10,11}$/.test(contact.replace(/\D/g, ""));
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (name.length < 2 || !celularValido || !emailValido || !message) {
          return send(res, 400, { error: "Informe seu nome, celular com DDD, e-mail válido e escolha um assunto." }, corsHeaders);
        }
        const id = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        let produtoTag = null;
        try { produtoTag = await gemini.classificarProdutoSite(message); }
        catch { produtoTag = /fgts/i.test(message) ? "FGTS" : /clt/i.test(message) ? "Empréstimo CLT" : /carro/i.test(message) ? "Carro em garantia" : null; }
        const conversation = await db.siteChatCriar({
          id,
          tokenHash,
          name,
          contact,
          email,
          pageUrl,
          message,
          produtoTag,
          whatsappOptIn,
          whatsappOptInVersion: WHATSAPP_OPT_IN_VERSION,
          whatsappOptInText: WHATSAPP_OPT_IN_TEXT,
        });
        enviarInicioChatFelizcred({ nome: name, email }).catch((err) => console.error(`E-mail inicial do chat não enviado (${id}):`, err.message));
        // Salva quem preencheu o formulário do site: lista de contatos do Brevo e Google Contatos
        // (prefixo "SITE" pra distinguir dos outros funis). Em segundo plano, nunca atrasa o chat.
        garantirListaBrevo()
          .then((listaId) => salvarContatoBrevo({ email, nome: name, telefone: contact, origem: "site-chat", listIds: [listaId] }))
          .catch((err) => console.error(`Contato do site não salvo no Brevo (${id}):`, err.message));
        if (google.configurado()) {
          const digitosContato = contact.replace(/\D/g, "");
          google
            .criarContato({ nome: `SITE - ${name}`, telefone: digitosContato.startsWith("55") ? digitosContato : `55${digitosContato}`, email })
            .catch((err) => console.error(`Contato do site não salvo no Google (${id}):`, err.message));
        }
        if (produtoTag === "Empréstimo CLT") {
          await db.siteChatFunilEvento(id, "entrada", "inicio", "facta");
          await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Para fazer a simulação do consignado CLT, você precisa ter mais de 3 meses de registro no trabalho atual. Você já completou esse período?");
        }
        return send(res, 201, { conversation, token, messages: await db.siteChatMensagens(id) }, corsHeaders);
      }

      const cltMatch = path_.match(/^\/site-chat\/conversations\/([a-f0-9-]+)\/clt\/(start|status|confirm-authorization|resend-authorization|select-offer|resimulate|access-email|personal-data|assistant)$/i);
      if (cltMatch) {
        const id = cltMatch[1];
        const action = cltMatch[2].toLowerCase();
        const conversation = await db.siteChatObter(id);
        const token = String(req.headers["x-chat-token"] || "");
        if (!siteChatTokenValido(conversation, token)) return send(res, 404, { error: "Conversa não encontrada" }, corsHeaders);
        if (action === "status" && req.method === "GET") {
          const row = await garantirTrackingToken(await sincronizarSiteChatClt(await db.siteChatCltObter(id)));
          return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
        }
        if (req.method !== "POST") return send(res, 405, { error: "Método não permitido" }, corsHeaders);
        if (!siteChatRateLimit(req)) return send(res, 429, { error: "Muitas tentativas. Aguarde um instante." }, corsHeaders);
        const body = await parseBody(req);
        try {
          if (action === "assistant") {
            const mensagem = String(body.message || "").trim().slice(0, 1000);
            if (!mensagem) return send(res, 400, { error: "Mensagem vazia." }, corsHeaders);
            const row = await db.siteChatCltObter(id);
            const mensagemMascarada = mensagem
              .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[e-mail]")
              .replace(/\b\d{11}\b/g, "[documento ou telefone]")
              .replace(/\b\d{10}\b/g, "[telefone]")
              .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]");
            const resposta = await gemini.responderConversaCltSite({ mensagem: mensagemMascarada, etapa: row?.etapa || "qualificação de 3 meses" });
            if (resposta) await db.siteChatMensagemAtendente(id, "Assistente FelizCred", resposta);
            return send(res, 200, { resposta }, corsHeaders);
          }
          if (action === "start") {
            if (await db.siteChatCltObter(id)) return send(res, 409, { error: "A simulação já foi iniciada." }, corsHeaders);
            const cpf = String(body.cpf || "").replace(/\D/g, "");
            const phone = String(body.phone || "").replace(/\D/g, "");
            const fullName = String(body.name || conversation.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
            if (!novosaque.cpfValido(cpf)) return send(res, 400, { error: "Digite um CPF válido." }, corsHeaders);
            if (phone.length < 10 || phone.length > 13) return send(res, 400, { error: "Digite um celular com DDD." }, corsHeaders);
            if (fullName.split(" ").filter(Boolean).length < 2) return send(res, 400, { error: "Digite seu nome completo, como aparece no documento." }, corsHeaders);
            // Regra do CPF: o cliente que digitou o CPF e ainda não está no Google Contatos é salvo
            // como "FGTS <nome> <CPF>". Não bloqueia o atendimento se o Google falhar.
            if (google.configurado()) {
              const telefoneGoogle = phone.startsWith("55") && phone.length >= 12 ? phone : `55${phone}`;
              google.garantirContato({ telefone: telefoneGoogle, nomePerfil: nomeContatoComCpf(cpf, fullName) })
                .catch((err) => console.error("Erro ao salvar contato do site com CPF no Google:", err.message));
            }
            let row = await db.siteChatFactaCriar(id, { cpf, phone, etapa: "solicitando_autorizacao", status: "SOLICITANDO_AUTORIZACAO", trackingToken: crypto.randomBytes(32).toString("base64url") });
            row = await db.siteChatCltAtualizar(id, { facta_worker_json: JSON.stringify({ preAuthorization: { nome: fullName } }) });
            await db.siteChatFunilEvento(id, "dados_minimos_enviados", "cpf_consentimento", "facta");
            await db.siteChatFunilEvento(id, "provedor_tentado", "solicitando_autorizacao", "facta");
            await db.siteChatDefinirProduto(id, "Empréstimo CLT");
            await db.siteChatDefinirPipeline(id, "qualificacao");
            const authorization = (await autorizacaoFactaVigente(cpf))
              ? { mensagem: "Cliente não necessita de autorização" }
              : await facta.solicitarAutorizacao({ nome: fullName, cpf, celular: formatarCelularFacta(phone) });
            const authMessage = mensagemFacta(authorization);
            if (respostaFactaComErro(authorization) || /telefone j[aá] informado para outro cpf/i.test(authMessage)) {
              await db.siteChatFunilEvento(id, "saida", "erro_autorizacao", "facta", "erro_autorizacao");
              row = await db.siteChatCltAtualizar(id, { etapa: "erro_autorizacao", status_novosaque: "ERRO_AUTORIZACAO", error_message: authMessage });
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", siteChatRules.mensagemErroAutorizacao(authMessage));
            } else {
              await db.siteChatFunilEvento(id, "autorizacao_enviada", "autorizacao_enviada", "facta");
              const alreadyAuthorized = /n[aã]o necessita de autoriza/i.test(authMessage);
              row = await db.siteChatCltAtualizar(id, {
                etapa: "autorizacao_enviada",
                status_novosaque: alreadyAuthorized ? "JA_AUTORIZADO" : "AUTORIZACAO_ENVIADA",
                authorization_requested_at: Date.now(),
                authorization_checked_at: null,
                error_message: null,
              });
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", alreadyAuthorized
                ? "Sua autorização ainda está válida. Já estamos consultando suas condições."
                : "Enviamos a autorização da Facta para seu WhatsApp. Abra o WhatsApp, toque no link da mensagem e autorize a consulta. Depois volte aqui: sua simulação fica salva nesta mesma tela, é só tocar em Já autorizei.");
              if (alreadyAuthorized) row = await sincronizarSiteChatFacta(row);
            }
            return send(res, 201, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
          const atual = await db.siteChatCltObter(id);
          if (!atual) return send(res, 409, { error: "Inicie a simulação primeiro." }, corsHeaders);
          if (action === "confirm-authorization") {
            if (atual.provider !== "facta" || atual.etapa !== "autorizacao_enviada") return send(res, 409, { error: "Esta confirmação não está disponível nesta etapa." }, corsHeaders);
            const unlocked = await db.siteChatCltAtualizar(id, { authorization_checked_at: null, error_message: null });
            const row = await sincronizarSiteChatFacta(unlocked);
            return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
          if (action === "resend-authorization") {
            if (atual.provider !== "facta") return send(res, 409, { error: "Esta solicitação não pertence à Facta." }, corsHeaders);
            let saved = {};
            try { saved = JSON.parse(atual.facta_worker_json || "{}").preAuthorization || {}; } catch {}
            const fullName = String(body.name || saved.nome || conversation.name || "").trim().replace(/\s+/g, " ").slice(0, 120);
            const phone = String(body.phone || atual.phone || "").replace(/\D/g, "");
            // O cliente pode corrigir o CPF no formulário de reenvio; sem CPF válido, mantém o salvo.
            const cpfNovo = String(body.cpf || "").replace(/\D/g, "");
            const cpf = novosaque.cpfValido(cpfNovo) ? cpfNovo : atual.cpf;
            if (fullName.split(" ").filter(Boolean).length < 2) return send(res, 400, { error: "Digite seu nome completo, como aparece no documento." }, corsHeaders);
            if (phone.length < 10 || phone.length > 13) return send(res, 400, { error: "Digite um celular com DDD." }, corsHeaders);
            const vigente = await autorizacaoFactaVigente(cpf);
            const authorization = vigente
              ? { mensagem: "Cliente não necessita de autorização" }
              : await facta.solicitarAutorizacao({ nome: fullName, cpf: cpf, celular: formatarCelularFacta(phone) });
            const authMessage = mensagemFacta(authorization);
            const failed = respostaFactaComErro(authorization) || /telefone j[aá] informado para outro cpf/i.test(authMessage);
            const row = await db.siteChatCltAtualizar(id, {
              phone,
              cpf,
              facta_worker_json: JSON.stringify({ preAuthorization: { nome: fullName } }),
              etapa: failed ? "erro_autorizacao" : "autorizacao_enviada",
              status_novosaque: failed ? "ERRO_AUTORIZACAO" : vigente ? "JA_AUTORIZADO" : "AUTORIZACAO_REENVIADA",
              authorization_requested_at: Date.now(), authorization_checked_at: null,
              error_message: failed ? authMessage : null,
            });
            if (vigente && !failed) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Sua autorização ainda está válida. Já estamos consultando suas condições.");
              return send(res, 200, { clt: siteChatCltPublico(await sincronizarSiteChatFacta(row)) }, corsHeaders);
            }
            return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
          if (action === "access-email") {
            // "Salvar minha simulação": manda o link de acesso (sem senha) para o e-mail que o cliente já informou.
            const emailCliente = String(conversation.email || "").trim();
            if (!emailCliente) return send(res, 400, { error: "Não temos um e-mail para enviar o acesso." }, corsHeaders);
            if (!atual) return send(res, 400, { error: "A simulação ainda não começou." }, corsHeaders);
            const comToken = await garantirTrackingToken(atual);
            const link = `https://www.felizcred.com.br/minha-simulacao/?t=${encodeURIComponent(comToken.tracking_token)}&utm_source=email&utm_medium=acesso`;
            await enviarAcessoSimulacaoFelizcred({ nome: conversation.name, email: emailCliente, link });
            const [usuario, dominio] = emailCliente.split("@");
            return send(res, 200, { sent: true, email: `${usuario.slice(0, 2)}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}` }, corsHeaders);
          }
          if (action === "resimulate" && atual?.provider === "facta") {
            // O cliente pode escolher qualquer parcela até o máximo da margem: refaz a consulta com o valor digitado.
            if (atual.etapa !== "ofertas_disponiveis") return send(res, 400, { error: "Essa simulação não está disponível agora." }, corsHeaders);
            const pedido = numeroFacta(body.installmentValue);
            const maximo = Number(atual.margem_disponivel || 0);
            if (!(pedido > 0)) return send(res, 400, { error: "Digite o valor da parcela, por exemplo 250,00." }, corsHeaders);
            if (pedido > maximo + 0.005) return send(res, 400, { error: `Essa parcela passa do máximo disponível de R$ ${maximo.toFixed(2).replace(".", ",")}. Digite um valor menor.` }, corsHeaders);
            let workerResim = {};
            try { workerResim = JSON.parse(atual.facta_worker_json || "{}"); } catch {}
            const operacoes = await facta.consultarOperacoes({
              opcao_valor: 2,
              valor_parcela: pedido.toFixed(2),
              cpf: atual.cpf,
              data_nascimento: normalizarDataFacta(workerResim.dataNascimento),
              valor_renda: numeroFacta(workerResim.valorTotalVencimentos).toFixed(2),
            });
            const novasOfertas = respostaFactaComErro(operacoes) ? [] : ofertasFacta(operacoes);
            if (!novasOfertas.length) return send(res, 400, { error: "Não encontramos condições para essa parcela. Tente outro valor." }, corsHeaders);
            const row = await db.siteChatCltAtualizar(id, { offers_json: JSON.stringify(novasOfertas), error_message: null });
            return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
          if (action === "select-offer") {
            let offers = [];
            try { offers = JSON.parse(atual.offers_json || "[]"); } catch {}
            const offer = offers.find((o, index) => `${o.codigoTabela ?? index}:${o.prazo}` === String(body.offerId));
            if (!offer || atual.etapa !== "ofertas_disponiveis") return send(res, 400, { error: "Escolha uma condição disponível." }, corsHeaders);
            let worker = {};
            try { worker = JSON.parse(atual.facta_worker_json || "{}"); } catch {}
            const policy = await facta.analisarPolitica({
              cpf: atual.cpf, matricula: worker.matricula,
              dataNascimento: normalizarDataFacta(worker.dataNascimento),
              dataAdmissao: normalizarDataFacta(worker.dataAdmissao),
              prazo: offer.prazo, valorEmprestimo: Number(offer.contrato || 0).toFixed(2),
            });
            if (String(policy?.aprovado) !== "1") {
              await db.siteChatFunilEvento(id, "saida", "politica_reprovada", "facta", "politica_reprovada");
              const row = await db.siteChatCltAtualizar(id, { etapa: "politica_reprovada", status_novosaque: "POLITICA_REPROVADA", error_message: mensagemFacta(policy, "A condição não passou pela política de crédito da Facta.") });
              return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
            }
            const loginCertificado = String(process.env.FACTA_LOGIN_CERTIFICADO || "").trim();
            if (!loginCertificado) throw new Error("FACTA_LOGIN_CERTIFICADO não configurado");
            const simulation = await facta.criarSimulacao({
              cpf: atual.cpf, data_nascimento: normalizarDataFacta(worker.dataNascimento),
              login_certificado: loginCertificado, codigo_tabela: offer.codigoTabela,
              prazo: offer.prazo, valor_operacao: offer.contrato, valor_parcela: offer.parcela,
              coeficiente: offer.coeficiente,
            });
            if (respostaFactaComErro(simulation) || !simulation?.id_simulador) throw new Error(mensagemFacta(simulation, "A Facta não criou a simulação selecionada."));
            const row = await db.siteChatCltAtualizar(id, { transaction_id: String(simulation.id_simulador), facta_offer_json: JSON.stringify(offer), etapa: "dados_pessoais", status_novosaque: "SIMULACAO_CRIADA", error_message: null });
            await db.siteChatFunilEvento(id, "oferta_selecionada", "dados_pessoais", "facta");
            return send(res, 200, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
          if (action === "personal-data") {
            if (atual.provider !== "facta" || atual.etapa !== "dados_pessoais" || !atual.transaction_id) return send(res, 409, { error: "Selecione uma condição antes de enviar seus dados." }, corsHeaders);
            if (process.env.FACTA_PROPOSAL_ENABLED !== "true") throw new Error("FACTA_PROPOSAL_ENABLED não configurado");
            const customer = somenteCamposFacta(body.customer, ["nome", "sexo", "estado_civil", "data_nascimento", "rg", "estado_rg", "orgao_emissor", "data_expedicao", "estado_natural", "cidade_natural_nome", "nacionalidade", "celular", "renda", "cep", "endereco", "numero", "complemento", "bairro", "cidade_nome", "estado", "nome_mae", "nome_pai", "valor_patrimonio", "cliente_iletrado_impossibilitado", "tipo_conta", "banco", "agencia", "conta", "email", "matricula", "cnpj_empregador", "data_admissao", "tipo_chave_pix", "chave_pix", "nome_a_rogo", "cpf_a_rogo", "nome_a_rogo_testemunha", "cpf_a_rogo_testemunha"]);
            let worker = {};
            try { worker = JSON.parse(atual.facta_worker_json || "{}"); } catch {}
            Object.assign(customer, {
              nome: worker.nome || customer.nome,
              sexo: worker.sexo_codigo || customer.sexo,
              data_nascimento: worker.dataNascimento || customer.data_nascimento,
              celular: atual.phone || customer.celular,
              renda: worker.valorTotalVencimentos || customer.renda,
              nome_mae: worker.nomeMae || customer.nome_mae,
              matricula: worker.matricula || customer.matricula,
              cnpj_empregador: worker.numeroInscricaoEmpregador || customer.cnpj_empregador,
              data_admissao: worker.dataAdmissao || customer.data_admissao,
            });
            const required = ["nome", "sexo", "estado_civil", "data_nascimento", "rg", "estado_rg", "orgao_emissor", "data_expedicao", "estado_natural", "cidade_natural_nome", "nacionalidade", "celular", "renda", "cep", "endereco", "numero", "bairro", "cidade_nome", "estado", "nome_mae", "nome_pai", "valor_patrimonio", "cliente_iletrado_impossibilitado", "tipo_conta", "banco", "agencia", "conta", "matricula", "cnpj_empregador", "data_admissao", "tipo_chave_pix", "chave_pix"];
            if (required.some((field) => !customer[field])) return send(res, 400, { error: "Preencha todos os campos obrigatórios para gerar a proposta." }, corsHeaders);
            if (customer.cliente_iletrado_impossibilitado === "S" && ["nome_a_rogo", "cpf_a_rogo", "nome_a_rogo_testemunha", "cpf_a_rogo_testemunha"].some((field) => !customer[field])) return send(res, 400, { error: "Preencha os dados de assinatura a rogo e da testemunha." }, corsHeaders);
            if (customer.tipo_chave_pix === "1" && customer.chave_pix.replace(/\D/g, "") !== atual.cpf) return send(res, 400, { error: "Quando a chave Pix for CPF, ela precisa ser o mesmo CPF da proposta." }, corsHeaders);
            const cityResponse = await facta.consultarCombo("cidade", { estado: customer.estado, nome_cidade: customer.cidade_nome });
            const naturalCityResponse = await facta.consultarCombo("cidade", { estado: customer.estado_natural, nome_cidade: customer.cidade_natural_nome });
            const cityEntries = Object.entries(cityResponse?.cidade || {});
            const naturalEntries = Object.entries(naturalCityResponse?.cidade || {});
            const normalizeName = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
            const city = cityEntries.find(([, value]) => normalizeName(value?.nome) === normalizeName(customer.cidade_nome)) || cityEntries[0];
            const naturalCity = naturalEntries.find(([, value]) => normalizeName(value?.nome) === normalizeName(customer.cidade_natural_nome)) || naturalEntries[0];
            if (!city || !naturalCity) return send(res, 400, { error: "Não localizamos uma das cidades informadas. Confira cidade e estado." }, corsHeaders);
            const stage2Payload = { ...customer };
            delete stage2Payload.cidade_nome;
            delete stage2Payload.cidade_natural_nome;
            const stage2 = await facta.cadastrarDadosPessoais({
              id_simulador: atual.transaction_id, cpf: atual.cpf, ...stage2Payload,
              data_nascimento: normalizarDataFacta(customer.data_nascimento),
              data_expedicao: normalizarDataFacta(customer.data_expedicao),
              data_admissao: normalizarDataFacta(customer.data_admissao),
              cidade: city[0], cidade_natural: naturalCity[0],
              celular: formatarCelularFacta(customer.celular),
            });
            if (respostaFactaComErro(stage2) || !stage2?.codigo_cliente) throw new Error(mensagemFacta(stage2, "A Facta não aceitou os dados pessoais."));
            const proposal = await facta.criarProposta({ codigo_cliente: stage2.codigo_cliente, id_simulador: atual.transaction_id, tipo_formalizacao: "DIG" });
            if (respostaFactaComErro(proposal) || !proposal?.codigo || !proposal?.url_formalizacao) throw new Error(mensagemFacta(proposal, "A Facta não devolveu o código e o link de assinatura da proposta."));
            const contractLink = /^https?:\/\//i.test(String(proposal.url_formalizacao)) ? proposal.url_formalizacao : `https://${proposal.url_formalizacao}`;
            await facta.enviarLinkAssinatura(proposal.codigo, "whatsapp").catch((linkError) => console.error(`Link Facta não enviado por WhatsApp (${id}):`, linkError.message));
            await db.siteChatDefinirPipeline(id, "documentos");
            await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Proposta gerada. Revise todas as condições e assine somente se estiver de acordo.");
            const row = await db.siteChatCltAtualizar(id, { codigo_cliente: String(stage2.codigo_cliente), codigo_proposta: String(proposal.codigo), contract_link: contractLink, etapa: "aguardando_assinatura_facta", status_novosaque: "PROPOSTA_CRIADA", authorization_checked_at: null, error_message: null });
            await db.siteChatFunilEvento(id, "proposta_criada", "aguardando_assinatura_facta", "facta");
            notificarEtapaFactaPorEmail(row, "aguardando_assinatura_facta").catch((err) => console.error(`E-mail de assinatura não enviado (${id}):`, err.message));
            return send(res, 201, { clt: siteChatCltPublico(row) }, corsHeaders);
          }
        } catch (err) {
          console.error(`Erro no fluxo CLT do site (${id}/${action}):`, err.message);
          const existing = await db.siteChatCltObter(id).catch(() => null);
          const publicReason = motivoPublicoErroFacta(err);
          const failureChanges = { error_message: publicReason };
          if (existing?.provider === "facta" && ["solicitando_autorizacao", "erro_autorizacao", "erro_integracao"].includes(existing.etapa)) {
            Object.assign(failureChanges, { etapa: "erro_integracao", status_novosaque: "ERRO_INTEGRACAO" });
          }
          await db.siteChatCltAtualizar(id, failureChanges).catch(() => {});
          const configurationError = /FACTA_BRIDGE_URL|FACTA_BRIDGE_SECRET|FACTA_LOGIN_CERTIFICADO|FACTA_PROPOSAL_ENABLED|não configurados/i.test(err.message);
          return send(res, 502, {
            error: publicReason,
            code: configurationError ? "FACTA_CONFIG_MISSING" : "FACTA_REQUEST_FAILED",
            providerStatus: Number(err.httpStatus) || null,
          }, corsHeaders);
        }
      }

      const publicMatch = path_.match(/^\/site-chat\/conversations\/([a-f0-9-]+)$/i);
      if (publicMatch && (req.method === "GET" || req.method === "POST")) {
        const id = publicMatch[1];
        const conversation = await db.siteChatObter(id);
        const token = String(req.headers["x-chat-token"] || "");
        if (!siteChatTokenValido(conversation, token)) return send(res, 404, { error: "Conversa não encontrada" }, corsHeaders);
        if (req.method === "GET") {
          return send(res, 200, {
            conversation: { id: conversation.id, name: conversation.name, status: conversation.status, updated_at: conversation.updated_at },
            messages: await db.siteChatMensagens(id),
          }, corsHeaders);
        }
        if (!siteChatRateLimit(req)) return send(res, 429, { error: "Muitas mensagens. Aguarde um instante." }, corsHeaders);
        const body = await parseBody(req);
        const message = String(body.message || "").trim().slice(0, 2000);
        let media;
        try { media = salvarMidiaSite(req, body); } catch (err) { return send(res, 400, { error: err.message }, corsHeaders); }
        if (!message && !media.url) return send(res, 400, { error: "Escreva uma mensagem ou envie um arquivo." }, corsHeaders);
        await db.siteChatMensagemVisitante(id, conversation.name, message, media);
        // Atendente respondeu há pouco pelo painel (ou ainda está na conversa): o assistente automático fica calado.
        if (Number(conversation.bot_pausado_ate || 0) > Date.now()) {
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: true, botPausado: true }, corsHeaders);
        }
        const normalizadaHumano = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const pediuHumano = /\b(falar|conversar|chamar).{0,18}\b(humano|pessoa|atendente|atendimento)\b|\bquero (?:um |uma )?(?:humano|atendente)\b/i.test(message);
        const confirmouHumano = /^(sim|s|quero|pode|confirmo|sim por favor|quero sim)[!. ]*$/.test(normalizadaHumano);
        const recusouHumano = /^(nao|n|agora nao|continuar|quero continuar|nao preciso)[!. ]*$/.test(normalizadaHumano);
        const etapaHumano = String(conversation.human_intent_stage || "");
        if (etapaHumano === "requested" || etapaHumano === "human_active") {
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: true }, corsHeaders);
        }
        if (etapaHumano === "awaiting_confirmation") {
          if (confirmouHumano) {
            await db.siteChatConfirmarHumano(id);
            await db.siteChatFunilEvento(id, "handoff_humano", "atendimento", conversation.produto_tag || null, "confirmado");
            await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Certo. Seu pedido foi enviado ao Felipe, junto com esta conversa. Você pode continuar por aqui e verá a resposta neste chat.");
            return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: true }, corsHeaders);
          }
          if (recusouHumano) {
            await db.siteChatLimparHumano(id);
            await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Tudo bem. Continuo com você por aqui. Use a opção da etapa atual ou escreva sua próxima dúvida.");
            return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: false }, corsHeaders);
          }
          await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Você ainda deseja falar com o atendimento humano? Responda sim ou não.");
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: false }, corsHeaders);
        }
        if (etapaHumano === "awaiting_question") {
          const row = await db.siteChatCltObter(id).catch(() => null);
          let resposta = "Entendi. Posso orientar você por aqui e acompanhar sua contratação nesta mesma conversa.";
          try {
            resposta = await gemini.responderConversaSite({ mensagem: message, etapa: row?.etapa || "conversa inicial", produto: conversation.produto_tag }) || resposta;
          } catch (err) { console.error(`Gemini não respondeu à dúvida pré-handoff ${id}:`, err.message); }
          await db.siteChatDefinirIntencaoHumano(id, "awaiting_confirmation");
          await db.siteChatMensagemAtendente(id, "Assistente FelizCred", `${resposta}\n\nO atendimento humano fará esse mesmo acompanhamento: vai guiar a contratação e explicar qualquer retorno do banco. Você ainda deseja falar com o atendimento humano?`);
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: false, awaitingHumanConfirmation: true }, corsHeaders);
        }
        if (pediuHumano) {
          await db.siteChatDefinirIntencaoHumano(id, "awaiting_question");
          await db.siteChatFunilEvento(id, "intencao_humano", "duvida", conversation.produto_tag || null);
          await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Claro. Para eu ajudar primeiro, diga em poucas palavras qual é a sua dúvida.");
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoff: false }, corsHeaders);
        }
        // Enquanto a autorização está com erro, qualquer mensagem recebe a orientação fixa: sem Gemini
        // e sem o aviso de repetição, que levava o cliente para o WhatsApp sem resolver nada.
        const cltErro = conversation.produto_tag === "Empréstimo CLT" ? await db.siteChatCltObter(id).catch(() => null) : null;
        if (message && cltErro?.etapa === "erro_autorizacao") {
          // Não repete o mesmo aviso: se a última mensagem do atendimento já é essa, o cliente só vê ela uma vez.
          const textoErro = siteChatRules.mensagemErroAutorizacao(cltErro.error_message);
          const ultimaDoAtendimento = [...(await db.siteChatMensagens(id))].reverse().find((m) => m.direction === "agent");
          if (ultimaDoAtendimento?.body !== textoErro) await db.siteChatMensagemAtendente(id, "Assistente FelizCred", textoErro);
          return send(res, 201, { ok: true, clt: true, cltStep: "erro_autorizacao" }, corsHeaders);
        }
        // Escalonamento determinístico: se o visitante precisou repetir a mesma solicitação,
        // não deixamos o Gemini insistir na mesma resposta. A mensagem atual já foi salva acima,
        // portanto duas ocorrências semelhantes nas mensagens recentes significam repetição real.
        const mensagensRecentes = (await db.siteChatMensagens(id)).slice(-12);
        const mensagemEhCpf = message.replace(/\D/g, "").length === 11; // reenviar o CPF é tentar de novo, não repetição
        if (message && !mensagemEhCpf && siteChatRules.solicitacaoRepetida(message, mensagensRecentes)) {
          await db.siteChatMensagemAtendente(id, "Assistente FelizCred", siteChatRules.encaminhamentoWhatsAppPorRepeticao());
          await db.siteChatFunilEvento(id, "handoff_whatsapp_repeticao", "atendimento", conversation.produto_tag || null);
          return send(res, 201, { ok: true, clt: conversation.produto_tag === "Empréstimo CLT", handoffWhatsapp: true }, corsHeaders);
        }
        const pediuClt = /\b(clt|consignado(?:\s+(?:clt|privado))?|carteira assinada|cr[eé]dito (?:do |para o )?trabalhador)\b/i.test(message);
        let conversaClt = pediuClt || conversation.produto_tag === "Empréstimo CLT";
        if (!conversaClt && message) {
          const recentes = (await db.siteChatMensagens(id)).slice(-10);
          conversaClt = recentes.some((m) => m.direction === "visitor" && /\b(clt|consignado(?:\s+clt)?)\b/i.test(m.body || ""));
        }
        // Fora das expressões inequívocas acima, o Gemini só classifica a intenção. Se detectar
        // CLT, entrega imediatamente ao fluxo determinístico; ele não escreve nem escolhe etapa.
        let produtoDetectado = null;
        if (!conversaClt && message) {
          try { produtoDetectado = await gemini.classificarProdutoSite(message); } catch {}
          if (produtoDetectado === "Empréstimo CLT") conversaClt = true;
        }
        if (conversaClt && conversation.produto_tag !== "Empréstimo CLT") await db.siteChatDefinirProduto(id, "Empréstimo CLT");
        else if (!conversation.produto_tag && produtoDetectado) {
          await db.siteChatDefinirProduto(id, produtoDetectado);
        }
        let cltStep = null;
        let cltCpf = null;
        let cltNome = null;
        if (message && conversaClt) {
          try {
            let row = await db.siteChatCltObter(id);
            const recentes = (await db.siteChatMensagens(id)).slice(-20);
            const somenteDigitos = message.replace(/\D/g, "");
            const cpfInformado = somenteDigitos.length === 11 && novosaque.cpfValido(somenteDigitos)
              ? somenteDigitos
              : null;
            const pareceCpfInvalido = somenteDigitos.length === 11 && !cpfInformado;
            const respostaNormalizada = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const normalizarResposta = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const respostaEhNegativa = (texto) => /\b(ainda nao|nao tenho|menos de (?:tres|3) meses|so tenho (?:um|dois|1|2) meses?)\b/.test(texto)
              || /^(nao|n|negativo)[!. ]*$/.test(texto);
            const respostaEhPositiva = (texto) => !respostaEhNegativa(texto) && (
              /^(sim|s|tenho|tenho sim|positivo)[!,. ]*$/.test(texto)
              || /\b(mais de (?:tres|3) meses|(?:tres|3) meses ou mais|(?:4|5|6|7|8|9|10|11|12) meses|[1-9]\d+ meses|ja (?:completei|passei)|passei da experiencia)\b/.test(texto)
            );
            const semTempoMinimo = respostaEhNegativa(respostaNormalizada);
            const confirmouTempo = respostaEhPositiva(respostaNormalizada);
            const confirmouTempoAntes = recentes.slice(0, -1).some((m) => m.direction === "visitor" && respostaEhPositiva(normalizarResposta(m.body)));
            const pediuSimulacao = /\b(clt|consignado|simula(?:r|ção)|empr[eé]stimo)\b/i.test(message);
            const jaPerguntouTempo = recentes.some((m) => m.direction === "agent" && /mais de 3 meses/i.test(m.body || ""));
            const atalhoSaida = siteChatRules.atalhoCltSemSaida(message, row);
            const nomeCompletoValido = (n) => {
              const nome = String(n || "").trim().replace(/\s+/g, " ");
              return nome.split(" ").filter(Boolean).length >= 2 && nome.length <= 120 && /^[\p{L} .'-]+$/u.test(nome);
            };
            const perguntouNomeCompleto = recentes.slice(-3).some((m) => m.direction === "agent" && /nome completo, como est/i.test(m.body || ""));
            const cpfAnterior = [...recentes].reverse()
              .filter((m) => m.direction === "visitor")
              .map((m) => String(m.body || "").replace(/\D/g, ""))
              .find((dig) => dig.length === 11 && novosaque.cpfValido(dig)) || null;

            // As etapas obrigatórias são determinísticas. O Gemini cuida apenas da linguagem
            // livre e não pode voltar a qualificação depois da confirmação nem confundir CPF.
            if (atalhoSaida) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", atalhoSaida);
              cltStep = "atalho";
            } else if (!row && confirmouTempo) {
              await db.siteChatFunilEvento(id, "qualificado", "mais_de_3_meses", "facta");
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Perfeito! Agora digite seu CPF para iniciarmos a simulação.");
              cltStep = "start";
            } else if (!row && semTempoMinimo) {
              await db.siteChatFunilEvento(id, "saida", "tempo_minimo", "facta", "menos_de_3_meses");
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Entendi. Assim que completar 3 meses no trabalho atual, volte aqui para fazermos sua simulação.");
              cltStep = "ineligible";
            } else if (!row && pareceCpfInvalido) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Esse CPF não parece válido. Confira os 11 números e envie novamente, por favor.");
              cltStep = "start";
            } else if (!row && cpfInformado && !confirmouTempoAntes) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Antes da consulta, preciso confirmar: você tem mais de 3 meses de registro no trabalho atual?");
              cltStep = "eligibility";
            } else if (!row && cpfInformado && !nomeCompletoValido(conversation.name)) {
              // A Facta exige nome completo: sem ele a simulação nem começava e o chat ficava em silêncio.
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "CPF recebido. Para enviar a autorização da Facta, preciso do seu nome completo, como está no documento. Pode digitar aqui?");
              cltStep = "need_name";
            } else if (!row && cpfInformado) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "CPF recebido. Vou usar o celular informado no início do atendimento para enviar a autorização da Facta pelo WhatsApp.");
              cltStep = "start";
            } else if (!row && nomeCompletoValido(message) && perguntouNomeCompleto && cpfAnterior) {
              const nomeLimpo = message.trim().replace(/\s+/g, " ").slice(0, 120);
              await db.siteChatDefinirNome(id, nomeLimpo);
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Obrigado! Vou usar o celular informado no início do atendimento para enviar a autorização da Facta pelo WhatsApp.");
              cltStep = "start_cpf";
              cltCpf = cpfAnterior;
              cltNome = nomeLimpo;
            } else if (!row && (pediuSimulacao || produtoDetectado === "Empréstimo CLT") && !jaPerguntouTempo) {
              await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Para fazer a simulação do consignado CLT, você precisa ter mais de 3 meses de registro no trabalho atual. Você já completou esse período?");
              cltStep = "eligibility";
            } else {
              const mensagemMascarada = message
                .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[e-mail]")
                .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]")
                .replace(/\b\d{11}\b/g, "[documento ou telefone]")
                .replace(/\b\d{10}\b/g, "[telefone]");
              const resposta = await gemini.responderConversaCltSite({ mensagem: mensagemMascarada, etapa: row?.etapa || "qualificação de 3 meses" });
              if (resposta) await db.siteChatMensagemAtendente(id, "Assistente FelizCred", resposta);
            }
          } catch (err) {
            console.error(`Gemini não respondeu no chat CLT ${id}:`, err.message);
            await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Recebi seus dados. Não consegui concluir a consulta automática agora, mas nossa equipe continuará o atendimento por aqui.").catch(() => {});
          }
        }
        if (message && !conversaClt) {
          try {
            const resposta = await gemini.responderConversaSite({ mensagem: message, etapa: "conversa sobre produto", produto: produtoDetectado || conversation.produto_tag });
            if (resposta) await db.siteChatMensagemAtendente(id, "Assistente FelizCred", resposta);
          } catch (err) {
            console.error(`Gemini não respondeu no chat do site ${id}:`, err.message);
            await db.siteChatMensagemAtendente(id, "Assistente FelizCred", "Posso ajudar com sua dúvida ou orientar você a iniciar uma simulação pelo chat.").catch(() => {});
          }
        }
        return send(res, 201, { ok: true, clt: conversaClt, cltStep, cltCpf, cltNome }, corsHeaders);
      }
    }

    if (req.method === "GET" && path_ === "/painel/api/site-chat/conversations") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.siteChatListar());
    }

    const painelSiteChatMatch = path_.match(/^\/painel\/api\/site-chat\/conversations\/([a-f0-9-]+)$/i);
    if (painelSiteChatMatch && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const conversation = await db.siteChatObter(painelSiteChatMatch[1]);
      if (!conversation) return send(res, 404, { error: "Conversa não encontrada" });
      await db.siteChatMarcarLida(conversation.id);
      const clt = await db.siteChatCltObter(conversation.id);
      return send(res, 200, { conversation, messages: await db.siteChatMensagens(conversation.id), clt: siteChatCltPublico(clt) });
    }

    const painelSiteChatReplyMatch = path_.match(/^\/painel\/api\/site-chat\/conversations\/([a-f0-9-]+)\/reply$/i);
    if (painelSiteChatReplyMatch && req.method === "POST") {
      const usuario = requireAuth(req, res);
      if (!usuario) return;
      const conversation = await db.siteChatObter(painelSiteChatReplyMatch[1]);
      if (!conversation) return send(res, 404, { error: "Conversa não encontrada" });
      const body = await parseBody(req);
      const message = String(body.message || "").trim().slice(0, 2000);
      let media;
      try { media = salvarMidiaSite(req, body); } catch (err) { return send(res, 400, { error: err.message }); }
      if (!message && !media.url) return send(res, 400, { error: "Escreva uma mensagem ou envie um arquivo." });
      await db.siteChatMensagemAtendente(conversation.id, usuario.nome || "Atendimento FelizCred", message, media);
      // Enquanto o atendente conversa, o assistente não responde por cima (renova a cada resposta; "Devolver ao bot" libera antes).
      await db.siteChatPausarBot(conversation.id, Date.now() + SITE_CHAT_BOT_PAUSA_MS);
      if (conversation.human_intent_stage === "requested") await db.siteChatDefinirIntencaoHumano(conversation.id, "human_active");
      // Cliente que já saiu do chat (sem escrever há mais de 5 min) recebe a resposta por e-mail, no máximo 1 a cada 30 min.
      const saiuDoChat = !conversation.last_visitor_at || Date.now() - Number(conversation.last_visitor_at) > 5 * 60_000;
      const emailRecente = conversation.email_resposta_at && Date.now() - Number(conversation.email_resposta_at) < 30 * 60_000;
      if (process.env.EMAIL_RETOMADA_ATIVA === "true" && conversation.email && emailDeClienteReal(conversation.email) && saiuDoChat && !emailRecente) {
        db.siteChatEmailMarcar(conversation.id, "email_resposta_at", Date.now())
          .then(() => enviarModeloFelizcred({ modelo: "felizcred-resposta-atendente", email: conversation.email, nome: conversation.name, mensagem: message || "Enviamos um arquivo para você no chat." }))
          .catch((err) => console.error(`E-mail de resposta do atendente não enviado (${conversation.id}):`, err.message));
      }
      return send(res, 201, { ok: true });
    }

    const painelSiteChatBotMatch = path_.match(/^\/painel\/api\/site-chat\/conversations\/([a-f0-9-]+)\/bot$/i);
    if (painelSiteChatBotMatch && req.method === "PATCH") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await db.siteChatPausarBot(painelSiteChatBotMatch[1], body.pausado ? Date.now() + SITE_CHAT_BOT_PAUSA_MS : null);
      return send(res, 200, { ok: true });
    }

    const painelSiteChatStatusMatch = path_.match(/^\/painel\/api\/site-chat\/conversations\/([a-f0-9-]+)\/status$/i);
    if (painelSiteChatStatusMatch && req.method === "PATCH") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const status = body.status === "closed" ? "closed" : "open";
      await db.siteChatDefinirStatus(painelSiteChatStatusMatch[1], status);
      return send(res, 200, { ok: true });
    }

    const painelSiteChatPipelineMatch = path_.match(/^\/painel\/api\/site-chat\/conversations\/([a-f0-9-]+)\/pipeline$/i);
    if (painelSiteChatPipelineMatch && req.method === "PATCH") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const estagio = String(body.estagio || "").trim().slice(0, 80);
      if (!estagio) return send(res, 400, { error: "Etapa inválida" });
      await db.siteChatDefinirPipeline(painelSiteChatPipelineMatch[1], estagio);
      return send(res, 200, { ok: true });
    }

    // POST /cotacerta/lead — form do site cotacertaseguros.com.br: salva o lead e avisa
    // por e-mail (via Brevo), pra pegar quem preenche mas não chama no WhatsApp.
    // Pública/sem auth (chamada direto do navegador do visitante) e com CORS liberado.
    if (path_ === "/cotacerta/lead") {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        return res.end();
      }
      if (req.method === "POST") {
        const corsHeaders = { "Access-Control-Allow-Origin": "*" };
        const lead = await parseBody(req);
        if (!lead.nome || !lead.whatsapp) {
          return send(res, 400, { error: "nome e whatsapp são obrigatórios" }, corsHeaders);
        }
        let emailEnviado = false;
        try {
          await notificarLeadCotaCerta(lead);
          emailEnviado = true;
        } catch (err) {
          console.error("Erro ao enviar e-mail de lead Cota Certa:", err.message);
        }
        try {
          await db.salvarLeadCotaCerta({ ...lead, emailEnviado });
        } catch (err) {
          console.error("Erro ao salvar lead Cota Certa:", err.message);
        }
        // Só salva no Google Contacts (prefixo "SEG" pra diferenciar dos funis de
        // empréstimo, que caem na mesma conta Google) — Cota Certa NÃO manda e-mail de
        // boas-vindas ao cliente, só o aviso interno acima (notificarLeadCotaCerta).
        // Formulário manda o WhatsApp sem código de país (ex. "(11) 99999-9999").
        const digitosWhats = String(lead.whatsapp || "").replace(/\D/g, "");
        const telefoneCotaCerta = digitosWhats.length <= 11 ? `55${digitosWhats}` : digitosWhats;
        google
          .criarContato({ nome: `SEG - ${lead.nome}`, telefone: telefoneCotaCerta, email: lead.email })
          .catch((err) => console.error("Erro ao criar contato Cota Certa no Google:", err.message));
        return send(res, 200, { ok: true }, corsHeaders);
      }
    }

    // GET /privacidade — política de privacidade (pública, sem auth)
    if (req.method === "GET" && path_ === "/privacidade") {
      const html = fs.readFileSync(path.join(__dirname, "public", "privacidade.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /termos — termos de uso (público, sem auth)
    if (req.method === "GET" && path_ === "/termos") {
      const html = fs.readFileSync(path.join(__dirname, "public", "termos.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /painel — painel novo (React), build gerado em painel-web/dist pelo `npm run build`
    // (ver package.json raiz). Sem auth aqui de propósito: é só o shell estático da SPA, a
    // autenticação de verdade acontece por chamada em cada /painel/api/* (ver requireAuth
    // abaixo) — diferente do painel.html antigo, que exigia Basic Auth só pra carregar o HTML
    // e por isso abria o prompt nativo feio do navegador antes da tela de login própria.
    if (req.method === "GET" && path_ === "/painel") {
      const html = fs.readFileSync(path.join(__dirname, "painel-web", "dist", "index.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /painel/assets/:arquivo — JS/CSS gerados pelo build do Vite (hash no nome, cache
    // longo é seguro). Sem auth — são só assets estáticos, sem dado nenhum de cliente.
    const matchPainelAsset = path_.match(/^\/painel\/assets\/([^/]+)$/);
    if (req.method === "GET" && matchPainelAsset) {
      const arquivo = decodeURIComponent(matchPainelAsset[1]);
      const assetPath = path.join(__dirname, "painel-web", "dist", "assets", arquivo);
      if (!fs.existsSync(assetPath)) return send(res, 404, "Not found");
      const ext = path.extname(arquivo);
      const tipo =
        ext === ".js"
          ? "application/javascript; charset=utf-8"
          : ext === ".css"
          ? "text/css; charset=utf-8"
          : "application/octet-stream";
      return send(res, 200, fs.readFileSync(assetPath), {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
    }

    // GET /painel/favicon.svg e /painel/icons.svg — arquivos estáticos da pasta public/ do
    // painel-web copiados pro build (ver painel-web/public/).
    const matchPainelPublico = path_.match(/^\/painel\/(favicon\.svg|icons\.svg)$/);
    if (req.method === "GET" && matchPainelPublico) {
      const arquivoPath = path.join(__dirname, "painel-web", "dist", matchPainelPublico[1]);
      if (!fs.existsSync(arquivoPath)) return send(res, 404, "Not found");
      return send(res, 200, fs.readFileSync(arquivoPath), { "Content-Type": "image/svg+xml" });
    }

    // GET /painel-antigo — painel vanilla anterior, mantido como plano B enquanto o novo
    // (React) é validado em produção. Remover quando não for mais necessário.
    if (req.method === "GET" && path_ === "/painel-antigo") {
      if (!requireAuth(req, res)) return;
      const html = fs.readFileSync(path.join(__dirname, "public", "painel.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /painel/api/numbers — lista de números configurados. Quem é admin (ou não tem
    // `canais_padrao` restrito) vê todos, igual sempre foi; atendente com canal restrito só vê
    // os números da própria lista.
    if (req.method === "GET" && path_ === "/painel/api/numbers") {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      const permitidos = canaisPermitidosDoUsuario(usuarioAtual);
      if (!permitidos) return send(res, 200, PHONE_NUMBERS);
      return send(res, 200, PHONE_NUMBERS.filter((n) => permitidos.includes(n.id)));
    }

    // GET /painel/api/me — identidade de quem está logado. Chamado 1x pelo frontend depois do
    // login pra saber nome/papel/canais.
    if (req.method === "GET" && path_ === "/painel/api/me") {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      return send(res, 200, {
        nome: usuarioAtual.nome,
        usuario: usuarioAtual.usuario,
        papel: usuarioAtual.papel,
        canais_padrao: canaisPermitidosDoUsuario(usuarioAtual),
        etapas_notificacao: etapasNotificacaoDoUsuario(usuarioAtual),
      });
    }

    // GET /painel/api/media-token — token assinado que o painel busca 1x logo após o login e
    // embute em toda URL de mídia (`/media/:filename?token=...`), pra nunca mais precisar do
    // popup nativo de Basic Auth do navegador em <img>/<video>.
    if (req.method === "GET" && path_ === "/painel/api/media-token") {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      return send(res, 200, { token: gerarTokenMedia(usuarioAtual.usuario) });
    }

    // ── Administração de usuários (login por pessoa) — só admin ──────────────────────────────
    // GET lista (sem senha_hash), POST cria, PATCH edita (nome/papel/canais/ativo), POST
    // .../senha redefine a senha.
    if (path_ === "/painel/api/usuarios" || path_.startsWith("/painel/api/usuarios/")) {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      if (usuarioAtual.papel !== "admin") return send(res, 403, { error: "Só administrador pode gerenciar usuários." });

      if (req.method === "GET" && path_ === "/painel/api/usuarios") {
        const lista = await db.usuarioListar();
        return send(res, 200, lista.map((u) => ({
          id: u.id,
          nome: u.nome,
          usuario: u.usuario,
          papel: u.papel,
          canais_padrao: canaisPermitidosDoUsuario(u),
          etapas_notificacao: etapasNotificacaoDoUsuario(u),
          ativo: !!u.ativo,
          created_at: u.created_at,
        })));
      }

      if (req.method === "POST" && path_ === "/painel/api/usuarios") {
        const body = await parseBody(req);
        if (!body.nome?.trim() || !body.usuario?.trim() || !body.senha?.trim()) {
          return send(res, 400, { error: "Informe nome, usuário e senha." });
        }
        try {
          const id = await db.usuarioCriar({
            nome: body.nome.trim(),
            usuario: body.usuario.trim(),
            senha: body.senha,
            papel: body.papel === "admin" ? "admin" : "atendente",
            canaisPadrao: Array.isArray(body.canais_padrao) ? body.canais_padrao : null,
            etapasNotificacao: Array.isArray(body.etapas_notificacao) ? body.etapas_notificacao : null,
          });
          await recarregarUsuariosCache();
          return send(res, 200, { id });
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }

      const matchUsuarioId = path_.match(/^\/painel\/api\/usuarios\/(\d+)$/);
      if (req.method === "PATCH" && matchUsuarioId) {
        const id = Number(matchUsuarioId[1]);
        const existente = await db.usuarioObterPorId(id);
        if (!existente) return send(res, 404, { error: "Usuário não encontrado" });
        const body = await parseBody(req);
        await db.usuarioAtualizar(id, {
          nome: body.nome !== undefined ? String(body.nome).trim() || existente.nome : existente.nome,
          papel: body.papel === "admin" || body.papel === "atendente" ? body.papel : existente.papel,
          canaisPadrao: Array.isArray(body.canais_padrao)
            ? body.canais_padrao
            : canaisPermitidosDoUsuario(existente),
          etapasNotificacao: Array.isArray(body.etapas_notificacao)
            ? body.etapas_notificacao
            : etapasNotificacaoDoUsuario(existente),
          ativo: body.ativo !== undefined ? !!body.ativo : !!existente.ativo,
        });
        await recarregarUsuariosCache();
        return send(res, 200, { ok: true });
      }

      const matchUsuarioSenha = path_.match(/^\/painel\/api\/usuarios\/(\d+)\/senha$/);
      if (req.method === "POST" && matchUsuarioSenha) {
        const id = Number(matchUsuarioSenha[1]);
        const existente = await db.usuarioObterPorId(id);
        if (!existente) return send(res, 404, { error: "Usuário não encontrado" });
        const body = await parseBody(req);
        if (!body.senha?.trim()) return send(res, 400, { error: "Informe a nova senha." });
        await db.usuarioRedefinirSenha(id, body.senha);
        await recarregarUsuariosCache();
        return send(res, 200, { ok: true });
      }
    }

    // GET /painel/api/minhas-conversas — conversas atribuídas (campo "Responsável", ver CRM) à
    // pessoa logada, em QUALQUER canal — poder pro atendimento de "handoff": a SDR qualifica num
    // número e atribui pro fechamento, que normalmente não navega naquele número, mas ainda
    // precisa achar essa conversa específica.
    if (req.method === "GET" && path_ === "/painel/api/minhas-conversas") {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      const nome = (usuarioAtual.nome || "").trim().toLowerCase();
      if (!nome) return send(res, 200, []);
      const listas = await Promise.all([
        ...PHONE_NUMBERS.map((n) => db.listConversations(n.id)),
        db.listConversations("instagram"),
      ]);
      const minhas = [];
      for (const c of listas.flat()) {
        if (!c.campos_json) continue;
        let campos;
        try {
          campos = JSON.parse(c.campos_json);
        } catch {
          continue;
        }
        const responsavel = campos["Responsável"];
        if (!responsavel || String(responsavel).trim().toLowerCase() !== nome) continue;
        minhas.push({
          phone: c.phone,
          name: c.name,
          business_number_id: c.business_number_id,
          channel: c.business_number_id === "instagram" ? "instagram" : "whatsapp",
          last_message_at: c.last_message_at,
          last_body: c.last_body,
          pipeline_estagio: c.pipeline_estagio,
        });
      }
      minhas.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
      return send(res, 200, minhas);
    }

    // GET /painel/api/mcp-info — URL do conector MCP pra colar no claude.ai (Configurações >
    // Conectores). Monta a partir do host da própria requisição, não fixo, pra funcionar igual
    // em qualquer domínio (inclusive um deploy separado de um cliente, no futuro). Atrás de
    // requireAuth de propósito: o token não pode vazar pra quem não tem login do painel.
    if (req.method === "GET" && path_ === "/painel/api/mcp-info") {
      if (!requireAuth(req, res)) return;
      if (!process.env.MCP_ACCESS_TOKEN) {
        return send(res, 200, { configurado: false });
      }
      const url_ = `https://${req.headers.host}/mcp/${process.env.MCP_ACCESS_TOKEN}`;
      return send(res, 200, { configurado: true, url: url_ });
    }

    // GET /painel/api/inbox — conversas de TODOS os canais juntas (cada número de WhatsApp
    // configurado + Instagram), ordenadas pela mensagem mais recente. Alimenta a caixa de
    // entrada unificada do painel — cada conversa já sai marcada com o canal e o
    // business_number_id certo pra usar nas rotas abaixo (mensagens/responder/status/nota).
    if (req.method === "GET" && path_ === "/painel/api/inbox") {
      if (!requireAuth(req, res)) return;
      const listas = await Promise.all([
        ...PHONE_NUMBERS.map((n) => db.listConversations(n.id)),
        db.listConversations("instagram"),
      ]);
      const conversas = listas.flat().map((c) => ({
        ...c,
        channel: c.business_number_id === "instagram" ? "instagram" : "whatsapp",
      }));
      conversas.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
      return send(res, 200, conversas);
    }

    // GET /painel/api/conversations/:businessId — lista de conversas de um número. Por
    // padrão não traz finalizadas (ver listConversations) — ?finalizadas=1 traz só pra quem
    // pediu explicitamente (aba "Finalizadas" do painel).
    const matchConversations = path_.match(/^\/painel\/api\/conversations\/([^/]+)$/);
    if (req.method === "GET" && matchConversations) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchConversations[1]);
      const incluirFinalizadas = url.searchParams.get("finalizadas") === "1";
      return send(res, 200, await db.listConversations(businessId, { incluirFinalizadas }));
    }

    // GET /painel/api/conversations/:businessId/:phone/messages — só busca as mensagens, sem
    // efeito colateral. Antes essa rota também marcava a conversa como lida — mas o painel
    // busca mensagens em polling a cada 5s pra conversa selecionada, MESMO com a aba sem foco
    // (minimizada/trocada), então uma mensagem nova nessa conversa virava "lida" sozinha antes
    // do piscar/negrito aparecer. Marcar como lida agora é a rota separada abaixo, chamada pelo
    // painel só quando a aba está com foco de verdade (ver marcar-lida e chats.tsx).
    const matchMessages = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/messages$/);
    if (req.method === "GET" && matchMessages) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchMessages[1]);
      const phone = decodeURIComponent(matchMessages[2]);
      const desdeParam = url.searchParams.get("desde");
      const ateParam = url.searchParams.get("ate");
      const mensagens = await db.listMessages(phone, businessId, {
        desde: desdeParam ? Number(desdeParam) : undefined,
        ate: ateParam ? Number(ateParam) : undefined,
      });
      return send(res, 200, mensagens);
    }

    // GET /painel/api/conversations/:businessId/:phone/midias — só mídia (imagem/vídeo) da
    // conversa inteira, sem limite de janela — alimenta a Galeria do painel.
    const matchMidias = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/midias$/);
    if (req.method === "GET" && matchMidias) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchMidias[1]);
      const phone = decodeURIComponent(matchMidias[2]);
      return send(res, 200, await db.listMidiasDaConversa(phone, businessId));
    }

    // GET /painel/api/conversations/:businessId/:phone/outros-canais — mesmo telefone em
    // OUTRO(S) canal(is) — puramente informativo, não mescla nada.
    const matchOutrosCanais = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/outros-canais$/);
    if (req.method === "GET" && matchOutrosCanais) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchOutrosCanais[1]);
      const phone = decodeURIComponent(matchOutrosCanais[2]);
      return send(res, 200, await db.conversasDoTelefoneEmOutrosCanais(phone, businessId));
    }

    // PATCH /painel/api/conversations/:businessId/:phone/nome — renomear manualmente. Fallback
    // pra quando o WhatsApp não manda profile.name (perfil sem nome configurado) e o contato
    // fica só com o número. Propaga pros outros canais com o mesmo telefone (ver
    // propagarIdentidadeContato) — pipeline/tags continuam por canal.
    const matchRenomear = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/nome$/);
    if (req.method === "PATCH" && matchRenomear) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const businessId = decodeURIComponent(matchRenomear[1]);
      const phone = decodeURIComponent(matchRenomear[2]);
      const nomeNovo = String(body.nome || "").trim();
      if (!nomeNovo) return send(res, 400, { error: "Nome não pode ser vazio" });
      await db.renomearConversa(phone, businessId, nomeNovo);
      db.propagarIdentidadeContato(phone, businessId, { nome: nomeNovo }).catch((err) =>
        console.error("Erro ao propagar nome pros outros canais:", err.message)
      );
      return send(res, 200, { ok: true });
    }

    // PATCH /painel/api/conversations/:businessId/:phone/foto — "Salvar contato" (foto, estilo
    // WhatsApp) — não é a foto de perfil do WhatsApp (a Cloud API não expõe isso pra número de
    // negócio), é escolhida manualmente no painel. Mesmo caminho de toda mídia anexada pelo
    // painel: vai pro R2, servida depois por GET /media/:filename.
    const matchFoto = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/foto$/);
    if (req.method === "PATCH" && matchFoto) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const businessId = decodeURIComponent(matchFoto[1]);
      const phone = decodeURIComponent(matchFoto[2]);
      if (!body.fotoBase64) return send(res, 400, { error: "Nenhuma foto enviada" });
      try {
        const { buffer, contentType, nomeArquivo } = decodificarImagemBase64(body.fotoBase64);
        const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${nomeArquivo.split(".").pop()}`;
        await r2.enviarVideo(`clientes/${filename}`, buffer, contentType);
        const fotoUrl = `/media/${filename}`;
        await db.definirFotoContato(phone, businessId, fotoUrl);
        db.propagarIdentidadeContato(phone, businessId, { fotoUrl }).catch((err) =>
          console.error("Erro ao propagar foto pros outros canais:", err.message)
        );
        return send(res, 200, { ok: true, foto_url: fotoUrl });
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // PATCH /painel/api/conversations/:businessId/:phone/email — "salvar contato" (e-mail).
    const matchEmailContato = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/email$/);
    if (req.method === "PATCH" && matchEmailContato) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const businessId = decodeURIComponent(matchEmailContato[1]);
      const phone = decodeURIComponent(matchEmailContato[2]);
      const emailNovo = String(body.email || "").trim();
      await db.atualizarEmailConversa(phone, businessId, emailNovo || null);
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/corrigir-texto — corretor por-trecho (balão clicável em cima da
    // palavra/expressão errada no textarea, não a frase inteira).
    if (req.method === "POST" && path_ === "/painel/api/corrigir-texto") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        return send(res, 200, await gemini.corrigirTexto(String(body.texto || "")));
      } catch (err) {
        return send(res, err.code === "SEM_CHAVE" ? 400 : 500, { error: err.message });
      }
    }

    // GET /painel/api/conversations/:businessId/:phone/sugestao-resposta — sugestão de resposta
    // da IA ("copiloto de vendas") pré-computada em background pelo servidor (ver cron) e
    // cacheada na própria conversa. Cache só é válido quando copiloto_cache_em bate com
    // last_message_at — se a mensagem mais recente for mais nova que o cache, não tem sugestão
    // pronta ainda (o cron ainda vai processar essa conversa na próxima rodada).
    const matchSugestaoResposta = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/sugestao-resposta$/);
    if (req.method === "GET" && matchSugestaoResposta) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchSugestaoResposta[1]);
      const phone = decodeURIComponent(matchSugestaoResposta[2]);
      const conversa = await db.getConversation(phone, businessId);
      if (!conversa || !conversa.copiloto_cache_em || conversa.copiloto_cache_em !== conversa.last_message_at) {
        return send(res, 200, { texto: null, insight: null });
      }
      return send(res, 200, { texto: conversa.copiloto_texto || null, insight: conversa.copiloto_insight || null });
    }

    // POST /painel/api/conversations/:businessId/:phone/marcar-lida — separado do GET
    // .../messages de propósito (ver comentário acima). Chamado pelo painel só quando a
    // conversa está selecionada E a aba tem foco (document.hasFocus()).
    const matchMarcarLida = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/marcar-lida$/);
    if (req.method === "POST" && matchMarcarLida) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchMarcarLida[1]);
      const phone = decodeURIComponent(matchMarcarLida[2]);
      await db.marcarConversaLida(phone, businessId);
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/conversations/:businessId/:phone/exportar — baixa o histórico inteiro
    // da conversa em .txt (data/hora, quem mandou, texto/tipo de cada mensagem) — pra guardar
    // como registro (ex.: comprovar o que foi combinado por WhatsApp). Não sobe em lugar
    // nenhum sozinho, só devolve o arquivo pro navegador baixar.
    const matchExportar = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/exportar$/);
    if (req.method === "GET" && matchExportar) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchExportar[1]);
      const phone = decodeURIComponent(matchExportar[2]);
      const [conversa, mensagens] = await Promise.all([
        db.getConversation(phone, businessId),
        db.listMessages(phone, businessId),
      ]);
      const nomeContato = conversa?.name || phone;
      const linhas = [
        `Conversa exportada — ${nomeContato} (${phone})`,
        `Canal: ${businessId}`,
        `Exportado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        "=".repeat(60),
        "",
        ...mensagens.map((m) => {
          const quando = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          const quem = m.direction === "out" ? "Atendente" : nomeContato;
          const conteudo =
            m.body ||
            (m.media_path ? `[${m.type}] ${m.media_path}` : `[${m.type}]`);
          const statusFalha = m.status === "failed" ? ` (NÃO ENTREGUE${m.error_message ? `: ${m.error_message}` : ""})` : "";
          return `[${quando}] ${quem}: ${conteudo}${statusFalha}`;
        }),
        "",
      ];
      const arquivo = Buffer.from(linhas.join("\n"), "utf8");
      const nomeArquivo = `conversa-${phone}-${new Date().toISOString().slice(0, 10)}.txt`;
      return send(res, 200, arquivo, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      });
    }

    // POST /painel/api/conversations/:businessId/:phone/reply — responder uma conversa.
    // Aceita texto puro OU imagemBase64/videoBase64/audioBase64/documentBase64 (com ou sem
    // legenda em `text`) — mesmo mecanismo de upload/URL pública do Publique IV
    // (salvarImagemPublicar/salvarVideoPublicar/... + /publicar-media/).
    const matchReply = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/reply$/);
    if (req.method === "POST" && matchReply) {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      const businessId = decodeURIComponent(matchReply[1]);
      const phoneParam = decodeURIComponent(matchReply[2]);
      const phone = businessId === "instagram" ? phoneParam : normalizarTelefoneBR(phoneParam);
      const body = await parseBody(req);
      const texto = (body.text || "").trim();
      const replyToWaId = typeof body.replyToWaId === "string" ? body.replyToWaId : null;
      if (!texto && !body.imagemBase64 && !body.videoBase64 && !body.audioBase64 && !body.documentBase64) {
        return send(res, 400, { error: "Mensagem vazia" });
      }

      if (businessId === "instagram") {
        if (body.imagemBase64 || body.videoBase64 || body.audioBase64 || body.documentBase64) {
          return send(res, 400, { error: "Envio de mídia pelo Instagram ainda não é suportado — responda por texto." });
        }
        let resultIg;
        try {
          resultIg = await ig.sendDM(phone, texto);
        } catch (err) {
          return send(res, 502, { error: `Falha ao enviar pelo Instagram: ${err.message}` });
        }
        await logInstagramOutbound(phone, texto, resultIg.message_id);
        return send(res, 200, { ok: true });
      }

      let imagemUrl = null;
      let videoUrl = null;
      let audioUrl = null;
      let audioBuffer = null;
      let audioMediaPath = null;
      let documentUrl = null;
      if (body.imagemBase64) {
        try {
          const filename = salvarImagemPublicar(body.imagemBase64);
          imagemUrl = `https://${req.headers.host}/publicar-media/${filename}`;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      } else if (body.videoBase64) {
        try {
          const filename = salvarVideoPublicar(body.videoBase64);
          videoUrl = `https://${req.headers.host}/publicar-media/${filename}`;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      } else if (body.audioBase64) {
        try {
          const salvo = await salvarAudioR2(body.audioBase64);
          audioUrl = salvo.url;
          audioBuffer = salvo.buffer;
          audioMediaPath = salvo.mediaPath;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      } else if (body.documentBase64) {
        try {
          const filename = salvarDocumentoPublicar(body.documentBase64);
          documentUrl = `https://${req.headers.host}/publicar-media/${filename}`;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }

      let result;
      try {
        result = imagemUrl
          ? await wa.sendImage(businessId, phone, imagemUrl, texto || undefined)
          : videoUrl
          ? await wa.sendVideo(businessId, phone, videoUrl, texto || undefined)
          : audioUrl
          // Sobe o arquivo direto para a Meta e manda pelo id (a Meta valida o áudio na hora e diz o motivo se recusar).
          ? await wa.sendAudio(businessId, phone, { id: await wa.uploadMedia(businessId, audioBuffer, "audio/mpeg", "audio.mp3") })
          : documentUrl
          ? await wa.sendDocument(businessId, phone, documentUrl, body.documentNome || undefined, texto || undefined)
          : await wa.sendText(businessId, phone, texto, replyToWaId || undefined);
      } catch (err) {
        return send(res, 502, { error: `Falha ao enviar pelo WhatsApp: ${err.message}` });
      }
      const waId = result.messages?.[0]?.id || null;
      const now = Date.now();
      await db.upsertConversation(phone, businessId, null, now);
      // Atendente humano assumiu — cancela lembrete automático pendente
      await db.setFluxoPasso(phone, businessId, null);
      // Atendente explicou que o FGTS já foi sacado/consultado (uma vez a cada 12 meses): marca a conversa.
      if (businessId !== "instagram" && /j[aá] sacou|n[aã]o pode mais (fazer|sacar)|uma vez a cada 12 meses|1 vez a cada 12 meses/i.test(texto)) {
        marcarFgtsConsultado(phone, businessId);
      }
      // Pausa o bot por 24h (a janela de atendimento); cada nova resposta do atendente renova.
      await db.pausarBot(phone, businessId, now + 24 * 60 * 60 * 1000);
      await db.insertMessage({
        phone,
        business_number_id: businessId,
        direction: "out",
        type: imagemUrl ? "image" : videoUrl ? "video" : audioUrl ? "audio" : documentUrl ? "document" : "text",
        body: texto || (documentUrl ? body.documentNome : null) || null,
        media_path: imagemUrl || videoUrl || audioMediaPath || documentUrl,
        wa_message_id: waId,
        status: "sent",
        // origem = nome de quem está logado (veio do reply do painel, uma pessoa digitou) —
        // usado pra medir "tempo até resposta humana" no Analytics (qualquer valor não-nulo conta
        // como humano, ver exportação de conversa) e pra montar o "Por atendente" (mensagens por
        // pessoa). "humano" como fallback cobre o login único antigo (PAINEL_USER/PAINEL_PASS),
        // que não tem nome de pessoa associado.
        origem: usuarioAtual.nome || "humano",
        context_wa_id: replyToWaId,
        created_at: now,
      });
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/conversations/:businessId/:phone/reabrir-fluxo — reabre o fluxo
    // automático desse contato (mesmo efeito de o CLIENTE mandar "menu", só que acionado pelo
    // atendente aqui do painel — pra quando o fluxo falhou/travou e não dá pra pedir pro
    // cliente digitar algo). Usa o fluxo do número (menu de novo, ou aoIniciar pra fluxos
    // lineares como o Ciahot).
    const matchReabrirFluxo = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/reabrir-fluxo$/);
    if (req.method === "POST" && matchReabrirFluxo) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchReabrirFluxo[1]);
      const phone = decodeURIComponent(matchReabrirFluxo[2]);
      if (businessId === "instagram") return send(res, 400, { error: "Instagram não tem fluxo automático pra reabrir" });
      try {
        await db.pausarBot(phone, businessId, null);
        await dispararInicioFluxo(await getFluxo(businessId, phone), phone, businessId);
        return send(res, 200, { ok: true });
      } catch (err) {
        console.error("Erro ao reabrir fluxo pelo painel:", err.message);
        return send(res, 502, { error: err.message });
      }
    }

    // PATCH /painel/api/conversations/:businessId/:phone/status — muda status da conversa
    // (novo/andamento/resolvido — estilo Chatwoot)
    const matchStatus = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/status$/);
    if (req.method === "PATCH" && matchStatus) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        await db.atualizarStatusConversa(decodeURIComponent(matchStatus[2]), decodeURIComponent(matchStatus[1]), body.status);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // PATCH /painel/api/conversations/:businessId/:phone/nota — nota/observação sobre o contato
    const matchNota = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/nota$/);
    if (req.method === "PATCH" && matchNota) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await db.atualizarNotaConversa(decodeURIComponent(matchNota[2]), decodeURIComponent(matchNota[1]), body.nota || "");
      return send(res, 200, { ok: true });
    }

    // PATCH /painel/api/conversations/:businessId/:phone/pipeline — etapa da conversa no
    // funil de atendimento/vendas (ver PIPELINE_ESTAGIOS no painel-web)
    const matchPipeline = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/pipeline$/);
    if (req.method === "PATCH" && matchPipeline) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await db.atualizarPipelineConversa(decodeURIComponent(matchPipeline[2]), decodeURIComponent(matchPipeline[1]), body.estagio || null);
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/conversations/:businessId/:phone/tags — tags dessa conversa
    const matchTagsConversa = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/tags$/);
    if (req.method === "GET" && matchTagsConversa) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.tagsDaConversa(decodeURIComponent(matchTagsConversa[1]), decodeURIComponent(matchTagsConversa[2])));
    }
    // POST /painel/api/conversations/:businessId/:phone/tags — adiciona uma tag { tagId }
    if (req.method === "POST" && matchTagsConversa) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.tagId) return send(res, 400, { error: "tagId obrigatório" });
      await db.adicionarTagConversa(decodeURIComponent(matchTagsConversa[1]), decodeURIComponent(matchTagsConversa[2]), body.tagId);
      return send(res, 200, { ok: true });
    }
    // DELETE /painel/api/conversations/:businessId/:phone/tags/:tagId — remove uma tag
    const matchTagsConversaRemover = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/tags\/(\d+)$/);
    if (req.method === "DELETE" && matchTagsConversaRemover) {
      if (!requireAuth(req, res)) return;
      await db.removerTagConversa(
        decodeURIComponent(matchTagsConversaRemover[1]),
        decodeURIComponent(matchTagsConversaRemover[2]),
        Number(matchTagsConversaRemover[3])
      );
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/tags/:businessId — lista as tags cadastradas
    const matchTags = path_.match(/^\/painel\/api\/tags\/([^/]+)$/);
    if (req.method === "GET" && matchTags) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.listarTags(decodeURIComponent(matchTags[1])));
    }
    // POST /painel/api/tags/:businessId — cria tag { nome, cor }
    if (req.method === "POST" && matchTags) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.nome || !body.nome.trim()) return send(res, 400, { error: "Nome da tag é obrigatório" });
      const id = await db.criarTag(decodeURIComponent(matchTags[1]), body.nome, body.cor || "#64748b");
      return send(res, 200, { id });
    }
    // DELETE /painel/api/tags/:businessId/:tagId
    const matchTagApagar = path_.match(/^\/painel\/api\/tags\/([^/]+)\/(\d+)$/);
    if (req.method === "DELETE" && matchTagApagar) {
      if (!requireAuth(req, res)) return;
      await db.apagarTag(decodeURIComponent(matchTagApagar[1]), Number(matchTagApagar[2]));
      return send(res, 200, { ok: true });
    }

    // ── Campos personalizados (CRM) ─────────────────────────────────────────────────────────
    // GET /painel/api/campos-personalizados/:businessId — lista os campos definidos pro negócio
    const matchCampos = path_.match(/^\/painel\/api\/campos-personalizados\/([^/]+)$/);
    if (req.method === "GET" && matchCampos) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.camposPersonalizadosListar(decodeURIComponent(matchCampos[1])));
    }
    // POST /painel/api/campos-personalizados/:businessId — cria campo { nome }
    if (req.method === "POST" && matchCampos) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.nome) return send(res, 400, { error: "Informe nome" });
      const id = await db.campoPersonalizadoCriar(decodeURIComponent(matchCampos[1]), body.nome);
      return send(res, 200, { id });
    }
    // DELETE /painel/api/campos-personalizados/:businessId/:campoId
    const matchCampoApagar = path_.match(/^\/painel\/api\/campos-personalizados\/([^/]+)\/(\d+)$/);
    if (req.method === "DELETE" && matchCampoApagar) {
      if (!requireAuth(req, res)) return;
      await db.campoPersonalizadoApagar(Number(matchCampoApagar[2]));
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/conversations/:businessId/:phone/campos — todos os campos + valor dessa conversa
    const matchCamposConversa = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/campos$/);
    if (req.method === "GET" && matchCamposConversa) {
      if (!requireAuth(req, res)) return;
      return send(
        res,
        200,
        await db.conversationCamposObter(decodeURIComponent(matchCamposConversa[1]), decodeURIComponent(matchCamposConversa[2]))
      );
    }
    // POST /painel/api/conversations/:businessId/:phone/campos/:campoId — define o valor { valor }
    const matchCampoValorDefinir = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/campos\/(\d+)$/);
    if (req.method === "POST" && matchCampoValorDefinir) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await db.conversationCampoDefinir(
        decodeURIComponent(matchCampoValorDefinir[1]),
        decodeURIComponent(matchCampoValorDefinir[2]),
        Number(matchCampoValorDefinir[3]),
        body.valor ?? ""
      );
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/conversations/:businessId/:phone/sugestao-ia — lê as últimas mensagens e
    // sugere etapa do pipeline + campos personalizados (ver gemini.js). Nunca aplica sozinha —
    // só devolve a sugestão, quem decide é a pessoa clicando "aplicar" no painel.
    // Body: { estagios: [{ id, nome }] } — a lista de etapas válidas pro canal atual, calculada
    // no frontend (pipelineEstagiosPara), porque o servidor não sabe qual funil cada canal usa.
    const matchSugestaoIa = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/sugestao-ia$/);
    if (req.method === "POST" && matchSugestaoIa) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchSugestaoIa[1]);
      const phone = decodeURIComponent(matchSugestaoIa[2]);
      const body = await parseBody(req);
      const estagios = Array.isArray(body.estagios) ? body.estagios : [];
      try {
        const [mensagens, campos, valoresAtuais] = await Promise.all([
          db.ultimasMensagens(phone, businessId, 30),
          db.camposPersonalizadosListar(businessId),
          db.conversationCamposObter(businessId, phone),
        ]);
        const sugestao = await gemini.sugerirPipeline({ mensagens, estagios, campos, valoresAtuais });
        return send(res, 200, sugestao);
      } catch (err) {
        if (err.code === "SEM_CHAVE") {
          return send(res, 400, { error: "IA não configurada neste servidor (falta GEMINI_API_KEY)." });
        }
        console.error("Erro na sugestão de IA:", err.message);
        return send(res, 502, { error: "Não deu pra consultar a IA agora. Tente de novo em instantes." });
      }
    }

    // ── Notas em lista (CRM) ────────────────────────────────────────────────────────────────
    // GET /painel/api/conversations/:businessId/:phone/notas
    const matchNotas = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/notas$/);
    if (req.method === "GET" && matchNotas) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.notasDaConversa(decodeURIComponent(matchNotas[1]), decodeURIComponent(matchNotas[2])));
    }
    // POST /painel/api/conversations/:businessId/:phone/notas — adiciona nota { texto }
    if (req.method === "POST" && matchNotas) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.texto?.trim()) return send(res, 400, { error: "Informe texto" });
      const id = await db.notaAdicionar(decodeURIComponent(matchNotas[1]), decodeURIComponent(matchNotas[2]), body.texto.trim());
      return send(res, 200, { id });
    }
    // DELETE /painel/api/notas/item/:id
    const matchNotaApagar = path_.match(/^\/painel\/api\/notas\/item\/(\d+)$/);
    if (req.method === "DELETE" && matchNotaApagar) {
      if (!requireAuth(req, res)) return;
      await db.notaApagar(Number(matchNotaApagar[1]));
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/conversations/:businessId/:phone/atividades — timeline (tag/etapa/campo/retorno)
    const matchAtividades = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/atividades$/);
    if (req.method === "GET" && matchAtividades) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.atividadesDaConversa(decodeURIComponent(matchAtividades[1]), decodeURIComponent(matchAtividades[2])));
    }

    // Mescla o resultado de db.analyticsResumo de vários canais num resumo só — somas pra
    // contagens, média PONDERADA (pelo nº de amostras de cada canal, não média simples) pros
    // tempos, e listas (porStatus/porTag/porEstagio/porDirecao/porHora/porAtendente/porDia)
    // agrupadas por chave somando os totais. `porCanal` é novo aqui: dá o total de conversas de
    // cada canal separado, pra mostrar a barra de "Todos os canais" (ver analytics.tsx).
    function mesclarAnalytics(porCanalLista) {
      const soma = (campo) => porCanalLista.reduce((acc, c) => acc + (c.dados[campo] || 0), 0);
      const mediaPonderada = (campoMedia, campoAmostras) => {
        const totalAmostras = soma(campoAmostras);
        if (!totalAmostras) return null;
        const somaPonderada = porCanalLista.reduce(
          (acc, c) => acc + (c.dados[campoMedia] || 0) * (c.dados[campoAmostras] || 0),
          0,
        );
        return somaPonderada / totalAmostras;
      };
      function mesclarListaPorChave(campo, chave) {
        const mapa = new Map();
        for (const c of porCanalLista) {
          for (const item of c.dados[campo] || []) {
            const k = item[chave];
            const atual = mapa.get(k) || { ...item };
            if (mapa.has(k)) {
              for (const campoNum of Object.keys(item)) {
                if (campoNum === chave) continue;
                if (typeof item[campoNum] === "number") atual[campoNum] = (atual[campoNum] || 0) + item[campoNum];
              }
            }
            mapa.set(k, atual);
          }
        }
        return Array.from(mapa.values());
      }
      const totalConversas = soma("totalConversas");
      const conversasResolvidas = soma("conversasResolvidas");
      return {
        totalConversas,
        novasConversas: soma("novasConversas"),
        conversasResolvidas,
        taxaResolucao: totalConversas > 0 ? conversasResolvidas / totalConversas : null,
        tempoMedioRespostaHumanaMs: mediaPonderada("tempoMedioRespostaHumanaMs", "amostrasRespostaHumana"),
        amostrasRespostaHumana: soma("amostrasRespostaHumana"),
        tempoMedioResolucaoMs: mediaPonderada("tempoMedioResolucaoMs", "amostrasResolucao"),
        amostrasResolucao: soma("amostrasResolucao"),
        porStatus: mesclarListaPorChave("porStatus", "status"),
        porTag: mesclarListaPorChave("porTag", "nome"),
        porEstagio: mesclarListaPorChave("porEstagio", "estagio"),
        porDia: mesclarListaPorChave("porDia", "dia"),
        porDirecao: mesclarListaPorChave("porDirecao", "direction"),
        porHora: mesclarListaPorChave("porHora", "hora"),
        porAtendente: mesclarListaPorChave("porAtendente", "atendente"),
        porCanal: porCanalLista.map((c) => ({
          id: c.id,
          label: PHONE_NUMBERS.find((n) => n.id === c.id)?.label || (c.id === "instagram" ? "Instagram" : c.id),
          totalConversas: c.dados.totalConversas || 0,
        })),
      };
    }

    // GET /painel/api/analytics/:businessIds?dias=7 — métricas de atendimento (ver
    // db.analyticsResumo). `:businessIds` aceita 1 ou vários ids separados por vírgula (ver
    // "Todos os canais" no Analytics) — cada um é consultado separado (analyticsResumo continua
    // por canal, mais simples e mais barato de ler no Turso) e os resultados são somados/
    // mesclados aqui, sem duplicar a lógica de SQL por canal.
    const matchAnalytics = path_.match(/^\/painel\/api\/analytics\/([^/]+)$/);
    if (req.method === "GET" && matchAnalytics) {
      if (!requireAuth(req, res)) return;
      const dias = Math.max(1, Math.min(365, Number(url.searchParams.get("dias")) || 30));
      const ate = Date.now();
      const desde = ate - dias * 24 * 60 * 60 * 1000;
      const ids = decodeURIComponent(matchAnalytics[1]).split(",").filter(Boolean);
      const porCanalLista = await Promise.all(
        ids.map(async (id) => ({ id, dados: await db.analyticsResumo(id, desde, ate) })),
      );
      if (porCanalLista.length === 1) {
        return send(res, 200, { ...porCanalLista[0].dados, dias, desde, ate });
      }
      return send(res, 200, { ...mesclarAnalytics(porCanalLista), dias, desde, ate });
    }

    // GET /painel/api/conversations/:businessId/buscar?q=... — busca texto dentro das mensagens
    const matchBuscarMsg = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/buscar$/);
    if (req.method === "GET" && matchBuscarMsg) {
      if (!requireAuth(req, res)) return;
      const termo = (url.searchParams.get("q") || "").trim();
      if (!termo) return send(res, 200, []);
      return send(res, 200, await db.buscarMensagens(decodeURIComponent(matchBuscarMsg[1]), termo));
    }

    // GET /painel/api/funil?dias=7 — resumo do funil de qualificação do CLT (menu → 3+ meses
    // → dados completos, e o mesmo pra quem entrou pela campanha de WhatsApp), contagem de
    // pessoas ÚNICAS por etapa dentro da janela pedida (padrão 7 dias).
    if (req.method === "GET" && path_ === "/painel/api/funil") {
      if (!requireAuth(req, res)) return;
      const dias = Math.max(Number(url.searchParams.get("dias")) || 7, 1);
      const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
      const resumo = await db.funilResumo(desde);
      const site = await db.siteChatFunilResumo(desde);
      return send(res, 200, {
        dias,
        etapas: {
          clt_menu_escolhido: resumo.clt_menu_escolhido || 0,
          clt_qualificado: resumo.clt_qualificado || 0,
          clt_dados_completos: resumo.clt_dados_completos || 0,
          campanha_clique: resumo.campanha_clique || 0,
          campanha_dados_completos: resumo.campanha_dados_completos || 0,
        },
        site,
      });
    }

    // GET/POST /painel/api/respostas-prontas — respostas rápidas reutilizáveis
    if (req.method === "GET" && path_ === "/painel/api/respostas-prontas") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.respostasProntasListar());
    }
    if (req.method === "POST" && path_ === "/painel/api/respostas-prontas") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.atalho || !body.texto) return send(res, 400, { error: "Informe atalho e texto" });
      const id = await db.respostaProntaCriar(body.atalho.trim(), body.texto.trim());
      return send(res, 200, { id });
    }
    const matchRespostaProntaDel = path_.match(/^\/painel\/api\/respostas-prontas\/(\d+)$/);
    if (req.method === "DELETE" && matchRespostaProntaDel) {
      if (!requireAuth(req, res)) return;
      await db.respostaProntaExcluir(Number(matchRespostaProntaDel[1]));
      return send(res, 200, { ok: true });
    }
    // Edição direta (em vez de apagar e recriar, que perdia o id).
    if (req.method === "PATCH" && matchRespostaProntaDel) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.atalho || !body.texto) return send(res, 400, { error: "Informe atalho e texto" });
      await db.respostaProntaAtualizar(Number(matchRespostaProntaDel[1]), body.atalho.trim(), body.texto.trim());
      return send(res, 200, { ok: true });
    }
    // Conta uso de verdade (clicou pra usar, não só abriu a lista) — alimenta ordenação "mais
    // usados" dos chips do composer.
    const matchRespostaProntaUso = path_.match(/^\/painel\/api\/respostas-prontas\/(\d+)\/uso$/);
    if (req.method === "POST" && matchRespostaProntaUso) {
      if (!requireAuth(req, res)) return;
      await db.respostaProntaRegistrarUso(Number(matchRespostaProntaUso[1]));
      return send(res, 200, { ok: true });
    }

    // GET/POST /painel/api/ia/feedback — feedback/aceitação da IA ("como sabemos se é útil?").
    if (path_ === "/painel/api/ia/feedback") {
      const usuarioAtual = requireAuth(req, res);
      if (!usuarioAtual) return;
      if (req.method === "GET") {
        const [resumo, comentarios] = await Promise.all([
          db.iaFeedbackResumoPorTipo(),
          db.iaFeedbackListarComentarios(),
        ]);
        return send(res, 200, { resumo, comentarios });
      }
      if (req.method === "POST") {
        const body = await parseBody(req);
        if (!body.tipo || !body.evento) return send(res, 400, { error: "Informe tipo e evento" });
        await db.iaFeedbackRegistrar({
          businessId: body.businessId,
          phone: body.phone,
          tipo: body.tipo,
          evento: body.evento,
          comentario: body.comentario,
          usuario: usuarioAtual.nome,
        });
        return send(res, 200, { ok: true });
      }
    }

    // GET/PATCH /painel/api/pipeline/alertas-config — limiar (minutos) de alerta de "parado na
    // etapa", editável por etapa do pipeline.
    if (req.method === "GET" && path_ === "/painel/api/pipeline/alertas-config") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.pipelineAlertasConfigListar());
    }
    const matchAlertaConfig = path_.match(/^\/painel\/api\/pipeline\/alertas-config\/([^/]+)$/);
    if (req.method === "PATCH" && matchAlertaConfig) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const minutos = body.minutos == null ? null : Number(body.minutos);
      await db.pipelineAlertaConfigDefinir(decodeURIComponent(matchAlertaConfig[1]), minutos);
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/retornos — fila cross-channel de retornos pendentes (agrupada em
    // Atrasados/Hoje/Esta semana/Mais adiante no frontend), distinta da rota por-negócio
    // /retornos/:businessId que já existia (usada pelo cron de envio).
    if (req.method === "GET" && path_ === "/painel/api/retornos") {
      if (!requireAuth(req, res)) return;
      const listas = await Promise.all([
        ...PHONE_NUMBERS.map((n) => db.retornoListarPendentes(n.id)),
        db.retornoListarPendentes("instagram"),
      ]);
      const retornos = listas.flat();
      const telefones = [...new Set(retornos.map((r) => r.business_id + "|" + r.phone))];
      const nomes = {};
      await Promise.all(
        telefones.map(async (chave) => {
          const [businessId, phone] = chave.split("|");
          const conversa = await db.getConversation(phone, businessId);
          nomes[chave] = conversa?.name || null;
        }),
      );
      return send(
        res,
        200,
        retornos.map((r) => ({
          ...r,
          name: nomes[r.business_id + "|" + r.phone] || null,
          channel: r.business_id === "instagram" ? "instagram" : "whatsapp",
        })),
      );
    }

    // GET /painel/api/sugestoes-retorno — radar de "vale um retorno" (etapa parada / inativo).
    // PATCH .../status NUNCA envia nada sozinho — só marca aprovado/descartado, quem abre a
    // conversa e decide canal/texto é sempre um humano.
    if (req.method === "GET" && path_ === "/painel/api/sugestoes-retorno") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.sugestoesRetornoPendentes());
    }
    const matchSugestaoStatus = path_.match(/^\/painel\/api\/sugestoes-retorno\/(\d+)\/status$/);
    if (req.method === "PATCH" && matchSugestaoStatus) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!["aprovado", "descartado"].includes(body.status)) return send(res, 400, { error: "Status inválido" });
      await db.sugestaoRetornoMarcarStatus(Number(matchSugestaoStatus[1]), body.status);
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/contatos?q=&estagio=&tag=&email=com|sem — diretório de contatos de
    // verdade, cross-canal. Não é um cadastro à parte — reaproveita db.listConversations (mesma
    // função de Conversas/Minhas/Retornos) e só agrega os canais + filtra. Filtro de tag é por
    // NOME (não id): a mesma tag tem um id diferente em cada número (tabela `tags` é por
    // business_number_id) — filtrar por nome é o que faz sentido numa tela que já junta todos os
    // canais numa lista só.
    if (req.method === "GET" && path_ === "/painel/api/contatos") {
      if (!requireAuth(req, res)) return;
      const q = normalizar(url.searchParams.get("q") || "");
      const estagio = url.searchParams.get("estagio") || "";
      const tagFiltro = normalizar(url.searchParams.get("tag") || "");
      const emailFiltro = url.searchParams.get("email") || ""; // "com" | "sem" | ""
      const listas = await Promise.all([
        ...PHONE_NUMBERS.map((n) => db.listConversations(n.id)),
        db.listConversations("instagram"),
      ]);
      const contatos = [];
      for (const c of listas.flat()) {
        if (q && !normalizar(`${c.name || ""} ${c.phone || ""}`).includes(q)) continue;
        if (estagio && c.pipeline_estagio !== estagio) continue;
        if (tagFiltro) {
          let tagsDoContato = [];
          try {
            tagsDoContato = c.tags_json ? JSON.parse(c.tags_json) : [];
          } catch {
            tagsDoContato = [];
          }
          if (!tagsDoContato.some((t) => normalizar(t.nome || "") === tagFiltro)) continue;
        }
        if (emailFiltro === "com" && !c.email) continue;
        if (emailFiltro === "sem" && c.email) continue;
        let campos = {};
        try {
          campos = c.campos_json ? JSON.parse(c.campos_json) : {};
        } catch {
          campos = {};
        }
        contatos.push({
          phone: c.phone,
          name: c.name,
          business_number_id: c.business_number_id,
          channel: c.business_number_id === "instagram" ? "instagram" : "whatsapp",
          last_message_at: c.last_message_at,
          pipeline_estagio: c.pipeline_estagio,
          tags_json: c.tags_json || null,
          email: c.email || null,
          foto_url: c.foto_url || null,
          campos,
          google_sincronizado: !!c.google_contact_resource_name,
        });
      }
      contatos.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
      return send(res, 200, contatos);
    }

    // POST /painel/api/contatos/importar/:businessId — importação em massa (CSV OU Google
    // Contatos — mesma rota pras duas origens, o painel só monta a lista diferente antes de
    // mandar). Nunca mexe em last_message_at (ver db.importarContato) — contato importado não
    // "conversou agora", só passa a existir no CRM esperando a primeira mensagem de verdade.
    // Campo personalizado só é gravado se o NOME bater com um já cadastrado nesse número — não
    // cria campo novo sozinho a partir de uma coluna de planilha desconhecida.
    const matchContatosImportar = path_.match(/^\/painel\/api\/contatos\/importar\/([^/]+)$/);
    if (req.method === "POST" && matchContatosImportar) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchContatosImportar[1]);
      const body = await parseBody(req);
      const linhas = Array.isArray(body.contatos) ? body.contatos : [];
      if (!linhas.length) return send(res, 400, { error: "Nenhum contato pra importar" });

      const camposCadastrados = await db.camposPersonalizadosListar(businessId);
      const campoPorNome = new Map(camposCadastrados.map((c) => [normalizar(c.nome), c]));

      let importados = 0;
      const erros = [];
      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i] || {};
        const telefone = normalizarTelefoneBR(linha.telefone || "");
        if (!/^55\d{10,11}$/.test(telefone)) {
          erros.push({ linha: i + 1, motivo: `Telefone inválido: "${linha.telefone || ""}"` });
          continue;
        }
        try {
          await db.importarContato(telefone, businessId, {
            nome: linha.nome ? String(linha.nome).trim().slice(0, 120) : null,
            email: linha.email ? String(linha.email).trim().slice(0, 200) : null,
            googleResourceName: linha.googleResourceName || null,
          });
          if (linha.etapa) {
            await db.atualizarPipelineConversa(telefone, businessId, String(linha.etapa).trim(), "importacao");
          }
          if (Array.isArray(linha.tags)) {
            for (const nomeTag of linha.tags) {
              if (!nomeTag || !String(nomeTag).trim()) continue;
              const tagId = await db.tagEncontrarOuCriar(businessId, String(nomeTag).trim(), "#6B7280");
              await db.adicionarTagConversa(businessId, telefone, tagId, "importacao");
            }
          }
          if (linha.campos && typeof linha.campos === "object") {
            for (const [nomeCampo, valor] of Object.entries(linha.campos)) {
              if (!valor || !String(valor).trim()) continue;
              const campo = campoPorNome.get(normalizar(nomeCampo));
              if (!campo) continue;
              await db.conversationCampoDefinir(businessId, telefone, campo.id, String(valor).trim(), "importacao");
            }
          }
          importados++;
        } catch (err) {
          erros.push({ linha: i + 1, motivo: err.message });
        }
      }
      return send(res, 200, { importados, erros });
    }

    // GET /painel/api/campanha-contatos/:businessId?estagio=&tagId=&aniversarioDias= — passo 1
    // (segmentação) do assistente de Campanha de WhatsApp: combina em E só os filtros presentes
    // na query string e devolve a lista de contatos que bate, pra contar destinatários (passo 1)
    // e já alimentar o `contacts` do POST /broadcast (passo 3). Sem filtro nenhum, devolve todo
    // contato ativo do número (ver db.conversasParaCampanha).
    const matchCampanhaContatos = path_.match(/^\/painel\/api\/campanha-contatos\/([^/]+)$/);
    if (req.method === "GET" && matchCampanhaContatos) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchCampanhaContatos[1]);
      const estagio = url.searchParams.get("estagio") || undefined;
      const tagId = url.searchParams.get("tagId") ? Number(url.searchParams.get("tagId")) : undefined;
      const aniversarioDiasRaw = url.searchParams.get("aniversarioDias");
      const aniversarioDias = aniversarioDiasRaw ? Number(aniversarioDiasRaw) : undefined;
      const contacts = await db.conversasParaCampanha(businessId, { estagio, tagId, aniversarioDias });
      return send(res, 200, { contacts, total: contacts.length });
    }

    // GET /painel/api/integracoes/status — visão consolidada de uso/limite das integrações
    // externas que o painel depende (tela Configurações > Integrações). Só traz o que dá pra
    // consultar com as credenciais que já existem hoje — WhatsApp (limite de mensagem/qualidade,
    // via wa.checarNumero) e R2 (soma de bytes de verdade no bucket, r2.usoTotalBytes). Outras
    // integrações não têm token de consulta de uso guardado ainda (seriam credenciais NOVAS,
    // diferentes das que já usamos pra conectar) — o frontend mostra como pendência em vez de
    // inventar número.
    // Versão publicada (commit do Render) — serve para conferir se um deploy já entrou no ar.
    if (req.method === "GET" && path_ === "/versao") {
      return send(res, 200, { commit: (process.env.RENDER_GIT_COMMIT || "local").slice(0, 7) });
    }

    if (req.method === "GET" && path_ === "/painel/api/integracoes/status") {
      if (!requireAuth(req, res)) return;
      const [whatsapp, r2UsedBytes] = await Promise.all([
        Promise.all(
          PHONE_NUMBERS.map(async (n) => {
            try {
              const info = await wa.checarNumero(n.id);
              return {
                label: n.label,
                ok: true,
                display_phone_number: info.display_phone_number || null,
                quality_rating: info.quality_rating || null,
                messaging_limit_tier: info.messaging_limit_tier || null,
              };
            } catch (err) {
              return { label: n.label, ok: false, erro: err.message };
            }
          }),
        ),
        r2.usoTotalBytes().catch(() => null),
      ]);
      // 10GB é o teto do plano gratuito do R2 hoje (Cloudflare) — não vem de nenhuma API, é a
      // regra do plano free documentada pela própria Cloudflare.
      const r2Status = r2UsedBytes == null ? null : { usedBytes: r2UsedBytes, limiteBytes: 10 * 1024 * 1024 * 1024 };
      return send(res, 200, { whatsapp, r2: r2Status });
    }

    // GET /painel/api/roteador/revisado — status de revisão do roteador em CÓDIGO (os fluxos
    // hardcoded de cada número — FLUXO_FELIZCRED, FLUXO_COTACERTA, FLUXO_CIAHOT, FLUXO_CAMPANHA_CLT
    // etc. — ver tela Fluxos). Mapa { chave: boolean }.
    if (req.method === "GET" && path_ === "/painel/api/roteador/revisado") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.roteadorRevisadoListar());
    }

    // POST /painel/api/roteador/revisado/:chave — marca/desmarca { revisado: boolean }
    const matchRoteadorRevisado = path_.match(/^\/painel\/api\/roteador\/revisado\/([^/]+)$/);
    if (req.method === "POST" && matchRoteadorRevisado) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await db.roteadorRevisadoDefinir(decodeURIComponent(matchRoteadorRevisado[1]), Boolean(body.revisado));
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/google/contatos — lista os contatos da conta Google autorizada. Devolve a
    // lista crua pra pessoa ESCOLHER quem importar no painel — nunca importa tudo de uma vez
    // sozinho: a conta Google autorizada é pessoal, pode ter gente que não tem nada a ver com o
    // negócio.
    if (req.method === "GET" && path_ === "/painel/api/google/contatos") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await google.listarContatosGoogle());
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // POST /painel/api/google/sincronizar — passa por TODAS as conversas de WhatsApp: as que já
    // estão no Google Contatos ganham o nome de lá; com { criarFaltantes: true }, as que já
    // escreveram mas não estão no Google são salvas lá (até 300 por vez, nome do perfil do
    // WhatsApp). Ciahot fica de fora. Devolve contagens pra mostrar no painel.
    if (req.method === "POST" && path_ === "/painel/api/google/sincronizar") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        const mapa = await google.mapaContatos(true);
        const conversas = (await db.conversasParaSincronizarGoogle()).filter((c) => !googleSyncIgnora(c.businessNumberId));
        let renomeadas = 0;
        let criados = 0;
        let faltantes = 0;
        const jaTratados = new Set();
        for (const c of conversas) {
          const chave = google.chaveTelefone(c.phone);
          const achado = mapa.get(chave);
          if (achado?.nome) {
            if (c.name !== achado.nome) {
              await db.renomearConversa(c.phone, c.businessNumberId, achado.nome);
              renomeadas++;
            }
          } else if (!achado && c.jaEscreveu && !jaTratados.has(chave)) {
            jaTratados.add(chave);
            if (body.criarFaltantes && criados < 300) {
              try {
                await google.garantirContato({ telefone: c.phone, nomePerfil: c.name });
                criados++;
              } catch (err) {
                console.error("Erro ao criar contato no Google (sincronização):", err.message);
              }
            } else {
              faltantes++;
            }
          }
        }
        return send(res, 200, { totalNoGoogle: mapa.size, renomeadas, criados, faltantes });
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // GET /painel/api/google/exportar-csv — baixa TODOS os contatos da conta Google autorizada em
    // CSV (nome, telefones, e-mails), pra limpeza/organização fora do Google. Só leitura.
    if (req.method === "GET" && path_ === "/painel/api/google/exportar-csv") {
      if (!requireAuth(req, res)) return;
      try {
        const contatos = await google.listarTodosContatosCompletos();
        const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const linhas = [["nome", "telefones", "emails"].map(escapar).join(",")];
        for (const c of contatos) {
          linhas.push([c.nome, c.telefones.join(" ; "), c.emails.join(" ; ")].map(escapar).join(","));
        }
        const data = new Date().toISOString().slice(0, 10);
        return send(res, 200, Buffer.from("﻿" + linhas.join("\r\n"), "utf8"), {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="contatos-google-${data}.csv"`,
        });
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // GET /painel/api/google/conta — qual conta Google está autorizada agora (e-mail), pra
    // mostrar na tela de importar contatos.
    if (req.method === "GET" && path_ === "/painel/api/google/conta") {
      if (!requireAuth(req, res)) return;
      try {
        const info = await google.obterContaConectada();
        return send(res, 200, { email: info.email || null, nome: info.name || null });
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // POST /painel/api/template-criar/:businessId — cria um template de texto simples na WABA
    // desse número (body: { name, text, language?, category? }). Ação administrativa, sem botão.
    const matchTemplateCriar = path_.match(/^\/painel\/api\/template-criar\/([^/]+)$/);
    if (req.method === "POST" && matchTemplateCriar) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.name || !body.text) return send(res, 400, { error: "Informe name e text" });
      try {
        const wabaId = await resolverWabaDoNumero(decodeURIComponent(matchTemplateCriar[1]));
        if (!wabaId) return send(res, 404, { error: "Não achei a conta do WhatsApp (WABA) desse número" });
        return send(res, 200, await wa.criarTemplateTexto(wabaId, body));
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // GET /painel/api/templates/:businessId — templates aprovados da WABA desse número,
    // pra montar o seletor de template do envio em massa (em vez de digitar o nome de cabeça).
    const matchTemplates = path_.match(/^\/painel\/api\/templates\/([^/]+)$/);
    if (req.method === "GET" && matchTemplates) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchTemplates[1]);
      try {
        const wabaId = await resolverWabaDoNumero(businessId);
        if (!wabaId) return send(res, 404, { error: "Não achei a conta do WhatsApp (WABA) desse número" });
        const templates = await wa.listarTemplates(wabaId);
        // ?todos=1 lista também pendentes/recusados (diagnóstico); sem isso, só aprovados.
        const lista = url.searchParams.get("todos") ? templates : templates.filter((t) => t.status === "APPROVED");
        return send(res, 200, { templates: lista });
      } catch (err) {
        console.error("Erro ao listar templates:", err.message);
        return send(res, 502, { error: err.message });
      }
    }

    // POST /painel/api/broadcast/:businessId — envio em massa via template. `intervalSeconds`
    // (opcional): se > 0, só o 1º contato sai na hora — os demais caem na fila
    // broadcast_agendado, espaçados por esse intervalo, e são processados pelo setInterval do
    // agendador (mais abaixo). Sem isso a requisição teria que ficar aberta por horas pra um
    // intervalo de "a cada 35min", o que não sobrevive a timeout de proxy nem a fechar o painel.
    const matchBroadcast = path_.match(/^\/painel\/api\/broadcast\/([^/]+)$/);
    if (req.method === "POST" && matchBroadcast) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchBroadcast[1]);
      const body = await parseBody(req);
      const { template, language, contacts, bodyPreview, intervalSeconds, fluxoId } = body;
      if (!template || !Array.isArray(contacts) || !contacts.length) {
        return send(res, 400, { error: "Informe o template e ao menos um contato" });
      }
      const intervalo = Math.max(Number(intervalSeconds) || 0, 0);

      // Fluxo conectado (opcional): assim que CADA contato responder o template (qualquer
      // resposta), cai nesse fluxo em vez do padrão do número — ver getFluxo "aguardando_fluxo_".
      async function marcarFluxoSeConectado(phone) {
        if (!fluxoId) return;
        await db.setFluxoPasso(normalizarTelefoneBR(phone), businessId, `aguardando_fluxo_${fluxoId}`);
      }

      if (!intervalo) {
        const resultados = [];
        for (const contato of contacts) {
          const resultado = await enviarUmBroadcast(businessId, { ...contato, template, language, bodyPreview });
          if (resultado.ok) await marcarFluxoSeConectado(contato.phone);
          resultados.push({ phone: contato.phone || "", ...resultado });
          await new Promise((r) => setTimeout(r, 350));
        }
        return send(res, 200, { resultados });
      }

      // Com intervalo: o 1º sai já (mesma experiência de sempre — confirma na hora que
      // funcionou), o resto agenda.
      const [primeiro, ...resto] = contacts;
      const resultadoPrimeiro = await enviarUmBroadcast(businessId, { ...primeiro, template, language, bodyPreview });
      if (resultadoPrimeiro.ok) await marcarFluxoSeConectado(primeiro.phone);
      const resultados = [{ phone: primeiro.phone || "", ...resultadoPrimeiro }];
      const agora = Date.now();
      const itensAgendados = resto.map((contato, i) => ({
        phone: normalizarTelefoneBR(contato.phone),
        name: contato.name || null,
        template,
        language: language || "pt_BR",
        bodyPreview: bodyPreview || null,
        agendadoPara: agora + (i + 1) * intervalo * 1000,
      }));
      const agendados = itensAgendados.length ? await db.broadcastAgendarLote(businessId, itensAgendados, fluxoId) : 0;
      return send(res, 200, { resultados, agendados, intervalSeconds: intervalo });
    }

    // POST /painel/api/limpeza-conversas — limpa a lista de conversas do WhatsApp, exceto CiaHot e as
    // conversas com atividade de hoje (horário de Brasília). Sem { confirmar: true } só mostra o plano.
    // Com confirmar, salva no Google Contatos quem tem CPF válido nas mensagens ("FGTS <nome> <CPF>") e
    // apaga até `limite` conversas por chamada (repita até `restantes` = 0).
    if (req.method === "POST" && path_ === "/painel/api/limpeza-conversas") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const agoraBrasilia = new Date(Date.now() - 3 * 3600 * 1000);
      const desde = Date.UTC(agoraBrasilia.getUTCFullYear(), agoraBrasilia.getUTCMonth(), agoraBrasilia.getUTCDate(), 3);
      const plano = await db.planoLimpezaConversas({ excetoBusinessNumberId: CIAHOT_NUMBER_ID, desde });
      const resumo = {
        paraApagar: plano.apagar.length,
        comCpf: plano.comCpf.length,
        semCpf: plano.apagar.length - plano.comCpf.length,
        preservadasDeHoje: plano.preservadas,
      };
      if (!body.confirmar) return send(res, 200, { simulacao: true, ...resumo, listaComCpf: plano.comCpf });
      let salvosNoGoogle = 0;
      if (google.configurado()) {
        for (const c of plano.comCpf) {
          try {
            await google.garantirContato({ telefone: c.phone, nomePerfil: nomeContatoComCpf(c.cpf, c.name) });
            salvosNoGoogle++;
          } catch (err) {
            console.error("Limpeza: falha ao salvar contato no Google:", err.message);
          }
        }
      }
      const limite = Math.min(Math.max(Number(body.limite) || 300, 1), 500);
      const lote = plano.apagar.slice(0, limite);
      const apagadas = await db.apagarConversasLimpeza(lote);
      // Pipeline e Avisos também listam o chat do site — finaliza as conversas dele sem atividade hoje.
      const siteFinalizadas = await db.siteChatFinalizarAntigas(desde);
      return send(res, 200, { confirmado: true, ...resumo, salvosNoGoogle, apagadasNestaChamada: apagadas, restantes: plano.apagar.length - apagadas, siteFinalizadas });
    }

    // POST /painel/api/broadcast-reenfileirar/:businessId — devolve à fila os envios que falharam com o erro
    // #132000 (parâmetros não batem), espaçados de 12 min a partir de agora, um por vez.
    const matchReenfileirar = path_.match(/^\/painel\/api\/broadcast-reenfileirar\/([^/]+)$/);
    if (req.method === "POST" && matchReenfileirar) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const reenfileirados = await db.broadcastReenfileirarErro(decodeURIComponent(matchReenfileirar[1]), "132000", Date.now(), 12 * 60 * 1000);
      return send(res, 200, { reenfileirados });
    }

    // GET /painel/api/facta/ip-saida — mostra os IPs públicos que ESTE servidor usa para sair à internet (vários
    // testes, porque o provedor pode alternar entre alguns). São os que precisam estar liberados no painel da Facta.
    // GET /painel/api/unnotech/teste — só leitura: confere se as credenciais da Unnotech estão no servidor, se o token sai
    // e quais usuários (operadores) a chave enxerga. Nunca devolve token nem segredo.
    if (req.method === "GET" && path_ === "/painel/api/unnotech/teste") {
      if (!requireAuth(req, res)) return;
      const tam = (nome) => String(process.env[nome] || "").length;
      const resultado = { variaveis: { UNNOTECH_CLIENT_ID: tam("UNNOTECH_CLIENT_ID"), UNNOTECH_CLIENT_SECRET: tam("UNNOTECH_CLIENT_SECRET"), UNNOTECH_USER_UUID: tam("UNNOTECH_USER_UUID") } };
      try {
        await unnotech.getAccessToken();
        resultado.token = "ok";
        const usuarios = await unnotech.chamarAutenticado("GET", "/api/v1/users");
        resultado.usuarios_status = usuarios.status;
        const itens = usuarios.body?.items || usuarios.body?.content || usuarios.body?.data || (Array.isArray(usuarios.body) ? usuarios.body : []);
        resultado.usuarios = (Array.isArray(itens) ? itens : []).slice(0, 10).map((u) => ({ uuid: u.uuid || u.id, nome: u.name || u.nome, email: u.email, status: u.status }));
        if (usuarios.status >= 400) resultado.usuarios_erro = usuarios.body;
      } catch (err) {
        resultado.token = "falhou";
        resultado.erro = String(err.message || err).slice(0, 400);
      }
      return send(res, 200, resultado);
    }

    if (req.method === "GET" && path_ === "/painel/api/facta/ip-saida") {
      if (!requireAuth(req, res)) return;
      const ips = new Set();
      for (let i = 0; i < 8; i++) {
        try {
          const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
          const j = await r.json();
          if (j?.ip) ips.add(j.ip);
        } catch {}
      }
      const tam = (nome) => String(process.env[nome] || "").length;
      return send(res, 200, { ips: [...ips], modoDireto: process.env.FACTA_DIRECT === "true", tamanhos: { usuario: tam("FACTA_USERNAME"), senha: tam("FACTA_PASSWORD"), ambiente: String(process.env.FACTA_ENV || "") } });
    }

    // POST /painel/api/brevo/preparar — cria no Brevo a lista "Site FelizCred" e os 4 modelos de e-mail (se ainda não
    // existem) e põe na lista os contatos reais do chat do site que informaram e-mail. Pode repetir sem duplicar.
    if (req.method === "POST" && path_ === "/painel/api/brevo/preparar") {
      if (!requireAuth(req, res)) return;
      try {
        const listaId = await garantirListaBrevo();
        const modelos = await garantirModelosBrevo();
        const conversas = (await db.siteChatListar()).filter((c) => c.email && emailDeClienteReal(c.email));
        const vistos = new Set();
        let adicionados = 0;
        for (const c of conversas) {
          const chave = String(c.email).trim().toLowerCase();
          if (vistos.has(chave)) continue;
          vistos.add(chave);
          await salvarContatoBrevo({ email: c.email, nome: c.name, telefone: c.contact, origem: "site-chat", listIds: [listaId] });
          adicionados++;
        }
        return send(res, 200, { listaId, modelos, contatosNaLista: adicionados });
      } catch (err) {
        return send(res, 502, { error: String(err.message || err).slice(0, 300) });
      }
    }

    // GET /painel/api/turso/uso — consumo do mês do banco (Turso) contra os limites do plano grátis, para o aviso do
    // painel. Precisa de TURSO_PLATFORM_TOKEN (token de API da conta Turso, diferente do token do banco).
    // TURSO_ORG (padrão: salvadorfelipee-creator) é o nome da organização. Resultado guardado por 10 min.
    if (req.method === "GET" && path_ === "/painel/api/turso/uso") {
      if (!requireAuth(req, res)) return;
      const tokenPlataforma = String(process.env.TURSO_PLATFORM_TOKEN || "").trim();
      if (!tokenPlataforma) return send(res, 200, { configurado: false });
      if (!global.__tursoUso || Date.now() - global.__tursoUso.checadoEm > 10 * 60_000) {
        try {
          const org = String(process.env.TURSO_ORG || "salvadorfelipee-creator").trim();
          const r = await fetch(`https://api.turso.tech/v1/organizations/${encodeURIComponent(org)}/usage`, {
            headers: { Authorization: `Bearer ${tokenPlataforma}` },
            signal: AbortSignal.timeout(15_000),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
          const uso = j?.organization?.usage || {};
          const limiteLeituras = Number(process.env.TURSO_LIMITE_LEITURAS || 500_000_000);
          const limiteEscritas = Number(process.env.TURSO_LIMITE_ESCRITAS || 10_000_000);
          const leituras = Number(uso.rows_read || 0);
          const escritas = Number(uso.rows_written || 0);
          const pctLeituras = Math.round((leituras / limiteLeituras) * 1000) / 10;
          const pctEscritas = Math.round((escritas / limiteEscritas) * 1000) / 10;
          global.__tursoUso = { checadoEm: Date.now(), ok: true, leituras, limiteLeituras, pctLeituras, escritas, limiteEscritas, pctEscritas, pct: Math.max(pctLeituras, pctEscritas) };
        } catch (err) {
          global.__tursoUso = { checadoEm: Date.now(), ok: false, erro: String(err.message || "falha").slice(0, 120) };
        }
      }
      return send(res, 200, { configurado: true, ...global.__tursoUso });
    }

    // GET /painel/api/banda/uso — estimativa da banda de saída do mês contra os 5 GB grátis do Render (ver banda.js).
    if (req.method === "GET" && path_ === "/painel/api/banda/uso") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await banda.uso());
    }

    // GET /painel/api/facta/status — luz do painel: a ligação com a Facta (IP liberado, credenciais e serviço no ar)
    // está funcionando? Faz uma consulta leve só de leitura e guarda o resultado por 45s.
    if (req.method === "GET" && path_ === "/painel/api/facta/status") {
      if (!requireAuth(req, res)) return;
      if (!global.__factaStatus || Date.now() - global.__factaStatus.checadoEm > 45_000) {
        let status;
        try {
          await facta.consultarCombo("estado-civil");
          status = { ok: true, checadoEm: Date.now() };
        } catch (err) {
          status = { ok: false, checadoEm: Date.now(), erro: String(err.message || "falha").slice(0, 120), httpStatus: err.httpStatus || null };
        }
        global.__factaStatus = status;
      }
      return send(res, 200, { ...global.__factaStatus, modoDireto: process.env.FACTA_DIRECT === "true" });
    }

    // GET /painel/api/facta/teste — só leitura: gera o token e consulta o status de autorização de um CPF
    // (?cpf=...) pelo caminho em uso (ponte ou direto). Devolve só o resumo, sem dados do trabalhador.
    if (req.method === "GET" && path_ === "/painel/api/facta/teste") {
      if (!requireAuth(req, res)) return;
      const cpf = String(url.searchParams.get("cpf") || "").replace(/\D/g, "");
      if (!novosaque.cpfValido(cpf)) return send(res, 400, { error: "Informe ?cpf= válido" });
      try {
        const resposta = await facta.consultarTrabalhador(cpf);
        return send(res, 200, { ok: true, modoDireto: process.env.FACTA_DIRECT === "true", erro: respostaFactaComErro(resposta), mensagem: mensagemFacta(resposta, ""), linhas: dadosTrabalhadorFacta(resposta).length });
      } catch (err) {
        return send(res, 200, { ok: false, modoDireto: process.env.FACTA_DIRECT === "true", status: err.httpStatus || null, erro: String(err.message || "").slice(0, 200), detalhe: JSON.stringify(err.factaResponse || "").replace(/\s+/g, " ").slice(0, 300) });
      }
    }

    // GET /painel/api/diagnostico-broadcast/:businessId — só leitura: status da fila de envios agendados
    // (contagens, erros agrupados e próximos itens). Usado para checar por que um envio não saiu.
    const matchDiagnostico = path_.match(/^\/painel\/api\/diagnostico-broadcast\/([^/]+)$/);
    if (req.method === "GET" && matchDiagnostico) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.broadcastDiagnostico(decodeURIComponent(matchDiagnostico[1])));
    }

    // POST /painel/api/broadcast-agendar/:businessId — enfileira envios de template cada um
    // com SEU horário exato (`agendadoPara`, ms epoch), em vez de intervalo fixo — pra
    // campanhas com janela diária (ex.: 5 por dia, seg-sex, 9h-17h). Mesma fila e mesmo
    // agendador do broadcast com intervalo; nada sai na hora. Ação administrativa, sem botão.
    const matchBroadcastAgendar = path_.match(/^\/painel\/api\/broadcast-agendar\/([^/]+)$/);
    if (req.method === "POST" && matchBroadcastAgendar) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchBroadcastAgendar[1]);
      const body = await parseBody(req);
      const itens = (Array.isArray(body.contacts) ? body.contacts : []).map((c) => ({
        phone: normalizarTelefoneBR(c.phone),
        name: c.name || null,
        template: c.template,
        language: c.language || "pt_BR",
        bodyPreview: c.bodyPreview || null,
        agendadoPara: Number(c.agendadoPara),
      }));
      if (!itens.length || itens.some((i) => !i.phone || !i.template || !Number.isFinite(i.agendadoPara))) {
        return send(res, 400, { error: "Cada contato precisa de phone, template e agendadoPara (ms)" });
      }
      const agendados = await db.broadcastAgendarLote(businessId, itens);
      return send(res, 200, { agendados });
    }

    // GET /painel/api/broadcast-fila/:businessId — itens de um broadcast com intervalo que
    // ainda não saíram, pra mostrar a fila no painel e permitir cancelar individualmente.
    const matchBroadcastFila = path_.match(/^\/painel\/api\/broadcast-fila\/([^/]+)$/);
    if (req.method === "GET" && matchBroadcastFila) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchBroadcastFila[1]);
      return send(res, 200, await db.broadcastListarPendentes(businessId));
    }

    // DELETE /painel/api/broadcast-fila/item/:id — cancela um envio agendado (só funciona se
    // ainda estiver 'pending'; se o agendador já pegou pra enviar, é tarde demais).
    const matchBroadcastCancelar = path_.match(/^\/painel\/api\/broadcast-fila\/item\/(\d+)$/);
    if (req.method === "DELETE" && matchBroadcastCancelar) {
      if (!requireAuth(req, res)) return;
      const ok = await db.broadcastCancelar(Number(matchBroadcastCancelar[1]));
      if (!ok) return send(res, 409, { error: "Não deu pra cancelar — já foi enviado ou já está sendo enviado agora" });
      return send(res, 200, { ok: true });
    }

    // ── E-mail (Brevo) — templates, campanha em massa, e-mail avulso de conversa ────────────
    const matchEmailTemplates = path_.match(/^\/painel\/api\/email-templates\/([^/]+)$/);
    if (req.method === "GET" && matchEmailTemplates) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.emailTemplatesListar(decodeURIComponent(matchEmailTemplates[1])));
    }
    if (req.method === "POST" && matchEmailTemplates) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.nome || !body.assunto || !body.corpoHtml) return send(res, 400, { error: "Informe nome, assunto e corpoHtml" });
      const id = await db.emailTemplateCriar({
        businessId: decodeURIComponent(matchEmailTemplates[1]),
        nome: body.nome,
        assunto: body.assunto,
        corpoHtml: body.corpoHtml,
      });
      return send(res, 200, { id });
    }

    const matchEmailTemplateDel = path_.match(/^\/painel\/api\/email-templates\/([^/]+)\/(\d+)$/);
    if (req.method === "DELETE" && matchEmailTemplateDel) {
      if (!requireAuth(req, res)) return;
      await db.emailTemplateApagar(Number(matchEmailTemplateDel[2]));
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/email-campanha/:businessId — agenda envio em massa de um template pra
    // uma lista de contatos (body: { templateId, contacts: [{ email, nome, agendadoPara }] }).
    const matchEmailCampanha = path_.match(/^\/painel\/api\/email-campanha\/([^/]+)$/);
    if (req.method === "POST" && matchEmailCampanha) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchEmailCampanha[1]);
      const body = await parseBody(req);
      const itens = (Array.isArray(body.contacts) ? body.contacts : []).map((c) => ({
        email: c.email,
        nome: c.nome || null,
        templateId: Number(body.templateId),
        agendadoPara: Number(c.agendadoPara),
      }));
      if (!itens.length || itens.some((i) => !i.email || !i.templateId || !Number.isFinite(i.agendadoPara))) {
        return send(res, 400, { error: "Cada contato precisa de email e agendadoPara (ms); informe templateId" });
      }
      const agendados = await db.emailAgendarLote(businessId, itens);
      return send(res, 200, { agendados });
    }

    const matchEmailFila = path_.match(/^\/painel\/api\/email-fila\/([^/]+)$/);
    if (req.method === "GET" && matchEmailFila) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.emailListarPendentes(decodeURIComponent(matchEmailFila[1])));
    }

    const matchEmailCancelar = path_.match(/^\/painel\/api\/email-fila\/item\/(\d+)$/);
    if (req.method === "DELETE" && matchEmailCancelar) {
      if (!requireAuth(req, res)) return;
      const ok = await db.emailCancelar(Number(matchEmailCancelar[1]));
      if (!ok) return send(res, 409, { error: "Não deu pra cancelar — já foi enviado ou já está sendo enviado agora" });
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/conversations/:businessId/:phone/email-avulso — manda um e-mail único
    // (não agendado) pro e-mail salvo dessa conversa, usando um template existente.
    const matchEmailAvulso = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/email-avulso$/);
    if (req.method === "POST" && matchEmailAvulso) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchEmailAvulso[1]);
      const phone = decodeURIComponent(matchEmailAvulso[2]);
      const body = await parseBody(req);
      try {
        const conversa = await db.getConversation(phone, businessId);
        if (!conversa?.email) return send(res, 400, { error: "Essa conversa não tem e-mail salvo" });
        const template = await db.emailTemplateObter(Number(body.templateId));
        if (!template) return send(res, 404, { error: "Template não encontrado" });
        const nome = conversa.name || "Cliente";
        const assunto = template.assunto.replace(/\{\{nome\}\}/g, nome);
        const html = template.corpo_html.replace(/\{\{nome\}\}/g, nome);
        await enviarEmail({ to: conversa.email, toNome: nome, subject: assunto, html });
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // ── Retornos (lembrete agendado por conversa — WhatsApp e/ou e-mail) ───────────────────
    // POST /painel/api/conversations/:businessId/:phone/retorno — cria um retorno pra essa
    // conversa (body: { tipo?, dataAgendada, canal, whatsappTemplate?, whatsappLanguage?, emailTemplateId? }).
    const matchRetornoCriar = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/retorno$/);
    if (req.method === "POST" && matchRetornoCriar) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchRetornoCriar[1]);
      const phone = decodeURIComponent(matchRetornoCriar[2]);
      const body = await parseBody(req);
      if (!body.dataAgendada || !body.canal) return send(res, 400, { error: "Informe dataAgendada (ms) e canal" });
      const id = await db.retornoCriar({
        businessId,
        phone,
        tipo: body.tipo,
        dataAgendada: Number(body.dataAgendada),
        canal: body.canal,
        whatsappTemplate: body.whatsappTemplate,
        whatsappLanguage: body.whatsappLanguage,
        whatsappParams: Array.isArray(body.whatsappParams) ? body.whatsappParams : undefined,
        fluxoId: body.fluxoId,
        emailTemplateId: body.emailTemplateId,
      });
      return send(res, 200, { id });
    }

    // GET /painel/api/fluxos/:businessId — fluxos dinâmicos desse número (id/nome/ativo), só
    // pra alimentar o seletor "Conectar a um fluxo" no painel (gerenciar os nós continua sendo
    // só via MCP).
    const matchFluxosListar = path_.match(/^\/painel\/api\/fluxos\/([^/]+)$/);
    if (req.method === "GET" && matchFluxosListar) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.fluxoDinamicoListar(decodeURIComponent(matchFluxosListar[1])));
    }

    const matchRetornosConversa = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/retornos$/);
    if (req.method === "GET" && matchRetornosConversa) {
      if (!requireAuth(req, res)) return;
      return send(
        res,
        200,
        await db.retornoListarPorConversa(decodeURIComponent(matchRetornosConversa[1]), decodeURIComponent(matchRetornosConversa[2]))
      );
    }

    const matchRetornosNegocio = path_.match(/^\/painel\/api\/retornos\/([^/]+)$/);
    if (req.method === "GET" && matchRetornosNegocio) {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.retornoListarPendentes(decodeURIComponent(matchRetornosNegocio[1])));
    }

    const matchRetornoCancelar = path_.match(/^\/painel\/api\/retornos\/item\/(\d+)$/);
    if (req.method === "DELETE" && matchRetornoCancelar) {
      if (!requireAuth(req, res)) return;
      const ok = await db.retornoCancelar(Number(matchRetornoCancelar[1]));
      if (!ok) return send(res, 409, { error: "Não deu pra cancelar — já foi enviado ou já está sendo enviado agora" });
      return send(res, 200, { ok: true });
    }

    // ── Backup/exportação de conversa por e-mail ───────────────────────────────────────────
    // GET/POST /painel/api/email-backup/:businessId — e-mail que recebe a exportação (1 por
    // negócio, configurado 1x no painel e reusado depois).
    const matchEmailBackup = path_.match(/^\/painel\/api\/email-backup\/([^/]+)$/);
    if (req.method === "GET" && matchEmailBackup) {
      if (!requireAuth(req, res)) return;
      const email = await db.emailBackupObter(decodeURIComponent(matchEmailBackup[1]));
      return send(res, 200, { email });
    }
    if (req.method === "POST" && matchEmailBackup) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.email) return send(res, 400, { error: "Informe email" });
      await db.emailBackupDefinir(decodeURIComponent(matchEmailBackup[1]), body.email);
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/conversations/:businessId/:phone/exportar-email — manda o histórico
    // inteiro dessa conversa por e-mail pro endereço de backup configurado acima. Complementa o
    // /exportar (GET, baixa .txt no navegador) — esse aqui manda por e-mail em vez de baixar.
    const matchExportarEmail = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/exportar-email$/);
    if (req.method === "POST" && matchExportarEmail) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchExportarEmail[1]);
      const phone = decodeURIComponent(matchExportarEmail[2]);
      try {
        const destino = await db.emailBackupObter(businessId);
        if (!destino) return send(res, 400, { error: "Configure um e-mail de backup pra esse canal antes de exportar." });
        const conversa = await db.getConversation(phone, businessId);
        const mensagens = await db.listMessages(phone, businessId);
        const nomeContato = conversa?.name || phone;
        const linhas = mensagens.map((m) => {
          const quando = new Date(m.created_at).toLocaleString("pt-BR");
          const quem = m.direction === "in" ? nomeContato : m.origem ? `Atendente (${m.origem === "humano" ? "painel" : m.origem})` : "Automático";
          const corpo = (m.body || `[${m.type}]`).replace(/</g, "&lt;").replace(/\n/g, "<br>");
          return `<p style="margin:0 0 10px"><strong>${quem}</strong> <span style="color:#888">${quando}</span><br>${corpo}</p>`;
        });
        const html = `<h2>Conversa com ${nomeContato} (${phone})</h2>${linhas.join("") || "<p>Sem mensagens.</p>"}`;
        await enviarEmail({ to: destino, subject: `Backup de conversa — ${nomeContato}`, html });
        return send(res, 200, { ok: true, enviadoPara: destino });
      } catch (err) {
        return send(res, 502, { error: err.message });
      }
    }

    // POST /painel/api/registrar-numero/:businessId — registro único de um número novo na
    // Cloud API (depois de já verificado por SMS/ligação no Business Manager). Ação
    // administrativa de uma vez só por número, não faz parte do fluxo normal do painel — sem
    // botão na interface de propósito, chama direto via requisição autenticada.
    const matchRegistrarNumero = path_.match(/^\/painel\/api\/registrar-numero\/([^/]+)$/);
    if (req.method === "POST" && matchRegistrarNumero) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchRegistrarNumero[1]);
      const body = await parseBody(req);
      if (!body.pin || String(body.pin).length !== 6) {
        return send(res, 400, { error: "Informe um PIN de 6 dígitos" });
      }
      try {
        const result = await wa.registerNumber(businessId, body.pin);
        return send(res, 200, { ok: true, result });
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // GET/POST /painel/api/webhook-inscricao/:wabaId — checa (GET) ou corrige (POST) a
    // inscrição de webhook de uma conta do WhatsApp (WABA, não o número). Sem essa inscrição
    // a Meta nunca chama nosso /webhook, então o bot nunca reage a mensagem nenhuma nesse
    // número, mesmo com tudo mais certo (número registrado, template aprovado etc.). Mesma
    // filosofia do registrar-numero: ação administrativa, sem botão na interface.
    const matchWebhookInscricao = path_.match(/^\/painel\/api\/webhook-inscricao\/([^/]+)$/);
    if (req.method === "GET" && matchWebhookInscricao) {
      if (!requireAuth(req, res)) return;
      try {
        const result = await wa.checarInscricaoWebhook(decodeURIComponent(matchWebhookInscricao[1]));
        return send(res, 200, result);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }
    if (req.method === "POST" && matchWebhookInscricao) {
      if (!requireAuth(req, res)) return;
      try {
        const result = await wa.inscreverWebhook(decodeURIComponent(matchWebhookInscricao[1]));
        return send(res, 200, result);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // POST /painel/api/instagram/importar-historico — importa as DMs que já existiam antes
    // da gravação automática via webhook começar (ver instagramImportarHistorico acima).
    // Idempotente — pode clicar de novo sem duplicar.
    if (req.method === "POST" && path_ === "/painel/api/instagram/importar-historico") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await instagramImportarHistorico());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/perfil — perfil do Instagram conectado
    if (req.method === "GET" && path_ === "/painel/api/instagram/perfil") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.getPerfil());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/insights — métricas do último post
    if (req.method === "GET" && path_ === "/painel/api/instagram/insights") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.getInsightsUltimoPost());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/comentarios — comentários do último post
    if (req.method === "GET" && path_ === "/painel/api/instagram/comentarios") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.getComentariosUltimoPost());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/publicacoes — lista publicações (id, permalink) do Instagram
    if (req.method === "GET" && path_ === "/painel/api/instagram/publicacoes") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.listarPublicacoes());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/conversas — lista de conversas (DMs) do Instagram
    if (req.method === "GET" && path_ === "/painel/api/instagram/conversas") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.getConversas());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/instagram/diagnostico — testa, com o token já configurado no
    // servidor, se cada permissão do Instagram está com Acesso Avançado de verdade
    if (req.method === "GET" && path_ === "/painel/api/instagram/diagnostico") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await ig.diagnostico());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/whatsapp/diagnostico/:phoneNumberId — diagnóstico de "mensagem não
    // entregue": saúde do número (quality rating, limite de mensagens, status de conexão) na
    // Meta + quantos contatos distintos falharam nos últimos 7 dias nesse número no nosso banco
    // (1 contato só = problema do telefone dele; vários = problema do número/WABA).
    const matchWhatsappDiagnostico = path_.match(/^\/painel\/api\/whatsapp\/diagnostico\/([^/]+)$/);
    if (req.method === "GET" && matchWhatsappDiagnostico) {
      if (!requireAuth(req, res)) return;
      const phoneNumberId = matchWhatsappDiagnostico[1];
      try {
        const [numero, falhas] = await Promise.all([
          wa.checarNumero(phoneNumberId),
          db.whatsappFalhasRecentes(phoneNumberId, Date.now() - 7 * 24 * 60 * 60 * 1000),
        ]);
        return send(res, 200, { numero, falhas7dias: falhas.agrupado, detalheFalhas7dias: falhas.detalhe });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/instagram/reset-boasvindas — limpa quem já recebeu boas-vindas (uso em testes)
    if (req.method === "POST" && path_ === "/painel/api/instagram/reset-boasvindas") {
      if (!requireAuth(req, res)) return;
      const removidos = await db.instagramLimparSaudados();
      return send(res, 200, { ok: true, removidos });
    }

    // GET /painel/api/publicar/contas — lista contas e quais redes já têm credencial (Publique IV)
    if (req.method === "GET" && path_ === "/painel/api/publicar/contas") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, publique.listarContas());
    }

    // POST /painel/api/publicar — publica o mesmo conteúdo em várias redes de uma vez (Publique IV).
    // Aceita imagemUrl (link já pronto) OU imagemBase64 (upload direto do computador — o
    // servidor salva e gera a URL pública sozinho).
    if (req.method === "POST" && path_ === "/painel/api/publicar") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      // imagensBase64 (array, 2+) = carrossel — tem prioridade sobre imagemBase64 único
      // (mesmo padrão já usado em /painel/api/agenda).
      if (Array.isArray(body.imagensBase64) && body.imagensBase64.length) {
        try {
          body.imagemUrls = body.imagensBase64.map((b64) => {
            const filename = salvarImagemPublicar(b64);
            return `https://${req.headers.host}/publicar-media/${filename}`;
          });
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      } else if (body.imagemBase64) {
        try {
          const filename = salvarImagemPublicar(body.imagemBase64);
          body.imagemUrl = `https://${req.headers.host}/publicar-media/${filename}`;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }
      // imagensBase64PorRede ({ rede: base64 }) — versão reenquadrada manualmente no painel
      // pra uma rede específica (ex. Stories 9:16), vence a imagem padrão só naquela rede.
      if (body.imagensBase64PorRede && typeof body.imagensBase64PorRede === "object") {
        try {
          body.imagemUrlPorRede = {};
          for (const [rede, b64] of Object.entries(body.imagensBase64PorRede)) {
            const filename = salvarImagemPublicar(b64);
            body.imagemUrlPorRede[rede] = `https://${req.headers.host}/publicar-media/${filename}`;
          }
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }
      if (!body.texto && !body.imagemUrl && !(body.imagemUrls && body.imagemUrls.length)) {
        return send(res, 400, { error: "Informe ao menos um texto ou uma imagem" });
      }
      try {
        const resultados = await publique.publicarEmTodos(body);
        return send(res, 200, { resultados });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /publicar-media/:arquivo — serve as imagens enviadas pelo Publique IV, SEM login
    // (Instagram/Facebook precisam buscar essa imagem publicamente pra publicar). Pasta
    // própria e separada de /media/ (essa continua exigindo login, guarda mídia de clientes).
    const matchPublicarMedia = path_.match(/^\/publicar-media\/([a-zA-Z0-9_.-]+)$/);
    if ((req.method === "GET" || req.method === "HEAD") && matchPublicarMedia) {
      const filePath = path.join(PUBLICAR_MEDIA_DIR, matchPublicarMedia[1]);
      if (!filePath.startsWith(PUBLICAR_MEDIA_DIR) || !fs.existsSync(filePath)) {
        return send(res, 404, "Not found");
      }
      return sendMediaBuffer(req, res, fs.readFileSync(filePath), mimeDoArquivo(matchPublicarMedia[1]));
    }

    // POST /painel/api/publicar/perfil-facebook — troca capa/foto de perfil/"sobre" da
    // Página do Facebook (Publique IV). Instagram não tem endpoint de escrita pra isso.
    if (req.method === "POST" && path_ === "/painel/api/publicar/perfil-facebook") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      if (!body.capaUrl && !body.fotoPerfilUrl && !body.sobre) {
        return send(res, 400, { error: "Informe ao menos um campo para atualizar" });
      }
      try {
        const resultados = await publique.atualizarPerfilFacebook(body);
        return send(res, 200, { resultados });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/agenda — cria um post agendado (dia+hora exatos, multi-rede). Aceita
    // imagemBase64 opcional (a imagem sobe pro R2, não pra pasta local — precisa sobreviver
    // até a data marcada, mesmo que o servidor reinicie nesse meio tempo).
    if (req.method === "POST" && path_ === "/painel/api/agenda") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        let imagem = {};
        if (body.imagemBase64) imagem = decodificarImagemBase64(body.imagemBase64);
        // imagensBase64 (array, 2+) = carrossel — tem prioridade sobre imagemBase64 único.
        const imagens = Array.isArray(body.imagensBase64) && body.imagensBase64.length
          ? body.imagensBase64.map((b64) => decodificarImagemBase64(b64))
          : undefined;
        // imagensBase64PorRede ({ rede: base64 }) — mesma ideia do /painel/api/publicar,
        // versão reenquadrada manualmente pra uma rede específica.
        let imagensPorRede;
        if (body.imagensBase64PorRede && typeof body.imagensBase64PorRede === "object") {
          imagensPorRede = {};
          for (const [rede, b64] of Object.entries(body.imagensBase64PorRede)) {
            imagensPorRede[rede] = decodificarImagemBase64(b64);
          }
        }
        let video = {};
        if (body.videoBase64) video = decodificarVideoBase64(body.videoBase64);
        const criado = await agenda.criarAgendamento({
          contaId: body.contaId,
          texto: body.texto,
          link: body.link,
          redes: body.redes,
          dataHoraString: body.data,
          imagemBuffer: imagem.buffer,
          imagemNomeArquivo: imagem.nomeArquivo,
          imagemContentType: imagem.contentType,
          imagens,
          imagensPorRede,
          videoBuffer: video.buffer,
          videoNomeArquivo: video.nomeArquivo,
          videoContentType: video.contentType,
        });
        return send(res, 200, criado);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // GET /painel/api/agenda/fila — todos os posts pendentes, ordenados pelo mais próximo
    if (req.method === "GET" && path_ === "/painel/api/agenda/fila") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await agenda.listarFila());
    }

    // GET /painel/api/agenda/lista — histórico (pendentes + publicados + com erro). Aceita
    // ?contaId= (filtra antes do LIMIT, senão contas com pouco volume somem numa fila grande
    // de outras contas) e ?limit= (default 50).
    if (req.method === "GET" && path_ === "/painel/api/agenda/lista") {
      if (!requireAuth(req, res)) return;
      const contaId = url.searchParams.get("contaId") || null;
      const limit = Math.max(Number(url.searchParams.get("limit")) || 50, 1);
      const [resumo, recentes] = await Promise.all([agenda.resumo(), agenda.listarRecentes(limit, contaId)]);
      return send(res, 200, { resumo, recentes });
    }

    // POST /painel/api/agenda/:id/publicar-agora — publica esse post específico na hora,
    // fora de ordem (ação manual do usuário)
    const matchAgendaPublicarAgora = path_.match(/^\/painel\/api\/agenda\/(\d+)\/publicar-agora$/);
    if (req.method === "POST" && matchAgendaPublicarAgora) {
      if (!requireAuth(req, res)) return;
      try {
        const resultado = await agenda.publicarAgoraEspecifico(Number(matchAgendaPublicarAgora[1]));
        return send(res, 200, resultado);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // POST /painel/api/agenda/:id/data — reagenda um post pendente pra outro dia/hora
    const matchAgendaData = path_.match(/^\/painel\/api\/agenda\/(\d+)\/data$/);
    if (req.method === "POST" && matchAgendaData) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        await agenda.definirData(Number(matchAgendaData[1]), body.data);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // POST /painel/api/agenda/:id/reenfileirar — devolve um post com erro pra fila
    const matchAgendaReenfileirar = path_.match(/^\/painel\/api\/agenda\/(\d+)\/reenfileirar$/);
    if (req.method === "POST" && matchAgendaReenfileirar) {
      if (!requireAuth(req, res)) return;
      await agenda.reenfileirar(Number(matchAgendaReenfileirar[1]));
      return send(res, 200, { ok: true });
    }

    // DELETE /painel/api/agenda/:id — tira um post da agenda (e apaga a imagem do R2)
    const matchAgendaId = path_.match(/^\/painel\/api\/agenda\/(\d+)$/);
    if (req.method === "DELETE" && matchAgendaId) {
      if (!requireAuth(req, res)) return;
      try {
        await agenda.removerAgendamento(Number(matchAgendaId[1]));
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
    }

    // GET /painel/api/reels/status — resumo da fila + últimos itens (Publique IV → Reels em massa)
    if (req.method === "GET" && path_ === "/painel/api/reels/status") {
      if (!requireAuth(req, res)) return;
      const [resumoFila, recentes, pausado, postsPorDia, legendaPadrao, espaco] = await Promise.all([
        reels.resumo(),
        reels.listarRecentes(30),
        reels.configGet("pausado"),
        reels.configGet("posts_por_dia"),
        reels.configGet("legenda_padrao"),
        reels.espacoUsado().catch(() => null), // null se as credenciais do R2 ainda não estiverem configuradas
      ]);
      // pausado = null (nunca configurado) conta como pausado — mesmo default do agendador
      return send(res, 200, {
        resumo: resumoFila,
        recentes,
        pausado: pausado !== "0",
        postsPorDia: Number(postsPorDia) || 5,
        legendaPadrao: legendaPadrao || "",
        espaco,
      });
    }

    // POST /painel/api/reels/posts-por-dia — configura quantos posts/dia o agendador
    // automático publica (espalhados entre 08:00 e 22:00, ver server.js)
    if (req.method === "POST" && path_ === "/painel/api/reels/posts-por-dia") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      const quantidade = Math.min(Math.max(Number(body.quantidade) || 1, 1), 48);
      await reels.configSet("posts_por_dia", String(quantidade));
      return send(res, 200, { ok: true, quantidade });
    }

    // POST /painel/api/reels/legenda-padrao — legenda usada em todo vídeo que não tiver
    // uma legenda própria definida no upload
    if (req.method === "POST" && path_ === "/painel/api/reels/legenda-padrao") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await reels.configSet("legenda_padrao", body.legenda || "");
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/reels/upload — sobe um vídeo direto do computador pra fila (R2, sem
    // precisar abrir nenhum site por fora) e já sincroniza na hora. Legenda e data mínima
    // são opcionais — sem legenda usa a padrão, sem data publica na ordem normal da fila.
    if (req.method === "POST" && path_ === "/painel/api/reels/upload") {
      if (!requireAuth(req, res)) return;
      let arquivoPath;
      try {
        const recebido = await receberVideoTemp(req);
        arquivoPath = recebido.arquivoPath;
        const buffer = fs.readFileSync(arquivoPath);
        const arquivoR2 = await reels.enviarVideo(buffer, recebido.nomeOriginal, recebido.legenda, recebido.dataMinima);
        return send(res, 200, { ok: true, nome: arquivoR2.name });
      } catch (err) {
        return send(res, 500, { error: err.message });
      } finally {
        if (arquivoPath) fs.unlink(arquivoPath, () => {});
      }
    }

    // GET /painel/api/reels/fila — fila completa de pendentes, com data prevista calculada
    // pra cada um (estimativa, não é gravada — muda se a quantidade/dia ou a ordem mudar)
    if (req.method === "GET" && path_ === "/painel/api/reels/fila") {
      if (!requireAuth(req, res)) return;
      try {
        return send(res, 200, await reels.listarFilaComEstimativa());
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/reels/:id/publicar-agora — publica ESSE vídeo específico na hora,
    // fora da ordem da fila (ação manual e explícita, ignora data mínima de propósito)
    const matchPublicarItem = path_.match(/^\/painel\/api\/reels\/(\d+)\/publicar-agora$/);
    if (req.method === "POST" && matchPublicarItem) {
      if (!requireAuth(req, res)) return;
      try {
        const resultado = await reels.publicarItemEspecifico(Number(matchPublicarItem[1]));
        return send(res, 200, resultado);
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/reels/:id/data — define (ou limpa, se {data: null}) a data mínima
    // de publicação de um vídeo específico da fila
    const matchDataItem = path_.match(/^\/painel\/api\/reels\/(\d+)\/data$/);
    if (req.method === "POST" && matchDataItem) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        await reels.definirData(Number(matchDataItem[1]), body.data || null);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // DELETE /painel/api/reels/:id — tira um vídeo da fila (e apaga do R2) antes dele
    // ser publicado — usado quando o usuário muda de ideia sobre um vídeo específico
    const matchRemoverItem = path_.match(/^\/painel\/api\/reels\/(\d+)$/);
    if (req.method === "DELETE" && matchRemoverItem) {
      if (!requireAuth(req, res)) return;
      try {
        await reels.removerItem(Number(matchRemoverItem[1]));
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/reels/sincronizar — puxa a lista atual do bucket R2 pra fila
    if (req.method === "POST" && path_ === "/painel/api/reels/sincronizar") {
      if (!requireAuth(req, res)) return;
      try {
        const resultado = await reels.sincronizarFila();
        return send(res, 200, resultado);
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/reels/pausar — liga/desliga o agendador automático
    if (req.method === "POST" && path_ === "/painel/api/reels/pausar") {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      await reels.configSet("pausado", body.pausado ? "1" : "0");
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/reels/publicar-agora — publica o próximo pendente na hora (sem
    // esperar o horário agendado), útil pra testar o fluxo inteiro com 1 vídeo antes de
    // deixar os 1500 rodando sozinhos.
    if (req.method === "POST" && path_ === "/painel/api/reels/publicar-agora") {
      if (!requireAuth(req, res)) return;
      try {
        const resultado = await reels.publicarProximoPendente();
        return send(res, 200, resultado);
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/reels/:id/reenfileirar — devolve um vídeo com erro pra fila
    const matchReelsRetry = path_.match(/^\/painel\/api\/reels\/(\d+)\/reenfileirar$/);
    if (req.method === "POST" && matchReelsRetry) {
      if (!requireAuth(req, res)) return;
      await reels.reenfileirar(Number(matchReelsRetry[1]));
      return send(res, 200, { ok: true });
    }

    // GET /painel/api/ads/campanhas — lista campanhas com métricas
    if (req.method === "GET" && path_ === "/painel/api/ads/campanhas") {
      if (!requireAuth(req, res)) return;
      try {
        const campanhas = await ads.listarCampanhas();
        const comInsights = await Promise.all(
          campanhas.map(async (c) => ({
            ...c,
            insights: await ads.obterInsights(c.id).catch(() => null),
          }))
        );
        return send(res, 200, { campanhas: comInsights });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // POST /painel/api/ads/:id/status — pausar/ativar campanha, conjunto ou anúncio
    const matchAdsStatus = path_.match(/^\/painel\/api\/ads\/([a-zA-Z0-9_]+)\/status$/);
    if (req.method === "POST" && matchAdsStatus) {
      if (!requireAuth(req, res)) return;
      const body = await parseBody(req);
      try {
        await ads.atualizarStatus(matchAdsStatus[1], body.status);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/telegram/contacts — lista de contatos captados pelo bot
    if (req.method === "GET" && path_ === "/painel/api/telegram/contacts") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, await db.telegramListContacts());
    }

    // GET /media/:filename — servir arquivo de mídia recebida de cliente (fica no R2, ver
    // comentário em "clientes/" acima — disco local não sobrevive a deploy/restart do Render).
    // Aceita token de mídia (?token=...) como alternativa ao Basic Auth — ver gerarTokenMedia:
    // <img>/<audio> não conseguem mandar o header Authorization, só um fetch com header
    // customizado consegue.
    const matchMedia = path_.match(/^\/media\/([a-zA-Z0-9_.-]+)$/);
    if ((req.method === "GET" || req.method === "HEAD") && matchMedia) {
      const token = url.searchParams.get("token");
      if (!(token && validarTokenMedia(token)) && !requireAuth(req, res)) return;
      try {
        const { buffer } = await r2.baixarArquivo(`clientes/${matchMedia[1]}`);
        return sendMediaBuffer(req, res, buffer, mimeDoArquivo(matchMedia[1]));
      } catch {
        return send(res, 404, "Not found");
      }
    }

    // GET /painel/api/google/autorizar — abre 1x (logado no painel) pra autorizar o acesso ao
    // Google Contacts. Depois disso o refresh_token fica salvo no banco (ver google.js) e nunca
    // mais precisa repetir. Ver passo a passo em CHAVES-LOCAL.md.
    if (req.method === "GET" && path_ === "/painel/api/google/autorizar") {
      if (!requireAuth(req, res)) return;
      try {
        res.writeHead(302, { Location: google.urlAutorizacao(req.headers.host) });
        return res.end();
      } catch (err) {
        return send(res, 500, { error: err.message });
      }
    }

    // GET /painel/api/google/callback — redirect de volta do Google com o "code" de
    // autorização; troca por refresh_token e salva no banco.
    if (req.method === "GET" && path_ === "/painel/api/google/callback") {
      if (!requireAuth(req, res)) return;
      const code = url.searchParams.get("code");
      try {
        if (!code) throw new Error("Google não mandou o código de autorização (usuário cancelou?).");
        await google.trocarCodigoPorToken(code, req.headers.host);
        return send(res, 200, "Google Contacts conectado! Pode fechar essa aba.", { "Content-Type": "text/html; charset=utf-8" });
      } catch (err) {
        return send(res, 500, `Erro ao conectar Google Contacts: ${err.message}`, { "Content-Type": "text/html; charset=utf-8" });
      }
    }

    // Health check
    if (req.method === "GET" && path_ === "/") {
      return send(res, 200, { status: "ok", message: "WhatsApp Webhook rodando" });
    }

    send(res, 404, "Not found");
  } catch (err) {
    console.error("Erro no request:", err);
    // Detalhe real do erro só pra quem já passou por Basic Auth — rotas públicas (webhook,
    // health check) continuam recebendo só "Erro interno", sem vazar detalhe de implementação.
    send(res, 500, { error: isAuthorized(req) ? err.message : "Erro interno" });
  }
});

// Carrega o cache de usuários (login por pessoa) ANTES de abrir a porta — isAuthorized precisa
// ser síncrona, então a primeira requisição já precisa achar o array pronto, não vazio por uma
// corrida com essa carga assíncrona. Se a tabela `usuarios` estiver vazia (ninguém cadastrado
// ainda) ou o banco estiver fora do ar, recarregarUsuariosCache já loga e segue com array vazio
// — PAINEL_USER/PAINEL_PASS continuam funcionando como fallback, o servidor nunca deixa de subir
// por causa disso.
recarregarUsuariosCache().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`   Webhook URL: https://SEU_DOMINIO/webhook`);
    console.log(`   Painel:      https://SEU_DOMINIO/painel`);
    console.log("─".repeat(50));
  });
});

// ─── LIMPEZA DE MÍDIA TEMPORÁRIA DO PUBLIQUE IV ──────────────────────────────
// Imagem/vídeo enviados pra publicar (ou processados pelo editor manual de moldura) ficam
// em PUBLICAR_MEDIA_DIR só o tempo necessário — Meta/Instagram precisam buscar a URL na
// hora de publicar, e o botão "Baixar" do editor precisa de um tempo de sobra. Sem essa
// limpeza, arquivo processado nunca era apagado e ia acumulando disco sem limite.
const MEDIA_MAX_IDADE_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  fs.readdir(PUBLICAR_MEDIA_DIR, (err, arquivos) => {
    if (err) return;
    const agora = Date.now();
    for (const nome of arquivos) {
      const arquivoPath = path.join(PUBLICAR_MEDIA_DIR, nome);
      fs.stat(arquivoPath, (err, info) => {
        if (!err && agora - info.mtimeMs > MEDIA_MAX_IDADE_MS) fs.unlink(arquivoPath, () => {});
      });
    }
  });
}, 60 * 60 * 1000);

// ─── AUTO-PING (manter o Render acordado) ────────────────────────────────────
// O free tier do Render hiberna após ~15 min sem tráfego. O próprio servidor
// chama /ping pela URL pública a cada 10 min, contando como tráfego de entrada.
// (Só não resolve se o processo já estiver dormindo — pra isso serve um monitor
// externo tipo UptimeRobot apontando pra mesma URL, ver README.)
const PUBLIC_URL = process.env.PUBLIC_URL || "https://meuwhats.onrender.com";
setInterval(() => {
  https
    .get(`${PUBLIC_URL}/ping`, (res) => res.resume())
    .on("error", (err) => console.error("Auto-ping falhou:", err.message));
}, 10 * 60 * 1000);

// ─── VERIFICADOR DE FLUXOS PARADOS ───────────────────────────────────────────
// A cada minuto: quem está aguardando resposta há mais tempo que o limite do
// passo recebe UM lembrete (marcação atômica no banco evita duplicados).
// Obs: no plano free do Render o servidor pode hibernar sem tráfego — nesse
// caso o lembrete sai no próximo despertar (webhook/painel), com atraso.
setInterval(async () => {
  try {
    const pendentes = await db.listarFluxosAguardando();
    const agora = Date.now();
    for (const p of pendentes) {
      const fluxoDoContato = await getFluxo(p.business_number_id, p.phone, p.fluxo_passo);
      const config = fluxoDoContato.lembreteMinutos[p.fluxo_passo];
      // Cada passo pode ter 1 lembrete (número, comportamento de sempre) ou vários (array de
      // minutos, contados sempre a partir de fluxo_passo_at — não incremental do lembrete
      // anterior, pra não acumular atraso). `fluxo_lembrete` é o índice de quantos toques
      // esse contato já recebeu; passou do tamanho do array = já mandou tudo, ignora.
      const minutosArray = Array.isArray(config) ? config : config ? [config] : [];
      const indice = Number(p.fluxo_lembrete) || 0;
      if (indice >= minutosArray.length) continue;
      const minutos = minutosArray[indice];
      if (agora - Number(p.fluxo_passo_at) < minutos * 60 * 1000) continue;
      if (!(await db.tentarMarcarLembreteEnviado(p.phone, p.business_number_id, indice))) continue;
      try {
        // Passo com handler próprio (ex.: precisa mandar botões, não só texto puro) cuida de
        // tudo sozinho, inclusive setFluxoPasso — nenhum fluxo usa isso agora, mas o mecanismo
        // (lembreteHandlers) continua disponível pro próximo que precisar.
        const handler = fluxoDoContato.lembreteHandlers?.[p.fluxo_passo];
        if (handler) {
          await handler(p.phone, p.business_number_id);
        } else {
          const textosConfig = fluxoDoContato.lembreteTextos[p.fluxo_passo];
          const textosArray = Array.isArray(textosConfig) ? textosConfig : [textosConfig || fluxoDoContato.lembreteTextos.padrao];
          const texto = textosArray[indice] || textosArray[textosArray.length - 1];
          await enviarRespostaAutomatica(p.business_number_id, p.phone, texto);
        }
        console.log(`⏰ Lembrete de fluxo parado enviado para ${p.phone} (passo ${p.fluxo_passo}, toque ${indice + 1}/${minutosArray.length})`);
      } catch (err) {
        console.error("Erro ao enviar lembrete de fluxo:", err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de fluxos parados:", err.message);
  }
}, 60 * 1000);

// ─── VERIFICADOR DE JANELA DE 24H (KEEP-ALIVE) ──────────────────────────────
// A cada minuto: quem está com um fluxo em aberto e mais de 20h sem responder
// (mas ainda dentro da janela de 24h pra mensagem livre) recebe UM aviso pra
// tentar trazer a pessoa de volta antes que a janela feche e vire template.
setInterval(async () => {
  try {
    const pendentes = await db.listarJanelasParaManter();
    for (const p of pendentes) {
      if (!(await db.tentarMarcarJanelaLembreteEnviado(p.phone, p.business_number_id))) continue;
      const fluxoDoContato = await getFluxo(p.business_number_id, p.phone, p.fluxo_passo);
      // Ciahot: só o lembrete de 17min do passo "ciahot_oferta" (já é 1 toque só) — sem esse
      // segundo aviso de manter-janela também, pra não ficar insistindo com quem já ignorou o
      // primeiro. tentarMarcarJanelaLembreteEnviado acima já marca como tratado, então não
      // reaparece nas próximas voltas do verificador.
      if (fluxoDoContato.semAvisoJanela) continue;
      // Felizcred e Campanha CLT: o aviso "Ainda por aí?" foi retirado (pedido do usuário em 23/10/2026).
      if (NUMEROS_CONSIGNADO.includes(p.business_number_id)) continue;
      if (fluxoDoContato.semAvisoJanelaEmPassos?.includes(p.fluxo_passo)) continue;
      try {
        const manterJanela = fluxoDoContato.lembreteTextos.manter_janela || LEMBRETE_TEXTOS_COTACERTA.manter_janela;
        const texto = typeof manterJanela === "function" ? manterJanela(p.fluxo_passo) : manterJanela;
        await enviarRespostaAutomatica(p.business_number_id, p.phone, texto);
        console.log(`🔔 Aviso de janela (20h) enviado para ${p.phone} (passo ${p.fluxo_passo})`);
      } catch (err) {
        console.error("Erro ao enviar aviso de janela:", err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de janela de 24h:", err.message);
  }
}, 60 * 1000);

// ─── LEMBRETE DE INSTAGRAM (10H DE SILÊNCIO) ────────────────────────────────
// Felizcred e Cota Certa, só — pedido do usuário em 26/09/2026. Diferente do lembrete de fluxo
// (que só olha quem está parado NUM PASSO específico) e da janela de 24h (só quem tem fluxo
// aberto): esse aqui é por CONVERSA inteira, sem importar se o fluxo automático já terminou ou
// foi pro atendimento humano — qualquer conversa quieta há 10h (nas duas direções) recebe,
// 1 vez só pra sempre (ver instagram_lembrete_at).
const HORAS_SILENCIO_LEMBRETE_INSTAGRAM = 10;
const LEMBRETE_INSTAGRAM_POR_NUMERO = {
  [FELIZCRED_PRINCIPAL_NUMBER_ID]:
    "Enquanto isso, não deixa de nos seguir no Instagram e ativar as notificações — é lá que " +
    "a gente avisa antes de todo mundo sobre novidades e condições especiais 😊\n\n" +
    "📷 https://www.instagram.com/felizcred/\n🌐 https://www.felizcred.com.br",
  [COTACERTA_NUMBER_ID]:
    "Enquanto isso, não deixa de nos seguir no Instagram e ativar as notificações — é lá que " +
    "a gente avisa antes de todo mundo sobre novidades e condições especiais 😊\n\n" +
    "📷 https://www.instagram.com/cotacertaseguros/\n🌐 https://www.cotacertaseguros.com.br",
};
setInterval(async () => {
  try {
    // Só entre 9h e 20h (Brasília); fora disso espera o próximo ciclo, desde que ainda esteja dentro das 24h do cliente.
    const horaBrasilia = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date())) % 24;
    if (horaBrasilia < 9 || horaBrasilia >= 20) return;
    const numeros = Object.keys(LEMBRETE_INSTAGRAM_POR_NUMERO);
    const pendentes = await db.listarParaLembreteInstagram(numeros, HORAS_SILENCIO_LEMBRETE_INSTAGRAM);
    for (const p of pendentes) {
      if (!(await db.tentarMarcarInstagramLembreteEnviado(p.phone, p.business_number_id))) continue;
      try {
        await enviarRespostaAutomatica(p.business_number_id, p.phone, LEMBRETE_INSTAGRAM_POR_NUMERO[p.business_number_id]);
        console.log(`📷 Lembrete de Instagram (10h) enviado para ${p.phone} (${p.business_number_id})`);
      } catch (err) {
        console.error("Erro ao enviar lembrete de Instagram:", err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de lembrete de Instagram:", err.message);
  }
}, 5 * 60 * 1000);

// ─── AGENDADOR DE REELS EM MASSA (Publique IV) ──────────────────────────────
// A cada minuto, checa (no horário de Brasília) se bateu um dos horários do dia — se sim,
// e ainda não postou nesse horário hoje, publica o próximo vídeo pendente (Instagram +
// Facebook, sem processar — vídeo já vem pronto do R2, editado por fora). Fica pausado
// por padrão até alguém configurar o R2 e ligar pelo painel.
//
// A quantidade de posts/dia é configurável (reels_config.posts_por_dia, padrão 5) — os
// horários são espalhados automaticamente entre 08:00 e 22:00 conforme a quantidade, em
// vez de uma lista fixa, pra caber tanto "5 por dia" quanto "15 por dia" (~100/semana).
function calcularHorariosDoDia(quantidade) {
  const inicioMin = 8 * 60;
  const fimMin = 22 * 60;
  const passo = quantidade > 1 ? (fimMin - inicioMin) / (quantidade - 1) : 0;
  const horarios = [];
  for (let i = 0; i < quantidade; i++) {
    const minutos = Math.round(inicioMin + passo * i);
    horarios.push(`${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`);
  }
  return horarios;
}

function logPublicacaoReel(prefixo, resultado) {
  const links = Object.entries(resultado.resultado)
    .filter(([, r]) => r.ok)
    .map(([rede, r]) => `${rede}: ${r.link}`)
    .join(" | ");
  console.log(`${prefixo} ${links}`);
}

setInterval(async () => {
  try {
    // Agenda de publicações (posts de texto/imagem multi-rede) — cada post tem hora exata
    // própria, sempre ativa (não depende do "pausado" dos Reels, que é outro sistema).
    const agendado = await agenda.publicarProximoDevido();
    if (!agendado.vazio) {
      const links = Object.entries(agendado.resultado)
        .filter(([, r]) => r.ok)
        .map(([rede, r]) => `${rede}: ${r.link}`)
        .join(" | ");
      console.log(`📅 Post agendado publicado: ${links}`);
    }
  } catch (err) {
    console.error("Erro no agendador de posts (agenda):", err.message);
  }
}, 60 * 1000);

// Broadcast com intervalo entre mensagens (ver POST /painel/api/broadcast) — checa a cada
// 20s (mais fino que os outros agendadores porque aqui o intervalo escolhido pelo usuário
// pode ser curto) e processa TODOS os itens já devidos no tick, não só 1, pra recuperar
// atraso rápido se o servidor ficou fora do ar.
setInterval(async () => {
  try {
    for (let i = 0; i < 20; i++) {
      const item = await db.broadcastProximoDevido();
      if (!item) break;
      const resultado = await enviarUmBroadcast(item.business_id, {
        phone: item.phone,
        name: item.name,
        template: item.template,
        language: item.language,
        bodyPreview: item.body_preview,
      });
      if (resultado.ok) {
        await db.broadcastMarcarEnviado(item.id);
        if (item.fluxo_id) await db.setFluxoPasso(item.phone, item.business_id, `aguardando_fluxo_${item.fluxo_id}`);
      } else await db.broadcastMarcarErro(item.id, resultado.error || "erro desconhecido");
    }
  } catch (err) {
    console.error("Erro no agendador de broadcast intercalado:", err.message);
  }
}, 20 * 1000);

// ─── AGENDADOR DE CAMPANHA DE E-MAIL (Brevo) ────────────────────────────────
// Mesmo desenho do broadcast de WhatsApp acima, só que pra emails_agendados. {{nome}} no
// assunto/corpo do template é trocado pelo nome do destinatário (ou "Cliente" se não tiver).
setInterval(async () => {
  try {
    for (let i = 0; i < 20; i++) {
      const item = await db.emailProximoDevido();
      if (!item) break;
      try {
        const template = await db.emailTemplateObter(item.template_id);
        if (!template) throw new Error("template de e-mail não existe mais");
        const nome = item.destinatario_nome || "Cliente";
        const assunto = template.assunto.replace(/\{\{nome\}\}/g, nome);
        const html = template.corpo_html.replace(/\{\{nome\}\}/g, nome);
        await enviarEmail({ to: item.destinatario_email, toNome: nome, subject: assunto, html });
        await db.emailMarcarEnviado(item.id);
      } catch (err) {
        await db.emailMarcarErro(item.id, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no agendador de campanha de e-mail:", err.message);
  }
}, 20 * 1000);

// ─── AGENDADOR DE RETORNOS (lembrete por conversa — WhatsApp e/ou e-mail) ───────────────────
// canal 'whatsapp': manda o template aprovado (mesma trava anti-reenvio de enviarUmBroadcast).
// canal 'email': usa o e-mail salvo na conversa (ver atualizarEmailConversa) — se não tiver
// e-mail salvo, marca erro em vez de falhar silenciosamente. 'ambos': tenta os dois; só marca
// erro se AMBOS falharem (mesmo critério de "sucesso parcial conta como sucesso" já usado no
// publicador da Agenda).
setInterval(async () => {
  try {
    for (let i = 0; i < 20; i++) {
      const item = await db.retornoProximoDevido();
      if (!item) break;
      const erros = [];
      let algumSucesso = false;

      if (item.canal === "whatsapp" || item.canal === "ambos") {
        const conversa = await db.getConversation(item.phone, item.business_id);
        const resultado = await enviarUmBroadcast(item.business_id, {
          phone: item.phone,
          name: conversa?.name,
          template: item.whatsapp_template,
          language: item.whatsapp_language,
          params: item.whatsapp_params ? JSON.parse(item.whatsapp_params) : undefined,
        });
        if (resultado.ok) {
          algumSucesso = true;
          // Fluxo conectado (ver "Conectar a um fluxo" no painel) — a próxima resposta do
          // contato, seja qual for, dispara esse fluxo em vez do padrão do número.
          if (item.fluxo_id) await db.setFluxoPasso(item.phone, item.business_id, `aguardando_fluxo_${item.fluxo_id}`);
        } else erros.push(`whatsapp: ${resultado.error}`);
      }

      if (item.canal === "email" || item.canal === "ambos") {
        try {
          const conversa = await db.getConversation(item.phone, item.business_id);
          if (!conversa?.email) throw new Error("conversa sem e-mail salvo");
          const template = await db.emailTemplateObter(item.email_template_id);
          if (!template) throw new Error("template de e-mail não existe mais");
          const nome = conversa.name || "Cliente";
          const assunto = template.assunto.replace(/\{\{nome\}\}/g, nome);
          const html = template.corpo_html.replace(/\{\{nome\}\}/g, nome);
          await enviarEmail({ to: conversa.email, toNome: nome, subject: assunto, html });
          algumSucesso = true;
        } catch (err) {
          erros.push(`email: ${err.message}`);
        }
      }

      if (algumSucesso) await db.retornoMarcarEnviado(item.id);
      else await db.retornoMarcarErro(item.id, erros.join("; ") || "erro desconhecido");
    }
  } catch (err) {
    console.error("Erro no agendador de retornos:", err.message);
  }
}, 20 * 1000);

// ─── VERIFICADOR DE ORIGINAÇÃO FGTS (Unnotech) ──────────────────────────────
// A cada 30s: consulta o status de cada solicitação aberta e avança a conversa quando o estado
// mudar de um jeito que importa. Todo o estado fica no banco (fgts_origination), não em
// memória — sobrevive a redeploy/reinício no meio de uma solicitação.
//
// Trava simples (booleano em memória, não claim no banco tipo broadcast_agendado) — achado na
// revisão final: sem isso, se um tick demorar mais que 30s (várias linhas, API lenta), o próximo
// tick processa as MESMAS linhas de novo e manda mensagem duplicada pro cliente ("Simulação
// pronta"/"Contrato assinado" 2x). Um único processo Render, então um booleano já resolve —
// não precisa de claim distribuído como a fila de broadcast (que também é lida por outros
// pontos de entrada, essa aqui só por esse setInterval).
let verificandoFgtsOrigination = false;
setInterval(async () => {
  if (verificandoFgtsOrigination) return;
  verificandoFgtsOrigination = true;
  try {
    const abertas = await db.fgtsOriginationListarAbertas();
    for (const row of abertas) {
      try {
        if (row.etapa === "abrindo") await processarEtapaAbrindo(row);
        else if (row.etapa === "aguardando_assinatura") await processarEtapaAguardandoAssinatura(row);
        else if (row.etapa === "aguardando_pagamento") await processarEtapaAguardandoPagamento(row);
      } catch (err) {
        console.error(`Erro ao processar originação FGTS #${row.id} (etapa ${row.etapa}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de originação FGTS:", err.message);
  } finally {
    verificandoFgtsOrigination = false;
  }
}, 30 * 1000);

// Mesmo padrão do verificador de FGTS acima — booleano local (1 processo Render, 1 setInterval
// só pra essa tabela) evita reprocessar a mesma linha se um tick demorar mais que 30s.
let verificandoCltOrigination = false;
setInterval(async () => {
  if (verificandoCltOrigination) return;
  verificandoCltOrigination = true;
  try {
    const abertas = await db.cltOriginationListarAbertas();
    for (const row of abertas) {
      try {
        if (row.etapa === "aguardando_autorizacao") await processarEtapaCltAguardandoAutorizacao(row);
        else if (row.etapa === "consultando_margem") await processarEtapaCltConsultandoMargem(row);
        else if (row.etapa === "simulando") await processarEtapaCltSimulando(row);
        else if (row.etapa === "aguardando_assinatura") await processarEtapaCltAguardandoAssinatura(row);
        else if (row.etapa === "aguardando_pagamento") await processarEtapaCltAguardandoPagamento(row);
        // 'aguardando_email', 'escolhendo_vinculo', 'apresentando_prazos', 'escolhendo_prazo',
        // 'aguardando_valor', 'oferta_apresentada', 'formulario' e 'enviando_kyc' esperam uma
        // ação do cliente (ou já foram reivindicadas por processarSubmissaoFormularioClt) — o
        // verificador não tem nada a fazer nelas, só o prazo de handlerCltOrigCapturaCpf/webhook
        // cuida de destravar.
      } catch (err) {
        console.error(`Erro ao processar originação CLT #${row.id} (etapa ${row.etapa}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de originação CLT:", err.message);
  } finally {
    verificandoCltOrigination = false;
  }
}, 30 * 1000);

// Mesmo padrão dos 2 verificadores acima — tabela própria (novosaque_origination), independente
// da Unnotech.
// Mantém propostas iniciadas no chat do site avançando mesmo depois que o cliente fecha a aba.
// As transições relevantes ficam registradas no histórico para cliente e atendente.
let verificandoSiteChatFacta = false;
setInterval(async () => {
  if (verificandoSiteChatFacta) return;
  verificandoSiteChatFacta = true;
  try {
    const propostas = await db.siteChatFactaListarEmAcompanhamento();
    for (const proposta of propostas) {
      try {
        await sincronizarSiteChatFacta(proposta);
      } catch (err) {
        console.error(`Erro ao acompanhar proposta Facta do site ${proposta.conversation_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no acompanhamento das propostas Facta do site:", err.message);
  } finally {
    verificandoSiteChatFacta = false;
  }
}, 60 * 1000);

let verificandoNsOrigination = false;
setInterval(async () => {
  if (verificandoNsOrigination) return;
  verificandoNsOrigination = true;
  try {
    const abertas = await db.novosaqueOriginationListarAbertas();
    for (const row of abertas) {
      try {
        if (row.etapa === "aguardando_autorizacao") await processarEtapaNsAguardandoAutorizacao(row);
        else if (row.etapa === "simulando") await processarEtapaNsSimulando(row);
        else if (row.etapa === "aguardando_assinatura") await processarEtapaNsAguardandoAssinatura(row);
        else if (row.etapa === "aguardando_pagamento") await processarEtapaNsAguardandoPagamento(row);
        else if (row.etapa === "abrindo") await processarEtapaNsAbrindoTravada(row);
        else if (row.etapa === "simulando_pendente") await processarEtapaNsSimulandoPendenteTravada(row);
        else if (row.etapa === "enviando_kyc") await processarEtapaNsEnviandoKycTravada(row);
        // 'oferta_apresentada', 'aguardando_valor' e 'formulario' esperam uma ação do cliente —
        // mesmo raciocínio do verificador de CLT/Unnotech acima. As 3 etapas tratadas logo
        // acima são transitórias (um handler deveria terminar de processá-las rapidinho) — só
        // entram em ação depois do prazo curto normal, como rede de segurança contra um
        // processo que reiniciou no meio (achado na revisão final).
      } catch (err) {
        console.error(`Erro ao processar originação Novo Saque #${row.id} (etapa ${row.etapa}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de originação Novo Saque:", err.message);
  } finally {
    verificandoNsOrigination = false;
  }
}, 30 * 1000);

setInterval(async () => {
  try {
    if ((await reels.configGet("pausado")) !== "0") return; // padrão: pausado até ligar no painel

    // 1) Vídeo com horário EXATO marcado, checado a cada minuto — tem prioridade sobre o
    // piloto automático, pra sair perto do horário pedido em vez de esperar o próximo
    // slot do dia. Só 1 por tick é suficiente (checagem de novo no próximo minuto).
    const agendado = await reels.publicarProximoAgendado();
    if (!agendado.vazio) {
      logPublicacaoReel("🎬 Reels publicado no horário agendado:", agendado);
      return;
    }

    // 2) Piloto automático: N por dia, espalhado entre 08:00 e 22:00 — só pega vídeo SEM
    // horário marcado (quem tem horário já foi tratado acima, no momento certo).
    const quantidadeConfigurada = Number(await reels.configGet("posts_por_dia")) || 5;
    const quantidade = Math.min(Math.max(quantidadeConfigurada, 1), 48);
    const horarios = calcularHorariosDoDia(quantidade);

    const agora = new Date();
    const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
    const horaAtual = agora.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!horarios.includes(horaAtual)) return;

    const chaveSlot = `postado_${hoje}_${horaAtual}`;
    if ((await reels.configGet(chaveSlot)) === "1") return; // já postou nesse horário hoje
    await reels.configSet(chaveSlot, "1");

    const resultado = await reels.publicarProximoPendente();
    if (resultado.vazio) console.log("🎬 Fila de Reels vazia — nada pra postar.");
    else logPublicacaoReel(`🎬 Reels publicado automaticamente (${horaAtual}):`, resultado);
  } catch (err) {
    console.error("Erro no agendador de Reels:", err.message);
  }
}, 60 * 1000);

// Limpeza do R2: apaga vídeo publicado há mais de 24h — evita acumular espaço/aproximar do
// limite do plano free (10GB). Roda a cada hora, não precisa ser mais frequente que isso.
setInterval(async () => {
  try {
    const { apagados } = await reels.limparAntigos();
    if (apagados) console.log(`🗑️ Limpeza do R2: ${apagados} vídeo(s) publicado(s) há mais de 24h apagado(s).`);
  } catch (err) {
    console.error("Erro na limpeza automática do R2:", err.message);
  }
  try {
    const { apagadas } = await agenda.limparAntigas();
    if (apagadas) console.log(`🗑️ Limpeza do R2: ${apagadas} imagem(ns) de post agendado apagada(s).`);
  } catch (err) {
    console.error("Erro na limpeza automática de posts agendados:", err.message);
  }
}, 60 * 60 * 1000);

// ─── BACKUP DIÁRIO PRA CONTA DE RESERVA (ver backup.js) ─────────────────────
// Só roda de verdade se TURSO_BACKUP_URL/TURSO_BACKUP_TOKEN estiverem configurados (2ª
// conta Turso, separada da principal) — sem isso, rodarBackup() só loga que pulou e
// retorna, sem custo nenhum. Existe pra sobreviver a um bloqueio de conta como o de
// 2026-08-22 (Turso travou a conta inteira por estourar cota de leitura): com a reserva em
// dia, dá pra trocar TURSO_DATABASE_URL/TURSO_AUTH_TOKEN pro banco de backup sem perder
// histórico de conversa. Primeira rodada 2min depois do boot (não espera 24h pro 1º backup).
// A cada deploy o Render reinicia o processo, e o backup copia o banco INTEIRO pela rede
// (gasta banda de saída — estourou os 5 GB grátis em 23/10/2026 com ~170 deploys no mês).
// Por isso grava a data do último backup no banco e só refaz se passaram 24h.
async function backupSeVencido() {
  try {
    const ultimo = Number(await db.reelsConfigGet("backup_reserva_ultimo")) || 0;
    if (Date.now() - ultimo < 23 * 60 * 60 * 1000) return;
    const r = await backup.rodarBackup();
    if (!r.pulado) await db.reelsConfigSet("backup_reserva_ultimo", String(Date.now()));
  } catch (err) {
    console.error("Erro no backup pra conta de reserva:", err.message);
  }
}
banda.iniciar(db);
setTimeout(() => {
  backupSeVencido();
  setInterval(backupSeVencido, 24 * 60 * 60 * 1000);
}, 2 * 60 * 1000);

// ─── ALERTA DE ETAPA PARADA (nota interna gerada por IA) ────────────────────────────────────
// Conversa aberta (não finalizada) com etapa de pipeline parada tempo demais ganha uma nota
// interna gerada pelo Gemini (ver gemini.js analisarEtapaParada). Nunca manda mensagem pro
// cliente, nunca muda a etapa sozinha — só grava uma nota que aparece na linha do tempo e no
// painel de detalhes do contato, pro atendente decidir o que fazer. Limiar editável por etapa
// (tela Pipeline, botão de relógio em cada coluna), guardado em `pipeline_alertas_config` (ver
// seed inicial em db.js) — etapa sem linha na tabela = alerta desativado pra ela. Carregado de
// novo a cada rodada do cron (30/30min, custo irrelevante) pra sempre refletir o que foi
// configurado por último.
// Mesmos ids/nomes de PIPELINE_ESTAGIOS em painel-web/src/lib/api.ts — mantido em sincronia na
// mão (poucos itens, muda raramente) porque o backend não importa código do frontend.
const NOME_ETAPA_PIPELINE = {
  novo_lead: "Novo lead",
  qualificacao: "Em qualificação",
  documentos: "Documentos enviados",
  analise: "Em análise",
  aprovado: "Aprovado",
  perdido: "Perdido",
};
setInterval(async () => {
  try {
    const [candidatas, limiaresConfig] = await Promise.all([db.conversasEtapaParada(), db.pipelineAlertasConfigListar()]);
    const agora = Date.now();
    for (const c of candidatas) {
      const limiarMinutos = limiaresConfig[c.pipeline_estagio];
      if (!limiarMinutos) continue;
      const minutosParada = (agora - Number(c.pipeline_estagio_desde)) / (60 * 1000);
      if (minutosParada < limiarMinutos) continue;
      const horasParada = minutosParada / 60;
      try {
        const mensagens = await db.ultimasMensagens(c.phone, c.business_number_id, 20);
        const dias = Math.round(horasParada / 24);
        const nomeEtapa = NOME_ETAPA_PIPELINE[c.pipeline_estagio] || c.pipeline_estagio;
        const { nota } = await gemini.analisarEtapaParada({ mensagens, estagioNome: nomeEtapa, dias });
        if (nota) {
          await db.notaAdicionar(c.business_number_id, c.phone, `🤖 ${nota}`);
          await db.iaFeedbackRegistrar({ businessId: c.business_number_id, phone: c.phone, tipo: "alerta_etapa_parada", evento: "mostrada" });
          // Também vira sugestão pendente na tela Retornos — antes só a nota na conversa, fácil
          // de nunca ser vista.
          await db.sugestaoRetornoCriar({ businessId: c.business_number_id, phone: c.phone, tipo: "etapa_parada", motivo: nota });
        }
        await db.marcarAlertaEtapaEnviado(c.phone, c.business_number_id);
        console.log(`🤖 Alerta de etapa parada gerado para ${c.phone} (${nomeEtapa}, ${dias}d)`);
      } catch (err) {
        // IA não configurada (sem GEMINI_API_KEY) — tenta de novo na próxima rodada, sem logar
        // erro repetido a cada 30min pra cada conversa parada enquanto isso não for resolvido.
        if (err.code === "SEM_CHAVE") break;
        console.error(`Erro ao gerar alerta de etapa parada (${c.phone}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de etapa parada:", err.message);
  }
}, 30 * 60 * 1000);

// ─── COPILOTO DE VENDAS — pré-cálculo em background ─────────────────────────────────────────
// Um cron roda a cada 90s, acha conversas com mensagem nova do cliente sem fluxo automático
// ativo (ver conversasParaPrecomputarCopiloto em db.js) e já deixa o rascunho/insight prontos em
// `conversations.copiloto_*`; o painel lê esse cache instantaneamente ao abrir a conversa.
// Reaproveita a MESMA função/prompt do endpoint sob demanda (GET .../sugestao-resposta) — não
// duplica lógica de IA nenhuma, só troca QUANDO ela roda.
//
// Guard de reentrância — sem isso, se processar o lote de candidatas demorasse mais que 90s
// (plausível com retry do Gemini em horário de pico), o PRÓXIMO disparo do setInterval
// começaria uma 2ª rodada em cima da MESMA lista de candidatas (o cache delas só grava no fim de
// cada uma, ainda não gravou) — dobrando chamada à IA à toa pro mesmo contato. Com o guard, uma
// rodada atrasada simplesmente pula a próxima vez e retoma no ciclo seguinte livre, nunca roda 2
// em paralelo. LIMIT baixo (15, ver conversasParaPrecomputarCopiloto em db.js) + esse guard
// juntos garantem que o volume de chamada à IA cresce com o RITMO de mensagem nova chegando, não
// com o TOTAL de conversas existentes no banco.
let precomputandoCopiloto = false;
setInterval(async () => {
  // Desligado por padrão (gasta cota do Gemini sem ninguém pedir): a sugestão da IA agora só sai quando o atendente
  // clica em "Analisar conversa". COPILOTO_PRECALCULO=true religa o cálculo antecipado.
  if (process.env.COPILOTO_PRECALCULO !== "true") return;
  if (precomputandoCopiloto) return;
  precomputandoCopiloto = true;
  try {
    const candidatas = await db.conversasParaPrecomputarCopiloto();
    for (const c of candidatas) {
      try {
        const [mensagens, campos, valoresAtuais, respostasProntas] = await Promise.all([
          db.ultimasMensagens(c.phone, c.business_number_id, 20),
          db.camposPersonalizadosListar(c.business_number_id),
          db.conversationCamposObter(c.business_number_id, c.phone),
          db.respostasProntasListar(),
        ]);
        const sugestao = await gemini.sugerirResposta({ mensagens, campos, valoresAtuais, respostasProntas });
        await db.copilotoCacheSalvar(c.phone, c.business_number_id, sugestao.texto, sugestao.insight, c.last_message_at);
      } catch (err) {
        // Sem GEMINI_API_KEY — tenta de novo na próxima rodada, sem logar erro repetido a cada
        // 90s pra cada conversa candidata enquanto isso não for resolvido (mesmo padrão do
        // alerta de etapa parada acima).
        if (err.code === "SEM_CHAVE") break;
        console.error(`Erro ao pré-calcular copiloto (${c.phone}):`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no pré-cálculo do copiloto de vendas:", err.message);
  } finally {
    precomputandoCopiloto = false;
  }
}, 90 * 1000);

// ─── RADAR DE CLIENTES INATIVOS ──────────────────────────────────────────────────────────────
// 1x/dia, limiar de 60 dias sem nenhuma mensagem (consignado tem ciclo de decisão mais curto que
// clínica — ajustável aqui se precisar) — gera uma sugestão de retorno tipo "reativação", sem
// precisar de IA (é só tempo parado, não tem nada pra "pensar" aqui) — mesma fila de sugestões
// pendentes do alerta de etapa parada (tela Retornos).
const LIMIAR_INATIVIDADE_DIAS = 60;
setInterval(async () => {
  try {
    const inativas = await db.conversasInativas(LIMIAR_INATIVIDADE_DIAS * 24 * 60 * 60 * 1000);
    for (const c of inativas) {
      try {
        const dias = Math.round((Date.now() - Number(c.last_message_at)) / (24 * 60 * 60 * 1000));
        await db.sugestaoRetornoCriar({
          businessId: c.business_number_id,
          phone: c.phone,
          tipo: "inatividade",
          motivo: `Sem nenhuma mensagem há ${dias} dias — pode valer reativar o contato.`,
        });
      } catch (err) {
        console.error(`Erro ao avaliar inatividade de ${c.phone}:`, err.message);
      }
    }
  } catch (err) {
    console.error("Erro no radar de clientes inativos:", err.message);
  }
}, 24 * 60 * 60 * 1000);
