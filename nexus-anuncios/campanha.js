// Plano da campanha Nexus (teste 16/11 a 19/11/2026). Gera campanha-nexus.json + PLANO-CAMPANHA.md.
// Copy no estilo Hook + Story + Offer (Fernando Miranda). Regras: sem preço, sem prometer posição no Google,
// sem alegação de saúde, fala sempre com o PROFISSIONAL (dono do negócio), nunca com o paciente.
// Rodar: node nexus-anuncios/campanha.js
const fs = require("fs");
const path = require("path");
const ASSETS = "C:/Users/Salvador/Documents/nexus-assets";

const SEG = {
  odonto: { nome: "Odontologia", pl: "dentistas", prof: "dentista", cli: "clínica odontológica", cliente: "paciente", busca: "dentista perto de mim", lugar: "consultório" },
  medicina: { nome: "Medicina", pl: "médicos", prof: "médico", cli: "consultório médico", cliente: "paciente", busca: "médico especialista na minha cidade", lugar: "consultório" },
  psicologia: { nome: "Psicologia", pl: "psicólogas e psicólogos", prof: "psicólogo", cli: "consultório de psicologia", cliente: "paciente", busca: "psicólogo online ou perto de mim", lugar: "consultório" },
  psiquiatria: { nome: "Psiquiatria", pl: "psiquiatras", prof: "psiquiatra", cli: "consultório de psiquiatria", cliente: "paciente", busca: "psiquiatra na minha cidade", lugar: "consultório" },
  harmonizacao: { nome: "Harmonização facial", pl: "profissionais de harmonização facial", prof: "profissional", cli: "clínica de harmonização", cliente: "paciente", busca: "harmonização facial perto de mim", lugar: "clínica" },
  geral: { nome: "Profissionais liberais e negócios locais", pl: "profissionais e negócios locais", prof: "empresário", cli: "negócio", cliente: "cliente", busca: "o serviço que você oferece na sua cidade", lugar: "negócio" },
};

// 6 ângulos = o tema que cada arte já mostra. Cada um: gancho (1ª linha) + história + oferta/CTA.
const ANG = {
  indicacao: (s) => ({
    hook: `A melhor indicação do mundo termina no Google.`,
    story: `Antes de chamar, o ${s.cliente} pesquisa seu nome. Se não acha formação, atendimento e contato em um só lugar, a indicação esfria e ele segue para o próximo da lista.`,
    titulo: "Indicação + ser encontrado",
  }),
  busca: (s) => ({
    hook: `Quem pesquisa "${s.busca}" vê poucos nomes. O seu está entre eles?`,
    story: `A decisão começa na busca, antes de qualquer mensagem. Um site com conteúdo da sua cidade e contato direto coloca você nessa conversa.`,
    titulo: "Seja encontrado na sua cidade",
  }),
  esclarece: (s) => ({
    hook: `O ${s.cliente} decide antes de chamar. E você nem fica sabendo.`,
    story: `Ele lê, compara e só então manda mensagem. Um site que explica como é o atendimento, onde fica e como agendar já responde isso por você.`,
    titulo: "Responda antes da primeira conversa",
  }),
  tres: (s) => ({
    hook: `3 respostas que seu site precisa dar antes da primeira conversa.`,
    story: `Quem é você, onde e como atende, e como solicitar um horário. Quando essas três respostas estão claras, o contato chega mais preparado.`,
    titulo: "3 respostas que seu site precisa dar",
  }),
  renova: (s) => ({
    hook: `Seu trabalho evoluiu. Seu site ficou parado no tempo?`,
    story: `Equipe, estrutura e forma de atender mudam. O site precisa acompanhar para mostrar o ${s.lugar} que você tem hoje, com identidade própria e não com um modelo genérico.`,
    titulo: "Seu site à altura do seu trabalho",
  }),
  feed: (s) => ({
    hook: `Seu Instagram atrai. O que convence fora dele?`,
    story: `Postar todo dia não pode ser o único caminho até você. Um site reúne seus serviços, sua forma de trabalhar e o próximo passo em um lugar que o ${s.cliente} encontra pela busca.`,
    titulo: "Vá além do feed",
  }),
};

