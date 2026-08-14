import * as React from "react"
import { isLoggedIn, login as apiLogin, clearCredentials } from "@/lib/api"

type AuthContextValue = {
  authenticated: boolean
  login: (user: string, pass: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = React.useState(isLoggedIn())

  const login = React.useCallback(async (user: string, pass: string) => {
    await apiLogin(user, pass)
    setAuthenticated(true)
  }, [])

  const logout = React.useCallback(() => {
    clearCredentials()
    setAuthenticated(false)
  }, [])

  const value = React.useMemo(() => ({ authenticated, login, logout }), [authenticated, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
