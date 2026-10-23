// Integração com a API gratuita do Google Gemini — usada pra LER o contexto de uma conversa e
// SUGERIR (nunca aplicar/enviar sozinha): etapa do pipeline + campos personalizados
// (sugerirPipeline), um rascunho de resposta pro cliente (sugerirResposta, "copiloto de vendas"),
// uma nota interna quando uma conversa fica parada demais numa etapa (analisarEtapaParada) e
// correção de ortografia por trecho (corrigirTexto). A pessoa sempre confirma com um clique no
// painel. Chave gratuita em https://aistudio.google.com/apikey — sem cartão, com cota diária
// generosa.
// Dois modelos de propósito: `GEMINI_MODEL` (barato) pro corretor de texto (tarefa mecânica, não
// precisa raciocinar, só corrigir ortografia) e `GEMINI_MODEL_PRO` pra sugestão de
// pipeline/resposta (precisa interpretar a conversa inteira e decidir).
const GEMINI_MODEL_LITE = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_MODEL_PRO = process.env.GEMINI_MODEL_PRO || "gemini-3.8-flash";

// Rotação de chave gratuita — `GEMINI_API_KEY_2` é opcional, vem de um projeto Google Cloud
// separado, então tem cota diária PRÓPRIA. Só troca de chave quando a atual estourou cota (HTTP
// 429) — nunca por round-robin, já que isso desperdiçaria a cota da 1ª chave à toa em dias de uso
// normal. Com as 2 (se configuradas), a cota diária efetiva pras funcionalidades que dependem do
// Gemini dobra sem precisar escolher qual delas "perde" quando o tráfego crescer.
const GEMINI_API_KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);

// Chama o Gemini com um prompt pronto e devolve o JSON já parseado — compartilhado por todas as
// funções deste arquivo. Lança com `.code` pra quem chamou decidir a mensagem de erro certa.
async function chamarGemini(prompt, modelo = GEMINI_MODEL_LITE) {
  if (!GEMINI_API_KEYS.length) {
    const err = new Error("GEMINI_API_KEY não configurada");
    err.code = "SEM_CHAVE";
    throw err;
  }

  // O modelo "flash" mais recente devolve 503 (sobrecarregado) com alguma frequência em horário
  // de pico — transitório, some sozinho em poucos segundos. Vale a pena tentar de novo 1x antes
  // de mostrar erro pra pessoa, em vez de fazer ela clicar de novo na mão.
  async function chamar(apiKey, comThinking) {
    let r;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              // Essas tarefas não precisam do modo "thinking" do modelo — desligar corta o custo
              // em tokens sem perder qualidade. Alguns modelos "lite" não aceitam esse campo
              // (derruba a chamada inteira com 400 INVALID_ARGUMENT) — por isso o retry sem
              // thinkingConfig logo abaixo.
              ...(comThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
        },
      );
      if (r.ok || r.status !== 503) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    return r;
  }

  let resp;
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    const apiKey = GEMINI_API_KEYS[i];
    resp = await chamar(apiKey, true);
    if (resp.status === 400) {
      resp = await chamar(apiKey, false);
    }
    const temProximaChave = i < GEMINI_API_KEYS.length - 1;
    if (resp.status === 429 && temProximaChave) {
      console.warn(`[gemini] chave ${i + 1} estourou cota (429), tentando a próxima`);
      continue;
    }
    break;
  }

  if (!resp.ok) {
    const texto = await resp.text().catch(() => "");
    const err = new Error(`Gemini respondeu ${resp.status}: ${texto.slice(0, 300)}`);
    err.code = "ERRO_API";
    throw err;
  }

  const data = await resp.json();
  const textoResposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textoResposta) {
    const err = new Error("Gemini não retornou texto (resposta pode ter sido bloqueada por segurança)");
    err.code = "SEM_RESPOSTA";
    throw err;
  }

  try {
    return JSON.parse(textoResposta);
  } catch {
    const err = new Error("Gemini retornou um JSON inválido");
    err.code = "JSON_INVALIDO";
    throw err;
  }
}

