import * as React from "react"
import { useChannel } from "@/lib/channel-context"
import { api, type AnalyticsResumo, type Tag, PIPELINE_ESTAGIOS, CANAL_ANALYTICS_LABEL } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MessagesSquare, UserPlus, CheckCircle2, Timer, Tag as TagIcon, Trash2, Plus } from "lucide-react"

const PERIODOS = [7, 30, 90] as const

const CORES_TAG = ["#64748b", "#2563eb", "#7c3aed", "#d97706", "#16a34a", "#dc2626", "#0891b2", "#db2777"]

const PIPELINE_ESTAGIOS_MAP: Record<string, { nome: string; cor: string }> = Object.fromEntries(
  PIPELINE_ESTAGIOS.map((e) => [e.id, e]),
)

function formatMs(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—"
  const min = Math.round(ms / 60000)
  if (min < 1) return "< 1 min"
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const restoMin = min % 60
  if (h < 24) return restoMin ? `${h}h ${restoMin}min` : `${h}h`
  const dias = Math.floor(h / 24)
  return `${dias} dia${dias > 1 ? "s" : ""}`
}

function formatPercent(v: number | null): string {
  if (v === null) return "—"
  return `${Math.round(v * 100)}%`
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex-1 min-w-[220px] rounded-xl border p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-3xl font-semibold tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

// Barra horizontal simples (mesmo padrão visual do FunilPage) — usada nos 3 painéis de
// distribuição (status/tag/estágio). Sem biblioteca de gráfico nova, só SVG/CSS.
function BarraDistribuicao({ itens }: { itens: { label: string; total: number; cor?: string }[] }) {
  const max = Math.max(...itens.map((i) => i.total), 1)
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
  }
  return (
    <div className="flex flex-col gap-2.5">
      {itens.map((item) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm truncate">{item.label}</span>
            <span className="text-sm font-medium tabular-nums">{item.total}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max((item.total / max) * 100, item.total > 0 ? 4 : 0)}%`,
                background: item.cor || "var(--primary)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Gráfico de área — uma série só (volume de conversas por dia), sem biblioteca: um hue só
// (var(--primary), a cor neutra do tema) do escuro no topo até transparente embaixo, linha
// fina, ponta arredondada, com tooltip ao passar o mouse (crosshair). Ver skill dataviz.
function GraficoArea({ dados }: { dados: { dia: string; conversas: number }[] }) {
  const [hover, setHover] = React.useState<number | null>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)

  const W = 1000
  const H = 260
  const PAD_L = 8
  const PAD_R = 8
  const PAD_T = 16
  const PAD_B = 28

  if (dados.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
        Sem conversas nesse período ainda.
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.conversas), 1)
  const n = dados.length
  const stepX = n > 1 ? (W - PAD_L - PAD_R) / (n - 1) : 0
  const x = (i: number) => PAD_L + i * stepX
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B)

  const linePath = dados.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.conversas)}`).join(" ")
  const areaPath = `${linePath} L ${x(n - 1)} ${H - PAD_B} L ${x(0)} ${H - PAD_B} Z`

  // Mostra só algumas datas no eixo X pra não amontoar (a cada ~7 pontos, sempre incluindo a
  // primeira e a última).
  const ticks = dados.filter((_, i) => i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0)

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const idx = stepX > 0 ? Math.round((relX - PAD_L) / stepX) : 0
    setHover(Math.min(Math.max(idx, 0), n - 1))
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[260px]"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={H - PAD_B} stroke="var(--border)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(dados[hover].conversas)} r="4" fill="var(--primary)" />
          </>
        )}
        {ticks.map((d, i) => {
          const idx = dados.indexOf(d)
          return (
            <text
              key={i}
              x={x(idx)}
              y={H - 8}
              fontSize="11"
              fill="var(--muted-foreground)"
              textAnchor={idx === 0 ? "start" : idx === n - 1 ? "end" : "middle"}
            >
              {d.dia.slice(5).replace("-", "/")}
            </text>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="absolute top-2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md pointer-events-none"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="font-medium">{dados[hover].dia.slice(5).replace("-", "/")}</p>
          <p className="text-muted-foreground">{dados[hover].conversas} conversa(s)</p>
        </div>
      )}
    </div>
  )
}

