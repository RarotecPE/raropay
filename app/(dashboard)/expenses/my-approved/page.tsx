'use client'

import { useEffect, useState, useMemo } from 'react'
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

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('')
  const [paidFilter, setPaidFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (user) {
      fetchExpenses()
    }
  }, [user])

  async function fetchExpenses() {
    setLoading(true)
    try {
      const response = await fetch('/api/expenses?status=approved')
      const data = await response.json()
      
      if (response.ok && Array.isArray(data)) {
        setExpenses(data)
      } else {
        setExpenses([])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas aprovadas:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // Filtrar despesas
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = searchTerm === '' || 
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCategoryLabel(expense.category).toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
      const matchesSettlementType = settlementTypeFilter === 'all' || expense.expense_type === settlementTypeFilter
      const matchesBatch = batchFilter === '' || 
        (batchFilter === 'none' && !expense.batch_id) ||
        (batchFilter !== 'none' && expense.batch_id?.toString() === batchFilter.replace('#', ''))
      
      const matchesPaid = paidFilter === 'all' ||
        (paidFilter === 'paid' && expense.paid) ||
        (paidFilter === 'unpaid' && !expense.paid)

      // Filtro de data
      const expenseDate = expense.expense_date?.split('T')[0] || ''
      const matchesDateFrom = !startDate || expenseDate >= startDate
      const matchesDateTo = !endDate || expenseDate <= endDate
      
      return matchesSearch && matchesCategory && matchesSettlementType && matchesBatch && matchesPaid && matchesDateFrom && matchesDateTo
    })
  }, [expenses, searchTerm, categoryFilter, settlementTypeFilter, batchFilter, paidFilter, startDate, endDate])

  // Estatísticas
  const stats = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const paidExpenses = filteredExpenses.filter(e => e.paid)
    const unpaidExpenses = filteredExpenses.filter(e => !e.paid)
    const paidAmount = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const unpaidAmount = unpaidExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    const bySettlementType = filteredExpenses.reduce((acc, e) => {
      const type = e.settlement_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: filteredExpenses.length,
      totalAmount,
      paid: paidExpenses.length,
      paidAmount,
      unpaid: unpaidExpenses.length,
      unpaidAmount,
      corporate_card: bySettlementType['corporate_card'] || 0,
      reimbursement: bySettlementType['reimbursement'] || 0,
      advance: bySettlementType['advance'] || 0,
    }
  }, [filteredExpenses])

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setBatchFilter('')
    setPaidFilter('all')
    setStartDate('')
    setEndDate('')
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
    </div>
  )
}
