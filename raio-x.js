// Raio-X da clínica (https://nexussite-br.vercel.app/raio-x/): a página envia as respostas quando a pessoa toca no
// botão do WhatsApp; ao chegar a mensagem com o código, o painel grava uma nota amarela na conversa que só a equipe vê.
const NUMERO_NEXUS = "1512976205221650";
const ORIGEM = "https://nexussite-br.vercel.app";
const REGEX_CODIGO = /\bRX-[A-Z2-9]{6}\b/i;
// fluxo_passo de quem veio do formulário: sem menu da campanha nem lembrete, mesmo se voltar a escrever depois de 24 h.
const PASSO = "raiox_atendimento";

/** Única mensagem automática para quem veio do formulário (texto livre, dentro da janela de 24 h: sem custo de template). */
function saudacao(nome) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0];
  const chamado = /^\p{L}{2,20}$/u.test(primeiro) ? `, ${primeiro}` : "";
  return `Oi${chamado}! 👋 Recebemos o seu Raio-X por aqui. Vamos olhar as suas respostas e já te mandamos a análise completa e as outras 36 mensagens.`;
}

const texto = (v, max = 80) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const nota100 = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

// A rota é pública: limite próprio (não divide cota com o chat do site) e um teto geral por hora, porque o IP do
// cabeçalho pode ser falsificado e cada envio aceito é uma escrita no Turso.
const CORPO_MAX = 6000;
const envios = new Map();
let hora = { inicio: 0, total: 0 };
function permitir(ip, agora = Date.now()) {
  if (agora - hora.inicio >= 3600_000) { hora = { inicio: agora, total: 0 }; envios.clear(); }
  const recentes = (envios.get(ip) || []).filter((t) => agora - t < 60_000);
  if (recentes.length >= 5 || hora.total >= 100) return false;
  envios.set(ip, [...recentes, agora]);
  hora.total++;
  return true;
}

/** Lê o corpo contando os bytes de verdade (content-length pode vir vazio). Passou do limite, descarta e devolve {}. */
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho <= CORPO_MAX) partes.push(parte);
    });
    req.on("end", () => {
      if (tamanho > CORPO_MAX) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(partes).toString("utf8"))); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

/** Devolve só os campos esperados, já limpos; null se o envio não for um Raio-X válido. */
function limpar(corpo) {
  const codigo = String(corpo?.codigo || "").toUpperCase();
  const areas = Array.isArray(corpo?.areas) ? corpo.areas.slice(0, 10) : [];
  if (!/^RX-[A-Z2-9]{6}$/.test(codigo) || !areas.length) return null;
  return {
    codigo,
    nome: texto(corpo.nome, 60),
    clinica: texto(corpo.clinica, 100),
    perfil: (Array.isArray(corpo.perfil) ? corpo.perfil.slice(0, 8) : []).map((p) => [texto(p?.[0], 40), texto(p?.[1], 40)]),
    dores: (Array.isArray(corpo.dores) ? corpo.dores.slice(0, 5) : []).map((d) => texto(d, 40)),
    areas: areas.map((a) => [texto(a?.[0], 40), nota100(a?.[1])]),
    geral: nota100(corpo.geral),
  };
}

function formatarNota(r) {
  const marca = (v) => (v < 50 ? "🔴" : v < 75 ? "🟡" : "🟢");
  const fracas = [...r.areas].sort((a, b) => a[1] - b[1]).slice(0, 3).map((a) => a[0]);
  return [
    `📋 RAIO-X · só você vê · ${r.codigo}`,
    "",
    r.nome && `Nome: ${r.nome}`,
    r.clinica && `Clínica: ${r.clinica}`,
    ...r.perfil.filter((p) => p[0] && p[1]).map((p) => `${p[0]}: ${p[1]}`),
    r.dores.length > 0 && `Incomoda: ${r.dores.join(", ")}`,
    "",
    `Nota geral: ${r.geral}/100`,
    ...r.areas.map((a) => `${marca(a[1])} ${a[0]}: ${a[1]}`),
    "",
    `Atacar primeiro: ${fracas.join(", ")}`,
    "Prometido: enviar as 50 mensagens e as sugestões das outras áreas.",
  ].filter((l) => l !== false && l !== undefined && l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}

/**
 * Chamado para cada texto recebido. Devolve true se a mensagem é de um Raio-X (o chamador não deve disparar robô).
 * A nota entra 1 ms antes da mensagem do cliente, para a conversa continuar contando como "aguardando resposta".
 */
async function tratarMensagem(db, { de, businessNumberId, corpo, quando, enviar }) {
  if (businessNumberId !== NUMERO_NEXUS) return false;
  const achado = String(corpo || "").match(REGEX_CODIGO);
  if (!achado) return false;
  const codigo = achado[0].toUpperCase();
  let dados = null;
  try {
    dados = await db.raioXObter(codigo);
  } catch (err) {
    console.error("Erro ao ler Raio-X:", err.message);
  }
  // A saudação sai antes da pausa: o envio automático respeita a pausa, então não repete se a equipe já assumiu ou se
  // a pessoa reenviar o código. Falha no envio não pode impedir de calar o robô.
  try {
    await enviar(saudacao(dados?.nome));
  } catch (err) {
    console.error("Erro ao saudar Raio-X:", err.message);
  }
  try {
    // Cala o robô antes da nota: se a nota falhar, a campanha ainda assim não entra em cima da pessoa.
    await db.pausarBot(de, businessNumberId, Date.now() + 24 * 3600 * 1000);
    await db.setFluxoPasso(de, businessNumberId, PASSO);
    await db.insertMessage({
      phone: de,
      business_number_id: businessNumberId,
      direction: "note",
      type: "nota",
      body: dados ? formatarNota(dados) : `📋 RAIO-X · só você vê · ${codigo}\nAs respostas não chegaram ao painel. Peça para a pessoa mandar um print do resultado.`,
      created_at: quando - 1,
    });
    const tagId = await db.tagEncontrarOuCriar(businessNumberId, "Raio-X", "#EA580C");
    await db.adicionarTagConversaSeAusente(businessNumberId, de, tagId, "automatico");
  } catch (err) {
    console.error("Erro ao anexar Raio-X:", err.message);
  }
  return true;
}

module.exports = { ORIGEM, PASSO, saudacao, permitir, lerCorpo, limpar, formatarNota, tratarMensagem };
