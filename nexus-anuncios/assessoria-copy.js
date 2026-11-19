// Campanha "Assessoria de marketing p/ clínicas" (Black Nov+Dez) — 60 criativos de C:\Users\Salvador\Downloads\criativos assesoria de marketing
// Copy no estilo Fernando Miranda (Hook + Story + Offer): gancho contraintuitivo/pergunta, 1ª frase da história confirma o gancho.
// Regras: sem prometer resultado/nº de leads/pacientes, sem inventar caso real, sem preço. Oferta literal dos criativos:
// "30 dias de integração + criação de campanhas grátis", "verba de anúncios à parte". O gancho NÃO repete o título da arte; continua a ideia dela.
// nicho: o = odontologia, h = harmonização facial, e = estética
const PASTA = "C:/Users/Salvador/Downloads/criativos assesoria de marketing/";

const L = [
  ["A proposta que valoriza sua clínica", "e", "A paciente não compara aparelhos. Compara quem explica melhor.", "Quando a apresentação da clínica é só uma lista de procedimentos, o diferencial some. Uma assessoria organiza a proposta, os serviços e as campanhas para contarem a mesma história."],
  ["A próxima conversa da clínica", "e", "A venda não termina quando ela fecha. É aí que começa a próxima conversa.", "Sem alguém cuidando do relacionamento depois da compra, a paciente some até a próxima promoção. Organizar o acompanhamento junto da captação mantém a clínica na lembrança dela."],
  ["Alinhando campanha e recepção", "o", "O anúncio prometeu uma coisa. A recepção respondeu outra.", "É nesse intervalo que o contato esfria. Quando campanha e atendimento falam a mesma língua, quem chega encontra a conversa que o anúncio começou."],
  ["Assessoria Nexus para clínicas odontológicas", "o", "Marketing não termina no clique. Termina na cadeira ocupada.", "Entre o anúncio e a consulta existem confirmação, registro e acompanhamento. Uma assessoria cuida dessa ponte, não só da criação do anúncio."],
  ["Assessoria nexus para clínicas odontológicas(1)", "o", "Paciente que faltou não é só uma cadeira vazia. É um processo que não percebeu.", "Confirmação, registro e próximos passos ligados às campanhas evitam que o interesse gerado se perca na rotina da clínica."],
  ["Autoridade clínica em campanhas consistentes", "h", "Sua clínica é referência. Só falta a comunicação saber disso.", "Formação e estrutura reais precisam aparecer de forma consistente, no anúncio, na página e no atendimento. É esse alinhamento que a assessoria monta."],
  ["Autoridade odontológica em destaque", "o", "Seu concorrente não é melhor. A autoridade dele só está mais visível.", "Muitas clínicas boas comunicam pouco do que as diferencia. Posicionamento e campanhas consistentes colocam seus diferenciais reais na frente de quem pesquisa."],
  ["Campanhas certas para clínicas de estética", "e", "Mais campanha não é o problema. Pública errada é.", "Anunciar para todo mundo dilui a mensagem. Segmentação e critérios de interesse ligados aos serviços prioritários da clínica deixam a campanha falar com quem importa."],
  ["Campanhas conectadas para clínicas odontológicas", "o", "Implante não vende por anúncio. Vende por jornada.", "Do anúncio à página e ao atendimento, cada passo precisa levar ao próximo. Campanha conectada conduz a pessoa até a avaliação."],
  ["Campanhas que atraem demanda qualificada", "h", "Quem tem interesse no seu protocolo não é quem mais clica.", "Público, mensagem e critérios de qualificação alinhados aos serviços prioritários fazem a campanha falar com quem busca exatamente o que a clínica oferece."],
  ["Clareza financeira para clínicas odontológicas", "o", "Você sabe quanto investe em mídia. Sabe quanto custa cada paciente que chega?", "Sem organizar custos e etapas, decidir onde investir mais vira palpite. Ler o investimento junto do atendimento dá contexto para cada decisão."],
  ["Clínicas conectadas, marketing integrado", "e", "O marketing entrega contatos. O comercial guarda a informação que melhora o marketing.", "Quando o retorno do atendimento volta para a campanha, mensagens e ajustes deixam de ser chute. Integrar os dois lados é o trabalho da assessoria."],
  ["Comunicação premium para clínicas de estética", "e", "Seu aparelho é premium. Sua comunicação ficou para depois?", "Equipamento de ponta merece uma apresentação à altura. Serviço explicado com clareza e conectado à campanha mostra o valor antes do primeiro contato."],
  ["Consistência de marca para clínicas em rede", "e", "Cada unidade tem sua campanha. A marca perdeu a unidade.", "Campanhas locais combinadas com direção de marca e leitura de resultados por unidade mantêm a identidade em todas as portas."],
  ["Contexto que conecta sua clínica", "h", "A equipe atende bem. Só não sabe de onde o paciente veio.", "Origem, interesse e próxima ação organizados dão contexto para a conversa continuar de onde o anúncio parou."],
  ["Continuidade de campanhas para clínicas", "o", "Campanha de dezembro acaba. A relação com o paciente não precisa acabar junto.", "Planejar a continuidade das conversas e o acompanhamento além da ação sazonal transforma uma data em relacionamento."],
  ["Continuidade do funil para clínicas", "h", "O anúncio atrai. Quem fecha é quem cuida do que vem depois.", "Páginas, atendimento e próximos passos da equipe planejados junto com as campanhas evitam que o interesse se perca entre o clique e a avaliação."],
  ["Da agenda cheia ao crescimento estruturado", "h", "Agenda cheia não é sinônimo de protocolo fechado.", "Acompanhar o caminho entre interesse, avaliação e proposta, com uma assessoria integrada, mostra onde o paciente deixa de avançar."],
  ["Diretores de clínicas revisam campanhas", "h", "Antes de investir mais, descubra quanto do que já investe se perde no caminho.", "Revisar mensagens, páginas e etapas comerciais antes de ampliar a verba costuma dizer mais do que o próprio orçamento."],
  ["Direção de marketing para clínicas", "h", "Meta por unidade sem direção de marketing é cada uma puxando para um lado.", "Estruturar campanhas e a leitura de resultados por unidade, preservando a identidade da marca, dá uma direção só para todas."],
  ["Estratégia Nexus para clínicas de harmonização", "h", "Mais leads para uma recepção sem processo é só mais fila.", "Antes de ampliar a captação, organize entrada, qualificação e acompanhamento. A assessoria estrutura isso junto da campanha."],
  ["Estratégia comercial para clínicas odontológicas", "o", "A agenda lotou. O mix de tratamentos é o que a clínica quer vender?", "Campanhas por especialidade, ligadas aos objetivos da clínica, evitam encher a agenda com o que não é prioridade."],
  ["Estratégia contínua para clínicas de estética", "e", "Um protocolo tem etapas. O marketing da clínica também deveria ter.", "Planejar campanhas e acompanhamento para explicar a jornada dos serviços ajuda a paciente a entender o caminho completo."],
  ["Estratégia digital para clínicas odontológicas", "o", "Sua clínica é completa. A escolha do paciente nem sempre mostra isso.", "Estrutura, equipe e tratamentos apresentados em páginas conectadas às campanhas explicam a escolha antes da consulta."],
  ["Estratégia laranja para clínicas de estética", "e", "Equipamento novo chegou. A comunicação chegou junto?", "Serviços e diferenciais apresentados com posicionamento e campanhas ligados à operação evitam que o investimento fique parado."],
  ["Estratégia nexus para clínicas odontológicas", "o", "O paciente particular não procura a clínica mais barata. Procura a que encontra.", "Posicionamento, presença local e campanhas alinhadas à atuação da clínica colocam seu trabalho diante de quem pesquisa."],
  ["Estratégia para a próxima fase da clínica", "e", "A clínica cresceu. O marketing continua do tamanho de antes.", "Uma nova fase começa com integração, prioridades claras e um plano para as campanhas, não com mais um post."],
  ["Estratégia sazonal para clínicas de estética", "e", "Black Friday não precisa tirar sua margem. Precisa de plano.", "Comunicação sazonal que preserva posicionamento, prioridades e leitura de resultados evita decidir no susto no meio da data."],
  ["Estratégia sazonal para clínicas de harmonização", "h", "Premium e guerra de preço não combinam. Black Friday também.", "É possível planejar uma comunicação sazonal que preserve seus diferenciais e a proposta de valor da clínica."],
  ["Estratégia sazonal para clínicas odontológicas", "o", "Desconto sem plano não é campanha. É aposta.", "Defina prioridades, mensagens e acompanhamento antes de colocar a campanha no ar. A data passa, o plano continua."],
  ["Estratégia sob medida para clínicas odontológicas", "o", "Alinhadores e implantes não deveriam ter o mesmo anúncio.", "Cada especialidade atrai um interesse diferente. Adaptar mensagens, páginas e campanhas a cada uma dá clareza a quem pesquisa."],
  ["Expansão clínica começa com estratégia", "h", "A próxima expansão sai do painel. Ou do palpite?", "Indicadores de captação e conversão orientam as decisões de marketing com menos achismo."],
  ["Expansão de clínica com assessoria Nexus", "h", "A unidade nova abriu. A demanda ainda não sabe.", "Comunicação local e captação planejadas junto com a abertura ajudam a nova unidade a ser encontrada desde o início."],
  ["Expansão estratégica para clínicas de estética", "e", "Endereço novo não traz paciente sozinho.", "Conecte a abertura da unidade à comunicação local, à captação e ao acompanhamento para a demanda saber onde você está."],
  ["Gestão estratégica para redes odontológicas", "o", "A rede cresceu. O controle por unidade ficou para trás?", "Planejar mídia e acompanhar captação e conversão por unidade, com visão consolidada, devolve o controle ao gestor."],
  ["Imagem forte, processo integrado", "h", "O perfil é bonito. O atendimento acompanha a promessa?", "Conectar conteúdo, campanhas e atendimento dá continuidade ao interesse que a imagem da clínica desperta."],
  ["Integração comercial para clínicas de estética", "e", "O WhatsApp enche. Quem garante que o contato não esfria?", "Contexto, responsáveis e retornos organizados dão continuidade às oportunidades que chegam pelas campanhas."],
  ["Integração comercial para clínicas odontológicas", "o", "Mais leads não significam mais planos de tratamento.", "Conectar a captação à rotina comercial mostra o que acontece depois do contato e onde o interesse se perde."],
  ["Integração estratégica para clínicas de harmonização", "h", "Trocar de agência não precisa começar do zero.", "Uma parceria bem iniciada parte de integração, alinhamento de prioridades e planejamento das campanhas."],
  ["Jornada completa para clínicas de estética", "e", "O clique não é o fim da jornada. É o meio.", "Integrar mensagens, páginas e atendimento ao planejamento de mídia mostra quem acompanha a paciente depois do anúncio."],
  ["Mais cadeiras, mesma lógica de captação", "o", "Ampliar a clínica sem ampliar a lógica de captação é só mais custo fixo.", "Alinhar campanhas, serviços prioritários e atendimento à estrutura da clínica faz a captação acompanhar o crescimento."],
  ["Megafone laranja para campanhas de clínicas", "e", "O Instagram cresce. Os contatos acompanham?", "Conectar conteúdo, campanhas e atendimento acompanha o interesse além da curtida e da interação."],
  ["Megafone laranja, agenda e conexão", "h", "Dezembro movimenta a agenda. E o relacionamento depois?", "Conectar a campanha sazonal ao acompanhamento e aos próximos passos mantém o contato vivo quando a data passa."],
  ["Métricas além da aparência", "e", "O custo do contato caiu. E a qualidade do contato?", "Avaliar o avanço das oportunidades, além do volume e do custo de entrada, mostra se a campanha realmente ajuda a clínica."],
  ["Métricas que movem clínicas odontológicas", "o", "Seu marketing mede clique. A clínica precisa medir tratamento aprovado.", "Acompanhar a jornada entre anúncio, avaliação e plano de tratamento, com critérios claros, mostra o que importa de verdade."],
  ["Nexus conecta clínicas e retomadas", "h", "O orçamento esfriou. E o histórico da conversa ficou onde?", "Alinhar marketing e comercial para organizar contexto, responsáveis e retomadas evita perder quem já demonstrou interesse."],
  ["Nexus_ campanhas para clínicas de harmonização facial", "h", "Full face não combina com campanha genérica.", "Dar contexto aos protocolos e definir uma comunicação coerente com a proposta da clínica atrai quem entende o que está procurando."],
  ["Nexus_ controle do funil odontológico", "o", "Os números existem. Estão só em lugares diferentes.", "Organizar a origem dos contatos e o avanço das etapas apoia decisões de gestão com informação em um só lugar."],
  ["Nexus_ crescimento estratégico para clínicas", "h", "A clínica cresceu. O marketing ainda pensa pequeno.", "Conectar posicionamento, campanhas e atendimento ao estágio atual da clínica evita que a comunicação fique para trás."],
  ["Nexus_ estratégia para clínicas de estética", "e", "Agenda cheia não diz nada sobre margem.", "Relacionar campanhas, serviços prioritários e indicadores orienta o investimento em marketing para o que sustenta a clínica."],
  ["Nexus_ expansão de clínicas odontológicas", "o", "Unidade nova ganha fachada na hora. Demanda local leva mais tempo.", "Planejar presença, comunicação e campanhas para a região da nova unidade acelera o primeiro contato com quem mora perto."],
  ["Nexus_ integração e campanhas para clínicas odontológicas", "o", "Uma assessoria nova só funciona se sua equipe souber integrar.", "Por isso o começo é alinhamento de operação, prioridades e planejamento das primeiras campanhas, antes de qualquer anúncio."],
  ["Nexus_ valor além do preço", "h", "O paciente não quer só o menor preço. Quer entender o valor.", "Apresentar diferenciais reais e alinhar as campanhas ao posicionamento da clínica muda o que ele compara."],
  ["Novos caminhos para a captação clínica", "h", "Indicação é forte. Mas não é a única porta.", "Desenvolver campanhas e presença digital amplia as formas de as pessoas conhecerem sua clínica."],
  ["Plano estratégico para o próximo lançamento", "e", "Um novo serviço sem plano é só uma arte bonita.", "Alinhar posicionamento, campanha e preparação do atendimento antes de apresentar o novo serviço dá ao lançamento um caminho."],
  ["Processo organizado antes do post", "e", "Trocar o post não muda um processo desorganizado.", "Antes da arte, vem a conexão entre posicionamento, campanhas e rotina comercial. A assessoria integra esses pontos."],
  ["Processos que fazem clínicas odontológicas crescerem", "o", "Orçamento alto sem responsável é orçamento que esfria.", "Organizar histórico, próxima ação e acompanhamento dos planos de tratamento apresentados evita que o paciente fique sem retorno."],
  ["Quando o valor fica claro", "e", "O cliente chegou por preço porque o valor não chegou antes.", "Mostrar formação, estrutura e diferenciais da clínica antes da conversa sobre orçamento muda o que a pessoa pergunta primeiro."],
  ["Visibilidade local para clínicas de estética", "e", "Quem busca estética na região encontra o seu diferencial. Ou o do vizinho?", "Páginas e campanhas por intenção de busca, com serviços e localização claros, ajudam a clínica a aparecer para quem procura."],
  ["Visibilidade para sua clínica de harmonização facial", "h", "Quem procura HOF na região precisa encontrar uma clínica. Qual?", "Campanhas por intenção de busca e presença local com informações claras ajudam a sua clínica a entrar na lista."],
];

const NICHO = {
  o: { conjunto: "odonto", pl: "clínicas odontológicas" },
  h: { conjunto: "harmonizacao", pl: "clínicas de harmonização facial" },
  e: { conjunto: "estetica", pl: "clínicas de estética" },
};

const anuncios = L.map(([arq, n, gancho, hist]) => ({
  conjunto: NICHO[n].conjunto,
  tipo: "imagem",
  arquivo: PASTA + arq + ".png",
  texto: `${gancho}\n\n${hist}\n\nA Nexus faz assessoria de marketing para ${NICHO[n].pl}. Neste Black Novembro + Dezembro: 30 dias de integração + criação de campanhas grátis (verba de anúncios à parte).\n\n👉 Toque em *Enviar mensagem* e peça a assessoria para a sua clínica.`,
  titulo: "30 dias de integração grátis",
  descricao: "Criação de campanhas grátis",
}));

module.exports = { anuncios, NICHO };
