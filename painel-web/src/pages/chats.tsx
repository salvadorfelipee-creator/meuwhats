import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { COMPANY_LABELS, useChannel, type Channel } from "@/lib/channel-context"
import { SiteChatPage } from "@/pages/site-chat"
import { useUnread } from "@/lib/unread-context"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type Conversation,
  type SiteChatConversation,
  type OutroCanal,
  type Message,
  type RespostaPronta,
  type TemplateInfo,
  type BroadcastResult,
  type BroadcastFilaItem,
  type Tag,
  type EmailTemplate,
  type Retorno,
  type NotaConversa,
  type AtividadeConversa,
  type FluxoDinamico,
  type SugestaoIa,
  pipelineEstagiosPara,
  mediaUrl,
  conversaEhUrgente,
} from "@/lib/api"
import { GerenciarTags } from "@/pages/analytics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/blocks/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Search,
  Send,
  Paperclip,
  Info,
  MessagesSquare,
  MessageCircle,
  Radio,
  Bell,
  BellOff,
  ChevronDown,
  Phone,
  AtSign as InstagramIcon,
  Download,
  CircleCheck,
  FileText,
  Mic,
  X,
  ChevronUp,
  Mail,
  CalendarClock,
  Trash2,
  Columns3,
  Tags,
  StickyNote,
  History,
  Sparkles,
  Loader2,
  Images,
  Pencil,
  Camera,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  RefreshCw,
  ExternalLink,
  Reply,
  Play,
  Pause,
  Maximize2,
  MapPin,
  User,
  Globe2,
  MoreHorizontal,
  Plus,
  UserCheck,
  UserX,
  Check,
  UserRound,
} from "lucide-react"

// Emoji picker — dataset grande (emoji-picker-react), carregado só quando alguém de fato abre o
// seletor (clica no botão "😊"), nunca no carregamento inicial da tela de conversas.
const EmojiPickerLazy = React.lazy(() => import("emoji-picker-react"))

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  andamento: "Em andamento",
  resolvido: "Finalizada",
}

const STATUS_VARIANT: Record<string, "default" | "warning" | "success"> = {
  novo: "default",
  andamento: "warning",
  resolvido: "success",
}

function initials(name: string | null, phone: string) {
  const base = (name || phone || "?").trim()
  return base.slice(0, 2).toUpperCase()
}

