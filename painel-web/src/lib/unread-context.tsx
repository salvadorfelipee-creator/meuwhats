import * as React from "react"
import { api } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"

// Mesma lógica do painel.html antigo (verificarNovasMensagens): 1 fetch na caixa unificada
// cobre todos os canais de uma vez, comparando o último "last_message_at" já visto por
// conversa com o que voltou agora — mensagem de entrada mais nova, num canal que não está
// aberto no momento (ou com a janela sem foco), marca aquele canal como "tem novas".
type UnreadContextValue = {
  unreadChannels: Set<string>
  hasAnyUnread: boolean
  markSeen: (channelId: string) => void
}

const UnreadContext = React.createContext<UnreadContextValue | null>(null)

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { current } = useChannel()
  const [unreadChannels, setUnreadChannels] = React.useState<Set<string>>(new Set())

  const currentRef = React.useRef(current)
  currentRef.current = current
  const unreadChannelsRef = React.useRef(unreadChannels)
  unreadChannelsRef.current = unreadChannels

  const lastSeenRef = React.useRef<Map<string, number>>(new Map())
  const firstCheckRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false

    async function tick() {
      let lista
      try {
        lista = await api.inbox()
      } catch {
        return
      }
      if (cancelled) return

      let mudou = false
      const next = new Set(unreadChannelsRef.current)
      for (const c of lista) {
        const chId = c.channel === "instagram" ? "instagram" : c.business_number_id
        const chave = `${chId}|${c.phone}`
        const visto = lastSeenRef.current.get(chave)
        const ehNova = c.last_message_at && (!visto || c.last_message_at > visto)
        if (ehNova) {
          lastSeenRef.current.set(chave, c.last_message_at!)
          const olhandoAgora = currentRef.current?.id === chId && document.hasFocus()
          if (firstCheckRef.current && c.last_direction === "in" && !olhandoAgora && !next.has(chId)) {
            next.add(chId)
            mudou = true
          }
        }
      }
      firstCheckRef.current = true
      if (mudou) setUnreadChannels(next)
    }

    tick()
    const id = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const markSeen = React.useCallback((channelId: string) => {
    setUnreadChannels((prev) => {
      if (!prev.has(channelId)) return prev
      const next = new Set(prev)
      next.delete(channelId)
      return next
    })
  }, [])

  const value = React.useMemo(
    () => ({ unreadChannels, hasAnyUnread: unreadChannels.size > 0, markSeen }),
    [unreadChannels, markSeen],
  )

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

export function useUnread() {
  const ctx = React.useContext(UnreadContext)
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider")
  return ctx
}
