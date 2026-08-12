const crypto = require("crypto");

const db = require("./db");
const r2 = require("./r2");
const ig = require("./instagram");
const fb = require("./facebook");

const LEGENDA_PADRAO_FALLBACK =
  "FelizCred — correspondente bancário. Crédito consignado, antecipação de FGTS e mais, 100% digital pelo WhatsApp. #felizcred #credito #consignado #fgts";

// Plano free do R2: 10GB de armazenamento. Bloqueia upload novo perto do limite pra nunca
// estourar (e começar a ser cobrado) — 9GB dá uma folga confortável de ~1GB.
const LIMITE_BYTES = 10 * 1024 * 1024 * 1024;
const BLOQUEIO_BYTES = 9 * 1024 * 1024 * 1024;

// Vídeo já publicado (nas redes que deram certo) fica esse tempo no R2 antes de ser
// apagado — só uma folga de segurança, não precisa manter depois de publicado.
const IDADE_LIMPEZA_MS = 24 * 60 * 60 * 1000;

function env(nome) {
  const valor = process.env[nome];
  return valor ? valor.trim() : valor;
}

function credenciaisFacebook() {
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  const paginaId = env("FACEBOOK_PAGE_ID");
  return token && paginaId ? { token, paginaId } : null;
}

async function espacoUsado() {
  const usados = await r2.usoTotalBytes();
  return { usados, limite: LIMITE_BYTES, percentual: Math.round((usados / LIMITE_BYTES) * 100), bloqueado: usados >= BLOQUEIO_BYTES };
}

// Puxa a lista atual do bucket e adiciona à fila quem ainda não está nela. Idempotente —
// chamar de novo só pega os vídeos novos (útil se algum vídeo foi colocado direto no R2
// por fora, embora o normal seja usar o botão de upload do painel).
async function sincronizarFila() {
  // Ignora o prefixo "posts/" — é onde a agenda de publicações (agenda.js) guarda as
  // imagens dos posts multi-rede, no mesmo bucket. Sem esse filtro elas virariam "vídeos
  // fantasma" aqui na fila de Reels.
  const arquivos = (await r2.listarVideos()).filter((a) => !a.name.startsWith("posts/"));
  const adicionados = await db.reelsSincronizarFila(arquivos);
  return { encontrados: arquivos.length, adicionados };
}

// Publica em Instagram + Facebook direto de uma URL assinada do R2 — o servidor nunca
// baixa o vídeo pro próprio disco, só pede pro R2 gerar um link temporário e a Meta busca
// direto de lá. Cada rede é tentada de forma independente; conta como sucesso se AO MENOS
// UMA publicar. O arquivo em si só é apagado do R2 depois de 24h (ver limparAntigos()).
// Usada tanto pelo agendador automático quanto pelo botão "Publicar agora" de um item
// específico da fila.
async function publicarItem(item) {
  try {
    const videoUrl = await r2.urlAssinada(item.drive_file_id);
    const legendaPadrao = (await db.reelsConfigGet("legenda_padrao")) || LEGENDA_PADRAO_FALLBACK;
    const legenda = item.legenda || legendaPadrao;
    const resultado = {};

    try {
      resultado.instagram = { ok: true, ...(await ig.publicarReels({ videoUrl, legenda })) };
    } catch (err) {
      resultado.instagram = { ok: false, erro: err.message };
    }

    const credFb = credenciaisFacebook();
    if (credFb) {
      try {
        resultado.facebook = { ok: true, ...(await fb.publicarReels({ videoUrl, legenda }, credFb)) };
      } catch (err) {
        resultado.facebook = { ok: false, erro: err.message };
      }
    }

    const algumaOk = Object.values(resultado).some((r) => r.ok);
    if (algumaOk) {
      await db.reelsMarcarPostado(item.id, resultado);
      return { ok: true, item, resultado };
    }
    const mensagemErro = Object.entries(resultado)
      .map(([rede, r]) => `${rede}: ${r.erro}`)
      .join(" | ");
    throw new Error(mensagemErro || "Nenhuma rede com vídeo configurada.");
  } catch (err) {
    await db.reelsMarcarErro(item.id, err.message);
    throw err;
  }
}

// Pega o próximo pendente SEM horário marcado, na ordem da fila — é o "piloto automático"
// (N por dia, espalhado), usado pelos horários fixos do agendador (ver server.js).
async function publicarProximoPendente() {
  const [item] = await db.reelsProximosPendentes(1);
  if (!item) return { vazio: true };
  return publicarItem(item);
}

// Pega o vídeo com horário EXATO marcado cuja hora já chegou (se tiver algum) — checado a
// cada minuto pelo agendador, furando a fila automática pra sair no horário certo.
async function publicarProximoAgendado() {
  const item = await db.reelsProximoAgendadoDevido();
  if (!item) return { vazio: true };
  return publicarItem(item);
}

// Publica um vídeo ESPECÍFICO da fila agora, fora de ordem — ignora a posição e a data
// mínima (é uma ação manual e explícita do usuário, não faz sentido bloquear por data).
async function publicarItemEspecifico(id) {
  const item = await db.reelsBuscarPorId(id);
  if (!item) throw new Error("Vídeo não encontrado na fila.");
  if (item.status !== "pending") throw new Error(`Esse vídeo já está "${item.status}", não está mais pendente.`);
  return publicarItem(item);
}

