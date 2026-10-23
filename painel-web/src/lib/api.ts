// Cliente da API do painel (server.js) — mesmo backend de sempre, autenticação Basic Auth
// igual ao painel.html antigo. Guardamos usuário/senha no localStorage pra não pedir login
// de novo a cada F5 (mesmo comportamento do navegador com Basic Auth nativo).

const AUTH_KEY = "painel_auth"

export type PhoneNumber = { id: string; label: string }

export type Conversation = {
  phone: string
  business_number_id: string
  name: string | null
  last_message_at: number | null
  nota: string | null
  status: string | null
  fluxo_passo: string | null
  last_type?: string | null
  last_body?: string | null
  last_direction?: "in" | "out" | null
  channel?: "whatsapp" | "instagram" | "site"
  last_inbound_at?: number | null
  last_read_at?: number | null
  last_seen_at?: number | null
  nao_lida?: boolean | number
  resolvido_em?: number | null
  pipeline_estagio?: string | null
  pipeline_estagio_desde?: number | null
  produto_tag?: string | null
  tags_json?: string | null
  campos_json?: string | null
  email?: string | null
  foto_url?: string | null
  // Nome de quem respondeu por último pelo painel (ou "humano", login único antigo) — null/vazio
  // = resposta automática (fluxo/template), não um atendente.
  last_origem?: string | null
  // Sugestão de resposta da IA ("copiloto de vendas") pré-computada em background pelo servidor
  // e cacheada na linha da conversa — só é considerada válida quando copiloto_cache_em bate com
  // last_message_at (ver api.sugestaoResposta), senão apareceria desatualizada.
  copiloto_texto?: string | null
  copiloto_insight?: string | null
  copiloto_cache_em?: number | null
}

// Identidade de quem está logado (GET /painel/api/me) — vem do login de verdade (tabela
// `usuarios`, ver db.js), com papel e a lista de canais que essa pessoa vê por padrão (null =
// sem restrição, admin ou fallback PAINEL_USER/PAINEL_PASS).
export type Identidade = {
  nome: string
  usuario: string
  papel: "admin" | "atendente"
  canais_padrao: string[] | null
  // Etapas do pipeline em que ESSA pessoa quer notificação urgente/piscando — null/[] = só
  // notificação normal (calma), nunca por etapa. Admin ignora esse campo por design (sempre
  // calmo). Sempre array (nunca null) — o backend já normaliza.
  etapas_notificacao: string[]
}

export type Usuario = {
  id: number
  nome: string
  usuario: string
  papel: "admin" | "atendente"
  canais_padrao: string[] | null
  etapas_notificacao: string[]
  ativo: boolean
  created_at: number
}

export type MinhaConversa = {
  phone: string
  name: string | null
  business_number_id: string
  channel: "whatsapp" | "instagram"
  last_message_at: number | null
  last_body: string | null
  pipeline_estagio: string | null
}

export type SiteChatConversation = {
  id: string
  name: string
  contact: string | null
  email: string | null
  page_url: string | null
  status: "open" | "closed"
  created_at: number
  updated_at: number
  last_visitor_at: number | null
  last_agent_at: number | null
  last_read_at: number | null
  last_message?: string | null
  unread?: number | boolean
  pipeline_estagio?: string | null
  pipeline_estagio_desde?: number | null
  produto_tag?: string | null
  human_intent_stage?: "awaiting_question" | "awaiting_confirmation" | "requested" | "human_active" | null
  human_handoff_requested_at?: number | null
}

export type SiteChatMessage = {
  id: number
  conversation_id: string
  direction: "visitor" | "agent"
  body: string
  sender_name: string | null
  created_at: number
  type: "text" | "image" | "video" | "audio" | "document"
  media_url: string | null
  media_mime: string | null
  file_name: string | null
}

export type SiteChatClt = {
  provider: string
  etapa: string
  status: string | null
  proposalCode?: string | null
  contractLink?: string | null
  selectedOffer?: {
    installments: number
    installmentValue: number
    disbursedAmount: number
  } | null
  error?: string | null
}

export type Tag = { id: number; business_number_id: string; nome: string; cor: string; created_at: number }

export type CampoPersonalizado = { id: number; business_id: string; nome: string; created_at: number }
export type CampoValor = { campo_id: number; nome: string; valor: string | null }
export type NotaConversa = { id: number; business_id: string; phone: string; texto: string; created_at: number }
export type AtividadeConversa = { id: number; business_id: string; phone: string; tipo: string; descricao: string; created_at: number }
export type FluxoDinamico = { id: number; business_id: string; nome: string; ativo: number; no_inicial_id: number | null; created_at: number }

export type SugestaoIa = {
  etapa_id: string | null
  confianca: "alta" | "media" | "baixa"
  campos: { campo_id: number; nome: string; valor: string }[]
  resumo: string
}

export type EmailTemplate = { id: number; business_id: string; nome: string; assunto: string; corpo_html: string; created_at: number }

export type EmailAgendado = {
  id: number
  destinatario_email: string
  destinatario_nome: string | null
  agendado_para: number
  template_nome: string
}

export type Retorno = {
  id: number
  business_id: string
  phone: string
  tipo: string
  data_agendada: number
  canal: "whatsapp" | "email" | "ambos"
  whatsapp_template: string | null
  whatsapp_language: string | null
  email_template_id: number | null
  status: string
  erro: string | null
  enviado_em: number | null
  created_at: number
}

