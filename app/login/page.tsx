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

  const [ssoLoading, setSsoLoading] = useState(false)
  const [checkingNexusSession, setCheckingNexusSession] = useState(true)
  const [silentSsoUrl, setSilentSsoUrl] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const popupRef = useRef<Window | null>(null)
  const popupCheckRef = useRef<number | null>(null)

  const stopPopupCheck = () => {
    if (popupCheckRef.current !== null) {
      window.clearInterval(popupCheckRef.current)
      popupCheckRef.current = null
    }
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "raronexus:sso") return

      stopPopupCheck()
      if (event.data.mode !== "silent") {
        setSsoLoading(false)
        popupRef.current = null
      }
      setCheckingNexusSession(false)

      if (event.data.status === "success") {
        window.location.href = event.data.redirectTo || nextPath
        return
      }

      if (event.data.mode !== "silent") {
        setError(event.data.message || "Não foi possível entrar com RaroNexus.")
      }
    }

    async function tryExistingSessions() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null)
        const session = response?.ok ? await response.json().catch(() => null) : null

        if (session?.authenticated) {
          window.location.href = nextPath
          return
        }

        setSilentSsoUrl(
          `/api/auth/raronexus/start?mode=silent&next=${encodeURIComponent(nextPath)}&attempt=${Date.now()}`
        )
        window.setTimeout(() => setCheckingNexusSession(false), 4500)
      } catch {
        setCheckingNexusSession(false)
      }
    }

    window.addEventListener("message", handleMessage)
    void tryExistingSessions()

    return () => {
      window.removeEventListener("message", handleMessage)
      stopPopupCheck()
    }
  }, [nextPath])

  const startRaroNexusLogin = () => {
    setError("")
    setMessage("")
    setSsoLoading(true)

    const popup = window.open(
      `/api/auth/raronexus/start?next=${encodeURIComponent(nextPath)}`,
      "raronexus-login",
      "width=520,height=720,menubar=no,toolbar=no,location=no,status=no"
    )

    if (!popup) {
      setSsoLoading(false)
      setError("Permita popups para entrar com RaroNexus.")
      return
    }

    popupRef.current = popup
    stopPopupCheck()
    popupCheckRef.current = window.setInterval(() => {
      if (!popupRef.current?.closed) return
      stopPopupCheck()
      popupRef.current = null
      setSsoLoading(false)
    }, 500)
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] bg-white p-1 shadow-lg ring-1 ring-white/15">
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {branding.name === "Raropay" ? (
                <>
                  Raro<span className="text-blue-400">pay</span>
                </>
              ) : (
                branding.name
              )}
            </h1>
            <p className="text-sm text-slate-400">
              Entre com sua conta RaroNexus para acessar a plataforma.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <button
            type="button"
            onClick={startRaroNexusLogin}
            disabled={ssoLoading || checkingNexusSession}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <KeyRound className="h-5 w-5" />
            {ssoLoading
              ? "Aguardando RaroNexus..."
              : checkingNexusSession
                ? "Verificando RaroNexus..."
                : "Entrar com RaroNexus"}
          </button>

          {silentSsoUrl ? (
            <iframe title="Verificação RaroNexus" src={silentSsoUrl} className="hidden" />
          ) : null}

          {(message || error) && (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                error
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-300"
              }`}
            >
              {error || message}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
          <p className="text-sm text-slate-300">Carregando...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
