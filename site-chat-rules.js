const WHATSAPP_FELIZCRED = "https://wa.me/554797059353?text=Ol%C3%A1%2C%20vim%20pelo%20chat%20do%20site%20e%20preciso%20continuar%20meu%20atendimento";

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bn\b/g, "nao")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function intencaoRepetivel(texto) {
  const valor = normalizar(texto);
  if (!valor) return null;
  if (/\bnao\b.*\b(achei|acho|achando|aparece|apareceu|aparecendo|encontro|encontrando|localizo)\b/.test(valor)
      || /\b(botao|opcao|formulario|avancar)\b.*\bnao\b.*\b(aparece|apareceu|aparecendo|acho|encontro)\b/.test(valor)) {
    return "acao_nao_encontrada";
  }
  return null;
}

function tokensRelevantes(texto) {
  const ignorar = new Set(["a", "as", "o", "os", "de", "da", "do", "e", "eu", "me", "meu", "minha", "por", "para", "favor", "aqui"]);
  return new Set(normalizar(texto).split(" ").filter((token) => token.length > 1 && !ignorar.has(token)));
}

function mensagensSemelhantes(a, b) {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return false;
  const ia = intencaoRepetivel(na), ib = intencaoRepetivel(nb);
  if (ia && ia === ib) return true;
  if (na === nb) return true;
  const ta = tokensRelevantes(na), tb = tokensRelevantes(nb);
  if (!ta.size || !tb.size) return false;
  const intersecao = [...ta].filter((token) => tb.has(token)).length;
  const uniao = new Set([...ta, ...tb]).size;
  return intersecao >= 2 && intersecao / uniao >= 0.55;
}

function solicitacaoRepetida(mensagemAtual, mensagensRecentes) {
  const visitantes = (mensagensRecentes || [])
    .filter((m) => m.direction === "visitor" && m.body)
    .slice(-12);
  return visitantes.filter((m) => mensagensSemelhantes(mensagemAtual, m.body)).length >= 2;
}

function horarioComercial(data = new Date()) {
  const timeZone = "America/Sao_Paulo";
  const dia = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(data);
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "numeric", hour12: false }).format(data));
  if (dia === "Sun") return false;
  if (dia === "Sat") return hora >= 9 && hora < 12;
  return hora >= 9 && hora < 18;
}

function encaminhamentoWhatsAppPorRepeticao(data = new Date()) {
  if (horarioComercial(data)) {
    return `Percebi que você já pediu isso novamente. Para não te deixar preso nesta etapa, continue agora com nosso atendimento no WhatsApp: ${WHATSAPP_FELIZCRED}`;
  }
  return `Percebi que você já pediu isso novamente. Nosso atendimento continua pelo WhatsApp no próximo dia útil. Você pode deixar sua mensagem agora por este link: ${WHATSAPP_FELIZCRED}`;
}

// Atalhos de saída: quando o cliente manda "Início", "menu", "Nada" etc. no meio do fluxo CLT,
// respondemos de forma fixa em vez de deixar o Gemini improvisar (ele inventou "atualize a página").
const ATALHO_SAIDA = /^(inicio|menu|nada|voltar|recomecar|oi|ola|tentar de novo|tentar novamente|de novo|outra vez|continuar)$/;

function atalhoCltSemSaida(texto, row) {
  if (!ATALHO_SAIDA.test(normalizar(texto))) return null;
  if (!row) return "Tudo bem. Para começar a simulação, você já completou 3 meses de registro no trabalho atual?";
  if (row.etapa === "erro_autorizacao") {
    return "Sua autorização ainda não foi enviada à Facta e nenhum contrato foi criado. Toque em Tentar novamente na mensagem acima para reenviar pelo WhatsApp. Se o botão não aparecer, escreva: quero falar com atendente.";
  }
  return "Sua simulação continua salva aqui. Escreva sua dúvida ou use o botão ou formulário da etapa atual.";
}

module.exports = {
  atalhoCltSemSaida,
  WHATSAPP_FELIZCRED,
  encaminhamentoWhatsAppPorRepeticao,
  horarioComercial,
  mensagensSemelhantes,
  solicitacaoRepetida,
};
