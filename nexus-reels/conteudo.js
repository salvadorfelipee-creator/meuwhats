// Conteúdo dos 33 Reels da @nexusssites (posts soltos da pasta "usar esse" virando Reels).
// Regras do projeto: sem preço, sem prometer posição no Google, sem inventar número/caso, falar com o PROFISSIONAL.
// Gera nexus-reels/conteudo.json (índice = ordem alfabética dos PNGs soltos em Downloads/usar esse).
const fs = require("fs");
const path = require("path");

const P = {
  dentistas: {
    nome: "dentistas", busca: "dentista", lugar: "clínica", cliente: "paciente",
    tags: "#sitesparadentistas #marketingodontologico #seolocal #presencadigital #sitesnexus",
    dor: [
      "Quem precisa de um dentista pesquisa no Google antes de ligar. Se a clínica não aparece com clareza, a pessoa escolhe quem aparece.",
      "O paciente compara formação, estrutura e tratamentos antes de agendar. Se isso está só no Instagram, ele não vê.",
      "Boa estrutura e bom atendimento não aparecem sozinhos. Quem decide pela busca só enxerga o que está organizado na internet.",
    ],
  },
  harmonizacao: {
    nome: "profissionais de harmonização facial", busca: "harmonização facial", lugar: "clínica", cliente: "paciente",
    tags: "#harmonizacaofacial #biomedicinaestetica #seolocal #presencadigital #sitesnexus",
    dor: [
      "Quem pensa em harmonização pesquisa, compara perfis e páginas e só depois chama. Se o seu trabalho só existe no feed, ele fica de fora dessa comparação.",
      "O feed atrai, mas é na busca que a pessoa decide. Procedimentos explicados e avaliação clara dão segurança antes do primeiro contato.",
      "Quando a primeira mensagem é só “quanto custa?”, faltou contexto. Um site que mostra formação, avaliação e diferenciais prepara a conversa.",
    ],
  },
  medicos: {
    nome: "médicos", busca: "médico", lugar: "consultório", cliente: "paciente",
    tags: "#sitesparamedicos #marketingmedico #seolocal #presencadigital #sitesnexus",
    dor: [
      "O paciente pesquisa o seu nome antes de marcar. Formação, área de atuação e como agendar precisam estar num lugar que ele encontra.",
      "A indicação traz o contato, mas quem indica não responde as dúvidas. O site responde por você antes da primeira consulta.",
      "Seu currículo é sólido. Se ele não está organizado numa página própria, quem pesquisa nunca chega a conhecê-lo.",
    ],
  },
  psiquiatras: {
    nome: "psiquiatras", busca: "psiquiatra", lugar: "consultório", cliente: "paciente",
    tags: "#sitesparapsiquiatras #psiquiatria #seolocal #presencadigital #sitesnexus",
    dor: [
      "Antes da primeira consulta, a pessoa pesquisa. Ela quer entender como você atende, onde fica e como começar, sem se sentir exposta.",
      "A indicação chega, e a pesquisa vem logo depois. O que o paciente encontra sobre você é o que define se ele agenda.",
      "Linguagem humana e um caminho claro até o primeiro contato valem mais do que um site cheio de recursos.",
    ],
  },
  psicologos: {
    nome: "psicólogos", busca: "psicólogo", lugar: "consultório", cliente: "paciente",
    tags: "#sitesparapsicologos #psicologia #seolocal #presencadigital #sitesnexus",
    dor: [
      "Quem pensa em terapia pesquisa antes de pedir ajuda. Abordagem, modalidades e como funciona o primeiro contato precisam estar fáceis de achar.",
      "Postar todos os dias não pode ser o único caminho até você. Quem pesquisa na sua cidade também precisa te encontrar.",
      "Um site claro e acolhedor faz a pessoa se sentir segura para dar o primeiro passo. Efeito demais pode esconder o que importa.",
    ],
  },
  geral: {
    nome: "profissionais e negócios locais", busca: "seu serviço", lugar: "empresa", cliente: "cliente",
    tags: "#sitesprofissionais #seolocal #presencadigital #marketingdigital #sitesnexus",
    dor: [
      "O cliente digita o serviço e a cidade no Google e escolhe entre os primeiros nomes. Se o seu negócio não está claro lá, ele chama outro.",
      "Seguidor curte. Cliente pesquisa. Sem um lugar próprio que explique o que você faz, a pessoa não vira contato.",
      "Indicação traz quem já conhece você. A busca traz quem ainda não conhece. Um site com conteúdo local abre esse segundo caminho.",
    ],
  },
};

