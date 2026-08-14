import * as React from "react"
import { api, type ReelsItem, type ReelsStatusResponse } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, RotateCcw, Trash2, RefreshCw, Upload } from "lucide-react"

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

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

export function ReelsPage() {
  const [status, setStatus] = React.useState<ReelsStatusResponse | null>(null)
  const [fila, setFila] = React.useState<ReelsItem[]>([])
  const [postsPorDia, setPostsPorDia] = React.useState("5")
  const [legendaPadrao, setLegendaPadrao] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [legendaUpload, setLegendaUpload] = React.useState("")
  const [dataUpload, setDataUpload] = React.useState("")
  const [progresso, setProgresso] = React.useState<number | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const carregar = React.useCallback(() => {
    api.reelsStatus().then((s) => {
      setStatus(s)
      setPostsPorDia(String(s.postsPorDia))
      setLegendaPadrao(s.legendaPadrao)
    }).catch(() => {})
    api.reelsFila().then(setFila).catch(() => {})
  }, [])

  React.useEffect(() => {
    carregar()
    const id = setInterval(carregar, 15000)
    return () => clearInterval(id)
  }, [carregar])

  async function enviarVideo() {
    if (!arquivo) return
    setErro(null)
    setProgresso(0)
    try {
      await api.reelsUpload(arquivo, legendaUpload, dataUpload, setProgresso)
      setArquivo(null)
      setLegendaUpload("")
      setDataUpload("")
      carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro no upload")
    } finally {
      setProgresso(null)
    }
  }

  async function salvarPostsPorDia() {
    await api.reelsPostsPorDia(Number(postsPorDia) || 1)
    carregar()
  }

  async function salvarLegendaPadrao() {
    await api.reelsLegendaPadrao(legendaPadrao)
  }

  async function togglePausado() {
    if (!status) return
    await api.reelsPausar(!status.pausado)
    carregar()
  }

  async function sincronizar() {
    const r = await api.reelsSincronizar()
    alert(`${r.encontrados} vídeo(s) encontrados no bucket, ${r.adicionados} novo(s) adicionado(s).`)
    carregar()
  }

  async function publicarProximo() {
    if (!confirm("Publicar o próximo vídeo pendente agora, fora do horário automático?")) return
    try {
      await api.reelsPublicarProximo()
      carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao publicar")
    }
  }

  async function acaoPublicarItem(id: number) {
    if (!confirm("Publicar esse vídeo agora?")) return
    try {
      await api.reelsPublicarItem(id)
      carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao publicar")
    }
  }

  async function acaoRemover(id: number) {
    if (!confirm("Remover esse vídeo da fila (apaga do armazenamento também)?")) return
    await api.reelsRemover(id)
    carregar()
  }

  async function acaoReenfileirar(id: number) {
    await api.reelsReenfileirar(id)
    carregar()
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-14 px-4 flex items-center justify-between border-b shrink-0">
        <div>
          <p className="font-semibold text-sm">Reels em massa</p>
          {status && (
            <p className="text-xs text-muted-foreground">
              {status.resumo.pending} na fila · {status.resumo.posted} publicados · {status.resumo.error} com erro
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={sincronizar}>
            <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar
          </Button>
          <Button variant={status?.pausado ? "default" : "outline"} size="sm" onClick={togglePausado}>
            {status?.pausado ? "Piloto automático pausado" : "Piloto automático ligado"}
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-3xl grid gap-6 md:grid-cols-2">
        {/* Configurações */}
        <div className="flex flex-col gap-4">
          {status?.espaco && (
            <div className="border rounded-md p-3">
              <p className="text-xs font-medium mb-1">Armazenamento (R2)</p>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full ${status.espaco.bloqueado ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(status.espaco.percentual, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(status.espaco.usados)} de {formatBytes(status.espaco.limite)} ({status.espaco.percentual}%)
                {status.espaco.bloqueado && " — cheio, apague vídeos publicados"}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Posts por dia (piloto automático, 08h–22h)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={48}
                value={postsPorDia}
                onChange={(e) => setPostsPorDia(e.target.value)}
                className="w-24"
              />
              <Button size="sm" variant="outline" onClick={salvarPostsPorDia}>
                Salvar
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Legenda padrão (quando o vídeo não tem uma própria)</label>
            <Textarea value={legendaPadrao} onChange={(e) => setLegendaPadrao(e.target.value)} rows={3} />
            <Button size="sm" variant="outline" className="mt-2" onClick={salvarLegendaPadrao}>
              Salvar legenda
            </Button>
          </div>

          <Button size="sm" onClick={publicarProximo}>
            <Send className="h-4 w-4 mr-1" /> Publicar próximo pendente agora
          </Button>
        </div>

        {/* Upload */}
        <div className="border rounded-md p-3 flex flex-col gap-3 h-fit">
          <p className="text-sm font-medium">Enviar vídeo novo</p>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
          />
          <div>
            <label className="text-xs font-medium mb-1 block">Legenda (opcional, usa a padrão se vazio)</label>
            <Textarea value={legendaUpload} onChange={(e) => setLegendaUpload(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Data mínima (opcional, entra no piloto automático se vazio)</label>
            <Input type="datetime-local" value={dataUpload} onChange={(e) => setDataUpload(e.target.value)} />
          </div>
          {progresso !== null && (
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button size="sm" onClick={enviarVideo} disabled={!arquivo || progresso !== null}>
            <Upload className="h-4 w-4 mr-1" /> {progresso !== null ? `Enviando... ${progresso}%` : "Enviar"}
          </Button>
        </div>
      </div>

      <div className="px-4 pb-6">
        <p className="text-xs font-medium text-muted-foreground mb-2">Fila (mais próximo primeiro)</p>
        <ScrollArea className="max-h-[420px]">
          <div className="flex flex-col gap-2 pr-2">
            {fila.map((item) => (
              <div key={item.id} className="border rounded-md p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    {item.data_prevista && (
                      <span className="text-xs text-muted-foreground">
                        {item.exato ? "às " : "previsto "}
                        {formatDateTime(item.data_prevista)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate">{item.nome_arquivo}</p>
                  {item.legenda && <p className="text-xs text-muted-foreground truncate">{item.legenda}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => acaoPublicarItem(item.id)}>
                    <Send className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => acaoRemover(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            {fila.length === 0 && <p className="text-sm text-muted-foreground">Fila vazia.</p>}
          </div>
        </ScrollArea>

        {status && status.recentes.some((i) => i.status === "error" || i.status === "posted") && (
          <>
            <p className="text-xs font-medium text-muted-foreground mb-2 mt-6">Histórico recente</p>
            <div className="flex flex-col gap-2">
              {status.recentes
                .filter((i) => i.status === "error" || i.status === "posted")
                .map((item) => (
                  <div key={item.id} className="border rounded-md p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                        {item.posted_at && (
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.posted_at)}</span>
                        )}
                      </div>
                      <p className="text-sm truncate">{item.nome_arquivo}</p>
                      {item.status === "error" && item.resultado && (
                        <p className="text-xs text-destructive truncate">{item.resultado}</p>
                      )}
                    </div>
                    {item.status === "error" && (
                      <Button size="sm" variant="outline" onClick={() => acaoReenfileirar(item.id)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
