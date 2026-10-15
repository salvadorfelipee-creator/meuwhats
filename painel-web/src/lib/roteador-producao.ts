// Roteador de atendimento automático EM CÓDIGO — reflete literalmente o que está em produção em
// server.js (FLUXO_BOTOES / FLUXO_FELIZCRED, FLUXO_COTACERTA, FLUXO_CIAHOT, as variantes da
// Campanha CLT, Amigo Indicou e FGTS via anúncio), pro painel da Felizcred. NÃO é o motor de
// fluxo dinâmico guardado no banco ("fluxos_dinamicos" / "Criar fluxo rápido" em fluxos.tsx) —
// essa é uma ferramenta separada e hoje órfã, sem relação com o que roteia de verdade. Pedido
// real do dono do negócio: "quero que apareça os que temos em cada canal" — essa tela existe pra
// o time revisar o texto/lógica real do bot, número por número.
//
// Cada item tem uma `chave` ESTÁVEL usada só pra guardar o status de "revisado" (ver
// api.roteadorRevisadoListar/roteadorRevisadoDefinir) — nunca usada pra nada automático.
//
// Todo texto de bolha "bot" é copiado literalmente de server.js (strings exatas das constantes/
// funções citadas no comentário de cada item — os números de linha são aproximados e podem ter
// se movido um pouco desde a leitura). Onde a mensagem real é montada em cima de um valor
// dinâmico (ex.: valor da oferta FGTS, nome da pessoa), a bolha mostra um exemplo plausível e uma
// nota deixa claro que é exemplo.

export type BolhaRoteador = { tipo: "bot" | "eu" | "nota"; texto: string }
export type CaminhoRoteador = { rotulo: string; linhas: BolhaRoteador[] }

export type ItemRoteador = {
  chave: string
  titulo: string
  // "Campanha" (além dos grupos já usados na Especitá) agrupa os fluxos disparados por campanha/
  // anúncio/template (Campanha CLT, FGTS via anúncio, Amigo Indicou, Ciahot) — não são "Entrada"
  // no sentido de alguém escrevendo primeiro de forma orgânica.
  grupo: "Entrada" | "Urgência" | "Produto" | "FAQ" | "Direto ao humano" | "Lembrete" | "Retorno" | "Campanha"
  canal: string
  descricao: string
  intro: BolhaRoteador[]
  caminhos: CaminhoRoteador[]
}

// ───────────────────────── Felizcred (número principal) ─────────────────────────
// FELIZCRED_PRINCIPAL_NUMBER_ID — recebe tráfego orgânico/anúncio o dia todo (menu padrão), mas
// também concentra 2 fluxos "sticky" por cima do menu (getFluxo, ~linha 4097): Amigo Indicou
// (sticky por template já recebido) e FGTS via anúncio (sticky por fluxo_passo "fgtsad_").

const TEXTO_MENU_PRINCIPAL =
  "Olá, me chamo Felipe:\n\n" +
  "Escolha uma das opções para ser atendido:\n" +
  "Digite a opção desejada:\n\n" +
  "1 - CONSIGNADO CLT\n" +
  "2 - SEGURO DE CARRO/MOTO\n" +
  "3 - EMPRÉSTIMO COM CARRO EM GARANTIA\n" +
  "4 - FINANCIAR UM VEÍCULO\n" +
  "5 - SAQUE DO FGTS\n\n" +
  "ATENÇÃO: O saque do FGTS só pode ser simulado se não foi realizado neste ano. A Caixa alterou as regras.\n\n" +
  "✅ (47) 99705-9353\n" +
  "✅ (47) 99274-7368\n" +
  "✅ (47) 3514-3392\n" +
  "🌐 http://www.felizcred.com.br"

const TEXTO_FORA_HORARIO_MENU =
  "Olá! 😊 Aqui é o Felipe, da Felizcred. No momento estamos fora do horário comercial " +
  "(atendemos de segunda a sexta das 9h às 18h, e aos sábados até o meio-dia).\n\n" +
  "Por favor, envie sua mensagem dentro do horário comercial pra reativar a conversa que a gente já te atende! 😊"

const DOCUMENTOS_VEICULO =
  "\n\nPra simular, me envia:\n" +
  "• Foto do documento do veículo (CRLV)\n" +
  "• Endereço completo\n" +
  "• Profissão e renda\n" +
  "• Foto do seu documento (RG ou CNH)\n" +
  "• E-mail"

function produtoConfirmacao(produto: string): string {
  return (
    `Perfeito! Anotado: ${produto}. Um atendente vai falar com você em instantes para fazer a simulação.\n\n` +
    "Enquanto isso, conheça nosso site: www.felizcred.com.br"
  )
}

const TEXTO_DADOS_RECEBIDOS_PADRAO =
  "Perfeito! ✅ Já anotei tudo, agora é só aguardar atendimento — em breve eu, Felipe, vou te responder " +
  "por aqui pra fazer sua simulação. 🙌"

const TEXTO_AVISO_FORA_HORARIO =
  "\n\n⏰ Essa resposta foi automática — nossa equipe atende de segunda a sexta das 9h às 18h e aos " +
  "sábados até o meio-dia. Um especialista fala com você assim que abrir o expediente."

const FELIZCRED_MENU_PRINCIPAL: ItemRoteador = {
  chave: "felizcred_menu_principal",
  titulo: "Menu principal",
  grupo: "Entrada",
  canal: "Felizcred (principal)",
  descricao:
    'Dispara na 1ª mensagem (ou digitando "menu") — é o mesmo texto que o Felipe já mandava manualmente antes de automatizar. ' +
    "Responde por NÚMERO ou PALAVRA-CHAVE em texto livre (detectarOpcaoMenuPrincipal: \"1\"/\"clt\"/\"consignado\", \"2\"/\"seguro\", " +
    '"3"/"garantia", "4"/"financiar"/"financiamento", "5"/"fgts"/"saque" — tem que ser a mensagem INTEIRA igual à palavra-chave, não só conter ' +
    'ela em algum lugar de uma frase maior). Fora do horário comercial (seg-sex 9h-18h, sáb até 12h) NÃO manda o menu — manda só o aviso de ' +
    "horário, e marca isso como `foraDeHorario` pra não cobrar resposta de uma opção que nunca foi enviada de verdade.",
  intro: [{ tipo: "eu", texto: "Oi" }],
  caminhos: [
    {
      rotulo: "Dentro do horário comercial",
      linhas: [{ tipo: "bot", texto: TEXTO_MENU_PRINCIPAL }],
    },
    {
      rotulo: "Fora do horário comercial",
      linhas: [
        { tipo: "nota", texto: "fluxo_passo NÃO vira menu_inicial aqui — é marcado foraDeHorario, sem ligar o lembrete do menu" },
        { tipo: "bot", texto: TEXTO_FORA_HORARIO_MENU },
      ],
    },
  ],
}

