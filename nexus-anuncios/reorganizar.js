// Reorganização 17/11/2026: concentrar a campanha em Harmonização e Odontologia.
// Regras do usuário: anúncio antigo COM cliques não é editado; antigo SEM cliques é pausado; os novos (lotes 2/3) de harm/odonto são ativados;
// artes genéricas (que não citam outra profissão) ganham cópias com texto adaptado nos conjuntos harm e odonto; os novos "geral" viram cópias nesses dois.
// Uso: node --env-file=.env nexus-anuncios/reorganizar.js plano     -> grava reorg-anuncios.json (cópias) e reorg-status.json (pausar/ativar)
//      node --env-file=.env nexus-anuncios/criar-campanha.js --spec reorg-anuncios.json   -> cria as cópias (ATIVAS)
//      node --env-file=.env nexus-anuncios/reorganizar.js aplicar   -> pausa/ativa e pausa conjuntos sem anúncio ativo
const fs = require("fs");
const path = require("path");
const T = process.env.NEXUS_ADS_TOKEN;
const CAMP = "120251076687240006";
const B = "https://graph.facebook.com/v21.0/";
const ids = require("./campanha-ids.json");
const base = require("./campanha-nexus.json");

async function graph(p, body) {
  for (let i = 0; i < 15; i++) {
    const r = body
      ? await (await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...body, access_token: T }) })).json()
      : await (await fetch(B + p + (p.includes("?") ? "&" : "?") + "access_token=" + T)).json();
    if (r.error && r.error.code === 17) { console.log("  limite da API; aguardando 60s"); await new Promise((x) => setTimeout(x, 60000)); continue; }
    if (r.error) throw new Error(p + ": " + r.error.message);
    return r;
  }
  throw new Error("limite da API persistente");
}
async function todos(p) { let out = []; let r = await graph(p); while (true) { out = out.concat(r.data || []); if (!r.paging || !r.paging.next) break; r = await (await fetch(r.paging.next)).json(); if (r.error) { await new Promise((x) => setTimeout(x, 60000)); } } return out; }

const S = {
  harmonizacao: { pl: "profissionais de harmonização facial", busca: "harmonização facial", proc: "procedimentos", esp: "harmonização facial" },
  odonto: { pl: "dentistas", busca: "dentista", proc: "tratamentos", esp: "odontologia" },
};
const oferta = (s, ia) => `A Sites Nexus cria o site de ${S[s].pl} com foco em busca local e contato direto.\n\n👉 Toque em *Enviar mensagem* e peça o diagnóstico gratuito de 15 minutos: o Felipe mostra como sua empresa aparece hoje no Google${ia ? " e o que organizar para as IAs também entenderem seu negócio" : " e o que ajustar"}.`;
const SEGS = ["harmonizacao", "odonto"];

