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
import { useChannel, type Channel } from "@/lib/channel-context"
import { useUnread } from "@/lib/unread-context"
import { useAuth } from "@/lib/auth-context"
import {
  MessageCircle,
  CalendarDays,
  Send,
  Clapperboard,
  Menu,
  ChevronUp,
  AtSign as InstagramIcon,
  Phone,
  LogOut,
  Filter,
} from "lucide-react"

export type Screen = "chats" | "agenda" | "publicar" | "reels" | "funil"

const NAV_ITEMS: { id: Screen; title: string; icon: typeof MessageCircle }[] = [
  { id: "chats", title: "Conversas", icon: MessageCircle },
  { id: "agenda", title: "Agenda", icon: CalendarDays },
  { id: "publicar", title: "Publicar", icon: Send },
  { id: "reels", title: "Reels", icon: Clapperboard },
  { id: "funil", title: "Funil", icon: Filter },
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
}: {
  screen: Screen
  onScreenChange: (screen: Screen) => void
}) {
  const { toggleSidebar } = useSidebar()
  const { channels, current, setCurrent } = useChannel()
  const { unreadChannels, hasAnyUnread, markSeen } = useUnread()
  const { logout } = useAuth()

  function selecionarCanal(c: Channel) {
    setCurrent(c)
    markSeen(c.id)
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

              {NAV_ITEMS.map((item) => (
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
                <SidebarMenuButton tooltip="Trocar canal">
                  <span className="relative inline-flex">
                    {current?.kind === "instagram" ? <InstagramIcon /> : <Phone />}
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
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width] min-w-56">
                <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "whatsapp")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                      <Phone /> <span className="flex-1">{c.label}</span>
                      {unreadChannels.has(c.id) && <UnreadDot />}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Instagram</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "instagram")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => selecionarCanal(c)} className="gap-2">
                      <InstagramIcon /> <span className="flex-1">{c.label}</span>
                      {unreadChannels.has(c.id) && <UnreadDot />}
                    </DropdownMenuItem>
                  ))}
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
