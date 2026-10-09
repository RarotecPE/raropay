'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { PaginationControl } from '@/components/pagination-control'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency, formatDate, getCategoryLabel } from '@/lib/format'
import {
  XCircle,
  Search,
  Filter,
  Calendar,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  FileText
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Expense = ExpenseData & {
  rejection_reason?: string
  rejected_at?: string
}

const categoryOptions = [
  { value: 'all', label: 'Todas as Categorias' },
  { value: 'accommodation', label: 'Hospedagem' },
  { value: 'food', label: 'Alimentação' },
  { value: 'fuel', label: 'Combustível' },
  { value: 'transport', label: 'Deslocamento' },
  { value: 'parking', label: 'Estacionamento' },
  { value: 'office_supplies', label: 'Itens de Escritório' },
  { value: 'meal_voucher', label: 'Vale-Refeição' },
  { value: 'other', label: 'Outras' },
]

const settlementTypeOptions = [
  { value: 'all', label: 'Todos os Tipos' },
  { value: 'corporate_card', label: 'Cartão Corporativo' },
  { value: 'reimbursement', label: 'Reembolso' },
  { value: 'advance', label: 'Adiantamento' },
]

export default function RejectedExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [summaryTotalAmount, setSummaryTotalAmount] = useState(0)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'rejected')
      params.set('user_id', String(user.id))
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      if (searchTerm) params.set('search', searchTerm)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (batchFilter && batchFilter !== 'all') params.set('batch_id', batchFilter.replace('#', ''))
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/expenses?${params.toString()}`)
      const json = await response.json()

      if (response.ok && json.data && json.pagination) {
        setExpenses(json.data)
        setTotalPages(json.pagination.totalPages)
        setTotalCount(json.pagination.totalCount)
        setSummaryTotalAmount(Number(json.summary?.totalAmount || 0))
      } else if (response.ok && Array.isArray(json)) {
        setExpenses(json)
        setTotalPages(1)
        setTotalCount(json.length)
        setSummaryTotalAmount(json.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0))
      } else {
        setExpenses([])
        setTotalPages(1)
        setTotalCount(0)
        setSummaryTotalAmount(0)
      }
    } catch (error) {
      console.error('Erro ao buscar despesas rejeitadas:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize, searchTerm, categoryFilter, settlementTypeFilter, batchFilter, startDate, endDate])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, settlementTypeFilter, batchFilter, startDate, endDate])

  // Despesas da página
  const filteredExpenses = expenses

  // Estatísticas
  const stats = useMemo(() => {
    const totalAmount = summaryTotalAmount || filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const byCategory = filteredExpenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const bySettlementType = filteredExpenses.reduce((acc, e) => {
      const type = e.expense_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: totalCount,
      totalAmount,
      byCategory,
      bySettlementType,
      corporate_card: bySettlementType['corporate_card'] || 0,
      reimbursement: bySettlementType['reimbursement'] || 0,
      advance: bySettlementType['advance'] || 0,
    }
  }, [totalCount, summaryTotalAmount, filteredExpenses])

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setBatchFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || batchFilter !== '' || startDate !== '' || endDate !== ''

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando despesas rejeitadas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <XCircle className="w-6 h-6 text-destructive" />
            Despesas Rejeitadas
          </h1>
          <p className="text-muted-foreground">
            Despesas que foram rejeitadas pelo financeiro
          </p>
        </div>
        <Button variant="outline" onClick={fetchExpenses}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Mini Painéis de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Rejeitadas */}
        <Card className="col-span-2 bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-destructive/20 rounded-xl">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Rejeitadas</p>
                <p className="text-2xl font-bold text-destructive">{stats.total}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cartão Corporativo */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${settlementTypeFilter === 'corporate_card' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSettlementTypeFilter(settlementTypeFilter === 'corporate_card' ? 'all' : 'corporate_card')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cartão Corp.</p>
                <p className="text-xl font-bold">{stats.corporate_card}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reembolso */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${settlementTypeFilter === 'reimbursement' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSettlementTypeFilter(settlementTypeFilter === 'reimbursement' ? 'all' : 'reimbursement')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reembolso</p>
                <p className="text-xl font-bold">{stats.reimbursement}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adiantamento */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${settlementTypeFilter === 'advance' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSettlementTypeFilter(settlementTypeFilter === 'advance' ? 'all' : 'advance')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Adiantamento</p>
                <p className="text-xl font-bold">{stats.advance}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aviso Informativo */}
      {stats.total > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Atenção</p>
                <p className="text-sm text-muted-foreground">
                  Despesas rejeitadas não podem ser reenviadas. Se você acredita que houve um erro, 
                  entre em contato com o setor financeiro para esclarecimentos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Filtros</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Ativos
                  </Badge>
                )}
              </div>
              {showFilters ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Pagamento</Label>
                  <Select value={settlementTypeFilter} onValueChange={setSettlementTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settlementTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Remessa</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Ex: 39 ou #39"
                      value={batchFilter}
                      onChange={(e) => setBatchFilter(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

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
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Lista de Despesas Rejeitadas */}
      {filteredExpenses.length === 0 ? (
        <Empty
          icon={XCircle}
          title="Nenhuma despesa rejeitada"
          description={hasActiveFilters 
            ? "Nenhuma despesa corresponde aos filtros selecionados." 
            : "Você não possui despesas rejeitadas. Isso é ótimo!"
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              showCheckbox={false}
              showActions={false}
            />
          ))}
        </div>
      )}

      {totalCount > 0 && (
        <PaginationControl
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalCount={totalCount}
          pageSizeOptions={[15, 30, 50]}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          itemName="despesas"
          disabled={loading}
        />
      )}
    </div>
  )
}
