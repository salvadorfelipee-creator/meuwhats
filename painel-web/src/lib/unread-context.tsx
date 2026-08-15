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
  notifPermission: NotificationPermission | "unsupported"
  requestNotifPermission: () => void
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
  const { current, setCurrent, channels } = useChannel()
  const [unreadChannels, setUnreadChannels] = React.useState<Set<string>>(new Set())
  const [notifPermission, setNotifPermission] = React.useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  )

  const currentRef = React.useRef(current)
  currentRef.current = current
  const unreadChannelsRef = React.useRef(unreadChannels)
  unreadChannelsRef.current = unreadChannels
  const channelsRef = React.useRef(channels)
  channelsRef.current = channels

  const lastSeenRef = React.useRef<Map<string, number>>(new Map())
  const firstCheckRef = React.useRef(false)

  const requestNotifPermission = React.useCallback(() => {
    if (typeof Notification === "undefined") return
    Notification.requestPermission().then(setNotifPermission)
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
      const next = new Set(unreadChannelsRef.current)
      for (const c of lista) {
        const chId = c.channel === "instagram" ? "instagram" : c.business_number_id
        const chave = `${chId}|${c.phone}`
        const visto = lastSeenRef.current.get(chave)
        const ehNova = c.last_message_at && (!visto || c.last_message_at > visto)
        if (ehNova) {
          lastSeenRef.current.set(chave, c.last_message_at!)
          const olhandoAgora = currentRef.current?.id === chId && document.hasFocus()
          if (firstCheckRef.current && c.last_direction === "in" && !olhandoAgora) {
            if (!next.has(chId)) {
              next.add(chId)
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
                tag: `inbox-${chId}-${c.phone}`,
              })
              notif.onclick = () => {
                window.focus()
                if (canal) setCurrent(canal)
                setUnreadChannels((prev) => {
                  if (!prev.has(chId)) return prev
                  const n = new Set(prev)
                  n.delete(chId)
                  return n
                })
              }
            }
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
  }, [setCurrent])

  const markSeen = React.useCallback((channelId: string) => {
    setUnreadChannels((prev) => {
      if (!prev.has(channelId)) return prev
      const next = new Set(prev)
      next.delete(channelId)
      return next
    })
  }, [])

  const value = React.useMemo(
    () => ({ unreadChannels, hasAnyUnread: unreadChannels.size > 0, markSeen, notifPermission, requestNotifPermission }),
    [unreadChannels, markSeen, notifPermission, requestNotifPermission],
  )

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

export function useUnread() {
  const ctx = React.useContext(UnreadContext)
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider")
  return ctx
}
