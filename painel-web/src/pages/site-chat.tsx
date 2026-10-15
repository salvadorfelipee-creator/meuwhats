import * as React from "react"
import { ArrowLeft, Check, Globe2, MessageCircle, RotateCcw, Search, Send, UserRound } from "lucide-react"
import { api, type SiteChatConversation, type SiteChatMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function hora(ms: number) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function dataLista(ms: number) {
  const d = new Date(ms)
  const hoje = new Date()
  if (d.toDateString() === hoje.toDateString()) return hora(ms)
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export function SiteChatPage() {
  const [conversas, setConversas] = React.useState<SiteChatConversation[]>([])
  const [selecionada, setSelecionada] = React.useState<SiteChatConversation | null>(null)
  const [mensagens, setMensagens] = React.useState<SiteChatMessage[]>([])
  const [busca, setBusca] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [carregando, setCarregando] = React.useState(true)
  const fimRef = React.useRef<HTMLDivElement>(null)

  const carregarLista = React.useCallback(async () => {
    try {
      setConversas(await api.siteChatConversas())
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarConversa = React.useCallback(async (id: string, silencioso = false) => {
    try {
      const dados = await api.siteChatConversa(id)
      setSelecionada(dados.conversation)
      setMensagens(dados.messages)
      if (!silencioso) setConversas((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)))
    } catch {
      if (!silencioso) setSelecionada(null)
    }
  }, [])

  React.useEffect(() => {
    carregarLista()
    const id = window.setInterval(() => {
      if (!document.hidden) carregarLista()
    }, 5000)
    return () => window.clearInterval(id)
  }, [carregarLista])

  React.useEffect(() => {
    if (!selecionada) return
    const id = window.setInterval(() => {
      if (!document.hidden) carregarConversa(selecionada.id, true)
    }, 3000)
    return () => window.clearInterval(id)
  }, [selecionada?.id, carregarConversa])

  React.useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens.length])

  const filtradas = conversas.filter((c) => {
    const q = busca.trim().toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.contact || "").toLowerCase().includes(q)
  })

  async function enviar() {
    const message = texto.trim()
    if (!selecionada || !message || enviando) return
    setEnviando(true)
    setTexto("")
    try {
      await api.siteChatResponder(selecionada.id, message)
      await Promise.all([carregarConversa(selecionada.id, true), carregarLista()])
    } catch {
      setTexto(message)
    } finally {
      setEnviando(false)
    }
  }

  async function alterarStatus() {
    if (!selecionada) return
    const status = selecionada.status === "open" ? "closed" : "open"
    await api.siteChatStatus(selecionada.id, status)
    await Promise.all([carregarConversa(selecionada.id), carregarLista()])
  }

  return (
    <div className="h-screen min-h-0 bg-muted/25 p-2 sm:p-3">
      <div className="mx-auto flex h-full max-w-[1500px] overflow-hidden rounded-2xl border bg-background shadow-sm">
        <aside className={cn("w-full shrink-0 border-r md:flex md:w-[340px] md:flex-col", selecionada ? "hidden" : "flex flex-col")}>
          <div className="border-b px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold tracking-tight">Chat do site</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Atendimento direto da FelizCred</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {conversas.filter((c) => c.status === "open").length} abertas
              </span>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou contato" className="pl-9" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {carregando && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando conversas...</p>}
            {!carregando && filtradas.length === 0 && (
              <div className="px-5 py-16 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/45" />
                <p className="mt-3 text-sm font-medium">Nenhuma conversa ainda</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">As mensagens enviadas pelo site aparecerão aqui.</p>
              </div>
            )}
            {filtradas.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => carregarConversa(c.id)}
                className="group flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/70"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <UserRound className="h-4 w-4" />
                  {!!c.unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{dataLista(c.updated_at)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{c.last_message || "Conversa iniciada"}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className={cn("min-w-0 flex-1 flex-col", selecionada ? "flex" : "hidden md:flex")}>
          {!selecionada ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-medium">Escolha uma conversa</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Leia o histórico e responda quem está falando pelo site.</p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex min-h-16 items-center gap-3 border-b px-3 sm:px-5">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelecionada(null)} aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selecionada.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{selecionada.contact || "Sem contato informado"}</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={alterarStatus}>
                  {selecionada.status === "open" ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{selecionada.status === "open" ? "Encerrar" : "Reabrir"}</span>
                </Button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-3 py-5 sm:px-8">
                <div className="mx-auto flex max-w-3xl flex-col gap-3">
                  <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                    <Globe2 className="h-3.5 w-3.5" />
                    Conversa iniciada em {new Date(selecionada.created_at).toLocaleString("pt-BR")}
                  </div>
                  {mensagens.map((m) => (
                    <div key={m.id} className={cn("flex", m.direction === "agent" ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[70%]",
                          m.direction === "agent"
                            ? "rounded-br-md bg-emerald-600 text-white"
                            : "rounded-bl-md border bg-background text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                        <p className={cn("mt-1 text-right text-[10px]", m.direction === "agent" ? "text-white/70" : "text-muted-foreground")}>
                          {m.direction === "agent" && m.sender_name ? `${m.sender_name} · ` : ""}{hora(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={fimRef} />
                </div>
              </div>

              <div className="border-t bg-background p-3 sm:p-4">
                <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-muted/25 p-2 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10">
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        enviar()
                      }
                    }}
                    placeholder={selecionada.status === "closed" ? "Reabra a conversa para responder" : "Escreva uma resposta..."}
                    disabled={selecionada.status === "closed"}
                    rows={1}
                    className="max-h-32 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Button size="icon" onClick={enviar} disabled={!texto.trim() || enviando || selecionada.status === "closed"} className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mx-auto mt-1.5 max-w-3xl px-1 text-[10px] text-muted-foreground">Enter envia · Shift + Enter quebra a linha</p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
