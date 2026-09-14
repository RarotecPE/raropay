'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/format'
import { Bus, Users, TrendingUp, ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface TransportVoucherUser {
  id: number
  name: string
  department: string | null
  limit: number | null
  used: number
  available: number | null
  transactionsCount: number
  utilizationRate: number | null
}

interface TransportVoucherManagementData {
  currentMonth: {
    month: number
    year: number
    monthName: string
    hasLimits: boolean
    usersCount: number
    totalLimit: number
    totalUsed: number
    totalUsedAll: number
    totalAvailable: number
    avgPerUser: number
    utilizationRate: number
  }
  users: TransportVoucherUser[]
}

export function TransportVoucherManagementCard() {
  const [data, setData] = useState<TransportVoucherManagementData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/transport-voucher/management')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Erro ao buscar dados de vale-transporte:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bus className="h-5 w-5 text-sky-600" />
            Vale-Transporte
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner className="h-6 w-6" />
        </CardContent>
      </Card>
    )
  }

  // Não mostrar se não houver usuários com vale
  if (!data || data.users.length === 0) {
    return null
  }

  // Top 3 funcionários que mais gastaram (a API já ordena por gasto desc)
  const topUsers = data.users.slice(0, 3)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bus className="h-5 w-5 text-sky-600" />
              Vale-Transporte
            </CardTitle>
            <CardDescription>
              {data.currentMonth.monthName.charAt(0).toUpperCase() + data.currentMonth.monthName.slice(1)} {data.currentMonth.year}
            </CardDescription>
          </div>
          <Link href="/financial/transport-voucher">
            <Button variant="outline" size="sm" className="gap-1">
              Ver Detalhes
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
              <Users className="h-3 w-3" />
              Funcionários
            </div>
            <p className="text-xl font-bold">{data.currentMonth.usersCount}</p>
          </div>
          {data.currentMonth.hasLimits ? (
            <>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Utilizado
                </div>
                <p className="text-xl font-bold text-sky-700">{formatCurrency(data.currentMonth.totalUsed)}</p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Disponível</div>
                <p className={`text-xl font-bold ${data.currentMonth.totalAvailable < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(data.currentMonth.totalAvailable)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Total Gasto
                </div>
                <p className="text-xl font-bold text-sky-700">{formatCurrency(data.currentMonth.totalUsedAll)}</p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Média/Func.</div>
                <p className="text-xl font-bold">{formatCurrency(data.currentMonth.avgPerUser)}</p>
              </div>
            </>
          )}
        </div>

        {/* Barra de taxa de utilização (apenas quando há limites definidos) */}
        {data.currentMonth.hasLimits && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Taxa de utilização</span>
              <span className="font-medium">{data.currentMonth.utilizationRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  data.currentMonth.utilizationRate > 90 ? 'bg-red-500' :
                  data.currentMonth.utilizationRate > 75 ? 'bg-amber-500' : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min(100, data.currentMonth.utilizationRate)}%` }}
              />
            </div>
          </div>
        )}

        {/* Top usuários */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Maiores gastos</p>
          <div className="space-y-2">
            {topUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{user.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sky-700 font-mono text-xs">{formatCurrency(user.used)}</span>
                  {user.utilizationRate != null && (
                    <>
                      {user.utilizationRate > 90 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          user.utilizationRate > 90 ? 'border-red-500 text-red-600' :
                          user.utilizationRate > 75 ? 'border-amber-500 text-amber-600' :
                          'border-sky-500 text-sky-700'
                        }`}
                      >
                        {user.utilizationRate}%
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
