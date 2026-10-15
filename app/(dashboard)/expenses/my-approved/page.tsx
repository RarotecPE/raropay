'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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
import { formatCurrency, getCategoryLabel } from '@/lib/format'
import {
  CheckCircle2,
  Search,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  CreditCard,
  Wallet,
  Banknote,
  Clock
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Expense = ExpenseData & {
  approved_at?: string
  paid?: boolean
  paid_at?: string
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

export default function MyApprovedExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [summaryStats, setSummaryStats] = useState({
    totalAmount: 0,
    paidCount: 0,
    unpaidCount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
  })

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [paidFilter, setPaidFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'approved')
      params.set('user_id', String(user.id))
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      if (searchTerm) params.set('search', searchTerm)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (batchFilter && batchFilter !== 'all') params.set('batch_id', batchFilter.replace('#', ''))
      if (paidFilter !== 'all') params.set('paid', paidFilter)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/expenses?${params.toString()}`)
      const json = await response.json()

      if (response.ok && json.data && json.pagination) {
        setExpenses(json.data)
        setTotalPages(json.pagination.totalPages)
        setTotalCount(json.pagination.totalCount)
        setSummaryStats({
          totalAmount: Number(json.summary?.totalAmount || 0),
          paidCount: Number(json.summary?.paidCount || 0),
          unpaidCount: Number(json.summary?.unpaidCount || 0),
          paidAmount: Number(json.summary?.paidAmount || 0),
          unpaidAmount: Number(json.summary?.unpaidAmount || 0),
        })
      } else if (response.ok && Array.isArray(json)) {
        setExpenses(json)
        setTotalPages(1)
        setTotalCount(json.length)
        const totalAmount = json.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)
        const paidItems = json.filter((e: any) => e.paid)
        const unpaidItems = json.filter((e: any) => !e.paid)
        setSummaryStats({
          totalAmount,
          paidCount: paidItems.length,
          unpaidCount: unpaidItems.length,
          paidAmount: paidItems.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
          unpaidAmount: unpaidItems.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0),
        })
      } else {
        setExpenses([])
        setTotalPages(1)
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Erro ao buscar despesas aprovadas:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [user, page, pageSize, searchTerm, categoryFilter, settlementTypeFilter, batchFilter, paidFilter, startDate, endDate])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, settlementTypeFilter, batchFilter, paidFilter, startDate, endDate])

  // Despesas da página
  const filteredExpenses = expenses

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: totalCount,
      totalAmount: summaryStats.totalAmount,
      paid: summaryStats.paidCount,
      paidAmount: summaryStats.paidAmount,
      unpaid: summaryStats.unpaidCount,
      unpaidAmount: summaryStats.unpaidAmount,
    }
  }, [totalCount, summaryStats])

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setBatchFilter('')
    setPaidFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || batchFilter !== '' || paidFilter !== 'all' || startDate !== '' || endDate !== ''

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando despesas aprovadas...</p>
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
            <CheckCircle2 className="w-6 h-6 text-success" />
            Minhas Despesas Aprovadas
          </h1>
          <p className="text-muted-foreground">
            Acompanhe suas despesas que foram aprovadas pelo financeiro
          </p>
        </div>
        <Button variant="outline" onClick={fetchExpenses}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Mini Painéis de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Aprovadas */}
        <Card className="col-span-2 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-success/20 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Aprovadas</p>
                <p className="text-2xl font-bold text-success">{stats.total}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pagas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${paidFilter === 'paid' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setPaidFilter(paidFilter === 'paid' ? 'all' : 'paid')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Banknote className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagas</p>
                <p className="text-xl font-bold text-green-600">{stats.paid}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aguardando Pagamento */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${paidFilter === 'unpaid' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setPaidFilter(paidFilter === 'unpaid' ? 'all' : 'unpaid')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aguardando</p>
                <p className="text-xl font-bold text-amber-600">{stats.unpaid}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Pendente */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.unpaidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

      {/* Lista de Despesas */}
      {filteredExpenses.length === 0 ? (
        <Empty
          icon={CheckCircle2}
          title="Nenhuma despesa aprovada"
          description={hasActiveFilters 
            ? "Nenhuma despesa corresponde aos filtros selecionados." 
            : "Você ainda não possui despesas aprovadas."
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
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <div key={expense.id} className="relative">
              {/* Indicador de status de pagamento - apenas para reembolso */}
              {expense.expense_type === 'reimbursement' && (
                <div className="absolute -top-1 -right-1 z-10">
                  {expense.paid ? (
                    <Badge className="bg-green-600 text-white text-xs">
                      <Banknote className="w-3 h-3 mr-1" />
                      Pago
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Aguardando Pagamento
                    </Badge>
                  )}
                </div>
              )}
              <ExpenseCard
                expense={expense}
                showCheckbox={false}
                showActions={false}
              />
            </div>
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
