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
  XCircle,
  Search,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  AlertTriangle,
  Users,
  User
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

type Expense = ExpenseData & {
  rejection_reason?: string
  rejected_at?: string
  user_name?: string
  user_email?: string
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

export default function ManagementRejectedPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])
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
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Verificar permissão
  const canView = user?.role === 'financial' || user?.role === 'admin' || user?.role === 'director'

  const fetchExpenses = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', 'rejected')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      if (searchTerm) params.set('search', searchTerm)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (employeeFilter !== 'all') params.set('user_id', employeeFilter)
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
  }, [canView, page, pageSize, searchTerm, categoryFilter, settlementTypeFilter, employeeFilter, batchFilter, startDate, endDate])

  useEffect(() => {
    if (canView) {
      fetchExpenses()
    }
  }, [canView, fetchExpenses])

  useEffect(() => {
    if (canView) {
      fetchEmployees()
    }
  }, [canView])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, settlementTypeFilter, employeeFilter, batchFilter, startDate, endDate])

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

  // Despesas da página
  const filteredExpenses = expenses

  // Estatísticas
  const stats = useMemo(() => {
    const totalAmount = summaryTotalAmount || filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    const byEmployee = filteredExpenses.reduce((acc, e) => {
      const name = e.user_name || 'Desconhecido'
      acc[name] = (acc[name] || 0) + 1
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
      employeeCount: employees.length || Object.keys(byEmployee).length,
      corporate_card: bySettlementType['corporate_card'] || 0,
      reimbursement: bySettlementType['reimbursement'] || 0,
      advance: bySettlementType['advance'] || 0,
    }
  }, [totalCount, summaryTotalAmount, filteredExpenses, employees.length])

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setEmployeeFilter('all')
    setBatchFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || employeeFilter !== 'all' || batchFilter !== '' || startDate !== '' || endDate !== ''

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Empty
          icon={AlertTriangle}
          title="Acesso Negado"
          description="Você não tem permissão para acessar esta página."
        />
      </div>
    )
  }

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
            Despesas Rejeitadas - Gestão
          </h1>
          <p className="text-muted-foreground">
            Visão geral de todas as despesas rejeitadas no sistema
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

        {/* Funcionários Afetados */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Funcionários</p>
                <p className="text-xl font-bold">{stats.employeeCount}</p>
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

        {/* Cartão Corporativo */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${settlementTypeFilter === 'corporate_card' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSettlementTypeFilter(settlementTypeFilter === 'corporate_card' ? 'all' : 'corporate_card')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cartão Corp.</p>
                <p className="text-xl font-bold">{stats.corporate_card}</p>
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
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Funcionário</Label>
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          icon={XCircle}
          title="Nenhuma despesa rejeitada"
          description={hasActiveFilters 
            ? "Nenhuma despesa corresponde aos filtros selecionados." 
            : "Não há despesas rejeitadas no sistema."
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
              {/* Indicador de funcionário */}
              {expense.user_name && (
                <div className="absolute -top-1 -left-1 z-10">
                  <Badge variant="outline" className="bg-background text-xs">
                    <User className="w-3 h-3 mr-1" />
                    {expense.user_name}
                  </Badge>
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
