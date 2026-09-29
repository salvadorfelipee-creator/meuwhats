import * as React from "react"
import { api, type PhoneNumber } from "@/lib/api"

export type Channel = { id: string; label: string; kind: "whatsapp" | "instagram" }

type ChannelContextValue = {
  channels: Channel[]
  current: Channel | null
  setCurrent: (channel: Channel) => void
  loading: boolean
}

const ChannelContext = React.createContext<ChannelContextValue | null>(null)

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [numbers, setNumbers] = React.useState<PhoneNumber[]>([])
  const [current, setCurrent] = React.useState<Channel | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    api
      .numbers()
      .then((list) => {
        setNumbers(list)
        if (list.length) setCurrent({ id: list[0].id, label: list[0].label, kind: "whatsapp" })
      })
      .finally(() => setLoading(false))
  }, [])

  const channels = React.useMemo<Channel[]>(
    () => [
      ...numbers.map((n) => ({ id: n.id, label: n.label, kind: "whatsapp" as const })),
      { id: "instagram", label: "Instagram", kind: "instagram" as const },
    ],
    [numbers],
  )

  const value = React.useMemo(
    () => ({ channels, current, setCurrent, loading }),
    [channels, current, loading],
  )

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>
}

export function useChannel() {
  const ctx = React.useContext(ChannelContext)
  if (!ctx) throw new Error("useChannel must be used within ChannelProvider")
  return ctx
}
