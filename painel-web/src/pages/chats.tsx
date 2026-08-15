import * as React from "react"
import { useChannel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import { api, type Conversation, type Message, type RespostaPronta } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  andamento: "Em andamento",
  resolvido: "Resolvido",
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

export function ChatsPage() {
  const { current } = useChannel()
  const { notifPermission, requestNotifPermission } = useUnread()
  const [conversations, setConversations] = React.useState<Conversation[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Message[]>([])
  const [search, setSearch] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [respostas, setRespostas] = React.useState<RespostaPronta[]>([])
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    api.respostasProntas().then(setRespostas).catch(() => {})
  }, [])

  const carregarConversas = React.useCallback(() => {
    if (!current) return
    api.conversations(current.id).then(setConversations).catch(() => {})
  }, [current])

  const carregarMensagens = React.useCallback(() => {
    if (!current || !selected) return
    api.messages(current.id, selected).then(setMessages).catch(() => {})
  }, [current, selected])

  React.useEffect(() => {
    setSelected(null)
    setMessages([])
    carregarConversas()
  }, [current, carregarConversas])

  React.useEffect(() => {
    carregarMensagens()
  }, [selected, carregarMensagens])

  React.useEffect(() => {
    const id = setInterval(() => {
      carregarConversas()
      carregarMensagens()
    }, 5000)
    return () => clearInterval(id)
  }, [carregarConversas, carregarMensagens])

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
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

  async function enviarImagem(file: File) {
    if (!current || !selected) return
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setEnviando(true)
    try {
      await api.reply(current.id, selected, texto.trim(), base64)
      setTexto("")
      carregarMensagens()
      carregarConversas()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar imagem")
    } finally {
      setEnviando(false)
    }
  }

  async function mudarStatus(status: "novo" | "andamento" | "resolvido") {
    if (!current || !selected) return
    await api.setStatus(current.id, selected, status)
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
            <div>
              <p className="font-semibold text-sm">Conversas</p>
              <p className="text-xs text-muted-foreground">{current.label}</p>
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
              <Button variant="ghost" size="icon" onClick={() => setBroadcastOpen(true)} title="Envio em massa">
                <Radio className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative px-3 py-3 shrink-0">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="flex-1">
            {listaFiltrada.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Nenhuma conversa ainda.
              </p>
            )}
            {listaFiltrada.map((c) => (
              <button
                key={c.phone}
                onClick={() => setSelected(c.phone)}
                className={`px-3 w-full py-2.5 hover:bg-secondary cursor-pointer text-left border-b border-border/50 ${
                  selected === c.phone ? "bg-secondary" : ""
                }`}
              >
                <div className="flex flex-row gap-3 items-start">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback>{initials(c.name, c.phone)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="truncate text-sm">{c.name || c.phone}</CardTitle>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <CardDescription className="truncate">
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
            ))}
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
                <CardDescription className="truncate">{conversaAtual.phone}</CardDescription>
              </div>
              <div className="flex-grow flex justify-end gap-2 items-center">
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
                <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(true)}>
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.direction === "out"
                        ? "bg-primary text-primary-foreground self-end"
                        : "bg-secondary text-secondary-foreground self-start"
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
                    {m.body}
                    <div className="text-[10px] opacity-70 mt-1 text-right">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Composer */}
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
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) enviarImagem(file)
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
              <Button size="icon" onClick={enviar} disabled={enviando || !texto.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
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
              onSaved={carregarConversas}
            />
          )}
        </SheetContent>
      </Sheet>

      <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} businessId={current.id} />
    </div>
  )
}

function ContactDetails({
  conversation,
  businessId,
  onSaved,
}: {
  conversation: Conversation
  businessId: string
  onSaved: () => void
}) {
  const [nota, setNota] = React.useState(conversation.nota || "")
  const [salvando, setSalvando] = React.useState(false)

  async function salvar() {
    setSalvando(true)
    try {
      await api.setNota(businessId, conversation.phone, nota)
      onSaved()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{conversation.name || "Sem nome"}</p>
        <p className="text-sm text-muted-foreground">{conversation.phone}</p>
      </div>
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

function BroadcastDialog({
  open,
  onOpenChange,
  businessId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
}) {
  const [template, setTemplate] = React.useState("")
  const [idioma, setIdioma] = React.useState("pt_BR")
  const [contatos, setContatos] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<string | null>(null)

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
    if (!template || !contacts.length) {
      setResultado("Preencha o template e ao menos um contato.")
      return
    }
    setEnviando(true)
    setResultado(null)
    try {
      const { resultados } = await api.broadcast(businessId, { template, language: idioma, contacts })
      const ok = resultados.filter((r) => r.ok).length
      setResultado(`${ok} enviada(s) com sucesso. ${resultados.length - ok} falharam.`)
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Erro ao enviar")
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
            <label className="text-sm font-medium mb-1 block">Nome do template (aprovado na Meta)</label>
            <Input value={template} onChange={(e) => setTemplate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Idioma</label>
            <Input value={idioma} onChange={(e) => setIdioma(e.target.value)} />
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
          {resultado && <p className="text-sm">{resultado}</p>}
        </div>
        <DialogFooter>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
