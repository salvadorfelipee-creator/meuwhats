const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const busboy = require("busboy");

const db = require("./db");
const wa = require("./whatsapp");
const ig = require("./instagram");
const ads = require("./ads");
const tg = require("./telegram");
const publique = require("./publique");
const reels = require("./reels");
const agenda = require("./agenda");
const { notificarLeadCotaCerta } = require("./email");

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
      "Para fazer a simulação do saque do FGTS, é necessário autorizar o banco BMS lá no aplicativo " +
      "do FGTS. Depois de autorizar, é só me informar o seu CPF que a gente já parte pro atendimento. 😊",
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
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

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

// Igual a salvarImagemPublicar, mas devolve o buffer decodificado em vez de gravar em disco —
// usado pela agenda de publicações, que guarda a imagem no R2 (precisa sobreviver a um
// deploy/restart do Render, diferente da publicação imediata que só precisa durar segundos).
function decodificarImagemBase64(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Formato de imagem inválido");
  const ext = EXT_BY_MIME[match[1]] || "jpg";
  return { buffer: Buffer.from(match[2], "base64"), contentType: match[1], nomeArquivo: `imagem.${ext}` };
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

// Entrada padrão desde 12/08/2026 — foco do dia é Consignado CLT. Fora do horário
// comercial manda um aviso pra reativar depois, em vez do menu (ninguém aqui pra rodar a
// simulação de crédito de verdade fora desse horário — ver horarioComercialCotaCerta mais
// abaixo, mesma janela usada pela Cota Certa, mesma equipe). Pra reativar a triagem de
// gerente, troca essa função pelo conteúdo de menuInicialGerenteArquivado() (logo acima).
// `foraDeHorario: true` avisa quem chama que essa NÃO foi a mensagem real do menu — é só o
// aviso de horário. Sem essa distinção, quem manda mensagem fora do expediente era marcado no
// passo "menu_inicial" do mesmo jeito de quem recebeu o menu de verdade, e uns minutos depois
// levava um lembrete dizendo "responda com o número da opção que te mandei ali em cima" — só
// que a opção nunca foi mandada, só o aviso de horário. Bug real, reportado pelo usuário
// (13/08/2026): cliente mandou mensagem fora do horário, recebeu só o aviso, e mesmo assim
// levou a cobrança "parou no meio do atendimento" mais tarde.
function menuInicial() {
  if (!horarioComercialCotaCerta()) {
    return {
      texto:
        "Olá! 😊 Aqui é o Felipe, da Felizcred. No momento estamos fora do horário comercial " +
        "(atendemos de segunda a sexta das 9h às 18h, e aos sábados até o meio-dia).\n\n" +
        "Por favor, envie sua mensagem dentro do horário comercial pra reativar a conversa que a gente já te atende! 😊",
      foraDeHorario: true,
    };
  }
  return { texto: TEXTO_MENU_PRINCIPAL };
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
    logFunil(businessNumberId, de, "clt_menu_escolhido");
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Para simular o consignado CLT, precisa ter no mínimo 3 meses de carteira assinada no seu trabalho atual.",
      [
        { id: "clt_3mais", title: "3 MESES OU MAIS" },
        { id: "clt_menos3", title: "MENOS DE 3 MESES" },
      ]
    );
    await db.setFluxoPasso(de, businessNumberId, "clt_pergunta_tempo");
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
    // Mesmo texto/fluxo já usado no Instagram (autorizar o BMS, depois mandar o CPF) —
    // consistência entre os dois canais, ver INSTAGRAM_OPCOES_MENU.
    await enviarRespostaAutomatica(
      businessNumberId,
      de,
      "Para fazer a simulação do saque do FGTS, é necessário autorizar o banco BMS lá no aplicativo " +
        "do FGTS. Depois de autorizar, é só me mandar o seu CPF que a gente já parte pro atendimento. 😊"
    );
    await db.setFluxoPasso(de, businessNumberId, "fgts_cpf");
  }
  // Não reconheceu a opção → fica no passo menu_inicial (mantém o lembrete sutil ativo)
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
  campanha_clt_dados: [15, 240],
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
  // abordagem — em vez de repetir o pedido, reduz o atrito (5 campos de uma vez assusta,
  // deixa claro que dá pra mandar aos poucos). Nunca insiste 2x com o mesmo texto —
  // atendimento repetitivo é o padrão "agressivo" que queremos evitar.
  clt_3mais: [
    "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso desses dados 😊\n" +
      "Nome completo, CPF, telefone, e-mail e data de nascimento — pode mandar tudo numa mensagem só.",
    "Sem compromisso nenhum, é só pra simular 😊 Se preferir, pode começar só com nome e CPF que eu já " +
      "adianto — o resto (telefone, e-mail, data de nascimento) você me manda depois, sem pressa.",
  ],
  carro_garantia_dados:
    "Olá! Só lembrando que pra eu simular seu empréstimo com carro em garantia, preciso desses dados 😊\n" +
    "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
  financiamento_dados:
    "Olá! Só lembrando que pra eu simular o financiamento do seu veículo, preciso desses dados 😊\n" +
    "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
  fgts_cpf:
    "Olá! Só lembrando que pra eu simular o saque do FGTS, preciso do seu CPF 😊 (depois de você já ter " +
    "autorizado o banco BMS lá no aplicativo do FGTS).",
  campanha_clt_dados: [
    "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso desses dados 😊\n" +
      "Nome completo, CPF, telefone, e-mail e data de nascimento — pode mandar tudo numa mensagem só.",
    "Sem compromisso nenhum, é só pra simular 😊 Se preferir, pode começar só com nome e CPF que eu já " +
      "adianto — o resto (telefone, e-mail, data de nascimento) você me manda depois, sem pressa.",
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
  // Funil de Consignado CLT (12/08/2026) — resposta da qualificação de tempo de carteira
  // assinada, enviada por handlerMenuPrincipal (opção 1). clt_3mais segue pra captura de
  // dados (handlerCapturaDadosClt); clt_menos3 é terminal, sem mais nada esperado da pessoa.
  clt_3mais: {
    texto:
      "Show! 😊 Pra simular preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só:\n" +
      "• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento",
  },
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

// Confirmação de dados recebidos + aviso de horário — reaproveitada pelos 3 funis que pedem
// dados e entregam pro atendimento humano (CLT, carro em garantia, financiamento).
async function confirmarDadosRecebidos(de, businessNumberId) {
  await enviarRespostaAutomatica(
    businessNumberId,
    de,
    "Perfeito! ✅ Já anotei tudo, agora é só aguardar atendimento — em breve eu, Felipe, vou te responder " +
      "por aqui pra fazer sua simulação. 🙌" +
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
  if (!REGEX_CPF.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "clt_3mais"); // reafirma o passo, reseta o lembrete
    return;
  }
  logFunil(businessNumberId, de, "clt_dados_completos");
  await confirmarDadosRecebidos(de, businessNumberId);
}

// Mesmo padrão do handlerCapturaDadosClt acima, mas passo próprio (campanha_clt_dados) pra
// quem respondeu à campanha do template oferta_consignado_clt — não reaproveita "clt_3mais"
// de propósito, senão essa conversa ficaria indistinguível de quem entrou pelo menu normal
// (mesmo passo, mesmo lembrete), o que ia contra o pedido de manter a campanha fora do fluxo
// já cadastrado do menu principal.
async function handlerCapturaDadosCampanhaClt(de, businessNumberId, corpo) {
  if (!REGEX_CPF.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "campanha_clt_dados");
    return;
  }
  logFunil(businessNumberId, de, "campanha_dados_completos");
  await confirmarDadosRecebidos(de, businessNumberId);
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
  await confirmarDadosRecebidos(de, businessNumberId);
}