const FELIZCRED_CLT: ItemRoteador = {
  chave: "felizcred_clt_consignado",
  titulo: "1 — Consignado CLT",
  grupo: "Produto",
  canal: "Felizcred (principal)",
  descricao:
    "Opção 1 do menu. Pergunta tempo de carteira assinada antes de pedir dados. " +
    "ATENÇÃO: existe uma automação real via Unnotech (CPF → e-mail → link de autorização → consulta de margem → simulação, botões " +
    "cltorig_*) já escrita no código, mas está em STANDBY (constante CLT_ORIGINATION_ATIVO = false, esperando credencial de produção " +
    "da Unnotech) — hoje \"3 MESES OU MAIS\" sempre cai no caminho manual abaixo (pede os 5 dados e passa pro atendimento humano).",
  intro: [
    { tipo: "eu", texto: "1" },
    {
      tipo: "bot",
      texto:
        "Para simular o consignado CLT, precisa ter no mínimo 3 meses de carteira assinada no seu trabalho atual.",
    },
    { tipo: "nota", texto: 'botões: "3 MESES OU MAIS" / "MENOS DE 3 MESES"' },
  ],
  caminhos: [
    {
      rotulo: "Menos de 3 meses",
      linhas: [
        { tipo: "eu", texto: "MENOS DE 3 MESES" },
        {
          tipo: "bot",
          texto:
            "Como você ainda não completou 3 meses no seu trabalho atual, não é possível simular agora. " +
            "Dá uma olhada no app da Carteira de Trabalho Digital pra conferir a data de admissão certinha " +
            "— no dia que completar os 3 meses, é só me chamar de novo que eu já simulo. 😊\n\n" +
            "Deixa meu contato salvo: aqui é o Felipe, pode me chamar sempre que precisar!",
        },
      ],
    },
    {
      rotulo: "3 meses ou mais",
      linhas: [
        { tipo: "eu", texto: "3 MESES OU MAIS" },
        { tipo: "nota", texto: "CLT_ORIGINATION_ATIVO = false → caminho manual (standby da automação Unnotech)" },
        {
          tipo: "bot",
          texto:
            "Show! 😊 Pra simular preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só:\n" +
            "• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento",
        },
        { tipo: "eu", texto: "Maria Silva, 123.456.789-00, (47) 99999-9999, maria@email.com, 01/01/1990" },
        { tipo: "nota", texto: "detectou CPF na mensagem (REGEX_CPF) → confirma e libera pro atendimento" },
        { tipo: "bot", texto: TEXTO_DADOS_RECEBIDOS_PADRAO + TEXTO_AVISO_FORA_HORARIO },
      ],
    },
    {
      rotulo: "Some no meio (2 lembretes)",
      linhas: [
        { tipo: "eu", texto: "3 MESES OU MAIS" },
        { tipo: "nota", texto: "15 min de silêncio depois do pedido de dados → 1º lembrete" },
        {
          tipo: "bot",
          texto:
            "Olá! Só lembrando que pra eu simular seu consignado CLT, preciso desses dados 😊\n" +
            "Nome completo, CPF, telefone, e-mail e data de nascimento — pode mandar tudo numa mensagem só.",
        },
        { tipo: "nota", texto: "+4h de silêncio → 2º lembrete, muda de abordagem (não pede os dados de novo)" },
        {
          tipo: "bot",
          texto:
            "Sem compromisso nenhum 😊 Você deseja falar com um atendente humano pra simular? É só responder " +
            "aqui que eu já te encaminho.",
        },
        { tipo: "eu", texto: "Sim" },
        { tipo: "nota", texto: 'qualquer resposta aqui (mesmo sem CPF) já conta como aceite, por já ter passado do 2º toque' },
        {
          tipo: "bot",
          texto:
            "Perfeito! 😊 Já vou te colocar com um atendente — em breve eu, Felipe, te chamo por aqui pra fazer " +
            "sua simulação. 🙌" +
            TEXTO_AVISO_FORA_HORARIO,
        },
      ],
    },
  ],
}

const FELIZCRED_SEGURO: ItemRoteador = {
  chave: "felizcred_seguro_carro_moto",
  titulo: "2 — Seguro de carro/moto",
  grupo: "Produto",
  canal: "Felizcred (principal)",
  descricao: "Opção 2 do menu — resposta única e direta, sem perguntas: confirma e já passa pro atendimento humano.",
  intro: [{ tipo: "eu", texto: "2" }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [{ tipo: "bot", texto: produtoConfirmacao("o SEGURO DE CARRO/MOTO") + TEXTO_AVISO_FORA_HORARIO }],
    },
  ],
}

const FELIZCRED_GARANTIA: ItemRoteador = {
  chave: "felizcred_carro_garantia",
  titulo: "3 — Empréstimo com carro em garantia",
  grupo: "Produto",
  canal: "Felizcred (principal)",
  descricao: "Opção 3 do menu — pede foto do documento do veículo + dados; o sinal de conclusão é achar um e-mail na mensagem.",
  intro: [
    { tipo: "eu", texto: "3" },
    {
      tipo: "bot",
      texto:
        "Para fazer a simulação do empréstimo com carro em garantia, você não pode ter restrição de crédito " +
        "no SPC/Serasa, e o carro não pode estar alienado." +
        DOCUMENTOS_VEICULO,
    },
  ],
  caminhos: [
    {
      rotulo: "Manda os dados (com e-mail)",
      linhas: [
        { tipo: "eu", texto: "[foto CRLV] [foto RG] Rua Exemplo, 123 — Analista, R$ 3.500 — joao@email.com" },
        { tipo: "nota", texto: "só confirma quando acha um e-mail na mensagem (REGEX_EMAIL) — fotos sozinhas não disparam nada" },
        { tipo: "bot", texto: TEXTO_DADOS_RECEBIDOS_PADRAO + TEXTO_AVISO_FORA_HORARIO },
      ],
    },
    {
      rotulo: "Some no meio (sem e-mail)",
      linhas: [
        { tipo: "nota", texto: "15 min de silêncio → lembrete" },
        {
          tipo: "bot",
          texto:
            "Olá! Só lembrando que pra eu simular seu empréstimo com carro em garantia, preciso desses dados 😊\n" +
            "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
        },
      ],
    },
  ],
}

const FELIZCRED_FINANCIAMENTO: ItemRoteador = {
  chave: "felizcred_financiamento",
  titulo: "4 — Financiar um veículo",
  grupo: "Produto",
  canal: "Felizcred (principal)",
  descricao: "Opção 4 do menu — mesmo padrão da garantia (pede documentos, confirma quando acha e-mail).",
  intro: [
    { tipo: "eu", texto: "4" },
    {
      tipo: "bot",
      texto:
        "Se você já escolheu o modelo do veículo que quer financiar, pra fazer a simulação você não pode ter " +
        "restrição de crédito no SPC/Serasa." +
        DOCUMENTOS_VEICULO,
    },
  ],
  caminhos: [
    {
      rotulo: "Manda os dados (com e-mail)",
      linhas: [
        { tipo: "eu", texto: "[foto CRLV] [foto RG] Rua Exemplo, 123 — Analista, R$ 3.500 — joao@email.com" },
        { tipo: "bot", texto: TEXTO_DADOS_RECEBIDOS_PADRAO + TEXTO_AVISO_FORA_HORARIO },
      ],
    },
    {
      rotulo: "Some no meio (sem e-mail)",
      linhas: [
        { tipo: "nota", texto: "15 min de silêncio → lembrete" },
        {
          tipo: "bot",
          texto:
            "Olá! Só lembrando que pra eu simular o financiamento do seu veículo, preciso desses dados 😊\n" +
            "Foto do documento do veículo, endereço completo, profissão e renda, foto do seu documento e e-mail.",
        },
      ],
    },
  ],
}

