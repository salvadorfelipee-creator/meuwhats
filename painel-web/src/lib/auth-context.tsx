import * as React from "react"
import { api, isLoggedIn, login as apiLogin, clearCredentials, garantirMediaToken, type Identidade } from "@/lib/api"

type AuthContextValue = {
  authenticated: boolean
  // Quem está logado (nome/usuário/papel/canais) — vem de GET /painel/api/me depois do login.
  // Fica `null` brevemente entre "autenticado" e "identidade carregada" (ex.: logo após F5) —
  // quem lê isso deve tratar esse instante como "ainda carregando", não como deslogado.
  identidade: Identidade | null
  login: (user: string, pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = React.useState(isLoggedIn())
  const [identidade, setIdentidade] = React.useState<Identidade | null>(null)

  const carregarIdentidade = React.useCallback(async () => {
    try {
      setIdentidade(await api.me())
    } catch {
      setIdentidade(null)
    }
  }, [])

  React.useEffect(() => {
    if (authenticated) {
      carregarIdentidade()
      garantirMediaToken()
    } else {
      setIdentidade(null)
    }
  }, [authenticated, carregarIdentidade])

  const login = React.useCallback(async (user: string, pass: string) => {
    await apiLogin(user, pass)
    setAuthenticated(true)
  }, [])

  const logout = React.useCallback(() => {
    clearCredentials()
    setAuthenticated(false)
    setIdentidade(null)
  }, [])

  // Logout forçado às 23h (horário de Brasília) — pra computador sempre ligado no escritório,
  // só o painel fica logado o dia inteiro. Precisa ser um reload de verdade
  // (window.location.reload(), não só trocar a tela por dentro do React) — é isso que garante
  // pegar a versão mais nova do painel sozinho, sem precisar que alguém lembre de dar F5 depois
  // de um deploy. 1 único setTimeout calculado pra próxima ocorrência de 23h (hoje se ainda não
  // passou, amanhã se já passou) — sem polling, custo irrelevante. Só agenda enquanto
  // autenticado: se a pessoa logar de novo às 23h05, por exemplo, o próximo disparo já cai pro
  // dia seguinte, não repete na hora.
  React.useEffect(() => {
    if (!authenticated) return
    const HORA_ALVO_BRT = 23
    const agora = Date.now()
    const brt = agora - 3 * 60 * 60 * 1000
    const d = new Date(brt)
    const alvoBrt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HORA_ALVO_BRT, 0, 0, 0)
    let alvoReal = alvoBrt + 3 * 60 * 60 * 1000
    if (alvoReal <= agora) alvoReal += 24 * 60 * 60 * 1000
    const id = setTimeout(() => {
      clearCredentials()
      window.location.reload()
    }, alvoReal - agora)
    return () => clearTimeout(id)
  }, [authenticated])

  const value = React.useMemo(
    () => ({ authenticated, identidade, login, logout }),
    [authenticated, identidade, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
