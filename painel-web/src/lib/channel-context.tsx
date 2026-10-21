import * as React from "react"
import { api, type PhoneNumber } from "@/lib/api"

export type CompanyId = "felizcred" | "cotacerta" | "ciahot"
export type Channel = { id: string; label: string; kind: "whatsapp" | "instagram" | "site"; company: CompanyId }

export function companyForLabel(label: string): CompanyId {
  const value = label.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ")
  if (value.includes("cota certa")) return "cotacerta"
  if (value.includes("ciahot") || value.includes("cia hot")) return "ciahot"
  return "felizcred"
}

export const COMPANY_LABELS: Record<CompanyId, string> = {
  felizcred: "FelizCred",
  cotacerta: "Cota Certa Seguros",
  ciahot: "Cia Hot",
}

type ChannelContextValue = {
  channels: Channel[]
  current: Channel | null
  // Troca de canal por código (abrir conversa vinda de notificação, Hoje, Pipeline...): se a visão
  // "todas da FelizCred" está ligada e o destino é WhatsApp/Instagram da FelizCred, ela continua.
  setCurrent: (channel: Channel) => void
  // Visão "todas da FelizCred": WhatsApp principal + Campanha CLT + Instagram (e o Site, que abre
  // em tela própria) numa lista só. Escolher um canal específico no menu desliga.
  todos: boolean
  setTodos: (v: boolean) => void
  loading: boolean
}

const ChannelContext = React.createContext<ChannelContextValue | null>(null)

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [numbers, setNumbers] = React.useState<PhoneNumber[]>([])
  const [current, setCurrentRaw] = React.useState<Channel | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [todos, setTodos] = React.useState(true)

  const setCurrent = React.useCallback((channel: Channel) => {
    setCurrentRaw(channel)
    if (!(channel.company === "felizcred" && channel.kind !== "site")) setTodos(false)
  }, [])

  React.useEffect(() => {
    api
      .numbers()
      .then((list) => {
        setNumbers(list)
        if (list.length) setCurrentRaw({ id: list[0].id, label: list[0].label, kind: "whatsapp", company: companyForLabel(list[0].label) })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const channels = React.useMemo<Channel[]>(
    () => [
      ...numbers.map((n) => ({ id: n.id, label: n.label, kind: "whatsapp" as const, company: companyForLabel(n.label) })),
      { id: "instagram", label: "Instagram", kind: "instagram" as const, company: "felizcred" as const },
      { id: "site", label: "Site FelizCred", kind: "site" as const, company: "felizcred" as const },
    ],
    [numbers],
  )

  const value = React.useMemo(
    () => ({ channels, current, setCurrent, todos, setTodos, loading }),
    [channels, current, setCurrent, todos, loading],
  )

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>
}

export function useChannel() {
  const ctx = React.useContext(ChannelContext)
  if (!ctx) throw new Error("useChannel must be used within ChannelProvider")
  return ctx
}
