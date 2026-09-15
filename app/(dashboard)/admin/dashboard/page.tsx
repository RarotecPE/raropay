'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/components/auth-provider'
import { DashboardAlerts } from '@/components/dashboard-alerts'
import { MealVoucherManagementCard } from '@/components/meal-voucher-management-card'
import { formatCurrency } from '@/lib/format'
import {
  ArrowRight,
  TrendingUp,
  Clock,
  AlertTriangle,
  FileText,
  PlusCircle,
  Send,
  History,
  FileCheck,
} from 'lucide-react'

interface PersonalStats {
  readyToSend: number
  readyToSendAmount: number
  batchesCorrection: number
  totalApproved: number
  totalAmount: number
  batchesPending: number
  totalDrafts: number
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Buscar stats pessoais (despesas prontas para envio, correções)
        const personalResponse = await fetch('/api/expenses/stats')
        if (personalResponse.ok) {
          const data = await personalResponse.json()
          setPersonalStats({
            readyToSend: data.readyToSend || 0,
            readyToSendAmount: data.readyToSendAmount || 0,
            batchesCorrection: data.batchesCorrection || 0,
            totalApproved: data.totalApproved || 0,
            totalAmount: data.totalAmount || 0,
            batchesPending: data.batchesPending || 0,
            totalDrafts: data.totalDrafts || 0,
          })
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
  
  const hasReadyToSend = (personalStats?.readyToSend || 0) > 0
  const hasCorrection = (personalStats?.batchesCorrection || 0) > 0

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

      {/* Alertas importantes pessoais */}
      {(hasReadyToSend || hasCorrection) && (
        <div className="grid gap-4 md:grid-cols-2">
          {hasReadyToSend && (
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">Despesas prontas para envio</p>
                    <p className="text-sm text-muted-foreground">
                      {personalStats?.readyToSend} despesa{personalStats?.readyToSend !== 1 ? 's' : ''} ({formatCurrency(personalStats?.readyToSendAmount || 0)})
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
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-medium">Remessas aguardando correção</p>
                    <p className="text-sm text-muted-foreground">
                      {personalStats?.batchesCorrection} remessa{personalStats?.batchesCorrection !== 1 ? 's' : ''} precisa{personalStats?.batchesCorrection === 1 ? '' : 'm'} de atenção
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/expenses/corrections">
                    Ver
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quick Actions - igual ao funcionário */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/expenses/new">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <PlusCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Nova Despesa</p>
                <p className="text-sm text-muted-foreground">Registrar lançamento</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses/submitted">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Enviar Prestação</p>
                <p className="text-sm text-muted-foreground">{personalStats?.readyToSend || 0} despesas prontas</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/my-batches">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-slate-500/10">
                <FileText className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-medium">Minhas Remessas</p>
                <p className="text-sm text-muted-foreground">{personalStats?.batchesPending || 0} pendente{(personalStats?.batchesPending || 0) !== 1 ? 's' : ''}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses/history">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors h-full">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-lg bg-slate-500/10">
                <History className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-medium">Histórico</p>
                <p className="text-sm text-muted-foreground">Ver todas despesas</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Estatísticas Pessoais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aprovado Este Mês</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              {loading ? '...' : formatCurrency(personalStats?.totalAmount || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4 mr-1 text-emerald-600 dark:text-emerald-400" />
              {personalStats?.totalApproved || 0} despesa{(personalStats?.totalApproved || 0) !== 1 ? 's' : ''} aprovada{(personalStats?.totalApproved || 0) !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aguardando Análise</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              {loading ? '...' : personalStats?.batchesPending || 0}
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
            <CardTitle className="text-2xl text-blue-600 dark:text-blue-400">
              {loading ? '...' : personalStats?.readyToSend || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <FileCheck className="w-4 h-4 mr-1" />
              {formatCurrency(personalStats?.readyToSendAmount || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rascunhos</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? '...' : personalStats?.totalDrafts || 0}
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

      {/* Card de Gerenciamento de Vale-Refeição */}
      <MealVoucherManagementCard />
    </div>
  )
}
