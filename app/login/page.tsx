"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Moon, Sun } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"
import { useTheme } from "@/components/theme-provider"

function LoginThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card/80 p-2 text-muted-foreground shadow-xs backdrop-blur transition-colors opacity-70"
        aria-label="Alternar tema"
      >
        <Sun className="h-4 w-4" />
      </button>
    )
  }

  const isDark = resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const title = isDark ? "Ativar modo claro" : "Ativar modo escuro"

  return (
    <button
      type="button"
      className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card/80 p-2 text-muted-foreground shadow-xs backdrop-blur transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={title}
      title={title}
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-slate-700" />}
    </button>
  )
}

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
    <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <LoginThemeToggle />

      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] bg-white p-1 shadow-lg ring-1 ring-border/50">
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
                  Raro<span className="text-primary">pay</span>
                </>
              ) : (
                branding.name
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Entre com sua conta RaroNexus para acessar a plataforma.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={startRaroNexusLogin}
            disabled={ssoLoading || checkingNexusSession}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
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
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-primary/30 bg-primary/10 text-primary"
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
        <main className="relative min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
