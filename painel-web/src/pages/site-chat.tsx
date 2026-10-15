import * as React from "react"
import { ArrowLeft, AtSign, Bell, BellOff, Check, ChevronDown, FileText, Globe2, MessageCircle, Mic, Paperclip, Phone, RotateCcw, Search, Send, Smile, UserRound, X } from "lucide-react"
import { api, type SiteChatConversation, type SiteChatMessage } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SidebarTrigger } from "@/components/blocks/sidebar"
import { useUnread } from "@/lib/unread-context"
import { COMPANY_LABELS, useChannel } from "@/lib/channel-context"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function hora(ms: number) {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
function dataLista(ms: number) {
  const d = new Date(ms)
  return d.toDateString() === new Date().toDateString() ? hora(ms) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}
function arquivoParaBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function SiteChatPage({ embedded = false }: { embedded?: boolean }) {
  const { channels, current, setCurrent } = useChannel()
  const { notifPermission, requestNotifPermission, unreadConversations, markConversationSeen, setActiveConversation, alvoAbrir, limparAlvoAbrir } = useUnread()
  const [conversas, setConversas] = React.useState<SiteChatConversation[]>([])
  const [selecionada, setSelecionada] = React.useState<SiteChatConversation | null>(null)
  const [mensagens, setMensagens] = React.useState<SiteChatMessage[]>([])
  const [busca, setBusca] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [carregando, setCarregando] = React.useState(true)
  const [emojiOpen, setEmojiOpen] = React.useState(false)
  const [gravando, setGravando] = React.useState(false)
  const [segundos, setSegundos] = React.useState(0)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const fimRef = React.useRef<HTMLDivElement>(null)

  const carregarLista = React.useCallback(async () => {
    try { setConversas(await api.siteChatConversas()) } finally { setCarregando(false) }
  }, [])
  const carregarConversa = React.useCallback(async (id: string, silencioso = false) => {
    try {
      const dados = await api.siteChatConversa(id)
      setSelecionada(dados.conversation)
      setMensagens(dados.messages)
      markConversationSeen("site", id)
      setConversas((prev) => prev.map((c) => c.id === id ? { ...c, ...dados.conversation, unread: false } : c))
    } catch { if (!silencioso) setSelecionada(null) }
  }, [markConversationSeen])

  React.useEffect(() => {
    carregarLista()
    const id = window.setInterval(() => { if (!document.hidden) carregarLista() }, 5000)
    return () => window.clearInterval(id)
  }, [carregarLista])
  const selecionadaId = selecionada?.id
  React.useEffect(() => {
    if (!selecionadaId) return
    setActiveConversation("site", selecionadaId)
    const id = window.setInterval(() => { if (!document.hidden) carregarConversa(selecionadaId, true) }, 3000)
    return () => { window.clearInterval(id); setActiveConversation(null, null) }
  }, [selecionadaId, carregarConversa, setActiveConversation])
  React.useEffect(() => {
    if (alvoAbrir?.channelId !== "site") return
    carregarConversa(alvoAbrir.phone)
    limparAlvoAbrir()
  }, [alvoAbrir, carregarConversa, limparAlvoAbrir])
  React.useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }) }, [mensagens.length])
  React.useEffect(() => {
    if (!gravando) return
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [gravando])
  React.useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  const filtradas = conversas.filter((c) => {
    const q = busca.trim().toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.contact || "").toLowerCase().includes(q)
  })

  async function enviar(payload?: Parameters<typeof api.siteChatResponder>[1]) {
    if (!selecionada || enviando) return
    const conteudo = payload || texto.trim()
    if (!conteudo) return
    setEnviando(true)
    try {
      await api.siteChatResponder(selecionada.id, conteudo)
      if (!payload) setTexto("")
      await Promise.all([carregarConversa(selecionada.id, true), carregarLista()])
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível enviar.")
    } finally { setEnviando(false) }
  }
  async function enviarArquivo(file: File) {
    if (file.size > 15 * 1024 * 1024) return alert("O arquivo deve ter no máximo 15 MB.")
    const base64 = await arquivoParaBase64(file)
    const chave = file.type.startsWith("image/") ? "imagemBase64" : file.type.startsWith("video/") ? "videoBase64" : file.type.startsWith("audio/") ? "audioBase64" : "documentBase64"
    await enviar({ message: texto.trim(), [chave]: base64, fileName: file.name })
    setTexto("")
  }
  async function iniciarAudio() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      recorder.start()
      setSegundos(0)
      setGravando(true)
    } catch { alert("Autorize o uso do microfone para gravar áudio.") }
  }
  function finalizarAudio(enviarGravacao: boolean) {
    const recorder = recorderRef.current
    if (!recorder) return
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setGravando(false); setSegundos(0)
      if (enviarGravacao) await enviarArquivo(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type }))
    }
    recorder.stop()
  }
  async function alterarStatus() {
    if (!selecionada) return
    await api.siteChatStatus(selecionada.id, selecionada.status === "open" ? "closed" : "open")
    await Promise.all([carregarConversa(selecionada.id), carregarLista()])
  }

  return (
    <div className={cn("flex h-screen w-full min-w-0 overflow-hidden bg-background", embedded && "absolute inset-0", !embedded && "p-0")}>
      <aside className={cn("w-full shrink-0 border-r md:flex md:w-[340px] md:flex-col", selecionada ? "hidden" : "flex flex-col")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
          <div className="flex items-center gap-1"><SidebarTrigger /><DropdownMenu><DropdownMenuTrigger asChild><button className="flex items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-accent"><div><p className="text-sm font-semibold">Conversas</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Globe2 className="h-3 w-3" /> Site FelizCred</p></div><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-64">{(["felizcred","cotacerta","ciahot"] as const).map((company, index) => { const items=channels.filter((c)=>c.company===company); if(!items.length)return null; return <React.Fragment key={company}>{index>0&&<DropdownMenuSeparator/>}<DropdownMenuLabel>{COMPANY_LABELS[company]}</DropdownMenuLabel>{items.map((c)=><DropdownMenuItem key={c.id} onClick={()=>setCurrent(c)} className="gap-2">{c.kind==="site"?<Globe2 className="h-4 w-4"/>:c.kind==="instagram"?<AtSign className="h-4 w-4"/>:<Phone className="h-4 w-4"/>}<span className="flex-1">{c.label}</span>{current?.id===c.id&&<Check className="h-3.5 w-3.5"/>}</DropdownMenuItem>)}</React.Fragment>})}</DropdownMenuContent></DropdownMenu></div>
          <div className="flex items-center gap-1">
            {notifPermission !== "unsupported" && <Button variant="ghost" size="icon" onClick={requestNotifPermission} disabled={notifPermission === "granted"} title={notifPermission === "granted" ? "Notificações ativadas" : "Ativar notificações"}>{notifPermission === "granted" ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}</Button>}
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">{conversas.filter((c) => c.status === "open").length} abertas</span>
          </div>
        </div>
        <div className="border-b p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa" className="pl-9" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {carregando && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando conversas...</p>}
          {!carregando && !filtradas.length && <div className="px-5 py-16 text-center"><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/45" /><p className="mt-3 text-sm font-medium">Nenhuma conversa ainda</p></div>}
          {filtradas.map((c) => {
            const naoLida = unreadConversations.has(`site|${c.id}`) || Boolean(c.unread)
            return <button type="button" key={c.id} onClick={() => carregarConversa(c.id)} className={cn("flex w-full gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted/70", selecionada?.id === c.id && "bg-muted")}>
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><UserRound className="h-4 w-4" />{naoLida && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={cn("truncate text-sm", naoLida ? "font-semibold" : "font-medium")}>{c.name}</span><span className="ml-auto text-[11px] text-muted-foreground">{dataLista(c.updated_at)}</span></span><span className="mt-1 block truncate text-xs text-muted-foreground">{c.last_message || (c.produto_tag ? `Interesse: ${c.produto_tag}` : "Conversa iniciada")}</span></span>
            </button>
          })}
        </div>
      </aside>
      <main className={cn("min-w-0 flex-1 flex-col", selecionada ? "flex" : "hidden md:flex")}>
        {!selecionada ? <div className="flex flex-1 items-center justify-center text-center"><div><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm">Selecione uma conversa</p></div></div> : <>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4"><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelecionada(null)}><ArrowLeft className="h-4 w-4" /></Button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700"><UserRound className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{selecionada.name}</p><p className="truncate text-xs text-muted-foreground">{selecionada.contact}{selecionada.produto_tag ? ` · ${selecionada.produto_tag}` : ""}</p></div><Button variant="outline" size="sm" className="gap-1.5" onClick={alterarStatus}>{selecionada.status === "open" ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}{selecionada.status === "open" ? "Encerrar" : "Reabrir"}</Button></header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5"><div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="mb-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground"><Globe2 className="h-3.5 w-3.5" /> Conversa iniciada em {new Date(selecionada.created_at).toLocaleString("pt-BR")}</div>
            {mensagens.map((m) => <div key={m.id} className={cn("flex", m.direction === "agent" ? "justify-end" : "justify-start")}><div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm", m.direction === "agent" ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md border bg-background")}>
              {m.type === "image" && m.media_url && <img src={m.media_url} alt={m.file_name || "Imagem"} className="mb-2 max-h-72 rounded-lg object-contain" />}
              {m.type === "video" && m.media_url && <video src={m.media_url} controls className="mb-2 max-h-72 rounded-lg" />}
              {m.type === "audio" && m.media_url && <audio src={m.media_url} controls className="mb-2 max-w-full" />}
              {m.type === "document" && m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 underline"><FileText className="h-4 w-4" />{m.file_name || "Abrir arquivo"}</a>}
              {m.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>}<p className={cn("mt-1 text-right text-[10px]", m.direction === "agent" ? "text-white/70" : "text-muted-foreground")}>{m.direction === "agent" && m.sender_name ? `${m.sender_name} · ` : ""}{hora(m.created_at)}</p>
            </div></div>)}<div ref={fimRef} />
          </div></div>
          {gravando ? <div className="flex h-16 shrink-0 items-center gap-3 border-t px-4"><Button variant="ghost" size="icon" onClick={() => finalizarAudio(false)}><X className="h-4 w-4" /></Button><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /><span className="flex-1 text-sm tabular-nums">{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}</span><Button size="icon" onClick={() => finalizarAudio(true)}><Send className="h-4 w-4" /></Button></div> :
          <div className="shrink-0 border-t bg-background p-2"><div className="relative mx-auto flex max-w-3xl items-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEmojiOpen((v) => !v)} title="Emoji"><Smile className="h-4 w-4" /></Button>
            {emojiOpen && <div className="absolute bottom-12 left-0 z-20 flex gap-2 rounded-xl border bg-background p-2 shadow-lg">{["😊","👍","❤️","😂","🙏","✅"].map((e) => <button key={e} className="text-xl" onClick={() => { setTexto((t) => t + e); setEmojiOpen(false) }}>{e}</button>)}</div>}
            <label><input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const f=e.target.files?.[0]; if(f) enviarArquivo(f); e.target.value="" }} /><Button variant="ghost" size="icon" asChild><span><Paperclip className="h-4 w-4" /></span></Button></label>
            <Button variant="ghost" size="icon" onClick={iniciarAudio} title="Gravar áudio"><Mic className="h-4 w-4" /></Button>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey){e.preventDefault(); enviar()} }} placeholder={selecionada.status === "closed" ? "Reabra a conversa para responder" : "Digite uma mensagem"} disabled={selecionada.status === "closed"} rows={1} className="min-h-10 flex-1 resize-none" />
            <Button size="icon" onClick={() => enviar()} disabled={!texto.trim() || enviando || selecionada.status === "closed"}><Send className="h-4 w-4" /></Button>
          </div></div>}
        </>}
      </main>
    </div>
  )
}
