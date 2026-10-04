import * as React from "react"
import { KanbanBoard, type KanbanColumn, type KanbanTask } from "@/components/ui/kanban-board"
import { api, pipelineEstagiosPara, type Conversation, type Message, type Tag } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, X, Send, ExternalLink, FileText } from "lucide-react"

// Quadro kanban do pipeline — agrupa as conversas do canal atual por `pipeline_estagio`, usando
// o componente genérico de @/components/ui/kanban-board (drag por pointer events, com placeholder,
// spring physics e teclado). `tags_json` já vem pronto no GET /conversations (ver db.js), então
// as tags do cartão não pedem uma chamada extra por contato.
//
// "Prioridade" no cartão não é um campo novo no banco — é calculada: cliente esperando resposta
// (última mensagem foi dele) há mais de 2h vira "Prioridade", mais de 24h vira "Urgente". É o
// jeito de responder "quem eu preciso atender primeiro" olhando só o quadro, sem abrir cada
// conversa. "Progresso"/categoria do componente original não têm equivalente real aqui (não tem
// como errar: estágio perdido mostrando 100% de progresso passaria a ideia errada de "concluído
// com sucesso"), por isso ficam de fora — ver CLAUDE.md se quiser adicionar depois com dado real.
//
// O quadro é interativo: clicar num cartão (sem arrastar) abre um painel de resposta rápida ao
// lado, sem sair do Pipeline. Pra mídia, busca no histórico ou resposta pronta, "Ver conversa
// completa" ainda manda pra aba Conversas de verdade.

const AVATAR_CORES = ["#111214", "#2F6FED", "#7C5CFC", "#D9476B", "#15803D", "#B45309", "#0E7490"]

function corAvatar(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}

