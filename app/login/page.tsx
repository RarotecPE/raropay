"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) {
    return "/dashboard"
  }

  return next
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branding = useBranding()
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams])
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [silentAttempt, setSilentAttempt] = useState<number | null>(null)
  const popupRef = useRef<Window | null>(null)
  const popupTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null)

  const silentSsoUrl = useMemo(() => {
    if (!silentAttempt) return null
    return `/api/auth/raronexus/start?mode=silent&next=${encodeURIComponent(nextPath)}&attempt=${silentAttempt}`
  }, [nextPath, silentAttempt])

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

        setSilentAttempt(Date.now())
        window.setTimeout(() => {
          if (active) setChecking(false)
        }, 3500)
      } catch {
        if (active) setChecking(false)
      }
    }

    checkSession()

    return () => {
      active = false
    }
  }, [nextPath, router])

  useEffect(() => {
    function clearPopupMonitor() {
      if (popupTimerRef.current) {
        window.clearInterval(popupTimerRef.current)
        popupTimerRef.current = null
      }
      popupRef.current = null
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "raronexus:sso") return

      clearPopupMonitor()

      if (event.data.mode !== "silent") {
        setLoading(false)
      }

      setChecking(false)

      if (event.data.status === "success") {
        router.replace(event.data.redirectTo || nextPath)
        return
      }

      if (event.data.mode !== "silent") {
        setError(event.data.message || "Não foi possível entrar com RaroNexus.")
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
      clearPopupMonitor()
    }
  }, [nextPath, router])

  function handleLogin() {
    setError("")
    setLoading(true)

    const popup = window.open(
      `/api/auth/raronexus/start?next=${encodeURIComponent(nextPath)}`,
      "raronexus-login",
      "width=520,height=720,menubar=no,toolbar=no,location=no,status=no"
    )

    if (!popup) {
      setLoading(false)
      setError("Permita popups para entrar com RaroNexus.")
      return
    }

    popupRef.current = popup
    popup.focus()

    popupTimerRef.current = window.setInterval(() => {
      if (popup.closed) {
        if (popupTimerRef.current) {
          window.clearInterval(popupTimerRef.current)
          popupTimerRef.current = null
        }
        popupRef.current = null
        setLoading(false)
      }
    }, 500)
  }

  const buttonText = checking
    ? "Verificando RaroNexus..."
    : loading
      ? "Aguardando RaroNexus..."
      : "Entrar com RaroNexus"

  return (
    <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      {checking && silentSsoUrl && <iframe title="Verificacao RaroNexus" src={silentSsoUrl} className="hidden" />}

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
              Entre com sua conta RaroNexus para acessar a plataforma.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <button
            type="button"
            onClick={handleLogin}
            disabled={checking || loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <KeyRound className="h-5 w-5" />
            {buttonText}
          </button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}

          {checking && (
            <p className="mt-4 text-center text-sm text-slate-400">Carregando...</p>
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
