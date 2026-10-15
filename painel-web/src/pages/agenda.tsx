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
} from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Trash2, Send, RotateCcw, CalendarClock } from "lucide-react"
import { CampanhaWhatsAppWizard } from "@/pages/campanha-whatsapp-wizard"

// Agenda e Publicar viram uma tela só (paridade com o painel de referência da Especitá):
// um formulário único (painel fixo à direita) que publica agora OU agenda, em vez de 2 telas
// quase idênticas. O nome no menu continua "Agenda" — "Publicar" só sai da barra lateral, a
// rota em App.tsx continua existindo (publicar.tsx não foi apagado, só não tem mais entrada
// no menu — mesma decisão tomada na referência).
//
// "Campanhas WhatsApp" (toggle no topo) abre o CampanhaWhatsAppWizard (segmentação por
// etapa/etiqueta/aniversário + mensagem + revisão), que por baixo chama o mesmo broadcast de
// sempre.

const REDES_INFO: Record<Rede, string> = {
  instagram: "Instagram",
  instagram_story: "Instagram Stories",
  facebook: "Facebook",
  twitter: "X/Twitter",
  linkedin: "LinkedIn",
  threads: "Threads",
}

function nomeRede(r: string): string {
  return REDES_INFO[r as Rede] || r.charAt(0).toUpperCase() + r.slice(1)
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

// Cor do chip dentro da célula do dia — erro sempre vermelho (chama atenção), senão por rede.
function corChipDia(item: AgendaItem): { bg: string; fg: string } {
  if (item.status === "error") return { bg: "#FBE4E4", fg: "#B23A3A" }
  if (item.redes.includes("instagram_story")) return { bg: "#FBE6F1", fg: "#C13584" }
  if (item.redes.includes("facebook")) return { bg: "#E3ECFA", fg: "#2563EB" }
  return { bg: "#E3F3EF", fg: "#0A5F53" }
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
  const [somenteErros, setSomenteErros] = React.useState(false)
  const [campanhaOpen, setCampanhaOpen] = React.useState(false)

  const carregar = React.useCallback(() => {
    api.agendaFila().then(setFila).catch(() => {})
    api.agendaLista(contaFiltro).then((r) => {
      setRecentes(r.recentes)
    }).catch(() => {})
  }, [contaFiltro])

  React.useEffect(() => {
    carregar()
    api.contasPublicar().then(setContas).catch(() => {})
    // Pausa com a aba em segundo plano.
    const id = setInterval(() => {
      if (!document.hidden) carregar()
    }, 15000)
    return () => clearInterval(id)
  }, [carregar])

  // contaFiltro começa com um valor fixo ("felizcred") que pode não existir de verdade — sem
  // esse fallback, uma conta real que não se chame "felizcred" nunca bate o filtro e a agenda
  // fica vazia pra sempre, mesmo com itens agendados de verdade.
  React.useEffect(() => {
    if (contas.length && !contas.some((c) => c.id === contaFiltro)) {
      setContaFiltro(contas[0].id)
    }
  }, [contas, contaFiltro])

  const filaDaConta = React.useMemo(
    () => fila.filter((item) => item.conta_id === contaFiltro),
    [fila, contaFiltro],
  )
  const recentesDaConta = React.useMemo(
    () => recentes.filter((item) => item.conta_id === contaFiltro),
    [recentes, contaFiltro],
  )

  // Pra pintar o calendário certo, mistura pendentes (fila completa, sem limite) com
  // publicados/erro desse dia (recentes, que já traz só o recorte recente) — mesma lógica de
  // itensDoDiaSelecionado abaixo, mas agrupado por dia inteiro em vez de só o dia selecionado.
  const itensPorDia = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of [...filaDaConta, ...recentesDaConta.filter((i) => i.status !== "pending")]) {
      const chave = chaveDia(item.agendado_para)
      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(item)
    }
    return map
  }, [filaDaConta, recentesDaConta])

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

  const listaHistorico = somenteErros ? recentesDaConta.filter((i) => i.status === "error") : recentesDaConta

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="h-14 px-4 flex items-center justify-between border-b shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-[#0F2A26] text-white dark:bg-primary dark:text-primary-foreground">
              Posts
            </span>
            <button
              type="button"
              title="Assistente de 3 passos: escolha quem recebe (etapa/etiqueta/aniversário), a mensagem e revise antes de enviar"
              className="text-sm font-medium px-3 py-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={() => setCampanhaOpen(true)}
            >
              Campanhas WhatsApp
            </button>
          </div>
          {resumoFiltrado.error > 0 && (
            <button
              onClick={() => setSomenteErros((v) => !v)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                somenteErros ? "bg-[#B23A3A] text-white" : "bg-[#FBE4E4] text-[#B23A3A]"
              }`}
            >
              {resumoFiltrado.error} com erro · ver
            </button>
          )}
        </div>

        {contas.length > 1 && (
          <div className="px-4 pt-3">
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

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium capitalize">
              {mesAtual.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1 uppercase">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {diasDoMes.map((data, i) => {
              if (!data) return <div key={i} />
              const chave = chaveDia(data.getTime())
              const itens = itensPorDia.get(chave) || []
              const selecionado = diaSelecionado === chave
              const hoje = chaveDia(Date.now()) === chave
              return (
                <button
                  key={i}
                  onClick={() => setDiaSelecionado(selecionado ? null : chave)}
                  className={`min-h-[62px] rounded-md border p-1 text-left flex flex-col gap-0.5 hover:bg-accent/50 ${
                    selecionado ? "bg-accent" : ""
                  } ${hoje ? "border-[#0E7C6B]" : "border-transparent"}`}
                >
                  <span className="text-[10px] text-muted-foreground px-0.5">{data.getDate()}</span>
                  {itens.slice(0, 2).map((item) => {
                    const cor = corChipDia(item)
                    return (
                      <span
                        key={item.id}
                        className="text-[9px] font-medium px-1 py-0.5 rounded truncate"
                        style={{ background: cor.bg, color: cor.fg }}
                      >
                        {item.status === "error" ? "Falhou" : nomeRede(item.redes[0])}
                      </span>
                    )
                  })}
                  {itens.length > 2 && <span className="text-[9px] text-muted-foreground px-0.5">+{itens.length - 2}</span>}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#0A5F53] mr-1" /> Instagram feed/Reels ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-[#C13584] mr-1 ml-1" /> Story ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-[#2563EB] mr-1 ml-1" /> Facebook ·{" "}
            <span className="inline-block h-2 w-2 rounded-full bg-[#B23A3A] mr-1 ml-1" /> erro (clique pra tentar de novo)
          </p>

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
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Histórico {somenteErros ? "· só com erro" : "recente"}
          </p>
          <ScrollArea
            className="max-h-[420px]"
            style={{
              maskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black calc(100% - 28px), transparent 100%)",
            }}
          >
            <div className="flex flex-col gap-2 pr-2 pb-6">
              {listaHistorico.map((item) => (
                <PostCard
                  key={item.id}
                  item={item}
                  onPublicarAgora={() => acaoPublicarAgora(item.id)}
                  onRemover={() => acaoRemover(item.id)}
                  onReenfileirar={() => acaoReenfileirar(item.id)}
                />
              ))}
              {listaHistorico.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum post ainda.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <PainelNovoPost contas={contas} contaPadrao={contaFiltro} onCriado={carregar} />

      <CampanhaWhatsAppWizard open={campanhaOpen} onOpenChange={setCampanhaOpen} />
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
              {nomeRede(r)}
            </Badge>
          ))}
        </div>
        {item.texto && <p className="text-sm line-clamp-2">{item.texto}</p>}
        {item.status === "error" && item.resultado && (
          <p className="text-xs text-[#B23A3A] mt-1 line-clamp-2">{item.resultado}</p>
        )}
        <div className="flex gap-1 mt-2">
          {item.status === "pending" && (
            <Button size="sm" variant="outline" onClick={onPublicarAgora}>
              <Send className="h-3 w-3 mr-1" /> Publicar agora
            </Button>
          )}
          {item.status === "error" && (
            <Button size="sm" variant="outline" onClick={onReenfileirar}>
              <RotateCcw className="h-3 w-3 mr-1" /> Tentar de novo
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

// Painel fixo (não é mais modal) — serve tanto "Publicar agora" quanto "Agendar" com o MESMO
// formulário: só a data é opcional, e qual botão a pessoa clica decide se chama
// api.publicarAgora ou api.agendaCriar.
function PainelNovoPost({
  contas,
  contaPadrao,
  onCriado,
}: {
  contas: ContaPublicar[]
  contaPadrao?: string
  onCriado: () => void
}) {
  const [contaId, setContaId] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [link, setLink] = React.useState("")
  const [redes, setRedes] = React.useState<Rede[]>([])
  const [data, setData] = React.useState("")
  const [imagens, setImagens] = React.useState<string[]>([])
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [resultado, setResultado] = React.useState<Record<string, { ok: boolean; erro?: string }> | null>(null)

  React.useEffect(() => {
    if (contaPadrao && contas.some((c) => c.id === contaPadrao)) setContaId(contaPadrao)
    else if (contas.length && !contaId) setContaId(contas[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaPadrao, contas])

  const conta = contas.find((c) => c.id === contaId)

  function toggleRede(r: Rede) {
    setRedes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  async function handleImagens(files: FileList | null) {
    if (!files || !files.length) return
    const base64s = await Promise.all(Array.from(files).map(fileToBase64))
    setImagens(base64s)
  }

  function limpar() {
    setTexto("")
    setLink("")
    setRedes([])
    setData("")
    setImagens([])
  }

  function validar(): boolean {
    setErro(null)
    if (!redes.length) {
      setErro("Marque ao menos uma rede.")
      return false
    }
    if (!texto && !imagens.length) {
      setErro("Informe um texto ou uma imagem.")
      return false
    }
    return true
  }

  async function agendar() {
    if (!validar()) return
    if (!data) {
      setErro("Escolha data e hora, ou use \"Publicar agora\".")
      return
    }
    setEnviando(true)
    setResultado(null)
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
      limpar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao agendar")
    } finally {
      setEnviando(false)
    }
  }

  async function publicarAgora() {
    if (!validar()) return
    setEnviando(true)
    setResultado(null)
    try {
      const { resultados } = await api.publicarAgora({
        contaId,
        texto: texto || undefined,
        link: link || undefined,
        redes,
        imagemBase64: imagens.length === 1 ? imagens[0] : undefined,
        imagensBase64: imagens.length > 1 ? imagens : undefined,
      })
      setResultado(resultados)
      onCriado()
      if (Object.values(resultados).every((r) => r.ok)) limpar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao publicar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="w-[340px] shrink-0 border-l h-screen overflow-y-auto">
      <div className="p-4 flex flex-col gap-3">
        <p className="font-semibold text-sm">Novo post</p>

        {contas.length > 1 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Conta</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Redes</label>
          <div className="flex flex-wrap gap-2">
            {(conta?.redesDisponiveis || []).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRede(r)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  redes.includes(r) ? "bg-[#0F2A26] text-white border-transparent dark:bg-primary dark:text-primary-foreground" : "border-input"
                }`}
              >
                {nomeRede(r)}
              </button>
            ))}
            {conta && !conta.redesDisponiveis.length && (
              <p className="text-xs text-muted-foreground">Nenhuma rede configurada pra essa conta.</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Texto</label>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Escreva o post..." />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Link (opcional)</label>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Imagem ou vídeo — várias fotos viram carrossel
          </label>
          <label className="flex items-center justify-center gap-1.5 rounded-md border border-dashed p-3 text-xs text-muted-foreground cursor-pointer hover:bg-accent/50">
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleImagens(e.target.files)} />
            Arraste a foto ou vídeo aqui, ou clique pra escolher
          </label>
          {imagens.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {imagens.map((src, i) => (
                <img key={i} src={src} alt="" className="h-14 w-14 rounded object-cover" />
              ))}
            </div>
          )}
        </div>

        {imagens.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="px-2.5 py-1.5 flex items-center gap-1.5 border-b bg-muted/30">
              <div className="h-5 w-5 rounded-full bg-[#0E7C6B] shrink-0" />
              <span className="text-[11px] font-semibold">{conta?.nome || "sua conta"}</span>
            </div>
            <img src={imagens[0]} alt="" className="w-full aspect-[4/5] object-cover" />
            {texto && <p className="text-[11px] px-2.5 py-1.5 line-clamp-3">{texto}</p>}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Data e hora (deixe em branco pra publicar agora)</label>
          <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {resultado && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(resultado).map(([rede, r]) => (
              <Badge key={rede} variant={r.ok ? "success" : "destructive"}>
                {nomeRede(rede)}: {r.ok ? "publicado" : r.erro || "erro"}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex-1" onClick={publicarAgora} disabled={enviando}>
            <Send className="h-3.5 w-3.5 mr-1" /> Publicar agora
          </Button>
          <Button className="flex-1" onClick={agendar} disabled={enviando}>
            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Agendar
          </Button>
        </div>
      </div>
    </div>
  )
}