const OPORT = [
  "o cliente já está pesquisando. O que falta é uma página que responda o que ele quer saber.",
  "a busca local ainda pode ser conquistada por quem organiza a presença agora, com conteúdo claro sobre o serviço e a região.",
  "quem pesquisa já tem interesse. Um site bem feito transforma essa busca em conversa.",
];
const URG = [
  "Cada dia sem uma página clara é uma pesquisa que vai para outro nome.",
  "Enquanto você lê isto, alguém na sua cidade está pesquisando o que você faz.",
  "Quanto antes o site estiver no ar, antes ele começa a ser encontrado. SEO é trabalho contínuo, então começar cedo ajuda.",
  "Quem adia continua dependendo só de indicação e de rede social.",
];
const GANCHO2 = [
  "Isso é o que quase ninguém conta sobre ser encontrado no Google. 👇",
  "A pergunta incômoda: o que aparece quando alguém pesquisa você?",
  "Oportunidade que a maioria deixa passar. 👇",
];

// [prof, título do post (gancho e voz), frase curta de apoio para a locução]
const L = [
  ["geral", "Seguidores curtem. Clientes pesquisam.", "Dê ao seu negócio um site que explica, gera confiança e facilita o contato."],
  ["psicologos", "O que o seu link da bio deixa sem resposta?", "Um site apresenta sua abordagem, as modalidades e como funciona o primeiro contato."],
  ["psiquiatras", "O primeiro filtro pode acontecer antes da consulta.", "Ao pesquisar seu nome, a pessoa precisa entender sua formação e seu atendimento."],
  ["geral", "Indicação é boa. Ser encontrado também.", "Um site pensado para quem procura seu serviço na sua cidade."],
  ["medicos", "3 respostas antes de marcar uma consulta.", "Quem é o médico, onde e como atende, e como solicitar agendamento."],
  ["geral", "As portas vão abrir. Seu site também?", "Apresente seu negócio, seus serviços e seu endereço desde o primeiro dia."],
  ["harmonizacao", "Seu nome inspira confiança. A busca mostra isso?", "Site para harmonização facial com apresentação profissional e foco em busca local."],
  ["geral", "Quem procura na sua cidade encontra sua empresa?", "Sites com foco em SEO local para ampliar sua presença no Google."],
  ["medicos", "O que seu paciente precisa descobrir antes de ligar?", "Um site que explica atendimento, localização e próximos passos prepara o primeiro contato."],
  ["medicos", "Fora do consultório, quem apresenta você?", "Formação, atuação e contato em um só lugar."],
  ["psiquiatras", "A indicação chega. A pesquisa vem depois?", "Perfil profissional completo, primeira consulta explicada e contato organizado."],
  ["geral", "Negócio novo. Presença profissional.", "Sua empresa bem apresentada, com endereço e rota fáceis de achar."],
  ["geral", "Seu serviço. Sua cidade. Um site preparado.", "Uma página para cada serviço e conteúdo relevante para a sua região."],
  ["psicologos", "Seu trabalho acolhe. Sua presença digital também?", "Um site claro para apresentar sua abordagem e facilitar o primeiro contato."],
  ["harmonizacao", "Seu feed atrai. O que convence fora dele?", "Um site organiza procedimentos, diferenciais e dúvidas antes da avaliação."],
  ["dentistas", "Quem procura um dentista precisa achar você.", "Site odontológico com foco em SEO local e contato fácil."],
  ["medicos", "Você atende a região. Sua presença online também?", "Site médico com conteúdo relevante para a cidade onde você atende."],
  ["medicos", "O currículo é seu. O site valoriza essa trajetória?", "Formação com clareza, áreas de atuação organizadas e contato à mão."],
  ["dentistas", "Seu consultório mudou. Seu site ficou para trás?", "Reunimos equipe, estrutura e serviços em um site à altura da sua clínica."],
  ["harmonizacao", "Um site genérico pode esconder seu diferencial.", "Apresente sua forma de trabalhar em páginas feitas para a sua clínica."],
  ["geral", "Menos dúvidas. Contatos mais preparados.", "Seu serviço explicado em etapas e um formulário para entender a demanda."],
  ["psiquiatras", "Um site de psiquiatria precisa explicar antes de impressionar.", "Linguagem humana e caminho claro para o primeiro contato."],
  ["psicologos", "Postar todos os dias é o único caminho até você?", "Um site com foco em busca local amplia sua presença além das redes."],
  ["dentistas", "Seu próximo paciente pode não saber seu nome.", "Sites para dentistas com foco em quem pesquisa tratamento e cidade."],
  ["geral", "Antes de perguntar o preço, o cliente precisa entender o valor.", "Um site que apresenta seus diferenciais e prepara uma conversa melhor."],
  ["psicologos", "Quem pensa em terapia entende como você trabalha?", "Seu site pode apresentar abordagem, público atendido e funcionamento das sessões."],
  ["psiquiatras", "3 informações para um primeiro contato mais claro.", "Como funciona a primeira consulta, onde acontece o atendimento e como agendar."],
  ["harmonizacao", "Da curtida à avaliação: qual é o caminho?", "Seu perfil, seu site e o contato precisam estar conectados."],
  ["psiquiatras", "Depois da indicação, o que encontram sobre você?", "Um site com seu perfil profissional, a consulta explicada e contato fácil."],
  ["harmonizacao", "3 respostas para acompanhar seu portfólio.", "Quem é o profissional, como é feita a avaliação e como solicitar atendimento."],
  ["psicologos", "Um site cheio de efeitos pode esconder o que mais importa.", "Sua abordagem, quem você atende e como começar precisam aparecer com clareza."],
  ["dentistas", "Ser indicado é ótimo. E quem pesquisa sem indicação?", "Um site com foco em SEO local amplia os caminhos até o seu consultório."],
  ["psicologos", "3 respostas para quem ainda não sabe por onde começar.", "Quem você atende, como funcionam as sessões e como entrar em contato."],
];