// Etapas fixas do pipeline de atendimento/vendas — hoje só usadas no número principal da
// Felizcred (ver ANALYTICS_BUSINESS_ID em chats.tsx/analytics.tsx). Cada conversa guarda o
// `id` de uma etapa em `pipeline_estagio` (texto livre no banco, mas só estes valores aparecem
// no seletor do painel).
export const PIPELINE_ESTAGIOS = [
  { id: "novo_lead", nome: "Novo lead", cor: "#64748b" },
  { id: "qualificacao", nome: "Em qualificação", cor: "#2563eb" },
  { id: "documentos", nome: "Documentos enviados", cor: "#7c3aed" },
  { id: "analise", nome: "Em análise", cor: "#d97706" },
  { id: "aprovado", nome: "Aprovado", cor: "#16a34a" },
  { id: "perdido", nome: "Perdido", cor: "#dc2626" },
] as const

export type PipelineEstagioId = (typeof PIPELINE_ESTAGIOS)[number]["id"]

// Qualificação genérica — usada em qualquer canal que não seja o funil de empréstimo da
// Felizcred (ver pipelineEstagiosPara abaixo). Cobre o caso simples "é novo, já foi atendido ou
// já é cliente" pedido pra outros negócios (ex. clínica), sem depender de usuário por atendente.
export const PIPELINE_ESTAGIOS_GENERICO = [
  { id: "novo", nome: "Novo contato", cor: "#64748b" },
  { id: "em_atendimento", nome: "Em atendimento", cor: "#2563eb" },
  { id: "cliente", nome: "Já é cliente", cor: "#16a34a" },
  { id: "perdido", nome: "Perdido/não interessado", cor: "#dc2626" },
] as const

// Cada canal pode ter sua própria lista de etapas — hoje só a Felizcred tem uma lista própria
// (funil de empréstimo); qualquer outro canal usa a genérica acima.
export function pipelineEstagiosPara(label: string | undefined) {
  return label === CANAL_ANALYTICS_LABEL ? PIPELINE_ESTAGIOS : PIPELINE_ESTAGIOS_GENERICO
}

// Analytics/tags/pipeline hoje só existem pro número principal da Felizcred — identificado
// pelo label (não por ID fixo, que já mudou antes numa migração de WABA). Usado tanto pela
// tela de Analytics quanto pelo chat (pra saber quando mostrar o seletor de tags/etapa).
export const CANAL_ANALYTICS_LABEL = "Felizcred (principal)"

// Campo "Responsável" dessa conversa, se preenchido — mesmo parse que camposDe() em
// chats.tsx/pipeline.tsx faz localmente; duplicado aqui de propósito (api.ts não deveria
// importar das telas, ciclo de import) só pra decidir urgência de notificação (ver
// conversaEhUrgente abaixo).
function campoResponsavelDe(c: Conversation): string | null {
  if (!c.campos_json) return null
  try {
    const campos = JSON.parse(c.campos_json) as Record<string, string>
    return campos["Responsável"] || null
  } catch {
    return null
  }
}

// Decide se uma conversa não lida deve "piscar" (urgente, chama atenção na hora) ou só notificar
// calmo (badge sólido, sem animação) pra pessoa LOGADA agora. Usado em chats.tsx (lista de
// conversas) e pipeline.tsx (cartão do kanban) — mesma regra nos dois lugares. Ordem de
// precedência:
//   1. Admin NUNCA pisca — calmo por design, mesmo com etapas_notificacao preenchido.
//   2. Conversa ATRIBUÍDA (campo "Responsável") a alguém — só ESSA pessoa pisca, mesmo que a
//      etapa da conversa não esteja na lista dela. Com Responsável preenchido, a checagem de
//      etapa nem roda — pra mais ninguém, nem pra quem "bateria" por etapa.
//   3. Sem "Responsável": pisca se a etapa atual (pipeline_estagio, ou "novo_lead" quando a
//      conversa ainda não tem etapa salva) está na lista etapas_notificacao da pessoa. Lista
//      vazia/ausente = nunca pisca por etapa.
// Minutos sem NENHUMA resposta (bot ou humano) à última mensagem do cliente antes de virar
// alerta universal de "sem resposta" — diferente de conversaEhUrgente acima: não depende de
// quem está logado, de etapa, nem de Responsável; é puramente "faz tempo que ninguém
// respondeu", pensado pra pegar os casos onde o bot "ficou surdo" (handoff pra humano sem
// ninguém notar) ou uma mensagem automática falhou no meio do caminho.
export const LIMITE_SEM_RESPOSTA_MS = 30 * 60 * 1000

export function conversaSemRespostaHaMuitoTempo(c: Conversation): boolean {
  if (!c.nao_lida) return false
  if (c.last_direction !== "in") return false
  if (!c.last_message_at) return false
  return Date.now() - c.last_message_at > LIMITE_SEM_RESPOSTA_MS
}

export function conversaEhUrgente(c: Conversation, identidade: Identidade | null): boolean {
  if (!identidade || identidade.papel === "admin") return false
  const responsavel = campoResponsavelDe(c)
  if (responsavel) return responsavel.toLowerCase() === identidade.nome.toLowerCase()
  const etapas = identidade.etapas_notificacao || []
  if (!etapas.length) return false
  const estagio = c.pipeline_estagio || "novo_lead"
  return etapas.includes(estagio)
}

export type AnalyticsResumo = {
  totalConversas: number
  novasConversas: number
  conversasResolvidas: number
  taxaResolucao: number | null
  tempoMedioRespostaHumanaMs: number | null
  amostrasRespostaHumana: number
  tempoMedioResolucaoMs: number | null
  amostrasResolucao: number
  porStatus: { status: string; total: number }[]
  porTag: { id: number; nome: string; cor: string; total: number }[]
  porEstagio: { estagio: string; total: number }[]
  porDia: { dia: string; mensagens: number; conversas: number }[]
  porDirecao: { direction: "in" | "out"; total: number }[]
  // Histograma de hora do dia (0-23, horário de Brasília) — staffing/plantão.
  porHora: { hora: number; total: number }[]
  // Mensagens enviadas por atendente (origem = nome de quem está logado, ver lib/api.ts
  // identidade) — só aparece volume de verdade depois que a equipe estiver logando por pessoa.
  porAtendente: { atendente: string; mensagens: number; conversas: number }[]
  // Só presente quando mais de 1 canal foi pedido de uma vez (ver `api.analytics` com array) —
  // divisão do total de conversas por canal, pra mostrar a barra "Todos os canais".
  porCanal?: { id: string; label: string; totalConversas: number }[]
  dias: number
  desde: number
  ate: number
}

