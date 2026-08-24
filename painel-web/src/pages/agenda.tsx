import * as React from "react"
import { api, type AgendaItem, type ContaPublicar, type Rede } from "@/lib/api"
import { fileToBase64 } from "@/lib/file-to-base64"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Plus, Trash2, Send, RotateCcw } from "lucide-react"

const REDES_INFO: Record<Rede, string> = {
  instagram: "Instagram",
  instagram_story: "Instagram Stories",
  facebook: "Facebook",
  twitter: "X/Twitter",
  linkedin: "LinkedIn",
  threads: "Threads",
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  processing: "Publicando...",
  posted: "Publicado",
  error: "Erro",
}

const STATUS_VARIANT: Record<string, "default" | "warning" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  posted: "success",
  error: "destructive",
}

function chaveDia(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function AgendaPage() {
  const [fila, setFila] = React.useState<AgendaItem[]>([])
  const [recentes, setRecentes] = React.useState<AgendaItem[]>([])
  const [contas, setContas] = React.useState<ContaPublicar[]>([])
  const [contaFiltro, setContaFiltro] = React.useState("felizcred")
  const [mesAtual, setMesAtual] = React.useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [diaSelecionado, setDiaSelecionado] = React.useState<string | null>(null)
  const [criarOpen, setCriarOpen] = React.useState(false)

  const carregar = React.useCallback(() => {
    api.agendaFila().then(setFila).catch(() => {})
    api.agendaLista(contaFiltro).then((r) => {
      setRecentes(r.recentes)
    }).catch(() => {})
  }, [contaFiltro])

  React.useEffect(() => {
    carregar()
    api.contasPublicar().then(setContas).catch(() => {})
    const id = setInterval(carregar, 15000)
    return () => clearInterval(id)
  }, [carregar])

  const filaDaConta = React.useMemo(
    () => fila.filter((item) => item.conta_id === contaFiltro),
    [fila, contaFiltro],
  )
  const recentesDaConta = React.useMemo(
    () => recentes.filter((item) => item.conta_id === contaFiltro),
    [recentes, contaFiltro],
  )

  const itensPorDia = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of filaDaConta) {
      const chave = chaveDia(item.agendado_para)
      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(item)
    }
    return map
  }, [filaDaConta])

  const diasDoMes = React.useMemo(() => {
    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const primeiro = new Date(ano, mes, 1)
    const totalDias = new Date(ano, mes + 1, 0).getDate()
    const offset = primeiro.getDay()
    const celulas: (Date | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= totalDias; d++) celulas.push(new Date(ano, mes, d))
    return celulas
  }, [mesAtual])

  // "recentes" vem de /agenda/lista, que aplica um LIMIT global (todas as contas somadas)
  // — com muitos posts na fila, os pendentes de uma conta específica podem ficar de fora
  // desse recorte mesmo estando corretamente agendados. filaDaConta já é a lista completa
  // (sem limite) de pendentes só dessa conta, então é a fonte confiável pros pendentes;
  // "recentes" só complementa com publicados/com erro daquele dia (que não estão na fila).
  const itensDoDiaSelecionado = React.useMemo(() => {
    if (!diaSelecionado) return []
    const pendentes = filaDaConta.filter((i) => chaveDia(i.agendado_para) === diaSelecionado)
    const outros = recentesDaConta.filter(
      (i) => i.status !== "pending" && chaveDia(i.agendado_para) === diaSelecionado,
    )
    return [...pendentes, ...outros]
  }, [diaSelecionado, filaDaConta, recentesDaConta])

  const resumoFiltrado = React.useMemo(() => {
    const posted = recentesDaConta.filter((i) => i.status === "posted").length
    const error = recentesDaConta.filter((i) => i.status === "error").length
    return { pending: filaDaConta.length, posted, error, total: filaDaConta.length + posted + error }
  }, [filaDaConta, recentesDaConta])

  async function acaoPublicarAgora(id: number) {
    if (!confirm("Publicar esse post agora, fora da hora marcada?")) return
    try {
      await api.agendaPublicarAgora(id)
      carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao publicar")
    }
  }

  async function acaoRemover(id: number) {
    if (!confirm("Remover esse post da agenda?")) return
    await api.agendaRemover(id)
    carregar()
  }

  async function acaoReenfileirar(id: number) {
    await api.agendaReenfileirar(id)
    carregar()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="h-14 px-4 flex items-center justify-between border-b shrink-0">
          <div>
            <p className="font-semibold text-sm">Agenda</p>
            <p className="text-xs text-muted-foreground">
              {resumoFiltrado.pending} pendente(s) · {resumoFiltrado.posted} publicado(s) · {resumoFiltrado.error} com erro
            </p>
          </div>
          <Button size="sm" onClick={() => setCriarOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo post
          </Button>
        </div>

        {contas.length > 1 && (
          <div className="px-4 pt-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Conta</label>
            <select
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={contaFiltro}
              onChange={(e) => {
                setContaFiltro(e.target.value)
                setDiaSelecionado(null)
              }}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="p-4 max-w-xl">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium">
              {mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {diasDoMes.map((data, i) => {
              if (!data) return <div key={i} />
              const chave = chaveDia(data.getTime())
              const itens = itensPorDia.get(chave) || []
              const selecionado = diaSelecionado === chave
              return (
                <button
                  key={i}
                  onClick={() => setDiaSelecionado(selecionado ? null : chave)}
                  className={`aspect-square rounded-md text-xs flex flex-col items-center justify-center gap-0.5 hover:bg-secondary ${
                    selecionado ? "bg-secondary font-semibold" : ""
                  }`}
                >
                  <span>{data.getDate()}</span>
                  {itens.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              )
            })}
          </div>

          {diaSelecionado && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Posts do dia {diaSelecionado.split("-")[2]}
              </p>
              {itensDoDiaSelecionado.length === 0 && (
                <p className="text-xs text-muted-foreground">Nada agendado nesse dia.</p>
              )}
              <div className="flex flex-col gap-2">
                {itensDoDiaSelecionado.map((item) => (
                  <PostCard
                    key={item.id}
                    item={item}
                    onPublicarAgora={() => acaoPublicarAgora(item.id)}
                    onRemover={() => acaoRemover(item.id)}
                    onReenfileirar={() => acaoReenfileirar(item.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Histórico recente</p>
          <ScrollArea
            className="max-h-[420px]"
            style={{
              maskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
            }}
          >
            <div className="flex flex-col gap-2 pr-2 pb-6">
              {recentesDaConta.map((item) => (
                <PostCard
                  key={item.id}
                  item={item}
                  onPublicarAgora={() => acaoPublicarAgora(item.id)}
                  onRemover={() => acaoRemover(item.id)}
                  onReenfileirar={() => acaoReenfileirar(item.id)}
                />
              ))}
              {recentesDaConta.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum post ainda.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <CriarPostDialog open={criarOpen} onOpenChange={setCriarOpen} onCriado={carregar} contaPadrao={contaFiltro} />
    </div>
  )
}

function PostCard({
  item,
  onPublicarAgora,
  onRemover,
  onReenfileirar,
}: {
  item: AgendaItem
  onPublicarAgora: () => void
  onRemover: () => void
  onReenfileirar: () => void
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false)

  return (
    <div className="border rounded-md p-3 flex gap-3">
      {item.imagemUrl && (
        <img
          src={item.imagemUrl}
          alt=""
          className="h-14 w-14 rounded object-cover shrink-0 cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        />
      )}
      {!item.imagemUrl && item.videoUrl && (
        <video
          src={item.videoUrl}
          muted
          className="h-14 w-14 rounded object-cover shrink-0 cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        />
      )}
      {(item.imagemUrl || item.videoUrl) && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="sr-only">Preview do post</DialogTitle>
            </DialogHeader>
            {item.imagemUrl && <img src={item.imagemUrl} alt="" className="w-full rounded" />}
            {!item.imagemUrl && item.videoUrl && (
              <video src={item.videoUrl} controls autoPlay className="w-full rounded" />
            )}
          </DialogContent>
        </Dialog>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          <span className="text-xs text-muted-foreground">{formatDateTime(item.agendado_para)}</span>
          {item.redes.map((r) => (
            <Badge key={r} variant="outline" className="text-[10px]">
              {REDES_INFO[r] || r}
            </Badge>
          ))}
        </div>
        {item.texto && <p className="text-sm line-clamp-2">{item.texto}</p>}
        <div className="flex gap-1 mt-2">
          {item.status === "pending" && (
            <Button size="sm" variant="outline" onClick={onPublicarAgora}>
              <Send className="h-3 w-3 mr-1" /> Publicar agora
            </Button>
          )}
          {item.status === "error" && (
            <Button size="sm" variant="outline" onClick={onReenfileirar}>
              <RotateCcw className="h-3 w-3 mr-1" /> Reenfileirar
            </Button>
          )}
          {item.status !== "posted" && (
            <Button size="sm" variant="ghost" onClick={onRemover}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CriarPostDialog({
  open,
  onOpenChange,
  onCriado,
  contaPadrao,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriado: () => void
  contaPadrao?: string
}) {
  const [contas, setContas] = React.useState<ContaPublicar[]>([])
  const [contaId, setContaId] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [link, setLink] = React.useState("")
  const [redes, setRedes] = React.useState<Rede[]>([])
  const [data, setData] = React.useState("")
  const [imagens, setImagens] = React.useState<string[]>([])
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    api.contasPublicar().then((lista) => {
      setContas(lista)
      setContaId(contaPadrao && lista.some((c) => c.id === contaPadrao) ? contaPadrao : lista[0]?.id || "")
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contaPadrao])

  const conta = contas.find((c) => c.id === contaId)

  function toggleRede(r: Rede) {
    setRedes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  async function handleImagens(files: FileList | null) {
    if (!files || !files.length) return
    const base64s = await Promise.all(Array.from(files).map(fileToBase64))
    setImagens(base64s)
  }

  async function salvar() {
    setErro(null)
    if (!redes.length) {
      setErro("Marque ao menos uma rede.")
      return
    }
    if (!data) {
      setErro("Escolha data e hora.")
      return
    }
    if (!texto && !imagens.length) {
      setErro("Informe um texto ou uma imagem.")
      return
    }
    setEnviando(true)
    try {
      await api.agendaCriar({
        contaId,
        texto: texto || undefined,
        link: link || undefined,
        redes,
        data,
        imagemBase64: imagens.length === 1 ? imagens[0] : undefined,
        imagensBase64: imagens.length > 1 ? imagens : undefined,
      })
      onCriado()
      onOpenChange(false)
      setTexto("")
      setLink("")
      setRedes([])
      setData("")
      setImagens([])
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao agendar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo post agendado</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {contas.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-1 block">Conta</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={contaId}
                onChange={(e) => {
                  setContaId(e.target.value)
                  setRedes([])
                }}
              >
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Redes</label>
            <div className="flex flex-wrap gap-2">
              {(conta?.redesDisponiveis || []).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRede(r)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    redes.includes(r) ? "bg-primary text-primary-foreground border-primary" : "border-input"
                  }`}
                >
                  {REDES_INFO[r]}
                </button>
              ))}
              {conta && !conta.redesDisponiveis.length && (
                <p className="text-xs text-muted-foreground">Nenhuma rede configurada pra essa conta.</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Texto</label>
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Link (opcional)</label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Imagem (ou várias, vira carrossel)</label>
            <input type="file" accept="image/*" multiple onChange={(e) => handleImagens(e.target.files)} />
            {imagens.length > 0 && (
              <div className="flex gap-2 mt-2">
                {imagens.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-14 w-14 rounded object-cover" />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Data e hora</label>
            <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={enviando}>
            {enviando ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
