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

// Carrossel — mesma ideia, várias imagens do mesmo post agendado, uma key por imagem.
async function enviarImagens(imagens) {
  const keys = [];
  for (const img of imagens) {
    keys.push(await enviarImagem(img.buffer, img.nomeArquivo || "imagem.jpg", img.contentType));
  }
  return keys;
}

// dataHoraString no formato do <input type="datetime-local"> ("2026-08-20T09:30") — sempre
// em horário local, nunca UTC (ver reels.js pra por que isso importa: toISOString() dá
// timestamp errado).
// `new Date(string).getTime()` interpreta a string no fuso do PROCESSO Node, não do usuário —
// em produção (Render) o processo roda em UTC, então "12:00" virava 12:00 UTC (09:00 em
// Brasília, 3h adiantado do que a pessoa escolheu no formulário). Brasília é sempre UTC-3 (sem
// horário de verão desde 2019), então somamos 3h à hora informada antes de converter pra UTC —
// isso funciona igual não importa o fuso do servidor.
function timestampDeDataHora(dataHoraString) {
  const m = dataHoraString && dataHoraString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Data e hora inválidas.");
  const [, ano, mes, dia, hora, min] = m.map(Number);
  return Date.UTC(ano, mes - 1, dia, hora + 3, min);
}

// Cria um post agendado — cada um tem seu próprio dia+hora exato, definido pelo usuário (não
// tem "piloto automático" aqui como nos Reels, é sempre uma escolha explícita).
// `imagens` (opcional): array de { buffer, nomeArquivo, contentType } — 2+ imagens vira
// carrossel na hora de publicar. Se vier preenchido, tem prioridade sobre imagemBuffer único.
// `imagensPorRede` (opcional): objeto { rede: { buffer, nomeArquivo, contentType } } — versão
// da imagem reenquadrada manualmente no painel pra uma rede específica (ex. Stories 9:16), só
// vale a pena junto com imagemBuffer (não faz sentido em carrossel).
async function criarAgendamento({ contaId, texto, link, redes, dataHoraString, imagemBuffer, imagemNomeArquivo, imagemContentType, imagens, imagensPorRede }) {
  if (!texto && !imagemBuffer && !(imagens && imagens.length)) throw new Error("Informe ao menos um texto ou uma imagem.");
  if (!redes || !redes.length) throw new Error("Marque ao menos uma rede.");
  const agendadoPara = timestampDeDataHora(dataHoraString);

  let imagemKey = null;
  let imagemKeys = null;
  if (imagens && imagens.length) {
    imagemKeys = await enviarImagens(imagens);
  } else if (imagemBuffer) {
    imagemKey = await enviarImagem(imagemBuffer, imagemNomeArquivo || "imagem.jpg", imagemContentType);
  }

  let imagemPorRedeKeys = null;
  if (imagensPorRede && Object.keys(imagensPorRede).length) {
    imagemPorRedeKeys = {};
    for (const [rede, img] of Object.entries(imagensPorRede)) {
      imagemPorRedeKeys[rede] = await enviarImagem(img.buffer, img.nomeArquivo || "imagem.jpg", img.contentType);
    }
  }

  const id = await db.agendaCriar({ contaId: contaId || "felizcred", texto, link, imagemKey, imagemKeys, imagemPorRedeKeys, redes, agendadoPara });
  return { id, agendadoPara };
}

// Publica um post nas redes marcadas — conta como sucesso se AO MENOS UMA rede publicar
// (mesmo critério dos Reels), com o motivo de cada uma no resultado. A imagem, se tiver, sai
// de uma URL assinada temporária do R2 (gerada na hora de publicar, não na hora de agendar —
// evita o link expirar antes da hora marcada chegar).
async function publicarAgendamento(item) {
  try {
    const imagemKeys = item.imagem_keys ? JSON.parse(item.imagem_keys) : null;
    const imagemUrls = imagemKeys && imagemKeys.length
      ? await Promise.all(imagemKeys.map((key) => r2.urlAssinada(key)))
      : undefined;
    const imagemUrl = !imagemUrls && item.imagem_key ? await r2.urlAssinada(item.imagem_key) : undefined;
    const imagemPorRedeKeys = item.imagem_por_rede_keys ? JSON.parse(item.imagem_por_rede_keys) : null;
    const imagemUrlPorRede = imagemPorRedeKeys
      ? Object.fromEntries(
          await Promise.all(Object.entries(imagemPorRedeKeys).map(async ([rede, key]) => [rede, await r2.urlAssinada(key)]))
        )
      : undefined;
    const redes = JSON.parse(item.redes);
    const resultado = await publique.publicarEmTodos({
      contaId: item.conta_id,
      texto: item.texto,
      imagemUrl,
      imagemUrls,
      imagemUrlPorRede,
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
  const imagemKeys = item.imagem_keys ? JSON.parse(item.imagem_keys) : null;
  const imagemUrls = imagemKeys && imagemKeys.length
    ? await Promise.all(imagemKeys.map((key) => r2.urlAssinada(key, 3600)))
    : null;
  const imagemUrl = imagemUrls ? imagemUrls[0] : (item.imagem_key ? await r2.urlAssinada(item.imagem_key, 3600) : null);
  return { ...item, redes: JSON.parse(item.redes), imagemUrl, imagemUrls };
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
  if (item.imagem_keys) {
    for (const key of JSON.parse(item.imagem_keys)) await r2.apagarVideo(key).catch(() => {});
  }
  if (item.imagem_por_rede_keys) {
    for (const key of Object.values(JSON.parse(item.imagem_por_rede_keys))) await r2.apagarVideo(key).catch(() => {});
  }
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
      if (item.imagem_key) await r2.apagarVideo(item.imagem_key);
      if (item.imagem_keys) {
        for (const key of JSON.parse(item.imagem_keys)) await r2.apagarVideo(key);
      }
      if (item.imagem_por_rede_keys) {
        for (const key of Object.values(JSON.parse(item.imagem_por_rede_keys))) await r2.apagarVideo(key);
      }
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