// Textos adaptados. f(segmento) -> [gancho, história, título]
const G = {
  Arte_01_indicacao_tipografico_1080x1350: (s) => ["Indicação é boa. Mas quem nunca ouviu falar da sua clínica só chega pela busca.", `A indicação traz o contato. A busca traz quem ainda não conhece você. Um site pensado para quem procura ${S[s].busca} na cidade abre esse segundo caminho.`, "Indicação e busca juntas"],
  Arte_03_instagram_tipografico_1080x1350: () => ["Seguidores curtem. Pacientes pesquisam.", "Curtida não marca consulta. Antes de chamar, o paciente pesquisa e compara. Um site que explica, gera confiança e facilita o contato leva você do feed à conversa.", "Vá além do Instagram"],
  Arte_05_inauguracao_tipografico_1080x1350: () => ["Sua clínica vai abrir as portas. O paciente vai achar o endereço?", "Quem ouvir seu nome vai pesquisar antes de visitar. Um site com serviços, endereço e contato deixa a clínica pronta desde o primeiro dia.", "Pronta desde o primeiro dia"],
  Arte_07_google_tipografico_1080x1350: (s) => [`Quem procura ${S[s].busca} na sua cidade encontra a sua clínica?`, "Um site com foco em SEO local e contato fácil prepara sua clínica para ser encontrada no Google.", "Seja encontrada na sua cidade"],
  Arte_08_google_infografico_1080x1350: () => ["Seu serviço. Sua cidade. Seu site está preparado?", "Uma página para cada tratamento, conteúdo relevante para sua região e site conectado ao perfil da empresa no Google ajudam sua clínica a ser encontrada.", "Um site preparado para a busca"],
  Arte_09_qualificacao_tipografico_1080x1350: () => ["Antes de perguntar o preço, o paciente precisa entender o valor.", "Um site que apresenta seus diferenciais prepara uma conversa melhor, antes do pedido de orçamento.", "Mostre o valor do seu trabalho"],
  Video_01_indicacao_1080x1920: () => ["Só entra paciente por indicação?", "Sua clínica pode abrir outro caminho: um site feito para ser encontrado e facilitar o contato.", "Um caminho além da indicação"],
  Video_02_instagram_1080x1920: () => ["Seguidores curtem. Pacientes pesquisam.", "Do link da bio ao pedido de avaliação: dê ao paciente um lugar para conhecer seu trabalho.", "Vá além do Instagram"],
  Video_03_inauguracao_1080x1920: () => ["As portas vão abrir. Seu site também?", "Quem ouvir seu nome vai procurar você antes de visitar. Esteja pronta desde o primeiro dia.", "Pronta desde o primeiro dia"],
  Video_04_google_1080x1920: (s) => [`Quem procura ${S[s].busca} na sua cidade encontra sua clínica?`, "Um site com foco em busca local e contato fácil prepara sua clínica para ser encontrada.", "Seja encontrada na sua cidade"],
  Video_05_qualificacao_1080x1920: () => ["Antes de perguntar o preço, o paciente precisa entender o valor.", "Um site que explica seus serviços e diferenciais prepara uma conversa melhor.", "Mostre o valor do seu trabalho"],
  // novos "geral" -> cópias nos dois conjuntos
  Novo_geral_quem_procura: () => ["Seu paciente já escolheu antes de chamar. E você nem ficou sabendo.", "Ele digita o serviço e a cidade no Google e decide entre os primeiros nomes. Um site com conteúdo local ajuda sua clínica a entrar nessa lista.", "Seja encontrada na sua cidade"],
  Novo_geral_concorrente_aparece: (s) => ["A clínica concorrente não é melhor que a sua. Só está mais fácil de achar.", `Muitas vezes a diferença é visibilidade, não qualidade. Um site que explica seus ${S[s].proc} e facilita o contato reduz essa diferença.`, "Seja fácil de achar"],
  Novo_geral_valor_explicado: (s) => ["Seu preço não é alto. Seu valor é que está mal explicado.", `Quando o paciente não entende o que está incluso, só enxerga o preço. Um site que mostra seus ${S[s].proc} e diferenciais muda a conversa antes do orçamento.`, "Mostre o valor do seu trabalho"],
  Novo_geral_regiao_procura: (s) => [`Todo dia alguém na sua cidade procura ${S[s].busca}. Para onde essa pessoa vai?`, "Para quem ela encontra. Site, conteúdo local e informações claras trabalham juntos para sua clínica ser achada.", "Sua região procura você"],
  Novo_geral_busca_cliente: (s) => ["O paciente mais fácil de conquistar é o que já está procurando.", `Quem pesquisa já tem interesse. Falta um lugar claro para ele entender seus ${S[s].proc} e dar o próximo passo.`, "De uma busca para uma conversa"],
  Novo_geral_indicacao_encontrado: () => ["Indicação é ótima. Mas quem nunca ouviu falar da sua clínica só chega pela busca.", "A indicação traz o contato. A busca traz quem ainda não conhece você. Um site com SEO local abre esse segundo caminho.", "Indicação e busca juntas"],
  Novo_ia_geral_proximo_cliente: (s) => ["Seu próximo paciente pode nem abrir o Google. Pode perguntar ao ChatGPT.", `Ele pergunta como escolher uma clínica de ${S[s].esp}. Mostre o que você faz, onde atende e por que vale conhecer, em um site que a IA e a pessoa consigam entender.`, "Seja fácil de conhecer"],
  Novo_ia_geral_marca_conversa: () => ["A IA responde em segundos. Sua clínica está nessa resposta?", "Ninguém garante a resposta de uma IA, mas serviços, região e contato bem explicados em um site aumentam suas chances de ser compreendida.", "Amplie sua presença nas IAs"],
};
const SO_ODONTO = new Set(["Arte_08_google_infografico_1080x1350"]); // mockup é de clínica odontológica

