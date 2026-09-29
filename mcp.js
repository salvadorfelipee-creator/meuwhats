// Servidor MCP (Model Context Protocol) exposto em POST /mcp/:token — deixa o Claude (via
// conector customizado, mesmo na conta grátis do claude.ai) chamar ações reais do painel:
// agendar campanha de WhatsApp, publicar post na Agenda e criar/gerenciar campanha de
// anúncio no Facebook/Instagram. Implementado à mão (sem @modelcontextprotocol/sdk, sem
// Express, sem Zod) pra não trazer dependência nova pro projeto — o protocolo em si (JSON-RPC
// 2.0 sobre HTTP, modo stateless) é simples o bastante pra não precisar do SDK. Ver
// "Como pedir uma campanha nova" no README pra entender o raciocínio por trás das ferramentas
// de ads (targeting, público, etc.) — isso é o mesmo fluxo que o Claude já fazia manualmente
// via terminal, só que agora exposto como ferramenta pro Claude do outro lado (conta da
// clínica/cliente) fazer sozinho.

const MCP_PROTOCOL_VERSION = "2025-06-18";

// ─── Definição das ferramentas (JSON Schema puro, sem Zod) ─────────────────────────────────
const TOOLS = [
  {
    name: "painel_listar_canais",
    title: "Listar canais/números configurados",
    description:
      "Lista os números de WhatsApp configurados no painel (id e nome/label de cada um). " +
      "Use isto primeiro pra descobrir o business_id certo antes de chamar qualquer outra " +
      "ferramenta de WhatsApp — o id muda por número, nunca invente um.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "whatsapp_listar_templates",
    title: "Listar templates aprovados de um número de WhatsApp",
    description:
      "Lista os templates de mensagem já APROVADOS pela Meta pra um número de WhatsApp " +
      "específico. Use antes de agendar uma campanha — só templates aprovados podem ser " +
      "enviados fora da janela de 24h de conversa.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string", description: "id do número (ver painel_listar_canais)" },
      },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "whatsapp_agendar_campanha",
    title: "Agendar campanha de WhatsApp (template) para uma lista de contatos",
    description:
      "Agenda o envio de UM template já aprovado pra uma lista de contatos, cada um com seu " +
      "próprio horário (data_hora, formato 'AAAA-MM-DDTHH:MM' em horário de Brasília). Cai na " +
      "mesma fila que já roda em produção — não manda nada na hora, só agenda. Pra saber quais " +
      "templates existem, chame whatsapp_listar_templates antes.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string", description: "id do número que vai enviar (ver painel_listar_canais)" },
        template: { type: "string", description: "nome exato do template aprovado" },
        language: { type: "string", description: "código do idioma do template, ex. pt_BR", default: "pt_BR" },
        contatos: {
          type: "array",
          description: "lista de destinatários",
          items: {
            type: "object",
            properties: {
              telefone: { type: "string", description: "número com DDD, ex. 47999998888" },
              nome: { type: "string", description: "nome do contato (opcional, só pra identificar na fila)" },
              data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM, horário de Brasília" },
            },
            required: ["telefone", "data_hora"],
          },
          minItems: 1,
        },
      },
      required: ["business_id", "template", "contatos"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "whatsapp_listar_campanha_pendente",
    title: "Listar envios de WhatsApp agendados e ainda não enviados",
    description: "Lista os itens da fila de campanha de WhatsApp que ainda não foram enviados, pra um número.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "agenda_publicar_post",
    title: "Agendar um post de texto/link no Instagram/Facebook",
    description:
      "Agenda um post (só texto e/ou link — sem imagem/vídeo nesta ferramenta ainda) pra uma " +
      "ou mais redes, num dia/hora específico. Cai na fila que o menu Agenda do painel já usa.",
    inputSchema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "texto do post" },
        link: { type: "string", description: "link opcional a incluir no post" },
        redes: {
          type: "array",
          items: { type: "string", enum: ["instagram", "instagram_story", "facebook", "twitter", "linkedin", "threads"] },
          minItems: 1,
        },
        data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM, horário de Brasília" },
      },
      required: ["redes", "data_hora"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "agenda_listar_posts",
    title: "Listar posts agendados/recentes da Agenda",
    description: "Lista os posts mais recentes da Agenda (agendados, publicados e com erro), mais recentes primeiro.",
    inputSchema: {
      type: "object",
      properties: { limite: { type: "number", minimum: 1, maximum: 100, default: 30 } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ads_pesquisar_publico",
    title: "Pesquisar cargo/interesse/localização pra segmentação de anúncio",
    description:
      "Pesquisa termos de segmentação na API de Marketing da Meta — use ANTES de criar um " +
      "conjunto de anúncios, pra achar o id certo de cargo/interesse/localização (não invente " +
      "id, sempre pesquise primeiro).",
    inputSchema: {
      type: "object",
      properties: {
        termo: { type: "string", description: "termo de busca, ex. 'gerente', 'supermercado'" },
        tipo: {
          type: "string",
          enum: ["adworktitle", "adinterest", "adgeolocation"],
          description: "adworktitle=cargo, adinterest=interesse/comportamento, adgeolocation=local",
          default: "adinterest",
        },
      },
      required: ["termo"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "ads_estimar_publico",
    title: "Estimar tamanho do público antes de criar o conjunto de anúncios",
    description:
      "Estima quantas pessoas um targeting_spec alcançaria. Use antes de ads_criar_conjunto_anuncios " +
      "pra evitar público minúsculo (não entrega) ou gigante demais (impreciso).",
    inputSchema: {
      type: "object",
      properties: {
        targeting_spec: { type: "object", description: "objeto de segmentação no formato da Graph API" },
        optimization_goal: { type: "string", default: "CONVERSATIONS" },
      },
      required: ["targeting_spec"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "ads_criar_campanha",
    title: "Criar campanha de anúncio (sempre pausada)",
    description:
      "Cria uma campanha nova na conta de anúncios. SEMPRE sai com status PAUSED, não importa " +
      "o que for passado — ativar é decisão manual da pessoa, depois de revisar no Gerenciador " +
      "de Anúncios ou no painel (aba de anúncios).",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        objetivo: { type: "string", description: "ex. OUTCOME_ENGAGEMENT, OUTCOME_TRAFFIC" },
        categorias_especiais: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["nome", "objetivo"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ads_criar_conjunto_anuncios",
    title: "Criar conjunto de anúncios (segmentação + orçamento) dentro de uma campanha",
    description:
      "Cria um conjunto de anúncios (adset) dentro de uma campanha já existente — define " +
      "orçamento, datas, segmentação e destino. Pra anúncio com destino WhatsApp, promoted_object " +
      "precisa ter page_id de uma Página com WhatsApp Business conectado. SEMPRE sai PAUSED.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        campanha_id: { type: "string" },
        orcamento_diario_centavos: { type: "number" },
        orcamento_total_centavos: { type: "number", description: "alternativa ao diário — exige inicio e fim" },
        inicio: { type: "string", description: "ISO 8601, ex. 2026-07-06T18:00:00-03:00" },
        fim: { type: "string", description: "ISO 8601" },
        evento_cobranca: { type: "string", default: "IMPRESSIONS" },
        meta_otimizacao: { type: "string", default: "LINK_CLICKS" },
        destino: { type: "string", description: "ex. WHATSAPP, WEBSITE" },
        promoted_object: { type: "object", description: "ex. { page_id: '...' } pra WhatsApp" },
        targeting: { type: "object", description: "objeto de segmentação da Graph API" },
      },
      required: ["nome", "campanha_id", "targeting"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ads_criar_criativo_de_post_instagram",
    title: "Criar criativo de anúncio a partir de um post já existente do Instagram",
    description:
      "Cria um criativo reaproveitando uma publicação já existente do Instagram (não sobe " +
      "imagem nova). Exige o Instagram conectado à conta de anúncios.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        instagram_media_id: { type: "string", description: "id numérico da publicação do Instagram" },
        instagram_user_id: { type: "string" },
        call_to_action: { type: "object", description: "ex. { type: 'WHATSAPP_MESSAGE' }" },
      },
      required: ["nome", "instagram_media_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ads_criar_anuncio",
    title: "Criar o anúncio final ligando conjunto + criativo",
    description: "Cria o anúncio propriamente dito, ligando um conjunto de anúncios a um criativo já existente. SEMPRE sai PAUSED.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        conjunto_id: { type: "string" },
        criativo_id: { type: "string" },
      },
      required: ["nome", "conjunto_id", "criativo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "ads_listar_campanhas",
    title: "Listar campanhas de anúncio com métricas",
    description: "Lista as campanhas da conta de anúncios com gasto, impressões, cliques e CTR de cada uma.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "fluxo_criar",
    title: "Criar um fluxo de conversa novo (vazio, inativo)",
    description:
      "Cria um fluxo de conversa novo pra um número, ainda vazio e INATIVO — o número continua " +
      "usando o fluxo padrão até você montar os nós (fluxo_no_criar) e ativar (fluxo_ativar). " +
      "Só funciona em números que ainda não têm um fluxo fixo escrito no código do sistema.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        nome: { type: "string", description: "nome só pra identificar o fluxo, ex. 'Boas-vindas clínica'" },
      },
      required: ["business_id", "nome"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "fluxo_no_criar",
    title: "Criar um nó dentro de um fluxo (mensagem ou ação)",
    description:
      "Cria um passo (nó) dentro de um fluxo. Tipo 'mensagem': manda um texto e PÁRA esperando " +
      "resposta (adicione botões depois com fluxo_opcao_adicionar). Tipo 'acao': não manda " +
      "mensagem nenhuma, só executa um efeito (adicionar tag ou mudar etapa do pipeline) e " +
      "segue direto pro próximo nó (proximo_no_id) — útil pra marcar automaticamente sem a " +
      "pessoa perceber. IMPORTANTE: ainda não existe nó de 'esperar X minutos' — só dá pra " +
      "avançar por clique em botão.",
    inputSchema: {
      type: "object",
      properties: {
        fluxo_id: { type: "number" },
        tipo: { type: "string", enum: ["mensagem", "acao"] },
        texto: { type: "string", description: "obrigatório se tipo=mensagem" },
        acao_tipo: { type: "string", enum: ["tag", "pipeline"], description: "obrigatório se tipo=acao" },
        acao_valor: {
          type: "string",
          description: "se acao_tipo=tag: id numérico da tag (como texto). se acao_tipo=pipeline: id da etapa, ex. 'novo_lead'",
        },
        proximo_no_id: { type: "number", description: "só faz sentido em nó tipo 'acao' (mensagem usa fluxo_opcao_adicionar)" },
      },
      required: ["fluxo_id", "tipo"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "fluxo_definir_no_inicial",
    title: "Definir qual nó é o primeiro do fluxo",
    description: "Define qual nó dispara quando a conversa começa (primeiro contato, ou a pessoa manda 'menu').",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" }, no_id: { type: "number" } },
      required: ["fluxo_id", "no_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_opcao_adicionar",
    title: "Adicionar um botão a um nó de mensagem",
    description:
      "Adiciona um botão de resposta rápida a um nó tipo 'mensagem', levando a outro nó quando clicado. " +
      "Limite de 3 botões por mensagem (regra do WhatsApp) — pra mais opções, use uma pergunta em texto " +
      "livre em vez de botão (esta ferramenta não suporta captura de texto livre ainda).",
    inputSchema: {
      type: "object",
      properties: {
        no_id: { type: "number", description: "nó tipo 'mensagem' que vai receber o botão" },
        botao_id: { type: "string", description: "id curto e único, ex. 'sim', 'nao', 'agendar'" },
        botao_titulo: { type: "string", description: "texto do botão, máx. 20 caracteres" },
        proximo_no_id: { type: "number", description: "nó pra onde vai ao clicar" },
      },
      required: ["no_id", "botao_id", "botao_titulo", "proximo_no_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "fluxo_ativar",
    title: "Ativar um fluxo (passa a valer pro número de verdade)",
    description:
      "Ativa este fluxo — desativa automaticamente qualquer outro fluxo dinâmico do mesmo número " +
      "(só um ativo por vez). A partir daqui, conversas novas nesse número passam a usar este fluxo. " +
      "Confira o grafo inteiro com fluxo_obter_grafo antes de ativar.",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" }, business_id: { type: "string" } },
      required: ["fluxo_id", "business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_desativar",
    title: "Desativar um fluxo (volta pro atendimento padrão)",
    description: "Desativa o fluxo — o número volta a usar o atendimento padrão do sistema até outro fluxo ser ativado.",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" } },
      required: ["fluxo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_listar",
    title: "Listar os fluxos de um número",
    description: "Lista todos os fluxos dinâmicos já criados pra um número (ativos e inativos).",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_obter_grafo",
    title: "Ver o fluxo inteiro (todos os nós e botões)",
    description:
      "Retorna o fluxo completo — todo nó, seu texto/ação, e todos os botões com pra onde cada um leva. " +
      "Use isto pra revisar antes de ativar, ou pra entender um fluxo já existente antes de editar.",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" } },
      required: ["fluxo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "ads_atualizar_status",
    title: "Pausar ou ativar campanha/conjunto/anúncio",
    description:
      "Muda o status (ACTIVE ou PAUSED) de uma campanha, conjunto de anúncios ou anúncio " +
      "específico, pelo id. É a única ferramenta que liga um anúncio de verdade (passando a " +
      "gastar) — use com cuidado, só quando for pedido explicitamente pra ativar.",
    inputSchema: {
      type: "object",
      properties: {
        object_id: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
      },
      required: ["object_id", "status"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  },
];

function erroFerramenta(mensagem) {
  return { content: [{ type: "text", text: `Erro: ${mensagem}` }], isError: true };
}

function textoFerramenta(objeto) {
  return { content: [{ type: "text", text: JSON.stringify(objeto, null, 2) }], structuredContent: objeto };
}

// ctx = { db, wa, ads, agenda, PHONE_NUMBERS, resolverWabaDoNumero, normalizarTelefoneBR, enviarUmBroadcast }
async function chamarFerramenta(nome, args, ctx) {
  const a = args || {};
  switch (nome) {
    case "painel_listar_canais":
      return textoFerramenta({ canais: ctx.PHONE_NUMBERS });

    case "whatsapp_listar_templates": {
      const wabaId = await ctx.resolverWabaDoNumero(a.business_id);
      if (!wabaId) return erroFerramenta(`Não achei a WABA do número '${a.business_id}'. Confira o id com painel_listar_canais.`);
      const templates = await ctx.wa.listarTemplates(wabaId);
      return textoFerramenta({ templates: templates.filter((t) => t.status === "APPROVED") });
    }

    case "whatsapp_agendar_campanha": {
      if (!Array.isArray(a.contatos) || !a.contatos.length) return erroFerramenta("Informe ao menos um contato.");
      const itens = [];
      for (const c of a.contatos) {
        const timestamp = ctx.agenda.timestampDeDataHora(c.data_hora);
        itens.push({
          phone: ctx.normalizarTelefoneBR(c.telefone),
          name: c.nome || null,
          template: a.template,
          language: a.language || "pt_BR",
          bodyPreview: null,
          agendadoPara: timestamp,
        });
      }
      const agendados = await ctx.db.broadcastAgendarLote(a.business_id, itens);
      return textoFerramenta({ agendados });
    }

    case "whatsapp_listar_campanha_pendente": {
      const fila = await ctx.db.broadcastListarPendentes(a.business_id);
      return textoFerramenta({ fila });
    }

    case "agenda_publicar_post": {
      const resultado = await ctx.agenda.criarAgendamento({
        contaId: "felizcred",
        texto: a.texto || "",
        link: a.link || null,
        redes: a.redes,
        dataHoraString: a.data_hora,
      });
      return textoFerramenta(resultado);
    }

    case "agenda_listar_posts": {
      const posts = await ctx.agenda.listarRecentes(a.limite || 30);
      return textoFerramenta({ posts });
    }

    case "ads_pesquisar_publico": {
      const resultados = await ctx.ads.pesquisarPublico(a.termo, a.tipo || "adinterest");
      return textoFerramenta({ resultados });
    }

    case "ads_estimar_publico": {
      const estimativa = await ctx.ads.estimarPublico(a.targeting_spec, a.optimization_goal || "CONVERSATIONS");
      return textoFerramenta({ estimativa });
    }

    case "ads_criar_campanha": {
      const campanha = await ctx.ads.criarCampanha({
        nome: a.nome,
        objetivo: a.objetivo,
        categoriasEspeciais: a.categorias_especiais || [],
        status: "PAUSED",
      });
      return textoFerramenta({ campanha });
    }

    case "ads_criar_conjunto_anuncios": {
      const conjunto = await ctx.ads.criarConjuntoAnuncios({
        nome: a.nome,
        campanhaId: a.campanha_id,
        orcamentoDiarioCentavos: a.orcamento_diario_centavos,
        orcamentoTotalCentavos: a.orcamento_total_centavos,
        inicio: a.inicio,
        fim: a.fim,
        evento_cobranca: a.evento_cobranca || "IMPRESSIONS",
        meta_otimizacao: a.meta_otimizacao || "LINK_CLICKS",
        destino: a.destino,
        promotedObject: a.promoted_object,
        targeting: a.targeting,
        status: "PAUSED",
      });
      return textoFerramenta({ conjunto });
    }

    case "ads_criar_criativo_de_post_instagram": {
      const criativo = await ctx.ads.criarCreativoDePublicacaoInstagram({
        nome: a.nome,
        instagramMediaId: a.instagram_media_id,
        instagramUserId: a.instagram_user_id,
        callToAction: a.call_to_action,
      });
      return textoFerramenta({ criativo });
    }

    case "ads_criar_anuncio": {
      const anuncio = await ctx.ads.criarAnuncio({
        nome: a.nome,
        conjuntoId: a.conjunto_id,
        creativoId: a.criativo_id,
        status: "PAUSED",
      });
      return textoFerramenta({ anuncio });
    }

    case "ads_listar_campanhas": {
      const campanhas = await ctx.ads.listarCampanhas();
      const comInsights = await Promise.all(
        campanhas.map(async (c) => ({ ...c, insights: await ctx.ads.obterInsights(c.id).catch(() => null) }))
      );
      return textoFerramenta({ campanhas: comInsights });
    }

    case "fluxo_criar": {
      const fluxoId = await ctx.db.fluxoDinamicoCriar(a.business_id, a.nome);
      return textoFerramenta({ fluxo_id: fluxoId });
    }

    case "fluxo_no_criar": {
      if (a.tipo === "mensagem" && !a.texto) return erroFerramenta("Nó tipo 'mensagem' precisa de 'texto'.");
      if (a.tipo === "acao" && !a.acao_tipo) return erroFerramenta("Nó tipo 'acao' precisa de 'acao_tipo' ('tag' ou 'pipeline').");
      const noId = await ctx.db.fluxoNoCriar({
        fluxoId: a.fluxo_id,
        tipo: a.tipo,
        texto: a.texto,
        acaoTipo: a.acao_tipo,
        acaoValor: a.acao_valor,
        proximoNoId: a.proximo_no_id,
      });
      return textoFerramenta({ no_id: noId });
    }

    case "fluxo_definir_no_inicial": {
      await ctx.db.fluxoDinamicoDefinirNoInicial(a.fluxo_id, a.no_id);
      return textoFerramenta({ ok: true });
    }

    case "fluxo_opcao_adicionar": {
      if ((a.botao_titulo || "").length > 20) return erroFerramenta("botao_titulo passa de 20 caracteres (limite do WhatsApp).");
      const opcaoId = await ctx.db.fluxoOpcaoAdicionar({
        noId: a.no_id,
        botaoId: a.botao_id,
        botaoTitulo: a.botao_titulo,
        proximoNoId: a.proximo_no_id,
      });
      return textoFerramenta({ opcao_id: opcaoId });
    }

    case "fluxo_ativar": {
      await ctx.db.fluxoDinamicoAtivar(a.fluxo_id, a.business_id);
      return textoFerramenta({ ok: true });
    }

    case "fluxo_desativar": {
      await ctx.db.fluxoDinamicoDesativar(a.fluxo_id);
      return textoFerramenta({ ok: true });
    }

    case "fluxo_listar": {
      const fluxos = await ctx.db.fluxoDinamicoListar(a.business_id);
      return textoFerramenta({ fluxos });
    }

    case "fluxo_obter_grafo": {
      const [nos, opcoes] = await Promise.all([
        ctx.db.fluxoNosDoFluxo(a.fluxo_id),
        ctx.db.fluxoOpcoesDoFluxo(a.fluxo_id),
      ]);
      const opcoesPorNo = {};
      for (const o of opcoes) {
        (opcoesPorNo[o.no_id] = opcoesPorNo[o.no_id] || []).push(o);
      }
      return textoFerramenta({
        nos: nos.map((no) => ({ ...no, opcoes: opcoesPorNo[no.id] || [] })),
      });
    }

    case "ads_atualizar_status": {
      await ctx.ads.atualizarStatus(a.object_id, a.status);
      return textoFerramenta({ ok: true });
    }

    default:
      return erroFerramenta(`Ferramenta desconhecida: ${nome}`);
  }
}

// ─── Protocolo JSON-RPC (stateless — cada POST é uma requisição completa, sem sessão) ──────
async function handleRpc(mensagem, ctx) {
  const { id, method, params } = mensagem || {};
  const ehNotificacao = id === undefined;

  async function resultado(fn) {
    try {
      const result = await fn();
      return ehNotificacao ? null : { jsonrpc: "2.0", id, result };
    } catch (err) {
      if (ehNotificacao) return null;
      return { jsonrpc: "2.0", id, error: { code: -32603, message: err.message } };
    }
  }

  switch (method) {
    case "initialize":
      return resultado(async () => ({
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "painel-felizcred-mcp-server", version: "1.0.0" },
      }));

    case "notifications/initialized":
    case "notifications/cancelled":
      return null; // notificação — sem resposta

    case "tools/list":
      return resultado(async () => ({ tools: TOOLS }));

    case "tools/call":
      return resultado(async () => chamarFerramenta(params?.name, params?.arguments, ctx));

    case "ping":
      return resultado(async () => ({}));

    default:
      if (ehNotificacao) return null;
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Método desconhecido: ${method}` } };
  }
}

module.exports = { handleRpc, TOOLS };