const FELIZCRED_FGTS: ItemRoteador = {
  chave: "felizcred_fgts_saque",
  titulo: "5 — Saque do FGTS",
  grupo: "Produto",
  canal: "Felizcred (principal)",
  descricao:
    "Opção 5 do menu (ou já escrevendo \"fgts\"/\"saque\" direto) — pede autorização da J17 + CPF e abre uma solicitação DE VERDADE " +
    "na API da Unnotech (iniciarOriginacaoFgts), com um verificador consultando o status a cada 30s. INCERTEZA encontrada na leitura: " +
    "um comentário no bloco do CLT via Unnotech (perto da constante CLT_ORIGINATION_ATIVO) diz que \"a Unnotech ainda não liberou " +
    "credencial de produção pro parceiro — mesma pendência que já bloqueia o FGTS\", mas o código do FGTS roda incondicionalmente, sem " +
    "nenhuma flag tipo ATIVO/DESATIVADO como a do CLT. Não ficou claro se isso significa que a chamada real falha hoje, roda em modo de " +
    "teste, ou se a pendência já foi resolvida depois desse comentário ter sido escrito — vale confirmar com quem acompanha a Unnotech " +
    "antes de assumir que esse fluxo está 100% operacional em produção.",
  intro: [
    { tipo: "eu", texto: "5" },
    {
      tipo: "bot",
      texto:
        "Para fazer a simulação do saque do FGTS, é necessário autorizar a *J17* lá no aplicativo do FGTS " +
        "(Meu FGTS > Autorizações). Depois de autorizar, é só me mandar o seu CPF que a gente já parte " +
        "pro atendimento. 😊",
    },
  ],
  caminhos: [
    {
      rotulo: "CPF inválido",
      linhas: [
        { tipo: "eu", texto: "01234567890" },
        { tipo: "bot", texto: "Esse CPF não parece válido — confere os números e manda de novo, por favor. 😊" },
      ],
    },
    {
      rotulo: "Oferta disponível → contrata",
      linhas: [
        { tipo: "eu", texto: "123.456.789-00" },
        { tipo: "bot", texto: "Perfeito! Já estou consultando seu FGTS, isso leva só um minutinho ⏳" },
        { tipo: "nota", texto: "verificador consulta a Unnotech a cada 30s até sair OFFERS_AVAILABLE" },
        {
          tipo: "bot",
          texto: "Simulação pronta! 🎉 Você tem *R$ 1.800,00* liberado, em 5x de R$ 412,30, taxa de 1,99% ao mês. Quer contratar?",
        },
        { tipo: "nota", texto: "valores de exemplo — na mensagem real vêm do retorno da Unnotech (net_amount/installments/taxa)" },
        { tipo: "nota", texto: 'botões: "QUERO CONTRATAR" / "AGORA NÃO"' },
        { tipo: "eu", texto: "QUERO CONTRATAR" },
        {
          tipo: "bot",
          texto: "Show! Só preciso de mais alguns dados pra fechar a contratação. Toca no botão abaixo:",
        },
        { tipo: "nota", texto: 'é um WhatsApp Flow nativo (formulário dentro do app), não uma pergunta em texto' },
      ],
    },
    {
      rotulo: "Oferta disponível → desiste",
      linhas: [
        { tipo: "eu", texto: "123.456.789-00" },
        { tipo: "bot", texto: "Simulação pronta! 🎉 Você tem *R$ 1.800,00* liberado, em 5x de R$ 412,30, taxa de 1,99% ao mês. Quer contratar?" },
        { tipo: "eu", texto: "AGORA NÃO" },
        { tipo: "bot", texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia." },
      ],
    },
    {
      rotulo: "Sem oferta (precisa autorizar a J17)",
      linhas: [
        { tipo: "eu", texto: "123.456.789-00" },
        { tipo: "bot", texto: "Perfeito! Já estou consultando seu FGTS, isso leva só um minutinho ⏳" },
        {
          tipo: "bot",
          texto:
            "Não encontrei oferta disponível agora — provavelmente falta autorizar a J17 no app Meu " +
            "FGTS (Autorizações). Autoriza lá e manda 'menu' que eu tento de novo.",
        },
        { tipo: "nota", texto: 'outros motivos possíveis: "sem_saldo" (já usou o saque-aniversário nos últimos 12 meses) e "desconhecido"' },
      ],
    },
    {
      rotulo: "Já tem simulação em andamento",
      linhas: [
        { tipo: "eu", texto: "123.456.789-00" },
        { tipo: "bot", texto: "Você já tem uma simulação em andamento — já já eu te aviso por aqui assim que tiver novidade. 😊" },
      ],
    },
  ],
}

const FELIZCRED_GERENTE_ARQUIVADO: ItemRoteador = {
  chave: "felizcred_gerente_supervisor_arquivado",
  titulo: "Triagem Gerente/Supervisor (arquivado)",
  grupo: "Campanha",
  canal: "Felizcred (principal)",
  descricao:
    "ARQUIVADO — menuInicial() não manda mais esse menu de triagem desde 12/08/2026 (hoje manda direto o TEXTO_MENU_PRINCIPAL). " +
    "Mantido de propósito em FLUXO_BOTOES (fluxo_gerente/gerente_*) só pra reativação rápida: trocar o conteúdo de menuInicial() pelo de " +
    "menuInicialGerenteArquivado() religaria esse funil pra quem clicasse num anúncio voltado a quem trabalha/trabalhou como gerente.",
  intro: [],
  caminhos: [
    {
      rotulo: "Trabalhou, menos de 2 anos → autoriza",
      linhas: [
        {
          tipo: "bot",
          texto:
            "Olá, bom dia! Você clicou no nosso anúncio voltado para quem trabalha ou já trabalhou " +
            "como GERENTE ou SUPERVISOR. Para saber se você tem direito a receber FGTS, ou se deixou de receber, " +
            "preciso de algumas informações para te direcionar ao atendimento especializado. Vamos lá, é bem rápido!",
        },
        { tipo: "eu", texto: "TRABALHO/TRABALHEI" },
        { tipo: "bot", texto: "Certo! Agora preciso saber: faz mais de 2 anos que você saiu do seu trabalho como GERENTE ou SUPERVISOR?" },
        { tipo: "eu", texto: "NÃO PASSOU 2 ANOS" },
        {
          tipo: "bot",
          texto:
            "Ótimo! Acredito que você possa ter algum valor a receber. Nesse caso, para realizarmos uma análise técnica, " +
            "direcionamos o atendimento a um escritório de advocacia parceiro, especializado no assunto.\n\n" +
            "Caso deseje falar com eles de forma GRATUITA e tirar suas dúvidas, posso encaminhar seu contato.",
        },
        { tipo: "eu", texto: "AUTORIZO" },
        {
          tipo: "bot",
          texto:
            "Qual é o seu nome e de qual cidade você fala?\n\n" +
            "Após informar, é só aguardar o contato deles — será através do número de WhatsApp (47) 99978-2256.",
        },
        { tipo: "eu", texto: "Maria Silva, Blumenau" },
        {
          tipo: "bot",
          texto:
            "Perfeito, obrigado! Seus dados já entraram na agenda de atendimento. O escritório parceiro irá " +
            "enviar uma mensagem explicando como eles irão analisar o seu caso.",
        },
        { tipo: "nota", texto: "no fim de semana o texto avisa que o escritório escreve só na segunda às 9h" },
      ],
    },
    {
      rotulo: "Trabalhou, mais de 2 anos → prescrito",
      linhas: [
        { tipo: "eu", texto: "TRABALHO/TRABALHEI" },
        { tipo: "eu", texto: "FAZ MAIS DE 2 ANOS" },
        {
          tipo: "bot",
          texto:
            "No seu caso, como já passou mais de 2 anos, o direito de reaver algum valor pendente infelizmente já " +
            "prescreveu. Mas ainda podemos simular outras opções para você — toque no botão abaixo e escolha:",
        },
        { tipo: "nota", texto: "mostra LISTA_PRODUTOS (CLT / INSS / FGTS / carro em garantia / seguro veicular)" },
        { tipo: "eu", texto: "CONSIGNADO CLT" },
        { tipo: "bot", texto: produtoConfirmacao("o EMPRÉSTIMO CONSIGNADO CLT") },
      ],
    },
    {
      rotulo: "Nunca trabalhou como gerente/supervisor",
      linhas: [
        { tipo: "eu", texto: "NUNCA TRABALHEI" },
        {
          tipo: "bot",
          texto:
            "Nesse caso, infelizmente não é possível verificar, pois a revisão só se aplica a quem trabalha ou já " +
            "trabalhou como gerente ou supervisor. Mas podemos simular outras opções para você — toque no botão " +
            "abaixo e escolha:",
        },
        { tipo: "nota", texto: "mesma LISTA_PRODUTOS" },
        { tipo: "eu", texto: "SAQUE-ANIVERSÁRIO FGTS" },
        { tipo: "bot", texto: produtoConfirmacao("o SAQUE-ANIVERSÁRIO FGTS") },
      ],
    },
  ],
}

const FELIZCRED_AMIGO_INDICOU: ItemRoteador = {
  chave: "felizcred_amigo_indicou",
  titulo: "Amigo indicou",
  grupo: "Campanha",
  canal: "Felizcred (principal)",
  descricao:
    'Disparado pelo template "amigo_indicou". Fica "sticky" pro resto da conversa (db.recebeuTemplate) — uma vez que a Meta confirma ' +
    "que esse contato recebeu o template (mesmo dias depois), getFluxo manda SEMPRE pra esse fluxo, nunca mais pro menu padrão, mesmo " +
    "esse número recebendo tráfego orgânico/anúncio o dia todo também.",
  intro: [
    { tipo: "nota", texto: 'dispara 5s depois da pessoa responder ao template "amigo_indicou"' },
    {
      tipo: "bot",
      texto: "Eu me chamo Felipe, fiz o crédito do trabalhador para um colega seu que trabalha na mesma empresa, e recebemos seu contato como indicação!",
    },
    {
      tipo: "bot",
      texto: "Caso deseje, posso verificar o valor que está aprovado para você! Trabalhamos com vários bancos, e vejo qual tem a melhor oferta.",
    },
    { tipo: "nota", texto: 'botões: "DESEJO SIMULAR" / "CONHECER A EMPRESA" / "BLOQUEAR"' },
  ],
  caminhos: [
    {
      rotulo: "Desejo simular",
      linhas: [
        { tipo: "eu", texto: "DESEJO SIMULAR" },
        {
          tipo: "bot",
          texto:
            "Certo! Para simular, preciso de mais 5 coisinhas, pode mandar tudo numa mensagem só ou em " +
            "mensagens separadas:\n• Nome completo\n• CPF\n• Telefone\n• E-mail\n• Data de nascimento",
        },
        { tipo: "eu", texto: "Maria Silva, 123.456.789-00, (47) 99999-9999, maria@email.com, 01/01/1990" },
        { tipo: "nota", texto: "mesmo sinal de conclusão de sempre (achar CPF na mensagem)" },
        { tipo: "bot", texto: "Certo! Agora é só aguardar um minuto." + TEXTO_AVISO_FORA_HORARIO },
      ],
    },
    {
      rotulo: "Conhecer a empresa",
      linhas: [
        { tipo: "eu", texto: "CONHECER A EMPRESA" },
        { tipo: "bot", texto: "Claro! Você pode conhecer melhor a empresa no nosso site:" },
        { tipo: "nota", texto: 'botão de link (cta_url) "Conhecer site" → https://www.felizcred.com.br' },
      ],
    },
    {
      rotulo: "Bloquear",
      linhas: [
        { tipo: "eu", texto: "BLOQUEAR" },
        { tipo: "bot", texto: "Combinado, você foi bloqueado e não vai mais receber mensagens da gente por aqui." },
        { tipo: "nota", texto: "marca opt-out permanente (exigência da política de mensageria da Meta)" },
      ],
    },
  ],
}

const FELIZCRED_FGTS_ANUNCIO: ItemRoteador = {
  chave: "felizcred_fgts_anuncio",
  titulo: "FGTS via anúncio (Instagram)",
  grupo: "Campanha",
  canal: "Felizcred (principal)",
  descricao:
    'Clique num anúncio impulsionado do Instagram chega com um campo "referral" no webhook — detectado quando tem "fgts" no ' +
    "headline OU no body (case-insensitive). Pula o menu padrão inteiro. Sticky pelo fluxo_passo começando com \"fgtsad_\" (não por " +
    "template recebido, diferente do Amigo Indicou). No fim, converge pro MESMO motor de FGTS via Unnotech do item \"5 — Saque do FGTS\" " +
    "do menu principal (iniciarOriginacaoFgts) — ver aquele item pra oferta/sem-oferta.",
  intro: [
    { tipo: "nota", texto: 'referral do anúncio com "fgts" no headline/body — não é mensagem de campanha nossa, é clique de anúncio da Meta' },
    {
      tipo: "bot",
      texto:
        "Olá, me chamo Felipe e vou dar continuidade no seu atendimento! Para simular o saque do seu " +
        "FGTS, você precisa autorizar a *J17* no app do FGTS (Meu FGTS > Autorizações).",
    },
    { tipo: "nota", texto: 'botão: "JÁ AUTORIZEI"' },
  ],
  caminhos: [
    {
      rotulo: "Já autorizei",
      linhas: [
        { tipo: "eu", texto: "JÁ AUTORIZEI" },
        { tipo: "bot", texto: "Certo! Agora me informa o CPF pra eu poder simular." },
        { tipo: "eu", texto: "123.456.789-00" },
        { tipo: "nota", texto: "a partir daqui é o mesmo motor Unnotech do item \"5 — Saque do FGTS\"" },
      ],
    },
  ],
}

// ───────────────────────── Campanha CLT (número dedicado) ─────────────────────────
// CAMPANHA_CLT_NUMBER_ID — NÃO entra em FLUXOS_POR_NUMERO; getFluxo resolve por telefone
// (escolherVarianteCampanhaCLT): último dígito PAR → variante 1, ÍMPAR → variante 2.

const CAMPANHA_CLT_BOTOES_ENTRADA: BolhaRoteador[] = [
  { tipo: "nota", texto: 'botões: "SABER MAIS" / "SAIR" / "BLOQUEAR"' },
]

const CAMPANHA_CLT_FGTS_V1: ItemRoteador = {
  chave: "campanha_clt_fgts_v1",
  titulo: "Indicação FGTS → horas extras (Variante 1)",
  grupo: "Campanha",
  canal: "Campanha CLT",
  descricao:
    'Variante ATIVA do teste A/B pra quem o ÚLTIMO DÍGITO do telefone é PAR. Mensagem fria via indicação — chega por template ' +
    '("Olá, boa tarde.") mandado por fora do código; esse fluxo só cuida do que acontece depois da 1ª resposta. Sem lembrete de ' +
    "silêncio nenhum de propósito (contato frio não é cutucado). Critério revisado em 18/09/2026: aqui, quem BATE PONTO é o caso que " +
    "NÃO é aceito (diferenças calculadas pra quem não tem controle de ponto registrado) — é o OPOSTO da Variante 2 abaixo.",
  intro: [
    { tipo: "nota", texto: "dispara 5s depois da 1ª resposta ao template de indicação" },
    {
      tipo: "bot",
      texto:
        "Oi, João! Meu nome é Felipe, sou consultor na empresa FelizCred, correspondente " +
        "bancário — somos especialistas em crédito do FGTS. Atendemos muitas pessoas por " +
        "indicação, recebemos o seu contato assim, e vou ser breve pra não tomar seu tempo.\n\n" +
        "Muitas pessoas que ocuparam cargo de confiança, como gerente, supervisor ou afins, " +
        "podem ter diferenças a receber, como FGTS, e acabam nem sabendo desse direito. " +
        "Podemos fazer uma análise gratuita pra ver se é o seu caso.",
    },
    ...CAMPANHA_CLT_BOTOES_ENTRADA,
  ],
  caminhos: [
    {
      rotulo: "Saber mais → autoriza (aceito)",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "bot", texto: "Perfeito. É bem rápido.\n\nVocê ainda trabalha como gerente ou supervisor?" },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Já fez uma avaliação com profissionais para saber se há diferenças a receber do seu " +
            "contrato, como por exemplo, de FGTS?",
        },
        { tipo: "eu", texto: "NÃO" },
        { tipo: "bot", texto: "Isso é bastante comum. Vamos começar com a seguinte pergunta:\nNesse cargo, você batia ponto?" },
        { tipo: "eu", texto: "NÃO" },
        { tipo: "bot", texto: "Este é exatamente o caso em que podemos ajudar. Podemos te conectar com a equipe responsável?" },
        { tipo: "eu", texto: "AUTORIZO" },
        {
          tipo: "bot",
          texto:
            "A equipe técnica te chamará no WhatsApp pelo número (47) 99978-2256 — sem compromisso. " +
            "Se quiser, já pode salvar este número na sua agenda de contatos.",
        },
      ],
    },
    {
      rotulo: "Batia ponto → recusado",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "eu", texto: "SIM" },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Que bom! 😊 Mesmo assim, existem detalhes que quase ninguém verifica, que podem valer " +
            "ainda mais que o FGTS. Caso queira saber dos detalhes mencionados, precisamos que " +
            "responda a mais uma pergunta:\nNesse cargo, você batia ponto?",
        },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Infelizmente, neste caso, não podemos te ajudar, pois as diferenças são calculadas " +
            "justamente para quem não tem controle de ponto.",
        },
      ],
    },
    {
      rotulo: "Já saiu há mais de 2 anos → prescrito",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "eu", texto: "NÃO" },
        { tipo: "bot", texto: "Entendi. Faz mais de 2 anos que você saiu dessa empresa?" },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Infelizmente, existe um prazo previsto em lei para que se possa buscar os direitos — " +
            "baseado na sua resposta, o seu já passou 😕. Caso queira, podemos avaliar essa questão " +
            "do prazo, basta que nos envie um print do contrato de trabalho encerrado.",
        },
      ],
    },
    {
      rotulo: "Sair",
      linhas: [
        { tipo: "eu", texto: "SAIR" },
        { tipo: "bot", texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia — é só me chamar por aqui." },
      ],
    },
    {
      rotulo: "Bloquear",
      linhas: [
        { tipo: "eu", texto: "BLOQUEAR" },
        { tipo: "bot", texto: "Combinado, você não vai mais receber mensagens da gente por aqui. Se mudar de ideia, é só me chamar. 🙏" },
        { tipo: "nota", texto: "marca opt-out permanente" },
      ],
    },
  ],
}