function iniciais(nome: string | null, phone: string) {
  const base = (nome || phone).trim()
  const partes = base.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function horaRelativa(ts: number | null) {
  if (!ts) return ""
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  return `${Math.round(diffH / 24)}d`
}

function formatHora(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function tagsDe(conversa: Conversation): Tag[] {
  if (!conversa.tags_json) return []
  try {
    return JSON.parse(conversa.tags_json)
  } catch {
    return []
  }
}

const SEM_ETAPA_COL = "__sem_etapa__"
const LIMIAR_PRIORIDADE_MIN = 120 // 2h esperando resposta
const LIMIAR_URGENTE_MIN = 24 * 60 // 24h esperando resposta

function conversaParaTask(conversa: Conversation): KanbanTask {
  const aguardandoResposta = conversa.last_direction === "in"
  const elapsedMin = conversa.last_message_at ? (Date.now() - conversa.last_message_at) / 60000 : null

  let priority: KanbanTask["priority"] | undefined
  if (aguardandoResposta && elapsedMin != null) {
    if (elapsedMin >= LIMIAR_URGENTE_MIN) priority = "urgent"
    else if (elapsedMin >= LIMIAR_PRIORIDADE_MIN) priority = "high"
  }

  return {
    id: conversa.phone,
    title: conversa.name || conversa.phone,
    note: conversa.last_body || undefined,
    priority,
    tags: tagsDe(conversa).map((t) => ({ id: t.id, nome: t.nome, cor: t.cor })),
    people: [{ name: conversa.name || conversa.phone, color: corAvatar(conversa.phone) }],
    due: horaRelativa(conversa.last_message_at),
    dueSoon: priority === "urgent" || priority === "high",
  }
}

function construirColunas(conversas: Conversation[], estagios: ReturnType<typeof pipelineEstagiosPara>): KanbanColumn[] {
  const semEtapa = conversas.filter((c) => !c.pipeline_estagio)
  return [
    { id: SEM_ETAPA_COL, name: "Sem etapa", dotColor: "#cbd5e1", tasks: semEtapa.map(conversaParaTask) },
    ...estagios.map((estagio) => ({
      id: estagio.id,
      name: estagio.nome,
      dotColor: estagio.cor,
      tasks: conversas.filter((c) => c.pipeline_estagio === estagio.id).map(conversaParaTask),
    })),
  ]
}

// Painel de resposta rápida — fica ao lado do quadro, sem navegar pra aba Conversas. Cobre o
// caso comum de "vi o card, preciso responder rapidinho" sem perder o contexto do funil. Pra
// mídia (áudio, anexo, resposta pronta, etc.) ou busca no histórico, o link "Ver conversa
// completa" ainda manda pra aba Conversas de verdade.
function PainelConversa({
  businessId,
  conversa,
  onClose,
  onAbrirCompleta,
}: {
  businessId: string
  conversa: Conversation
  onClose: () => void
  onAbrirCompleta: (phone: string) => void
}) {
  const [mensagens, setMensagens] = React.useState<Message[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [texto, setTexto] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const carregarMensagens = React.useCallback(() => {
    api
      .messages(businessId, conversa.phone)
      .then(setMensagens)
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [businessId, conversa.phone])

  React.useEffect(() => {
    setCarregando(true)
    carregarMensagens()
    const id = setInterval(carregarMensagens, 4000)
    return () => clearInterval(id)
  }, [carregarMensagens])

  React.useEffect(() => {
    api.marcarLida(businessId, conversa.phone).catch(() => {})
  }, [businessId, conversa.phone])

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [mensagens])

  async function enviar() {
    const valor = texto.trim()
    if (!valor || enviando) return
    setEnviando(true)
    try {
      await api.reply(businessId, conversa.phone, valor)
      setTexto("")
      carregarMensagens()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="w-[380px] shrink-0 border-l bg-background flex flex-col h-full">
      <div className="h-14 px-3 flex items-center gap-2 border-b shrink-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ background: corAvatar(conversa.phone) }}
        >
          {iniciais(conversa.name, conversa.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{conversa.name || "Sem nome"}</p>
          <p className="text-[11px] text-muted-foreground">{conversa.phone}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          title="Ver conversa completa"
          onClick={() => onAbrirCompleta(conversa.phone)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {carregando ? (
          <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>
        ) : mensagens.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {mensagens.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
                  m.direction === "out"
                    ? "bg-primary text-primary-foreground self-end"
                    : "bg-secondary text-secondary-foreground self-start"
                }`}
              >
                {m.type === "image" && m.media_path && (
                  <img src={m.media_path} alt="" className="rounded mb-1 max-w-[240px] max-h-[280px] w-auto h-auto object-contain" />
                )}
                {m.type === "audio" && m.media_path && (
                  <audio src={m.media_path} controls className="mb-1 max-w-[240px] w-full" />
                )}
                {m.type === "document" && m.media_path && (
                  <a
                    href={m.media_path}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 mb-1 rounded bg-black/10 px-2 py-1.5 hover:bg-black/20"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate underline min-w-0 flex-1">{m.body || "Documento"}</span>
                  </a>
                )}
                {(m.type !== "document" || !m.media_path) && m.body}
                <div className="text-[9px] opacity-70 mt-0.5 text-right">{formatHora(m.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2.5 border-t shrink-0 flex items-end gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Responder..."
          className="min-h-9 flex-1 resize-none text-sm"
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
  )
}

export function PipelinePage({ onAbrirConversa }: { onAbrirConversa: (phone: string) => void }) {
  const { current } = useChannel()
  const { setActiveConversation, markConversationSeen } = useUnread()
  const [conversas, setConversas] = React.useState<Conversation[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [selecionada, setSelecionada] = React.useState<Conversation | null>(null)

  const estagios = pipelineEstagiosPara(current?.label)

  const carregar = React.useCallback(() => {
    if (!current || current.id === "instagram") return
    setCarregando(true)
    api
      .conversations(current.id)
      .then(setConversas)
      .finally(() => setCarregando(false))
  }, [current])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  // Mesmo mecanismo do ChatsPage: enquanto o painel de resposta rápida está aberto, a conversa
  // conta como "sendo olhada agora" — não deve disparar som/notificação de mensagem nova.
  React.useEffect(() => {
    setActiveConversation(current?.id ?? null, selecionada?.phone ?? null)
    return () => setActiveConversation(null, null)
  }, [current, selecionada, setActiveConversation])

  React.useEffect(() => {
    if (!current || !selecionada) return
    markConversationSeen(current.id, selecionada.phone)
  }, [current, selecionada, markConversationSeen])

  // Troca de canal fecha o painel aberto — a conversa selecionada era de outro número.
  React.useEffect(() => {
    setSelecionada(null)
  }, [current?.id])

  // Referência estável enquanto `conversas`/`estagios` não mudam de verdade, senão o
  // KanbanBoard re-sincroniza o estado interno a cada render e desfaz um reordenar dentro da
  // mesma coluna que o usuário acabou de fazer (ver efeito de sync em kanban-board.tsx).
  const columns = React.useMemo(() => construirColunas(conversas, estagios), [conversas, estagios])

  function abrirPorId(phone: string) {
    const conversa = conversas.find((c) => c.phone === phone)
    if (conversa) setSelecionada(conversa)
  }

  // Otimista: acha o card cuja coluna nova diverge do estágio salvo, atualiza na hora, confirma
  // depois. Se o PATCH falhar, recarrega do servidor pra não deixar o quadro mentindo.
  function onBoardChange(next: KanbanColumn[]) {
    if (!current) return
    for (const col of next) {
      const estagioId = col.id === SEM_ETAPA_COL ? null : col.id
      for (const task of col.tasks) {
        const conversa = conversas.find((c) => c.phone === task.id)
        if (conversa && (conversa.pipeline_estagio ?? null) !== estagioId) {
          setConversas((prev) => prev.map((c) => (c.phone === task.id ? { ...c, pipeline_estagio: estagioId } : c)))
          api.setPipeline(current.id, task.id, estagioId).catch(() => carregar())
          return
        }
      }
    }
  }

  if (current?.id === "instagram") {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Pipeline é só pra conversas de WhatsApp — troca de canal na barra lateral.
      </div>
    )
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0">
        <div>
          <p className="font-semibold text-sm">Pipeline</p>
          <p className="text-xs text-muted-foreground">
            {current?.label} · {conversas.length} contato{conversas.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={carregar} disabled={carregando} className="gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex-1 min-w-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden p-4">
          <KanbanBoard columns={columns} onChange={onBoardChange} onTaskClick={abrirPorId} label="Pipeline" />
        </div>

        {selecionada && current && (
          <PainelConversa
            businessId={current.id}
            conversa={selecionada}
            onClose={() => setSelecionada(null)}
            onAbrirCompleta={onAbrirConversa}
          />
        )}
      </div>
    </div>
  )
}
