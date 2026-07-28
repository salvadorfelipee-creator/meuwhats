const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const db = require("./db");
const wa = require("./whatsapp");
const ig = require("./instagram");
const ads = require("./ads");
const tg = require("./telegram");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "meu_token_secreto";
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "meu_token_secreto_instagram";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const PAINEL_USER = process.env.PAINEL_USER || "admin";
const PAINEL_PASS = process.env.PAINEL_PASS || "admin";

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

// Opções do menu do Instagram → produto e palavras-chave aceitas na resposta do cliente
// (número da opção sempre aceito; palavras são comparadas sem acento/maiúscula).
const INSTAGRAM_OPCOES_MENU = [
  { produto: "Seguro de veículo", chaves: ["1", "seguro"] },
  { produto: "Consignado CLT", chaves: ["2", "clt", "consignado"] },
  { produto: "Saque do FGTS", chaves: ["3", "fgts", "saque"] },
  { produto: "Empréstimo com carro em garantia", chaves: ["4", "garantia"] },
  { produto: "Financiamento de veículo", chaves: ["5", "financiamento"] },
];

const REGEX_ACENTOS = new RegExp("[̀-ͯ]", "g");

function normalizarTexto(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(REGEX_ACENTOS, "")
    .toLowerCase()
    .trim();
}

function detectarOpcaoMenuInstagram(texto) {
  const t = normalizarTexto(texto);
  if (!t) return null;
  for (const opcao of INSTAGRAM_OPCOES_MENU) {
    for (const chave of opcao.chaves) {
      if (chave.length === 1 ? t === chave : t.includes(chave)) return opcao;
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

const MEDIA_DIR = path.join(__dirname, "media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/amr": "amr",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
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

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, headers);
    return res.end(body);
  }
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}

function isAuthorized(req) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  const [user, pass] = Buffer.from(encoded, "base64").toString("utf8").split(":");
  return user === PAINEL_USER && pass === PAINEL_PASS;
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="painel"' });
  res.end("Authorization required");
  return false;
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

// Respostas automáticas para os botões de resposta rápida do template aviso_taxa_clt
const RESPOSTAS_BOTAO = {
  "quero saber mais":
    "Para simular o consignado CLT precisamos de alguns dados para gerar a autorização, após enviar é só aguardar que um atendente irá vir te atender. Enquanto aguarda, visite nosso site www.felizcred.com.br",
  "nao quero receber mais":
    "Não iremos mais enviar mensagem e fique à vontade para nos chamar quando precisar!",
};

async function enviarRespostaAutomatica(businessNumberId, phone, texto, botoes, lista) {
  const result = lista
    ? await wa.sendList(businessNumberId, phone, texto, lista.botao, lista.opcoes)
    : botoes
    ? await wa.sendButtons(businessNumberId, phone, texto, botoes)
    : await wa.sendText(businessNumberId, phone, texto);
  const waId = result.messages?.[0]?.id || null;
  const now = Date.now();
  // No histórico do painel, botões/opções aparecem listados abaixo do texto
  const opcoes = lista ? lista.opcoes : botoes;
  const bodySalvo = opcoes ? `${texto}\n\n${opcoes.map((b) => `🔘 ${b.title}`).join("\n")}` : texto;
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

// ─── FLUXO DE MENSAGENS AUTOMÁTICAS COM BOTÕES ───────────────────────────────
// Menu inicial enviado quando um contato manda mensagem e a conversa está
// inativa há mais de 24h (ou é a primeira mensagem dele). Cada botão leva ao
// próximo passo do fluxo, identificado pelo id do botão clicado.
const HORAS_INATIVIDADE_MENU = 24;

function saudacaoDoDia() {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date())
  );
  if (hora >= 5 && hora < 12) return "bom dia";
  if (hora >= 12 && hora < 18) return "boa tarde";
  return "boa noite";
}