const CAMPANHA_CLT_FGTS_V2: ItemRoteador = {
  chave: "campanha_clt_fgts_v2",
  titulo: "Indicação FGTS → horas extras (Variante 2)",
  grupo: "Campanha",
  canal: "Campanha CLT",
  descricao:
    "Variante de TESTE A/B pra quem o último dígito do telefone é ÍMPAR. É a reconstrução fiel da PRIMEIRA versão desse funil, antes da " +
    'rodada de edições de texto e da inversão do critério do ponto (18/09/2026): aqui bater ponto = PODE ter direito a horas extras ' +
    "(o OPOSTO da Variante 1) — e pede nome/cidade antes de encaminhar, em vez de só avisar o número de contato.",
  intro: [
    { tipo: "nota", texto: "dispara 5s depois da 1ª resposta ao template de indicação" },
    {
      tipo: "bot",
      texto:
        "Oi, João! Meu nome é Felipe, sou consultor na empresa FelizCred, correspondente " +
        "bancário — somos especialistas em crédito do FGTS. Atendemos muitas pessoas por " +
        "indicação, recebemos o seu contato assim, e vou ser breve pra não tomar seu tempo.\n\n" +
        "*Uma coisa no seu FGTS pode ter passado despercebido por anos.*\n" +
        "Muitas pessoas que ocuparam cargo de confiança como Gerente ou Supervisor deixaram de " +
        "receber FGTS e acabam nem sabendo desse direito. Caso você tenha trabalhado em uma " +
        "dessas funções, eu posso fazer uma análise gratuita pra ver se é o seu caso!",
    },
    ...CAMPANHA_CLT_BOTOES_ENTRADA,
  ],
  caminhos: [
    {
      rotulo: "Batia ponto → revelação positiva → autoriza",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "bot", texto: "Perfeito. É bem rápido.\n\nVocê ainda trabalha como gerente ou supervisor?" },
        { tipo: "eu", texto: "SIM" },
        { tipo: "bot", texto: "Você sabe se o seu FGTS foi depositado corretamente?" },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Que bom que você fica de olho nisso! 😊 Mesmo assim, tem um detalhe que quase ninguém " +
            "verifica e que pode valer ainda mais que o FGTS — só mais uma pergunta rápida:\n\n" +
            "Nesse cargo, você batia ponto ou tinha horário fixo de entrada e saída controlado?",
        },
        { tipo: "eu", texto: "SIM, BATIA PONTO" },
        {
          tipo: "bot",
          texto:
            "Isso muda bastante o seu caso 👀\n\nQuando alguém é registrado como gerente ou supervisor " +
            "mas bate ponto igual a qualquer outro funcionário, a lei entende que na prática não tinha " +
            "a autonomia que o cargo de confiança exige — e isso costuma dar direito a receber as " +
            "horas extras não pagas desses anos, não só o FGTS.\n\n" +
            "O escritório parceiro analisa os dois pontos juntos, de graça, só pra te dizer se é o seu " +
            "caso. Posso encaminhar?",
        },
        { tipo: "eu", texto: "AUTORIZO" },
        {
          tipo: "bot",
          texto:
            "Show! Só preciso do seu nome e da cidade onde mora, que eu já encaminho pro escritório.\n\n" +
            "Eles analisam o FGTS e as possíveis horas extras juntos, e te chamam por aqui pelo número " +
            "(47) 99978-2256 — sem compromisso.",
        },
        { tipo: "eu", texto: "Maria Silva, Blumenau" },
        { tipo: "nota", texto: "reaproveita confirmacaoAgenda() — mesmo texto do fluxo arquivado de Gerente/Supervisor" },
        {
          tipo: "bot",
          texto:
            "Perfeito, obrigado! Seus dados já entraram na agenda de atendimento. O escritório parceiro irá " +
            "enviar uma mensagem explicando como eles irão analisar o seu caso.",
        },
      ],
    },
    {
      rotulo: "Já saiu há mais de 2 anos → prescrito",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "eu", texto: "NÃO" },
        { tipo: "bot", texto: "Entendi. Faz mais de 2 anos que você saiu desse cargo?" },
        { tipo: "eu", texto: "SIM" },
        {
          tipo: "bot",
          texto:
            "Preciso ser honesto: como já passou de 2 anos desde que você saiu, o prazo legal pra " +
            "reaver tanto o FGTS quanto eventuais horas extras já passou (prescrição de 2 anos) 😕",
        },
      ],
    },
    {
      rotulo: "Não batia ponto → ainda encaminha",
      linhas: [
        { tipo: "eu", texto: "SABER MAIS" },
        { tipo: "eu", texto: "SIM" },
        { tipo: "eu", texto: "NÃO" },
        {
          tipo: "bot",
          texto:
            "Isso é mais comum do que parece, viu? 😳 Vale a pena checar direitinho — só mais uma " +
            "pergunta rápida antes:\n\nNesse cargo, você batia ponto ou tinha horário fixo de entrada e saída controlado?",
        },
        { tipo: "eu", texto: "NÃO, ERA LIVRE" },
        {
          tipo: "bot",
          texto:
            "Entendi! Mesmo assim, vale avaliar o FGTS com quem entende do assunto — às vezes tem " +
            "outros detalhes do contrato que pesam.\n\nPosso encaminhar seu caso pro escritório " +
            "parceiro, sem custo nenhum?",
        },
      ],
    },
  ],
}

