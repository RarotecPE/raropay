'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { SessionUser } from '@/lib/auth'

interface AuthContextType {
  user: SessionUser | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  async function fetchUser() {
    try {
      const response = await fetch('/api/auth/session')
      const data = await response.json()
      setUser(data.user)
    } catch (error) {
      console.error('Erro ao buscar sessão:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/login', '/register']
      const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
      
      if (!user && !isPublicPath) {
        router.push('/login')
      } else if (user && isPublicPath) {
        // Redirecionar para dashboard específico baseado no role
        let redirectUrl = '/dashboard'
        if (user.role === 'financial') {
          redirectUrl = '/financial/dashboard'
        } else if (user.role === 'admin' || user.role === 'director') {
          redirectUrl = '/admin/dashboard'
        }
        router.push(redirectUrl)
      }
    }
  }, [user, loading, pathname, router])

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  async function refreshUser() {
    await fetchUser()
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
