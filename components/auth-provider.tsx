"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { SessionUser } from "@/lib/auth"

interface AuthContextType {
  user: SessionUser | null
  loading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function defaultRedirectForRole(user: SessionUser) {
  if (user.role === "financial") return "/financial/dashboard"
  if (user.role === "admin" || user.role === "director") return "/admin/dashboard"
  return "/dashboard"
}

function loginUrl(pathname: string) {
  const next = pathname && pathname !== "/login" ? pathname : "/dashboard"
  return `/login?next=${encodeURIComponent(next)}`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  async function fetchUser() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      const data = await response.json()

      if (response.status === 401 || !data.authenticated) {
        setUser(null)
        return
      }

      setUser(data.user)
    } catch (error) {
      console.error("Erro ao buscar sessão:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  useEffect(() => {
    if (loading) return

    const publicPaths = ["/login"]
    const isPublicPath = publicPaths.some((path) => pathname.startsWith(path))

    if (!user && !isPublicPath) {
      window.location.replace(loginUrl(pathname))
      return
    }

    if (user && isPublicPath) {
      router.replace(defaultRedirectForRole(user))
    }
  }, [user, loading, pathname, router])

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init)
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (response.status === 401 && url.startsWith("/api/") && !url.startsWith("/api/auth/")) {
        await originalFetch("/api/auth/logout", { method: "POST" })
        setUser(null)
        window.location.replace(loginUrl(window.location.pathname))
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    } finally {
      setUser(null)
      router.replace("/login")
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
    throw new Error("useAuth deve ser usado dentro de um AuthProvider")
  }
  return context
}