function menuInicial() {
  // Desde 11/07/2026 a primeira mensagem é direto a triagem do anúncio de gerente
  // (decisão do usuário: vale para todo contato novo, não só quem vem do anúncio).
  // O menu antigo (ANÚNCIO GERENTE / CONSIGNADO CLT) foi desativado, mas os passos
  // fluxo_gerente/fluxo_clt continuam no FLUXO_BOTOES para quem clicar em botões antigos.
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
// Minutos de silêncio até mandar UM lembrete, por passo. Quem clicou
// NUNCA TRABALHEI (gerente_nunca) fica de fora de propósito — decisão do usuário.
const LEMBRETE_MINUTOS = {
  menu_inicial: 15,
  fluxo_gerente: 15,
  gerente_trabalhou: 15,
  gerente_menos2: 15,
  gerente_mais2: 15,
  gerente_autorizo: 20,
};

const LEMBRETE_TEXTOS = {
  gerente_autorizo:
    "Olá! Para entrar na agenda de atendimento do escritório parceiro, preciso do seu nome e da sua " +
    "cidade — é só responder aqui 😊",
  padrao:
    "Olá! Vi que você parou no meio do atendimento. Para continuar, é só tocar em uma das opções da " +
    "mensagem acima 👆",
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
  prod_clt: { texto: PRODUTO_CONFIRMACAO("o EMPRÉSTIMO CONSIGNADO CLT") },
  prod_inss: { texto: PRODUTO_CONFIRMACAO("o EMPRÉSTIMO CONSIGNADO INSS") },
  prod_fgts: { texto: PRODUTO_CONFIRMACAO("o SAQUE-ANIVERSÁRIO FGTS") },
  prod_carro: { texto: PRODUTO_CONFIRMACAO("o EMPRÉSTIMO COM CARRO EM GARANTIA") },
  prod_seguro: { texto: PRODUTO_CONFIRMACAO("o SEGURO VEICULAR") },
  // Resposta provisória — o fluxo completo do consignado CLT ainda vai ser definido
  fluxo_clt: {
    texto:
      "Perfeito! Para simular o consignado CLT, é só aguardar um instante que um atendente vai falar com você.\n\n" +
      "Enquanto isso, você pode conhecer nosso site: www.felizcred.com.br",
  },
};

// ─── PROCESSAR MENSAGENS RECEBIDAS ───────────────────────────────────────────
async function processarEntry(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      const contatos = value.contacts || [];
      const mensagens = value.messages || [];
      const businessNumberId = value.metadata?.phone_number_id;

      for (const msg of mensagens) {
        const de = msg.from;
        const tipo = msg.type;
        const nome = contatos.find((c) => c.wa_id === de)?.profile?.name;
        const quando = Number(msg.timestamp) * 1000 || Date.now();

        const conversaAnterior = await db.getConversation(de, businessNumberId);
        const conversaInativa =
          !conversaAnterior ||
          quando - Number(conversaAnterior.last_message_at || 0) > HORAS_INATIVIDADE_MENU * 60 * 60 * 1000;

        await db.upsertConversation(de, businessNumberId, nome, quando);

        const base = {
          phone: de,
          business_number_id: businessNumberId,
          direction: "in",
          wa_message_id: msg.id,
          created_at: quando,
          status: "received",
        };

        if (tipo === "text") {
          await db.insertMessage({ ...base, type: "text", body: msg.text?.body });
          // Se a conversa estava aguardando nome/cidade, confirma e agenda
          if (conversaAnterior?.fluxo_passo === "gerente_autorizo") {
            try {
              await enviarRespostaAutomatica(businessNumberId, de, confirmacaoAgenda());
              await db.setFluxoPasso(de, businessNumberId, null);
            } catch (err) {
              console.error("Erro ao confirmar agenda:", err.message);
            }
          }
        } else if (tipo === "button") {
          const textoBotao = msg.button?.text || msg.button?.payload || "";
          await db.insertMessage({ ...base, type: "button", body: textoBotao });
          const resposta = RESPOSTAS_BOTAO[normalizar(textoBotao)];
          if (resposta) {
            try {
              await enviarRespostaAutomatica(businessNumberId, de, resposta);
            } catch (err) {
              console.error("Erro ao enviar resposta automática:", err.message);
            }
          }
        } else if (tipo === "interactive") {
          // Clique em um botão do fluxo automático (mensagens interativas)
          const reply = msg.interactive?.button_reply || msg.interactive?.list_reply || {};
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[botão]" });
          const passo = FLUXO_BOTOES[reply.id];
          if (passo) {
            try {
              await enviarRespostaAutomatica(businessNumberId, de, passo.texto, passo.botoes, passo.lista);
              // Marca (ou limpa) o passo em que a conversa fica aguardando resposta
              await db.setFluxoPasso(de, businessNumberId, LEMBRETE_MINUTOS[reply.id] ? reply.id : null);
            } catch (err) {
              console.error("Erro ao enviar passo do fluxo de botões:", err.message);
            }
          }
        } else if (tipo === "image" || tipo === "audio" || tipo === "video" || tipo === "document") {
          const media = msg[tipo];
          try {
            const { buffer, mimeType } = await wa.downloadMedia(media.id);
            const ext = EXT_BY_MIME[mimeType] || "bin";
            const filename = safeFilename(msg.id, ext);
            fs.writeFileSync(path.join(MEDIA_DIR, filename), buffer);
            await db.insertMessage({
              ...base,
              type: tipo,
              body: media.caption || null,
              media_path: `/media/${filename}`,
              media_mime: mimeType,
            });
          } catch (err) {
            console.error("Erro ao baixar mídia:", err.message);
            await db.insertMessage({ ...base, type: tipo, body: "[mídia indisponível]" });
          }
        } else {
          await db.insertMessage({ ...base, type: tipo, body: `[mensagem do tipo ${tipo}]` });
        }

        // Menu inicial automático: conversa nova ou parada há mais de 24h, no máximo
        // 1x a cada 24h por contato (marcação atômica no banco — mensagens em rajada
        // ou processadas em paralelo não duplicam o menu).
        // Cliques em botão não contam (continuação do fluxo), nem "unsupported"/"reaction"
        // (costumam vir de números de sistema que não aceitam resposta).
        const TIPOS_COM_MENU = ["text", "image", "audio", "video", "document", "sticker"];
        if (conversaInativa && TIPOS_COM_MENU.includes(tipo)) {
          try {
            const podeEnviar = await db.tentarMarcarMenuEnviado(
              de,
              businessNumberId,
              HORAS_INATIVIDADE_MENU * 60 * 60 * 1000
            );
            if (podeEnviar) {
              const menu = menuInicial();
              await enviarRespostaAutomatica(businessNumberId, de, menu.texto, menu.botoes);
              await db.setFluxoPasso(de, businessNumberId, "menu_inicial");
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
        console.log(
          `✅ Status: ${status.status} — para ${status.recipient_id}` + (erroTexto ? ` (motivo: ${erroTexto})` : "")
        );
      }
    }
  }
}

// ─── PROCESSAR EVENTOS DO INSTAGRAM ──────────────────────────────────────────
async function handleInstagramComment(value) {
  const userId = value.from?.id;
  if (!userId) return;
  try {
    await ig.sendDM(userId, INSTAGRAM_COMMENT_REPLY);
    console.log(`📸 Comentário de ${value.from?.username || userId} → DM enviada`);
  } catch (err) {
    console.error("Erro ao responder comentário do Instagram:", err.message);
  }
}

async function handleInstagramMessaging(messaging) {
  const senderId = messaging.sender?.id;
  if (!senderId) return;

  const opcao = detectarOpcaoMenuInstagram(messaging.message?.text);
  if (opcao) {
    try {
      await ig.sendDM(
        senderId,
        `Perfeito! ✅ Clica no link pra continuar no WhatsApp sobre ${opcao.produto}:\n${linkWhatsAppInstagram(opcao.produto)}`
      );
      console.log(`📸 ${senderId} escolheu "${opcao.produto}" → link do WhatsApp enviado`);
    } catch (err) {
      console.error("Erro ao enviar link do WhatsApp (menu Instagram):", err.message);
    }
    return;
  }

  const isStoryReply = !!messaging.message?.reply_to?.story;
  if (isStoryReply) {
    try {
      await ig.sendDM(senderId, INSTAGRAM_WELCOME_MESSAGE);
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
    await ig.sendDM(senderId, INSTAGRAM_WELCOME_MESSAGE);
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

    // GET /painel — página do painel
    if (req.method === "GET" && path_ === "/painel") {
      if (!requireAuth(req, res)) return;
      const html = fs.readFileSync(path.join(__dirname, "public", "painel.html"));
      return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
    }

    // GET /painel/api/numbers — lista de números configurados
    if (req.method === "GET" && path_ === "/painel/api/numbers") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, PHONE_NUMBERS);
    }

    // GET /painel/api/conversations/:businessId — lista de conversas de um número
    const matchConversations = path_.match(/^\/painel\/api\/conversations\/([^/]+)$/);
    if (req.method === "GET" && matchConversations) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchConversations[1]);
      return send(res, 200, await db.listConversations(businessId));
    }

    // GET /painel/api/conversations/:businessId/:phone/messages — mensagens de uma conversa
    const matchMessages = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/messages$/);
    if (req.method === "GET" && matchMessages) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchMessages[1]);
      const phone = decodeURIComponent(matchMessages[2]);
      return send(res, 200, await db.listMessages(phone, businessId));
    }

    // POST /painel/api/conversations/:businessId/:phone/reply — responder uma conversa
    const matchReply = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/reply$/);
    if (req.method === "POST" && matchReply) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchReply[1]);
      const phone = decodeURIComponent(matchReply[2]);
      const body = await parseBody(req);
      if (!body.text || !body.text.trim()) return send(res, 400, { error: "Texto vazio" });

      const result = await wa.sendText(businessId, phone, body.text);
      const waId = result.messages?.[0]?.id || null;
      const now = Date.now();
      await db.upsertConversation(phone, businessId, null, now);
      // Atendente humano assumiu — cancela lembrete automático pendente
      await db.setFluxoPasso(phone, businessId, null);
      await db.insertMessage({
        phone,
        business_number_id: businessId,
        direction: "out",
        type: "text",
        body: body.text,
        wa_message_id: waId,
        status: "sent",
        created_at: now,
      });
      return send(res, 200, { ok: true });
    }

    // POST /painel/api/broadcast/:businessId — envio em massa via template
    const matchBroadcast = path_.match(/^\/painel\/api\/broadcast\/([^/]+)$/);
    if (req.method === "POST" && matchBroadcast) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchBroadcast[1]);
      const body = await parseBody(req);
      const { template, language, contacts, bodyPreview } = body;
      if (!template || !Array.isArray(contacts) || !contacts.length) {
        return send(res, 400, { error: "Informe o template e ao menos um contato" });
      }

      const resultados = [];
      for (const contato of contacts) {
        const phone = (contato.phone || "").replace(/\D/g, "");
        const nome = (contato.name || "").trim();
        if (!phone) {
          resultados.push({ phone: contato.phone || "", ok: false, error: "telefone inválido" });
          continue;
        }
        try {
          const components = nome
            ? [{ type: "body", parameters: [{ type: "text", text: nome }] }]
            : undefined;
          const result = await wa.sendTemplate(businessId, phone, template, language || "pt_BR", components);
          const waId = result.messages?.[0]?.id || null;
          const now = Date.now();
          const texto = bodyPreview
            ? bodyPreview.replace(/\{\{1\}\}/g, nome || "Cliente")
            : `[template] ${template}`;
          await db.upsertConversation(phone, businessId, nome || null, now);
          await db.insertMessage({
            phone,
            business_number_id: businessId,
            direction: "out",
            type: "template",
            body: texto,
            wa_message_id: waId,
            status: "sent",
            created_at: now,
          });
          resultados.push({ phone, ok: true });
        } catch (err) {
          resultados.push({ phone, ok: false, error: err.message });
        }
        await new Promise((r) => setTimeout(r, 350));
      }
      return send(res, 200, { resultados });
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

    // POST /painel/api/instagram/reset-boasvindas — limpa quem já recebeu boas-vindas (uso em testes)
    if (req.method === "POST" && path_ === "/painel/api/instagram/reset-boasvindas") {
      if (!requireAuth(req, res)) return;
      const removidos = await db.instagramLimparSaudados();
      return send(res, 200, { ok: true, removidos });
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

    // GET /media/:filename — servir arquivo de mídia
    const matchMedia = path_.match(/^\/media\/([a-zA-Z0-9_.-]+)$/);
    if (req.method === "GET" && matchMedia) {
      if (!requireAuth(req, res)) return;
      const filePath = path.join(MEDIA_DIR, matchMedia[1]);
      if (!filePath.startsWith(MEDIA_DIR) || !fs.existsSync(filePath)) {
        return send(res, 404, "Not found");
      }
      return send(res, 200, fs.readFileSync(filePath));
    }

    // Health check
    if (req.method === "GET" && path_ === "/") {
      return send(res, 200, { status: "ok", message: "WhatsApp Webhook rodando" });
    }

    send(res, 404, "Not found");
  } catch (err) {
    console.error("Erro no request:", err);
    send(res, 500, { error: "Erro interno" });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
  console.log(`   Webhook URL: https://SEU_DOMINIO/webhook`);
  console.log(`   Painel:      https://SEU_DOMINIO/painel`);
  console.log("─".repeat(50));
});

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
      const minutos = LEMBRETE_MINUTOS[p.fluxo_passo];
      if (!minutos || agora - Number(p.fluxo_passo_at) < minutos * 60 * 1000) continue;
      if (!(await db.tentarMarcarLembreteEnviado(p.phone, p.business_number_id))) continue;
      try {
        const texto = LEMBRETE_TEXTOS[p.fluxo_passo] || LEMBRETE_TEXTOS.padrao;
        await enviarRespostaAutomatica(p.business_number_id, p.phone, texto);
        console.log(`⏰ Lembrete de fluxo parado enviado para ${p.phone} (passo ${p.fluxo_passo})`);
      } catch (err) {
        console.error("Erro ao enviar lembrete de fluxo:", err.message);
      }
    }
  } catch (err) {
    console.error("Erro no verificador de fluxos parados:", err.message);
  }
}, 60 * 1000);
