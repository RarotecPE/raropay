'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth-provider'
import { DashboardAlerts } from '@/components/dashboard-alerts'
import { MealVoucherCard } from '@/components/meal-voucher-card'
import { MealVoucherManagementCard } from '@/components/meal-voucher-management-card'
import { formatCurrency, formatDate } from '@/lib/format'
import { statusLabels, categoryLabels, type Expense } from '@/lib/types'
import {
  PlusCircle,
  FileText,
  History,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight,
  TrendingUp,
  Send,
  AlertTriangle,
  FileCheck,
  BarChart3,
  Package,
  CreditCard,
  Users,
} from 'lucide-react'

interface BatchSummary {
  id: number
  status: string
  settlement_type: string
  total_amount: number
  created_at: string
  expense_count: number
}

interface DashboardStats {
  totalDrafts: number
  totalPending: number
  totalApproved: number
  totalRejected: number
  totalCorrection: number
  readyToSend: number
  readyToSendAmount: number
  totalAmount: number
  batchesPending: number
  batchesApproved: number
  batchesCorrection: number
  pendingBatchesForAnalysis: number
  pendingBatchesAmount: number
  isFinanceiro: boolean
  recentExpenses: Expense[]
  recentBatches: BatchSummary[]
}

const statusIcons: Record<string, typeof FileText> = {
  draft: FileText,
  processed: FileCheck,
  submitted: Clock,
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  correction: AlertTriangle,
  analysis: Clock,
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  processed: 'bg-blue-500/10 text-blue-600',
  submitted: 'bg-amber-500/10 text-amber-600',
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-600',
  rejected: 'bg-red-500/10 text-red-600',
  correction: 'bg-orange-500/10 text-orange-600',
  analysis: 'bg-primary/10 text-primary',
}

const batchStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  correction: 'Em Correção',
}

