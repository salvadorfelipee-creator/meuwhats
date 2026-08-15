import * as React from "react"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { ChannelProvider } from "@/lib/channel-context"
import { UnreadProvider } from "@/lib/unread-context"
import { SidebarProvider, SidebarInset } from "@/components/blocks/sidebar"
import { AppSidebar, type Screen } from "@/components/app-sidebar"
import { LoginPage } from "@/pages/login"
import { ChatsPage } from "@/pages/chats"
import { AgendaPage } from "@/pages/agenda"
import { PublicarPage } from "@/pages/publicar"
import { ReelsPage } from "@/pages/reels"
import { FunilPage } from "@/pages/funil"

function Shell() {
  const [screen, setScreen] = React.useState<Screen>("chats")

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar screen={screen} onScreenChange={setScreen} />
      <SidebarInset>
        {screen === "chats" && <ChatsPage />}
        {screen === "agenda" && <AgendaPage />}
        {screen === "publicar" && <PublicarPage />}
        {screen === "reels" && <ReelsPage />}
        {screen === "funil" && <FunilPage />}
      </SidebarInset>
    </SidebarProvider>
  )
}

function Gate() {
  const { authenticated } = useAuth()
  if (!authenticated) return <LoginPage />
  return (
    <ChannelProvider>
      <UnreadProvider>
        <Shell />
      </UnreadProvider>
    </ChannelProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