function legenda(i, [prof, titulo]) {
  const p = P[prof];
  const lugarTxt = prof === "geral" ? "seu negócio" : `sua ${p.lugar}`;
  const buscaTxt = prof === "geral" ? "o serviço que você oferece" : p.busca;
  const g2 = GANCHO2[i % GANCHO2.length];
  const dor = p.dor[i % p.dor.length];
  const op = OPORT[(i + 1) % OPORT.length];
  const urg = URG[i % URG.length];
  return [
    `${titulo}\n${g2}`,
    dor,
    `🔎 Teste de 30 segundos: pesquise “${buscaTxt} + sua cidade” no Google e veja o que aparece. Se você não encontra ${lugarTxt} com clareza, seu ${p.cliente} também não.`,
    `💡 A oportunidade: ${op}`,
    `O que a Nexus organiza no seu site:\n✅ uma página para cada serviço, explicado com clareza\n✅ conteúdo pensado para a busca da sua região (SEO local)\n✅ informações do Perfil da Empresa no Google e contato fácil`,
    `Ninguém controla a posição no Google, e SEO exige trabalho contínuo. Mas dá para deixar ${lugarTxt} mais fácil de entender e de encontrar.`,
    `⏳ ${urg}`,
    `👉 Peça o diagnóstico gratuito de 15 minutos: toque no link da bio e chame no WhatsApp. O Felipe mostra como ${lugarTxt} aparece hoje no Google e o que ajustar.`,
    `🔖 Salve este Reels e envie para quem precisa ver.`,
    p.tags,
  ].join("\n\n");
}

const itens = L.map((x, i) => {
  const [prof, titulo, apoio] = x;
  const num = String(i + 1).padStart(2, "0");
  return {
    n: i + 1, arquivo: `post_${num}.png`, video: `reel_${num}.mp4`, publico: prof, titulo, apoio,
    voz: `${titulo} ${apoio} Peça o diagnóstico gratuito no link da bio.`,
    legenda: legenda(i, x),
  };
});
fs.writeFileSync(path.join(__dirname, "conteudo.json"), JSON.stringify(itens, null, 2));
console.log(itens.length, "reels; maior legenda:", Math.max(...itens.map((x) => x.legenda.length)), "caracteres");
