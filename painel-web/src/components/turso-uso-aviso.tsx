import * as React from "react"
import { SidebarMenuItem } from "@/components/blocks/sidebar"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const CHAVE_AVISO_DIA = "turso-aviso-dia"

// Consumo do banco (Turso) no plano grátis. Abaixo de 70%: só a barrinha, sem texto. De 70% em diante: o texto
// aparece e, uma vez por dia (na primeira vez que o painel abre), um aviso na tela. Âmbar a partir de 70%,
// vermelho a partir de 90%. Some enquanto o servidor não tem o token de consulta (TURSO_PLATFORM_TOKEN).
export function TursoUsoAviso() {
  const [dados, setDados] = React.useState<Awaited<ReturnType<typeof api.tursoUso>> | null>(null)
  const [avisoAberto, setAvisoAberto] = React.useState(false)

  React.useEffect(() => {
    let cancelado = false
    const buscar = () => api.tursoUso().then((r) => { if (!cancelado) setDados(r) }).catch(() => {})
    buscar()
    const timer = setInterval(buscar, 10 * 60_000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [])

  const pct = dados?.configurado && dados.ok && dados.pct != null ? Math.min(dados.pct, 100) : null
  const nivel = pct == null ? "ok" : pct >= 90 ? "critico" : pct >= 70 ? "atencao" : "ok"

  React.useEffect(() => {
    if (nivel === "ok") return
    const hoje = new Date().toDateString()
    try {
      if (localStorage.getItem(CHAVE_AVISO_DIA) === hoje) return
      localStorage.setItem(CHAVE_AVISO_DIA, hoje)
    } catch { /* sem armazenamento: avisa mesmo assim */ }
    setAvisoAberto(true)
  }, [nivel])

  if (pct == null) return null
  const titulo = `Banco de dados: ${pct}% do limite do mês (leituras ${dados?.pctLeituras}%, escritas ${dados?.pctEscritas}%)`

  return (
    <SidebarMenuItem>
      <div className="px-2 py-1.5 text-xs text-muted-foreground" title={titulo} role="status" aria-label={titulo}>
        {nivel !== "ok" && (
          <div className="mb-1 flex items-center justify-between">
            <span className={cn(nivel === "critico" ? "font-semibold text-red-700" : "font-medium text-amber-700")}>
              {nivel === "atencao" ? "Banco perto do limite" : "Banco quase no limite"}
            </span>
            <span className="tabular-nums">{pct}%</span>
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
          <p className="text-sm font-semibold">O banco de dados está em {pct}% do limite do mês</p>
          <p className="mt-1 text-xs">
            No plano grátis, se chegar a 100% o sistema para até o mês virar. Avise para eu reduzir o consumo antes disso.
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
