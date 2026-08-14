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
import { useChannel } from "@/lib/channel-context"
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
} from "lucide-react"

export type Screen = "chats" | "agenda" | "publicar" | "reels"

const NAV_ITEMS: { id: Screen; title: string; icon: typeof MessageCircle }[] = [
  { id: "chats", title: "Conversas", icon: MessageCircle },
  { id: "agenda", title: "Agenda", icon: CalendarDays },
  { id: "publicar", title: "Publicar", icon: Send },
  { id: "reels", title: "Reels", icon: Clapperboard },
]

export function AppSidebar({
  screen,
  onScreenChange,
}: {
  screen: Screen
  onScreenChange: (screen: Screen) => void
}) {
  const { toggleSidebar } = useSidebar()
  const { channels, current, setCurrent } = useChannel()
  const { logout } = useAuth()

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
                  {current?.kind === "instagram" ? <InstagramIcon /> : <Phone />}
                  <span className="truncate">{current?.label ?? "Canal"}</span>
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width] min-w-56">
                <DropdownMenuLabel>WhatsApp</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "whatsapp")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => setCurrent(c)}>
                      <Phone /> {c.label}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Instagram</DropdownMenuLabel>
                {channels
                  .filter((c) => c.kind === "instagram")
                  .map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => setCurrent(c)}>
                      <InstagramIcon /> {c.label}
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
