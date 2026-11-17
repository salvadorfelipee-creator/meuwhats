// Lote 3 (17/11/2026): artes "ChatGPT / presença nas IAs" da pasta "usar esse/parte 2", nos mesmos 3 públicos do lote 2.
// Regra: ninguém controla o que a IA responde. Nunca prometer ser citado/indicado; dizer que conteúdo claro ajuda a IA a entender o negócio.
// Rodar: node nexus-anuncios/novos-anuncios-ia.js ; depois: node --env-file=.env nexus-anuncios/criar-campanha.js --spec novos-anuncios-ia.json
const fs = require("fs");
const path = require("path");
const SRC = "C:/Users/Salvador/Downloads/usar esse/parte 2";
const DST = "C:/Users/Salvador/Documents/nexus-assets/img";
const PL = { harmonizacao: "profissionais de harmonização facial", odonto: "dentistas", geral: "profissionais e negócios locais" };
const oferta = (seg) => `A Sites Nexus cria o site de ${PL[seg]} com foco em busca local e contato direto.\n\n👉 Toque em *Enviar mensagem* e peça o diagnóstico gratuito de 15 minutos: o Felipe mostra como sua empresa aparece hoje no Google e o que organizar para as IAs também entenderem seu negócio.`;

const L = [
  ["harmonizacao", "Seu site nas buscas com IA.png", "Novo_ia_harm_pergunta_chatgpt", "Se o cliente perguntar ao ChatGPT, sua clínica aparece?", "Cada vez mais gente pergunta à IA antes de escolher. Ninguém controla a resposta, mas um site com procedimentos, região e contato claros dá à IA o que ler sobre a sua clínica.", "Sua clínica também nas buscas com IA"],
  ["harmonizacao", "Pergunta ao ChatGPT, contato com Nexus.png", "Novo_ia_harm_antes_whatsapp", "Antes do WhatsApp, pode vir uma pergunta ao ChatGPT.", "A pessoa pergunta quem faz harmonização na cidade e só depois chama. Um site claro ajuda a construir esse caminho, da pergunta ao contato.", "Da pergunta ao contato"],
  ["odonto", "Nexus no chat, presença digital em destaque.png", "Novo_ia_odonto_concorrente_citado", "Seu concorrente pode ser citado. E você?", "Quem pergunta à IA qual clínica atende na região recebe poucos nomes. Um site com tratamentos, localização e contato organizados ajuda a IA a entender o que você faz.", "Prepare sua clínica para as IAs"],
  ["odonto", "ChatGPT destaca a presença digital.png", "Novo_ia_odonto_o_que_citar", "O ChatGPT tem o que citar sobre sua clínica?", "Sem páginas claras sobre seus serviços e sua região, a IA não tem o que ler. Conteúdo de serviço e site acessível dão contexto à sua presença digital.", "Dê o que citar sobre sua clínica"],
  ["geral", "Nexus no chat do ChatGPT.png", "Novo_ia_geral_proximo_cliente", "Seu próximo cliente pode perguntar ao ChatGPT.", "Ele pergunta como escolher uma empresa do seu ramo. Mostre o que você faz, onde atende e por que vale conhecer, em um site que a IA e a pessoa consigam entender.", "Seja fácil de conhecer"],
  ["geral", "Nexus em uma conversa com a IA.png", "Novo_ia_geral_marca_conversa", "A IA responde. Sua marca entra na conversa?", "Ninguém garante a resposta de uma IA, mas serviços, região e contato bem explicados em um site aumentam suas chances de ser compreendido.", "Amplie sua presença nas IAs"],
];

const anuncios = L.map(([seg, arq, nome, hook, story, titulo]) => {
  const dest = `${DST}/${nome}_1080x1350.png`;
  fs.copyFileSync(`${SRC}/${arq}`, dest);
  return { conjunto: seg, tipo: "imagem", arquivo: dest, texto: `${hook}\n\n${story}\n\n${oferta(seg)}`, titulo, descricao: "Diagnóstico gratuito de 15 min", angulo: "ia" };
});
fs.writeFileSync(path.join(__dirname, "novos-anuncios-ia.json"), JSON.stringify({ conjuntos: {}, anuncios }, null, 2));
console.log(anuncios.length, "anúncios");
