"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  AppWindow,
  CheckCircle2,
  ExternalLink,
  Grid2X2,
  Loader2,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  User,
  UserCircle,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getInitials } from "@/lib/format"
import { roleLabels } from "@/lib/types"
import { useAuth } from "@/components/auth-provider"

export type HeaderUser = {
  id?: number
  name: string
  email: string
  avatar_url?: string | null
  role?: string
}

type HeaderApplication = {
  nome: string
  client_id: string
  logo_url: string | null
  homepage_url: string
}

type ApplicationsPayload = {
  applications: HeaderApplication[]
  nexusProfileUrl?: string
}

type HeaderIconButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  title: string
}

const HeaderIconButton = React.forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  ({ children, className, title, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground shadow-xs outline-none transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-cyan-400/45 dark:hover:bg-slate-800 dark:hover:text-white [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      aria-label={title}
      title={title}
      {...props}
    >
      {children}
    </button>
  ),
)
HeaderIconButton.displayName = "HeaderIconButton"

function ApplicationsMenu() {
  const [payload, setPayload] = useState<ApplicationsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/auth/applications", { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar os aplicativos.")
      setPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os aplicativos.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu modal={false} onOpenChange={(open) => { if (open && !payload && !loading) void load() }}>
      <DropdownMenuTrigger asChild>
        <HeaderIconButton title="Aplicativos">
          <Grid2X2 className="h-4 w-4" />
        </HeaderIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <DropdownMenuLabel>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Aplicativos</p>
            <p className="text-xs font-normal text-muted-foreground">Sistemas disponíveis para sua conta</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando aplicativos...
          </div>
        ) : error ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : payload?.applications?.length ? (
          <div className="space-y-1">
            {payload.applications.map((application) => (
              <DropdownMenuItem key={application.client_id} asChild>
                <a
                  href={application.homepage_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white border border-border/50 shadow-xs">
                    {application.logo_url ? (
                      <img src={application.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <AppWindow className="h-4 w-4 text-slate-700" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{application.nome}</span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Nenhum outro aplicativo disponível.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AccountMenu({ user }: { user: HeaderUser }) {
  const { logout: authLogout } = useAuth()
  const [nexusProfileUrl, setNexusProfileUrl] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const role = (user.role && roleLabels[user.role]) || user.role || "Usuário"

  useEffect(() => {
    fetch("/api/auth/applications", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setNexusProfileUrl(data?.nexusProfileUrl || null))
      .catch(() => setNexusProfileUrl(null))
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await authLogout()
    } catch {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      }).catch(() => null)
      window.location.href = "/login"
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Perfil do usuário"
          title="Perfil do usuário"
        >
          <Avatar className="h-9 w-9 bg-secondary">
            {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.name} /> : null}
            <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-secondary">
              {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.name} /> : null}
              <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <div className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          {role}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            Meu Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!nexusProfileUrl}>
          <a
            href={nexusProfileUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Editar perfil
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={loggingOut}
          onClick={handleLogout}
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <HeaderIconButton title="Alternar tema" className="hidden sm:inline-flex opacity-70">
        <Sun className="h-4 w-4" />
      </HeaderIconButton>
    )
  }

  const isDark = resolvedTheme === "dark"
  const nextTheme = isDark ? "light" : "dark"
  const title = isDark ? "Ativar modo claro" : "Ativar modo escuro"

  return (
    <HeaderIconButton
      title={title}
      className="hidden sm:inline-flex"
      onClick={() => setTheme(nextTheme)}
    >
      {isDark ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-slate-700" />}
    </HeaderIconButton>
  )
}

export function DashboardHeaderActions({ user }: { user?: HeaderUser | null }) {
  const { user: authUser } = useAuth()
  const activeUser = user || authUser

  if (!activeUser) {
    return null
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <ApplicationsMenu />
      <AccountMenu user={activeUser} />
    </div>
  )
}

