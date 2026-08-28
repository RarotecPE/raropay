'use client'

import { useEffect, useState } from 'react'
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
    if (user) {
      fetchExpenses()
      if (canViewAllEmployees) {
        fetchEmployees()
      }
    }
  }, [user])

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

  async function fetchExpenses() {
    setLoading(true)
    try {
      // A API já filtra por user_id para usuários comuns
      // Admin e financeiro veem todas as despesas automaticamente
      const response = await fetch('/api/expenses')
      const data = await response.json()
      
      if (response.ok && Array.isArray(data)) {
        setExpenses(data)
      } else {
        setExpenses([])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // Filtrar despesas
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = searchTerm === '' || 
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCategoryLabel(expense.category).toLowerCase().includes(searchTerm.toLowerCase())
    
    // Mapear status em português para inglês para comparação
    const statusMap: Record<string, string[]> = {
      'all': [],
      'draft': ['draft'],
      'processed': ['processed'],
      'pending': ['pending', 'enviado', 'submitted'],
      'enviado': ['pending', 'enviado', 'submitted'],
      'approved': ['approved', 'aprovado'],
      'rejected': ['rejected', 'rejeitado'],
      'correction': ['correction'],
    }
    const matchesStatus = statusFilter === 'all' || 
      (statusMap[statusFilter]?.includes(expense.status) ?? expense.status === statusFilter)
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
    const matchesSettlementType = settlementTypeFilter === 'all' || expense.expense_type === settlementTypeFilter
    const matchesBatch = batchFilter === '' || 
      (batchFilter === 'none' && !expense.batch_id) ||
      (batchFilter !== 'none' && expense.batch_id?.toString() === batchFilter.replace('#', ''))
    const matchesEmployee = employeeFilter === 'all' || expense.user_id?.toString() === employeeFilter

    // Filtro de data
    const expenseDate = new Date(expense.expense_date)
    const fromDate = startDate ? new Date(startDate) : null
    const toDate = endDate ? new Date(endDate) : null
    
    const matchesDateFrom = !fromDate || expenseDate >= fromDate
    const matchesDateTo = !toDate || expenseDate <= toDate
    
    return matchesSearch && matchesStatus && matchesCategory && matchesSettlementType && matchesBatch && matchesEmployee && matchesDateFrom && matchesDateTo
  })

  // Estatísticas
  const approvedExpenses = filteredExpenses.filter(e => e.status === 'approved' || e.status === 'aprovado')
  const pendingStatuses = ['pending', 'enviado', 'submitted']
  const pendingExpenses = filteredExpenses.filter(e => pendingStatuses.includes(e.status))
  const stats = {
    total: filteredExpenses.length,
    draft: filteredExpenses.filter(e => e.status === 'draft').length,
    pending: pendingExpenses.length,
    approved: approvedExpenses.length,
    rejected: filteredExpenses.filter(e => e.status === 'rejected' || e.status === 'rejeitado').length,
    correction: filteredExpenses.filter(e => e.status === 'correction').length,
    totalAmount: filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    // Valores por status
    approvedAmount: approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    pendingAmount: pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    // Estatísticas de pagamento (para reembolsos)
    paid: approvedExpenses.filter(e => e.paid).length,
    unpaid: approvedExpenses.filter(e => !e.paid).length,
    paidAmount: approvedExpenses.filter(e => e.paid).reduce((sum, e) => sum + Number(e.amount), 0),
    unpaidAmount: approvedExpenses.filter(e => !e.paid).reduce((sum, e) => sum + Number(e.amount), 0),
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
  }

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || batchFilter !== '' || employeeFilter !== 'all' || startDate !== '' || endDate !== ''

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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(stats.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">{stats.total} despesa(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Rascunhos */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'draft' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
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
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Análise</p>
                <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Aprovadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'approved' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aprovadas</p>
                <p className="text-xl font-bold text-emerald-600">{stats.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Correção */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'correction' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'correction' ? 'all' : 'correction')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Correção</p>
                <p className="text-xl font-bold text-orange-600">{stats.correction}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejeitadas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'rejected' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rejeitadas</p>
                <p className="text-xl font-bold text-red-600">{stats.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Status das Despesas */}
      {(stats.approved > 0 || stats.pending > 0) && (
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50/50 to-sky-50/50 dark:from-blue-950/20 dark:to-sky-950/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Resumo das Suas Despesas</p>
                  <p className="text-xs text-muted-foreground">{stats.total} despesa(s) no total</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Aprovadas</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(stats.approvedAmount)}</p>
                    <p className="text-xs text-muted-foreground">{stats.approved} despesa(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Em Análise</p>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(stats.pendingAmount)}</p>
                    <p className="text-xs text-muted-foreground">{stats.pending} despesa(s)</p>
                  </div>
                </div>
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
                  <Label className="text-sm">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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

                {canViewAllEmployees && (
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
                )}

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
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Lista de Despesas */}
      {filteredExpenses.length === 0 ? (
        <Empty
          icon={History}
          title="Nenhuma despesa encontrada"
          description={hasActiveFilters 
            ? "Nenhuma despesa corresponde aos filtros selecionados." 
            : "Você ainda não possui despesas registradas."
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
    </div>
  )
}
