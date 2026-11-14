// 10 avatares x 5 ângulos. Cada ângulo: frase (formato A) + título e 3 pontos (formato B).
// Ordem dos ângulos: dor, resultado, prova, mecanismo, benefício.
const ANGULOS = ["dor", "resultado", "prova", "mecanismo", "beneficio"];

const PRODUTOS = {
  p1: {
    nome: "Site de posicionamento",
    avatares: [
      {
        id: "a1", nome: "Vive de indicação", view: "site",
        angulos: {
          dor: { f: "Sua agenda só enche quando alguém lembra de te indicar.", t: "3 sinais de que você depende de indicação", b: ["Mês bom, mês fraco, sem explicação", "Ninguém te acha pesquisando", "Novo paciente quase sempre é conhecido"] },
          resultado: { f: "Paciente novo chegando todo mês, sem depender de indicação.", t: "O que muda com um site que é encontrado", b: ["Quem busca na sua cidade te encontra", "Contato novo sem pedir favor", "Agenda mais previsível"] },
          prova: { f: "Veja como fica o site de uma clínica pensado para ser achado na cidade.", t: "Um site de clínica, por dentro", b: ["Página para cada procedimento", "Botão de WhatsApp em todas as páginas", "Mapa, horários e avaliações"] },
          mecanismo: { f: "Uma página para cada procedimento, feita para quem pesquisa “dentista em [sua cidade]”.", t: "Como o site traz paciente", b: ["1. Uma página por procedimento", "2. Texto pensado para a busca da cidade", "3. Botão que chama direto no WhatsApp"] },
          beneficio: { f: "Uma agenda que não oscila com a sorte.", t: "O que você ganha", b: ["Presença própria no Google", "Menos dependência de terceiros", "Paciente que já chega informado"] }
        }
      },
      {
        id: "a2", nome: "Instagram bonito, sem site", view: "insta",
        angulos: {
          dor: { f: "Seguidor curte. Mas quem busca no Google não te acha.", t: "O limite de viver só de Instagram", b: ["Curtida não é agendamento", "Quem busca no Google não te vê", "O link da bio parece amador"] },
          resultado: { f: "Ser encontrada por quem já procura o procedimento.", t: "O que muda com um site completo", b: ["Quem busca o procedimento te acha", "Seu trabalho organizado em um lugar", "Autoridade além da rede social"] },
          prova: { f: "Do perfil bonito ao site completo: veja a diferença.", t: "Só Instagram × site completo", b: ["Procedimentos explicados com calma", "Casos e avaliações reunidos", "Contato direto pelo WhatsApp"] },
          mecanismo: { f: "Procedimentos, casos, avaliações e WhatsApp em um só lugar.", t: "O que o site reúne", b: ["1. Procedimentos e dúvidas comuns", "2. Seus casos e avaliações", "3. Botão de WhatsApp sempre à mão"] },
          beneficio: { f: "A autoridade que a rede social sozinha não entrega.", t: "O que você ganha", b: ["Imagem de profissional estabelecida", "Domínio e e-mail com o seu nome", "Um lugar seu, fora do algoritmo"] }
        }
      },
      {
        id: "a3", nome: "Abrindo ou mudando", view: "novo",
        angulos: {
          dor: { f: "Clínica nova sem site parece clínica que ainda não existe.", t: "O risco de abrir sem presença online", b: ["Quem pesquisa o nome não acha nada", "Fica difícil passar confiança", "A divulgação começa do zero"] },
          resultado: { f: "Inaugure já com cara de clínica estabelecida.", t: "O que muda no primeiro dia", b: ["Site no ar junto com a inauguração", "Equipe e estrutura apresentadas", "Paciente encontra o endereço fácil"] },
          prova: { f: "Veja um site pronto para uma clínica que está abrindo.", t: "Site de uma clínica na abertura", b: ["Equipe e procedimentos", "Endereço no mapa", "Agendamento pelo WhatsApp"] },
          mecanismo: { f: "Equipe, procedimentos e endereço no mapa, tudo estruturado desde o dia 1.", t: "Como montamos o seu", b: ["1. Estrutura com equipe e especialidades", "2. Endereço e rota no mapa", "3. Ligação com a sua ficha do Google"] },
          beneficio: { f: "Confiança do primeiro contato ao primeiro agendamento.", t: "O que você ganha", b: ["Primeira impressão profissional", "Menos dúvida antes de marcar", "Base pronta para crescer"] }
        }
      },
      {
        id: "a4", nome: "Perdeu cliente no Google", view: "busca",
        angulos: {
          dor: { f: "Pesquise sua especialidade na sua cidade. Quem aparece primeiro não é você?", t: "3 sinais de que o concorrente está na frente", b: ["Ele aparece na busca, você não", "Paciente cita ele, não você", "Seu nome só aparece no Instagram"] },
          resultado: { f: "Apareça quando o paciente procura “perto de mim”.", t: "O que muda na busca", b: ["Seu nome entre as opções da cidade", "Contato direto, sem intermediário", "Presença onde o paciente decide"] },
          prova: { f: "É assim que uma clínica aparece quando alguém busca na cidade.", t: "Uma busca no Google, na prática", b: ["Nome, nota e endereço à vista", "Site com páginas por procedimento", "Botão de contato visível"] },
          mecanismo: { f: "Site ligado à sua ficha do Google, com páginas por bairro e procedimento.", t: "Como ser encontrado", b: ["1. Site com páginas por procedimento", "2. Ficha do Google ligada ao site", "3. Informações iguais em todo lugar"] },
          beneficio: { f: "Recupere o paciente que hoje vai para o concorrente.", t: "O que você ganha", b: ["Concorrência em pé de igualdade", "Contato que vem de quem já procura", "Menos gasto para ser notado"] }
        }
      },
      {
        id: "a5", nome: "Ticket alto, autoridade", view: "caso",
        angulos: {
          dor: { f: "Quem paga mais pesquisa mais. E um site raso espanta.", t: "O que afasta quem pagaria mais", b: ["Site genérico, sem profundidade", "Nada que mostre seu método", "Perfil que não explica quem atende"] },
          resultado: { f: "Seja o escolhido sem precisar baixar o valor.", t: "O que muda na decisão", b: ["O paciente entende seu trabalho", "Compara por critério, não por preço", "Chega pronto para conversar"] },
          prova: { f: "Veja como um caso bem apresentado vira argumento de decisão.", t: "Página de caso, por dentro", b: ["Diagnóstico explicado", "Tratamento em etapas", "Perfil de quem conduz o caso"] },
          mecanismo: { f: "Páginas de caso, tratamento explicado e perfil de quem atende.", t: "Como construímos autoridade", b: ["1. Casos contados com clareza", "2. Tratamento explicado em etapas", "3. Perfil do profissional em destaque"] },
          beneficio: { f: "Paciente que chega decidido.", t: "O que você ganha", b: ["Menos tempo explicando o básico", "Conversa de decisão, não de dúvida", "Imagem à altura do seu trabalho"] }
        }
      }
    ]
  },
  p2: {
    nome: "Atendimento, agenda e follow-up",
    avatares: [
      {
        id: "a1", nome: "Responde tudo sozinho", view: "inbox",
        angulos: {
          dor: { f: "Você atende paciente e responde WhatsApp ao mesmo tempo. Uma das duas coisas perde.", t: "3 sinais de que o WhatsApp te sobrecarrega", b: ["Responde de madrugada e no fim de semana", "Mensagem some no meio da agenda", "Ninguém sabe quem já foi respondido"] },
          resultado: { f: "Todo contato respondido, sem ficar preso ao celular.", t: "O que muda no seu dia", b: ["Cada contato com resposta", "Você volta a olhar o paciente", "Fim de semana sem tela"] },
          prova: { f: "Veja o painel com todas as conversas organizadas em um só lugar.", t: "Painel de atendimento, por dentro", b: ["Todas as conversas numa tela", "Contato novo à vista", "Histórico sempre salvo"] },
          mecanismo: { f: "Respostas automáticas e conversa separada por etapa.", t: "Como funciona", b: ["1. O contato chega e é respondido", "2. A conversa fica na etapa certa", "3. Sua equipe assume quando importa"] },
          beneficio: { f: "Tempo de volta, e nenhum contato perdido.", t: "O que você ganha", b: ["Menos mensagem esquecida", "Mais tempo com o paciente", "Atendimento sem depender do celular"] }
        }
      },
      {
        id: "a2", nome: "Secretária sobrecarregada", view: "menu",
        angulos: {
          dor: { f: "Sua recepção responde a mesma pergunta cem vezes por semana.", t: "3 perguntas que travam sua recepção", b: ["“Qual o endereço?”", "“Como faço para marcar?”", "“Vocês atendem convênio?”"] },
          resultado: { f: "Equipe cuidando do paciente que está na clínica.", t: "O que muda na recepção", b: ["Dúvida básica respondida sozinha", "Atendente livre para quem está presente", "Menos erro de resposta"] },
          prova: { f: "Veja um menu automático respondendo as dúvidas mais comuns.", t: "Menu automático, por dentro", b: ["Botões com as opções do paciente", "Resposta imediata", "Atendente entra quando precisa"] },
          mecanismo: { f: "Menu com botões que responde o básico e passa o resto para a equipe.", t: "Como funciona", b: ["1. O paciente escolhe uma opção", "2. O sistema responde na hora", "3. O que é complexo vai para a equipe"] },
          beneficio: { f: "Equipe sem sobrecarga.", t: "O que você ganha", b: ["Recepção menos cansada", "Resposta padronizada", "Paciente atendido mais rápido"] }
        }
      },
      {
        id: "a3", nome: "Faltas e cancelamentos", view: "lembrete",
        angulos: {
          dor: { f: "Horário vago por falta de última hora é dinheiro que não volta.", t: "O custo de uma falta", b: ["Horário que não volta", "Paciente de espera que já saiu", "Equipe ociosa no meio do dia"] },
          resultado: { f: "Agenda confirmada e cheia.", t: "O que muda na agenda", b: ["Paciente lembrado antes da consulta", "Confirmação sem ligar para ninguém", "Remarcação em vez de sumiço"] },
          prova: { f: "Veja o lembrete que o paciente recebe antes da consulta.", t: "Lembrete no WhatsApp, por dentro", b: ["Mensagem antes da consulta", "Botões para confirmar ou remarcar", "Resposta registrada na conversa"] },
          mecanismo: { f: "Lembrete antes da consulta, com remarcação direto no WhatsApp.", t: "Como funciona", b: ["1. Lembrete automático antes da consulta", "2. O paciente confirma ou remarca", "3. Você vê tudo no painel"] },
          beneficio: { f: "Menos falta, menos horário perdido.", t: "O que você ganha", b: ["Agenda mais cheia", "Menos horário vazio de última hora", "Menos ligação de confirmação"] }
        }
      },
      {
        id: "a4", nome: "Sem follow-up", view: "funil",
        angulos: {
          dor: { f: "Você mandou o orçamento. E depois? Quase ninguém retoma.", t: "Onde o orçamento morre", b: ["Enviado e esquecido", "Ninguém marca o retorno", "O paciente esfria sem aviso"] },
          resultado: { f: "Orçamento que volta a andar na hora certa.", t: "O que muda no seu retorno", b: ["Cada contato com próximo passo", "Retorno lembrado no dia certo", "Menos paciente perdido no meio"] },
          prova: { f: "Veja o funil com cada contato na etapa certa.", t: "Funil de contatos, por dentro", b: ["Novo, orçamento, agendado", "Cada contato na sua etapa", "Retorno marcado à vista"] },
          mecanismo: { f: "Contatos organizados por etapa, com lembrete de retorno.", t: "Como funciona", b: ["1. Cada contato entra numa etapa", "2. Você define o retorno", "3. O painel lembra no dia"] },
          beneficio: { f: "Feche o que já estava no seu WhatsApp.", t: "O que você ganha", b: ["Orçamento que não se perde", "Rotina de retorno simples", "Mais fechamento com o mesmo esforço"] }
        }
      },
      {
        id: "a5", nome: "De onde vem o cliente", view: "origem",
        angulos: {
          dor: { f: "Você paga anúncio, mas não sabe qual contato virou paciente.", t: "O que fica no escuro", b: ["Qual campanha trouxe o contato", "Qual contato virou consulta", "Onde vale colocar mais verba"] },
          resultado: { f: "Saber qual campanha traz cliente de verdade.", t: "O que muda na decisão", b: ["Origem de cada contato registrada", "Mais clareza para investir", "Corte do que não traz paciente"] },
          prova: { f: "Veja a origem de cada contato registrada na conversa.", t: "Origem do contato, por dentro", b: ["Instagram, Google, indicação, anúncio", "Cada contato com sua origem", "Tudo junto da conversa"] },
          mecanismo: { f: "A origem de cada contato fica registrada junto da conversa.", t: "Como funciona", b: ["1. O contato chega por um canal", "2. A origem fica registrada", "3. Você compara no painel"] },
          beneficio: { f: "Invista só no que dá retorno.", t: "O que você ganha", b: ["Decisão com dado, não com palpite", "Menos verba desperdiçada", "Clareza do que realmente traz paciente"] }
        }
      }
    ]
  }
};

module.exports = { ANGULOS, PRODUTOS };
