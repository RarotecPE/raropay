'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/components/auth-provider'
import { DashboardAlerts } from '@/components/dashboard-alerts'
import { MealVoucherManagementCard } from '@/components/meal-voucher-management-card'
import { TransportVoucherManagementCard } from '@/components/transport-voucher-management-card'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Banknote,
  Clock,
  Users,
  FileText,
  CreditCard,
  Wallet,
  Receipt,
  BarChart3,
  History,
  DollarSign,
} from 'lucide-react'

interface FinancialStats {
  // Remessas
  batchesPendingAnalysis: number
  batchesPendingAmount: number
  pendingExpensesCount: number
  batchesInCorrection: number
  batchesApproved: number
  batchesApprovedAmount: number
  approvedExpensesCount: number
  batchesRejected: number
  
  // Pagamentos
  batchesPendingPayment: number
  pendingPaymentAmount: number
  pendingPaymentCount: number
  paidThisMonth: number
  paidThisMonthAmount: number
  
  // Por tipo de pagamento
  reimbursementPending: number
  reimbursementAmount: number
  corporateCardPending: number
  corporateCardAmount: number
  advancePending: number
  advanceAmount: number
  
  // Funcionários
  employeesWithPending: number
  
  // Listas recentes
  recentBatches: Array<{
    id: number
    user_name: string
    status: string
    settlement_type: string
    total_amount: number
    created_at: string
    expense_count: number
  }>
  recentApproved: Array<{
    id: number
    user_name: string
    settlement_type: string
    total_amount: number
    is_paid: boolean
    approved_at: string
  }>
}

const settlementTypeLabels: Record<string, string> = {
  corporate_card: 'Cartão Corporativo',
  reimbursement: 'Reembolso',
  advance: 'Adiantamento',
}

const settlementTypeIcons: Record<string, typeof CreditCard> = {
  corporate_card: CreditCard,
  reimbursement: Wallet,
  advance: Receipt,
}

export default function FinancialDashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/financial/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            Painel Financeiro
          </h1>
          <p className="text-muted-foreground">
            Visão geral das prestações de contas e pagamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/reports">
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatórios
            </Link>
          </Button>
          <Button asChild>
            <Link href="/analysis">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Analisar Remessas
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas do Sistema */}
      <DashboardAlerts />

      {/* Ações Rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/analysis">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Análise de Remessas</p>
                <p className="text-sm text-muted-foreground">
                  {stats?.batchesPendingAnalysis || 0} pendente{(stats?.batchesPendingAnalysis || 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses/approved">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Banknote className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold">Reembolsos a Pagar</p>
                <p className="text-sm text-muted-foreground">
                  {(stats?.batchesPendingPayment || 0) > 0 
                    ? `${stats?.batchesPendingPayment} pendente${(stats?.batchesPendingPayment || 0) !== 1 ? 's' : ''}`
                    : 'Nenhum pendente'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/management/rejected">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-red-500/10">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="font-semibold">Rejeitadas</p>
                <p className="text-sm text-muted-foreground">
                  {stats?.batchesRejected || 0} remessa{(stats?.batchesRejected || 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses/history">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <History className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Histórico</p>
                <p className="text-sm text-muted-foreground">
                  Ver todas despesas
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Cards de Resumo - Análise */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Remessas Aguardando Análise
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {stats?.batchesPendingAnalysis || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(stats?.batchesPendingAmount || 0)} em {stats?.pendingExpensesCount || 0} despesa{(stats?.pendingExpensesCount || 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Em Correção
            </CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {stats?.batchesInCorrection || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Remessas aguardando ajustes
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Remessas Aprovadas (Mês)
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {stats?.batchesApproved || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(stats?.batchesApprovedAmount || 0)} em {stats?.approvedExpensesCount || 0} despesa{(stats?.approvedExpensesCount || 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Remessas Rejeitadas (Mês)
            </CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {stats?.batchesRejected || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Remessas rejeitadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Pagamento - Apenas Reembolsos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Reembolsos a Pagar
            </CardDescription>
            <CardTitle className="text-2xl text-primary">
              {formatCurrency(stats?.pendingPaymentAmount || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats?.pendingPaymentCount || 0} reembolso{(stats?.pendingPaymentCount || 0) !== 1 ? 's' : ''} aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Reembolsos Pagos (Mês)
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {formatCurrency(stats?.paidThisMonthAmount || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {stats?.paidThisMonth || 0} reembolso{(stats?.paidThisMonth || 0) !== 1 ? 's' : ''} pago{(stats?.paidThisMonth || 0) !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Funcionários
            </CardDescription>
            <CardTitle className="text-2xl">
              {stats?.employeesWithPending || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Com remessas pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Acompanhamento de Vales */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <MealVoucherManagementCard />
        <TransportVoucherManagementCard />
      </div>

      {/* Listas lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Remessas Recentes Pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Remessas Pendentes</CardTitle>
              <CardDescription>Aguardando análise</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analysis" className="flex items-center gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recentBatches && stats.recentBatches.length > 0 ? (
              <div className="space-y-3">
                {stats.recentBatches.slice(0, 5).map((batch) => {
                  const SettlementIcon = settlementTypeIcons[batch.settlement_type] || FileText
                  return (
                    <Link
                      key={batch.id}
                      href={`/analysis?batch=${batch.id}`}
                      className="flex flex-col gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          <SettlementIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{batch.user_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {formatDate(batch.created_at)} - {batch.expense_count} despesa{batch.expense_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                        <p className="font-semibold whitespace-nowrap">{formatCurrency(batch.total_amount)}</p>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {settlementTypeLabels[batch.settlement_type] || batch.settlement_type}
                        </Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <Empty>
                <Clock className="w-10 h-10 text-muted-foreground/50" />
                <EmptyTitle>Nenhuma remessa pendente</EmptyTitle>
                <EmptyDescription>
                  Todas as remessas foram analisadas
                </EmptyDescription>
              </Empty>
            )}
          </CardContent>
        </Card>

        {/* Reembolsos Aguardando Pagamento */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Reembolsos Pendentes</CardTitle>
              <CardDescription>Remessas de reembolso aprovadas aguardando pagamento</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/expenses/approved" className="flex items-center gap-1">
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recentApproved && stats.recentApproved.length > 0 ? (
              <div className="space-y-3">
                {stats.recentApproved.slice(0, 5).map((batch) => {
                  const SettlementIcon = settlementTypeIcons[batch.settlement_type] || FileText
                  return (
                    <div
                      key={batch.id}
                      className="flex flex-col gap-2 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                          <SettlementIcon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{batch.user_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            Aprovada em {formatDate(batch.approved_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right">
                        <p className="font-semibold whitespace-nowrap">{formatCurrency(batch.total_amount)}</p>
                        {batch.is_paid ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 text-xs whitespace-nowrap">
                            Pago
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 text-xs whitespace-nowrap">
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty>
                <Banknote className="w-10 h-10 text-muted-foreground/50" />
                <EmptyTitle>Nenhum reembolso pendente</EmptyTitle>
                <EmptyDescription>
                  Todos os reembolsos aprovados foram pagos
                </EmptyDescription>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
