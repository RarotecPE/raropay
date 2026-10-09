'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { categoryLabels, type ExpenseCategory } from '@/lib/types'
import {
  History,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  CreditCard,
  RefreshCw,
  Wallet,
  User,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Expense = ExpenseData & {
  paid?: boolean
  paid_at?: string
  user_id?: number
}

const statusOptions = [
  { value: 'all', label: 'Todos os Status', icon: Filter },
  { value: 'draft', label: 'Rascunho', icon: FileText },
  { value: 'processed', label: 'Processada', icon: FileText },
  { value: 'pending', label: 'Em Análise', icon: Clock },
  { value: 'enviado', label: 'Enviado', icon: Clock },
  { value: 'approved', label: 'Aprovada', icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejeitada', icon: XCircle },
  { value: 'correction', label: 'Correção', icon: AlertCircle },
]

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

export default function HistoryPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [summaryTotalAmount, setSummaryTotalAmount] = useState(0)

  // Estatísticas globais
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    correction: 0,
    totalAmount: 0,
  })

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])

  // Verificar se usuário pode ver todos os funcionários
  const canViewAllEmployees = user?.role === 'admin' || user?.role === 'financial' || user?.role === 'director'

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/expenses/stats')
        if (res.ok) {
          const data = await res.json()
          setStats({
            total:
              (data.totalDrafts || 0) +
              (data.totalPending || 0) +
              (data.totalApproved || 0) +
              (data.totalRejected || 0) +
              (data.totalCorrection || 0),
            draft: data.totalDrafts || 0,
            pending: data.totalPending || 0,
            approved: data.totalApproved || 0,
            rejected: data.totalRejected || 0,
            correction: data.totalCorrection || 0,
            totalAmount: Number(data.totalAmount || 0),
          })
        }
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err)
      }
    }
    loadStats()
  }, [])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))

      if (searchTerm) params.set('search', searchTerm)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (batchFilter && batchFilter !== 'all') {
        params.set('batch_id', batchFilter.replace('#', ''))
      }
      if (employeeFilter !== 'all') params.set('user_id', employeeFilter)
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
      console.error('Erro ao buscar despesas:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [
    currentPage,
    pageSize,
    searchTerm,
    statusFilter,
    categoryFilter,
    settlementTypeFilter,
    batchFilter,
    employeeFilter,
    startDate,
    endDate,
  ])

  useEffect(() => {
    if (user) {
      fetchExpenses()
      if (canViewAllEmployees && employees.length === 0) {
        fetchEmployees()
      }
    }
  }, [user, fetchExpenses, canViewAllEmployees, employees.length])

  async function fetchEmployees() {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setEmployees(data.map((u: { id: number; name: string }) => ({ id: u.id, name: u.name })))
      }
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error)
    }
  }

  function handleFilterChange(setter: (value: any) => void, value: any) {
    setter(value)
    setCurrentPage(1)
  }

  function clearFilters() {
    setSearchTerm('')
    setStatusFilter('all')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setBatchFilter('')
    setEmployeeFilter('all')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    settlementTypeFilter !== 'all' ||
    batchFilter !== '' ||
    employeeFilter !== 'all' ||
    startDate !== '' ||
    endDate !== ''

  if (loading && expenses.length === 0) {
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Histórico de Despesas
          </h1>
          <p className="text-muted-foreground">
            Todas as suas despesas registradas no sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Despesa
          </Link>
        </Button>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {/* Total - Card maior e destacado */}
        <Card className="col-span-2 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-xl">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {hasActiveFilters ? 'Total Filtrado' : 'Total'}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(hasActiveFilters ? summaryTotalAmount : stats.totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters ? totalCount : stats.total} despesa(s)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Rascunhos */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'draft' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'draft' ? 'all' : 'draft')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rascunhos</p>
                <p className="text-xl font-bold">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Em Análise */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pending' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Análise</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Aprovadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'approved' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'approved' ? 'all' : 'approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Correção */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'correction' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'correction' ? 'all' : 'correction')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Correção</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.correction}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejeitadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'rejected' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'rejected' ? 'all' : 'rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rejeitadas</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
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
                      placeholder="Buscar descrição ou funcionário..."
                      value={searchTerm}
                      onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => handleFilterChange(setStatusFilter, val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Categoria</Label>
                  <Select
                    value={categoryFilter}
                    onValueChange={(val) => handleFilterChange(setCategoryFilter, val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tipo de Pagamento</Label>
                  <Select
                    value={settlementTypeFilter}
                    onValueChange={(val) => handleFilterChange(setSettlementTypeFilter, val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settlementTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
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
                      onChange={(e) => handleFilterChange(setBatchFilter, e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {canViewAllEmployees && (
                  <div className="space-y-2">
                    <Label className="text-sm">Funcionário</Label>
                    <Select
                      value={employeeFilter}
                      onValueChange={(val) => handleFilterChange(setEmployeeFilter, val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data Fim</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Lista de Despesas */}
      {expenses.length === 0 ? (
        <Empty
          icon={History}
          title="Nenhuma despesa encontrada"
          description={
            hasActiveFilters
              ? 'Nenhuma despesa corresponde aos filtros selecionados.'
              : 'Você ainda não possui despesas registradas.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            ) : (
              <Button asChild>
                <Link href="/expenses/new">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Criar Nova Despesa
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              showCheckbox={false}
              showActions={false}
            />
          ))}

          {/* Paginação */}
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            pageSizeOptions={[15, 30, 50]}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setCurrentPage(1)
            }}
            itemName="despesas"
            disabled={loading}
          />
        </div>
      )}
    </div>
  )
}