export type Message = {
  id: number
  phone: string
  business_number_id: string
  direction: "in" | "out"
  type: string
  body: string | null
  media_path: string | null
  media_mime: string | null
  status: string | null
  error_message: string | null
  wa_message_id: string | null
  // wa_message_id de uma mensagem anterior citada ("reply" em cima dela) — null na maioria.
  context_wa_id?: string | null
  // Quem mandou (nome de quem estava logado no painel) — null/ausente = resposta automática.
  origem?: string | null
  created_at: number
}

// Diretório de contatos cross-canal (tela Contatos) — reaproveita os mesmos dados de
// Conversas, só agregado e filtrável.
export type Contato = {
  phone: string
  name: string | null
  business_number_id: string
  channel: "whatsapp" | "instagram"
  last_message_at: number | null
  pipeline_estagio: string | null
  tags_json: string | null
  email: string | null
  foto_url: string | null
  // CRM de verdade — mesmos campos personalizados que já aparecem nos Detalhes do contato
  // (Interesse, Origem, Valor solicitado, Responsável etc.). google_sincronizado: tem
  // google_contact_resource_name salvo (já foi sincronizado com o Google Contatos em algum
  // momento).
  campos: Record<string, string>
  google_sincronizado: boolean
}

export type ImportarContatoLinha = {
  nome?: string
  telefone: string
  email?: string
  etapa?: string
  tags?: string[]
  campos?: Record<string, string>
  googleResourceName?: string
}

export type GoogleContato = { resourceName: string; nome: string | null; telefone: string | null; email: string | null }

export type RespostaPronta = { id: number; atalho: string; texto: string; uso_count?: number }

// Mesmo telefone, conversa em outro canal — ver ContactDetails em chats.tsx, só informativo.
export type OutroCanal = { business_number_id: string; name: string | null; last_message_at: number | null }

export type RetornoComContato = Retorno & {
  name: string | null
  channel: "whatsapp" | "instagram"
}

// Sugestão de retorno pendente — gerada pela IA (etapa parada) ou pelo radar de inatividade
// (tempo parado, sem IA). "pendente" até alguém aprovar (vira retorno de verdade, template/canal
// escolhido na hora) ou descartar. "Aprovar" NUNCA envia nada sozinho.
export type SugestaoRetorno = {
  id: number
  business_id: string
  phone: string
  name: string | null
  tipo: "etapa_parada" | "inatividade"
  motivo: string
  status: "pendente" | "aprovado" | "descartado"
  created_at: number
}

export type BroadcastContact = { phone: string; name?: string }
export type BroadcastResult = { phone: string; ok: boolean; error?: string }
export type TemplateInfo = { name: string; status: string; language: string; category: string }
export type BroadcastFilaItem = { id: number; phone: string; name: string | null; template: string; agendado_para: number }

export type Rede = "instagram" | "instagram_story" | "facebook" | "twitter" | "linkedin" | "threads"

export type ContaPublicar = { id: string; nome: string; redesDisponiveis: Rede[] }

export type AgendaStatus = "pending" | "processing" | "posted" | "error"

export type AgendaItem = {
  id: number
  conta_id: string
  texto: string | null
  link: string | null
  redes: Rede[]
  agendado_para: number
  status: AgendaStatus
  imagemUrl: string | null
  imagemUrls: string[] | null
  videoUrl: string | null
  resultado: string | null
  tentativas: number
  created_at: number
  posted_at: number | null
}

export type AgendaResumo = { pending: number; posted: number; error: number; total: number }

export type PublicarResultado = Record<string, { ok: boolean; erro?: string }>

// dataHoraLocal no formato de <input type="datetime-local"> — "2026-08-20T09:30"
export type CriarAgendamentoPayload = {
  contaId: string
  texto?: string
  link?: string
  redes: Rede[]
  data: string
  imagemBase64?: string
  imagensBase64?: string[]
}

export type ReelsStatus = "pending" | "processing" | "posted" | "error"

export type ReelsItem = {
  id: number
  drive_file_id: string
  nome_arquivo: string
  posicao: number
  legenda: string | null
  agendado_para: number | null
  status: ReelsStatus
  resultado: string | null
  tentativas: number
  created_at: number
  posted_at: number | null
  data_prevista?: number
  exato?: boolean
}

export type ReelsResumo = { pending: number; posted: number; error: number; total: number }

export type ReelsEspaco = { usados: number; limite: number; percentual: number; bloqueado: boolean }

export type ReelsStatusResponse = {
  resumo: ReelsResumo
  recentes: ReelsItem[]
  pausado: boolean
  postsPorDia: number
  legendaPadrao: string
  espaco: ReelsEspaco | null
}

export type FunilResponse = {
  dias: number
  etapas: {
    clt_menu_escolhido: number
    clt_qualificado: number
    clt_dados_completos: number
    campanha_clique: number
    campanha_dados_completos: number
  }
  site: {
    etapas: Record<string, number>
    paradas: { etapa: string; total: number; silenciosos: number }[]
    motivos: { motivo: string; total: number }[]
  }
}

