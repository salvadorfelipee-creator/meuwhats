import * as React from "react"
import { SidebarMenuItem, SidebarMenuButton } from "@/components/blocks/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useChannel } from "@/lib/channel-context"
import { api, type MinhaConversa } from "@/lib/api"
import { Bell } from "lucide-react"

// "Atribuídas a mim" entre canais (handoff SDR → fechamento) — a SDR qualifica num número e
// marca "Responsável" com o nome de quem vai fechar; quem fecha normalmente não navega naquele
// número (pode nem estar na lista de canais dela), então esse badge/lista é o jeito de notar e
// abrir a conversa certa sem precisar trocar de canal manualmente pra procurar. Poll simples
// (30s) — não é tão urgente quanto mensagem nova (ver unread-context.tsx, que faz isso a cada
// 5s pra inbox).
export function MinhasConversasMenuItem({
  onAbrirConversa,
}: {
  onAbrirConversa: (channelId: string, phone: string) => void
}) {
  const { channels } = useChannel()
  const [itens, setItens] = React.useState<MinhaConversa[]>([])

  React.useEffect(() => {
    let cancelado = false
    async function carregar() {
      try {
        const lista = await api.minhasConversas()
        if (!cancelado) setItens(lista)
      } catch {
        // Não é crítico — só um badge informativo, falha silenciosa evita poluir a tela com erro.
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

  function rotuloCanal(businessNumberId: string) {
    return channels.find((c) => c.id === businessNumberId)?.label || businessNumberId
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip="Atribuídas a mim">
            <Bell />
            <span className="flex-1">Atribuídas a mim</span>
            {itens.length > 0 && (
              <span className="bg-red-500 text-white rounded-full px-1.5 text-[10px] leading-4 group-data-[collapsible=icon]:hidden">
                {itens.length}
              </span>
            )}
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-72">
          <DropdownMenuLabel>Conversas atribuídas a você</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {itens.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nenhuma conversa atribuída a você agora.</p>
          )}
          {itens.map((item) => (
            <DropdownMenuItem
              key={`${item.business_number_id}|${item.phone}`}
              className="flex flex-col items-start gap-0.5 cursor-pointer"
              onClick={() => onAbrirConversa(item.business_number_id, item.phone)}
            >
              <span className="text-sm font-medium truncate w-full">{item.name || item.phone}</span>
              <span className="text-xs text-muted-foreground truncate w-full">
                {rotuloCanal(item.business_number_id)} · {item.last_body || "Sem mensagens"}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
