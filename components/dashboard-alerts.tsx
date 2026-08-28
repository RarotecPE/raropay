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
        return 'border-red-300 bg-red-50/50'
      case 'medium':
        return 'border-amber-300 bg-amber-50/50'
      default:
        return 'border-blue-300 bg-blue-50/50'
    }
  }

  const getIconBgColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-600'
      case 'medium':
        return 'bg-amber-100 text-amber-600'
      default:
        return 'bg-blue-100 text-blue-600'
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-600" />
          Alertas e Pendências
          <Badge className="bg-amber-500 text-white ml-auto">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColor(alert.priority)}`}
              onClick={() => router.push(alert.url)}
            >
              <div className={`p-2 rounded-lg ${getIconBgColor(alert.priority)}`}>
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground truncate">{alert.description}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {alert.count}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