async function handlerCapturaDadosFinanciamento(de, businessNumberId, corpo) {
  if (!REGEX_EMAIL.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "financiamento_dados");
    return;
  }
  await confirmarDadosRecebidos(de, businessNumberId);
}

// Mesmo padrão do CLT/garantia/financiamento: só confirma quando reconhece um CPF de
// verdade na mensagem — qualquer outra coisa só reseta o relógio do lembrete, sem confirmar
// nada errado (mesmo cuidado do handlerCapturaDadosClt, ver comentário lá em cima).
async function handlerCapturaDadosFgts(de, businessNumberId, corpo) {
  if (!REGEX_CPF.test(corpo || "")) {
    await db.setFluxoPasso(de, businessNumberId, "fgts_cpf");
    return;
  }
  await confirmarDadosRecebidos(de, businessNumberId);
}

// ─── FLUXO COTA CERTA SEGUROS (número "felizcred n") ────────────────────────
// Número dedicado à Cota Certa Seguros. Duas entradas possíveis:
//  1) Cliente preencheu o formulário do site (felizcred.com.br/cotacerta) e a
//     mensagem já chega pronta ("Olá! Quero cotar..." / "...receber uma
//     ligação...") — nesse caso só confirmamos o recebimento, sem menu.
//  2) Cliente manda mensagem direto pro número — recebe o menu com os tipos
//     de seguro; só o Auto tem um fluxo de perguntas (é o produto principal).
const COTACERTA_NUMBER_ID = "518007084723311";

