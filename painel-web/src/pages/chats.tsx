import * as React from "react"
import { useChannel, type Channel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import {
  api,
  type Conversation,
  type Message,
  type RespostaPronta,
  type TemplateInfo,
  type BroadcastResult,
  type BroadcastFilaItem,
  type Tag,
  PIPELINE_ESTAGIOS,
  CANAL_ANALYTICS_LABEL,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Search,
  Send,
  Paperclip,
  Info,
  MessagesSquare,
  Radio,
  Smile,
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
} from "lucide-react"

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

export function ChatsPage() {
  const { channels, current, setCurrent } = useChannel()
  const {
    notifPermission,
    requestNotifPermission,
    unreadChannels,
    unreadConversations,
    markConversationSeen,
    setActiveConversation,
    alvoAbrir,
    limparAlvoAbrir,
  } = useUnread()
  const [conversations, setConversations] = React.useState<Conversation[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [search, setSearch] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [respostas, setRespostas] = React.useState<RespostaPronta[]>([])
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)
  const [mostrarFinalizadas, setMostrarFinalizadas] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

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

  React.useEffect(() => {
    api.respostasProntas().then(setRespostas).catch(() => {})
  }, [])

  const carregarConversas = React.useCallback(() => {
    if (!current) return
    api.conversations(current.id, { finalizadas: mostrarFinalizadas }).then(setConversations).catch(() => {})
  }, [current, mostrarFinalizadas])

  function selecionarCanal(c: Channel) {
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
    api.messages(current.id, selected).then(setMessages).catch(() => {})
  }, [current, selected])

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

  React.useEffect(() => {
    setSelected(null)
    setMessages([])
    carregarConversas()
  }, [current, carregarConversas])

  // Clique numa notificação do navegador (ver unread-context.tsx) pede pra abrir uma conversa
  // específica — só aplica quando o canal já trocou pro certo (senão abriria o contato errado
  // num canal errado por uma fração de segundo). Roda DEPOIS do efeito acima de propósito
  // (mesma troca de canal zera `selected` pra null primeiro).
  React.useEffect(() => {
    if (!alvoAbrir || !current || alvoAbrir.channelId !== current.id) return
    setSelected(alvoAbrir.phone)
    limparAlvoAbrir()
  }, [alvoAbrir, current, limparAlvoAbrir])

  React.useEffect(() => {
    carregarMensagens()
  }, [selected, carregarMensagens])

  React.useEffect(() => {
    const id = setInterval(() => {
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
    if (nearBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages])

  const conversaAtual = conversations.find((c) => c.phone === selected) || null

  const listaFiltrada = conversations.filter((c) => {
    const alvo = `${c.name || ""} ${c.phone}`.toLowerCase()
    return alvo.includes(search.toLowerCase())
  })

  async function enviar() {
    if (!current || !selected || !texto.trim()) return
    setEnviando(true)
    try {
      await api.reply(current.id, selected, texto.trim())
      setTexto("")
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
                    <p className="text-xs text-muted-foreground">{current.label}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "whatsapp")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                      <Phone className="h-4 w-4" /> <span className="flex-1">{c.label}</span>
                      {unreadChannels.has(c.id) && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Instagram</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "instagram")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                      <InstagramIcon className="h-4 w-4" /> <span className="flex-1">{c.label}</span>
                      {unreadChannels.has(c.id) && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                    </DropdownMenuItem>
                  ))}
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
              placeholder="Buscar conversa"
              className="pl-9"
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
            <div className="flex flex-col gap-1 p-2">
            {listaFiltrada.map((c) => {
              const naoLida = current ? unreadConversations.has(`${current.id}|${c.phone}`) : false
              return (
              <button
                key={c.phone}
                onClick={() => {
                  setSelected(c.phone)
                  if (current) markConversationSeen(current.id, c.phone)
                }}
                className={`w-full p-3 rounded-lg cursor-pointer text-left transition-colors ${
                  naoLida
                    ? "animate-pulse bg-red-50 dark:bg-red-950/40"
                    : selected === c.phone
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex flex-row gap-3 items-center">
                  <div className="relative shrink-0">
                    <Avatar className="size-12">
                      <AvatarFallback>{initials(c.name, c.phone)}</AvatarFallback>
                    </Avatar>
                    {vistoRecentemente(c.last_seen_at) && (
                      <span
                        title={formatVisto(c.last_seen_at) || undefined}
                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="truncate text-sm min-w-0 flex-1">{c.name || c.phone}</CardTitle>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <CardDescription className="truncate min-w-0 flex-1">
                        {c.last_direction === "out" ? "Você: " : ""}
                        {c.last_body || "—"}
                      </CardDescription>
                      {c.status && c.status !== "novo" && (
                        <Badge variant={STATUS_VARIANT[c.status]} className="shrink-0 text-[10px]">
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      )}
                    </div>
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
      <div className="flex-1 min-w-0 border-l">
        {!conversaAtual ? (
          <div className="flex flex-col h-screen items-center justify-center text-muted-foreground gap-2">
            <MessagesSquare className="h-8 w-8" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <div className="flex flex-col h-screen">
            {/* Cabeçalho */}
            <div className="h-14 border-b flex items-center px-4 shrink-0 gap-3">
              <Avatar className="size-9">
                <AvatarFallback>{initials(conversaAtual.name, conversaAtual.phone)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-sm truncate">{conversaAtual.name || conversaAtual.phone}</CardTitle>
                <CardDescription className="truncate">
                  {formatVisto(conversaAtual.last_seen_at) || conversaAtual.phone}
                </CardDescription>
              </div>
              <div className="flex-grow flex justify-end gap-2 items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Buscar nesta conversa"
                  onClick={() => setBuscaAberta((v) => !v)}
                >
                  <Search className="h-4 w-4" />
                </Button>
                {conversaAtual.status !== "resolvido" && (
                  <Button variant="outline" size="sm" onClick={() => mudarStatus("resolvido")}>
                    <CircleCheck className="h-4 w-4 mr-1" />
                    Finalizar
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {STATUS_LABEL[conversaAtual.status || "novo"]}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["novo", "andamento", "resolvido"] as const).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => mudarStatus(s)}>
                        {STATUS_LABEL[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Exportar conversa (.txt)"
                  onClick={() => current && selected && api.exportarConversa(current.id, selected).catch((err) => alert(err instanceof Error ? err.message : "Erro ao exportar"))}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(true)}>
                  <Info className="h-4 w-4" />
                </Button>
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
            <div ref={scrollRef} onScroll={handleScrollMensagens} className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.direction === "out"
                        ? "bg-primary text-primary-foreground self-end"
                        : "bg-secondary text-secondary-foreground self-start"
                    } ${
                      mensagensEncontradas[buscaIndex] === m.id ? "ring-2 ring-yellow-400 ring-offset-1" : ""
                    }`}
                  >
                    {m.type === "image" && m.media_path && (
                      <img
                        src={m.media_path}
                        alt=""
                        className="rounded mb-1 max-w-[280px] max-h-[360px] w-auto h-auto object-contain cursor-pointer"
                        onClick={() => window.open(m.media_path!, "_blank")}
                      />
                    )}
                    {m.type === "video" && m.media_path && (
                      <video src={m.media_path} controls className="rounded mb-1 max-w-[280px] max-h-[360px] w-auto h-auto" />
                    )}
                    {m.type === "audio" && m.media_path && (
                      <audio src={m.media_path} controls className="mb-1 max-w-[280px] w-full" />
                    )}
                    {m.type === "document" && m.media_path && (
                      <a
                        href={m.media_path}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 mb-1 rounded bg-black/10 px-3 py-2 hover:bg-black/20"
                      >
                        <FileText className="h-5 w-5 shrink-0" />
                        <span className="truncate underline min-w-0 flex-1">{m.body || "Documento"}</span>
                      </a>
                    )}
                    {(m.type !== "document" || !m.media_path) &&
                      (m.body && buscaTexto.trim() ? destacarTexto(m.body, buscaTexto) : m.body)}
                    {m.status === "failed" && (
                      <div className="text-[11px] mt-1 text-red-200 flex items-start gap-1">
                        <span>⚠️</span>
                        <span>Não entregue{m.error_message ? `: ${m.error_message}` : ""}</span>
                      </div>
                    )}
                    <div className="text-[10px] opacity-70 mt-1 text-right">
                      {formatTime(m.created_at)}
                      {m.direction === "out" && m.status && ` · ${m.status}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Composer */}
            {gravando ? (
              <div className="flex items-center gap-3 p-2 border-t shrink-0">
                <Button variant="ghost" size="icon" onClick={cancelarGravacao} title="Cancelar gravação">
                  <X className="h-4 w-4" />
                </Button>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-sm tabular-nums flex-1">{formatGravacao(gravacaoSegundos)}</span>
                <Button size="icon" onClick={pararGravacaoEEnviar} title="Enviar áudio">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-1 p-2 border-t shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    <DropdownMenuLabel>Respostas prontas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {respostas.length === 0 && (
                      <DropdownMenuItem disabled>Nenhuma cadastrada</DropdownMenuItem>
                    )}
                    {respostas.map((r) => (
                      <DropdownMenuItem key={r.id} onClick={() => setTexto(r.texto)}>
                        {r.atalho}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

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
                  <Button variant="ghost" size="icon" asChild>
                    <span>
                      <Paperclip className="h-4 w-4" />
                    </span>
                  </Button>
                </label>

                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Digite uma mensagem"
                  className="min-h-9 flex-1 resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      enviar()
                    }
                  }}
                />
                {texto.trim() ? (
                  <Button size="icon" onClick={enviar} disabled={enviando}>
                    <Send className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" onClick={iniciarGravacao} disabled={enviando} title="Gravar áudio">
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detalhes do contato */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalhes do contato</SheetTitle>
          </SheetHeader>
          {conversaAtual && (
            <ContactDetails
              key={conversaAtual.phone}
              conversation={conversaAtual}
              businessId={current.id}
              mostrarPipelineTags={current.label === CANAL_ANALYTICS_LABEL}
              onSaved={carregarConversas}
            />
          )}
        </SheetContent>
      </Sheet>

      <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  )
}

function ContactDetails({
  conversation,
  businessId,
  mostrarPipelineTags,
  onSaved,
}: {
  conversation: Conversation
  businessId: string
  mostrarPipelineTags: boolean
  onSaved: () => void
}) {
  const [nota, setNota] = React.useState(conversation.nota || "")
  const [salvando, setSalvando] = React.useState(false)
  const [reabrindo, setReabrindo] = React.useState(false)
  const [reabrirMsg, setReabrirMsg] = React.useState<string | null>(null)

  const [todasTags, setTodasTags] = React.useState<Tag[]>([])
  const [tagsConversa, setTagsConversa] = React.useState<Tag[]>([])
  const [estagio, setEstagio] = React.useState(conversation.pipeline_estagio || "")
  const [salvandoEstagio, setSalvandoEstagio] = React.useState(false)

  React.useEffect(() => {
    if (!mostrarPipelineTags) return
    api.tags(businessId).then(setTodasTags).catch(() => {})
    api.tagsDaConversa(businessId, conversation.phone).then(setTagsConversa).catch(() => {})
  }, [mostrarPipelineTags, businessId, conversation.phone])

  async function alternarTag(tag: Tag) {
    const jaTem = tagsConversa.some((t) => t.id === tag.id)
    if (jaTem) {
      setTagsConversa((prev) => prev.filter((t) => t.id !== tag.id))
      await api.removerTagConversa(businessId, conversation.phone, tag.id)
    } else {
      setTagsConversa((prev) => [...prev, tag])
      await api.adicionarTagConversa(businessId, conversation.phone, tag.id)
    }
  }

  async function mudarEstagio(novoEstagio: string) {
    setEstagio(novoEstagio)
    setSalvandoEstagio(true)
    try {
      await api.setPipeline(businessId, conversation.phone, novoEstagio || null)
      onSaved()
    } finally {
      setSalvandoEstagio(false)
    }
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

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{conversation.name || "Sem nome"}</p>
        <p className="text-sm text-muted-foreground">{conversation.phone}</p>
      </div>
      {businessId !== "instagram" && (
        <div>
          <Button size="sm" variant="outline" onClick={reabrirFluxo} disabled={reabrindo}>
            {reabrindo ? "Reabrindo..." : "Reabrir fluxo automático"}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Mesmo efeito de o cliente mandar "menu" — use se a automação travou.
          </p>
          {reabrirMsg && <p className="text-xs mt-1">{reabrirMsg}</p>}
        </div>
      )}
      {mostrarPipelineTags && (
        <>
          <div>
            <label className="text-sm font-medium mb-1 block">Etapa do pipeline</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
              value={estagio}
              disabled={salvandoEstagio}
              onChange={(e) => mudarEstagio(e.target.value)}
            >
              <option value="">Sem etapa definida</option>
              {PIPELINE_ESTAGIOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Tags</label>
            {todasTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma tag criada ainda — crie em Analytics → Gerenciar tags.
              </p>
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
          </div>
        </>
      )}
      <div>
        <label className="text-sm font-medium mb-1 block">Nota interna</label>
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={5} />
        <Button size="sm" className="mt-2" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar nota"}
        </Button>
      </div>
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