const CAMPANHA_CLT_ARQUIVADO: ItemRoteador = {
  chave: "campanha_clt_pitch_antigo_arquivado",
  titulo: "Pitch \"consignado já aprovado\" (arquivado)",
  grupo: "Campanha",
  canal: "Campanha CLT",
  descricao:
    "ARQUIVADO desde 15/09/2026 — trocado pelo funil de Indicação FGTS acima. getFluxo nunca escolhe este objeto pra uma conversa nova " +
    "(só entraria via sticky do sub-fluxo \"Novo Saque\", que por sua vez só existe se ESTE fluxo já tivesse rodado antes — um ciclo " +
    "que não acontece na prática hoje). Mesmo assim o código carrega uma automação real e ativa (NOVOSAQUE_ORIGINATION_ATIVO = true, " +
    "2º banco integrado em 01/10/2026, testada contra o sandbox da Novo Saque) presa dentro dele — reativar o pitch NÃO reativa essa " +
    "automação sozinho, e vice-versa, são 2 decisões separadas de propósito.",
  intro: [
    {
      tipo: "bot",
      texto: "Meu nome é Felipe e sou consultor de vendas na FelizCred, uma empresa parceira de alguns bancos, como Banco Pan, Banco C6, Banco BMG, Facta...",
    },
    { tipo: "nota", texto: 'botão de link "Conhecer site" → felizcred.com.br' },
    {
      tipo: "bot",
      texto: "O motivo do meu contato é que você tem uma proposta de *CONSIGNADO CLT APROVADA*, com o primeiro desconto somente daqui a 60 dias.",
    },
    { tipo: "nota", texto: 'botões: "Simulação" / "Não desejo"' },
  ],
  caminhos: [
    {
      rotulo: "Simulação (cai na automação Novo Saque)",
      linhas: [
        { tipo: "eu", texto: "Simulação" },
        { tipo: "nota", texto: "NOVOSAQUE_ORIGINATION_ATIVO = true" },
        { tipo: "bot", texto: "Perfeito! Pra eu simular, me manda o seu CPF, por favor 😊" },
        { tipo: "nota", texto: "daqui em diante é a automação Novo Saque (nsorig_*) — não detalhada aqui por ser inalcançável na prática hoje" },
      ],
    },
    {
      rotulo: "Não desejo",
      linhas: [
        { tipo: "eu", texto: "Não desejo" },
        { tipo: "bot", texto: "Sem problemas! 😊 Fico à disposição se mudar de ideia." },
      ],
    },
    {
      rotulo: "Some no meio (lembrete de 7min)",
      linhas: [
        { tipo: "eu", texto: "Simulação" },
        { tipo: "nota", texto: "7 min de silêncio no passo de dados → lembrete com dúvida" },
        { tipo: "bot", texto: "Ainda por aí? 😊 Ficou com alguma dúvida que te fez não seguir com a simulação?" },
        { tipo: "nota", texto: 'botão: "Estou com dúvidas"' },
        { tipo: "eu", texto: "Estou com dúvidas" },
        {
          tipo: "bot",
          texto:
            "Perfeito! 😊 Já vou te colocar com um atendente — em breve eu, Felipe, te chamo por aqui pra fazer " +
            "sua simulação. 🙌" +
            TEXTO_AVISO_FORA_HORARIO,
        },
      ],
    },
  ],
}