(async () => {
  const modo = process.argv[2];
  const ads = await todos(`${CAMP}/ads?fields=id,name,adset_id,effective_status&limit=100`);
  const ins = await todos(`${CAMP}/insights?level=ad&fields=ad_id,clicks&date_preset=maximum&limit=100`);
  const cliques = Object.fromEntries(ins.map((r) => [r.ad_id, +r.clicks]));
  const segDe = (nome) => nome.split(" | ")[0];
  const arteDe = (nome) => nome.split(" | ")[1];

  const copiaIds = new Set(); try { for (const x of require("./reorg-anuncios.json").anuncios) copiaIds.add(ids.anuncios[x.chave]); } catch (e) {}
  const manter = [], pausar = [], ativar = [], copias = [];
  for (const a of ads) {
    const seg = segDe(a.name), arte = arteDe(a.name), novo = /^Novo_/.test(arte), c = cliques[a.id] || 0;
    if (copiaIds.has(a.id)) ativar.push(a);
    else if (novo) {
      if (seg === "harmonizacao" || seg === "odonto") ativar.push(a);
      else pausar.push(a);
    } else if (c > 0) manter.push(a);
    else pausar.push(a);
  }
  // cópias adaptadas (de TODA arte genérica, tenha ou não clique; o original com clique não é tocado)
  const chavesUsadas = new Set();
  for (const a of ads) {
    const arte = arteDe(a.name), seg = segDe(a.name);
    const chaveG = arte.replace(/^Novo_(.*)_1080x1350$/, "Novo_$1");
    const f = G[arte] || G[chaveG];
    if (!f || chavesUsadas.has(arte)) continue;
    // só gera cópia a partir da versão "geral" (ou das artes Arte_/Video_ que são do conjunto geral)
    if (seg !== "geral") continue;
    chavesUsadas.add(arte);
    const orig = base.anuncios.find((x) => path.basename(x.arquivo).replace(/\.(png|mp4)$/, "") === arte) ||
      Object.keys(ids.anuncios).filter((k) => k.includes("Novo_")).map((k) => ({ arquivo: k })).find((x) => path.basename(x.arquivo).replace(/_1080x1350\.png$/, "") === arte.replace(/_1080x1350$/, ""));
    if (!orig) { console.log("sem arquivo para", arte); continue; }
    const arqNome = path.basename(orig.arquivo).replace(/\.(png|mp4)$/, "");
    const tipo = orig.arquivo.endsWith(".mp4") ? "video" : "imagem";
    for (const s of SEGS) {
      if (s !== "odonto" && SO_ODONTO.has(arte)) continue;
      const [hook, story, titulo] = f(s);
      const ia = /Novo_ia_/.test(arte);
      copias.push({ conjunto: s, tipo, arquivo: orig.arquivo, chave: `${s}|${arqNome}`, status: "ACTIVE", texto: `${hook}\n\n${story}\n\n${oferta(s, ia)}`, titulo, descricao: "Diagnóstico gratuito de 15 min" });
    }
  }
  fs.writeFileSync(path.join(__dirname, "reorg-anuncios.json"), JSON.stringify({ conjuntos: {}, anuncios: copias }, null, 2));
  fs.writeFileSync(path.join(__dirname, "reorg-status.json"), JSON.stringify({ manter: manter.map((a) => a.name), pausar: pausar.map((a) => a.id), ativar: ativar.map((a) => a.id) }, null, 2));
  console.log({ total: ads.length, manter_com_cliques: manter.length, pausar: pausar.length, ativar_novos: ativar.length, copias_a_criar: copias.length });
  if (modo !== "aplicar") return;

  let n = 0;
  for (const a of pausar) { if (a.effective_status !== "PAUSED") { await graph(a.id, { status: "PAUSED" }); n++; } }
  let m = 0;
  for (const a of ativar) { await graph(a.id, { status: "ACTIVE" }); m++; }
  console.log("pausados:", n, "ativados:", m);
  // conjuntos sem nenhum anúncio ativo restante -> pausar
  const restantes = new Set(manter.map((a) => a.adset_id));
  for (const [k, id] of Object.entries(ids.conjuntos)) {
    if (k === "harmonizacao" || k === "odonto") continue;
    if (!restantes.has(id)) { await graph(id, { status: "PAUSED" }); console.log("conjunto pausado:", k); }
    else console.log("conjunto mantido (tem anúncio com cliques):", k);
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
