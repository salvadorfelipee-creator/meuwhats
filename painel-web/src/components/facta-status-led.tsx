import * as React from "react"
import { SidebarMenuItem } from "@/components/blocks/sidebar"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// Luz de status da ligação com a Facta (consulta de CLT no chat do site): verde piscando de leve = funcionando,
// vermelha = fora do ar (ou o servidor não respondeu). Confere a cada 30s.
export function FactaStatusLed() {
  const [estado, setEstado] = React.useState<"carregando" | "ok" | "falha">("carregando")
  const [detalhe, setDetalhe] = React.useState("")

  React.useEffect(() => {
    let cancelado = false
    async function conferir() {
      try {
        const r = await api.factaStatus()
        if (cancelado) return
        setEstado(r.ok ? "ok" : "falha")
        setDetalhe(r.ok ? "" : r.erro || "")
      } catch {
        if (cancelado) return
        setEstado("falha")
        setDetalhe("o servidor não respondeu")
      }
    }
    conferir()
    const timer = setInterval(conferir, 30_000)
    return () => {
      cancelado = true
      clearInterval(timer)
    }
  }, [])

  const titulo =
    estado === "ok" ? "Facta conectada: consultas de CLT funcionando" :
    estado === "falha" ? `Facta fora do ar${detalhe ? ` (${detalhe})` : ""}: clientes do chat não conseguem simular` :
    "Conferindo a ligação com a Facta…"

  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground" title={titulo} role="status" aria-label={titulo}>
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60",
            estado === "ok" && "animate-[pulse_2.4s_ease-in-out_infinite] bg-emerald-500 motion-reduce:animate-none",
            estado === "falha" && "animate-ping bg-red-500 motion-reduce:animate-none",
          )} />
          <span className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            estado === "ok" ? "bg-emerald-500" : estado === "falha" ? "bg-red-600" : "bg-slate-300",
          )} />
        </span>
        <span className={cn("truncate", estado === "falha" && "font-medium text-red-700")}>
          {estado === "falha" ? "Facta fora do ar" : "Facta"}
        </span>
      </div>
    </SidebarMenuItem>
  )
}
