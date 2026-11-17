// Lote 2 (17/11/2026): artes da pasta "usar esse/parte 2", foco em Google/busca local, nos 3 públicos que geraram conversa.
// Copy = Hook + Story + Offer (mesmo estilo do campanha.js). Sem preço, sem prometer posição no Google, fala com o PROFISSIONAL.
// Rodar: node nexus-anuncios/novos-anuncios.js  -> gera novos-anuncios.json (e copia as artes p/ nexus-assets/img)
// Depois: node --env-file=.env nexus-anuncios/criar-campanha.js --spec novos-anuncios.json
const fs = require("fs");
const path = require("path");
const SRC = "C:/Users/Salvador/Downloads/usar esse/parte 2";
const DST = "C:/Users/Salvador/Documents/nexus-assets/img";

const PL = { harmonizacao: "profissionais de harmonização facial", odonto: "dentistas", geral: "profissionais e negócios locais" };
const oferta = (seg) => `A Sites Nexus cria o site de ${PL[seg]} com foco em busca local e contato direto.\n\n👉 Toque em *Enviar mensagem* e peça o diagnóstico gratuito de 15 minutos: o Felipe mostra como sua empresa aparece hoje no Google e o que ajustar.`;

// [conjunto, arquivo na parte 2, nome ASCII, gancho, história, título]
const L = [
  ["harmonizacao", "Site para biomédicos estetas.png", "Novo_harm_busca_regiao", "Quem pesquisa estética na sua cidade chega até você?", "Antes de pedir uma avaliação, a pessoa pesquisa no Google e compara páginas. Um site com os procedimentos explicados e conteúdo da sua região coloca sua clínica nessa comparação.", "Seja encontrada na sua região"],
  ["harmonizacao", "Sites para biomédicos estetas.png", "Novo_harm_formacao_agenda", "Você investiu na formação. Quem sabe disso fora do Instagram?", "Formação, forma de avaliar e procedimentos precisam estar num lugar que a pessoa encontra pela busca, e não só no feed.", "Sua formação à vista"],
  ["harmonizacao", "Site profissional para biomédicos estetas(1).png", "Novo_harm_sem_indicacao", "Se ninguém indicar esta semana, quem encontra você?", "Indicação é ótima, mas você não controla quando vem. A busca no Google é o segundo caminho: quem pesquisa harmonização perto de casa precisa achar seu perfil, seus procedimentos e como chamar.", "Um caminho além da indicação"],
  ["harmonizacao", "Site profissional para biomédicos estetas.png", "Novo_harm_tabela_precos", "Seu WhatsApp virou uma tabela de preços?", "Quando a primeira mensagem é só \"quanto custa?\", falta contexto. Um site que apresenta formação, avaliação e diferenciais prepara a conversa antes do pedido de orçamento.", "Conversas com mais contexto"],
  ["harmonizacao", "Sua empresa além do Instagram.png", "Novo_harm_instagram_sumisse", "Se o Instagram sumisse amanhã, como encontrariam sua clínica?", "Seu perfil não é um endereço seu. Um site próprio, com páginas de procedimento e presença no Google, é um lugar que você controla.", "Um endereço só seu"],
  ["harmonizacao", "Sua empresa, mais visível no Google.png", "Novo_harm_google_sabe", "Sua clínica é boa. O Google sabe disso?", "O Google só mostra o que consegue entender: serviços, cidade, contato. Um site bem estruturado conta isso por você.", "Faça o Google entender sua clínica"],

  ["odonto", "Anúncio Nexus_ sites para dentistas.png", "Novo_odonto_preco_somem", "Perguntam o preço e somem?", "Quem só vê o valor compara com o mais barato. Um site que explica tratamentos, estrutura e diferenciais antes da conversa muda o tipo de pergunta que chega.", "Conversas melhores antes do preço"],
  ["odonto", "Site odontológico Nexus para sua clínica.png", "Novo_odonto_cadeira_agenda", "A cadeira está pronta. E a agenda?", "Boa estrutura não aparece sozinha. Quem procura dentista na região pesquisa no Google antes de ligar, e fala com quem encontra.", "Sua clínica na busca da região"],
  ["odonto", "Site para dentistas_ cliques viram contatos.png", "Novo_odonto_paga_clique", "Você paga pelo clique. E o contato, onde está?", "Anúncio sem página clara joga verba fora. Uma página com tratamentos, localização e botão de WhatsApp continua a conversa que o anúncio começou.", "Uma página para seus anúncios"],
  ["odonto", "Site profissional para dentistas.png", "Novo_odonto_particular", "Por que um paciente particular escolheria sua clínica?", "Ele compara formação, estrutura e tratamentos antes de agendar. Um site profissional responde isso por você e mostra o que te diferencia.", "Mostre o que diferencia sua clínica"],
  ["odonto", "Busca local para negócios encontrados.png", "Novo_odonto_encontra_outra", "Quem não encontra sua clínica encontra outra.", "A pessoa pesquisa \"dentista perto de mim\", abre as primeiras opções e escolhe. Um site com SEO local aumenta as chances de a sua estar entre elas.", "Apareça quando procuram dentista"],
  ["odonto", "A primeira impressão no Google.png", "Novo_odonto_primeira_impressao", "Seu paciente pesquisa você. O que ele encontra?", "Antes da primeira mensagem, ele busca seu nome. Se encontra só um perfil de rede social, falta um lugar que explique seu trabalho.", "A primeira impressão no Google"],

  ["geral", "Seu negócio visível no Google.png", "Novo_geral_quem_procura", "Quem procura seu serviço encontra você?", "O cliente digita o serviço e a cidade no Google e escolhe entre os primeiros nomes. Um site com conteúdo local ajuda seu negócio a entrar nessa lista.", "Seja encontrado na sua cidade"],
  ["geral", "Seu negócio em destaque nas buscas.png", "Novo_geral_concorrente_aparece", "Seu concorrente aparece. E você?", "Muitas vezes ele não é melhor que você, só está mais fácil de achar. Um site que explica seu serviço e facilita o contato reduz essa diferença.", "Seja fácil de achar"],
  ["geral", "Mostre o valor da sua empresa.png", "Novo_geral_valor_explicado", "Seu preço parece alto ou seu valor está mal explicado?", "Quando o cliente não entende o que está incluso, só enxerga o preço. Um site que mostra serviços e diferenciais muda a conversa antes do orçamento.", "Mostre o valor do seu trabalho"],
  ["geral", "Sua região encontra você_.png", "Novo_geral_regiao_procura", "Sua região procura. Encontra você?", "Todo dia alguém na sua cidade busca o serviço que você oferece. Site, conteúdo local e informações claras trabalham juntos para você ser achado.", "Sua região procura você"],
  ["geral", "Uma busca pode virar cliente.png", "Novo_geral_busca_cliente", "Seu próximo cliente pode vir de uma busca.", "Quem pesquisa já tem interesse. Falta um lugar claro para ele entender seu serviço e dar o próximo passo.", "De uma busca para uma conversa"],
  ["geral", "Sua empresa, mais fácil de encontrar.png", "Novo_geral_indicacao_encontrado", "Indicação é ótima. Ser encontrado também.", "A indicação traz o contato. A busca traz quem ainda não conhece você. Um site com SEO local abre esse segundo caminho.", "Indicação e busca juntas"],
];

fs.mkdirSync(DST, { recursive: true });
const anuncios = L.map(([seg, arq, nome, hook, story, titulo]) => {
  const dest = `${DST}/${nome}_1080x1350.png`;
  fs.copyFileSync(`${SRC}/${arq}`, dest);
  return { conjunto: seg, tipo: "imagem", arquivo: dest, texto: `${hook}\n\n${story}\n\n${oferta(seg)}`, titulo, descricao: "Diagnóstico gratuito de 15 min", angulo: "google" };
});
fs.writeFileSync(path.join(__dirname, "novos-anuncios.json"), JSON.stringify({ conjuntos: {}, anuncios }, null, 2));
console.log(anuncios.length, "anúncios");
