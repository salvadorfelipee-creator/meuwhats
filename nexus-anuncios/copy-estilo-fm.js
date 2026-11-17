// Reescreve o gancho + história dos lotes 2 e 3 no estilo Fernando Miranda (Hook + Story + Offer):
// gancho contraintuitivo ("X não é Y, é Z"), curiosity gap, pergunta provocativa; a 1ª frase da história CONFIRMA o gancho.
// Regras do projeto: sem preço, sem prometer posição no Google nem que a IA vai citar a empresa, sem inventar número/caso real.
// Rodar: node nexus-anuncios/copy-estilo-fm.js  (reescreve novos-anuncios.json e novos-anuncios-ia.json)
// Depois, para aplicar nos anúncios já criados no Meta: node --env-file=.env nexus-anuncios/criar-campanha.js --spec novos-anuncios.json --recriar (idem -ia)
const fs = require("fs");
const path = require("path");

// nome do arquivo (sem _1080x1350.png) -> [gancho, história]
const C = {
  Novo_harm_busca_regiao: ["Sua clínica não perde paciente para quem faz melhor. Perde para quem aparece primeiro.", "Quem pesquisa estética na cidade abre as primeiras páginas do Google, compara e só então chama. Um site com os procedimentos explicados e conteúdo da sua região coloca sua clínica nessa comparação."],
  Novo_harm_formacao_agenda: ["Você estudou anos. Ela decide em segundos.", "É o tempo que a pessoa dá a uma página antes de ir para a próxima. Se sua formação e sua forma de avaliar estão só no feed, ela não vê. Um site coloca isso na frente dela."],
  Novo_harm_sem_indicacao: ["O que ninguém conta sobre agenda cheia por indicação.", "Ela depende de quem lembra de você. Se ninguém indicar esta semana, quem pesquisa harmonização perto de casa precisa achar seu perfil, seus procedimentos e como chamar. Isso é um site."],
  Novo_harm_tabela_precos: ["Sua clínica não vende procedimento. Vende confiança antes do preço.", "Quando a primeira mensagem é só \"quanto custa?\", falta contexto. Um site que apresenta formação, avaliação e diferenciais prepara a conversa antes do pedido de orçamento."],
  Novo_harm_instagram_sumisse: ["Se o Instagram sumisse amanhã, quanto da sua agenda sumiria junto?", "Seu perfil é terreno alugado: a regra muda e o alcance vai embora. Um site próprio, com páginas de procedimento e presença no Google, é um endereço que você controla."],
  Novo_harm_google_sabe: ["Sua clínica é ótima. O Google ainda não sabe disso.", "Ele só mostra o que consegue entender: serviços, cidade e contato. Um site bem estruturado conta isso por você."],

  Novo_odonto_preco_somem: ["O paciente que só pergunta o preço não está comparando preço. Está sem informação.", "Sem entender estrutura, tratamento e diferenciais, só sobra o valor para comparar. Um site que explica isso antes da conversa muda a pergunta que chega."],
  Novo_odonto_cadeira_agenda: ["Cadeira pronta não enche agenda sozinha.", "Quem procura dentista na região pesquisa no Google antes de ligar, e fala com quem encontra. Um site com SEO local coloca sua clínica nessa busca."],
  Novo_odonto_paga_clique: ["Quem paga por clique sem página clara paga duas vezes.", "Uma vez pelo anúncio e outra pelo contato que se perde. Uma página com tratamentos, localização e botão de WhatsApp continua a conversa que o anúncio começou."],
  Novo_odonto_particular: ["O paciente particular não escolhe o dentista mais barato. Escolhe o que entendeu.", "Ele compara formação, estrutura e tratamentos antes de agendar. Um site profissional responde isso por você e mostra o que te diferencia."],
  Novo_odonto_encontra_outra: ["Quem não encontra sua clínica no Google encontra a do vizinho.", "A pessoa pesquisa \"dentista perto de mim\", abre as primeiras opções e escolhe. Um site com SEO local aumenta as chances de a sua estar entre elas."],
  Novo_odonto_primeira_impressao: ["O paciente conhece sua clínica antes de você atender. Pelo Google.", "Antes da primeira mensagem, ele busca seu nome. Se encontra só um perfil de rede social, falta um lugar que explique seu trabalho."],

  Novo_geral_quem_procura: ["Seu cliente já escolheu antes de chamar. E você nem ficou sabendo.", "Ele digita o serviço e a cidade no Google e decide entre os primeiros nomes. Um site com conteúdo local ajuda seu negócio a entrar nessa lista."],
  Novo_geral_concorrente_aparece: ["Seu concorrente não é melhor que você. Só está mais fácil de achar.", "Muitas vezes a diferença é visibilidade, não qualidade. Um site que explica seu serviço e facilita o contato reduz essa diferença."],
  Novo_geral_valor_explicado: ["Seu preço não é alto. Seu valor é que está mal explicado.", "Quando o cliente não entende o que está incluso, só enxerga o preço. Um site que mostra serviços e diferenciais muda a conversa antes do orçamento."],
  Novo_geral_regiao_procura: ["Todo dia alguém na sua cidade procura o seu serviço. Para onde essa pessoa vai?", "Para quem ela encontra. Site, conteúdo local e informações claras trabalham juntos para você ser achado."],
  Novo_geral_busca_cliente: ["O cliente mais fácil de conquistar é o que já está procurando.", "Quem pesquisa já tem interesse. Falta um lugar claro para ele entender seu serviço e dar o próximo passo."],
  Novo_geral_indicacao_encontrado: ["Indicação é ótima. Mas quem nunca ouviu falar de você só chega pela busca.", "A indicação traz o contato. A busca traz quem ainda não conhece você. Um site com SEO local abre esse segundo caminho."],

  Novo_ia_harm_pergunta_chatgpt: ["Tem gente perguntando ao ChatGPT quem faz harmonização na cidade.", "Ninguém controla a resposta de uma IA. Mas um site com procedimentos, região e contato claros dá a ela o que ler sobre a sua clínica."],
  Novo_ia_harm_antes_whatsapp: ["Antes de te chamar no WhatsApp, ela pode ter perguntado ao ChatGPT. O que ele sabe sobre você?", "A pessoa pergunta quem atende na cidade e só depois chama. Um site claro ajuda a construir esse caminho, da pergunta ao contato."],
  Novo_ia_odonto_concorrente_citado: ["A IA só indica o que consegue ler. Sua clínica, ela consegue?", "Quem pergunta qual clínica atende na região recebe poucos nomes. Um site com tratamentos, localização e contato organizados ajuda a IA a entender o que você faz."],
  Novo_ia_odonto_o_que_citar: ["Dificilmente o ChatGPT cita uma clínica que ele não consegue ler.", "Sem páginas claras sobre seus serviços e sua região, a IA não tem o que usar. Site acessível e conteúdo de serviço dão contexto à sua presença digital."],
  Novo_ia_geral_proximo_cliente: ["Seu próximo cliente pode nem abrir o Google. Pode perguntar ao ChatGPT.", "Ele pergunta como escolher uma empresa do seu ramo. Mostre o que você faz, onde atende e por que vale conhecer, em um site que a IA e a pessoa consigam entender."],
  Novo_ia_geral_marca_conversa: ["A IA responde em segundos. Sua empresa está nessa resposta?", "Ninguém garante a resposta de uma IA, mas serviços, região e contato bem explicados em um site aumentam suas chances de ser compreendido."],
};

for (const arq of ["novos-anuncios.json", "novos-anuncios-ia.json"]) {
  const f = path.join(__dirname, arq);
  const spec = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const a of spec.anuncios) {
    const k = path.basename(a.arquivo).replace(/_1080x1350\.png$/, "");
    if (!C[k]) throw new Error("sem copy para " + k);
    const oferta = a.texto.slice(a.texto.indexOf("A Sites Nexus cria"));
    a.texto = `${C[k][0]}\n\n${C[k][1]}\n\n${oferta}`;
  }
  fs.writeFileSync(f, JSON.stringify(spec, null, 2));
  console.log(arq, spec.anuncios.length);
}
