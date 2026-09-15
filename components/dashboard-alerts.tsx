"use client"

import useSWR from "swr"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  AlertTriangle, 
  MessageSquare, 
  FileText, 
  ChevronRight,
  Bell
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Alert {
  type: string
  title: string
  description: string
  count: number
  url: string
  priority: 'high' | 'medium' | 'low'
}

export function DashboardAlerts() {
  const router = useRouter()
  const { data: alerts, isLoading } = useSWR<Alert[]>("/api/alerts", fetcher, {
    refreshInterval: 60000 // Atualizar a cada minuto
  })

  if (isLoading || !alerts || !Array.isArray(alerts) || alerts.length === 0) {
    return null
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'analysis_request':
      case 'analysis_pending':
      case 'analysis_response':
      case 'analysis_message':
        return <MessageSquare className="w-5 h-5" />
      case 'correction_pending':
      case 'corrections_pending':
        return <AlertTriangle className="w-5 h-5" />
      case 'batches_pending':
      case 'batch_rejected':
        return <FileText className="w-5 h-5" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border border-destructive/30 bg-destructive/10 hover:bg-destructive/15 dark:border-destructive/40 dark:bg-destructive/15 dark:hover:bg-destructive/25'
      case 'medium':
        return 'border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 dark:border-amber-500/40 dark:bg-amber-950/40 dark:hover:bg-amber-950/60'
      default:
        return 'border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 dark:border-blue-500/40 dark:bg-blue-950/40 dark:hover:bg-blue-950/60'
    }
  }

  const getIconBgColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-red-300'
      case 'medium':
        return 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300'
      default:
        return 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300'
    }
  }

  return (
    <Card className="border-amber-500/25 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold">Alertas e Pendências</span>
          <Badge className="bg-amber-500 text-white dark:bg-amber-500 dark:text-slate-950 font-bold ml-auto">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${getPriorityColor(alert.priority)}`}
              onClick={() => router.push(alert.url)}
            >
              <div className={`p-2 rounded-lg shrink-0 ${getIconBgColor(alert.priority)}`}>
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground dark:text-slate-300 truncate">{alert.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0 border-border/80 bg-background/60 text-foreground font-semibold">
                {alert.count}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground dark:text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
