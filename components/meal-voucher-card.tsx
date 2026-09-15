'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Utensils, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

interface MealVoucherUsage {
  enabled: boolean
  limit: number
  used: number
  available: number
  percentage: number
  month: string
  expenses: Array<{
    id: number
    description: string
    amount: number
    expense_date: string
    status: string
  }>
  history: Array<{
    month: string
    total: number
    count: number
  }>
}

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function formatMonthYear(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return `${monthNames[month - 1]} ${year}`
}

export function MealVoucherCard() {
  const [data, setData] = useState<MealVoucherUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [])

  async function fetchUsage() {
    try {
      const res = await fetch('/api/meal-voucher/usage')
      if (res.ok) {
        const usage = await res.json()
        setData(usage)
      }
    } catch (error) {
      console.error('Erro ao buscar uso do vale-refeição:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Utensils className="h-4 w-4 text-orange-500" />
            Vale-Refeição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || !data.enabled) {
    return null // Não mostra o card se o usuário não tem vale-refeição habilitado
  }

  const progressColor = data.percentage >= 90 ? 'bg-red-500' : 
                        data.percentage >= 75 ? 'bg-amber-500' : 
                        'bg-green-500'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Utensils className="h-4 w-4 text-orange-500" />
          Vale-Refeição
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatMonthYear(data.month)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Valores principais */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Utilizado</span>
            <span className="font-medium">{formatCurrency(data.used)}</span>
          </div>
          <Progress value={data.percentage} className="h-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Disponível</span>
            <span className={`font-medium ${data.available <= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCurrency(data.available)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>Limite mensal</span>
            <span>{formatCurrency(data.limit)}</span>
          </div>
        </div>

        {/* Histórico dos últimos meses */}
        {data.history && data.history.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Histórico
            </p>
            <div className="space-y-1">
              {data.history.map((item) => (
                <div key={item.month} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{formatMonthYear(item.month)}</span>
                  <span>{formatCurrency(parseFloat(String(item.total)))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Últimas despesas */}
        {data.expenses && data.expenses.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Últimos lançamentos</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {data.expenses.slice(0, 3).map((expense) => (
                <div key={expense.id} className="flex justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[120px]">
                    {formatDate(expense.expense_date)}
                  </span>
                  <span>{formatCurrency(parseFloat(String(expense.amount)))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
