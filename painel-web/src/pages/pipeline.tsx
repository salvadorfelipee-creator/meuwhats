import * as React from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { api, pipelineEstagiosPara, type Conversation, type Tag } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"
import { Button } from "@/components/ui/button"
import { RefreshCw, MessageCircle } from "lucide-react"

// Quadro kanban do pipeline — agrupa as conversas do canal atual por `pipeline_estagio`.
// Drag de verdade via @dnd-kit (acessível, com overlay flutuante) em vez do HTML5 DnD nativo
// da primeira versão. Não cria campo novo: `tags_json` já vem pronto no GET /conversations
// (ver db.js), então as tags do cartão não pedem uma chamada extra por contato.

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

function tagsDe(conversa: Conversation): Tag[] {
  if (!conversa.tags_json) return []
  try {
    return JSON.parse(conversa.tags_json)
  } catch {
    return []
  }
}

function CartaoConteudo({ conversa }: { conversa: Conversation }) {
  const tags = tagsDe(conversa)
  return (
    <>
      <div className="flex items-center gap-2">
        <div
          className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
          style={{ background: corAvatar(conversa.phone) }}
        >
          {iniciais(conversa.name, conversa.phone)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{conversa.name || conversa.phone}</div>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{horaRelativa(conversa.last_message_at)}</span>
      </div>
      {conversa.last_body && (
        <div className="text-xs text-muted-foreground line-clamp-2">{conversa.last_body}</div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: `${t.cor}1a`, color: t.cor }}
            >
              {t.nome}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function Cartao({ conversa, onAbrir }: { conversa: Conversation; onAbrir: (phone: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: conversa.phone })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAbrir(conversa.phone)}
      className={`rounded-xl border bg-card p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:border-foreground/30 hover:shadow-sm transition-[border-color,box-shadow,opacity] group ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <CartaoConteudo conversa={conversa} />
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <MessageCircle className="h-3 w-3" /> Abrir conversa
      </div>
    </div>
  )
}

function Coluna({
  id,
  nome,
  cor,
  conversas,
  onAbrir,
}: {
  id: string
  nome: string
  cor: string
  conversas: Conversation[]
  onAbrir: (phone: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div className="w-64 shrink-0 flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cor }} />
        <span className="text-xs font-semibold">{nome}</span>
        <span className="text-[11px] text-muted-foreground">{conversas.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-24 flex flex-col gap-2 rounded-xl p-1.5 transition-colors ${
          isOver ? "bg-secondary/60 ring-2 ring-foreground/15" : ""
        }`}
      >
        {conversas.map((c) => (
          <Cartao key={c.phone} conversa={c} onAbrir={onAbrir} />
        ))}
        {conversas.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-6 border border-dashed rounded-xl">
            Arraste um contato aqui
          </div>
        )}
      </div>
    </div>
  )
}

export function PipelinePage({ onAbrirConversa }: { onAbrirConversa: (phone: string) => void }) {
  const { current } = useChannel()
  const [conversas, setConversas] = React.useState<Conversation[]>([])
  const [carregando, setCarregando] = React.useState(true)
  const [arrastando, setArrastando] = React.useState<Conversation | null>(null)

  const estagios = pipelineEstagiosPara(current?.label)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  function onDragStart(e: DragStartEvent) {
    setArrastando(conversas.find((c) => c.phone === e.active.id) || null)
  }

  // Otimista: move o card na hora, confirma depois. Se o PATCH falhar, recarrega do servidor
  // pra não deixar o quadro mentindo sobre o estado real.
  function onDragEnd(e: DragEndEvent) {
    setArrastando(null)
    const phone = e.active.id as string
    const destino = e.over?.id as string | undefined
    if (!current || destino === undefined) return
    const estagioId = destino === "__sem_etapa__" ? null : destino
    setConversas((prev) => prev.map((c) => (c.phone === phone ? { ...c, pipeline_estagio: estagioId } : c)))
    api.setPipeline(current.id, phone, estagioId).catch(() => carregar())
  }

  if (current?.id === "instagram") {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Pipeline é só pra conversas de WhatsApp — troca de canal na barra lateral.
      </div>
    )
  }

  const semEtapa = conversas.filter((c) => !c.pipeline_estagio)

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

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="h-full flex gap-4 p-4 min-w-max">
            <Coluna
              id="__sem_etapa__"
              nome="Sem etapa"
              cor="#cbd5e1"
              conversas={semEtapa}
              onAbrir={onAbrirConversa}
            />
            {estagios.map((estagio) => (
              <Coluna
                key={estagio.id}
                id={estagio.id}
                nome={estagio.nome}
                cor={estagio.cor}
                conversas={conversas.filter((c) => c.pipeline_estagio === estagio.id)}
                onAbrir={onAbrirConversa}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {arrastando && (
            <div className="w-64 rounded-xl border bg-card p-3 flex flex-col gap-2 shadow-lg rotate-2">
              <CartaoConteudo conversa={arrastando} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