function copy(segKey, ang) {
  const s = SEG[segKey];
  const a = ANG[ang](s);
  const oferta = `A Sites Nexus cria o site de ${s.pl} com foco em busca local e contato direto.\n\n👉 Toque em *Enviar mensagem*, conte sua área e agende um diagnóstico gratuito de 15 minutos com o Felipe.`;
  return { texto: `${a.hook}\n\n${a.story}\n\n${oferta}`, titulo: a.titulo, descricao: "Diagnóstico gratuito de 15 min" };
}

// Ganchos dos vídeos (já escritos no próprio vídeo; o texto do anúncio só reforça e fecha com CTA)
const VID = {
  Nexus_Odontologia_V1_visibilidade: ["odonto", "Seu concorrente está recebendo seus pacientes?", "Quando o paciente pesquisa, a escolha acontece antes de qualquer mensagem. Veja como aparecer nessa busca."],
  Nexus_Odontologia_V2_visibilidade: ["odonto", "O paciente busca. Quem ele encontra?", "Google e inteligência artificial já respondem 'qual clínica atende perto de mim'. Sua clínica entra nessa resposta?"],
  Nexus_Odontologia_V3_visibilidade: ["odonto", "Por que ele aparece antes da sua clínica?", "A ordem da busca muda quem recebe a primeira mensagem. Entenda o que fazer para ser encontrado."],
  Nexus_Odontologia_V4_visibilidade: ["odonto", "O paciente busca. Quem ele encontra?", "A escolha começa na pesquisa. Veja como sua clínica pode aparecer quando alguém procura por dentista."],
  Nexus_Odontologia_agenda_vazia: ["odonto", "Dentista, horários vazios?", "Quem procura tratamento pesquisa antes de chamar. Um site profissional com contato direto ajuda a transformar essa busca em conversa."],
  Nexus_Harmonizacao_V1_WhatsApp: ["harmonizacao", "Por que escolhem a outra clínica?", "Quem procura harmonização facial pode estar encontrando outras clínicas antes de conhecer a sua. A escolha começa na busca."],
  Nexus_Harmonizacao_V2_WhatsApp: ["harmonizacao", "Sua agenda depende de indicação?", "Quando as indicações diminuem, a agenda sente. Há pessoas procurando harmonização na sua região. Elas encontram você?"],
  Nexus_Harmonizacao_V3_WhatsApp: ["harmonizacao", "Sua clínica sumiu do Google?", "Ser encontrada no Google, nas buscas com IA e no Google Meu Negócio é o primeiro passo para abrir novas conversas."],
  Nexus_Harmonizacao_V4_WhatsApp: ["harmonizacao", "Quantas avaliações você perdeu hoje?", "Quem já procura seus procedimentos precisa achar você. Veja por onde começar."],
  Video_01_indicacao_1080x1920: ["geral", "Só entra cliente por indicação?", "Seu negócio pode abrir outro caminho: um site feito para ser encontrado e facilitar o contato."],
  Video_02_instagram_1080x1920: ["geral", "Seguidores curtem. Clientes pesquisam.", "Do link da bio ao pedido de orçamento: dê ao cliente um lugar para conhecer seu trabalho."],
  Video_03_inauguracao_1080x1920: ["geral", "As portas vão abrir. Seu site também?", "Quem ouvir seu nome vai procurar você antes de visitar. Esteja pronto desde o primeiro dia."],
  Video_04_google_1080x1920: ["geral", "Quem procura na sua cidade encontra sua empresa?", "Um site com foco em busca local e contato fácil prepara seu negócio para ser encontrado."],
  Video_05_qualificacao_1080x1920: ["geral", "Antes de perguntar o preço, o cliente precisa entender o valor.", "Um site que explica seus serviços e diferenciais prepara uma conversa melhor."],
};