export function GerenciarTags({ businessId, tags, onChange }: { businessId: string; tags: Tag[]; onChange: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [nome, setNome] = React.useState("")
  const [cor, setCor] = React.useState(CORES_TAG[0])
  const [salvando, setSalvando] = React.useState(false)

  async function criar() {
    if (!nome.trim()) return
    setSalvando(true)
    try {
      await api.criarTag(businessId, nome.trim(), cor)
      setNome("")
      onChange()
    } finally {
      setSalvando(false)
    }
  }

  async function apagar(id: number) {
    await api.apagarTag(businessId, id)
    onChange()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TagIcon className="h-3.5 w-3.5" />
          Gerenciar tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags de atendimento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>}
            {tags.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.cor }} />
                  {t.nome}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => apagar(t.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t pt-4">
            <label className="text-sm font-medium">Nova tag</label>
            <Input
              placeholder="Nome da tag"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criar()}
            />
            <div className="flex items-center gap-1.5">
              {CORES_TAG.map((c) => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${cor === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={criar} disabled={salvando || !nome.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Criar tag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AnalyticsPage() {
  const { channels } = useChannel()
  const canal = channels.find((c) => c.label === CANAL_ANALYTICS_LABEL)
  const [dias, setDias] = React.useState<(typeof PERIODOS)[number]>(30)
  const [dados, setDados] = React.useState<AnalyticsResumo | null>(null)
  const [tags, setTags] = React.useState<Tag[]>([])

  const carregar = React.useCallback(() => {
    if (!canal) return
    api.analytics(canal.id, dias).then(setDados).catch(() => {})
    api.tags(canal.id).then(setTags).catch(() => {})
  }, [canal, dias])

  React.useEffect(() => {
    carregar()
  }, [carregar])

  if (!canal) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
        Não encontrei o canal "{CANAL_ANALYTICS_LABEL}" na lista de números configurados.
      </div>
    )
  }

  const porStatusFmt = (dados?.porStatus || []).map((s) => ({
    label: { novo: "Novo", andamento: "Em andamento", resolvido: "Finalizada" }[s.status] || s.status,
    total: s.total,
  }))
  const porTagFmt = (dados?.porTag || []).map((t) => ({ label: t.nome, total: t.total, cor: t.cor }))
  const porEstagioFmt = (dados?.porEstagio || []).map((e) => {
    const meta = PIPELINE_ESTAGIOS_MAP[e.estagio]
    return { label: meta?.nome || e.estagio, total: e.total, cor: meta?.cor }
  })

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0 sticky top-0 bg-background z-10">
        <div>
          <p className="font-semibold text-sm">Analytics</p>
          <p className="text-xs text-muted-foreground">{CANAL_ANALYTICS_LABEL}</p>
        </div>
        <div className="flex items-center gap-2">
          <GerenciarTags businessId={canal.id} tags={tags} onChange={carregar} />
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <Button key={p} size="sm" variant={dias === p ? "default" : "outline"} onClick={() => setDias(p)}>
                {p} dias
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-6xl">
        <div className="flex flex-wrap gap-4">
          <StatCard
            icon={MessagesSquare}
            label="Conversas atendidas"
            value={dados ? String(dados.totalConversas) : "—"}
            sub={`Nos últimos ${dias} dias`}
          />
          <StatCard
            icon={UserPlus}
            label="Novas conversas"
            value={dados ? String(dados.novasConversas) : "—"}
            sub="Primeiro contato no período"
          />
          <StatCard
            icon={CheckCircle2}
            label="Taxa de resolução"
            value={dados ? formatPercent(dados.taxaResolucao) : "—"}
            sub={dados ? `${dados.conversasResolvidas} finalizada(s)` : undefined}
          />
          <StatCard
            icon={Timer}
            label="Tempo até resposta humana"
            value={dados ? formatMs(dados.tempoMedioRespostaHumanaMs) : "—"}
            sub={
              dados && dados.amostrasRespostaHumana > 0
                ? `Média de ${dados.amostrasRespostaHumana} conversa(s)`
                : "Sem amostra suficiente ainda"
            }
          />
        </div>

        <div className="rounded-xl border p-5">
          <p className="font-medium mb-1">Conversas por dia</p>
          <p className="text-xs text-muted-foreground mb-2">Últimos {dias} dias</p>
          <GraficoArea dados={(dados?.porDia || []).map((d) => ({ dia: d.dia, conversas: d.conversas }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5">
            <p className="font-medium mb-3">Por status</p>
            <BarraDistribuicao itens={porStatusFmt} />
          </div>
          <div className="rounded-xl border p-5">
            <p className="font-medium mb-3">Por tag</p>
            <BarraDistribuicao itens={porTagFmt} />
          </div>
          <div className="rounded-xl border p-5">
            <p className="font-medium mb-3">Por etapa do pipeline</p>
            <BarraDistribuicao itens={porEstagioFmt} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground pb-6">
          Tempo de resolução médio no período: {dados ? formatMs(dados.tempoMedioResolucaoMs) : "—"}
          {dados && dados.amostrasResolucao > 0 ? ` (${dados.amostrasResolucao} conversa(s))` : ""}.
          Duas métricas comuns em ferramentas como a Octadesk ainda não dá pra medir aqui:{" "}
          <b>satisfação do cliente (CSAT)</b> — precisaria de uma pergunta de avaliação no fim do
          atendimento, que não existe hoje — e <b>produtividade por atendente</b> — precisaria de
          login individual por pessoa (hoje o painel usa um usuário só, compartilhado).
        </p>
      </div>
    </div>
  )
}