const REGEX_SITE_COTACAO = /^Ol[áa]!\s*Quero cotar/i;
const REGEX_SITE_CALLBACK = /^Ol[áa]!\s*Quero receber uma liga[çc][ãa]o/i;

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
  capturaTexto: {
    gerente_autorizo: handlerConfirmacaoAgenda,
    menu_inicial: handlerMenuPrincipal,
    clt_3mais: handlerCapturaDadosClt,
    carro_garantia_dados: handlerCapturaDadosCarroGarantia,
    financiamento_dados: handlerCapturaDadosFinanciamento,
    fgts_cpf: handlerCapturaDadosFgts,
    campanha_clt_dados: handlerCapturaDadosCampanhaClt,
  },
};

const FLUXO_COTACERTA = {
  menuInicial: menuInicialCotaCerta,
  fluxoBotoes: FLUXO_BOTOES_COTACERTA,
  lembreteMinutos: LEMBRETE_MINUTOS_COTACERTA,
  lembreteTextos: LEMBRETE_TEXTOS_COTACERTA,
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

const FLUXOS_POR_NUMERO = {
  [COTACERTA_NUMBER_ID]: FLUXO_COTACERTA,
};

function getFluxo(businessNumberId) {
  return FLUXOS_POR_NUMERO[businessNumberId] || FLUXO_FELIZCRED;
}

// ─── PROCESSAR MENSAGENS RECEBIDAS ───────────────────────────────────────────
async function processarEntry(entry) {
  for (const e of entry) {
    for (const change of e.changes || []) {
      const value = change.value || {};
      const contatos = value.contacts || [];
      const mensagens = value.messages || [];
      const businessNumberId = value.metadata?.phone_number_id;

      const fluxo = getFluxo(businessNumberId);

      for (const msg of mensagens) {
        const de = msg.from;
        const tipo = msg.type;
        const nome = contatos.find((c) => c.wa_id === de)?.profile?.name;
        const quando = Number(msg.timestamp) * 1000 || Date.now();

        // Marca como lida no WhatsApp do cliente (dois tiques azuis) — não bloqueia o
        // processamento da mensagem se a chamada falhar.
        wa.markAsRead(businessNumberId, msg.id).catch((err) =>
          console.error("Falha ao marcar mensagem como lida:", err.message)
        );

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

        let mensagemJaTratada = false;

        if (tipo === "text") {
          await db.insertMessage({ ...base, type: "text", body: msg.text?.body });
          const corpo = msg.text?.body || "";
          // Palavra-chave "menu" reabre o menu inicial do fluxo a qualquer momento,
          // não importa em que passo a conversa está.
          if (normalizarTexto(corpo) === "menu") {
            try {
              const menu = fluxo.menuInicial();
              await enviarRespostaAutomatica(businessNumberId, de, menu.texto, menu.botoes, menu.lista);
              // Fora do horário: só o aviso foi mandado, não o menu de verdade — não marca
              // "menu_inicial" (senão o lembrete cobra uma opção que nunca foi oferecida).
              await db.setFluxoPasso(de, businessNumberId, menu.foraDeHorario ? null : "menu_inicial");
              mensagemJaTratada = true;
            } catch (err) {
              console.error("Erro ao reabrir menu inicial:", err.message);
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
        } else if (tipo === "interactive") {
          // Clique em um botão do fluxo automático (mensagens interativas)
          const reply = msg.interactive?.button_reply || msg.interactive?.list_reply || {};
          await db.insertMessage({ ...base, type: "button", body: reply.title || "[botão]" });
          const passo = fluxo.fluxoBotoes[reply.id];
          if (passo) {
            try {
              if (reply.id === "clt_3mais") logFunil(businessNumberId, de, "clt_qualificado");
              const textoPasso = typeof passo.texto === "function" ? passo.texto() : passo.texto;
              await enviarRespostaAutomatica(businessNumberId, de, textoPasso, passo.botoes, passo.lista);
              // Marca (ou limpa) o passo em que a conversa fica aguardando resposta
              await db.setFluxoPasso(de, businessNumberId, fluxo.lembreteMinutos[reply.id] ? reply.id : null);
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
        if (!mensagemJaTratada && conversaInativa && TIPOS_COM_MENU.includes(tipo)) {
          try {
            const podeEnviar = await db.tentarMarcarMenuEnviado(
              de,
              businessNumberId,
              HORAS_INATIVIDADE_MENU * 60 * 60 * 1000
            );
            if (podeEnviar) {
              const menu = fluxo.menuInicial();
              await enviarRespostaAutomatica(businessNumberId, de, menu.texto, menu.botoes, menu.lista);
              // Mesma correção do reabrir-por-"menu" acima: fora do horário não conta como
              // "está no passo do menu", senão o lembrete cobra uma opção nunca oferecida.
              await db.setFluxoPasso(de, businessNumberId, menu.foraDeHorario ? null : "menu_inicial");
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

    // GET /painel/api/numbers — lista de números configurados
    if (req.method === "GET" && path_ === "/painel/api/numbers") {
      if (!requireAuth(req, res)) return;
      return send(res, 200, PHONE_NUMBERS);
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

    // POST /painel/api/conversations/:businessId/:phone/reply — responder uma conversa.
    // Aceita texto puro OU imagemBase64 (com ou sem legenda em `text`) — mesmo mecanismo de
    // upload/URL pública do Publique IV (salvarImagemPublicar + /publicar-media/).
    const matchReply = path_.match(/^\/painel\/api\/conversations\/([^/]+)\/([^/]+)\/reply$/);
    if (req.method === "POST" && matchReply) {
      if (!requireAuth(req, res)) return;
      const businessId = decodeURIComponent(matchReply[1]);
      const phone = decodeURIComponent(matchReply[2]);
      const body = await parseBody(req);
      const texto = (body.text || "").trim();
      if (!texto && !body.imagemBase64) return send(res, 400, { error: "Mensagem vazia" });

      if (businessId === "instagram") {
        if (body.imagemBase64) {
          return send(res, 400, { error: "Envio de imagem pelo Instagram ainda não é suportado — responda por texto." });
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
      if (body.imagemBase64) {
        try {
          const filename = salvarImagemPublicar(body.imagemBase64);
          imagemUrl = `https://${req.headers.host}/publicar-media/${filename}`;
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      }

      let result;
      try {
        result = imagemUrl
          ? await wa.sendImage(businessId, phone, imagemUrl, texto || undefined)
          : await wa.sendText(businessId, phone, texto);
      } catch (err) {
        return send(res, 502, { error: `Falha ao enviar pelo WhatsApp: ${err.message}` });
      }
      const waId = result.messages?.[0]?.id || null;
      const now = Date.now();
      await db.upsertConversation(phone, businessId, null, now);
      // Atendente humano assumiu — cancela lembrete automático pendente
      await db.setFluxoPasso(phone, businessId, null);
      await db.insertMessage({
        phone,
        business_number_id: businessId,
        direction: "out",
        type: imagemUrl ? "image" : "text",
        body: texto || null,
        media_path: imagemUrl,
        wa_message_id: waId,
        status: "sent",
        created_at: now,
      });
      return send(res, 200, { ok: true });
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
      return send(res, 200, {
        dias,
        etapas: {
          clt_menu_escolhido: resumo.clt_menu_escolhido || 0,
          clt_qualificado: resumo.clt_qualificado || 0,
          clt_dados_completos: resumo.clt_dados_completos || 0,
          campanha_clique: resumo.campanha_clique || 0,
          campanha_dados_completos: resumo.campanha_dados_completos || 0,
        },
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
    if (req.method === "GET" && matchPublicarMedia) {
      const filePath = path.join(PUBLICAR_MEDIA_DIR, matchPublicarMedia[1]);
      if (!filePath.startsWith(PUBLICAR_MEDIA_DIR) || !fs.existsSync(filePath)) {
        return send(res, 404, "Not found");
      }
      return send(res, 200, fs.readFileSync(filePath));
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

    // GET /painel/api/agenda/lista — histórico (pendentes + publicados + com erro)
    if (req.method === "GET" && path_ === "/painel/api/agenda/lista") {
      if (!requireAuth(req, res)) return;
      const [resumo, recentes] = await Promise.all([agenda.resumo(), agenda.listarRecentes(50)]);
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
      const fluxoDoContato = getFluxo(p.business_number_id);
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
        const textosConfig = fluxoDoContato.lembreteTextos[p.fluxo_passo];
        const textosArray = Array.isArray(textosConfig) ? textosConfig : [textosConfig || fluxoDoContato.lembreteTextos.padrao];
        const texto = textosArray[indice] || textosArray[textosArray.length - 1];
        await enviarRespostaAutomatica(p.business_number_id, p.phone, texto);
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
      try {
        const fluxoDoContato = getFluxo(p.business_number_id);
        const manterJanela = fluxoDoContato.lembreteTextos.manter_janela || LEMBRETE_TEXTOS_COTACERTA.manter_janela;
        const texto = typeof manterJanela === "function" ? manterJanela() : manterJanela;
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