// ───────────────────────── Cota Certa Seguros ─────────────────────────

function avisoForaHorarioCotaCertaTexto(): string {
  return (
    "\n\n⏰ Essa resposta foi automática — nossa equipe atende de segunda a sexta das 9h às 18h e aos " +
    "sábados até o meio-dia. Um especialista fala com você assim que abrir o expediente."
  )
}

const COTACERTA_MENU: ItemRoteador = {
  chave: "cotacerta_menu_principal",
  titulo: "Menu principal",
  grupo: "Entrada",
  canal: "Cota Certa",
  descricao:
    'Entrada padrão de quem manda mensagem direto pro número da Cota Certa (não veio do formulário do site). Responde "menu" a ' +
    "qualquer momento reabre essa lista. Cada opção vira um item próprio nesta tela (ver grupo Produto / Direto ao humano).",
  intro: [
    { tipo: "eu", texto: "Oi" },
    {
      tipo: "bot",
      texto:
        'Olá, boa tarde! 👋 Aqui é da Cota Certa Seguros. Comparamos as melhores seguradoras ' +
        "parceiras do Brasil pra você. Qual seguro você quer cotar?\n\n" +
        '(a qualquer momento, digite "menu" pra ver essas opções de novo)',
    },
  ],
  caminhos: [
    {
      rotulo: "Lista de opções",
      linhas: [
        { tipo: "nota", texto: "🚗 Seguro Auto — o mais procurado, carro/moto/caminhão" },
        { tipo: "nota", texto: "❤️ Seguro de Vida — proteção pra você e sua família" },
        { tipo: "nota", texto: "📋 Outros seguros — saúde, residencial, odonto ou viagem" },
        { tipo: "nota", texto: "🔑 Consórcio — cartas de imóvel, veículo ou serviços" },
        { tipo: "nota", texto: "💬 Falar com atendimento — já fiz minha cotação, quero falar com alguém" },
      ],
    },
  ],
}

