import * as React from "react"
import { SidebarMenuItem } from "@/components/blocks/sidebar"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// Aviso do consumo do banco (Turso) no plano grátis: barra com a % do mês. Âmbar a partir de 70%, vermelho a
// partir de 90%. Some enquanto o servidor não tiver o token de consulta configurado (TURSO_PLATFORM_TOKEN).
export function TursoUsoAviso() {
  const [dados, setDados] = React.useState<Awaited<ReturnType<typeof api.tursoUso>> | null>(null)

  React.useEffect(() => {
    let cancelado = false
    const buscar = () => api.tursoUso().then((r) => { if (!cancelado) setDados(r) }).catch(() => {})
    buscar()
    const timer = setInterval(buscar, 10 * 60_000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [])

  if (!dados?.configurado || !dados.ok || dados.pct == null) return null
  const pct = Math.min(dados.pct, 100)
  const nivel = pct >= 90 ? "critico" : pct >= 70 ? "atencao" : "ok"
  const titulo = `Banco de dados: ${pct}% do limite do mês (leituras ${dados.pctLeituras}%, escritas ${dados.pctEscritas}%)${nivel !== "ok" ? " — perto do limite do plano grátis" : ""}`

  return (
    <SidebarMenuItem>
      <div className="px-2 py-1.5 text-xs text-muted-foreground" title={titulo} role="status" aria-label={titulo}>
        <div className="mb-1 flex items-center justify-between">
          <span className={cn(nivel === "critico" && "font-semibold text-red-700", nivel === "atencao" && "font-medium text-amber-700")}>
            {nivel === "ok" ? "Banco" : nivel === "atencao" ? "Banco perto do limite" : "Banco quase no limite"}
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn("h-full rounded-full", nivel === "ok" ? "bg-emerald-500" : nivel === "atencao" ? "bg-amber-500" : "bg-red-600")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </SidebarMenuItem>
  )
}