// Fila completa (todo pendente) com uma data/hora PREVISTA pra cada um. Quem tem horário
// exato marcado (agendado_para) já mostra esse horário direto — é exato, não estimativa.
// Quem não tem entra no cálculo do piloto automático (N por dia, espalhado entre 08:00 e
// 22:00) — só uma estimativa recalculada toda vez, não é gravada em lugar nenhum, e muda
// se a quantidade/dia ou a ordem da fila mudar.
async function listarFilaComEstimativa() {
  const [itens, postsPorDiaConfig] = await Promise.all([db.reelsFilaCompleta(), db.reelsConfigGet("posts_por_dia")]);
  const porDia = Math.max(Number(postsPorDiaConfig) || 5, 1);
  const inicioMin = 8 * 60;
  const fimMin = 22 * 60;
  const passoMin = porDia > 1 ? (fimMin - inicioMin) / (porDia - 1) : 0;

  let dia = new Date();
  dia.setHours(0, 0, 0, 0);
  let slotNoDia = 0;

  return itens.map((item) => {
    if (item.agendado_para) return { ...item, data_prevista: item.agendado_para, exato: true };
    if (slotNoDia >= porDia) {
      dia = new Date(dia.getTime() + 24 * 60 * 60 * 1000);
      slotNoDia = 0;
    }
    const minutosNoDia = Math.round(inicioMin + passoMin * slotNoDia);
    const dataPrevista = new Date(dia);
    dataPrevista.setMinutes(minutosNoDia);
    slotNoDia++;
    return { ...item, data_prevista: dataPrevista.getTime(), exato: false };
  });
}

// dataHoraString no formato do <input type="datetime-local"> ("2026-08-15T14:00") — vazio
// ou null limpa o agendamento e o vídeo volta pro piloto automático.
async function definirData(id, dataHoraString) {
  const timestamp = dataHoraString ? new Date(dataHoraString).getTime() : null;
  await db.reelsDefinirData(id, timestamp);
}

// Remove da fila e apaga o arquivo do R2 — usado pelo botão "Remover" (usuário mudou de
// ideia sobre algum vídeo específico antes dele ser publicado).
async function removerItem(id) {
  const item = await db.reelsBuscarPorId(id);
  if (!item) throw new Error("Vídeo não encontrado na fila.");
  await r2.apagarVideo(item.drive_file_id).catch(() => {}); // segue removendo do banco mesmo se já não existir no R2
  await db.reelsRemover(id);
}

// Upload direto do painel: sobe o vídeo pro R2 (sem precisar abrir nenhum site por fora) e
// já sincroniza a fila na sequência, pra aparecer em "pendentes" na hora. `legenda` e
// `agendarPara` (string do <input type="datetime-local">) são opcionais — só esse vídeo
// usa um texto diferente do padrão / só esse vídeo publica num horário exato marcado.
async function enviarVideo(buffer, nomeArquivo, legenda, agendarPara) {
  const espaco = await espacoUsado();
  if (espaco.bloqueado) {
    throw new Error(`Espaço quase cheio (${espaco.percentual}% de 10GB usado) — apague vídeos antigos ou espere a limpeza automática antes de subir mais.`);
  }
  const key = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${nomeArquivo}`;
  const arquivo = await r2.enviarVideo(key, buffer);
  await sincronizarFila();
  if (legenda) await db.reelsDefinirLegenda(arquivo.id, legenda);
  if (agendarPara) {
    // sincronizarFila() já inseriu a linha (drive_file_id = arquivo.id) — busca o id
    // numérico dela pra poder gravar o horário com a mesma função usada pela fila completa.
    const linha = await db.reelsBuscarPorDriveFileId(arquivo.id);
    if (linha) await definirData(linha.id, agendarPara);
  }
  return arquivo;
}

// Apaga do R2 quem já foi publicado há mais de 24h — evita acumular espaço/custo depois
// que o vídeo já cumpriu sua função. Roda periodicamente (ver server.js).
async function limparAntigos() {
  const itens = await db.reelsPostadosParaLimpar(IDADE_LIMPEZA_MS);
  let apagados = 0;
  for (const item of itens) {
    try {
      await r2.apagarVideo(item.drive_file_id);
      await db.reelsMarcarArquivoApagado(item.id);
      apagados++;
    } catch (err) {
      console.error(`Falha ao apagar do R2 (id ${item.id}):`, err.message);
    }
  }
  return { apagados };
}

module.exports = {
  sincronizarFila,
  enviarVideo,
  publicarProximoPendente,
  publicarProximoAgendado,
  publicarItemEspecifico,
  listarFilaComEstimativa,
  definirData,
  removerItem,
  limparAntigos,
  espacoUsado,
  resumo: db.reelsResumo,
  listarRecentes: db.reelsListarRecentes,
  reenfileirar: db.reelsReenfileirar,
  configGet: db.reelsConfigGet,
  configSet: db.reelsConfigSet,
};