const COTACERTA_SITE_COTACAO: ItemRoteador = {
  chave: "cotacerta_site_cotacao",
  titulo: "Entrada via site (cotação)",
  grupo: "Entrada",
  canal: "Cota Certa",
  descricao:
    "Pessoa preenche o formulário em felizcred.com.br/cotacerta — a mensagem que chega já vem padronizada pelo site " +
    '(começa com "Olá! Quero cotar..."). Pula o menu inteiro, é só uma confirmação terminal.',
  intro: [{ tipo: "eu", texto: "Olá! Quero cotar um seguro auto para o meu Onix 2021." }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        {
          tipo: "bot",
          texto:
            "Show, recebemos as informações da sua cotação por aqui! 👍 Um especialista da Cota Certa já vai te " +
            "chamar pra fechar as melhores condições com a seguradora parceira ideal. Só um instante!" +
            avisoForaHorarioCotaCertaTexto(),
        },
      ],
    },
  ],
}

const COTACERTA_SITE_CALLBACK: ItemRoteador = {
  chave: "cotacerta_site_callback",
  titulo: "Entrada via site (pedir ligação)",
  grupo: "Entrada",
  canal: "Cota Certa",
  descricao:
    'Mesmo mecanismo do item acima, pro outro botão do formulário do site (pedir ligação em vez de cotar por texto) — mensagem ' +
    'padronizada começando com "Olá! Quero receber uma ligação...".',
  intro: [{ tipo: "eu", texto: "Olá! Quero receber uma ligação sobre seguro de vida." }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        {
          tipo: "bot",
          texto: "Perfeito, já anotamos seu pedido! 📞 Um especialista da Cota Certa vai te ligar em instantes." + avisoForaHorarioCotaCertaTexto(),
        },
      ],
    },
  ],
}

const COTACERTA_PERGUNTA_FINANCIADO = {
  texto: "Perfeito, anotado! O veículo é financiado ou já quitado?",
}
const COTACERTA_PERGUNTA_RENOVACAO = {
  texto: "Só mais uma coisa: é seguro novo ou renovação de um que você já tinha?",
}
const COTACERTA_MENSAGEM_FINAL_AUTO =
  "Perfeito! 🎉 Já tenho tudo que preciso. Vou chamar um especialista agora pra fechar sua cotação com " +
  "a seguradora parceira ideal — só um instante! 👍" +
  avisoForaHorarioCotaCertaTexto()

const COTACERTA_AUTO: ItemRoteador = {
  chave: "cotacerta_seguro_auto",
  titulo: "🚗 Seguro Auto",
  grupo: "Produto",
  canal: "Cota Certa",
  descricao:
    "Produto principal da Cota Certa — único com perguntas de qualificação (tipo de veículo → modelo/ano/placa → financiado → uso → " +
    "CEP → novo/renovação). Toda etapa de texto livre tem um botão \"Não sei / pular\" que avança igual.",
  intro: [
    { tipo: "eu", texto: "🚗 Seguro Auto" },
    { tipo: "bot", texto: "Boa escolha! 🚗 Vamos deixar isso rapidinho. Qual tipo de veículo?" },
    { tipo: "nota", texto: 'botões: "Carro" / "Moto" / "Caminhão"' },
  ],
  caminhos: [
    {
      rotulo: "Carro → respondendo tudo",
      linhas: [
        { tipo: "eu", texto: "Carro" },
        { tipo: "bot", texto: "Show! Me passa rapidinho: qual o modelo, ano e placa? (ex: Onix 2021, ABC1234)" },
        { tipo: "eu", texto: "Onix 2022, ABC1D23" },
        { tipo: "bot", texto: COTACERTA_PERGUNTA_FINANCIADO.texto },
        { tipo: "nota", texto: 'botões: "Financiado" / "Já quitado"' },
        { tipo: "eu", texto: "Já quitado" },
        { tipo: "bot", texto: "Certo! E qual o uso do veículo?" },
        { tipo: "nota", texto: 'botões: "Particular" / "Trabalho" / "App"' },
        { tipo: "eu", texto: "Particular" },
        { tipo: "bot", texto: "Só mais uma coisa: qual o CEP onde o veículo fica à noite?" },
        { tipo: "eu", texto: "89010-000" },
        { tipo: "bot", texto: COTACERTA_PERGUNTA_RENOVACAO.texto },
        { tipo: "nota", texto: 'botões: "Seguro novo" / "Renovação"' },
        { tipo: "eu", texto: "Seguro novo" },
        { tipo: "bot", texto: COTACERTA_MENSAGEM_FINAL_AUTO },
      ],
    },
    {
      rotulo: "Moto → pulando tudo",
      linhas: [
        { tipo: "eu", texto: "Moto" },
        { tipo: "bot", texto: "Show! Me passa rapidinho: qual o modelo, ano e placa? (ex: Fazer 250 2021, ABC1234)" },
        { tipo: "eu", texto: "Não sei / pular" },
        { tipo: "bot", texto: COTACERTA_PERGUNTA_FINANCIADO.texto },
        { tipo: "eu", texto: "Financiado" },
        { tipo: "bot", texto: "Certo! E qual o uso do veículo?" },
        { tipo: "eu", texto: "Trabalho" },
        { tipo: "bot", texto: "Só mais uma coisa: qual o CEP onde o veículo fica à noite?" },
        { tipo: "eu", texto: "Não sei / pular" },
        { tipo: "bot", texto: COTACERTA_PERGUNTA_RENOVACAO.texto },
        { tipo: "eu", texto: "Renovação" },
        { tipo: "bot", texto: COTACERTA_MENSAGEM_FINAL_AUTO },
      ],
    },
  ],
}

const COTACERTA_VIDA: ItemRoteador = {
  chave: "cotacerta_seguro_vida",
  titulo: "❤️ Seguro de Vida",
  grupo: "Produto",
  canal: "Cota Certa",
  descricao: "Resposta única — sem qualificação, passa direto pro especialista.",
  intro: [{ tipo: "eu", texto: "❤️ Seguro de Vida" }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        {
          tipo: "bot",
          texto:
            "Perfeito! Um especialista em Seguro de Vida vai falar com você em instantes pra entender sua " +
            "necessidade e buscar a melhor condição. 👍" +
            avisoForaHorarioCotaCertaTexto(),
        },
      ],
    },
  ],
}

