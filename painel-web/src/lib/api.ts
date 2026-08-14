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
  channel?: "whatsapp" | "instagram"
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
  wa_message_id: string | null
  created_at: number
}

export type RespostaPronta = { id: number; atalho: string; texto: string }

export type BroadcastContact = { phone: string; name?: string }
export type BroadcastResult = { phone: string; ok: boolean; error?: string }

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

  inbox: () => request<Conversation[]>("/painel/api/inbox"),

  conversations: (businessId: string) =>
    request<Conversation[]>(`/painel/api/conversations/${encodeURIComponent(businessId)}`),

  messages: (businessId: string, phone: string) =>
    request<Message[]>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/messages`,
    ),

  reply: (businessId: string, phone: string, text: string, imagemBase64?: string) =>
    request<{ ok: true }>(
      `/painel/api/conversations/${encodeURIComponent(businessId)}/${encodeURIComponent(phone)}/reply`,
      { method: "POST", body: JSON.stringify({ text, imagemBase64 }) },
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

  broadcast: (
    businessId: string,
    payload: {
      template: string
      language?: string
      contacts: BroadcastContact[]
      bodyPreview?: string
    },
  ) =>
    request<{ resultados: BroadcastResult[] }>(`/painel/api/broadcast/${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

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

  agendaLista: () =>
    request<{ resumo: AgendaResumo; recentes: AgendaItem[] }>("/painel/api/agenda/lista"),

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
}

export { ApiError }
