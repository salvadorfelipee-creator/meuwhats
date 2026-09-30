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
    name: "email_listar_templates",
    title: "Listar templates de e-mail",
    description: "Lista os templates de e-mail (assunto + corpo) já criados pra um número/negócio.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "email_criar_template",
    title: "Criar template de e-mail",
    description:
      "Cria um template de e-mail (assunto + corpo em HTML). Use {{nome}} no assunto ou no corpo " +
      "pra ser trocado automaticamente pelo nome do destinatário na hora de enviar.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        nome: { type: "string", description: "nome só pra identificar o template, ex. 'Aniversário'" },
        assunto: { type: "string" },
        corpo_html: { type: "string", description: "corpo do e-mail em HTML simples" },
      },
      required: ["business_id", "nome", "assunto", "corpo_html"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "email_agendar_campanha",
    title: "Agendar campanha de e-mail em massa",
    description:
      "Agenda o envio de UM template de e-mail pra uma lista de destinatários, cada um com seu " +
      "próprio horário. Mesma lógica da campanha de WhatsApp, mas por e-mail — não manda nada " +
      "na hora, só agenda.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        template_id: { type: "number" },
        contatos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              email: { type: "string" },
              nome: { type: "string" },
              data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM, horário de Brasília" },
            },
            required: ["email", "data_hora"],
          },
          minItems: 1,
        },
      },
      required: ["business_id", "template_id", "contatos"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "email_listar_pendentes",
    title: "Listar e-mails agendados ainda não enviados",
    description: "Lista a fila de e-mails agendados e ainda não enviados, pra um número/negócio.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "email_enviar_avulso",
    title: "Mandar e-mail avulso pro contato de uma conversa",
    description:
      "Manda um e-mail AGORA (não agendado) pro e-mail salvo de uma conversa específica, usando " +
      "um template existente. Só funciona se a conversa já tiver e-mail salvo (verifique antes " +
      "com painel_listar_canais/histórico — se não tiver, essa ferramenta retorna erro claro).",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        phone: { type: "string" },
        template_id: { type: "number" },
      },
      required: ["business_id", "phone", "template_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "retorno_criar",
    title: "Agendar um retorno/lembrete pra uma conversa (WhatsApp e/ou e-mail)",
    description:
      "Agenda um retorno futuro pra uma conversa específica — ex. 'falar de novo em 6 meses', " +
      "'aniversário', 'lembrete de reunião'. canal='whatsapp' manda um template aprovado (exige " +
      "whatsapp_template); canal='email' manda um template de e-mail pro e-mail salvo da conversa " +
      "(exige email_template_id, e a conversa precisa ter e-mail salvo); canal='ambos' faz os dois " +
      "no mesmo horário. whatsapp_params preenche as variáveis {{1}},{{2}}... do template NA ORDEM " +
      "(cada item pode usar os tokens {{nome}} e {{data}}, resolvidos na hora do envio) — sem " +
      "informar, só preenche {{1}} com o nome salvo da conversa (comportamento antigo). fluxo_id " +
      "conecta esse retorno a um fluxo dinâmico (ver fluxo_criar/fluxo_listar): a PRÓXIMA resposta " +
      "do contato, seja qual for o texto, dispara esse fluxo — use pra campanha de venda/retorno " +
      "'solto' onde o template é só um gancho (ex. 'Bom dia!') e a conversa de verdade acontece no " +
      "fluxo, em vez de cair no atendimento padrão do número.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        phone: { type: "string" },
        tipo: { type: "string", description: "rótulo livre, ex. 'retorno', 'aniversario', 'reuniao'", default: "retorno" },
        data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM, horário de Brasília" },
        canal: { type: "string", enum: ["whatsapp", "email", "ambos"] },
        whatsapp_template: { type: "string", description: "obrigatório se canal inclui whatsapp" },
        whatsapp_language: { type: "string", default: "pt_BR" },
        whatsapp_params: {
          type: "array",
          items: { type: "string" },
          description: "1 item por variável {{1}},{{2}}... do template, na ordem — pode usar {{nome}}/{{data}}",
        },
        fluxo_id: { type: "number", description: "fluxo dinâmico a disparar na próxima resposta do contato (opcional)" },
        email_template_id: { type: "number", description: "obrigatório se canal inclui email" },
      },
      required: ["business_id", "phone", "data_hora", "canal"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "retorno_listar",
    title: "Listar retornos agendados e ainda não enviados",
    description: "Lista todos os retornos pendentes de um número/negócio, ordenados por data — não filtra por conversa.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "retorno_cancelar",
    title: "Cancelar um retorno agendado",
    description: "Cancela um retorno que ainda não foi enviado (pelo id retornado em retorno_criar ou retorno_listar).",
    inputSchema: {
      type: "object",
      properties: { retorno_id: { type: "number" } },
      required: ["retorno_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "analytics_resumo",
    title: "Métricas reais de atendimento de um número (conversas, tempo de resposta, etc.)",
    description:
      "Retorna métricas reais de um número num período: total de conversas, conversas novas, " +
      "resolvidas, tempo médio de resposta humana, tempo médio de resolução, distribuição por " +
      "status/tag/etapa do pipeline e volume por dia. Chame uma vez por número (ver " +
      "painel_listar_canais) pra montar uma comparação entre vários números. NÃO inclui CSAT " +
      "nem produtividade por atendente — isso ainda não é medido pelo sistema, não invente.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        dias: { type: "number", minimum: 1, maximum: 365, default: 30 },
      },
      required: ["business_id"],
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
      "id, sempre pesquise primeiro). O termo é comparado por proximidade, não por sentido — " +
      "um produto/serviço (ex. 'consignado', 'FGTS') raramente existe como interesse direto no " +
      "Meta, e a busca pode devolver resultado genérico sem relação nenhuma. Pra produto/serviço, " +
      "pesquise o SETOR ou público-alvo (ex. 'aposentadoria', 'crédito', 'bancos') em vez do nome " +
      "do produto; tipo='adworktitle' funciona melhor pra cargo/profissão.",
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
      "pessoa perceber. Tipo 'horarios': consulta o Google Agenda de verdade (configure antes " +
      "com agenda_calendar_configurar) e manda os próximos horários livres como uma lista pro " +
      "cliente escolher; ao escolher, AGENDA DE VERDADE no Google Agenda e segue pro " +
      "proximo_no_id (opcional). 'texto' em 'horarios' é a mensagem antes da lista (opcional, " +
      "tem um padrão). IMPORTANTE: ainda não existe nó de 'esperar X minutos' — só dá pra " +
      "avançar por clique em botão/item da lista.",
    inputSchema: {
      type: "object",
      properties: {
        fluxo_id: { type: "number" },
        tipo: { type: "string", enum: ["mensagem", "acao", "horarios"] },
        texto: { type: "string", description: "obrigatório se tipo=mensagem; opcional se tipo=horarios" },
        acao_tipo: { type: "string", enum: ["tag", "pipeline"], description: "obrigatório se tipo=acao" },
        acao_valor: {
          type: "string",
          description: "se acao_tipo=tag: id numérico da tag (como texto). se acao_tipo=pipeline: id da etapa, ex. 'novo_lead'",
        },
        proximo_no_id: { type: "number", description: "nó tipo 'acao' ou 'horarios' (mensagem usa fluxo_opcao_adicionar)" },
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
      "Retorna o fluxo completo — nome, se está ativo, qual nó é o inicial, todo nó (com texto/ação) " +
      "e todos os botões com pra onde cada um leva. Use isto pra revisar antes de ativar, ou pra " +
      "entender um fluxo já existente antes de editar.",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" } },
      required: ["fluxo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_apagar",
    title: "Apagar um fluxo (definitivo)",
    description:
      "Apaga um fluxo inteiro — nós e botões junto. Só funciona com o fluxo já DESATIVADO " +
      "(fluxo_desativar primeiro). Sem volta, use pra limpar fluxo de teste que não serve mais.",
    inputSchema: {
      type: "object",
      properties: { fluxo_id: { type: "number" } },
      required: ["fluxo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "fluxo_gatilho_criar",
    title: "Criar um gatilho de palavra-chave pra um fluxo",
    description:
      "Faz um fluxo dinâmico ser disparado quando a pessoa manda um texto específico (ex.: 'botox', " +
      "'ortodontia'), mesmo sem ele estar 'ativo' — assim um número pode ter VÁRIOS fluxos, um por " +
      "assunto/produto, cada um com sua própria palavra-chave, em vez de só um fluxo padrão por vez. " +
      "O texto do cliente precisa bater EXATO com 'valor' (sem diferenciar maiúscula/minúscula/acento) " +
      "pra disparar — mesma regra da palavra-chave 'menu'. Não precisa ativar o fluxo pra isso funcionar.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        valor: { type: "string", description: "palavra-chave exata que o cliente digita, ex. 'botox'" },
        fluxo_id: { type: "number", description: "fluxo que deve começar quando bater essa palavra-chave" },
      },
      required: ["business_id", "valor", "fluxo_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "fluxo_gatilho_listar",
    title: "Listar os gatilhos de palavra-chave de um número",
    description: "Lista todos os gatilhos de palavra-chave cadastrados pra um número, com o fluxo que cada um dispara.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fluxo_gatilho_apagar",
    title: "Apagar um gatilho de palavra-chave",
    description: "Remove um gatilho — a palavra-chave deixa de disparar o fluxo (o fluxo em si continua existindo).",
    inputSchema: {
      type: "object",
      properties: { gatilho_id: { type: "number" } },
      required: ["gatilho_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "agenda_calendar_configurar",
    title: "Configurar expediente do Google Agenda pra um número",
    description:
      "Define qual agenda do Google e qual expediente (dias úteis seg-sex, hora de início/fim, duração do " +
      "atendimento) usar quando esse número oferecer horário pro cliente escolher. Sem configurar, usa o " +
      "padrão: agenda 'primary', 9h-18h, atendimentos de 60min. Precisa da conta Google já autorizada com o " +
      "escopo de Calendar (ver /painel/api/google/autorizar) — sem isso as outras ferramentas de agenda falham.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        calendario_id: { type: "string", description: "id da agenda no Google Calendar, ex. 'primary' ou um e-mail de agenda compartilhada" },
        hora_inicio: { type: "number", description: "hora de início do expediente, 0-23" },
        hora_fim: { type: "number", description: "hora de fim do expediente, 0-23" },
        duracao_minutos: { type: "number", description: "duração de cada atendimento em minutos" },
      },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "agenda_calendar_horarios_disponiveis",
    title: "Ver próximos horários livres na agenda",
    description:
      "Consulta o Google Agenda de verdade (freebusy) e devolve os próximos horários realmente livres, " +
      "dentro do expediente configurado (ver agenda_calendar_configurar). Use antes de oferecer horário pro " +
      "cliente — nunca invente horário sem checar aqui primeiro.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        dias_a_frente: { type: "number", description: "quantos dias pra frente olhar, padrão 14" },
        max_resultados: { type: "number", description: "quantos horários devolver, padrão 10" },
      },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: "agenda_calendar_agendar",
    title: "Criar o evento na agenda (agendar de verdade)",
    description:
      "Cria o evento na Google Agenda pro horário escolhido — use um horário que veio de " +
      "agenda_calendar_horarios_disponiveis (mesmo inicio_iso/fim_iso), pra não marcar em cima de outro " +
      "compromisso. Isto AGENDA DE VERDADE, não é rascunho.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        titulo: { type: "string", description: "ex. 'Consulta - Maria Silva'" },
        descricao: { type: "string" },
        inicio_iso: { type: "string", description: "data/hora ISO 8601, ex. '2026-10-05T14:00:00-03:00'" },
        fim_iso: { type: "string" },
        attendee_email: { type: "string", description: "opcional — convida o cliente por e-mail se ele tiver passado um" },
      },
      required: ["business_id", "titulo", "inicio_iso", "fim_iso"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "crm_campo_personalizado_criar",
    title: "Criar um campo personalizado do CRM",
    description:
      "Cria um campo personalizado pro negócio (ex. 'Convênio', 'Procedimento de interesse', 'Data de nascimento') " +
      "— depois disso ele aparece pra preencher em toda conversa desse número.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" }, nome: { type: "string" } },
      required: ["business_id", "nome"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "crm_campo_personalizado_listar",
    title: "Listar campos personalizados do CRM",
    description: "Lista os campos personalizados definidos pra esse número.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" } },
      required: ["business_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "crm_contato_campo_definir",
    title: "Preencher um campo personalizado de um contato",
    description: "Define o valor de um campo personalizado (ver crm_campo_personalizado_listar pra saber os ids) pra um contato específico.",
    inputSchema: {
      type: "object",
      properties: {
        business_id: { type: "string" },
        phone: { type: "string" },
        campo_id: { type: "number" },
        valor: { type: "string" },
      },
      required: ["business_id", "phone", "campo_id", "valor"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "crm_contato_perfil",
    title: "Ver o perfil completo de um contato (CRM)",
    description:
      "Devolve tudo que o CRM sabe sobre um contato: campos personalizados preenchidos, notas (histórico) e a " +
      "linha do tempo de atividades (tag/etapa/campo/retorno) — use pra responder 'o que sabemos sobre esse cliente'.",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" }, phone: { type: "string" } },
      required: ["business_id", "phone"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "crm_contato_nota_adicionar",
    title: "Adicionar uma nota ao histórico do contato",
    description: "Adiciona uma nota datada ao histórico do contato (diferente da 'nota interna' única — aqui fica um histórico completo).",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string" }, phone: { type: "string" }, texto: { type: "string" } },
      required: ["business_id", "phone", "texto"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
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

// ctx = { db, wa, ads, agenda, google, PHONE_NUMBERS, resolverWabaDoNumero, normalizarTelefoneBR, enviarUmBroadcast, enviarEmail }
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

    case "email_listar_templates": {
      const templates = await ctx.db.emailTemplatesListar(a.business_id);
      return textoFerramenta({ templates });
    }

    case "email_criar_template": {
      const id = await ctx.db.emailTemplateCriar({
        businessId: a.business_id,
        nome: a.nome,
        assunto: a.assunto,
        corpoHtml: a.corpo_html,
      });
      return textoFerramenta({ template_id: id });
    }

    case "email_agendar_campanha": {
      if (!Array.isArray(a.contatos) || !a.contatos.length) return erroFerramenta("Informe ao menos um contato.");
      const itens = a.contatos.map((c) => ({
        email: c.email,
        nome: c.nome || null,
        templateId: a.template_id,
        agendadoPara: ctx.agenda.timestampDeDataHora(c.data_hora),
      }));
      const agendados = await ctx.db.emailAgendarLote(a.business_id, itens);
      return textoFerramenta({ agendados });
    }

    case "email_listar_pendentes": {
      const fila = await ctx.db.emailListarPendentes(a.business_id);
      return textoFerramenta({ fila });
    }

    case "email_enviar_avulso": {
      const conversa = await ctx.db.getConversation(a.phone, a.business_id);
      if (!conversa?.email) return erroFerramenta("Essa conversa não tem e-mail salvo.");
      const template = await ctx.db.emailTemplateObter(a.template_id);
      if (!template) return erroFerramenta(`Template ${a.template_id} não encontrado.`);
      const nome = conversa.name || "Cliente";
      const assunto = template.assunto.replace(/\{\{nome\}\}/g, nome);
      const html = template.corpo_html.replace(/\{\{nome\}\}/g, nome);
      await ctx.enviarEmail({ to: conversa.email, toNome: nome, subject: assunto, html });
      return textoFerramenta({ ok: true });
    }

    case "retorno_criar": {
      if ((a.canal === "whatsapp" || a.canal === "ambos") && !a.whatsapp_template) {
        return erroFerramenta("canal inclui whatsapp — informe whatsapp_template.");
      }
      if ((a.canal === "email" || a.canal === "ambos") && !a.email_template_id) {
        return erroFerramenta("canal inclui email — informe email_template_id.");
      }
      const id = await ctx.db.retornoCriar({
        businessId: a.business_id,
        phone: a.phone,
        tipo: a.tipo || "retorno",
        dataAgendada: ctx.agenda.timestampDeDataHora(a.data_hora),
        canal: a.canal,
        whatsappTemplate: a.whatsapp_template,
        whatsappLanguage: a.whatsapp_language || "pt_BR",
        whatsappParams: Array.isArray(a.whatsapp_params) ? a.whatsapp_params : undefined,
        fluxoId: a.fluxo_id,
        emailTemplateId: a.email_template_id,
      });
      return textoFerramenta({ retorno_id: id });
    }

    case "retorno_listar": {
      const retornos = await ctx.db.retornoListarPendentes(a.business_id);
      return textoFerramenta({ retornos });
    }

    case "retorno_cancelar": {
      const ok = await ctx.db.retornoCancelar(a.retorno_id);
      if (!ok) return erroFerramenta("Não deu pra cancelar — já foi enviado ou já está sendo enviado agora.");
      return textoFerramenta({ ok: true });
    }

    case "analytics_resumo": {
      const dias = Math.max(1, Math.min(365, Number(a.dias) || 30));
      const ate = Date.now();
      const desde = ate - dias * 24 * 60 * 60 * 1000;
      const dados = await ctx.db.analyticsResumo(a.business_id, desde, ate);
      return textoFerramenta({ ...dados, dias, desde, ate });
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
      const [fluxo, nos, opcoes] = await Promise.all([
        ctx.db.fluxoDinamicoObter(a.fluxo_id),
        ctx.db.fluxoNosDoFluxo(a.fluxo_id),
        ctx.db.fluxoOpcoesDoFluxo(a.fluxo_id),
      ]);
      if (!fluxo) return erroFerramenta(`Fluxo ${a.fluxo_id} não encontrado.`);
      const opcoesPorNo = {};
      for (const o of opcoes) {
        (opcoesPorNo[o.no_id] = opcoesPorNo[o.no_id] || []).push(o);
      }
      return textoFerramenta({
        fluxo,
        nos: nos.map((no) => ({ ...no, opcoes: opcoesPorNo[no.id] || [] })),
      });
    }

    case "fluxo_apagar": {
      const resultado = await ctx.db.fluxoDinamicoApagar(a.fluxo_id);
      if (!resultado.ok) return erroFerramenta(resultado.motivo);
      return textoFerramenta({ ok: true });
    }

    case "fluxo_gatilho_criar": {
      const id = await ctx.db.fluxoGatilhoCriar({ businessId: a.business_id, tipo: "palavra_chave", valor: a.valor, fluxoId: a.fluxo_id });
      return textoFerramenta({ gatilho_id: id });
    }

    case "fluxo_gatilho_listar": {
      const gatilhos = await ctx.db.fluxoGatilhosDoNegocio(a.business_id);
      return textoFerramenta({ gatilhos });
    }

    case "fluxo_gatilho_apagar": {
      await ctx.db.fluxoGatilhoApagar(a.gatilho_id);
      return textoFerramenta({ ok: true });
    }

    case "agenda_calendar_configurar": {
      await ctx.db.agendaCalendarioConfigDefinir(a.business_id, {
        calendarioId: a.calendario_id,
        horaInicio: a.hora_inicio,
        horaFim: a.hora_fim,
        duracaoMinutos: a.duracao_minutos,
      });
      return textoFerramenta({ ok: true });
    }

    case "agenda_calendar_horarios_disponiveis": {
      const config = await ctx.db.agendaCalendarioConfigObter(a.business_id);
      try {
        const slots = await ctx.google.horariosDisponiveis({
          calendarioId: config?.calendario_id,
          horaInicio: config?.hora_inicio,
          horaFim: config?.hora_fim,
          duracaoMinutos: config?.duracao_minutos,
          diasAFrente: a.dias_a_frente,
          maxResultados: a.max_resultados,
        });
        return textoFerramenta({ horarios: slots });
      } catch (err) {
        return erroFerramenta(`${err.message} — provavelmente falta autorizar o Google com o escopo de Calendar (reautorize em /painel/api/google/autorizar).`);
      }
    }

    case "agenda_calendar_agendar": {
      const config = await ctx.db.agendaCalendarioConfigObter(a.business_id);
      try {
        const evento = await ctx.google.criarEvento({
          calendarioId: config?.calendario_id,
          titulo: a.titulo,
          descricao: a.descricao,
          inicioISO: a.inicio_iso,
          fimISO: a.fim_iso,
          attendeeEmail: a.attendee_email,
        });
        return textoFerramenta({ ok: true, evento_id: evento.id, link: evento.htmlLink });
      } catch (err) {
        return erroFerramenta(err.message);
      }
    }

    case "crm_campo_personalizado_criar": {
      const id = await ctx.db.campoPersonalizadoCriar(a.business_id, a.nome);
      return textoFerramenta({ campo_id: id });
    }

    case "crm_campo_personalizado_listar": {
      return textoFerramenta({ campos: await ctx.db.camposPersonalizadosListar(a.business_id) });
    }

    case "crm_contato_campo_definir": {
      await ctx.db.conversationCampoDefinir(a.business_id, a.phone, a.campo_id, a.valor);
      return textoFerramenta({ ok: true });
    }

    case "crm_contato_perfil": {
      const [campos, notas, atividades] = await Promise.all([
        ctx.db.conversationCamposObter(a.business_id, a.phone),
        ctx.db.notasDaConversa(a.business_id, a.phone),
        ctx.db.atividadesDaConversa(a.business_id, a.phone),
      ]);
      return textoFerramenta({ campos, notas, atividades });
    }

    case "crm_contato_nota_adicionar": {
      const id = await ctx.db.notaAdicionar(a.business_id, a.phone, a.texto);
      return textoFerramenta({ nota_id: id });
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
