"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) {
    return "/dashboard"
  }

  return next
}

function startUrl(nextPath: string) {
  return `/api/auth/raronexus/start?next=${encodeURIComponent(nextPath)}`
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branding = useBranding()
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams])
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const data = await response.json()

        if (!active) return

        if (data.authenticated) {
          router.replace(nextPath)
          return
        }

        window.location.replace(startUrl(nextPath))
      } catch {
        if (!active) return
        setChecking(false)
        setError("Nao foi possivel verificar a sessao. Tente novamente.")
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [nextPath, router])

  function handleLogin() {
    setError("")
    setChecking(true)
    window.location.assign(startUrl(nextPath))
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain"
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal">{branding.name}</h1>
            <p className="text-sm text-slate-300">
              Verificando sua sessao RaroNexus.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <button
            type="button"
            onClick={handleLogin}
            disabled={checking}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <KeyRound className="h-5 w-5" />
            {checking ? "Conectando ao RaroNexus..." : "Entrar com RaroNexus"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <p className="text-sm text-slate-300">Carregando...</p>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
