import * as React from "react"
import { SidebarMenuItem, SidebarMenuButton } from "@/components/blocks/sidebar"
import { api } from "@/lib/api"
import { CalendarClock } from "lucide-react"
import type { Screen } from "@/components/app-sidebar"

// Contador de retornos pendentes (cross-canal) ao lado do item "Retornos" do menu — mesmo
// espírito/poll (30s) do badge "Atribuídas a mim" (minhas-conversas-menu.tsx), só que aqui o
// clique abre uma TELA própria (RetornosPage) em vez de um dropdown, porque a lista pode ficar
// grande (ver feedback_design_for_scale) e já tem ação própria (abrir conversa/cancelar) por
// linha — não cabe bem num menu suspenso pequeno. Port de whatsapp especita/painel-web/src/
// components/retornos-nav-item.tsx.
//
// "retornos" ainda não faz parte do union Screen em components/app-sidebar.tsx (quem for ligar
// este item no menu precisa acrescentar o id lá) — por isso o tipo aceito aqui é `Screen |
// "retornos"` em vez de `Screen` puro, pra este arquivo compilar sozinho sem editar
// app-sidebar.tsx fora do escopo desta tarefa.
export function RetornosNavItem({
  screen,
  onScreenChange,
}: {
  screen: Screen | "retornos"
  onScreenChange: (screen: Screen | "retornos") => void
}) {
  const [total, setTotal] = React.useState(0)

  React.useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const lista = await api.retornosPendentes()
        if (!cancelado) setTotal(lista.length)
      } catch {
        // Só um badge informativo — falha silenciosa evita poluir a tela com erro.
      }
    }
    carregar()
    // Pausa com a aba em segundo plano (mesmo princípio de chats.tsx).
    const id = setInterval(() => {
      if (!document.hidden) carregar()
    }, 30000)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={screen === "retornos"} tooltip="Retornos" onClick={() => onScreenChange("retornos")}>
        <CalendarClock />
        <span className="flex-1">Retornos</span>
        {total > 0 && (
          <span className="bg-red-500 text-white rounded-full px-1.5 text-[10px] leading-4 group-data-[collapsible=icon]:hidden">
            {total}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
