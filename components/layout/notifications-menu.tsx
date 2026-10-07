"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Send,
  CreditCard,
  CheckCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "@/lib/notifications"

type HeaderIconButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  title: string
}

const HeaderIconButton = React.forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  ({ children, className, title, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      title={title}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
HeaderIconButton.displayName = "HeaderIconButton"

function getNotificationIcon(type: NotificationItem["type"], badgeVariant?: string) {
  switch (type) {
    case "correction":
      return <AlertCircle className="h-4 w-4 text-amber-500" />
    case "advance_clarification":
      return <Wallet className="h-4 w-4 text-blue-500" />
    case "advance_pending":
      return <Clock className="h-4 w-4 text-amber-500" />
    case "batch_pending":
      return <Send className="h-4 w-4 text-primary" />
    case "invoice_revision":
      return <CreditCard className="h-4 w-4 text-indigo-500" />
    case "advance_status":
    case "batch_status":
      if (badgeVariant === "emerald") {
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      }
      if (badgeVariant === "destructive") {
        return <XCircle className="h-4 w-4 text-destructive" />
      }
      return <Clock className="h-4 w-4 text-primary" />
    default:
      return <Bell className="h-4 w-4 text-primary" />
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return "Agora mesmo"
    if (diffMinutes < 60) return `Há ${diffMinutes} min`
    if (diffHours < 24) return `Há ${diffHours}h`
    if (diffDays === 1) return "Ontem"
    if (diffDays < 7) return `Há ${diffDays} dias`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  } catch {
    return ""
  }
}

export function NotificationsMenu() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  // Armazena IDs conhecidos para não disparar toast duplicado
  const knownIdsRef = useRef<Set<string>>(new Set())
  const isInitialFetchRef = useRef(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
      })

      if (!res.ok) return

      const data = await res.json()
      const newItems: NotificationItem[] = data.notifications || []
      const currentUnread: number = data.unreadCount || 0

      setNotifications(newItems)
      setUnreadCount(currentUnread)

      // Identifica itens novos não lidos para disparar Toast
      if (!isInitialFetchRef.current) {
        const newlyArrived = newItems.filter(
          (item) => !item.isRead && !knownIdsRef.current.has(item.id)
        )

        for (const item of newlyArrived) {
          toast.info(item.title, {
            description: item.message,
            action: {
              label: "Ver",
              onClick: () => router.push(item.link),
            },
          })
        }
      }

      // Atualiza conjunto de IDs conhecidos
      const nextKnown = new Set<string>()
      newItems.forEach((item) => nextKnown.add(item.id))
      knownIdsRef.current = nextKnown
      isInitialFetchRef.current = false
    } catch (err) {
      console.error("[NotificationsMenu] Erro ao carregar:", err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchNotifications()

    // Polling a cada 30 segundos conforme acordado
    const interval = setInterval(fetchNotifications, 30_000)

    // Atualiza ao focar na aba
    const handleFocus = () => fetchNotifications()
    window.addEventListener("focus", handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [fetchNotifications])

  // Marcar item individual como lido
  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead && item.category === "event") {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: item.id }),
        })
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (err) {
        console.error("Erro ao marcar lida:", err)
      }
    }
    setOpen(false)
    router.push(item.link)
  }

  // Marcar item individual informativo como lido sem redirecionar
  const handleMarkOneAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      toast.success("Notificação marcada como lida")
    } catch (err) {
      console.error("Erro ao marcar lida:", err)
      toast.error("Erro ao marcar notificação como lida")
    }
  }

  // Marcar todas como lidas
  const handleMarkAllAsRead = async () => {
    try {
      const currentIds = notifications.map((n) => n.id)
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true, currentIds }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(notifications.filter((n) => n.category === "actionable").length)
      toast.success("Notificações marcadas como lidas")
    } catch {
      toast.error("Erro ao marcar notificações")
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <HeaderIconButton title="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in fade-in zoom-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </HeaderIconButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-lg">
        <DropdownMenuLabel className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {unreadCount} nova{unreadCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {notifications.some((n) => !n.isRead && n.category === "event") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>

        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
            Carregando notificações...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Nenhuma notificação no momento</p>
            <p className="text-xs text-muted-foreground mt-1">
              Você está em dia com todas as suas tarefas e solicitações.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[380px]">
            <div className="divide-y divide-border">
              {notifications.map((item) => {
                const isActionable = item.category === "actionable"

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "group p-3 transition-colors cursor-pointer flex items-start gap-3 hover:bg-muted/50",
                      !item.isRead && "bg-muted/20",
                      isActionable && "bg-amber-500/5 hover:bg-amber-500/10"
                    )}
                  >
                    <div className="mt-0.5 shrink-0 rounded-full p-1.5 bg-background border border-border shadow-2xs">
                      {getNotificationIcon(item.type, item.badgeVariant)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!item.isRead && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground truncate">
                            {item.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4 font-medium",
                            item.badgeVariant === "destructive" &&
                              "border-destructive/30 text-destructive bg-destructive/10",
                            item.badgeVariant === "amber" &&
                              "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
                            item.badgeVariant === "emerald" &&
                              "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                            item.badgeVariant === "blue" &&
                              "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                          )}
                        >
                          {item.badgeText}
                        </Badge>

                        <div className="flex items-center gap-1.5">
                          {!item.isRead && item.category === "event" && (
                            <button
                              type="button"
                              title="Marcar como lida"
                              onClick={(e) => handleMarkOneAsRead(e, item.id)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-background border border-border/60 hover:border-border transition-colors shadow-2xs"
                            >
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Marcar como lida</span>
                            </button>
                          )}

                          <span className="text-[11px] text-primary font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver detalhes <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

