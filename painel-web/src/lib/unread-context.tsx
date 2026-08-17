import * as React from "react"
import { api } from "@/lib/api"
import { useChannel } from "@/lib/channel-context"

// Mesma lógica do painel.html antigo (verificarNovasMensagens): 1 fetch na caixa unificada
// cobre todos os canais de uma vez, comparando o último "last_message_at" já visto por
// conversa com o que voltou agora — mensagem de entrada mais nova conta como não lida.
//
// Rastreamento é por CONVERSA (chId|phone), não só por canal — antes disso, "olhandoAgora"
// só comparava o canal aberto (ex. Felizcred principal), então uma mensagem nova de um
// contato diferente do que estava selecionado no momento não disparava som/notificação nem
// ficava marcada em lugar nenhum, mesmo com a aba sem foco. unreadChannels (usado no dot do
// trocador de canal) agora é derivado daqui.
type UnreadContextValue = {
  unreadChannels: Set<string>
  unreadConversations: Set<string>
  hasAnyUnread: boolean
  markSeen: (channelId: string) => void
  markConversationSeen: (channelId: string, phone: string) => void
  setActiveConversation: (channelId: string | null, phone: string | null) => void
  notifPermission: NotificationPermission | "unsupported"
  requestNotifPermission: () => void
}

function chaveConversa(channelId: string, phone: string) {
  return `${channelId}|${phone}`
}

const UnreadContext = React.createContext<UnreadContextValue | null>(null)

// Navegadores só deixam tocar áudio depois de algum clique do usuário na página (autoplay
// policy). Por isso destravamos o AudioContext no primeiro clique em qualquer lugar, e não
// esperamos só o clique num eventual botão de notificações.
let audioCtx: AudioContext | null = null
function obterAudioCtx(): AudioContext | null {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === "suspended") audioCtx.resume()
  return audioCtx
}
if (typeof document !== "undefined") {
  document.addEventListener("click", () => obterAudioCtx(), { once: true })
}

function tocarSomNotificacao() {
  const ctx = obterAudioCtx()
  if (!ctx) return
  const agora = ctx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    const inicio = agora + i * 0.12
    gain.gain.setValueAtTime(0, inicio)
    gain.gain.linearRampToValueAtTime(0.25, inicio + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start(inicio)
    osc.stop(inicio + 0.26)
  })
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { setCurrent, channels } = useChannel()
  const [unreadConversations, setUnreadConversations] = React.useState<Set<string>>(new Set())
  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  )

  // A conversa REALMENTE aberta agora (canal + contato específico), não só o canal — é contra
  // isso que decidimos se uma mensagem nova precisa alertar ou não.
  const activeRef = React.useRef<{ channelId: string | null; phone: string | null }>({ channelId: null, phone: null })
  const unreadConversationsRef = React.useRef(unreadConversations)
  unreadConversationsRef.current = unreadConversations
  const channelsRef = React.useRef(channels)
  channelsRef.current = channels

  const lastSeenRef = React.useRef<Map<string, number>>(new Map())
  const firstCheckRef = React.useRef(false)

  const requestNotifPermission = React.useCallback(() => {
    if (typeof Notification === "undefined") return
    Notification.requestPermission().then(setNotifPermission)
  }, [])

  const setActiveConversation = React.useCallback((channelId: string | null, phone: string | null) => {
    activeRef.current = { channelId, phone }
  }, [])

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
      let tocouSom = false
      const next = new Set(unreadConversationsRef.current)
      for (const c of lista) {
        const chId = c.channel === "instagram" ? "instagram" : c.business_number_id
        const chave = chaveConversa(chId, c.phone)
        const visto = lastSeenRef.current.get(chave)
        const ehNova = c.last_message_at && (!visto || c.last_message_at > visto)
        if (ehNova) {
          lastSeenRef.current.set(chave, c.last_message_at!)
          const olhandoAgora =
            activeRef.current.channelId === chId && activeRef.current.phone === c.phone && document.hasFocus()
          if (firstCheckRef.current && c.last_direction === "in" && !olhandoAgora) {
            if (!next.has(chave)) {
              next.add(chave)
              mudou = true
            }
            if (!tocouSom) {
              tocarSomNotificacao()
              tocouSom = true
            }
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const canal = channelsRef.current.find((ch) => ch.id === chId)
              const notif = new Notification(`${canal?.label || chId} · ${c.name || c.phone}`, {
                body: c.last_body || "Nova mensagem",
                tag: `inbox-${chave}`,
              })
              notif.onclick = () => {
                window.focus()
                if (canal) setCurrent(canal)
                setUnreadConversations((prev) => {
                  if (!prev.has(chave)) return prev
                  const n = new Set(prev)
                  n.delete(chave)
                  return n
                })
              }
            }
          }
        }
      }
      firstCheckRef.current = true
      if (mudou) setUnreadConversations(next)
    }

    tick()
    const id = setInterval(tick, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [setCurrent])

  const markSeen = React.useCallback((channelId: string) => {
    setUnreadConversations((prev) => {
      let mudou = false
      const next = new Set(prev)
      for (const chave of prev) {
        if (chave.startsWith(`${channelId}|`)) {
          next.delete(chave)
          mudou = true
        }
      }
      return mudou ? next : prev
    })
  }, [])

  const markConversationSeen = React.useCallback((channelId: string, phone: string) => {
    const chave = chaveConversa(channelId, phone)
    setUnreadConversations((prev) => {
      if (!prev.has(chave)) return prev
      const next = new Set(prev)
      next.delete(chave)
      return next
    })
  }, [])

  const unreadChannels = React.useMemo(() => {
    const set = new Set<string>()
    for (const chave of unreadConversations) set.add(chave.slice(0, chave.lastIndexOf("|")))
    return set
  }, [unreadConversations])

  const value = React.useMemo(
    () => ({
      unreadChannels,
      unreadConversations,
      hasAnyUnread: unreadConversations.size > 0,
      markSeen,
      markConversationSeen,
      setActiveConversation,
      notifPermission,
      requestNotifPermission,
    }),
    [unreadChannels, unreadConversations, markSeen, markConversationSeen, setActiveConversation, notifPermission, requestNotifPermission],
  )

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

export function useUnread() {
  const ctx = React.useContext(UnreadContext)
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider")
  return ctx
}
