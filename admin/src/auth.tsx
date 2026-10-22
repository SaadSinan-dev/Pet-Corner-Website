import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionExpired, request, save, setToken } from './api'
interface Admin { id: string; email: string; role: string }
const Auth = createContext<{ user: Admin | null; expired: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void } | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Admin | null>(null)
  const [expired, setExpired] = useState(false)
  const client = useQueryClient()
  function logout() { setToken(null); setUser(null); client.clear() }
  useEffect(() => onSessionExpired(() => { setUser(null); setExpired(true); client.clear() }), [client])
  async function login(email: string, password: string) {
    const result = await save<{ accessToken: string }>('/auth/login', { email, password }, 'POST')
    setToken(result.accessToken)
    try { const admin = await request<Admin>('/auth/me'); setUser(admin); setExpired(false) }
    catch (error) { setToken(null); throw error }
  }
  return <Auth.Provider value={{ user, expired, login, logout }}>{children}</Auth.Provider>
}
export function useAuth() { const value = useContext(Auth); if (!value) throw new Error('Auth context missing'); return value }
export function Protected({ children }: { children: ReactNode }) { const { user } = useAuth(); const location = useLocation(); return user ? children : <Navigate to="/login" state={{ from: location.pathname }} replace /> }