function getCredentials(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function setCredentials(user: string, pass: string) {
  const encoded = btoa(`${user}:${pass}`)
  localStorage.setItem(AUTH_KEY, encoded)
}

export function clearCredentials() {
  localStorage.removeItem(AUTH_KEY)
}

export function isLoggedIn() {
  return !!getCredentials()
}

// Token assinado pro servidor servir /media/:filename sem Basic Auth — <img>/<audio> não
// conseguem mandar o header Authorization (recurso de navegador, não um fetch customizado), sem
// isso o navegador mostrava o popup nativo feio toda vez que a conversa tinha mídia. Guardado só
// em memória (não localStorage — token de 24h, perder no F5 não é problema, essa função busca um
// novo sozinha). `mediaUrl` cai pra URL sem token se ainda não buscou (janela raríssima logo após
// o login).
let mediaToken: string | null = null

export async function garantirMediaToken() {
  try {
    const resp = await request<{ token: string }>("/painel/api/media-token")
    mediaToken = resp.token
  } catch {
    mediaToken = null
  }
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (!mediaToken || !path.startsWith("/media/")) return path
  const separador = path.includes("?") ? "&" : "?"
  return `${path}${separador}token=${encodeURIComponent(mediaToken)}`
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const creds = getCredentials()
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(creds ? { Authorization: `Basic ${creds}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401) {
    clearCredentials()
    throw new ApiError(401, "Usuário ou senha inválidos")
  }
  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const data = await res.json()
      message = data.error || message
    } catch {
      // resposta sem corpo JSON
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Basic Auth não tem endpoint de "login" próprio — testamos as credenciais chamando um
// endpoint autenticado já existente (/painel/api/numbers) e vemos se a Meta... digo, o
// server.js aceita.
export async function login(user: string, pass: string): Promise<void> {
  const encoded = btoa(`${user}:${pass}`)
  const res = await fetch("/painel/api/numbers", {
    headers: { Authorization: `Basic ${encoded}` },
  })
  if (!res.ok) throw new ApiError(res.status, "Usuário ou senha inválidos")
  localStorage.setItem(AUTH_KEY, encoded)
}

export const api = {
  numbers: () => request<PhoneNumber[]>("/painel/api/numbers"),

  // ── Identidade e usuários (login por pessoa) ─────────────────────────────────────────────
  me: () => request<Identidade>("/painel/api/me"),

  tursoUso: () =>
    request<{ configurado: boolean; ok?: boolean; pct?: number; pctLeituras?: number; leituras?: number; limiteLeituras?: number; pctEscritas?: number; erro?: string }>("/painel/api/turso/uso"),
  bandaUso: () => request<{ mes: string; gb: number; limiteGb: number; pct: number }>("/painel/api/banda/uso"),
  factaStatus: () => request<{ ok: boolean; checadoEm: number; erro?: string }>("/painel/api/facta/status"),
  siteChatConversas: () => request<SiteChatConversation[]>("/painel/api/site-chat/conversations"),
  siteChatConversa: (id: string) =>
    request<{ conversation: SiteChatConversation; messages: SiteChatMessage[]; clt: SiteChatClt | null }>(
      `/painel/api/site-chat/conversations/${encodeURIComponent(id)}`,
    ),
  siteChatResponder: (id: string, payload: string | {
    message?: string
    imagemBase64?: string
    videoBase64?: string
    audioBase64?: string
    documentBase64?: string
    fileName?: string
  }) =>
    request<{ ok: true }>(`/painel/api/site-chat/conversations/${encodeURIComponent(id)}/reply`, {
      method: "POST",
      body: JSON.stringify(typeof payload === "string" ? { message: payload } : payload),
    }),
  siteChatStatus: (id: string, status: "open" | "closed") =>
    request<{ ok: true }>(`/painel/api/site-chat/conversations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  siteChatPipeline: (id: string, estagio: string) =>
    request<{ ok: true }>(`/painel/api/site-chat/conversations/${encodeURIComponent(id)}/pipeline`, {
      method: "PATCH",
      body: JSON.stringify({ estagio }),
    }),

  usuarios: () => request<Usuario[]>("/painel/api/usuarios"),

  criarUsuario: (payload: {
    nome: string
    usuario: string
    senha: string
    papel: "admin" | "atendente"
    canais_padrao?: string[] | null
    etapas_notificacao?: string[] | null
  }) => request<{ id: number }>("/painel/api/usuarios", { method: "POST", body: JSON.stringify(payload) }),

  atualizarUsuario: (
    id: number,
    payload: {
      nome?: string
      papel?: "admin" | "atendente"
      canais_padrao?: string[] | null
      etapas_notificacao?: string[] | null
      ativo?: boolean
    },
  ) => request<{ ok: true }>(`/painel/api/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  redefinirSenhaUsuario: (id: number, senha: string) =>
    request<{ ok: true }>(`/painel/api/usuarios/${id}/senha`, { method: "POST", body: JSON.stringify({ senha }) }),

  // ── "Atribuídas a mim" entre canais (handoff SDR → fechamento) ───────────────────────────
  minhasConversas: () => request<MinhaConversa[]>("/painel/api/minhas-conversas"),

  // ── Contatos (diretório cross-canal, busca por nome/telefone/etapa) ─────────────────────
  contatos: (opts?: { q?: string; estagio?: string; tag?: string; email?: "com" | "sem" }) => {
    const params = new URLSearchParams()
    if (opts?.q) params.set("q", opts.q)
    if (opts?.estagio) params.set("estagio", opts.estagio)
    if (opts?.tag) params.set("tag", opts.tag)
    if (opts?.email) params.set("email", opts.email)
    const qs = params.toString()
    return request<Contato[]>(`/painel/api/contatos${qs ? `?${qs}` : ""}`)
  },

  // Importação em massa (CSV ou Google Contatos — mesma rota, o painel monta a lista diferente
  // conforme a origem). Nunca sobrescreve etapa/campo que já tem valor com algo vazio — só
  // preenche o que a linha importada de fato trouxe.
  importarContatos: (businessId: string, contatos: ImportarContatoLinha[]) =>
    request<{ importados: number; erros: { linha: number; motivo: string }[] }>(
      `/painel/api/contatos/importar/${encodeURIComponent(businessId)}`,
      { method: "POST", body: JSON.stringify({ contatos }) },
    ),

  // Sincroniza TODAS as conversas com o Google Contatos: nome do Google nas que já estão salvas;
  // com criarFaltantes, salva no Google quem já escreveu e ainda não está lá.
  googleSincronizar: (criarFaltantes = false) =>
    request<{ totalNoGoogle: number; renomeadas: number; criados: number; faltantes: number }>(
      "/painel/api/google/sincronizar",
      { method: "POST", body: JSON.stringify({ criarFaltantes }) },
    ),

  googleContatos: () => request<GoogleContato[]>("/painel/api/google/contatos"),

  // ── Roteador em código (fluxos hardcoded de cada número, tela Fluxos) ───────────────────
  roteadorRevisadoListar: () => request<Record<string, boolean>>("/painel/api/roteador/revisado"),

  roteadorRevisadoDefinir: (chave: string, revisado: boolean) =>
    request<{ ok: true }>(`/painel/api/roteador/revisado/${encodeURIComponent(chave)}`, {
      method: "POST",
      body: JSON.stringify({ revisado }),
    }),

  // "Qual conta Google está conectada" — mostrado antes da lista de importar, pra nunca ficar
  // na dúvida se os contatos que aparecem são da conta certa.
  googleConta: () => request<{ email: string | null; nome: string | null }>("/painel/api/google/conta"),

  // Passo 1 (segmentação) do assistente de Campanha de WhatsApp — filtros combinam em E; omitir
  // um filtro é "não restringir por ele" (ver db.conversasParaCampanha no backend).
  campanhaContatos: (
    businessId: string,
    filtros: { estagio?: string; tagId?: number; aniversarioDias?: number },
  ) => {
    const params = new URLSearchParams()
    if (filtros.estagio) params.set("estagio", filtros.estagio)
    if (filtros.tagId) params.set("tagId", String(filtros.tagId))
    if (filtros.aniversarioDias != null) params.set("aniversarioDias", String(filtros.aniversarioDias))
    const qs = params.toString()
    return request<{ contacts: BroadcastContact[]; total: number }>(
      `/painel/api/campanha-contatos/${encodeURIComponent(businessId)}${qs ? `?${qs}` : ""}`,
    )
  },

  // Visão consolidada de uso/limite das integrações externas (tela Configurações >
  // Integrações) — só traz o que dá pra consultar com as credenciais que já existem hoje.
  integracoesStatus: () =>
    request<{
      whatsapp: Array<
        | { label: string; ok: true; display_phone_number: string | null; quality_rating: string | null; messaging_limit_tier: string | null }
        | { label: string; ok: false; erro: string }
      >
      r2: { usedBytes: number; limiteBytes: number } | null
    }>("/painel/api/integracoes/status"),

  inbox: () => request<Conversation[]>("/painel/api/inbox"),

  conversations: (businessId: string, opts?: { finalizadas?: boolean }) =>
    request<Conversation[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}${opts?.finalizadas ? "?finalizadas=1" : ""}`,
    ),

  // `desde`/`ate` (epoch ms, opcionais) — janela de dias em vez do histórico inteiro, pra não
  // reler/retransmitir a conversa toda a cada abertura/poll com contato de meses de histórico.
  messages: (businessId: string, phone: string, opts?: { desde?: number; ate?: number }) => {
    const params = new URLSearchParams()
    if (opts?.desde != null) params.set("desde", String(opts.desde))
    if (opts?.ate != null) params.set("ate", String(opts.ate))
    const qs = params.toString()
    return request<Message[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/messages${qs ? `?${qs}` : ""}`,
    )
  },

  // Chamar só quando a conversa está selecionada E a aba tem foco (document.hasFocus()) —
  // ver comentário em server.js sobre por que isso é separado do fetch de mensagens.
  marcarLida: (businessId: string, phone: string) =>
    request<{ ok: boolean }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/marcar-lida`,
      { method: "POST" },
    ),

  // Só mídia (imagem/vídeo) da conversa inteira, sem janela de dias — pra Galeria.
  midias: (businessId: string, phone: string) =>
    request<Pick<Message, "id" | "type" | "media_path" | "media_mime" | "created_at">[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/midias`,
    ),

  outrosCanais: (businessId: string, phone: string) =>
    request<OutroCanal[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/outros-canais`,
    ),

  // Baixa o .txt da conversa e já dispara o download no navegador — não usa request() porque
  // a resposta não é JSON (é o arquivo em si).
  exportarConversa: async (businessId: string, phone: string) => {
    const creds = getCredentials()
    const res = await fetch(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/exportar`,
      { headers: creds ? { Authorization: `Basic ${creds}` } : {} },
    )
    if (!res.ok) throw new ApiError(res.status, `Erro ${res.status} ao exportar`)
    const blob = await res.blob()
    const nomeArquivo =
      res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || `conversa-${phone}.txt`
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = nomeArquivo
    a.click()
    URL.revokeObjectURL(url)
  },

  // `replyToWaId` (opcional) = wa_message_id de uma mensagem anterior pra "citar" (reply), só
  // tem efeito em mensagem de texto puro (sem mídia) no WhatsApp.
  reply: (
    businessId: string,
    phone: string,
    text: string,
    midia?: { imagemBase64?: string; videoBase64?: string; audioBase64?: string; documentBase64?: string; documentNome?: string },
    replyToWaId?: string | null,
  ) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/reply`,
      { method: "POST", body: JSON.stringify({ text, ...midia, replyToWaId: replyToWaId || undefined }) },
    ),

  reabrirFluxo: (businessId: string, phone: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/reabrir-fluxo`,
      { method: "POST" },
    ),

  setStatus: (businessId: string, phone: string, status: "novo" | "andamento" | "resolvido") =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),

  setNota: (businessId: string, phone: string, nota: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/nota`,
      { method: "PATCH", body: JSON.stringify({ nota }) },
    ),

  renomearContato: (businessId: string, phone: string, nome: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/nome`,
      { method: "PATCH", body: JSON.stringify({ nome }) },
    ),

  salvarEmailContato: (businessId: string, phone: string, email: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/email`,
      { method: "PATCH", body: JSON.stringify({ email }) },
    ),

  // "Salvar contato" (foto, estilo WhatsApp) — fotoBase64 é um data URL (data:image/...;base64,...)
  // gerado no navegador a partir do arquivo escolhido.
  salvarFotoContato: (businessId: string, phone: string, fotoBase64: string) =>
    request<{ ok: true; foto_url: string }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/foto`,
      { method: "PATCH", body: JSON.stringify({ fotoBase64 }) },
    ),

  // Sugestão de resposta da IA ("copiloto de vendas") — lê o cache pré-computado em background
  // pelo servidor; se ainda não tiver rodado pra essa conversa, devolve { texto: null }.
  sugestaoResposta: (businessId: string, phone: string) =>
    request<{ texto: string | null; insight: string | null }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/sugestao-resposta`,
    ),

  // Corretor por-trecho — cada item vira um balão clicável posicionado em cima da
  // palavra/expressão errada no textarea, não uma frase inteira reescrita.
  corrigirTexto: (texto: string) =>
    request<{ correcoes: { errado: string; certo: string }[] }>(`/painel/api/corrigir-texto`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    }),

  // Feedback/aceitação da IA — "como sabemos se é útil?". Fire-and-forget nas telas que chamam
  // (sempre com .catch(() => {}), nunca deve travar a experiência da pessoa).
  iaFeedbackRegistrar: (payload: {
    businessId?: string
    phone?: string
    tipo: string
    evento: "mostrada" | "aceita" | "descartada" | "comentario"
    comentario?: string
  }) => request<{ ok: true }>(`/painel/api/ia/feedback`, { method: "POST", body: JSON.stringify(payload) }),

  iaFeedbackResumo: () =>
    request<{
      resumo: { tipo: string; evento: string; total: number }[]
      comentarios: { id: number; tipo: string; comentario: string; usuario: string | null; created_at: number }[]
    }>(`/painel/api/ia/feedback`),

  // ── Radar de retorno (etapa parada / cliente inativo) ────────────────────────────────────
  retornosPendentes: () => request<RetornoComContato[]>("/painel/api/retornos"),

  sugestoesRetornoPendentes: () => request<SugestaoRetorno[]>("/painel/api/sugestoes-retorno"),

  sugestaoRetornoMarcarStatus: (id: number, status: "aprovado" | "descartado") =>
    request<{ ok: true }>(`/painel/api/sugestoes-retorno/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Limiar (minutos) de alerta de "parado na etapa", editável por etapa do pipeline.
  pipelineAlertasConfig: () => request<Record<string, number>>("/painel/api/pipeline/alertas-config"),

  pipelineAlertaConfigDefinir: (estagioId: string, minutos: number | null) =>
    request<{ ok: true }>(`/painel/api/pipeline/alertas-config/${encodeURIComponent(estagioId)}`, {
      method: "PATCH",
      body: JSON.stringify({ minutos }),
    }),

  buscar: (businessId: string, termo: string) =>
    request<{ phone: string; body: string; created_at: number }[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/buscar?q=${encodeURIComponent(termo)}`,
    ),

  respostasProntas: () => request<RespostaPronta[]>("/painel/api/respostas-prontas"),

  criarRespostaPronta: (atalho: string, texto: string) =>
    request<{ id: number }>("/painel/api/respostas-prontas", {
      method: "POST",
      body: JSON.stringify({ atalho, texto }),
    }),

  excluirRespostaPronta: (id: number) =>
    request<{ ok: true }>(`/painel/api/respostas-prontas/${id}`, { method: "DELETE" }),

  atualizarRespostaPronta: (id: number, atalho: string, texto: string) =>
    request<{ ok: true }>(`/painel/api/respostas-prontas/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ atalho, texto }),
    }),

  // Conta uso de verdade (clicou pra usar, não só abriu a lista) — alimenta ordenação "mais
  // usados" dos chips do composer. Fire-and-forget no chamador.
  registrarUsoRespostaPronta: (id: number) =>
    request<{ ok: true }>(`/painel/api/respostas-prontas/${id}/uso`, { method: "POST" }),

  templates: (businessId: string) =>
    request<{ templates: TemplateInfo[] }>(`/painel/api/templates/${encodeURIComponent(businessId)}`),

  broadcast: (
    businessId: string,
    payload: {
      template: string
      language?: string
      contacts: BroadcastContact[]
      bodyPreview?: string
      intervalSeconds?: number
      fluxoId?: number
    },
  ) =>
    request<{ resultados: BroadcastResult[]; agendados?: number; intervalSeconds?: number }>(
      `/painel/api/broadcast/${encodeURIComponent(businessId)}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  broadcastFila: (businessId: string) =>
    request<BroadcastFilaItem[]>(`/painel/api/broadcast-fila/${encodeURIComponent(businessId)}`),

  broadcastCancelar: (id: number) =>
    request<{ ok: true }>(`/painel/api/broadcast-fila/item/${id}`, { method: "DELETE" }),

  // ── Publique IV (publicação direta + agenda) ──────────────────────────────
  contasPublicar: () => request<ContaPublicar[]>("/painel/api/publicar/contas"),

  publicarAgora: (payload: {
    contaId: string
    texto?: string
    link?: string
    redes: Rede[]
    imagemBase64?: string
    imagensBase64?: string[]
  }) =>
    request<{ resultados: PublicarResultado }>("/painel/api/publicar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  agendaFila: () => request<AgendaItem[]>("/painel/api/agenda/fila"),

  agendaLista: (contaId?: string) =>
    request<{ resumo: AgendaResumo; recentes: AgendaItem[] }>(
      `/painel/api/agenda/lista${contaId ? `?contaId=${encodeURIComponent(contaId)}` : ""}`,
    ),

  agendaCriar: (payload: CriarAgendamentoPayload) =>
    request<{ id: number; agendadoPara: number }>("/painel/api/agenda", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  agendaPublicarAgora: (id: number) =>
    request<{ ok: true }>(`/painel/api/agenda/${id}/publicar-agora`, { method: "POST" }),

  agendaReagendar: (id: number, data: string) =>
    request<{ ok: true }>(`/painel/api/agenda/${id}/data`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),

  agendaReenfileirar: (id: number) =>
    request<{ ok: true }>(`/painel/api/agenda/${id}/reenfileirar`, { method: "POST" }),

  agendaRemover: (id: number) => request<{ ok: true }>(`/painel/api/agenda/${id}`, { method: "DELETE" }),

  // ── Reels em massa ─────────────────────────────────────────────────────────
  reelsStatus: () => request<ReelsStatusResponse>("/painel/api/reels/status"),

  reelsFila: () => request<ReelsItem[]>("/painel/api/reels/fila"),

  reelsPostsPorDia: (quantidade: number) =>
    request<{ ok: true; quantidade: number }>("/painel/api/reels/posts-por-dia", {
      method: "POST",
      body: JSON.stringify({ quantidade }),
    }),

  reelsLegendaPadrao: (legenda: string) =>
    request<{ ok: true }>("/painel/api/reels/legenda-padrao", {
      method: "POST",
      body: JSON.stringify({ legenda }),
    }),

  reelsPausar: (pausado: boolean) =>
    request<{ ok: true }>("/painel/api/reels/pausar", {
      method: "POST",
      body: JSON.stringify({ pausado }),
    }),

  reelsSincronizar: () => request<{ encontrados: number; adicionados: number }>("/painel/api/reels/sincronizar", { method: "POST" }),

  reelsPublicarProximo: () => request<{ vazio?: true; ok?: boolean }>("/painel/api/reels/publicar-agora", { method: "POST" }),

  reelsPublicarItem: (id: number) => request<{ ok: boolean }>(`/painel/api/reels/${id}/publicar-agora`, { method: "POST" }),

  reelsDefinirData: (id: number, data: string | null) =>
    request<{ ok: true }>(`/painel/api/reels/${id}/data`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),

  reelsReenfileirar: (id: number) => request<{ ok: true }>(`/painel/api/reels/${id}/reenfileirar`, { method: "POST" }),

  reelsRemover: (id: number) => request<{ ok: true }>(`/painel/api/reels/${id}`, { method: "DELETE" }),

  // Upload de vídeo é multipart/form-data, não JSON — passa longe do helper `request` de
  // propósito. Os campos de texto (legenda/data) precisam ser anexados ANTES do arquivo no
  // FormData, senão o servidor (busboy) pode perdê-los — ver comentário em server.js.
  async reelsUpload(file: File, legenda: string, data: string, onProgress?: (pct: number) => void): Promise<{ ok: true; nome: string }> {
    const creds = getCredentials()
    const form = new FormData()
    form.append("legenda", legenda)
    form.append("data", data)
    form.append("video", file)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/painel/api/reels/upload")
      if (creds) xhr.setRequestHeader("Authorization", `Basic ${creds}`)
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) resolve(data)
          else reject(new ApiError(xhr.status, data.error || `Erro ${xhr.status}`))
        } catch {
          reject(new ApiError(xhr.status, "Resposta inválida do servidor"))
        }
      }
      xhr.onerror = () => reject(new ApiError(0, "Falha de rede no upload"))
      xhr.send(form)
    })
  },

  // ── Funil de qualificação ──────────────────────────────────────────────────
  funilResumo: (dias = 7) => request<FunilResponse>(`/painel/api/funil?dias=${dias}`),

  // ── Pipeline e tags (só usado hoje no número principal da Felizcred) ────────
  setPipeline: (businessId: string, phone: string, estagio: string | null) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/pipeline`,
      { method: "PATCH", body: JSON.stringify({ estagio }) },
    ),

  tagsDaConversa: (businessId: string, phone: string) =>
    request<Tag[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/tags`),

  adicionarTagConversa: (businessId: string, phone: string, tagId: number) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/tags`,
      { method: "POST", body: JSON.stringify({ tagId }) },
    ),

  removerTagConversa: (businessId: string, phone: string, tagId: number) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/tags/${tagId}`,
      { method: "DELETE" },
    ),

  tags: (businessId: string) => request<Tag[]>(`/painel/api/tags/${encodeURIComponent(businessId)}`),

  criarTag: (businessId: string, nome: string, cor: string) =>
    request<{ id: number }>(`/painel/api/tags/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ nome, cor }),
    }),

  apagarTag: (businessId: string, tagId: number) =>
    request<{ ok: true }>(`/painel/api/tags/${encodeURIComponent(businessId)}/${tagId}`, { method: "DELETE" }),

  // Lê as últimas mensagens da conversa e sugere etapa do pipeline + campos personalizados
  // (Gemini grátis, ver gemini.js) — nunca aplica sozinho, só devolve a sugestão pra confirmar.
  sugestaoIa: (businessId: string, phone: string, estagios: readonly { id: string; nome: string }[]) =>
    request<SugestaoIa>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/sugestao-ia`,
      { method: "POST", body: JSON.stringify({ estagios }) },
    ),

  // ── Analytics (só o número principal da Felizcred, ver chats.tsx/analytics.tsx) ─────────
  // Aceita 1 canal (string) ou vários de uma vez (array, "Todos os canais") — o backend soma/
  // mescla os resultados quando é mais de um (ver mesclarAnalytics em server.js).
  analytics: (businessIds: string | string[], dias: number) =>
    request<AnalyticsResumo>(
      `/painel/api/analytics/${encodeURIComponent(Array.isArray(businessIds) ? businessIds.join(",") : businessIds)}?dias=${dias}`,
    ),

  // ── IA (conector MCP — ver ia.tsx) ────────────────────────────────────────────────────────
  mcpInfo: () => request<{ configurado: boolean; url?: string }>("/painel/api/mcp-info"),

  // ── E-mail (Brevo) — templates, campanha, fila, avulso (ver email.tsx) ──────────────────
  emailTemplates: (businessId: string) => request<EmailTemplate[]>(`/painel/api/email-templates/${encodeURIComponent(businessId)}`),
  criarEmailTemplate: (businessId: string, nome: string, assunto: string, corpoHtml: string) =>
    request<{ id: number }>(`/painel/api/email-templates/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ nome, assunto, corpoHtml }),
    }),
  apagarEmailTemplate: (businessId: string, templateId: number) =>
    request<{ ok: true }>(`/painel/api/email-templates/${encodeURIComponent(businessId)}/${templateId}`, { method: "DELETE" }),
  agendarEmailCampanha: (businessId: string, templateId: number, contacts: { email: string; nome?: string; agendadoPara: number }[]) =>
    request<{ agendados: number }>(`/painel/api/email-campanha/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ templateId, contacts }),
    }),
  emailFila: (businessId: string) => request<EmailAgendado[]>(`/painel/api/email-fila/${encodeURIComponent(businessId)}`),
  cancelarEmailFila: (id: number) => request<{ ok: true }>(`/painel/api/email-fila/item/${id}`, { method: "DELETE" }),
  enviarEmailAvulso: (businessId: string, phone: string, templateId: number) =>
    request<{ ok: true }>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/email-avulso`, {
      method: "POST",
      body: JSON.stringify({ templateId }),
    }),

  // ── Retornos (lembrete por conversa — WhatsApp e/ou e-mail) ──────────────────────────────
  criarRetorno: (
    businessId: string,
    phone: string,
    dados: {
      tipo?: string
      dataAgendada: number
      canal: "whatsapp" | "email" | "ambos"
      whatsappTemplate?: string
      whatsappLanguage?: string
      whatsappParams?: string[]
      fluxoId?: number
      emailTemplateId?: number
    },
  ) =>
    request<{ id: number }>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/retorno`, {
      method: "POST",
      body: JSON.stringify(dados),
    }),

  // ── Fluxos dinâmicos (só leitura no painel — criar/editar nó continua via MCP) ───────────
  fluxos: (businessId: string) => request<FluxoDinamico[]>(`/painel/api/fluxos/${encodeURIComponent(businessId)}`),
  retornosDaConversa: (businessId: string, phone: string) =>
    request<Retorno[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/retornos`),
  retornosDoNegocio: (businessId: string) => request<Retorno[]>(`/painel/api/retornos/${encodeURIComponent(businessId)}`),
  cancelarRetorno: (id: number) => request<{ ok: true }>(`/painel/api/retornos/item/${id}`, { method: "DELETE" }),

  // ── Backup/exportação de conversa por e-mail ──────────────────────────────────────────────
  emailBackup: (businessId: string) => request<{ email: string | null }>(`/painel/api/email-backup/${encodeURIComponent(businessId)}`),
  definirEmailBackup: (businessId: string, email: string) =>
    request<{ ok: true }>(`/painel/api/email-backup/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  enviarBackupConversaPorEmail: (businessId: string, phone: string) =>
    request<{ ok: true; enviadoPara: string }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/exportar-email`,
      { method: "POST" }
    ),

  // ── CRM: campos personalizados, notas em lista, timeline de atividades ───────────────────
  camposPersonalizados: (businessId: string) =>
    request<CampoPersonalizado[]>(`/painel/api/campos-personalizados/${encodeURIComponent(businessId)}`),
  criarCampoPersonalizado: (businessId: string, nome: string) =>
    request<{ id: number }>(`/painel/api/campos-personalizados/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ nome }),
    }),
  apagarCampoPersonalizado: (businessId: string, campoId: number) =>
    request<{ ok: true }>(`/painel/api/campos-personalizados/${encodeURIComponent(businessId)}/${campoId}`, { method: "DELETE" }),
  camposDaConversa: (businessId: string, phone: string) =>
    request<CampoValor[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/campos`),
  definirCampoConversa: (businessId: string, phone: string, campoId: number, valor: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/campos/${campoId}`,
      { method: "POST", body: JSON.stringify({ valor }) }
    ),
  notasDaConversa: (businessId: string, phone: string) =>
    request<NotaConversa[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/notas`),
  adicionarNota: (businessId: string, phone: string, texto: string) =>
    request<{ id: number }>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/notas`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    }),
  apagarNota: (id: number) => request<{ ok: true }>(`/painel/api/notas/item/${id}`, { method: "DELETE" }),
  atividadesDaConversa: (businessId: string, phone: string) =>
    request<AtividadeConversa[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/atividades`),
}

export { ApiError }
