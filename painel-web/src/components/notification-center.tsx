import { AtSign, Bell, BellRing, Globe2, MessageCircle, Phone } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/blocks/sidebar"
import { useUnread, type InboxAlert } from "@/lib/unread-context"
import { cn } from "@/lib/utils"

function tempoRelativo(timestamp: number) {
  const minutos = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutos < 1) return "agora"
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`
  return new Date(timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function ChannelIcon({ alert }: { alert: InboxAlert }) {
  if (alert.channelKind === "site") return <Globe2 className="h-4 w-4" />
  if (alert.channelKind === "instagram") return <AtSign className="h-4 w-4" />
  return <Phone className="h-4 w-4" />
}

export function NotificationCenter({ onOpenConversation }: { onOpenConversation: (channelId: string, conversationId: string) => void }) {
  const { alerts, notifPermission, requestNotifPermission } = useUnread()
  const total = alerts.length
  const urgentCount = alerts.filter((alert) => alert.urgent).length

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={total ? `${total} atendimento${total === 1 ? "" : "s"} aguardando` : "Avisos"}
            className={cn(total > 0 && "text-red-700 hover:text-red-800")}
            aria-label={total ? `Abrir avisos: ${total} atendimentos aguardando` : "Abrir avisos"}
          >
            <span className="relative inline-flex">
              {total > 0 ? <BellRing className="animate-[pulse_1.4s_ease-in-out_infinite] motion-reduce:animate-none" /> : <Bell />}
              {total > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold tabular-nums text-white shadow-sm">
                  {total > 99 ? "99+" : total}
                </span>
              )}
            </span>
            <span>Avisos</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-[min(380px,calc(100vw-24px))] p-0">
          <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4">
            <div>
              <p className="text-sm font-semibold">Atendimentos aguardando</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {total ? `${total} conversa${total === 1 ? "" : "s"}${urgentCount ? ` · ${urgentCount} urgente${urgentCount === 1 ? "" : "s"}` : ""}` : "Nenhuma mensagem pendente"}
              </p>
            </div>
            {total > 0 && <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0"><span className="absolute h-full w-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none"/><span className="relative h-2.5 w-2.5 rounded-full bg-red-600"/></span>}
          </div>
          <DropdownMenuSeparator className="m-0" />
          {notifPermission !== "unsupported" && notifPermission !== "granted" && (
            <>
              <button className="flex w-full items-center gap-3 bg-amber-50 px-4 py-3 text-left text-xs text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500" onClick={requestNotifPermission}>
                <Bell className="h-4 w-4 shrink-0" />
                <span><b className="block">Ativar avisos do navegador</b>Receba alertas mesmo quando estiver em outra aba.</span>
              </button>
              <DropdownMenuSeparator className="m-0" />
            </>
          )}
          <div className="max-h-[min(520px,70vh)] overflow-y-auto py-1">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <MessageCircle className="mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Tudo respondido</p>
                <p className="mt-1 text-xs text-muted-foreground">Novas mensagens aparecerão aqui, de qualquer canal.</p>
              </div>
            ) : alerts.map((alert) => (
              <DropdownMenuItem key={alert.key} className="items-start gap-3 rounded-none px-4 py-3" onClick={() => onOpenConversation(alert.channelId, alert.conversationId)}>
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground", alert.urgent && "bg-red-50 text-red-700")}><ChannelIcon alert={alert} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-sm">{alert.name}</b><time className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">{tempoRelativo(alert.timestamp)}</time></span>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{alert.channelLabel}{alert.urgent ? " · precisa de atenção" : ""}</span>
                  <span className="mt-1 block truncate text-xs text-foreground/75">{alert.body}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