const settlementTypeLabels: Record<string, string> = {
  corporate_card: 'Cartão Corporativo',
  reimbursement: 'Reembolso',
  advance: 'Adiantamento',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Redirecionar admin/director/financial para seus dashboards específicos
  useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'director') {
        router.replace('/admin/dashboard')
        return
      }
      if (user.role === 'financial') {
        router.replace('/financial/dashboard')
        return
      }
    }
  }, [user, router])

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/expenses/stats')
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

  const hasReadyToSend = (stats?.readyToSend || 0) > 0
  const hasCorrection = (stats?.batchesCorrection || 0) > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            Olá, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao Raropay
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Despesa
          </Link>
        </Button>
      </div>

      {/* Alertas do Sistema */}
      <DashboardAlerts />

      {/* Alertas importantes */}
      {(hasReadyToSend || hasCorrection) && (
        <div className="grid gap-4 md:grid-cols-2">
          {hasReadyToSend && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Send className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Despesas prontas para envio</p>
                    <p className="text-sm text-muted-foreground">
                      {stats?.readyToSend} despesa{stats?.readyToSend !== 1 ? 's' : ''} ({formatCurrency(stats?.readyToSendAmount || 0)})
                    </p>
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href="/expenses/submitted">
                    Enviar
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          
          {hasCorrection && (
            <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Remessas aguardando correção</p>
                    <p className="text-sm text-muted-foreground">
                      {stats?.batchesCorrection} remessa{stats?.batchesCorrection !== 1 ? 's' : ''} precisa{stats?.batchesCorrection !== 1 ? 'm' : ''} de atenção
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/expenses/batches">
                    Ver
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Card especial para Financeiro */}
      {stats?.isFinanceiro && stats.pendingBatchesForAnalysis > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Remessas aguardando análise</p>
                <p className="text-sm text-muted-foreground">
                  {stats.pendingBatchesForAnalysis} remessa{stats.pendingBatchesForAnalysis !== 1 ? 's' : ''} pendente{stats.pendingBatchesForAnalysis !== 1 ? 's' : ''} ({formatCurrency(stats.pendingBatchesAmount)})
                </p>
              </div>
            </div>
            <Button size="sm" asChild>
              <Link href="/analysis">
                Analisar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Ações Rápidas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/expenses/new">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary">
                  <PlusCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Nova Despesa</CardTitle>
                  <CardDescription className="text-sm">Registrar lançamento</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/expenses/submitted">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Send className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Enviar Prestação</CardTitle>
                  <CardDescription className="text-sm">
                    {stats?.readyToSend || 0} despesa{(stats?.readyToSend || 0) !== 1 ? 's' : ''} pronta{(stats?.readyToSend || 0) !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/expenses/batches">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Minhas Remessas</CardTitle>
                  <CardDescription className="text-sm">
                    {stats?.batchesPending || 0} pendente{(stats?.batchesPending || 0) !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/expenses/history">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <History className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Histórico</CardTitle>
                  <CardDescription className="text-sm">Ver todas despesas</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aprovado Este Mês</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">
              {loading ? '...' : formatCurrency(stats?.totalAmount || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4 mr-1 text-emerald-600" />
              {stats?.totalApproved || 0} despesa{(stats?.totalApproved || 0) !== 1 ? 's' : ''} aprovada{(stats?.totalApproved || 0) !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando Análise</CardDescription>
            <CardTitle className="text-2xl text-amber-600">
              {loading ? '...' : stats?.batchesPending || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="w-4 h-4 mr-1" />
              Remessas enviadas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prontas para Envio</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {loading ? '...' : stats?.readyToSend || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <FileCheck className="w-4 h-4 mr-1" />
              {formatCurrency(stats?.readyToSendAmount || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rascunhos</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? '...' : stats?.totalDrafts || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <FileText className="w-4 h-4 mr-1" />
              Não processadas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de Vale-Refeição */}
      {/* Gestores veem o card de gerenciamento com dados de todos, funcionários veem só seus dados */}
      {user?.role === 'manager' ? (
        <MealVoucherManagementCard />
      ) : (
        <MealVoucherCard />
      )}

      {/* Duas colunas: Despesas Recentes + Remessas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Despesas Recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Despesas Recentes</CardTitle>
              <CardDescription>Últimos lançamentos</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/expenses/history">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : !stats?.recentExpenses?.length ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma despesa registrada</p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/expenses/new">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Criar despesa
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentExpenses.slice(0, 4).map((expense) => {
                  const StatusIcon = statusIcons[expense.status] || FileText
                  const statusColor = statusColors[expense.status] || 'bg-muted text-muted-foreground'
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${statusColor}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">
                            {categoryLabels[expense.category]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(expense.expense_date)}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold whitespace-nowrap text-sm">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Minhas Remessas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Minhas Remessas</CardTitle>
              <CardDescription>Prestações de contas enviadas</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/expenses/batches">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : !stats?.recentBatches?.length ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma remessa enviada</p>
                {(stats?.readyToSend || 0) > 0 && (
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/expenses/submitted">
                      <Send className="w-4 h-4 mr-2" />
                      Enviar prestação
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentBatches.map((batch) => {
                  const statusColor = statusColors[batch.status] || 'bg-muted text-muted-foreground'
                  return (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${statusColor}`}>
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">
                            {settlementTypeLabels[batch.settlement_type] || batch.settlement_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(batch.created_at)} • {batch.expense_count} despesa{batch.expense_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold whitespace-nowrap text-sm">
                          {formatCurrency(batch.total_amount)}
                        </span>
                        <Badge variant="outline" className={`text-xs ${statusColor}`}>
                          {batchStatusLabels[batch.status] || batch.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Links rápidos para financeiro */}
      {stats?.isFinanceiro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Área Financeira</CardTitle>
            <CardDescription>Acesso rápido às ferramentas de gestão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/analysis">
                  <Package className="w-4 h-4 mr-2" />
                  Analisar Remessas
                  {stats.pendingBatchesForAnalysis > 0 && (
                    <Badge className="ml-auto">{stats.pendingBatchesForAnalysis}</Badge>
                  )}
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/reports">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Relatórios
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/users">
                  <Users className="w-4 h-4 mr-2" />
                  Usuários
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