const COTACERTA_CONSORCIO: ItemRoteador = {
  chave: "cotacerta_consorcio",
  titulo: "🔑 Consórcio",
  grupo: "Produto",
  canal: "Cota Certa",
  descricao: "Resposta única — sem qualificação, passa direto pro especialista.",
  intro: [{ tipo: "eu", texto: "🔑 Consórcio" }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        {
          tipo: "bot",
          texto:
            "Perfeito! Um especialista em Consórcio vai falar com você em instantes pra apresentar as melhores " +
            "cartas disponíveis. 👍" +
            avisoForaHorarioCotaCertaTexto(),
        },
      ],
    },
  ],
}

const COTACERTA_OUTROS: ItemRoteador = {
  chave: "cotacerta_outros_seguros",
  titulo: "📋 Outros seguros",
  grupo: "Produto",
  canal: "Cota Certa",
  descricao: "Pergunta qual é o produto (saúde/residencial/odonto/viagem) em texto livre, qualquer resposta já passa pro humano.",
  intro: [
    { tipo: "eu", texto: "📋 Outros seguros" },
    {
      tipo: "bot",
      texto: "Me conta rapidinho qual seguro você precisa (Saúde, Residencial, Odonto ou Viagem) que já chamo um especialista pra te ajudar.",
    },
  ],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        { tipo: "eu", texto: "Seguro residencial" },
        { tipo: "bot", texto: "Perfeito, anotado! Um especialista vai falar com você em instantes pra te ajudar. 👍" + avisoForaHorarioCotaCertaTexto() },
      ],
    },
  ],
}

const COTACERTA_ATENDIMENTO: ItemRoteador = {
  chave: "cotacerta_atendimento_humano",
  titulo: "💬 Falar com atendimento",
  grupo: "Direto ao humano",
  canal: "Cota Certa",
  descricao: 'Pra quem já fez a cotação em outro canal/visita e só quer continuar com um humano — sem passar pela qualificação de novo.',
  intro: [{ tipo: "eu", texto: "💬 Falar com atendimento" }],
  caminhos: [
    {
      rotulo: "Resposta",
      linhas: [
        { tipo: "bot", texto: "Perfeito! Já vou chamar um especialista pra continuar seu atendimento. Só um instante! 👍" + avisoForaHorarioCotaCertaTexto() },
      ],
    },
  ],
}

// ───────────────────────── Ciahot ─────────────────────────

const CIAHOT_SITE_URL = "https://www.ciahot.com.br"
const CIAHOT_ANUNCIAR_URL = "https://ciahot.com.br/anunciar/"

const CIAHOT_FLUXO: ItemRoteador = {
  chave: "ciahot_fluxo_linear",
  titulo: "Sequência pós-campanha",
  grupo: "Campanha",
  canal: "Ciahot",
  descricao:
    "Negócio diferente da Felizcred — site de anúncios classificados da região do Vale. Sempre disparado por campanha de Marketing " +
    "(template aprovado pelo broadcast do painel); este fluxo só cuida do que acontece DEPOIS que a pessoa responde. Não é um menu — é " +
    "uma sequência linear (aquece, oferece anúncio grátis com link pro site, cutuca 1x em 17min se ninguém tocar em nada). Teto de " +
    "mensagens automáticas: as 3 iniciais + 1 lembrete e nada mais.",
  intro: [
    { tipo: "nota", texto: "dispara 15s depois da pessoa responder ao template de campanha" },
    {
      tipo: "bot",
      texto:
        "Espero que esteja bem! 😊 Meu nome é Felipe, aqui é do escritório do site CIAHOT — um site de " +
        "anúncios da região do Vale. 📣\n\n" +
        "Nosso objetivo é criar anúncios premium e gerar mais atendimentos para você, e facilitar a gestão " +
        "do seu anúncio.\n\n" +
        "Estamos liberando um anúncio *gratuito* pra você divulgar seu perfil e conseguir mais clientes! " +
        "Te convido a visitar nosso site pra ver como será seu anúncio — se desejar fazer, em 1 min você vê " +
        "e faz seu anúncio *premium*!",
    },
    { tipo: "nota", texto: `botão de link "Conhecer site" → ${CIAHOT_SITE_URL}` },
    { tipo: "nota", texto: "5s depois (sem esperar clique — cta_url não gera webhook)" },
    {
      tipo: "bot",
      texto:
        `Você pode fazer seu anúncio gratuito, sem custo! 🎉 E ainda pode ganhar o selo *VIP* na campanha ` +
        `que está ativa agora. Faça seu anúncio que ele já é liberado pela nossa equipe!\nÉ só acessar: ${CIAHOT_ANUNCIAR_URL}`,
    },
    { tipo: "nota", texto: 'botões: "Anúncio feito" / "No momento não"' },
  ],
  caminhos: [
    {
      rotulo: "Anúncio feito",
      linhas: [
        { tipo: "eu", texto: "Anúncio feito" },
        {
          tipo: "bot",
          texto:
            "Ótimo! Agora é só aguardar a liberação, vamos te avisar por aqui. 📌 Já salva esse contato e " +
            "também nosso e-mail de suporte: contato@ciahot.com.br",
        },
      ],
    },
    {
      rotulo: "No momento não",
      linhas: [
        { tipo: "eu", texto: "No momento não" },
        { tipo: "bot", texto: "Sem problemas! 😊 Vamos ficar à disposição, pode nos chamar se tiver alguma dúvida." },
      ],
    },
    {
      rotulo: "Sem resposta (lembrete 17min)",
      linhas: [
        { tipo: "nota", texto: "17 min sem nenhum clique → único lembrete, depois disso o bot fica quieto" },
        {
          tipo: "bot",
          texto: `O site CIAHOT pode gerar mais contatos para você! 🚀 Não deixe de conferir e fazer seu anúncio de forma gratuita: ${CIAHOT_SITE_URL}`,
        },
      ],
    },
  ],
}

export const ITENS_ROTEADOR: ItemRoteador[] = [
  FELIZCRED_MENU_PRINCIPAL,
  FELIZCRED_CLT,
  FELIZCRED_SEGURO,
  FELIZCRED_GARANTIA,
  FELIZCRED_FINANCIAMENTO,
  FELIZCRED_FGTS,
  FELIZCRED_GERENTE_ARQUIVADO,
  FELIZCRED_AMIGO_INDICOU,
  FELIZCRED_FGTS_ANUNCIO,
  CAMPANHA_CLT_FGTS_V1,
  CAMPANHA_CLT_FGTS_V2,
  CAMPANHA_CLT_ARQUIVADO,
  COTACERTA_MENU,
  COTACERTA_SITE_COTACAO,
  COTACERTA_SITE_CALLBACK,
  COTACERTA_AUTO,
  COTACERTA_VIDA,
  COTACERTA_CONSORCIO,
  COTACERTA_OUTROS,
  COTACERTA_ATENDIMENTO,
  CIAHOT_FLUXO,
]

// Canais distintos, na ordem em que aparecem acima — usado pelos filtros/pills da tela Fluxos.
export const CANAIS_ROTEADOR: string[] = Array.from(new Set(ITENS_ROTEADOR.map((i) => i.canal)))
