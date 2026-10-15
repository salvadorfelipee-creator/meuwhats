import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/blocks/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { COMPANY_LABELS, useChannel, type Channel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import { useAuth } from "@/lib/auth-context"
import { RetornosNavItem } from "@/components/retornos-nav-item"
import { MinhasConversasMenuItem } from "@/components/minhas-conversas-menu"
import {
  MessageCircle,
  CalendarDays,
  Menu,
  ChevronUp,
  AtSign as InstagramIcon,
  Phone,
  LogOut,
  Filter,
  BarChart3,
  Sparkles,
  Mail,
  Columns3,
  Home,
  Contact,
  Settings,
  Workflow,
  Globe2,
} from "lucide-react"

export type Screen =
  | "chats"
  | "agenda"
  | "publicar"
  | "reels"
  | "funil"
  | "pipeline"
  | "analytics"
  | "ia"
  | "email"
  | "hoje"
  | "contatos"
  | "retornos"
  | "fluxos"
  | "config"

// "reels" fica fora do menu por enquanto (edição em massa parada) — a rota em
// App.tsx continua existindo, só reativar aqui quando voltar a usar.
const NAV_ITEMS_ANTES: { id: Screen; title: string; icon: typeof MessageCircle }[] = [
  { id: "hoje", title: "Hoje", icon: Home },
  { id: "chats", title: "Conversas", icon: MessageCircle },
  { id: "pipeline", title: "Pipeline", icon: Columns3 },
  { id: "contatos", title: "Contatos", icon: Contact },
]

// "publicar" saiu do menu: virou parte da tela "Agenda" (painel de novo post publica agora OU
// agenda, paridade com o painel de referência da Especitá) — a rota em App.tsx continua
// existindo, só não tem mais entrada própria aqui.
const NAV_ITEMS_DEPOIS: { id: Screen; title: string; icon: typeof MessageCircle }[] = [
  { id: "agenda", title: "Agenda", icon: CalendarDays },
  { id: "funil", title: "Funil", icon: Filter },
  { id: "analytics", title: "Analytics", icon: BarChart3 },
  { id: "email", title: "Email", icon: Mail },
  { id: "ia", title: "IA", icon: Sparkles },
  { id: "fluxos", title: "Fluxos", icon: Workflow },
  { id: "config", title: "Configurações", icon: Settings },
]

// Bolinha vermelha "tem mensagem nova" — usada tanto ao lado do nome do canal (dropdown
// aberto) quanto piscando em cima do ícone do canal atual (dropdown fechado/sidebar
// recolhida), pra dar pra notar mesmo sem abrir o menu.
function UnreadDot({ blink = false }: { blink?: boolean }) {
  return (
    <span className={blink ? "relative flex h-2 w-2 shrink-0" : "flex h-2 w-2 shrink-0"}>
      {blink && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  )
}

export function AppSidebar({
  screen,
  onScreenChange,
  onAbrirConversa,
}: {
  screen: Screen
  onScreenChange: (screen: Screen) => void
  onAbrirConversa: (channelId: string, phone: string) => void
}) {
  const { toggleSidebar } = useSidebar()
  const { channels, current, setCurrent } = useChannel()
  const { unreadChannels, hasAnyUnread } = useUnread()
  const { logout } = useAuth()

  function selecionarCanal(c: Channel) {
    setCurrent(c)
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={toggleSidebar} tooltip="Menu">
                  <Menu />
                </SidebarMenuButton>
              </SidebarMenuItem>

              {NAV_ITEMS_ANTES.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={screen === item.id}
                    tooltip={item.title}
                    onClick={() => onScreenChange(item.id)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <MinhasConversasMenuItem onAbrirConversa={onAbrirConversa} />

              <RetornosNavItem screen={screen} onScreenChange={onScreenChange} />

              {NAV_ITEMS_DEPOIS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={screen === item.id}
                    tooltip={item.title}
                    onClick={() => onScreenChange(item.id)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Trocar canal" className="text-destructive hover:text-destructive font-medium">
                  <span className="relative inline-flex">
                    {current?.kind === "instagram" ? <InstagramIcon /> : current?.kind === "site" ? <Globe2 /> : <Phone />}
                    {hasAnyUnread && (
                      <span className="absolute -top-1 -right-1">
                        <UnreadDot blink />
                      </span>
                    )}
                  </span>
                  <span className="truncate">{current?.label ?? "Canal"}</span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[var(--radix-popper-anchor-width)] min-w-64">
                {(["felizcred", "cotacerta", "ciahot"] as const).map((company, index) => {
                  const items = channels.filter((c) => c.company === company)
                  if (!items.length) return null
                  return <React.Fragment key={company}>
                    {index > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{COMPANY_LABELS[company]}</DropdownMenuLabel>
                    {items.map((c) => (
                      <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                        {c.kind === "instagram" ? <InstagramIcon /> : c.kind === "site" ? <Globe2 /> : <Phone />}
                        <span className="flex-1">{c.label}</span>
                        {unreadChannels.has(c.id) && <UnreadDot />}
                      </DropdownMenuItem>
                    ))}
                  </React.Fragment>
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