function montarPrompt({ mensagens, estagios, campos, valoresAtuais }) {
  const transcricao = mensagens
    .map((m) => {
      const quem = m.direction === "in" ? "Cliente" : "Atendimento";
      const corpo = m.body || `[${m.type || "mídia"}]`;
      return `${quem}: ${corpo}`;
    })
    .join("\n");

  const etapasTexto = estagios.map((e) => `- "${e.id}": ${e.nome}`).join("\n");

  const camposTexto = campos.length
    ? campos
        .map((c) => {
          const atual = valoresAtuais.find((v) => v.campo_id === c.id)?.valor;
          return `- "${c.nome}"${atual ? ` (valor atual: "${atual}")` : " (ainda vazio)"}`;
        })
        .join("\n")
    : "(nenhum campo personalizado cadastrado nesse negócio)";

  return `Você está ajudando a organizar o CRM de um atendimento por WhatsApp. Leia a conversa abaixo e responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:

{"etapa_id": "id_da_etapa_ou_null", "confianca": "alta|media|baixa", "campos": [{"nome": "nome_do_campo", "valor": "valor_sugerido"}], "resumo": "1-2 frases curtas explicando o porquê, em português"}

Etapas disponíveis (use exatamente um destes "id", ou null se a conversa não dá pra saber):
${etapasTexto}

Campos personalizados disponíveis (só sugira valor pros que você tem evidência clara no texto da conversa — não invente, não repita um valor que já está igual ao atual):
${camposTexto}

Conversa (mais antiga primeiro):
${transcricao}`;
}

async function sugerirPipeline({ mensagens, estagios, campos, valoresAtuais }) {
  if (!estagios.length) {
    const err = new Error("Nenhuma etapa de pipeline informada");
    err.code = "SEM_ETAPAS";
    throw err;
  }

  const prompt = montarPrompt({ mensagens, estagios, campos, valoresAtuais });
  const json = await chamarGemini(prompt, GEMINI_MODEL_PRO);

  // Validação defensiva: só aceita etapa_id que existe de verdade na lista enviada, e só aceita
  // campos que existem de verdade no CRM desse negócio — nunca confia cegamente no texto que a
  // IA devolveu.
  const idsValidos = new Set(estagios.map((e) => e.id));
  const etapaId = idsValidos.has(json.etapa_id) ? json.etapa_id : null;

  const porNome = new Map(campos.map((c) => [c.nome.trim().toLowerCase(), c]));
  const camposSugeridos = Array.isArray(json.campos)
    ? json.campos
        .filter((c) => c && typeof c.nome === "string" && typeof c.valor === "string" && c.valor.trim())
        .map((c) => {
          const campo = porNome.get(c.nome.trim().toLowerCase());
          return campo ? { campo_id: campo.id, nome: campo.nome, valor: c.valor.trim() } : null;
        })
        .filter(Boolean)
    : [];

  return {
    etapa_id: etapaId,
    confianca: ["alta", "media", "baixa"].includes(json.confianca) ? json.confianca : "baixa",
    campos: camposSugeridos,
    resumo: typeof json.resumo === "string" ? json.resumo.slice(0, 500) : "",
  };
}

