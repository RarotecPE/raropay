'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { PaginationControl } from '@/components/pagination-control'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  CreditCard,
  Wallet,
  Receipt,
  Building2,
  Edit3,
  History,
  Send,
  Filter
} from 'lucide-react'
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/format'

interface Batch {
  id: number
  user_id: number
  user_name: string
  user_email: string
  settlement_type: string
  advance_balance: string | null
  advance_balance_amount: number | null
  refund_method: string | null
  bank_slip_data: {
    bank: string
    beneficiary: string
    barcode: string
    amount: number
    due_date: string
  } | null
  observations: string | null
  total_amount: number
  expense_count: number
  status: string
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
}

export default function BatchHistoryPage() {
  const { user } = useAuth()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [summaryTotalAmount, setSummaryTotalAmount] = useState(0)
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    correction: 0,
    approved: 0,
    rejected: 0,
    all: 0,
  })

  // Filtros
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set())
  const [batchExpenses, setBatchExpenses] = useState<Record<number, ExpenseData[]>>({})
  const [loadingExpenses, setLoadingExpenses] = useState<Set<number>>(new Set())

  const fetchBatches = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('user_id', String(user.id))
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchTerm) params.set('search', searchTerm)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/batches?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        if (json.data && json.pagination) {
          setBatches(json.data)
          setTotalPages(json.pagination.totalPages)
          setTotalCount(json.pagination.totalCount)
          setSummaryTotalAmount(Number(json.summary?.totalAmount || 0))
          if (json.summary?.statusCounts) {
            setStatusCounts(json.summary.statusCounts)
          }
        } else if (Array.isArray(json)) {
          setBatches(json)
          setTotalPages(1)
          setTotalCount(json.length)
          setSummaryTotalAmount(json.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar remessas:', error)
      toast.error('Erro ao carregar remessas')
    } finally {
      setLoading(false)
    }
  }, [user?.id, page, pageSize, statusFilter, searchTerm, settlementTypeFilter, startDate, endDate])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, searchTerm, settlementTypeFilter, startDate, endDate])

  async function loadBatchExpenses(batchId: number) {
    if (batchExpenses[batchId]) return

    setLoadingExpenses(prev => new Set(prev).add(batchId))
    try {
      const res = await fetch(`/api/batches/${batchId}`)
      if (res.ok) {
        const data = await res.json()
        setBatchExpenses(prev => ({ ...prev, [batchId]: data.expenses || [] }))
      }
    } catch (error) {
      console.error('Erro ao carregar despesas da remessa:', error)
    } finally {
      setLoadingExpenses(prev => {
        const newSet = new Set(prev)
        newSet.delete(batchId)
        return newSet
      })
    }
  }

  function toggleBatchExpand(batchId: number) {
    const newSet = new Set(expandedBatches)
    if (newSet.has(batchId)) {
      newSet.delete(batchId)
    } else {
      newSet.add(batchId)
      loadBatchExpenses(batchId)
    }
    setExpandedBatches(newSet)
  }

  // Remessas da página (backend já realiza a filtragem)
  const filteredBatches = batches

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm !== '' || settlementTypeFilter !== 'all' || startDate !== '' || endDate !== ''

  function clearFilters() {
    setSearchTerm('')
    setSettlementTypeFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  // Calcular totais
  const totals = useMemo(() => {
    return {
      pending: statusCounts.pending,
      approved: statusCounts.approved,
      rejected: statusCounts.rejected,
      correction: statusCounts.correction,
      totalAmount: summaryTotalAmount || batches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
    }
  }, [statusCounts, summaryTotalAmount, batches])

  function getSettlementTypeIcon(type: string) {
    switch (type) {
      case 'corporate_card':
      case 'cartao_corporativo': return <CreditCard className="w-4 h-4" />
      case 'advance':
      case 'adiantamento': return <Wallet className="w-4 h-4" />
      case 'refund':
      case 'reimbursement':
      case 'reembolso': return <Receipt className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  function getSettlementTypeLabel(type: string) {
    switch (type) {
      case 'corporate_card':
      case 'cartao_corporativo': return 'Cartão Corporativo'
      case 'advance':
      case 'adiantamento': return 'Adiantamento'
      case 'refund':
      case 'reimbursement':
      case 'reembolso': return 'Reembolso'
      case 'mixed':
      case 'misto': return 'Misto'
      default: return type
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50">Em Análise</Badge>
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/50">Aprovada</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>
      case 'correction':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 dark:border dark:border-orange-800/50">Correção Solicitada</Badge>
      case 'analysis':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border dark:border-blue-800/50">Em Análise</Badge>
      case 'submitted':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50">Enviada</Badge>
      case 'processed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border dark:border-blue-800/50">Processada</Badge>
      case 'draft':
        return <Badge variant="outline">Rascunho</Badge>
      default:
        return <Badge variant="outline">{getStatusLabel(status)}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando histórico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-primary" />
          Histórico de Prestações de Contas
        </h1>
        <p className="text-muted-foreground">
          Acompanhe o status das suas remessas enviadas
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        {/* Em Análise */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending' ? 'ring-2 ring-primary bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Análise</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Correção */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'correction' ? 'ring-2 ring-primary bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'correction' ? 'all' : 'correction')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Edit3 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Correção</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{totals.correction}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aprovadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'approved' ? 'ring-2 ring-primary bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totals.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejeitadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'rejected' ? 'ring-2 ring-primary bg-red-50/50 dark:bg-red-950/20' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rejeitadas</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{totals.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Enviadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary bg-primary/5' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Send className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Enviadas</p>
                <p className="text-xl font-bold text-primary">{batches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Total */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Filtros</span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      Filtros ativos
                    </Badge>
                  )}
                </div>
                {showFilters ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Buscar por número */}
                <div className="space-y-2">
                  <Label className="text-sm">Número da Remessa</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Ex: 39 ou #39"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Tipo de Pagamento */}
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Pagamento</Label>
                  <Select value={settlementTypeFilter} onValueChange={setSettlementTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      <SelectItem value="corporate_card">Cartão Corporativo</SelectItem>
                      <SelectItem value="reimbursement">Reembolso</SelectItem>
                      <SelectItem value="advance">Adiantamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início */}
                <div className="space-y-2">
                  <Label className="text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* Data Fim */}
                <div className="space-y-2">
                  <Label className="text-sm">Data Fim</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Lista de Remessas */}
      {filteredBatches.length === 0 ? (
        <Empty>
          <History className="h-10 w-10 text-muted-foreground" />
          <EmptyTitle>Nenhuma prestação de contas encontrada</EmptyTitle>
          <EmptyDescription>
            {hasActiveFilters || statusFilter !== 'all'
              ? "Nenhuma remessa encontrada com os filtros selecionados"
              : "Você ainda não enviou nenhuma prestação de contas"
            }
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filteredBatches.map((batch) => (
            <Card key={batch.id} className="overflow-hidden">
              <Collapsible
                open={expandedBatches.has(batch.id)}
                onOpenChange={() => toggleBatchExpand(batch.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          {expandedBatches.has(batch.id) 
                            ? <ChevronDown className="w-5 h-5 text-primary" />
                            : <ChevronRight className="w-5 h-5 text-primary" />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-1 sm:gap-2">
                            <span>Remessa</span>
                            <span className="text-primary font-bold">#{batch.id}</span>
                            {getStatusBadge(batch.status)}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(batch.created_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              {getSettlementTypeIcon(batch.settlement_type)}
                              <span className="hidden sm:inline">{getSettlementTypeLabel(batch.settlement_type)}</span>
                            </span>
                            <span>{batch.expense_count} despesa(s)</span>
                          </CardDescription>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base sm:text-xl font-bold whitespace-nowrap">{formatCurrency(batch.total_amount)}</p>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="border-t pt-4 space-y-4">
                    {/* Alerta de correção */}
                    {batch.status === 'correction' && batch.rejection_reason && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Edit3 className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-800">Correção Solicitada</p>
                            <p className="text-sm text-orange-700 mt-1">{batch.rejection_reason}</p>
                            <p className="text-xs text-orange-600 mt-2">
                              Por favor, corrija as despesas indicadas e reenvie a prestação de contas.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Motivo de rejeição */}
                    {batch.status === 'rejected' && batch.rejection_reason && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg">
                        <div className="flex items-start gap-3">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-200">Motivo da Rejeição</p>
                            <p className="text-sm text-red-700 dark:text-slate-300 mt-1">{batch.rejection_reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Informações da Remessa */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {batch.advance_balance && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Saldo do Adiantamento</p>
                          <p className="font-medium">
                            {batch.advance_balance === 'positivo' && 'Saldo Positivo (a devolver)'}
                            {batch.advance_balance === 'negativo' && 'Saldo Negativo (a receber)'}
                            {batch.advance_balance === 'zero' && 'Consumido Integralmente'}
                          </p>
                          {batch.advance_balance_amount != null && Number(batch.advance_balance_amount) !== 0 && (
                            <p className={`text-lg font-bold mt-1 ${batch.advance_balance === 'negativo' ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatCurrency(Number(batch.advance_balance_amount))}
                            </p>
                          )}
                        </div>
                      )}

                      {batch.refund_method && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Método de Reembolso</p>
                          <p className="font-medium flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {batch.refund_method === 'conta_bb' ? 'Conta Banco do Brasil' : 'Boleto Bancário'}
                          </p>
                        </div>
                      )}

                      {batch.bank_slip_data && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg md:col-span-2 lg:col-span-1">
                          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">Dados do Boleto</p>
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground dark:text-slate-400">Banco:</span> {batch.bank_slip_data.bank}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Beneficiário:</span> {batch.bank_slip_data.beneficiary}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Valor:</span> {formatCurrency(batch.bank_slip_data.amount)}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Vencimento:</span> {formatDate(batch.bank_slip_data.due_date)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {batch.observations && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Suas Observações</p>
                        <p className="text-sm text-blue-700 dark:text-slate-300 mt-1">{batch.observations}</p>
                      </div>
                    )}

                    {/* Despesas */}
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        Despesas ({batch.expense_count})
                      </h4>
                      
                      {loadingExpenses.has(batch.id) ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner className="w-6 h-6" />
                        </div>
                      ) : batchExpenses[batch.id] ? (
                        <div className="space-y-3">
                          {batchExpenses[batch.id].map((expense) => (
                            <ExpenseCard
                              key={expense.id}
                              expense={expense}
                              showCheckbox={false}
                              showActions={false}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Clique para expandir e ver as despesas
                        </p>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <PaginationControl
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalCount={totalCount}
          pageSizeOptions={[10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          itemName="remessas"
          disabled={loading}
        />
      )}
    </div>
  )
}