function formatTime(ts: number | null) {
  if (!ts) return ""
  const d = new Date(ts)
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function formatHora(ts: number | null) {
  if (!ts) return ""
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

// Separador de dia no topo de cada grupo de mensagens, como no WhatsApp.
function chaveDia(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function rotuloDia(ts: number) {
  const hoje = Date.now()
  if (chaveDia(ts) === chaveDia(hoje)) return "Hoje"
  if (chaveDia(ts) === chaveDia(hoje - 86400000)) return "Ontem"
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

// "Visto" = a última vez que uma mensagem NOSSA foi marcada como lida pelo WhatsApp
// (conversations.last_seen_at, ver db.js). NÃO é presença/online — a API do WhatsApp não
// entrega isso pra nenhuma empresa. Só existe quando já mandamos alguma mensagem e ela foi lida.
const VISTO_RECENTE_MS = 10 * 60 * 1000 // até 10min: considera "visto recentemente" (bolinha verde)

function formatVisto(ts: number | null | undefined): string | null {
  if (!ts) return null
  const diffMs = Date.now() - ts
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return "Visto agora há pouco"
  if (min < 60) return `Visto há ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `Visto há ${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return "Visto ontem"
  return `Visto há ${dias} dias`
}

function vistoRecentemente(ts: number | null | undefined): boolean {
  return !!ts && Date.now() - ts < VISTO_RECENTE_MS
}

function formatarTelefone(phone: string): string {
  const digitos = phone.replace(/\D/g, "")
  const semDdi = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos
  if (semDdi.length === 11) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`
  if (semDdi.length === 10) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`
  return phone
}

// Campos personalizados dessa conversa (Responsável/Produto/Origem/Valor solicitado etc.), já
// vêm prontos no GET /conversations como JSON (ver listConversations em db.js) — sem isso cada
// card pediria 1 fetch extra só pra mostrar "Responsável" na lista.
function camposDe(c: Conversation): Record<string, string> {
  if (!c.campos_json) return {}
  try {
    return JSON.parse(c.campos_json)
  } catch {
    return {}
  }
}

function tagsDe(c: Conversation): Tag[] {
  if (!c.tags_json) return []
  try {
    return JSON.parse(c.tags_json)
  } catch {
    return []
  }
}

// "há quanto tempo o cliente está esperando" — só faz sentido quando a última mensagem foi DELE
// (senão já tem resposta nossa, não tem espera nenhuma rolando). Cor esquenta com o tempo: verde
// (rápido) → laranja → vermelho (demorado).
function tempoEspera(c: Conversation): { texto: string; cor: string } | null {
  if (c.last_direction !== "in" || !c.last_message_at) return null
  const min = Math.floor((Date.now() - c.last_message_at) / 60000)
  const cor = min < 5 ? "#2F7D4F" : min < 30 ? "#B8690F" : "#C03C3C"
  const texto = min < 1 ? "agora" : min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)}h` : formatTime(c.last_message_at).split(" ")[0]
  return { texto, cor }
}

// Divide o texto em pedaços marcando as ocorrências de `termo` (sem diferenciar
// maiúscula/minúscula) — usado pela busca dentro da conversa, pra destacar o trecho batido.
function destacarTexto(texto: string, termo: string) {
  if (!termo.trim()) return texto
  const termoNorm = termo.trim()
  const partes = texto.split(new RegExp(`(${termoNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  if (partes.length === 1) return texto
  return partes.map((parte, i) =>
    parte.toLowerCase() === termoNorm.toLowerCase() ? (
      <mark key={i} className="bg-yellow-300 text-black rounded-sm">
        {parte}
      </mark>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    )
  )
}

function formatGravacao(segundos: number): string {
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

// Formatos que o WhatsApp aceita de verdade como nota de voz (link-based audio send) — Opus
// dentro de um container Ogg é o único que os apps do WhatsApp tocam com a carinha de áudio
// gravado; qualquer outra coisa (ex: webm, quando o navegador não suporta gravar ogg) ainda é
// enviada, mas cai como anexo de áudio genérico em vez de nota de voz.
const AUDIO_MIME_PREFERIDO = "audio/ogg;codecs=opus"
const AUDIO_MIME_FALLBACK = "audio/webm;codecs=opus"

// Janela padrão de histórico carregado por conversa (ver api.messages) — "Carregar mensagens
// mais antigas" dobra essa janela a cada clique, em vez de reler a conversa inteira do zero.
const JANELA_HISTORICO_MS = 60 * 24 * 60 * 60 * 1000

// Rascunhos por conversa (texto digitado e não enviado) — guardados no navegador, igual ao
// WhatsApp: a conversa sobe pro topo da lista com "Rascunho: ..." até a mensagem ser enviada.
const RASCUNHOS_STORAGE_KEY = "painel_rascunhos"
type Rascunho = { texto: string; t: number }

function lerRascunhos(): Record<string, Rascunho> {
  try {
    const bruto = localStorage.getItem(RASCUNHOS_STORAGE_KEY)
    return bruto ? JSON.parse(bruto) : {}
  } catch {
    return {}
  }
}

// Autocorreção silenciosa: só o que é inequívoco (acento, vírgula/pontuação, maiúscula) ou um
// errinho de digitação numa palavra só. Tudo que mexe em número ou em mais de uma palavra segue
// como balão clicável.
function semAcento(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

function distanciaEdicao(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

function correcaoEhSimples({ errado, certo }: { errado: string; certo: string }) {
  if (/\d/.test(errado) || /\d/.test(certo)) return false
  const a = semAcento(errado)
  const b = semAcento(certo)
  if (!a || !b) return false
  if (a === b) return true
  const umaPalavra = (s: string) => !/\s/.test(s.trim())
  if (!umaPalavra(errado) || !umaPalavra(certo)) return false
  return distanciaEdicao(a, b) <= (Math.min(a.length, b.length) >= 5 ? 2 : 1)
}

// Tipos de mensagem que o backend só grava como texto genérico "[mensagem do tipo X]" (ver
// server.js — só text/button/interactive/image/audio/video/document têm tratamento dedicado;
// location/contacts/reaction/sticker caem no else e não guardam coordenada/vCard/alvo da
// reação/mídia nenhuma). Sem esse dado real não dá pra desenhar mapa/vCard/indicador de reação
// de verdade — só dá pra deixar o rótulo genérico um pouco mais legível que o texto em colchetes.
const TIPO_SEM_DADOS_LABEL: Record<string, string> = {
  location: "📍 Localização enviada",
  contacts: "👤 Contato compartilhado",
  reaction: "❤️ Reagiu a uma mensagem",
  sticker: "🙂 Figurinha",
  unsupported: "⚠️ Mensagem não suportada pelo WhatsApp",
}

export function ChatsPage() {
  const { current, todos } = useChannel()
  if (current?.kind === "site" && !todos) return <SiteChatPage embedded />
  return <ChannelChatsPage />
}

function ChannelChatsPage() {
  const { channels, current: canalDoMenu, setCurrent, todos, setTodos } = useChannel()
  // Visão "todas da FelizCred": a lista junta WhatsApp principal, Campanha CLT e Instagram; cada
  // conversa guarda de qual canal é (selectedBiz) e `current` passa a ser o canal DA CONVERSA
  // aberta — assim enviar, renomear, finalizar etc. continuam indo pro canal certo.
  const canaisTodos = React.useMemo(
    () => channels.filter((c) => c.company === "felizcred" && c.kind !== "site"),
    [channels],
  )
  const canaisTodosKey = canaisTodos.map((c) => c.id).join(",")
  const [selectedBiz, setSelectedBiz] = React.useState<string | null>(null)
  const current = todos
    ? channels.find((c) => c.id === selectedBiz) ?? canaisTodos[0] ?? canalDoMenu
    : canalDoMenu
  const {
    notifPermission,
    requestNotifPermission,
    unreadChannels,
    unreadConversations,
    overdueConversations,
    markConversationSeen,
    setActiveConversation,
    alvoAbrir,
    limparAlvoAbrir,
  } = useUnread()
  const { identidade } = useAuth()
  const [conversations, setConversations] = React.useState<Conversation[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  // Conversa do chat do site aberta DENTRO da lista unificada (sem trocar de canal): id da conversa do site.
  const [siteSel, setSiteSel] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [search, setSearch] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [respostas, setRespostas] = React.useState<RespostaPronta[]>([])
  const [respostasMenuOpen, setRespostasMenuOpen] = React.useState(false)
  const [respostaEditando, setRespostaEditando] = React.useState<RespostaPronta | "novo" | null>(null)
  // Painel de detalhes do contato fica FIXO ao lado da conversa por padrão (pedido do usuário —
  // antes era um Sheet que precisava clicar pra abrir toda vez); o ícone "i" só recolhe/expande
  // pra quem quiser mais espaço pra tela de chat.
  const [detailsOpen, setDetailsOpen] = React.useState(true)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)
  const [mostrarFinalizadas, setMostrarFinalizadas] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Mensagem selecionada pra "responder" (reply citando, estilo WhatsApp) — ver api.reply
  // (replyToWaId) e o strip de preview acima do composer.
  const [replyTo, setReplyTo] = React.useState<Message | null>(null)

  // Janela de histórico carregado (ver api.messages com desde/ate) — evita reler a conversa
  // inteira em todo poll; "Carregar mensagens mais antigas" dobra a janela por clique.
  const [janelaDesde, setJanelaDesde] = React.useState(() => Date.now() - JANELA_HISTORICO_MS)
  const [carregandoAntigas, setCarregandoAntigas] = React.useState(false)
  const [semMaisAntigas, setSemMaisAntigas] = React.useState(false)
  // Guarda o scrollHeight de ANTES de prependar mensagens antigas, pra compensar o scroll depois
  // que o DOM crescer (ver efeito de `messages` mais abaixo) — sem isso a rolagem "salta".
  const scrollAjusteRef = React.useRef<number | null>(null)

  // Visualizador em tela cheia pra imagem/vídeo (lightbox) — overlay próprio, não usa o Dialog
  // (o Dialog tem padding/max-height pensados pra formulário, não pra mídia em tela cheia).
  const [lightbox, setLightbox] = React.useState<{ url: string; tipo: "image" | "video" } | null>(null)

  // Imagem colada com Ctrl+V, aguardando confirmação de envio.
  const [colada, setColada] = React.useState<{ file: File; url: string } | null>(null)
  React.useEffect(() => {
    if (!colada) return
    return () => URL.revokeObjectURL(colada.url)
  }, [colada])

  // Seletor de emoji (emoji-picker-react, lazy) — insere no textarea na posição do cursor.
  const [emojiOpen, setEmojiOpen] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Corretor por-trecho (Gemini) — debounce de 900ms depois que a pessoa para de digitar.
  const [correcoes, setCorrecoes] = React.useState<{ errado: string; certo: string }[]>([])
  const [corretorErro, setCorretorErro] = React.useState<string | null>(null)
  const corretorTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const textoRef = React.useRef("")

  // Rascunhos: chave "canal|telefone" → texto não enviado. `rascunhoChaveRef` diz de qual conversa
  // é o texto que está na caixa agora (muda junto com a seleção, antes de qualquer gravação).
  const [rascunhos, setRascunhos] = React.useState<Record<string, Rascunho>>(lerRascunhos)
  const rascunhosRef = React.useRef(rascunhos)
  const rascunhoChaveRef = React.useRef<string | null>(null)

  // Gravação de áudio (nota de voz real, pelo microfone do navegador)
  const [gravando, setGravando] = React.useState(false)
  const [gravacaoSegundos, setGravacaoSegundos] = React.useState(0)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const audioChunksRef = React.useRef<Blob[]>([])
  const streamRef = React.useRef<MediaStream | null>(null)

  // Busca dentro da conversa aberta (filtra `messages`, que já está carregado)
  const [buscaAberta, setBuscaAberta] = React.useState(false)
  const [buscaTexto, setBuscaTexto] = React.useState("")
  const [buscaIndex, setBuscaIndex] = React.useState(0)

  const carregarRespostas = React.useCallback(() => {
    api.respostasProntas().then(setRespostas).catch(() => {})
  }, [])

  React.useEffect(() => {
    carregarRespostas()
  }, [carregarRespostas])

  const carregarConversas = React.useCallback(() => {
    if (todos) {
      if (!canaisTodos.length) return
      Promise.all(
        canaisTodos.map((c) =>
          api
            .conversations(c.id, { finalizadas: mostrarFinalizadas })
            .then((lista) => lista.map((conv) => ({ ...conv, business_number_id: c.id })))
            .catch(() => [] as Conversation[]),
        ),
      )
        .then((listas) =>
          setConversations(listas.flat().sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0))),
        )
        .catch(() => {})
      return
    }
    if (!canalDoMenu) return
    api.conversations(canalDoMenu.id, { finalizadas: mostrarFinalizadas }).then(setConversations).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, canaisTodosKey, canalDoMenu, mostrarFinalizadas])

  function selecionarCanal(c: Channel) {
    setTodos(false)
    setCurrent(c)
  }

  // Reporta ao UnreadProvider qual conversa está de fato aberta agora (canal + contato) —
  // só ela deixa de tocar som/notificar quando chega mensagem nova (ver unread-context.tsx).
  // Trocar de canal sozinho NÃO limpa o pulsar das conversas — só abrir cada uma limpa,
  // senão o próprio bug que motivou essa mudança (mensagem nova sumindo sem avisar) voltaria.
  React.useEffect(() => {
    setActiveConversation(current?.id ?? null, selected)
    return () => setActiveConversation(null, null)
  }, [current, selected, setActiveConversation])

  const carregarMensagens = React.useCallback(() => {
    if (!current || !selected) return
    // Janela (não a conversa inteira) — ver JANELA_HISTORICO_MS acima. O poll de 5s (mais
    // abaixo) chama essa mesma função, então ele também já respeita a janela atual, nunca relê
    // tudo do início.
    api.messages(current.id, selected, { desde: janelaDesde }).then(setMessages).catch(() => {})
  }, [current, selected, janelaDesde])

  // Busca o próximo bloco de mensagens mais antigas (dobra a janela) e prependa sem perder a
  // posição de rolagem. Interrompe sozinho (semMaisAntigas) quando um bloco vem vazio.
  async function carregarMensagensMaisAntigas() {
    if (!current || !selected || carregandoAntigas || semMaisAntigas) return
    setCarregandoAntigas(true)
    const novoDesde = janelaDesde - JANELA_HISTORICO_MS
    try {
      const antigas = await api.messages(current.id, selected, { desde: novoDesde, ate: janelaDesde - 1 })
      if (antigas.length === 0) {
        setSemMaisAntigas(true)
      } else {
        scrollAjusteRef.current = scrollRef.current?.scrollHeight ?? null
        setMessages((prev) => {
          const idsExistentes = new Set(prev.map((m) => m.id))
          return [...antigas.filter((m) => !idsExistentes.has(m.id)), ...prev]
        })
        setJanelaDesde(novoDesde)
      }
    } catch {
      // silencioso — o botão continua visível pra tentar de novo
    } finally {
      setCarregandoAntigas(false)
    }
  }

  // Marca como lida no servidor SÓ quando a conversa está selecionada e a aba tem foco de
  // verdade — nunca a partir do polling de mensagens sozinho (ver comentário em server.js).
  // Sem essa trava, uma conversa que fica selecionada com a aba minimizada/trocada marcava
  // como lida sozinha assim que chegava mensagem nova, e o piscar/negrito nunca aparecia.
  const marcarLidaSeEmFoco = React.useCallback(() => {
    if (!current || !selected) return
    if (!document.hasFocus()) return
    api.marcarLida(current.id, selected).catch(() => {})
    markConversationSeen(current.id, selected)
  }, [current, selected, markConversationSeen])

  React.useEffect(() => {
    marcarLidaSeEmFoco()
  }, [marcarLidaSeEmFoco])

  React.useEffect(() => {
    window.addEventListener("focus", marcarLidaSeEmFoco)
    return () => window.removeEventListener("focus", marcarLidaSeEmFoco)
  }, [marcarLidaSeEmFoco])

  // Chat seguro do site (outro modelo de dados — abre na tela própria dele): aparece na visão
  // "todos" só como atalhos das conversas abertas, no topo da lista.
  const [siteAbertas, setSiteAbertas] = React.useState<SiteChatConversation[]>([])
  const canalSite = channels.find((c) => c.kind === "site")
  React.useEffect(() => {
    if (!todos) return
    const buscar = () => {
      if (document.hidden) return
      api
        .siteChatConversas()
        .then((l) => setSiteAbertas(l.filter((c) => c.status === "open").sort((x, y) => y.updated_at - x.updated_at).slice(0, 15)))
        .catch(() => {})
    }
    buscar()
    const id = setInterval(buscar, 10000)
    return () => clearInterval(id)
  }, [todos])

  const listaKey = todos ? "todos" : canalDoMenu?.id
  React.useEffect(() => {
    setSelected(null)
    setSelectedBiz(null)
    setSiteSel(null)
    setMessages([])
    setConversations([])
    carregarConversas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaKey, mostrarFinalizadas])

  React.useEffect(() => {
    carregarConversas()
  }, [carregarConversas])

  // Clique numa notificação do navegador (ver unread-context.tsx) pede pra abrir uma conversa
  // específica — só aplica quando o canal já trocou pro certo (senão abriria o contato errado
  // num canal errado por uma fração de segundo). Roda DEPOIS do efeito acima de propósito
  // (mesma troca de canal zera `selected` pra null primeiro).
  React.useEffect(() => {
    if (!alvoAbrir || !current) return
    if (todos && alvoAbrir.channelId === "site") {
      setSelected(null)
      setSiteSel(alvoAbrir.phone)
      limparAlvoAbrir()
      return
    }
    if (todos && canaisTodos.some((c) => c.id === alvoAbrir.channelId)) {
      setSelectedBiz(alvoAbrir.channelId)
      setSelected(alvoAbrir.phone)
      limparAlvoAbrir()
      return
    }
    if (alvoAbrir.channelId !== current.id) return
    setSelected(alvoAbrir.phone)
    limparAlvoAbrir()
  }, [alvoAbrir, current, todos, canaisTodos, limparAlvoAbrir])

  // Troca de conversa reseta a janela de histórico, a trava de "sem mais antigas" e qualquer
  // reply pendente — nenhum desses estados deve sobreviver pra conversa seguinte.
  React.useEffect(() => {
    setJanelaDesde(Date.now() - JANELA_HISTORICO_MS)
    setSemMaisAntigas(false)
    setReplyTo(null)
  }, [selected])

  React.useEffect(() => {
    carregarMensagens()
  }, [selected, carregarMensagens])

  React.useEffect(() => {
    // Pausa com a aba em segundo plano (mesmo princípio usado em agenda.tsx/hoje.tsx/etc.).
    const id = setInterval(() => {
      if (document.hidden) return
      carregarConversas()
      carregarMensagens()
      marcarLidaSeEmFoco()
    }, 5000)
    return () => clearInterval(id)
  }, [carregarConversas, carregarMensagens, marcarLidaSeEmFoco])

  // O polling recarrega `messages` a cada 5s (ver setInterval acima). Antes, o efeito abaixo
  // rolava pro final TODA vez que isso acontecia, mesmo se o usuário tivesse acabado de arrastar
  // pra cima pra ler o histórico — por isso a rolagem "voltava sozinha" alguns segundos depois.
  // Agora só rola pro final se o usuário já estava perto do final (perto = já lendo as últimas msgs).
  const nearBottomRef = React.useRef(true)

  function handleScrollMensagens() {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  React.useEffect(() => {
    nearBottomRef.current = true
  }, [selected])

  // Trocar de conversa com uma gravação em andamento cancela ela — nunca envia um áudio
  // gravado enquanto se falava com uma pessoa pra outra conversa por engano.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      audioChunksRef.current = []
      setGravando(false)
      setGravacaoSegundos(0)
    }
  }, [selected])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // "Carregar mensagens mais antigas" guardou o scrollHeight de antes de prependar — compensa
    // exatamente o quanto o conteúdo cresceu lá em cima, em vez de rolar pro final ou ficar parado
    // no topo (que empurraria visualmente a conversa pra baixo/cima sem o usuário pedir).
    if (scrollAjusteRef.current != null) {
      const diff = el.scrollHeight - scrollAjusteRef.current
      el.scrollTop += diff
      scrollAjusteRef.current = null
      return
    }
    if (nearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [messages])

  const conversaAtual =
    conversations.find((c) => c.phone === selected && (!todos || c.business_number_id === current?.id)) || null

  const chaveAtual = current && selected ? `${current.id}|${selected}` : null

  React.useEffect(() => {
    rascunhosRef.current = rascunhos
    try {
      localStorage.setItem(RASCUNHOS_STORAGE_KEY, JSON.stringify(rascunhos))
    } catch {
      /* sem storage: rascunho vale só até recarregar */
    }
  }, [rascunhos])

  // Trocou de conversa: a caixa passa a mostrar o rascunho DAQUELA conversa (ou vazia).
  React.useEffect(() => {
    rascunhoChaveRef.current = chaveAtual
    setTexto(chaveAtual ? rascunhosRef.current[chaveAtual]?.texto ?? "" : "")
  }, [chaveAtual])

  // Digitou: guarda (ou apaga, se esvaziou/enviou) o rascunho da conversa aberta.
  React.useEffect(() => {
    textoRef.current = texto
    const chave = rascunhoChaveRef.current
    if (!chave) return
    setRascunhos((atual) => {
      if (!texto.trim()) {
        if (!(chave in atual)) return atual
        const { [chave]: _removido, ...resto } = atual
        return resto
      }
      if (atual[chave]?.texto === texto) return atual
      return { ...atual, [chave]: { texto, t: Date.now() } }
    })
  }, [texto])

  const listaFiltrada = conversations.filter((c) => {
    const alvo = `${c.name || ""} ${c.phone}`.toLowerCase()
    return alvo.includes(search.toLowerCase())
  })

  // WhatsApp/Instagram e as conversas abertas do site na mesma ordem: a mais recente primeiro.
  const itensLista: { site?: SiteChatConversation; conv?: Conversation; t: number }[] = [
    ...(todos && canalSite
      ? siteAbertas
          .filter((c) => `${c.name} ${c.contact || ""}`.toLowerCase().includes(search.toLowerCase()))
          .map((c) => ({ site: c, t: c.updated_at }))
      : []),
    // Conversa com rascunho (que não é a aberta agora) sobe pro topo, igual ao WhatsApp.
    ...listaFiltrada.map((c) => {
      const chave = `${todos ? c.business_number_id : current?.id}|${c.phone}`
      const rascunho = chave !== chaveAtual ? rascunhos[chave] : undefined
      return { conv: c, t: rascunho ? 1e14 + rascunho.t : c.last_message_at || 0 }
    }),
  ].sort((x, y) => y.t - x.t)

  async function enviar() {
    if (!current || !selected || !texto.trim()) return
    setEnviando(true)
    try {
      // replyTo (citar mensagem) só tem efeito de verdade pro WhatsApp em texto puro, sem mídia —
      // ver api.reply. Limpa de qualquer forma depois de enviar (sucesso ou não faz sentido
      // manter citando a mesma mensagem indefinidamente).
      await api.reply(current.id, selected, texto.trim(), undefined, replyTo?.wa_message_id ?? null)
      setTexto("")
      setReplyTo(null)
      carregarMensagens()
      carregarConversas()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar")
    } finally {
      setEnviando(false)
    }
  }

  async function enviarMidia(file: File) {
    if (!current || !selected) return
    const ehImagem = file.type.startsWith("image/")
    const ehVideo = file.type.startsWith("video/")
    const ehAudio = file.type.startsWith("audio/")
    const ehDocumento = !ehImagem && !ehVideo && !ehAudio
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setEnviando(true)
    try {
      await api.reply(current.id, selected, texto.trim(), {
        imagemBase64: ehImagem ? base64 : undefined,
        videoBase64: ehVideo ? base64 : undefined,
        audioBase64: ehAudio ? base64 : undefined,
        documentBase64: ehDocumento ? base64 : undefined,
        documentNome: ehDocumento ? file.name : undefined,
      })
      setTexto("")
      carregarMensagens()
      carregarConversas()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar arquivo")
    } finally {
      setEnviando(false)
    }
  }

  // Insere o emoji escolhido na posição do cursor do textarea (cursor-aware) — cai pra "só
  // concatenar no fim" se por algum motivo não tiver a ref do textarea ainda.
  function inserirEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) {
      setTexto((t) => t + emoji)
      return
    }
    const inicio = el.selectionStart ?? texto.length
    const fim = el.selectionEnd ?? texto.length
    setTexto(texto.slice(0, inicio) + emoji + texto.slice(fim))
    requestAnimationFrame(() => {
      el.focus()
      const novaPos = inicio + emoji.length
      el.setSelectionRange(novaPos, novaPos)
    })
  }

  // Corretor por-trecho (Gemini) — dispara ~900ms depois que a pessoa para de digitar. Nunca
  // tenta de novo sozinho em caso de erro (ex.: GEMINI_API_KEY não configurada): só mostra um
  // aviso curto e espera a próxima mudança de texto pra tentar outra vez.
  React.useEffect(() => {
    if (corretorTimerRef.current) clearTimeout(corretorTimerRef.current)
    if (!texto.trim()) {
      setCorrecoes([])
      setCorretorErro(null)
      return
    }
    corretorTimerRef.current = setTimeout(() => {
      api
        .corrigirTexto(texto)
        .then((r) => {
          setCorretorErro(null)
          const todas = r.correcoes || []
          // Só mexe se a pessoa não digitou nada enquanto a IA respondia.
          if (textoRef.current !== texto) return
          const simples = todas.filter(correcaoEhSimples)
          const restantes = todas.filter((c) => !simples.includes(c))
          if (simples.length > 0) {
            const el = textareaRef.current
            const focado = !!el && document.activeElement === el
            let cursor = el?.selectionStart ?? texto.length
            let novo = texto
            for (const c of simples) {
              const idx = novo.indexOf(c.errado)
              if (idx === -1) continue
              novo = novo.slice(0, idx) + c.certo + novo.slice(idx + c.errado.length)
              if (cursor >= idx + c.errado.length) cursor += c.certo.length - c.errado.length
            }
            if (novo !== texto) {
              setTexto(novo)
              if (focado) requestAnimationFrame(() => el?.setSelectionRange(cursor, cursor))
            }
          }
          setCorrecoes(restantes.filter((c) => textoRef.current.includes(c.errado)))
        })
        .catch(() => {
          setCorrecoes([])
          setCorretorErro("corretor indisponível")
        })
    }, 900)
    return () => {
      if (corretorTimerRef.current) clearTimeout(corretorTimerRef.current)
    }
  }, [texto])

  // Aplica uma correção clicada — troca só a 1ª ocorrência exata do trecho errado (é a mesma
  // ocorrência que foi medida/posicionada pelo balão, ver CorretorBaloes).
  function aplicarCorrecao(correcao: { errado: string; certo: string }) {
    setTexto((t) => {
      const idx = t.indexOf(correcao.errado)
      if (idx === -1) return t
      return t.slice(0, idx) + correcao.certo + t.slice(idx + correcao.errado.length)
    })
  }

  // Solta o microfone se a página fechar/trocar de tela com uma gravação em andamento —
  // sem isso o navegador ficaria com o mic "ligado" (indicador do sistema) sem motivo.
  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Timer da gravação em andamento — só conta enquanto `gravando` é true.
  React.useEffect(() => {
    if (!gravando) return
    const id = setInterval(() => setGravacaoSegundos((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [gravando])

  function pararStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  async function iniciarGravacao() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Este navegador não suporta gravação de áudio.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported(AUDIO_MIME_PREFERIDO)
        ? AUDIO_MIME_PREFERIDO
        : MediaRecorder.isTypeSupported(AUDIO_MIME_FALLBACK)
        ? AUDIO_MIME_FALLBACK
        : ""
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setGravacaoSegundos(0)
      setGravando(true)
    } catch (err) {
      alert(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Permissão de microfone negada. Autorize o navegador a usar o microfone pra gravar áudio."
          : "Não consegui acessar o microfone."
      )
    }
  }

  function cancelarGravacao() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null
      recorder.stop()
    }
    pararStream()
    audioChunksRef.current = []
    setGravando(false)
    setGravacaoSegundos(0)
  }

  function pararGravacaoEEnviar() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") return
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || AUDIO_MIME_FALLBACK
      const blob = new Blob(audioChunksRef.current, { type: mimeType })
      audioChunksRef.current = []
      pararStream()
      setGravando(false)
      setGravacaoSegundos(0)
      const ext = mimeType.includes("ogg") ? "ogg" : "webm"
      const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mimeType })
      enviarMidia(file)
    }
    recorder.stop()
  }

  // Mensagens que batem com a busca da conversa aberta — recalcula só quando o texto ou as
  // mensagens mudam (evita refazer o filtro a cada render por causa do polling de 5s).
  const mensagensEncontradas = React.useMemo(() => {
    if (!buscaTexto.trim()) return []
    const termo = buscaTexto.trim().toLowerCase()
    return messages.filter((m) => m.body?.toLowerCase().includes(termo)).map((m) => m.id)
  }, [buscaTexto, messages])

  React.useEffect(() => {
    setBuscaIndex(0)
  }, [buscaTexto])

  React.useEffect(() => {
    if (!buscaAberta) {
      setBuscaTexto("")
      setBuscaIndex(0)
    }
  }, [buscaAberta])

  function irParaResultado(indice: number) {
    const id = mensagensEncontradas[indice]
    if (id == null) return
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function navegarBusca(delta: 1 | -1) {
    if (mensagensEncontradas.length === 0) return
    const proximo = (buscaIndex + delta + mensagensEncontradas.length) % mensagensEncontradas.length
    setBuscaIndex(proximo)
    irParaResultado(proximo)
  }

  React.useEffect(() => {
    if (mensagensEncontradas.length > 0) irParaResultado(buscaIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagensEncontradas.length > 0 ? mensagensEncontradas[0] : null])

  async function mudarStatus(status: "novo" | "andamento" | "resolvido") {
    if (!current || !selected) return
    await api.setStatus(current.id, selected, status)
    // Finalizar já some da lista sozinho no próximo carregarConversas (o backend exclui
    // 'resolvido' por padrão) — só falta tirar a conversa da tela também, senão ficaria
    // aberta uma conversa que não existe mais na lista visível.
    if (status === "resolvido" && !mostrarFinalizadas) setSelected(null)
    carregarConversas()
  }

  // Nome do contato direto no cabeçalho (prominente — achado real: contato sem nome salvo não
  // tinha nada que sugerisse/lembrasse de preencher, ficava escondido atrás de um lápis pequeno
  // no painel de detalhes). Estado próprio, independente do que ContactDetails usa internamente.
  const [editandoNomeHeader, setEditandoNomeHeader] = React.useState(false)
  const [nomeHeaderEditado, setNomeHeaderEditado] = React.useState("")
  const [salvandoNomeHeader, setSalvandoNomeHeader] = React.useState(false)
  async function salvarNomeHeader() {
    if (!current || !selected || !nomeHeaderEditado.trim() || salvandoNomeHeader) return
    setSalvandoNomeHeader(true)
    try {
      await api.renomearContato(current.id, selected, nomeHeaderEditado.trim())
      setEditandoNomeHeader(false)
      carregarConversas()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao renomear")
    } finally {
      setSalvandoNomeHeader(false)
    }
  }

  // Atribui (ou remove a atribuição de) essa conversa pra quem está logado — reaproveita o
  // mesmo campo personalizado "Responsável" que já existe no CRM (ver lista/Pipeline/Contatos),
  // não é um mecanismo novo. Só marca visibilidade de quem está cuidando — não muda nada no
  // comportamento automático do bot (isso exigiria uma mudança separada no fluxo em server.js).
  const [atribuindo, setAtribuindo] = React.useState(false)
  async function atribuirAMim() {
    if (!current || !selected || !conversaAtual || atribuindo) return
    const meuNome = identidade?.nome?.trim()
    if (!meuNome) return
    const jaAtribuido = camposDe(conversaAtual)["Responsável"]
    setAtribuindo(true)
    try {
      const campos = await api.camposPersonalizados(current.id)
      let campo = campos.find((c) => c.nome === "Responsável")
      if (!campo) {
        const { id } = await api.criarCampoPersonalizado(current.id, "Responsável")
        campo = { id, business_id: current.id, nome: "Responsável", created_at: Date.now() }
      }
      await api.definirCampoConversa(current.id, selected, campo.id, jaAtribuido ? "" : meuNome)
      carregarConversas()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atribuir conversa")
    } finally {
      setAtribuindo(false)
    }
  }

  // Esc fecha o lightbox de mídia em tela cheia.
  React.useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox])

  if (!current) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Carregando canais...
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Lista de conversas */}
      <div className="w-[340px] shrink-0">
        <div className="flex flex-col h-screen border-r">
          <div className="h-14 px-3 flex items-center justify-between border-b shrink-0">
            <div className="flex items-center gap-1">
              <SidebarTrigger />
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-left rounded-md px-1 -mx-1 py-0.5 hover:bg-accent flex items-center gap-1">
                  <div>
                    <p className="font-semibold text-sm">Conversas</p>
                    <p className="text-xs text-muted-foreground">{todos ? "FelizCred (todos os canais)" : current.label}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {(["felizcred", "cotacerta", "ciahot"] as const).map((company, index) => {
                  const items = channels.filter((c) => c.company === company)
                  if (!items.length) return null
                  return <React.Fragment key={company}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{COMPANY_LABELS[company]}</DropdownMenuLabel>
                    {company === "felizcred" && (
                      <DropdownMenuItem onClick={() => setTodos(true)} className="gap-2 font-medium">
                        <MessageCircle className="h-4 w-4" />
                        <span className="flex-1">Todos os canais</span>
                        {todos && <Check className="h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                    )}
                    {items.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                        {c.kind === "instagram" ? <InstagramIcon className="h-4 w-4" /> : c.kind === "site" ? <Globe2 className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                        <span className="flex-1">{c.label}</span>
                        {unreadChannels.has(c.id) && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </React.Fragment>
                })}
              </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center">
              {notifPermission !== "unsupported" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={requestNotifPermission}
                  disabled={notifPermission === "granted"}
                  title={notifPermission === "granted" ? "Notificações ativadas" : "Ativar notificações de novas mensagens"}
                >
                  {notifPermission === "granted" ? (
                    <Bell className="h-4 w-4 text-primary" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-1 gap-1.5"
                onClick={() => setBroadcastOpen(true)}
                title="Envio em massa"
              >
                <Radio className="h-3.5 w-3.5" />
                Campanha
              </Button>
            </div>
          </div>

          <div className="relative px-3 pt-3 pb-1 shrink-0">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar conversa"
              className="pl-9 rounded-lg border-transparent bg-[#f0f2f5] dark:bg-[#202c33] shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="px-3 pb-2 shrink-0">
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => setMostrarFinalizadas((v) => !v)}
            >
              {mostrarFinalizadas ? "← Ver conversas ativas" : "Ver conversas finalizadas"}
            </button>
          </div>

          <ScrollArea className="flex-1">
            {listaFiltrada.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Nenhuma conversa ainda.
              </p>
            )}
            <div className="flex flex-col">
            {itensLista.map((item) => {
              if (item.site) {
                const c = item.site
                return (
                  <button
                  key={`site|${c.id}`}
                  onClick={() => {
                    setSelected(null)
                    setSiteSel(c.id)
                  }}
                  className={`w-full px-3 py-3 border-b border-border/50 text-left flex items-center gap-3 ${siteSel === c.id ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"}`}
                >
                  <span className="h-9 w-9 shrink-0 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                    <Globe2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">Site · {c.last_message || "Conversa iniciada"}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(c.updated_at)}</span>
                </button>
                )
              }
              const c = item.conv!
              const canalId = todos ? c.business_number_id : current?.id
              const naoLida = canalId ? unreadConversations.has(`${canalId}|${c.phone}`) : false
              // Pisca só pra quem bate a regra de urgência (ver conversaEhUrgente em api.ts) —
              // sem isso, uma conversa não lida sempre "chama atenção" igual pra todo mundo.
              const urgente = naoLida && conversaEhUrgente(c, identidade)
              // Alerta universal: última mensagem foi do cliente e ninguém (bot nem humano)
              // respondeu há mais de 30min — independente de etapa/status/quem está logado.
              const semResposta = canalId ? overdueConversations.has(`${canalId}|${c.phone}`) : false
              const espera = tempoEspera(c)
              const rascunhoLista = `${canalId}|${c.phone}` !== chaveAtual ? rascunhos[`${canalId}|${c.phone}`] : undefined
              const campos = camposDe(c)
              const tags = tagsDe(c)
              // Cliente que pediu simulação (tocou em "Desejo simular", foi para o chat do site ou deu os dados) e ainda
              // não foi aberto por ninguém: a conversa pulsa na cor do produto (tag "Consignado CLT" = verde) até abrir.
              const interessado = naoLida && (/^consignado_(chat|concluido)/.test(c.fluxo_passo || "") || tags.some((t) => /interessado/i.test(t.nome)))
              const corProduto = interessado ? (tags.find((t) => /consignado|clt/i.test(t.nome))?.cor || "#15803D") : null
              const estagiosLista = pipelineEstagiosPara(current?.label)
              const estagio = estagiosLista.find((e) => e.id === c.pipeline_estagio)
              const ehInstagram = c.channel === "instagram" || c.business_number_id === "instagram" || (!todos && current?.id === "instagram")
              return (
              <button
                key={`${c.business_number_id}|${c.phone}`}
                onClick={() => {
                  setSiteSel(null)
                  setSelected(c.phone)
                  if (todos) setSelectedBiz(c.business_number_id)
                  if (canalId) markConversationSeen(canalId, c.phone)
                }}
                className={`w-full px-3 py-3 border-b border-border/50 cursor-pointer text-left transition-colors relative ${
                  selected === c.phone && (!todos || current?.id === c.business_number_id)
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : interessado
                    ? "animate-pulse"
                    : semResposta
                    ? "bg-red-500/10 dark:bg-red-500/15 animate-pulse"
                    : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                }`}
                style={interessado && corProduto && !(selected === c.phone && (!todos || current?.id === c.business_number_id)) ? { backgroundColor: `${corProduto}26`, boxShadow: `inset 3px 0 0 ${corProduto}` } : undefined}
                title={interessado ? "Pediu simulação — ainda não atendida" : semResposta ? "Sem nenhuma resposta (bot ou humano) há mais de 30 minutos" : undefined}
              >
                <div className="flex flex-row gap-3 items-center">
                  <div className="relative shrink-0">
                    <Avatar className="size-12">
                      {c.foto_url && <AvatarImage src={mediaUrl(c.foto_url)} alt="" />}
                      <AvatarFallback>{initials(c.name, c.phone)}</AvatarFallback>
                    </Avatar>
                    <span
                      title={ehInstagram ? "Instagram" : "WhatsApp"}
                      className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center"
                      style={{ background: ehInstagram ? "#C13584" : "#25D366" }}
                    >
                      {ehInstagram ? <InstagramIcon className="h-2 w-2 text-white" /> : <Phone className="h-2 w-2 text-white" />}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[15px] min-w-0 text-[#111b21] dark:text-[#e9edef]">
                          {c.name || formatarTelefone(c.phone)}
                        </span>
                        {campos["Responsável"] && (
                          <span
                            title={`Responsável: ${campos["Responsável"]}`}
                            className="shrink-0 h-4 w-4 rounded-full bg-muted text-[8px] font-semibold flex items-center justify-center"
                          >
                            {campos["Responsável"].slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-0.5">
                        {espera ? (
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: espera.cor }}>
                            {espera.texto}
                          </span>
                        ) : (
                          <span className={`text-xs tabular-nums ${naoLida ? "text-[#25d366] font-medium" : "text-[#667781]"}`}>{formatTime(c.last_message_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {rascunhoLista ? (
                        <p className="truncate min-w-0 flex-1 text-xs text-muted-foreground">
                          <span className="font-medium text-green-600 dark:text-green-500">Rascunho: </span>
                          {rascunhoLista.texto}
                        </p>
                      ) : (
                      <p className={`truncate min-w-0 flex-1 text-[13px] ${naoLida ? "text-[#111b21] dark:text-[#e9edef]" : "text-[#667781]"}`}>
                        {c.last_direction === "out" ? (c.last_origem ? "Você: " : "Automático: ") : ""}
                        {c.last_body || "—"}
                      </p>
                      )}
                      {/* Não existe contagem de mensagem não lida por conversa, só um booleano —
                          bolinha simples em vez de número inventado. Pisca (ping) só quando é
                          urgente pra essa pessoa; calma (sólida) quando é só "tem mensagem nova". */}
                      {naoLida && (
                        <span className={urgente || interessado ? "relative flex h-2 w-2 shrink-0" : "flex h-2 w-2 shrink-0"}>
                          {(urgente || interessado) && (
                            <span
                              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${interessado ? "" : "bg-red-500"}`}
                              style={interessado && corProduto ? { backgroundColor: corProduto } : undefined}
                            />
                          )}
                          <span
                            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${interessado ? "" : urgente ? "bg-red-500" : "bg-[#25d366]"}`}
                            style={interessado && corProduto ? { backgroundColor: corProduto } : undefined}
                          />
                        </span>
                      )}
                    </div>
                    {(tags.length > 0 || estagio || (c.status && c.status !== "novo")) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: `${t.cor}1a`, color: t.cor }}
                          >
                            {t.nome}
                          </span>
                        ))}
                        {estagio && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: `${estagio.cor}1a`, color: estagio.cor }}
                          >
                            {estagio.nome}
                          </span>
                        )}
                        {c.status && c.status !== "novo" && (
                          <Badge variant={STATUS_VARIANT[c.status]} className="shrink-0 text-[10px]">
                            {STATUS_LABEL[c.status]}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
              )
            })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Janela de conversa */}
      <div className="relative flex-1 min-w-0 border-l">
        {siteSel && todos ? (
          <SiteChatPage embedded soConversaId={siteSel} />
        ) : !conversaAtual ? (
          <div className="flex flex-col h-screen items-center justify-center text-muted-foreground gap-2">
            <MessagesSquare className="h-8 w-8" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <div className="flex flex-col h-screen">
            {/* Cabeçalho */}
            <div className="h-14 border-b flex items-center px-4 shrink-0 gap-3">
              <div className="relative shrink-0">
                <Avatar className="size-9">
                  {conversaAtual.foto_url && <AvatarImage src={mediaUrl(conversaAtual.foto_url)} alt="" />}
                  <AvatarFallback>{initials(conversaAtual.name, conversaAtual.phone)}</AvatarFallback>
                </Avatar>
                {vistoRecentemente(conversaAtual.last_seen_at) && (
                  <span
                    title={formatVisto(conversaAtual.last_seen_at) || undefined}
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"
                  />
                )}
              </div>
              <div className="min-w-0">
                {conversaAtual.name ? (
                  <CardTitle className="text-sm truncate">{conversaAtual.name}</CardTitle>
                ) : editandoNomeHeader ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={nomeHeaderEditado}
                      onChange={(e) => setNomeHeaderEditado(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") salvarNomeHeader()
                        if (e.key === "Escape") setEditandoNomeHeader(false)
                      }}
                      placeholder="Nome do contato"
                      className="h-6 w-40 rounded border border-input bg-background px-1.5 text-sm"
                    />
                    <button
                      onClick={salvarNomeHeader}
                      disabled={salvandoNomeHeader}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {salvandoNomeHeader ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  // Prominente de propósito — nenhum contato sem nome tinha jeito fácil de
                  // perceber/preencher isso antes. Fica na frente, não escondido atrás de um
                  // lápis pequeno no painel de detalhes.
                  <button
                    onClick={() => {
                      setNomeHeaderEditado("")
                      setEditandoNomeHeader(true)
                    }}
                    className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
                    title="Esse contato ainda não tem nome salvo — clique pra adicionar"
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    Adicionar nome do contato
                  </button>
                )}
                <CardDescription className="truncate">
                  {camposDe(conversaAtual)["Origem"]
                    ? `veio de ${camposDe(conversaAtual)["Origem"]}`
                    : formatVisto(conversaAtual.last_seen_at) || conversaAtual.phone}
                </CardDescription>
              </div>

              {/* Janela de 24h do WhatsApp — depois dela só dá pra mandar template aprovado.
                  Instagram não tem essa janela. */}
              {current?.id !== "instagram" &&
                (() => {
                  const restante = conversaAtual.last_inbound_at
                    ? 24 * 60 - (Date.now() - conversaAtual.last_inbound_at) / 60000
                    : -1
                  const aberta = restante > 0
                  return (
                    <span
                      className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-full ${
                        aberta
                          ? "bg-[#DDF1E4] text-[#2F7D4F] dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-[#FBEBD3] text-[#B8690F] dark:bg-amber-950/40 dark:text-amber-400"
                      }`}
                    >
                      {aberta ? `Janela aberta · ${Math.floor(restante / 60)}h restantes` : "Janela fechada · só template"}
                    </span>
                  )
                })()}

              <div className="flex-grow flex justify-end gap-2 items-center">
                {camposDe(conversaAtual)["Responsável"] && (
                  <span
                    className="shrink-0 text-[11px] font-medium px-2 py-1 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    title={`${camposDe(conversaAtual)["Responsável"]} está cuidando dessa conversa`}
                  >
                    Com {camposDe(conversaAtual)["Responsável"]}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={atribuirAMim}
                  disabled={atribuindo || !identidade?.nome?.trim()}
                  title={
                    camposDe(conversaAtual)["Responsável"]
                      ? "Remove a atribuição — só muda a visibilidade de quem está cuidando, não mexe no bot"
                      : "Marca você como responsável por essa conversa — só visibilidade, não mexe no bot"
                  }
                >
                  {camposDe(conversaAtual)["Responsável"] ? (
                    <>
                      <UserX className="h-3.5 w-3.5" />
                      Remover atribuição
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5" />
                      Atribuir a mim
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" disabled title="Lembrete/snooze chegando em breve">
                  Adiar
                </Button>
                {conversaAtual.status !== "resolvido" && (
                  <Button size="sm" onClick={() => mudarStatus("resolvido")}>
                    <CircleCheck className="h-4 w-4 mr-1" />
                    Finalizar
                  </Button>
                )}
                {/* Resto das ações — juntas num só menu pra não lotar o cabeçalho de botão (achado
                    real testando com várias ações ligadas ao mesmo tempo: a barra quebrava linha
                    e sobrepunha o texto do nome). */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" title="Mais opções">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setBuscaAberta((v) => !v)}>
                      <Search className="h-4 w-4 mr-2" /> Buscar nesta conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => current && selected && api.exportarConversa(current.id, selected).catch((err) => alert(err instanceof Error ? err.message : "Erro ao exportar"))}
                    >
                      <Download className="h-4 w-4 mr-2" /> Exportar conversa (.txt)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDetailsOpen((v) => !v)}>
                      <Info className="h-4 w-4 mr-2" /> {detailsOpen ? "Esconder" : "Mostrar"} painel do contato
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    {(["novo", "andamento", "resolvido"] as const).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => mudarStatus(s)}>
                        {STATUS_LABEL[s]} {conversaAtual.status === s || (!conversaAtual.status && s === "novo") ? "✓" : ""}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {buscaAberta && (
              <div className="h-12 border-b flex items-center gap-2 px-4 shrink-0 bg-muted/40">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  autoFocus
                  placeholder="Buscar nesta conversa"
                  className="h-8"
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navegarBusca(e.shiftKey ? -1 : 1)
                    if (e.key === "Escape") setBuscaAberta(false)
                  }}
                />
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {buscaTexto.trim()
                    ? mensagensEncontradas.length > 0
                      ? `${buscaIndex + 1}/${mensagensEncontradas.length}`
                      : "0/0"
                    : ""}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={mensagensEncontradas.length === 0}
                  onClick={() => navegarBusca(-1)}
                  title="Resultado anterior"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={mensagensEncontradas.length === 0}
                  onClick={() => navegarBusca(1)}
                  title="Próximo resultado"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setBuscaAberta(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Mensagens */}
            <div ref={scrollRef} onScroll={handleScrollMensagens} className="flex-1 overflow-y-auto px-6 py-3 bg-[#efeae2] dark:bg-[#0b141a]">
              {messages.length > 0 && !semMaisAntigas && (
                <div className="flex justify-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    disabled={carregandoAntigas}
                    onClick={carregarMensagensMaisAntigas}
                  >
                    {carregandoAntigas ? "Carregando..." : "Carregar mensagens mais antigas"}
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-1">
                {messages.map((m, idx) => {
                  const original = m.context_wa_id
                    ? messages.find((o) => o.wa_message_id === m.context_wa_id)
                    : null
                  const semDadosLabel = TIPO_SEM_DADOS_LABEL[m.type]
                  const novoDia = idx === 0 || chaveDia(messages[idx - 1].created_at) !== chaveDia(m.created_at)
                  return (
                    <React.Fragment key={m.id}>
                    {novoDia && (
                      <div className="flex justify-center my-2">
                        <span className="rounded-lg bg-white/90 dark:bg-[#202c33] px-3 py-1 text-xs text-[#54656f] dark:text-[#8696a0] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
                          {rotuloDia(m.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      id={`msg-${m.id}`}
                      className={`group relative max-w-[70%] rounded-lg px-2.5 py-1.5 text-sm shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] whitespace-pre-wrap break-words ${
                        m.direction === "out"
                          ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none self-end dark:bg-[#005c4b] dark:text-[#e9edef]"
                          : "bg-white text-[#111b21] rounded-tl-none self-start dark:bg-[#202c33] dark:text-[#e9edef]"
                      } ${
                        mensagensEncontradas[buscaIndex] === m.id ? "ring-2 ring-yellow-400 ring-offset-1" : ""
                      }`}
                    >
                      {/* Responder — só mostra no hover, pra não poluir a tela toda. */}
                      <button
                        type="button"
                        title="Responder"
                        onClick={() => setReplyTo(m)}
                        className={`absolute -top-2.5 ${
                          m.direction === "out" ? "-left-2.5" : "-right-2.5"
                        } h-5 w-5 rounded-full border bg-background shadow-sm flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground`}
                      >
                        <Reply className="h-3 w-3" />
                      </button>

                      {original && (
                        <div
                          className={`mb-1 rounded-md border-l-2 px-2 py-1 text-xs truncate opacity-80 ${
                            m.direction === "out" ? "bg-black/5 border-[#06cf9c]" : "bg-black/5 border-[#53bdeb]"
                          }`}
                        >
                          {(original.body || "Mídia").split("\n")[0].slice(0, 80)}
                        </div>
                      )}

                      {(m.type === "image" || m.type === "sticker") && m.media_path && (
                        <img
                          src={mediaUrl(m.media_path)}
                          alt=""
                          className={`rounded mb-1 object-contain cursor-pointer ${
                            m.type === "sticker" ? "max-w-[140px] max-h-[140px] w-auto h-auto" : "max-w-[280px] max-h-[360px] w-auto h-auto"
                          }`}
                          onClick={() => setLightbox({ url: mediaUrl(m.media_path), tipo: "image" })}
                        />
                      )}
                      {m.type === "location" &&
                        (() => {
                          let loc: { latitude?: number; longitude?: number; name?: string | null; address?: string | null } = {}
                          try {
                            loc = m.body ? JSON.parse(m.body) : {}
                          } catch {
                            // body não era o JSON esperado — cai no rótulo genérico abaixo
                          }
                          if (loc.latitude == null || loc.longitude == null) return semDadosLabel
                          return (
                            <a
                              href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 mb-1 rounded bg-black/10 px-3 py-2 hover:bg-black/20"
                            >
                              <MapPin className="h-5 w-5 shrink-0" />
                              <span className="truncate underline min-w-0 flex-1">{loc.name || loc.address || "Ver localização"}</span>
                            </a>
                          )
                        })()}
                      {m.type === "contacts" &&
                        (() => {
                          let lista: { nome: string | null; telefone: string | null }[] = []
                          try {
                            lista = m.body ? JSON.parse(m.body) : []
                          } catch {
                            // body não era o JSON esperado
                          }
                          if (!lista.length) return semDadosLabel
                          return (
                            <div className="flex flex-col gap-1">
                              {lista.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 rounded bg-black/10 px-3 py-2">
                                  <User className="h-4 w-4 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{c.nome || "Contato"}</p>
                                    {c.telefone && <p className="text-xs opacity-80">{c.telefone}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      {m.type === "reaction" && (m.body ? `${m.body} reagiu a uma mensagem` : "Reação removida")}
                      {m.type === "video" && m.media_path && (
                        <div className="relative mb-1 w-fit">
                          <video src={mediaUrl(m.media_path)} controls className="rounded max-w-[280px] max-h-[360px] w-auto h-auto" />
                          <button
                            type="button"
                            title="Ver em tela cheia"
                            onClick={() => setLightbox({ url: mediaUrl(m.media_path), tipo: "video" })}
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {m.type === "audio" && m.media_path && <AudioPlayerMensagem src={mediaUrl(m.media_path)} abrirPorPadrao={m.direction === "out"} />}
                      {m.type === "document" && m.media_path && (
                        <a
                          href={mediaUrl(m.media_path)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 mb-1 rounded bg-black/10 px-3 py-2 hover:bg-black/20"
                        >
                          <FileText className="h-5 w-5 shrink-0" />
                          <span className="truncate underline min-w-0 flex-1">{m.body || "Documento"}</span>
                        </a>
                      )}
                      {(m.type !== "document" || !m.media_path) &&
                        !["sticker", "location", "contacts", "reaction"].includes(m.type) &&
                        (semDadosLabel
                          ? semDadosLabel
                          : m.body && buscaTexto.trim()
                          ? destacarTexto(m.body, buscaTexto)
                          : m.body)}
                      {m.status === "failed" && (
                        <div className="text-[11px] mt-1 text-red-600 flex items-start gap-1">
                          <span>⚠️</span>
                          <span>Não entregue{m.error_message ? `: ${m.error_message}` : ""}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-[#667781] dark:text-[#8696a0] mt-0.5 flex items-center justify-end gap-1">
                        {m.direction === "out" && <span className="opacity-80">{m.origem || "Automático"} ·</span>}
                        <span>{formatHora(m.created_at)}</span>
                        {m.direction === "out" && m.status === "read" && <span className="text-[#53bdeb] font-bold tracking-tighter">✓✓</span>}
                        {m.direction === "out" && m.status === "delivered" && <span className="font-bold tracking-tighter">✓✓</span>}
                        {m.direction === "out" && m.status === "sent" && <span className="font-bold">✓</span>}
                      </div>
                    </div>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Preview de "respondendo a" — some ao enviar ou ao cancelar (X). */}
            {replyTo && (
              <div className="flex items-center gap-2 px-4 py-1.5 border-t bg-muted/40 text-xs shrink-0">
                <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 text-muted-foreground">
                  Respondendo: {(replyTo.body || "Mídia").split("\n")[0].slice(0, 80)}
                </span>
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Composer */}
            <AnimatePresence mode="wait" initial={false}>
            {gravando ? (
              <div key="gravando" className="px-2 pb-3 pt-1.5 flex justify-center shrink-0 bg-[#efeae2] dark:bg-[#0b141a]">
                <GravadorBar segundos={gravacaoSegundos} onCancelar={cancelarGravacao} onEnviar={pararGravacaoEEnviar} />
              </div>
            ) : (
              <motion.div
                key="composer"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col shrink-0 bg-[#efeae2] dark:bg-[#0b141a]"
              >
                {/* Atalhos sempre visíveis — os 3 mais usados de verdade (uso_count, já contado
                    em registrarUsoRespostaPronta) ficam à mão sem precisar abrir menu nenhum;
                    "..." abre a lista completa, "+" cria uma nova sem sair da conversa. Clique
                    com o botão direito num atalho edita na hora. */}
                <div className="px-2 pt-2.5 flex justify-center">
                <div className="w-full max-w-[640px] flex items-center justify-center gap-2 flex-wrap">
                  {[...respostas]
                    .sort((a, b) => (b.uso_count || 0) - (a.uso_count || 0))
                    .slice(0, 8)
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setTexto(r.texto)
                          api.registrarUsoRespostaPronta(r.id).catch(() => {})
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setRespostaEditando(r)
                        }}
                        title={`${r.texto}

(botão direito para editar)`}
                        className="max-w-[160px] truncate text-xs font-medium px-3 py-1.5 rounded-xl border bg-background shadow-sm hover:bg-accent hover:border-primary/40 text-foreground transition-colors"
                      >
                        {r.atalho}
                      </button>
                    ))}
                  <DropdownMenu open={respostasMenuOpen} onOpenChange={setRespostasMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        title="Ver todas as respostas prontas"
                        className="h-7 w-7 rounded-xl border bg-background shadow-sm hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto w-64">
                      <DropdownMenuLabel>Respostas prontas</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {respostas.length === 0 && (
                        <DropdownMenuItem disabled>Nenhuma cadastrada</DropdownMenuItem>
                      )}
                      {respostas.map((r) => (
                        <DropdownMenuItem
                          key={r.id}
                          onSelect={(e) => e.preventDefault()}
                          className="flex items-center justify-between gap-1"
                        >
                          <button
                            className="flex-1 min-w-0 truncate text-left"
                            onClick={() => {
                              setTexto(r.texto)
                              api.registrarUsoRespostaPronta(r.id).catch(() => {})
                              setRespostasMenuOpen(false)
                            }}
                          >
                            {r.atalho}
                          </button>
                          <button
                            className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRespostaEditando(r)
                              setRespostasMenuOpen(false)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => setRespostaEditando("novo")}
                    title="Nova resposta pronta"
                    className="h-7 w-7 rounded-xl border border-dashed bg-background hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                </div>

                <div className="px-2 pb-3 pt-1.5 flex justify-center">
                <div className="w-full max-w-[640px] flex items-end gap-1 rounded-full border-transparent bg-white dark:bg-[#2a3942] px-2 py-1.5 shadow-none">
                  <div className="relative">
                    <Button variant="ghost" size="icon" title="Emoji" className="h-9 w-9 rounded-xl shrink-0" onClick={() => setEmojiOpen((v) => !v)}>
                      <span className="text-base leading-none">😊</span>
                    </Button>
                    {emojiOpen && (
                      <>
                        {/* Clique fora fecha o seletor — cobre a tela inteira atrás do picker. */}
                        <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
                        <div className="absolute bottom-full left-0 z-50 mb-1">
                          <React.Suspense
                            fallback={<div className="h-10 w-10 flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                          >
                            <EmojiPickerLazy
                              onEmojiClick={(data) => {
                                inserirEmoji(data.emoji)
                              }}
                            />
                          </React.Suspense>
                        </div>
                      </>
                    )}
                  </div>

                  <label>
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) enviarMidia(file)
                        e.target.value = ""
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" asChild>
                      <span>
                        <Paperclip className="h-4 w-4" />
                      </span>
                    </Button>
                  </label>

                  <div className="relative flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onPaste={(e) => {
                        const item = Array.from(e.clipboardData.items).find((i) => i.kind === "file" && i.type.startsWith("image/"))
                        const file = item?.getAsFile()
                        if (!file) return
                        e.preventDefault()
                        setColada({ file, url: URL.createObjectURL(file) })
                      }}
                      placeholder="Digite uma mensagem"
                      className="min-h-9 max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          enviar()
                        }
                      }}
                    />
                    <CorretorBaloes textareaRef={textareaRef} texto={texto} correcoes={correcoes} onAplicar={aplicarCorrecao} />
                  </div>
                  {texto.trim() ? (
                    <Button size="icon" onClick={enviar} disabled={enviando} className="h-9 w-9 rounded-xl shrink-0 bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)]">
                      <Send className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={iniciarGravacao} disabled={enviando} title="Gravar áudio" className="h-9 w-9 rounded-xl shrink-0">
                      <Mic className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                </div>
                {corretorErro && <p className="text-[10px] text-muted-foreground px-3 pb-1.5">{corretorErro}</p>}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Painel de detalhes do contato — fixo ao lado da conversa (não é mais um Sheet) */}
      {conversaAtual && detailsOpen && (
        <div className="w-[340px] shrink-0 border-l h-screen overflow-y-auto">
          <div className="px-4 py-4">
            <p className="font-semibold text-sm mb-1">Detalhes do contato</p>
            <ContactDetails
              key={conversaAtual.phone}
              conversation={conversaAtual}
              businessId={current.id}
              mostrarPipelineTags={current.id !== "instagram"}
              onSaved={carregarConversas}
              onUsarTexto={setTexto}
            />
          </div>
        </div>
      )}

      <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
      <EditarRespostaProntaDialog
        resposta={respostaEditando}
        onOpenChange={(open) => !open && setRespostaEditando(null)}
        onSaved={carregarRespostas}
      />

      {/* Prévia de imagem colada (Ctrl+V) — confirma antes de enviar, como no WhatsApp Web. O texto
          da caixa vai como legenda. */}
      {colada && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setColada(null)}>
          <div
            className="bg-background rounded-xl p-4 max-w-lg w-full flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setColada(null)
            }}
          >
            <img src={colada.url} alt="" className="max-h-[60vh] w-full object-contain rounded-lg bg-muted" />
            <Textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Adicionar legenda (opcional)"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  const f = colada.file
                  setColada(null)
                  enviarMidia(f)
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setColada(null)}>
                Cancelar
              </Button>
              <Button
                disabled={enviando}
                onClick={() => {
                  const f = colada.file
                  setColada(null)
                  enviarMidia(f)
                }}
              >
                Enviar imagem
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — overlay próprio (não é o componente Dialog) pra ocupar a tela inteira sem
          disputar com o padding/max-height pensados pra formulário. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
            title="Fechar"
          >
            <X className="h-6 w-6" />
          </button>
          {lightbox.tipo === "image" ? (
            <img
              src={lightbox.url}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={lightbox.url}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Editar (renomear atalho/retexto) uma resposta pronta já existente — antes só dava pra
// criar/excluir. Dialog controlado separado do DropdownMenu (ver uso em ChatsPage): fechar o
// menu de respostas e abrir esse dialog evita a complicação de um botão dentro de um item de
// menu do Radix fechar a coisa errada.
function EditarRespostaProntaDialog({
  resposta,
  onOpenChange,
  onSaved,
}: {
  // "novo" = criar uma resposta pronta do zero (mesmo dialog, só troca a chamada de API) — ver
  // botão "+" na barra de atalhos do composer.
  resposta: RespostaPronta | "novo" | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const modoNovo = resposta === "novo"
  const [atalho, setAtalho] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (resposta === "novo") {
      setAtalho("")
      setTexto("")
      setErro(null)
    } else if (resposta) {
      setAtalho(resposta.atalho)
      setTexto(resposta.texto)
      setErro(null)
    }
  }, [resposta])

  async function salvar() {
    if (!resposta || !atalho.trim() || !texto.trim()) return
    setSalvando(true)
    setErro(null)
    try {
      if (modoNovo) {
        await api.criarRespostaPronta(atalho.trim(), texto.trim())
      } else {
        await api.atualizarRespostaPronta((resposta as RespostaPronta).id, atalho.trim(), texto.trim())
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={!!resposta} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{modoNovo ? "Nova resposta pronta" : "Editar resposta pronta"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Atalho</label>
            <Input value={atalho} onChange={(e) => setAtalho(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Texto</label>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={salvando || !atalho.trim() || !texto.trim()}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Alturas de barra "tipo waveform" determinísticas a partir da URL — decorativas, mas cada áudio
// sempre mostra o mesmo desenho (não re-sorteia a cada render).
function barrasDe(seed: string, n: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    out.push(4 + (h % 15))
  }
  return out
}

// Player de áudio — sempre aberto (enviado e recebido): botão de play, onda clicável pra pular
// pro ponto desejado, tempo e velocidade (1x/1.5x/2x). `abrirPorPadrao` ficou só por
// compatibilidade com quem chama; o visual agora é o mesmo nos dois lados. O <audio> real por
// baixo continua usando mediaUrl() (token).
function AudioPlayerMensagem({ src }: { src: string; abrirPorPadrao?: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [tocando, setTocando] = React.useState(false)
  const [duracao, setDuracao] = React.useState(0)
  const [atual, setAtual] = React.useState(0)
  const [erro, setErro] = React.useState(false)
  const [velocidade, setVelocidade] = React.useState(1)
  const barras = React.useMemo(() => barrasDe(src, 36), [src])

  function alternar() {
    const el = audioRef.current
    if (!el) return
    setErro(false)
    if (el.paused) el.play().catch(() => setErro(true))
    else el.pause()
  }

  function pular(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !(Number.isFinite(el.duration) && el.duration > 0)) return
    const r = e.currentTarget.getBoundingClientRect()
    el.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * el.duration
    setAtual(el.currentTime)
  }

  function trocarVelocidade() {
    const prox = velocidade === 1 ? 1.5 : velocidade === 1.5 ? 2 : 1
    setVelocidade(prox)
    if (audioRef.current) audioRef.current.playbackRate = prox
  }

  // Ogg/WebM sem duração no cabeçalho dá Infinity/NaN até o navegador descobrir o fim.
  const duracaoValida = Number.isFinite(duracao) && duracao > 0
  const pct = duracaoValida ? Math.min(1, atual / duracao) : 0
  const tempo = duracaoValida ? (tocando || atual > 0 ? atual : duracao) : atual

  return (
    <div className="flex items-center gap-3 mb-1 w-[270px] max-w-full">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuracao(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime || 0)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false)
          setAtual(0)
        }}
        onError={() => {
          setErro(true)
          setTocando(false)
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={alternar}
        className="h-10 w-10 rounded-full bg-[#0E7C6B] hover:bg-[#0c6a5b] text-white flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all"
        aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
      >
        {tocando ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-[2px] h-7 cursor-pointer" onClick={pular}>
          {barras.map((h, i) => (
            <span
              key={i}
              className={`flex-1 max-w-[4px] rounded-full bg-current transition-opacity duration-150 ${
                i / barras.length < pct ? "opacity-95" : "opacity-30"
              }`}
              style={{ height: h + 4 }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums">
          <span className={erro ? "text-red-500" : "opacity-70"}>
            {erro ? "Erro ao tocar" : formatGravacao(Math.round(tempo))}
          </span>
          <button
            type="button"
            onClick={trocarVelocidade}
            title="Velocidade"
            className="rounded-full border border-current px-1.5 py-px font-medium opacity-60 hover:opacity-100"
          >
            {velocidade}x
          </button>
        </div>
      </div>
    </div>
  )
}

// Barra de gravação no formato da Especitá: cápsula compacta com ponto vermelho pulsando, barras
// "dançando" (feedback visual, não é o volume real) e cronômetro.
function GravadorBar({ segundos, onCancelar, onEnviar }: { segundos: number; onCancelar: () => void; onEnviar: () => void }) {
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 180)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      className="w-fit max-w-[640px] flex items-center gap-3 px-3 py-2 rounded-full border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 shadow-sm"
    >
      <Button variant="ghost" size="icon" onClick={onCancelar} title="Cancelar gravação" className="shrink-0 h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      <div className="flex gap-0.5 items-center shrink-0">
        {[...Array(24)].map((_, i) => (
          <span
            key={i}
            className="w-[2.5px] bg-red-500/70 rounded-full transition-all duration-150"
            style={{ height: 3 + ((Math.sin((tick + i) * 0.7) + 1) / 2) * 14 }}
          />
        ))}
      </div>
      <span className="text-sm tabular-nums text-muted-foreground shrink-0">{formatGravacao(segundos)}</span>
      <Button size="icon" onClick={onEnviar} title="Enviar áudio" className="shrink-0 h-8 w-8 rounded-full bg-[#0E7C6B] hover:bg-[#0c6a5b]">
        <Send className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

// ── Corretor por-trecho: balões posicionados em cima da palavra/expressão errada ──────────────
//
// Técnica: um <div> "espelho" invisível, absolutamente posicionado em cima do próprio textarea
// (mesmo left/top/width/height, mesma fonte/padding/borda — copiados do computed style), com o
// MESMO texto quebrando exatamente do mesmo jeito. Insere um <span> marcador em volta de cada
// trecho "errado" e mede a posição desse span (getBoundingClientRect) relativa ao espelho — como
// o espelho ocupa o mesmo retângulo de tela que o textarea de verdade, essa posição relativa já
// é a posição certa pra desenhar o balão por cima do textarea real.
function CorretorBaloes({
  textareaRef,
  texto,
  correcoes,
  onAplicar,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  texto: string
  correcoes: { errado: string; certo: string }[]
  onAplicar: (correcao: { errado: string; certo: string }) => void
}) {
  const mirrorRef = React.useRef<HTMLDivElement>(null)
  const [posicoes, setPosicoes] = React.useState<
    { correcao: { errado: string; certo: string }; top: number; left: number }[]
  >([])

  const medir = React.useCallback(() => {
    const ta = textareaRef.current
    const mirror = mirrorRef.current
    if (!ta || !mirror || correcoes.length === 0) {
      setPosicoes([])
      return
    }
    const cs = window.getComputedStyle(ta)
    const propriedades = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "boxSizing",
      "textIndent",
    ] as const
    for (const prop of propriedades) {
      mirror.style[prop as any] = cs[prop as any]
    }
    mirror.style.position = "absolute"
    mirror.style.top = "0"
    mirror.style.left = "0"
    mirror.style.width = `${ta.offsetWidth}px`
    mirror.style.height = `${ta.offsetHeight}px`
    mirror.style.whiteSpace = "pre-wrap"
    mirror.style.wordWrap = "break-word"
    mirror.style.overflowWrap = "break-word"
    mirror.style.overflow = "hidden"
    mirror.scrollTop = ta.scrollTop

    // Monta os trechos (texto comum / trecho marcado) na ordem em que aparecem, sem overlap —
    // se duas correções caírem em cima da mesma faixa do texto, a 2ª é ignorada.
    const ocorrencias = correcoes
      .map((c) => ({ c, idx: texto.indexOf(c.errado) }))
      .filter((o) => o.idx !== -1 && o.c.errado.length > 0)
      .sort((a, b) => a.idx - b.idx)

    mirror.innerHTML = ""
    let cursor = 0
    const spans: { el: HTMLSpanElement; correcao: { errado: string; certo: string } }[] = []
    for (const { c, idx } of ocorrencias) {
      if (idx < cursor) continue
      if (idx > cursor) mirror.appendChild(document.createTextNode(texto.slice(cursor, idx)))
      const span = document.createElement("span")
      span.textContent = c.errado
      mirror.appendChild(span)
      spans.push({ el: span, correcao: c })
      cursor = idx + c.errado.length
    }
    if (cursor < texto.length) mirror.appendChild(document.createTextNode(texto.slice(cursor)))

    const mirrorRect = mirror.getBoundingClientRect()
    setPosicoes(
      spans.map(({ el, correcao }) => {
        const r = el.getBoundingClientRect()
        return { correcao, top: r.top - mirrorRect.top, left: r.left - mirrorRect.left }
      }),
    )
  }, [texto, correcoes, textareaRef])

  React.useLayoutEffect(() => {
    medir()
  }, [medir])

  // Textarea com scroll (texto maior que a caixa) muda a posição relativa das linhas — mantém o
  // espelho e os balões sincronizados ao rolar.
  React.useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.addEventListener("scroll", medir)
    return () => ta.removeEventListener("scroll", medir)
  }, [textareaRef, medir])

  if (posicoes.length === 0) return <div ref={mirrorRef} className="invisible pointer-events-none" aria-hidden />

  return (
    <>
      <div ref={mirrorRef} className="invisible pointer-events-none" aria-hidden />
      {posicoes.map((p, i) => (
        <button
          key={i}
          type="button"
          title={`Trocar por "${p.correcao.certo}"`}
          onClick={() => onAplicar(p.correcao)}
          className="absolute z-10 -translate-y-full rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 shadow-sm hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
          style={{ top: p.top, left: p.left }}
        >
          {p.correcao.certo}
        </button>
      ))}
    </>
  )
}

// Dialog de "agendar retorno" (lembrete por conversa — WhatsApp e/ou e-mail, ver README seção
// Retornos). Busca templates aprovados de WhatsApp e templates de e-mail só quando abre, pra
// não pesar toda vez que o painel de detalhes da conversa é montado.
function AgendarRetornoDialog({
  businessId,
  conversation,
  onCreated,
}: {
  businessId: string
  conversation: Conversation
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [canal, setCanal] = React.useState<"whatsapp" | "email" | "ambos">("whatsapp")
  const [dataHora, setDataHora] = React.useState("")
  const [tipo, setTipo] = React.useState("retorno")
  const [waTemplates, setWaTemplates] = React.useState<TemplateInfo[]>([])
  const [waTemplateNome, setWaTemplateNome] = React.useState("")
  const [waParamsTexto, setWaParamsTexto] = React.useState("")
  const [emailTemplates, setEmailTemplates] = React.useState<EmailTemplate[]>([])
  const [emailTemplateId, setEmailTemplateId] = React.useState<number | null>(null)
  const [fluxos, setFluxos] = React.useState<FluxoDinamico[]>([])
  const [fluxoId, setFluxoId] = React.useState<number | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    api.templates(businessId).then((r) => setWaTemplates(r.templates)).catch(() => {})
    api.emailTemplates(businessId).then(setEmailTemplates).catch(() => {})
    api.fluxos(businessId).then(setFluxos).catch(() => {})
  }, [open, businessId])

  async function criar() {
    if (!dataHora) return setErro("Escolha data e hora")
    if ((canal === "whatsapp" || canal === "ambos") && !waTemplateNome) return setErro("Escolha o template de WhatsApp")
    if ((canal === "email" || canal === "ambos") && !emailTemplateId) return setErro("Escolha o template de e-mail")
    if ((canal === "email" || canal === "ambos") && !conversation.email) {
      return setErro("Essa conversa não tem e-mail salvo — use só WhatsApp ou capture o e-mail antes.")
    }
    setErro(null)
    setSalvando(true)
    const params = waParamsTexto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    try {
      await api.criarRetorno(businessId, conversation.phone, {
        tipo,
        dataAgendada: new Date(dataHora).getTime(),
        canal,
        whatsappTemplate: canal !== "email" ? waTemplateNome : undefined,
        whatsappParams: canal !== "email" && params.length ? params : undefined,
        fluxoId: fluxoId ?? undefined,
        emailTemplateId: canal !== "whatsapp" ? emailTemplateId ?? undefined : undefined,
      })
      setOpen(false)
      setDataHora("")
      onCreated()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao agendar")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          Agendar retorno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar retorno</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Tipo</label>
            <Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="retorno, aniversario, reuniao..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Data e hora</label>
            <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Canal</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={canal}
              onChange={(e) => setCanal(e.target.value as typeof canal)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="ambos">Os dois</option>
            </select>
          </div>
          {(canal === "whatsapp" || canal === "ambos") && (
            <div>
              <label className="text-sm font-medium mb-1 block">Template WhatsApp</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={waTemplateNome}
                onChange={(e) => setWaTemplateNome(e.target.value)}
              >
                <option value="">Selecione</option>
                {waTemplates.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              {waTemplateNome && (
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Parâmetros do template (opcional) — 1 por linha, na ordem das variáveis {"{{1}}"}, {"{{2}}"}...
                  </label>
                  <Textarea
                    value={waParamsTexto}
                    onChange={(e) => setWaParamsTexto(e.target.value)}
                    rows={2}
                    placeholder={"{{nome}}\n{{data}}"}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Vazio = só preenche a 1ª variável com o nome salvo do contato. Tokens disponíveis: {"{{nome}}"} e {"{{data}}"}.
                  </p>
                </div>
              )}
            </div>
          )}
          {(canal === "email" || canal === "ambos") && (
            <div>
              <label className="text-sm font-medium mb-1 block">Template e-mail</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={emailTemplateId ?? ""}
                onChange={(e) => setEmailTemplateId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione</option>
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {!conversation.email && (
                <p className="text-xs text-muted-foreground mt-1">Essa conversa ainda não tem e-mail salvo.</p>
              )}
            </div>
          )}
          {(canal === "whatsapp" || canal === "ambos") && (
            <div>
              <label className="text-sm font-medium mb-1 block">Conectar a um fluxo (opcional)</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={fluxoId ?? ""}
                onChange={(e) => setFluxoId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Nenhum — cai no atendimento padrão do número</option>
                {fluxos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                    {f.ativo ? " (ativo)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Assim que o contato responder (qualquer coisa), a conversa entra nesse fluxo em vez do padrão do número.
              </p>
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Manda o histórico da conversa por e-mail (backup). Na 1ª vez em cada canal pede o e-mail de
// destino e salva; das próximas em diante é só clicar (ver GET/POST /painel/api/email-backup).
function ExportarConversaBotao({ businessId, phone }: { businessId: string; phone: string }) {
  const [emailBackup, setEmailBackup] = React.useState<string | null | undefined>(undefined)
  const [emailDigitado, setEmailDigitado] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    setMsg(null)
    api.emailBackup(businessId).then((r) => setEmailBackup(r.email)).catch(() => setEmailBackup(null))
  }, [businessId])

  async function configurarEExportar() {
    if (!emailDigitado.trim()) return
    setEnviando(true)
    try {
      await api.definirEmailBackup(businessId, emailDigitado.trim())
      setEmailBackup(emailDigitado.trim())
      const r = await api.enviarBackupConversaPorEmail(businessId, phone)
      setMsg(`Enviado para ${r.enviadoPara} ✅`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao exportar")
    } finally {
      setEnviando(false)
    }
  }

  async function exportar() {
    setEnviando(true)
    setMsg(null)
    try {
      const r = await api.enviarBackupConversaPorEmail(businessId, phone)
      setMsg(`Enviado para ${r.enviadoPara} ✅`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao exportar")
    } finally {
      setEnviando(false)
    }
  }

  if (emailBackup === undefined) return null

  if (!emailBackup) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">Configure o e-mail de backup deste canal (só 1x):</p>
        <div className="flex gap-1.5">
          <Input
            placeholder="backup@seudominio.com"
            value={emailDigitado}
            onChange={(e) => setEmailDigitado(e.target.value)}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={configurarEExportar} disabled={enviando || !emailDigitado.trim()}>
            Salvar e exportar
          </Button>
        </div>
        {msg && <p className="text-xs">{msg}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" variant="outline" onClick={exportar} disabled={enviando} className="w-fit gap-1.5">
        <Mail className="h-3.5 w-3.5" />
        {enviando ? "Enviando..." : "Backup por e-mail"}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}

// Histórico de notas — diferente da "Nota fixada" (campo único, sempre visível no topo): aqui é
// uma lista datada, pra registrar cada contato/observação sem sobrescrever a anterior.
function NotasSecao({ businessId, phone }: { businessId: string; phone: string }) {
  const [notas, setNotas] = React.useState<NotaConversa[]>([])
  const [texto, setTexto] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)

  const carregar = React.useCallback(() => {
    api.notasDaConversa(businessId, phone).then(setNotas).catch(() => {})
  }, [businessId, phone])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar() {
    if (!texto.trim()) return
    setSalvando(true)
    try {
      await api.adicionarNota(businessId, phone, texto.trim())
      setTexto("")
      carregar()
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(id: number) {
    await api.apagarNota(id)
    carregar()
  }

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> Histórico de notas
      </label>
      <div className="flex flex-col gap-1.5 mb-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Nova nota sobre esse contato..."
          className="text-sm"
        />
        <Button size="sm" variant="outline" onClick={adicionar} disabled={salvando || !texto.trim()} className="w-fit">
          {salvando ? "Salvando..." : "Adicionar nota"}
        </Button>
      </div>
      {notas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {notas.map((n) => (
          <div key={n.id} className="rounded-lg border p-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap flex-1">{n.texto}</p>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => apagar(n.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-muted-foreground mt-1">
              {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

const ATIVIDADE_ICONE: Record<string, string> = {
  tag_add: "🏷️",
  tag_remove: "🏷️",
  etapa: "📶",
  campo: "📝",
  retorno: "⏰",
}

// Linha do tempo — auditoria de tudo que mudou nesse contato (tag/etapa/campo/retorno), com
// data e hora, gerada automaticamente pelo backend (ver atividadeRegistrar em db.js). Só
// leitura: não tem como editar/apagar um item daqui, é um log.
function AtividadesSecao({ businessId, phone, refreshKey }: { businessId: string; phone: string; refreshKey: number }) {
  const [atividades, setAtividades] = React.useState<AtividadeConversa[]>([])

  React.useEffect(() => {
    api.atividadesDaConversa(businessId, phone).then(setAtividades).catch(() => {})
  }, [businessId, phone, refreshKey])

  if (atividades.length === 0) return null

  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        Linha do tempo
      </label>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {atividades.map((a) => (
          <div key={a.id} className="text-xs flex items-start gap-1.5">
            <span className="shrink-0">{ATIVIDADE_ICONE[a.tipo] || "•"}</span>
            <div className="min-w-0">
              <p className="truncate">{a.descricao}</p>
              <p className="text-muted-foreground">
                {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mesma lógica de avatar colorido do Pipeline (src/pages/pipeline.tsx) — duplicada aqui de
// propósito: são só ~10 linhas, e as duas telas não compartilham um módulo de UI em comum
// ainda, não vale criar um pra isso só.
const AVATAR_CORES = ["#111214", "#2F6FED", "#7C5CFC", "#D9476B", "#15803D", "#B45309", "#0E7490"]
function corAvatarContato(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
function iniciaisContato(nome: string | null, phone: string) {
  const base = (nome || phone).trim()
  const partes = base.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

// Agrupa um bloco do painel de CRM (ícone + título + conteúdo) numa carta com borda — antes
// era tudo empilhado sem separação visual nenhuma, difícil de escanear com o olho rápido.
function Secao({
  icon: Icon,
  titulo,
  acao,
  children,
}: {
  icon: typeof Columns3
  titulo: string
  acao?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {titulo}
        </div>
        {acao}
      </div>
      {children}
    </div>
  )
}

function ContactDetails({
  conversation,
  businessId,
  mostrarPipelineTags,
  onSaved,
  onUsarTexto,
}: {
  conversation: Conversation
  businessId: string
  mostrarPipelineTags: boolean
  onSaved: () => void
  // Deixa o "copiloto de vendas" (bloco lilás abaixo) colocar o rascunho sugerido direto no
  // campo de digitar da conversa, sem a pessoa precisar copiar/colar.
  onUsarTexto: (texto: string) => void
}) {
  const { current, channels, setCurrent } = useChannel()
  const { abrirConversa } = useUnread()
  const estagios = pipelineEstagiosPara(current?.label)

  const [nota, setNota] = React.useState(conversation.nota || "")
  const [salvando, setSalvando] = React.useState(false)
  const [reabrindo, setReabrindo] = React.useState(false)
  const [reabrirMsg, setReabrirMsg] = React.useState<string | null>(null)

  const [todasTags, setTodasTags] = React.useState<Tag[]>([])
  const [tagsConversa, setTagsConversa] = React.useState<Tag[]>([])
  const [estagio, setEstagio] = React.useState(conversation.pipeline_estagio || "")
  const [salvandoEstagio, setSalvandoEstagio] = React.useState(false)

  const carregarTags = React.useCallback(() => {
    if (!mostrarPipelineTags) return
    api.tags(businessId).then(setTodasTags).catch(() => {})
  }, [mostrarPipelineTags, businessId])

  // Incrementado a cada mutação (tag/etapa/retorno) pra forçar a Linha do Tempo a recarregar e
  // mostrar a atividade que acabou de acontecer sem precisar trocar de conversa e voltar.
  const [ativRefresh, setAtivRefresh] = React.useState(0)

  const [retornos, setRetornos] = React.useState<Retorno[]>([])
  const carregarRetornos = React.useCallback(() => {
    if (businessId === "instagram") return
    api.retornosDaConversa(businessId, conversation.phone).then(setRetornos).catch(() => {})
  }, [businessId, conversation.phone])

  React.useEffect(() => {
    carregarTags()
    if (!mostrarPipelineTags) return
    api.tagsDaConversa(businessId, conversation.phone).then(setTagsConversa).catch(() => {})
  }, [mostrarPipelineTags, businessId, conversation.phone, carregarTags])

  React.useEffect(() => {
    carregarRetornos()
  }, [carregarRetornos])

  async function cancelarRetorno(id: number) {
    await api.cancelarRetorno(id)
    carregarRetornos()
    setAtivRefresh((v) => v + 1)
  }

  async function alternarTag(tag: Tag) {
    const jaTem = tagsConversa.some((t) => t.id === tag.id)
    if (jaTem) {
      setTagsConversa((prev) => prev.filter((t) => t.id !== tag.id))
      await api.removerTagConversa(businessId, conversation.phone, tag.id)
    } else {
      setTagsConversa((prev) => [...prev, tag])
      await api.adicionarTagConversa(businessId, conversation.phone, tag.id)
    }
    setAtivRefresh((v) => v + 1)
  }

  async function mudarEstagio(novoEstagio: string) {
    setEstagio(novoEstagio)
    setSalvandoEstagio(true)
    try {
      await api.setPipeline(businessId, conversation.phone, novoEstagio || null)
      onSaved()
      setAtivRefresh((v) => v + 1)
    } finally {
      setSalvandoEstagio(false)
    }
  }

  // Sugestão de IA (Gemini) — lê as últimas mensagens e sugere etapa + campos, mas nunca aplica
  // sozinha: cada item só vira dado de verdade quando a pessoa clica "Aplicar".
  const [sugestao, setSugestao] = React.useState<SugestaoIa | null>(null)
  const [carregandoSugestao, setCarregandoSugestao] = React.useState(false)
  const [erroSugestao, setErroSugestao] = React.useState<string | null>(null)
  const [camposAplicados, setCamposAplicados] = React.useState<Set<number>>(new Set())

  async function pedirSugestaoIa() {
    setCarregandoSugestao(true)
    setErroSugestao(null)
    setSugestao(null)
    setCamposAplicados(new Set())
    try {
      const resultado = await api.sugestaoIa(businessId, conversation.phone, estagios)
      setSugestao(resultado)
    } catch (err) {
      setErroSugestao(err instanceof Error ? err.message : "Erro ao consultar a IA")
    } finally {
      setCarregandoSugestao(false)
    }
  }

  async function aplicarCampoSugerido(campoId: number, valor: string) {
    await api.definirCampoConversa(businessId, conversation.phone, campoId, valor)
    setCamposAplicados((prev) => new Set(prev).add(campoId))
    setAtivRefresh((v) => v + 1)
  }

  async function salvar() {
    setSalvando(true)
    try {
      await api.setNota(businessId, conversation.phone, nota)
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  // Mesmo efeito de o cliente mandar "menu" — pra quando o fluxo automático falhou/travou e
  // não dá pra depender de pedir pro cliente digitar algo.
  async function reabrirFluxo() {
    setReabrindo(true)
    setReabrirMsg(null)
    try {
      await api.reabrirFluxo(businessId, conversation.phone)
      setReabrirMsg("Fluxo reaberto! ✅")
    } catch (err) {
      setReabrirMsg(err instanceof Error ? err.message : "Erro ao reabrir")
    } finally {
      setReabrindo(false)
    }
  }

  // ── Renomear/foto/e-mail do contato direto da conversa ("Salvar contato") ─────────────────
  const [editandoNome, setEditandoNome] = React.useState(false)
  const [nomeEdit, setNomeEdit] = React.useState(conversation.name || "")
  const [salvandoNome, setSalvandoNome] = React.useState(false)

  async function salvarNome() {
    const valor = nomeEdit.trim()
    if (!valor || salvandoNome) return
    setSalvandoNome(true)
    try {
      await api.renomearContato(businessId, conversation.phone, valor)
      onSaved()
      setEditandoNome(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao renomear")
    } finally {
      setSalvandoNome(false)
    }
  }

  const [emailEdit, setEmailEdit] = React.useState(conversation.email || "")
  const [salvandoContato, setSalvandoContato] = React.useState(false)
  const fotoInputRef = React.useRef<HTMLInputElement>(null)

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ""
    if (!arquivo) return
    setSalvandoContato(true)
    try {
      const fotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(arquivo)
      })
      await api.salvarFotoContato(businessId, conversation.phone, fotoBase64)
      onSaved()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar foto")
    } finally {
      setSalvandoContato(false)
    }
  }

  async function salvarEmail() {
    const valor = emailEdit.trim()
    setSalvandoContato(true)
    try {
      await api.salvarEmailContato(businessId, conversation.phone, valor)
      onSaved()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar e-mail")
    } finally {
      setSalvandoContato(false)
    }
  }

  // ── Galeria de mídia (imagem/vídeo da conversa inteira, sem limite de janela) ─────────────
  const [galeriaAberta, setGaleriaAberta] = React.useState(false)
  const [midias, setMidias] = React.useState<Pick<Message, "id" | "type" | "media_path" | "media_mime" | "created_at">[]>([])
  const [carregandoMidias, setCarregandoMidias] = React.useState(false)

  function abrirGaleria() {
    setGaleriaAberta(true)
    setCarregandoMidias(true)
    api
      .midias(businessId, conversation.phone)
      .then(setMidias)
      .catch(() => {})
      .finally(() => setCarregandoMidias(false))
  }

  // ── Mesmo telefone em outro canal (outro número de WhatsApp, ou Instagram) ────────────────
  const [outrosCanais, setOutrosCanais] = React.useState<OutroCanal[]>([])
  React.useEffect(() => {
    api.outrosCanais(businessId, conversation.phone).then(setOutrosCanais).catch(() => {})
  }, [businessId, conversation.phone])

  function nomeDoCanal(businessNumberId: string) {
    if (businessNumberId === "instagram") return "Instagram"
    if (businessNumberId === "site") return "Chat do site"
    return channels.find((c) => c.id === businessNumberId)?.label || businessNumberId
  }

  // ── Copiloto de vendas (IA) — lê o cache pré-computado em background pelo servidor; some sem
  // erro se ainda não tiver rodado pra essa conversa (ou sem IA configurada), nunca trava a tela.
  const [copiloto, setCopiloto] = React.useState<{ texto: string | null; insight: string | null } | null>(null)
  const [feedbackDado, setFeedbackDado] = React.useState<"aceita" | "descartada" | null>(null)

  const carregarCopiloto = React.useCallback(() => {
    api
      .sugestaoResposta(businessId, conversation.phone)
      .then((r) => {
        setCopiloto(r)
        setFeedbackDado(null)
        if (r.texto) {
          api.iaFeedbackRegistrar({ businessId, phone: conversation.phone, tipo: "copiloto_resposta", evento: "mostrada" }).catch(() => {})
        }
      })
      .catch(() => setCopiloto(null))
  }, [businessId, conversation.phone])

  React.useEffect(() => {
    carregarCopiloto()
  }, [carregarCopiloto])

  function usarSugestaoCopiloto() {
    if (!copiloto?.texto) return
    onUsarTexto(copiloto.texto)
    setFeedbackDado("aceita")
    api.iaFeedbackRegistrar({ businessId, phone: conversation.phone, tipo: "copiloto_resposta", evento: "aceita" }).catch(() => {})
  }

  function descartarSugestaoCopiloto() {
    setFeedbackDado("descartada")
    api.iaFeedbackRegistrar({ businessId, phone: conversation.phone, tipo: "copiloto_resposta", evento: "descartada" }).catch(() => {})
  }

  const corContato = corAvatarContato(conversation.phone)
  const estagioAtual = estagios.find((e) => e.id === estagio)

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <button
          className="relative h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden group"
          style={{ background: conversation.foto_url ? undefined : corContato }}
          onClick={() => fotoInputRef.current?.click()}
          title="Salvar foto do contato"
          disabled={salvandoContato}
        >
          {conversation.foto_url ? (
            <img src={mediaUrl(conversation.foto_url)} alt="" className="h-full w-full object-cover" />
          ) : (
            iniciaisContato(conversation.name, conversation.phone)
          )}
          <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Camera className="h-3.5 w-3.5 text-white" />
          </span>
        </button>
        <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
        <div className="min-w-0 flex-1">
          {editandoNome ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={nomeEdit}
                onChange={(e) => setNomeEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNome()
                  if (e.key === "Escape") setEditandoNome(false)
                }}
                className="h-7 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-sm"
              />
              <Button size="sm" className="h-7 px-2 text-xs" onClick={salvarNome} disabled={salvandoNome}>
                Ok
              </Button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 text-sm font-medium truncate hover:underline"
              onClick={() => {
                setNomeEdit(conversation.name || "")
                setEditandoNome(true)
              }}
              title="Renomear contato"
            >
              <span className="truncate">{conversation.name || "Sem nome"}</span>
              <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
            </button>
          )}
          <p className="text-xs text-muted-foreground">{conversation.phone}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Galeria de mídia" onClick={abrirGaleria}>
          <Images className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          value={emailEdit}
          onChange={(e) => setEmailEdit(e.target.value)}
          onBlur={salvarEmail}
          onKeyDown={(e) => e.key === "Enter" && salvarEmail()}
          placeholder="E-mail do contato"
          className="h-6 flex-1 min-w-0 rounded-md border border-transparent hover:border-input focus:border-input bg-transparent px-1.5 text-xs"
        />
      </div>

      {outrosCanais.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {outrosCanais.map((c) => (
            <button
              key={c.business_number_id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed text-muted-foreground hover:bg-accent"
              title="Também conversou por esse canal"
              onClick={() => {
                // Chat do site e WhatsApp do mesmo celular abrem direto na conversa certa (visão "Todos os canais").
                if (c.phone) { abrirConversa(c.business_number_id, c.phone); return }
                const canal = channels.find((ch) => ch.id === c.business_number_id)
                if (canal) setCurrent(canal)
              }}
            >
              <ExternalLink className="h-2.5 w-2.5" /> {nomeDoCanal(c.business_number_id)}
            </button>
          ))}
        </div>
      )}

      {/* Nota fixada primeiro — é o "resumo de 1 olhada", por isso tem que ser mesmo a 1ª
          coisa visível, não a última (bug de ordem da versão anterior: o texto já dizia
          "sempre visível no topo" mas o bloco vinha depois de tudo). */}
      <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-3 flex flex-col gap-2">
        <label className="text-xs font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" /> Nota fixada
        </label>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Resumo curto sempre visível aqui em cima..."
          className="text-sm bg-background"
        />
        <Button size="sm" className="w-fit" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar nota"}
        </Button>
      </div>

      {/* Copiloto de vendas (IA) — rascunho de resposta + leitura estratégica da conversa,
          pré-computado em background pelo servidor (ver /sugestao-resposta). Nunca manda nada
          sozinho: só preenche o campo de digitar quando a pessoa clica "Usar". */}
      {businessId !== "instagram" && copiloto?.texto && (
        <div className="rounded-xl border border-violet-300/60 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-900/50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800 dark:text-violet-400 uppercase tracking-wide">
              <Wand2 className="h-3.5 w-3.5" /> Copiloto de vendas
            </div>
            <button onClick={carregarCopiloto} className="text-muted-foreground hover:text-foreground" title="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          {copiloto.insight && <p className="text-xs italic text-violet-900/80 dark:text-violet-300/80">{copiloto.insight}</p>}
          <p className="text-sm bg-background/70 rounded-md p-2 whitespace-pre-wrap">{copiloto.texto}</p>
          {feedbackDado ? (
            <p className="text-[11px] text-muted-foreground">
              {feedbackDado === "aceita" ? "Colocado no campo de digitar." : "Sugestão descartada."}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={usarSugestaoCopiloto}>
                <ThumbsUp className="h-3 w-3" /> Usar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={descartarSugestaoCopiloto}>
                <ThumbsDown className="h-3 w-3" /> Não agora
              </Button>
            </div>
          )}
        </div>
      )}

      {mostrarPipelineTags && (
        <div className="rounded-xl border p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Sugestão da IA
            </div>
            {sugestao && (
              <button
                onClick={() => setSugestao(null)}
                className="text-muted-foreground hover:text-foreground"
                title="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {!sugestao && !carregandoSugestao && (
            <>
              <p className="text-xs text-muted-foreground">
                Lê as últimas mensagens e sugere a etapa e os campos — você decide se aplica.
              </p>
              <Button size="sm" variant="outline" className="w-fit gap-1.5" onClick={pedirSugestaoIa}>
                <Sparkles className="h-3.5 w-3.5" /> Analisar conversa
              </Button>
              {erroSugestao && <p className="text-xs text-red-600 dark:text-red-400">{erroSugestao}</p>}
            </>
          )}

          {carregandoSugestao && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando conversa...
            </p>
          )}

          {sugestao && (
            <div className="flex flex-col gap-2.5">
              {sugestao.resumo && <p className="text-xs text-muted-foreground italic">{sugestao.resumo}</p>}

              {sugestao.etapa_id && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    Etapa sugerida:{" "}
                    <span className="font-medium">
                      {estagios.find((e) => e.id === sugestao.etapa_id)?.nome || sugestao.etapa_id}
                    </span>
                  </span>
                  {estagio === sugestao.etapa_id ? (
                    <span className="text-[11px] text-muted-foreground">já aplicada</span>
                  ) : (
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => mudarEstagio(sugestao.etapa_id!)}>
                      Aplicar
                    </Button>
                  )}
                </div>
              )}

              {sugestao.campos.map((c) => (
                <div key={c.campo_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    {c.nome}: <span className="font-medium">{c.valor}</span>
                  </span>
                  {camposAplicados.has(c.campo_id) ? (
                    <span className="text-[11px] text-muted-foreground shrink-0">aplicado</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs shrink-0"
                      onClick={() => aplicarCampoSugerido(c.campo_id, c.valor)}
                    >
                      Aplicar
                    </Button>
                  )}
                </div>
              ))}

              {!sugestao.etapa_id && sugestao.campos.length === 0 && (
                <p className="text-xs text-muted-foreground">Não achei nada confiável pra sugerir nessa conversa.</p>
              )}

              <Button size="sm" variant="ghost" className="w-fit h-7 text-xs gap-1.5" onClick={pedirSugestaoIa}>
                <Sparkles className="h-3 w-3" /> Analisar de novo
              </Button>
            </div>
          )}
        </div>
      )}

      {mostrarPipelineTags && (
        <Secao
          icon={Columns3}
          titulo="Etapa do pipeline"
          acao={
            estagioAtual && (
              <span className="h-2 w-2 rounded-full" style={{ background: estagioAtual.cor }} />
            )
          }
        >
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
            value={estagio}
            disabled={salvandoEstagio}
            onChange={(e) => mudarEstagio(e.target.value)}
          >
            <option value="">Sem etapa definida</option>
            {estagios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Secao>
      )}

      {mostrarPipelineTags && (
        <Secao icon={Tags} titulo="Tags" acao={<GerenciarTags businessId={businessId} tags={todasTags} onChange={carregarTags} />}>
          {todasTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tag criada ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {todasTags.map((tag) => {
                const ativa = tagsConversa.some((t) => t.id === tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => alternarTag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      ativa ? "text-white border-transparent" : "text-muted-foreground border-border hover:bg-accent"
                    }`}
                    style={ativa ? { background: tag.cor } : undefined}
                  >
                    {tag.nome}
                  </button>
                )
              })}
            </div>
          )}
        </Secao>
      )}

      {businessId !== "instagram" && (
        <Secao icon={CalendarClock} titulo="Retornos agendados">
          {conversation.email && (
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <Mail className="h-3 w-3" /> {conversation.email}
            </p>
          )}
          {retornos.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {retornos.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {r.tipo} · {r.canal}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(r.data_agendada).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {r.status !== "pending" ? ` · ${r.status}` : ""}
                    </p>
                  </div>
                  {r.status === "pending" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => cancelarRetorno(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <AgendarRetornoDialog
            businessId={businessId}
            conversation={conversation}
            onCreated={() => {
              carregarRetornos()
              setAtivRefresh((v) => v + 1)
            }}
          />
        </Secao>
      )}

      {businessId !== "instagram" && (
        <div className="rounded-xl border p-3">
          <NotasSecao businessId={businessId} phone={conversation.phone} />
        </div>
      )}

      {businessId !== "instagram" && (
        <div className="rounded-xl border p-3">
          <AtividadesSecao businessId={businessId} phone={conversation.phone} refreshKey={ativRefresh} />
        </div>
      )}

      {/* Ações operacionais (exportar, reabrir fluxo) vão por último — é o que se usa menos
          vezes por conversa, não precisa competir por atenção com o que muda toda hora. */}
      {businessId !== "instagram" && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ExportarConversaBotao businessId={businessId} phone={conversation.phone} />
            <Button size="sm" variant="outline" onClick={reabrirFluxo} disabled={reabrindo}>
              {reabrindo ? "Reabrindo..." : "Reabrir fluxo automático"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            "Reabrir fluxo" tem o mesmo efeito de o cliente mandar "menu" — use se a automação travou.
          </p>
          {reabrirMsg && <p className="text-xs">{reabrirMsg}</p>}
        </div>
      )}

      <Dialog open={galeriaAberta} onOpenChange={setGaleriaAberta}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mídia da conversa</DialogTitle>
          </DialogHeader>
          {carregandoMidias ? (
            <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
          ) : midias.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma imagem ou vídeo nessa conversa ainda.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
              {midias.map((m) => (
                <a key={m.id} href={mediaUrl(m.media_path) || "#"} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border aspect-square bg-muted">
                  {m.type === "video" ? (
                    <video src={mediaUrl(m.media_path) || undefined} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={mediaUrl(m.media_path) || undefined} alt="" className="w-full h-full object-cover" />
                  )}
                </a>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Conta (número) e template são escolhidos DENTRO do diálogo, independente de qual canal
// está aberto no painel no momento — evita mandar campanha pelo número errado só porque era
// o que estava selecionado na lista de conversas. O nome do template não é mais digitado à
// mão: vem direto da lista de templates aprovados na Meta pra conta escolhida (ver
// GET /painel/api/templates/:businessId), então não tem como digitar um nome inexistente ou
// não aprovado — que era um jeito comum de "enviei mas não chegou" sem erro nenhum aparecer.
function BroadcastDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { channels } = useChannel()
  const contas = React.useMemo(() => channels.filter((c) => c.kind === "whatsapp"), [channels])
  const [contaId, setContaId] = React.useState("")
  const [templates, setTemplates] = React.useState<TemplateInfo[]>([])
  const [templatesCarregando, setTemplatesCarregando] = React.useState(false)
  const [templatesErro, setTemplatesErro] = React.useState<string | null>(null)
  const [templateNome, setTemplateNome] = React.useState("")
  const [contatos, setContatos] = React.useState("")
  const [intervaloMin, setIntervaloMin] = React.useState("0")
  const [intervaloSeg, setIntervaloSeg] = React.useState("0")
  const [fluxos, setFluxos] = React.useState<FluxoDinamico[]>([])
  const [fluxoId, setFluxoId] = React.useState<number | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [resumo, setResumo] = React.useState<string | null>(null)
  const [falhas, setFalhas] = React.useState<BroadcastResult[]>([])
  const [fila, setFila] = React.useState<BroadcastFilaItem[]>([])

  React.useEffect(() => {
    if (open && !contaId && contas.length) setContaId(contas[0].id)
  }, [open, contaId, contas])

  const carregarFila = React.useCallback(() => {
    if (!contaId) return
    api.broadcastFila(contaId).then(setFila).catch(() => {})
  }, [contaId])

  React.useEffect(() => {
    if (!open || !contaId) return
    carregarFila()
  }, [open, contaId, carregarFila])

  React.useEffect(() => {
    if (!open || !contaId) return
    setFluxoId(null)
    api.fluxos(contaId).then(setFluxos).catch(() => {})
  }, [open, contaId])

  async function cancelarItem(id: number) {
    try {
      await api.broadcastCancelar(id)
      setFila((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setResumo(err instanceof Error ? err.message : "Erro ao cancelar")
    }
  }

  React.useEffect(() => {
    if (!open || !contaId) return
    setTemplatesCarregando(true)
    setTemplatesErro(null)
    setTemplateNome("")
    api
      .templates(contaId)
      .then(({ templates }) => setTemplates(templates))
      .catch((err) => setTemplatesErro(err instanceof Error ? err.message : "Erro ao carregar templates"))
      .finally(() => setTemplatesCarregando(false))
  }, [open, contaId])

  const templateSelecionado = templates.find((t) => t.name === templateNome)

  async function enviar() {
    const linhas = contatos
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    const contacts = linhas.map((l) => {
      const idx = l.indexOf(",")
      const phone = (idx === -1 ? l : l.slice(0, idx)).trim()
      const name = (idx === -1 ? "" : l.slice(idx + 1)).trim()
      return { phone, name }
    })
    if (!contaId || !templateNome || !contacts.length) {
      setResumo("Escolha a conta, o template e ao menos um contato.")
      setFalhas([])
      return
    }
    const intervalSeconds = (Number(intervaloMin) || 0) * 60 + (Number(intervaloSeg) || 0)
    setEnviando(true)
    setResumo(null)
    setFalhas([])
    try {
      const { resultados, agendados } = await api.broadcast(contaId, {
        template: templateNome,
        language: templateSelecionado?.language || "pt_BR",
        contacts,
        intervalSeconds: intervalSeconds > 0 ? intervalSeconds : undefined,
        fluxoId: fluxoId ?? undefined,
      })
      const ok = resultados.filter((r) => r.ok).length
      const partes = [`${ok} enviada(s) agora.`]
      if (resultados.length - ok > 0) partes.push(`${resultados.length - ok} falharam.`)
      if (agendados) {
        const min = Math.floor(intervalSeconds / 60)
        const seg = intervalSeconds % 60
        const intervaloTexto = seg ? `${min}min${seg}s` : `${min}min`
        partes.push(`${agendados} agendada(s), uma a cada ${intervaloTexto}.`)
      }
      setResumo(partes.join(" "))
      setFalhas(resultados.filter((r) => !r.ok))
      if (agendados) carregarFila()
    } catch (err) {
      setResumo(err instanceof Error ? err.message : "Erro ao enviar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envio em massa (template)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Enviar de</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Template (aprovado na Meta)</label>
            {templatesErro ? (
              <p className="text-sm text-destructive">Não consegui carregar os templates: {templatesErro}</p>
            ) : (
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                value={templateNome}
                onChange={(e) => setTemplateNome(e.target.value)}
                disabled={templatesCarregando || !templates.length}
              >
                <option value="">
                  {templatesCarregando
                    ? "Carregando..."
                    : templates.length
                    ? "Escolha um template"
                    : "Nenhum template aprovado encontrado"}
                </option>
                {templates.map((t) => (
                  <option key={`${t.name}-${t.language}`} value={t.name}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Contatos — telefone,variável (opcional) por linha
            </label>
            <Textarea
              value={contatos}
              onChange={(e) => setContatos(e.target.value)}
              rows={6}
              placeholder={"5511999999999,João\n5511888888888"}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Intervalo entre mensagens (deixe 0 pra mandar tudo de uma vez)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={intervaloMin}
                onChange={(e) => setIntervaloMin(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">min</span>
              <Input
                type="number"
                min={0}
                max={59}
                value={intervaloSeg}
                onChange={(e) => setIntervaloSeg(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">seg</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              O 1º contato sai na hora; os demais ficam agendados nesse intervalo, mesmo se você fechar o painel.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Conectar a um fluxo (opcional)</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={fluxoId ?? ""}
              onChange={(e) => setFluxoId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Nenhum — cai no atendimento padrão do número</option>
              {fluxos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                  {f.ativo ? " (ativo)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Assim que cada contato responder (qualquer coisa), a conversa entra nesse fluxo em vez do padrão do número — ex.:
              template "Bom dia!" como gancho e a conversa de verdade acontece no fluxo.
            </p>
          </div>
          {fila.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">Fila pendente ({fila.length})</label>
              <ul className="text-xs border rounded-md divide-y max-h-32 overflow-y-auto">
                {fila.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate min-w-0 flex-1">
                      {item.name ? `${item.name} · ` : ""}
                      {item.phone} — {formatTime(item.agendado_para)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-destructive shrink-0"
                      onClick={() => cancelarItem(item.id)}
                    >
                      Cancelar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resumo && <p className="text-sm">{resumo}</p>}
          {falhas.length > 0 && (
            <ul className="text-xs text-destructive space-y-0.5 max-h-24 overflow-y-auto">
              {falhas.map((f, i) => (
                <li key={i}>
                  {f.phone}: {f.error || "falhou"}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button onClick={enviar} disabled={enviando || !contaId || !templateNome}>
            {enviando ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