// Copiloto de vendas (bloco lilás acima do campo de digitar). Duas partes: `insight` (a LEITURA
// da conversa — sinal de compra, objeção, urgência, o que um vendedor experiente notaria e a
// atendente pode não estar vendo) e `texto` (o rascunho em si, pra copiar/editar). A atendente
// usa o insight pra entender o "porquê" e decide com as próprias palavras; o texto é só um ponto
// de partida, não obrigação de copiar igual. Nunca manda nada sozinho — só devolve, quem envia é
// a pessoa.
function montarPromptResposta({ mensagens, campos, valoresAtuais, respostasProntas }) {
  const transcricao = mensagens
    .map((m) => {
      const quem = m.direction === "in" ? "Cliente" : "Atendimento";
      const corpo = m.body || `[${m.type || "mídia"}]`;
      return `${quem}: ${corpo}`;
    })
    .join("\n");

  const dadosCliente = campos
    .map((c) => {
      const v = valoresAtuais.find((x) => x.campo_id === c.id)?.valor;
      return v ? `- ${c.nome}: ${v}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const modelos = respostasProntas.length
    ? respostasProntas.map((r) => `- ${r.texto}`).join("\n")
    : "(nenhuma cadastrada)";

  return `Você é um copiloto de vendas/atendimento experiente (nível SDR/closer de verdade, não um bot genérico) ajudando o atendimento de uma correspondente bancária (Felizcred, empréstimo consignado) a responder um cliente pelo WhatsApp. Leia a conversa inteira com atenção a sinais que um vendedor treinado notaria: pergunta de valor/parcela repetida, hesitação, urgência, comparação com concorrente, objeção não resolvida, silêncio depois de uma proposta, etc. Responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato:

{"insight": "1-2 frases dizendo o que está realmente acontecendo nessa conversa e por que isso importa agora — a leitura estratégica, não um resumo do que já foi dito", "texto": "a resposta sugerida, pronta pra copiar/editar"}

Regras importantes pro "insight":
- Não repita o que já está óbvio no texto da conversa — aponte o que tem POR TRÁS (ex.: "já é a 2ª vez que pergunta o valor da parcela sem resposta — sinal de decisão perto, não deixe esfriar" é útil; "o cliente perguntou o valor" não é).
- Se não houver nada estratégico a notar (conversa simples, sem sinal relevante), devolva "insight": "".

Postura de vendedor: sempre pense no PRÓXIMO PASSO que leva o cliente a fechar (pedir o dado que falta, tirar a objeção, propor o passo seguinte, criar urgência honesta). O "texto" deve avançar a venda, não só reagir. Se o cliente acabou de dizer "ok/tá bom/obrigado", proponha o passo seguinte concreto em vez de agradecer. Considere o que o cliente já recebeu (autorização, simulação, prazos) e nunca peça de novo algo que ele já enviou. Não repita o CPF completo no texto.

Regras importantes pro "texto":
- Não invente valor, taxa, prazo ou aprovação que não esteja na conversa ou nos dados abaixo.
- Se não houver informação suficiente pra responder com segurança, sugira pedir mais detalhes (CPF, valor desejado, se é CLT/aposentado/etc.) ou encaminhar pra um atendente humano.
- Tom caloroso e profissional, frases curtas, sem emoji em excesso (no máximo 1).
- Pode se inspirar nos modelos de resposta pronta abaixo, mas adapte ao contexto — não copie se não fizer sentido.
- Se a última mensagem já é nossa (não do cliente), devolva {"insight": "", "texto": ""}.

Dados já conhecidos desse cliente:
${dadosCliente || "(nenhum ainda)"}

Modelos de resposta pronta (referência de tom/conteúdo):
${modelos}

Conversa (mais antiga primeiro):
${transcricao}`;
}

async function sugerirResposta({ mensagens, campos, valoresAtuais, respostasProntas }) {
  const prompt = montarPromptResposta({ mensagens, campos, valoresAtuais, respostasProntas });
  const json = await chamarGemini(prompt, GEMINI_MODEL_PRO);
  return {
    texto: typeof json.texto === "string" ? json.texto.trim().slice(0, 1000) : "",
    insight: typeof json.insight === "string" ? json.insight.trim().slice(0, 400) : "",
  };
}

// Alerta de etapa parada — um cron encontra conversa aberta há tempo demais numa etapa do
// pipeline e pede pra IA escrever uma nota interna curta explicando o possível motivo + próximo
// passo sugerido. Nunca manda mensagem pro cliente, nunca muda a etapa — só grava uma nota
// (conversation_notas) que aparece na linha do tempo, pro atendente decidir o que fazer.
function montarPromptEtapaParada({ mensagens, estagioNome, dias }) {
  const transcricao = mensagens
    .map((m) => {
      const quem = m.direction === "in" ? "Cliente" : "Atendimento";
      const corpo = m.body || `[${m.type || "mídia"}]`;
      return `${quem}: ${corpo}`;
    })
    .join("\n");

  return `Você é um copiloto de CRM de uma correspondente bancária (empréstimo consignado). Esta conversa está na etapa "${estagioNome}" há ${dias} dia(s) sem mudar. Leia o histórico e escreva uma nota interna curta (1-2 frases, direta, sem jargão) pro atendente humano ler: o possível motivo de estar parada e o que fazer a seguir. Nunca sugira mandar mensagem automática pro cliente — a nota é só pro atendente decidir. Responda SOMENTE com um JSON válido, sem texto antes ou depois:

{"nota": "a nota interna"}

Conversa (mais antiga primeiro, pode ser curta ou vazia):
${transcricao || "(sem mensagens ainda)"}`;
}

async function analisarEtapaParada({ mensagens, estagioNome, dias }) {
  const prompt = montarPromptEtapaParada({ mensagens, estagioNome, dias });
  const json = await chamarGemini(prompt, GEMINI_MODEL_PRO);
  return { nota: typeof json.nota === "string" ? json.nota.trim().slice(0, 500) : "" };
}

// Corretor de texto por-trecho — a pessoa digita rápido no meio do atendimento, erra português,
// aqui só sugere a correção (nunca troca sozinha) pro composer mostrar como balão posicionado em
// cima do trecho errado. Separado de sugerirResposta de propósito — aqui o INSUMO é o que a
// pessoa já escreveu, não a conversa.
async function corrigirTexto(texto) {
  const prompt = `Corrija ortografia, acentuação, vírgulas e gramática do texto abaixo, em português do Brasil, SEM mudar o sentido, o tom nem o tamanho — é uma mensagem de WhatsApp de atendimento, mantenha informal se já for informal. Aponte CADA erro separadamente (um por trecho), não reescreva a frase inteira. Responda SOMENTE com um JSON válido, sem texto antes ou depois, neste formato:

{"correcoes": [{"errado": "trecho exatamente como está no texto original — uma palavra ou expressão curta, nunca a frase inteira", "certo": "a correção desse trecho"}]}

Regras importantes:
- "errado" precisa ser uma cópia EXATA (mesmas letras, maiúsculas/minúsculas, acentos, espaços) de um trecho que existe de verdade no texto abaixo — nunca invente, nunca parafraseie, só recorte o pedaço errado.
- Prefira apontar só a palavra (ou expressão curta de poucas palavras) com erro, não a oração inteira em volta.
- Se o texto já estiver correto, devolva {"correcoes": []}.
- Nunca adicione informação nova, nunca reescreva o estilo nem o tom.

Texto:
${texto}`;
  const json = await chamarGemini(prompt);
  const bruto = Array.isArray(json.correcoes) ? json.correcoes : [];
  // Validação defensiva: só aceita correção cujo "errado" existe de verdade, caractere por
  // caractere, no texto original — sem esse match exato não dá pra posicionar o balãozinho em
  // cima da palavra certa no textarea, e uma correção mal localizada seria pior que nenhuma.
  const correcoes = bruto
    .filter(
      (c) =>
        c &&
        typeof c.errado === "string" &&
        typeof c.certo === "string" &&
        c.errado.trim() &&
        texto.includes(c.errado),
    )
    .map((c) => ({ errado: c.errado, certo: c.certo.trim() }))
    .slice(0, 8);
  return { correcoes };
}

async function classificarProdutoSite(texto) {
  const permitidos = ["FGTS", "Empréstimo CLT", "Carro em garantia"];
  const prompt = `Classifique a mensagem de um cliente da FelizCred em exatamente um produto.
Produtos permitidos: FGTS, Empréstimo CLT, Carro em garantia.
Responda somente JSON: {"produto":"nome exato ou null"}.
Mensagem: ${String(texto || "").slice(0, 2000)}`;
  const json = await chamarGemini(prompt, GEMINI_MODEL_LITE);
  return permitidos.includes(json.produto) ? json.produto : null;
}

async function interpretarValorParcela(texto) {
  const prompt = `Extraia somente o valor de parcela mensal que o cliente deseja para um empréstimo consignado CLT.
Exemplos: "quero parcela de 250" = 250; "duzentos e cinquenta reais" = 250; "R$ 189,90" = 189.90.
Não invente valor. Se não houver um valor claro, use null.
Responda somente JSON: {"valor": number|null}.
Mensagem: ${String(texto || "").slice(0, 300)}`;
  const json = await chamarGemini(prompt, GEMINI_MODEL_LITE);
  const valor = Number(json.valor);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

async function responderConversaCltSite({ mensagem, etapa }) {
  const prompt = `Você atende clientes da FelizCred sobre consignado CLT no chat do site. A Facta é o único banco ativo neste fluxo automático.
Escreva como Felipe: português brasileiro simples, acolhedor, direto e curto. Use "Perfeito", "Show" e um emoji leve apenas quando combinar. Faça uma pergunta por vez.

REGRAS INVIOLÁVEIS:
- Você é somente a camada de conversa. Nunca altere etapa, aprove cadastro, escolha oferta ou diga que executou uma ação.
- Nunca invente valor, prazo, taxa, margem, aprovação, tempo de pagamento ou regra bancária.
- Não mencione nem estime valores, parcelas, taxas ou prazos. Oriente o cliente a consultar os cartões de oferta exibidos na tela.
- Para iniciar a simulação na Facta, o formulário pede CPF e celular para a autorização segura da consulta.
- A elegibilidade informada pela FelizCred exige mais de 3 meses de registro no emprego atual.
- Para formalização, o formulário pede somente os dados obrigatórios exigidos pela Facta, em blocos curtos.
- Se o cliente quiser avançar, oriente a usar o botão ou formulário visível da etapa atual.
- Se faltar contexto, diga que precisa da informação na tela; não adivinhe.
- Não peça todos os dados pelo campo de mensagem e nunca peça senha, foto de documento ou código recebido.

ETAPA ATUAL: ${String(etapa || "início")}
MENSAGEM DO CLIENTE: ${String(mensagem || "").slice(0, 1000)}

Responda somente JSON: {"resposta":"texto curto para o cliente"}`;
  const json = await chamarGemini(prompt, GEMINI_MODEL_LITE);
  return typeof json.resposta === "string" ? json.resposta.trim().slice(0, 700) : "";
}

async function responderConversaSite({ mensagem, etapa, produto }) {
  const prompt = `Você é Felipe, assistente da FelizCred, em um chat de contratação de crédito.
Responda em português brasileiro simples, acolhedor e curto: no máximo 3 frases e 320 caracteres. Faça apenas uma pergunta por vez.

CONTEXTO:
- Produto em andamento: ${String(produto || "ainda não escolhido")}
- Etapa atual: ${String(etapa || "conversa inicial")}
- A Facta é o único banco ativo no fluxo automático de consignado CLT neste momento.

REGRAS INVIOLÁVEIS:
- Responda à dúvida, mas nunca altere produto, etapa, cadastro ou proposta.
- Nunca invente aprovação, valor, parcela, taxa, prazo, margem, política bancária ou tempo de pagamento.
- Nunca peça senha, código recebido, foto de documento ou todos os dados pelo chat.
- Somente no produto Empréstimo CLT existe botão ou formulário de contratação dentro do chat.
- No produto FGTS, nunca diga que existe botão, formulário ou opção de avançar dentro do chat. Oriente a usar a ação "Continuar FGTS no WhatsApp" exibida abaixo da conversa.
- Em produto ainda não escolhido ou carro em garantia, não afirme que há botão ou formulário visível.
- Se o cliente disser que já pediu, já tentou ou está repetindo a solicitação, não repita a orientação anterior nem invente uma saída. O servidor cuidará do encaminhamento ao WhatsApp.
- Se mencionar outro produto, diga que a simulação atual continua salva e pergunte se deseja ver opções; não diga que trocou.
- Se não souber, diga isso claramente. Não prometa que um humano resolverá ou aprovará.

MENSAGEM DO CLIENTE: ${String(mensagem || "").slice(0, 1000)}
Responda somente JSON: {"resposta":"texto curto para o cliente"}`;
  const json = await chamarGemini(prompt, GEMINI_MODEL_LITE);
  return typeof json.resposta === "string" ? json.resposta.trim().slice(0, 320) : "";
}

// Resposta de WhatsApp que leva em conta a conversa inteira — usada quando o cliente escreve de novo
// depois de já ter passado pelo fluxo do consignado CLT (não recomeça o fluxo, responde ao que ele disse).
async function responderConversaWhatsapp({ mensagens, situacao, horarioAtendimento }) {
  const transcricao = mensagens
    .map((m) => `${m.direction === "in" ? "Cliente" : "FelizCred"}: ${m.body || `[${m.type || "mídia"}]`}`)
    .join("\n");
  const prompt = `Você é Felipe, consultor da FelizCred (correspondente bancária), conversando pelo WhatsApp.
Escreva em português brasileiro simples, acolhedor e curto: no máximo 3 frases e 300 caracteres. Um emoji leve no máximo.

SITUAÇÃO ATUAL: ${situacao}
HORÁRIO DE ATENDIMENTO: ${horarioAtendimento}

REGRAS INVIOLÁVEIS:
- Responda ao que o cliente acabou de dizer, de acordo com a conversa abaixo. Nunca recomece o fluxo nem repita a apresentação ou a oferta.
- Nunca invente valor, parcela, taxa, prazo, aprovação, margem ou política de banco.
- Nunca peça senha, código recebido ou foto de documento.
- Se o cliente já enviou os dados, diga que já estão com a gente e que um atendente continua por aqui; se estivermos fora do horário, avise quando o atendimento volta.
- Se o cliente apenas cumprimentar ou agradecer, responda de forma breve e natural.
- Se não souber, diga isso claramente.

CONVERSA (mais antiga primeiro):
${transcricao.slice(-4000)}

Responda somente JSON: {"resposta":"texto curto para o cliente"}`;
  const json = await chamarGemini(prompt, GEMINI_MODEL_LITE);
  return typeof json.resposta === "string" ? json.resposta.trim().slice(0, 400) : "";
}

module.exports = { responderConversaWhatsapp, sugerirPipeline, sugerirResposta, analisarEtapaParada, corrigirTexto, classificarProdutoSite, interpretarValorParcela, responderConversaCltSite, responderConversaSite };
