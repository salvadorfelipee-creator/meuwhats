const crypto = require("crypto");

const db = require("./db");
const r2 = require("./r2");
const publique = require("./publique");

// Imagem de post agendado fica esse tempo no R2 depois de publicada — só uma folga de
// segurança antes de liberar espaço, igual à limpeza dos Reels (ver reels.js).
const IDADE_LIMPEZA_MS = 24 * 60 * 60 * 1000;

// Sobe a imagem pro mesmo bucket dos Reels, mas num prefixo separado ("posts/") — o
// sincronizarFila() dos Reels ignora tudo que começa com esse prefixo, então não vira um
// "vídeo fantasma" na fila de Reels por engano.
async function enviarImagem(buffer, nomeArquivo, contentType) {
  const key = `posts/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${nomeArquivo}`;
  await r2.enviarVideo(key, buffer, contentType || "image/jpeg");
  return key;
}

// dataHoraString no formato do <input type="datetime-local"> ("2026-08-20T09:30") — sempre
// em horário local, nunca UTC (ver reels.js pra por que isso importa: toISOString() dá
// timestamp errado).
function timestampDeDataHora(dataHoraString) {
  const ms = new Date(dataHoraString).getTime();
  if (!dataHoraString || Number.isNaN(ms)) throw new Error("Data e hora inválidas.");
  return ms;
}

// Cria um post agendado — cada um tem seu próprio dia+hora exato, definido pelo usuário (não
// tem "piloto automático" aqui como nos Reels, é sempre uma escolha explícita).
async function criarAgendamento({ contaId, texto, link, redes, dataHoraString, imagemBuffer, imagemNomeArquivo, imagemContentType }) {
  if (!texto && !imagemBuffer) throw new Error("Informe ao menos um texto ou uma imagem.");
  if (!redes || !redes.length) throw new Error("Marque ao menos uma rede.");
  const agendadoPara = timestampDeDataHora(dataHoraString);

  let imagemKey = null;
  if (imagemBuffer) imagemKey = await enviarImagem(imagemBuffer, imagemNomeArquivo || "imagem.jpg", imagemContentType);

  const id = await db.agendaCriar({ contaId: contaId || "felizcred", texto, link, imagemKey, redes, agendadoPara });
  return { id, agendadoPara };
}

// Publica um post nas redes marcadas — conta como sucesso se AO MENOS UMA rede publicar
// (mesmo critério dos Reels), com o motivo de cada uma no resultado. A imagem, se tiver, sai
// de uma URL assinada temporária do R2 (gerada na hora de publicar, não na hora de agendar —
// evita o link expirar antes da hora marcada chegar).
async function publicarAgendamento(item) {
  try {
    const imagemUrl = item.imagem_key ? await r2.urlAssinada(item.imagem_key) : undefined;
    const redes = JSON.parse(item.redes);
    const resultado = await publique.publicarEmTodos({
      contaId: item.conta_id,
      texto: item.texto,
      imagemUrl,
      link: item.link,
      redes,
    });

    const algumaOk = Object.values(resultado).some((r) => r.ok);
    if (algumaOk) {
      await db.agendaMarcarPostado(item.id, resultado);
      return { ok: true, item, resultado };
    }
    const mensagemErro = Object.entries(resultado)
      .map(([rede, r]) => `${rede}: ${r.erro}`)
      .join(" | ");
    throw new Error(mensagemErro || "Nenhuma rede publicou.");
  } catch (err) {
    await db.agendaMarcarErro(item.id, err.message);
    throw err;
  }
}

// Post cuja hora já chegou — checado a cada minuto pelo agendador (ver server.js).
async function publicarProximoDevido() {
  const item = await db.agendaProximoDevido();
  if (!item) return { vazio: true };
  return publicarAgendamento(item);
}

// Publica um post ESPECÍFICO agora, fora de ordem — ação manual e explícita do usuário.
async function publicarAgoraEspecifico(id) {
  const item = await db.agendaBuscarPorId(id);
  if (!item) throw new Error("Post não encontrado na agenda.");
  if (item.status !== "pending") throw new Error(`Esse post já está "${item.status}", não está mais pendente.`);
  return publicarAgendamento(item);
}

// Enriquece as linhas cruas do banco com o que o painel precisa pra desenhar a lista: redes
// já como array (não JSON string) e uma URL assinada temporária pra mostrar a miniatura da
// imagem (gerar uma URL assinada é só uma assinatura criptográfica, não custa uma chamada de
// rede — de sobra pra fazer isso pra cada item da lista).
async function enriquecerItem(item) {
  const imagemUrl = item.imagem_key ? await r2.urlAssinada(item.imagem_key, 3600) : null;
  return { ...item, redes: JSON.parse(item.redes), imagemUrl };
}

async function listarFila() {
  const itens = await db.agendaFilaCompleta();
  return Promise.all(itens.map(enriquecerItem));
}

async function listarRecentes(limit = 30) {
  const itens = await db.agendaListarRecentes(limit);
  return Promise.all(itens.map(enriquecerItem));
}

async function definirData(id, dataHoraString) {
  await db.agendaDefinirData(id, timestampDeDataHora(dataHoraString));
}

async function removerAgendamento(id) {
  const item = await db.agendaBuscarPorId(id);
  if (!item) throw new Error("Post não encontrado na agenda.");
  if (item.imagem_key) await r2.apagarVideo(item.imagem_key).catch(() => {});
  await db.agendaRemover(id);
}

async function reenfileirar(id) {
  await db.agendaReenfileirar(id);
}

// Apaga do R2 a imagem de quem já foi publicado há mais de 24h — mesma lógica dos Reels,
// pra não acumular espaço no bucket compartilhado.
async function limparAntigas() {
  const itens = await db.agendaPostadosParaLimpar(IDADE_LIMPEZA_MS);
  let apagadas = 0;
  for (const item of itens) {
    try {
      await r2.apagarVideo(item.imagem_key);
      await db.agendaMarcarImagemApagada(item.id);
      apagadas++;
    } catch (err) {
      console.error(`Falha ao apagar imagem de post agendado do R2 (id ${item.id}):`, err.message);
    }
  }
  return { apagadas };
}

module.exports = {
  criarAgendamento,
  publicarProximoDevido,
  publicarAgoraEspecifico,
  listarFila,
  listarRecentes,
  definirData,
  removerAgendamento,
  reenfileirar,
  limparAntigas,
  resumo: db.agendaResumo,
};