// Imagens: arquivo -> [segmento, ângulo]
const IMG = {
  Nexus_odontologia_01_1080x1350: ["odonto", "busca"],
  Nexus_odontologia_03_1080x1350: ["odonto", "indicacao"],
  Nexus_odontologia_05_1080x1350: ["odonto", "renova"],
  Nexus_Estilo_01_odontologia_editorial_1080x1350: ["odonto", "busca"],
  Nexus_medicina_03_1080x1350: ["medicina", "busca"],
  Nexus_medicina_04_1080x1350: ["medicina", "tres"],
  Nexus_medicina_05_1080x1350: ["medicina", "esclarece"],
  Nexus_medicina_21_trajetoria_1080x1350: ["medicina", "renova"],
  Nexus_Estilo_03_medicina_jornal_1080x1350: ["medicina", "esclarece"],
  Nexus_psicologia_01_1080x1350: ["psicologia", "esclarece"],
  Nexus_psicologia_02_1080x1350: ["psicologia", "feed"],
  Nexus_psicologia_03_1080x1350: ["psicologia", "feed"],
  Nexus_psicologia_04_1080x1350: ["psicologia", "tres"],
  Nexus_psicologia_05_1080x1350: ["psicologia", "renova"],
  Nexus_Estilo_05_psicologia_ilustracao_1080x1350: ["psicologia", "renova"],
  Nexus_psiquiatria_01_1080x1350: ["psiquiatria", "esclarece"],
  Nexus_psiquiatria_02_1080x1350: ["psiquiatria", "indicacao"],
  Nexus_psiquiatria_03_1080x1350: ["psiquiatria", "busca"],
  Nexus_psiquiatria_04_1080x1350: ["psiquiatria", "tres"],
  Nexus_psiquiatria_05_1080x1350: ["psiquiatria", "renova"],
  Nexus_Estilo_04_psiquiatria_navegacao_1080x1350: ["psiquiatria", "indicacao"],
  Nexus_harmonizacao_01_1080x1350: ["harmonizacao", "feed"],
  Nexus_harmonizacao_03_1080x1350: ["harmonizacao", "busca"],
  Nexus_harmonizacao_04_1080x1350: ["harmonizacao", "tres"],
  Nexus_harmonizacao_05_1080x1350: ["harmonizacao", "renova"],
  Nexus_Estilo_02_harmonizacao_colagem_1080x1350: ["harmonizacao", "feed"],
  Arte_01_indicacao_tipografico_1080x1350: ["geral", "indicacao"],
  Arte_03_instagram_tipografico_1080x1350: ["geral", "feed"],
  Arte_05_inauguracao_tipografico_1080x1350: ["geral", "renova"],
  Arte_06_inauguracao_infografico_1080x1350: ["geral", "tres"],
  Arte_07_google_tipografico_1080x1350: ["geral", "busca"],
  Arte_08_google_infografico_1080x1350: ["geral", "busca"],
  Arte_09_qualificacao_tipografico_1080x1350: ["geral", "esclarece"],
  Arte_10_qualificacao_infografico_1080x1350: ["geral", "tres"],
};

// Públicos (Brasil inteiro no teste). Cargo/interesse = quem É o profissional; o anúncio fala com ele.
const CONJUNTOS = {
  odonto: { orcamentoDia: 15, idade: [25, 55], generos: "todos", cargos: ["Dentista", "Cirurgião-dentista", "Odontologia", "Ortodontia", "Implantodontia"], nota: "Dono de clínica odontológica tem faixa ampla; todos os gêneros." },
  medicina: { orcamentoDia: 10, idade: [28, 60], generos: "todos", cargos: ["Médico", "Medicina", "Clínico geral", "Dermatologia", "Ginecologia"], nota: "Médicos autônomos/consultório próprio; 28+ pela formação." },
  psicologia: { orcamentoDia: 10, idade: [25, 55], generos: "todos", cargos: ["Psicólogo", "Psicologia", "Psicoterapia", "Terapia cognitivo-comportamental"], nota: "Categoria majoritariamente feminina, mas sem restringir: o algoritmo aprende." },
  psiquiatria: { orcamentoDia: 10, idade: [28, 60], generos: "todos", cargos: ["Psiquiatra", "Psiquiatria", "Medicina", "Saúde mental"], nota: "Formação longa; 28+." },
  harmonizacao: { orcamentoDia: 15, idade: [25, 50], generos: "mulheres", cargos: ["Harmonização facial", "Estética avançada", "Biomédico", "Cirurgião-dentista", "Esteticista"], nota: "Público dominado por mulheres; começa só mulheres e abre se o custo por conversa ficar alto." },
  geral: { orcamentoDia: 15, idade: [28, 55], generos: "todos", cargos: ["Arquiteto", "Advogado", "Contador", "Designer de interiores", "Autônomo", "Pequenas empresas", "Empreendedorismo"], nota: "Mensagens abertas para profissionais liberais e donos de negócios locais; inclui arquitetos." },
};

