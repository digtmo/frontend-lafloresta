import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AppUser } from '@/types'
import { apiFetch } from '@/lib/api'

interface AuthCtx {
  user:    AppUser | null
  loading: boolean
  login:   (email: string, password: string) => Promise<void>
  logout:  () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('floresta_user')
    const token  = localStorage.getItem('floresta_token')
    if (stored && token) {
      try {
        setUser(JSON.parse(stored) as AppUser)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    })
    localStorage.setItem('floresta_token', data.token)
    localStorage.setItem('floresta_user',  JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('floresta_token')
    localStorage.removeItem('floresta_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
