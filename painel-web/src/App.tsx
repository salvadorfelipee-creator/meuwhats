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
import { HojePage } from "@/pages/hoje"
import { ContatosPage } from "@/pages/contatos"
import { RetornosPage } from "@/pages/retornos"
import { ConfiguracoesPage } from "@/pages/configuracoes"

function Shell() {
  const [screen, setScreen] = React.useState<Screen>("hoje")
  const { current, channels, setCurrent } = useChannel()
  const { abrirConversa } = useUnread()

  function abrirConversaDoPipeline(phone: string) {
    if (!current) return
    abrirConversa(current.id, phone)
    setScreen("chats")
  }

  // "Hoje"/Contatos/Retornos cobrem todos os canais ao mesmo tempo (não só o selecionado na
  // barra lateral) — abrir uma conversa a partir delas precisa trocar pro canal certo primeiro
  // (setCurrent), só então navegar pra Conversas, senão o ChatsPage abriria o canal errado.
  function abrirConversaCrossCanal(channelId: string, phone: string) {
    const canal = channels.find((c) => c.id === channelId)
    if (canal) setCurrent(canal)
    abrirConversa(channelId, phone)
    setScreen("chats")
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar screen={screen} onScreenChange={setScreen} onAbrirConversa={abrirConversaCrossCanal} />
      <SidebarInset>
        {screen === "hoje" && <HojePage onAbrirConversa={abrirConversaCrossCanal} onIrParaConversas={() => setScreen("chats")} />}
        {screen === "chats" && <ChatsPage />}
        {screen === "agenda" && <AgendaPage />}
        {screen === "publicar" && <PublicarPage />}
        {screen === "reels" && <ReelsPage />}
        {screen === "funil" && <FunilPage />}
        {screen === "pipeline" && <PipelinePage onAbrirConversa={abrirConversaDoPipeline} />}
        {screen === "contatos" && <ContatosPage onAbrirConversa={abrirConversaCrossCanal} />}
        {screen === "retornos" && <RetornosPage onAbrirConversa={abrirConversaCrossCanal} />}
        {screen === "analytics" && <AnalyticsPage />}
        {screen === "ia" && <IaPage />}
        {screen === "email" && <EmailPage />}
        {screen === "config" && <ConfiguracoesPage />}
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
