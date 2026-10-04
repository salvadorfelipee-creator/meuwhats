import * as React from "react"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { ChannelProvider, useChannel } from "@/lib/channel-context"
import { UnreadProvider, useUnread } from "@/lib/unread-context"
import { SidebarProvider, SidebarInset } from "@/components/blocks/sidebar"
import { AppSidebar, type Screen } from "@/components/app-sidebar"
import { LoginPage } from "@/pages/login"
import { ChatsPage } from "@/pages/chats"
import { AgendaPage } from "@/pages/agenda"
import { PublicarPage } from "@/pages/publicar"
import { ReelsPage } from "@/pages/reels"
import { FunilPage } from "@/pages/funil"
import { PipelinePage } from "@/pages/pipeline"
import { AnalyticsPage } from "@/pages/analytics"
import { IaPage } from "@/pages/ia"
import { EmailPage } from "@/pages/email"

function Shell() {
  const [screen, setScreen] = React.useState<Screen>("chats")
  const { current } = useChannel()
  const { abrirConversa } = useUnread()

  function abrirConversaDoPipeline(phone: string) {
    if (!current) return
    abrirConversa(current.id, phone)
    setScreen("chats")
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar screen={screen} onScreenChange={setScreen} />
      <SidebarInset>
        {screen === "chats" && <ChatsPage />}
        {screen === "agenda" && <AgendaPage />}
        {screen === "publicar" && <PublicarPage />}
        {screen === "reels" && <ReelsPage />}
        {screen === "funil" && <FunilPage />}
        {screen === "pipeline" && <PipelinePage onAbrirConversa={abrirConversaDoPipeline} />}
        {screen === "analytics" && <AnalyticsPage />}
        {screen === "ia" && <IaPage />}
        {screen === "email" && <EmailPage />}
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
