import * as React from "react"
import { SidebarMenuItem } from "@/components/blocks/sidebar"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const CHAVE_AVISO_DIA = "banda-aviso-dia"

// Banda de saída do servidor (Render) no plano grátis: 5 GB por mês. Estimativa do próprio servidor (ver banda.js),
// por isso o aviso vem cedo: âmbar a partir de 60%, vermelho a partir de 80%. De 60% em diante, uma vez por dia
// (na primeira vez que o painel abre) aparece também um aviso na tela.
export function BandaUsoAviso() {
  const [dados, setDados] = React.useState<Awaited<ReturnType<typeof api.bandaUso>> | null>(null)
  const [avisoAberto, setAvisoAberto] = React.useState(false)

  React.useEffect(() => {
    let cancelado = false
    const buscar = () => api.bandaUso().then((r) => { if (!cancelado) setDados(r) }).catch(() => {})
    buscar()
    const timer = setInterval(buscar, 10 * 60_000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [])

  const pct = dados ? Math.min(dados.pct, 100) : null
  const nivel = pct == null ? "ok" : pct >= 80 ? "critico" : pct >= 60 ? "atencao" : "ok"

  React.useEffect(() => {
    if (nivel === "ok") return
    const hoje = new Date().toDateString()
    try {
      if (localStorage.getItem(CHAVE_AVISO_DIA) === hoje) return
      localStorage.setItem(CHAVE_AVISO_DIA, hoje)
    } catch { /* sem armazenamento: avisa mesmo assim */ }
    setAvisoAberto(true)
  }, [nivel])

  if (pct == null || !dados) return null
  const titulo = `Tráfego do servidor: ${dados.gb} GB de ${dados.limiteGb} GB grátis no mês (estimativa)`

  return (
    <SidebarMenuItem>
      <div className="px-2 py-1.5 text-xs text-muted-foreground" title={titulo} role="status" aria-label={titulo}>
        {nivel !== "ok" && (
          <div className="mb-1 flex items-center justify-between">
            <span className={cn(nivel === "critico" ? "font-semibold text-red-700" : "font-medium text-amber-700")}>
              {nivel === "atencao" ? "Tráfego perto do limite" : "Tráfego quase no limite"}
            </span>
            <span className="tabular-nums">{dados.gb} GB</span>
          </div>
        )}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn("h-full rounded-full", nivel === "ok" ? "bg-emerald-500" : nivel === "atencao" ? "bg-amber-500" : "bg-red-600")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {avisoAberto && (
        <div
          role="alert"
          className={cn(
            "fixed right-4 top-4 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl border p-4 shadow-lg",
            nivel === "critico" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950",
          )}
        >
          <p className="text-sm font-semibold">O servidor já usou cerca de {dados.gb} GB dos {dados.limiteGb} GB grátis do mês</p>
          <p className="mt-1 text-xs">
            Passando disso, o Render cobra US$ 0,15 por GB extra. Avise para eu reduzir o consumo.
          </p>
          <button
            type="button"
            onClick={() => setAvisoAberto(false)}
            className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Entendi
          </button>
        </div>
      )}
    </SidebarMenuItem>
  )
}