const ads = [];
for (const [arq, [seg, ang]] of Object.entries(IMG)) {
  const c = copy(seg, ang);
  ads.push({ conjunto: seg, tipo: "imagem", arquivo: `${ASSETS}/img/${arq}.png`, ...c, angulo: ang });
}
for (const [arq, [seg, gancho, apoio]] of Object.entries(VID)) {
  const s = SEG[seg];
  const texto = `${gancho}\n\n${apoio}\n\nA Sites Nexus cria o site de ${s.pl} com foco em busca local e contato direto.\n\n👉 Toque em *Enviar mensagem* e agende um diagnóstico gratuito de 15 minutos com o Felipe.`;
  ads.push({ conjunto: seg, tipo: "video", arquivo: `${ASSETS}/vid/${arq}.mp4`, texto, titulo: gancho.length <= 40 ? gancho : "Seja encontrado na sua cidade", descricao: "Diagnóstico gratuito de 15 min", angulo: "video" });
}

const out = {
  campanha: { nome: "Nexus | Mensagens WhatsApp | Teste 16-19/11", objetivo: "OUTCOME_ENGAGEMENT (conversas no WhatsApp)", inicio: "2026-11-16", fim: "2026-11-19 23:59", status: "PAUSED" },
  whatsapp: { numero: "+55 47 3180-4984", phone_number_id: "1512976205221650", mensagemPronta: "Oi! Vi o anúncio e quero saber mais sobre o site." },
  cta: "WHATSAPP_MESSAGE (Enviar mensagem)",
  conjuntos: Object.fromEntries(Object.entries(CONJUNTOS).map(([k, v]) => [k, { ...v, nome: SEG[k].nome, anuncios: ads.filter((a) => a.conjunto === k).length }])),
  anuncios: ads,
};
fs.writeFileSync(path.join(__dirname, "campanha-nexus.json"), JSON.stringify(out, null, 2));

let md = `# Campanha Nexus — teste 16/11 a 19/11/2026\n\nObjetivo: conversas no WhatsApp (+55 47 3180-4984). Tudo nasce **pausado**.\n\n`;
let total = 0;
for (const [k, v] of Object.entries(out.conjuntos)) {
  total += v.orcamentoDia;
  md += `## ${v.nome} — R$ ${v.orcamentoDia}/dia — ${v.anuncios} anúncios\nIdade ${v.idade[0]}–${v.idade[1]} · ${v.generos} · Brasil · cargos/interesses: ${v.cargos.join(", ")}\n_${v.nota}_\n\n`;
}
md += `**Total: R$ ${total}/dia × 4 dias ≈ R$ ${total * 4}** (${ads.length} anúncios).\n\n---\n\n`;
for (const a of ads) md += `### [${a.conjunto}] ${path.basename(a.arquivo)}\n**Título:** ${a.titulo} · **Descrição:** ${a.descricao}\n\n${a.texto}\n\n`;
fs.writeFileSync(path.join(__dirname, "PLANO-CAMPANHA.md"), md);
console.log(ads.length, "anúncios;", "R$/dia", total);
