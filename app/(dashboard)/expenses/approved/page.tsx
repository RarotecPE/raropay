'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Search, Download, Calendar, User, Banknote, Clock, ChevronDown, ChevronRight, ChevronUp, CreditCard, Wallet, Receipt, FileText, QrCode, Barcode, Copy, Filter, Undo2 } from 'lucide-react'
import { formatCurrency, formatDate, getCategoryLabel } from '@/lib/format'

type Expense = ExpenseData & {
  approved_at?: string
  approved_by?: string
  paid?: boolean
  paid_at?: string
  paid_by?: number
}

interface Batch {
  id: number
  user_id: number
  user_name: string
  user_email: string
  settlement_type: string
  advance_balance: string | null
  advance_balance_amount: number | null
  advance_exceeded: boolean | null
  advance_received_amount: number | null
  advance_received_date: string | null
  refund_method: string | null
  payment_data: {
    barcode: string | null
    pix: string | null
  } | null
  bank_slip_data: {
    bank: string
    beneficiary: string
    barcode: string
    amount: number
    due_date: string
  } | null
  bank_account_data: {
    bank: string
    bank_account: string
    agency: string
    account: string
    pix: string
  } | null
  status: string
  reviewed_at: string | null
  reviewed_by: number | null
  total_amount: number
  expense_count: number
  created_at: string
  updated_at: string
  paid_count?: number
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

export default function ApprovedExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [batchExpenses, setBatchExpenses] = useState<Record<number, ExpenseData[]>>({})
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set())
  const [loadingExpenses, setLoadingExpenses] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [paidFilter, setPaidFilter] = useState('all') // all, paid, unpaid
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set())
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState('batches')
  const [batchPaidFilter, setBatchPaidFilter] = useState('all') // all, paid, unpaid, partial
  const [batchNumberFilter, setBatchNumberFilter] = useState('')
  const [showBatchFilters, setShowBatchFilters] = useState(false)
  const [showExpenseFilters, setShowExpenseFilters] = useState(false)

  const canMarkAsPaid = user?.role === 'admin' || user?.role === 'financial' || user?.role === 'director'
  
  // Estados para desaprovar despesa
  const [showUnapproveDialog, setShowUnapproveDialog] = useState(false)
  const [expenseToUnapprove, setExpenseToUnapprove] = useState<Expense | null>(null)
  const [unapproveReason, setUnapproveReason] = useState('')
  const [isUnapproving, setIsUnapproving] = useState(false)
  
  // Verificar se há filtros ativos (remessas)
  const hasBatchActiveFilters = searchTerm !== '' || batchNumberFilter !== '' || employeeFilter !== 'all' || batchPaidFilter !== 'all'
  
  // Verificar se há filtros ativos (despesas)
  const hasExpenseActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || employeeFilter !== 'all' || paidFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  function clearBatchFilters() {
    setSearchTerm('')
    setBatchNumberFilter('')
    setEmployeeFilter('all')
    setBatchPaidFilter('all')
  }

  function clearExpenseFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setEmployeeFilter('all')
    setPaidFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  // Verificar status de pagamento da remessa baseado nas despesas
  function getBatchPaymentStatus(batch: Batch): 'paid' | 'unpaid' | 'partial' {
    const paidCount = Number(batch.paid_count || 0)
    const expenseCount = Number(batch.expense_count || 0)
    
    if (expenseCount === 0) return 'unpaid'
    if (paidCount === 0) return 'unpaid'
    if (paidCount === expenseCount) return 'paid'
    return 'partial'
  }

  // Marcar remessa inteira como paga
  async function markBatchAsPaid(batchId: number) {
    try {
      setProcessing(true)
      const res = await fetch(`/api/batches/${batchId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (res.ok) {
        toast.success('Remessa marcada como paga')
        fetchBatches()
        // Recarregar despesas da remessa
        const expRes = await fetch(`/api/batches/${batchId}/expenses`)
        if (expRes.ok) {
          const data = await expRes.json()
          setBatchExpenses(prev => ({ ...prev, [batchId]: data }))
        }
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao marcar como paga')
      }
    } catch (error) {
      toast.error('Erro ao marcar como paga')
    } finally {
      setProcessing(false)
    }
  }

  // Marcar remessas selecionadas como pagas
  async function markSelectedBatchesAsPaid() {
    if (selectedBatches.size === 0) return
    
    setProcessing(true)
    let success = 0
    let errors = 0
    
    for (const batchId of selectedBatches) {
      try {
        const res = await fetch(`/api/batches/${batchId}/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) success++
        else errors++
      } catch {
        errors++
      }
    }
    
    if (success > 0) {
      toast.success(`${success} remessa(s) marcada(s) como paga(s)`)
      fetchBatches()
      setSelectedBatches(new Set())
    }
    if (errors > 0) {
      toast.error(`${errors} remessa(s) não puderam ser marcadas`)
    }
    setProcessing(false)
  }

  useEffect(() => {
    fetchExpenses()
    fetchBatches()
    fetchEmployees()
  }, [])

  async function fetchBatches() {
    try {
      const res = await fetch('/api/batches?status=approved')
      if (res.ok) {
        const data = await res.json()
        setBatches(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Erro ao carregar remessas:', error)
    }
  }

  async function loadBatchExpenses(batchId: number) {
    if (batchExpenses[batchId]) return
    
    setLoadingExpenses(prev => new Set(prev).add(batchId))
    try {
      const res = await fetch(`/api/batches/${batchId}/expenses`)
      if (res.ok) {
        const data = await res.json()
        setBatchExpenses(prev => ({ ...prev, [batchId]: data }))
      }
    } catch (error) {
      console.error('Erro ao carregar despesas:', error)
    } finally {
      setLoadingExpenses(prev => {
        const newSet = new Set(prev)
        newSet.delete(batchId)
        return newSet
      })
    }
  }

  function toggleBatchExpand(batchId: number) {
    setExpandedBatches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(batchId)) {
        newSet.delete(batchId)
      } else {
        newSet.add(batchId)
        loadBatchExpenses(batchId)
      }
      return newSet
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência')
  }

  async function fetchExpenses() {
    try {
      setLoading(true)
      const res = await fetch('/api/expenses?status=approved')
      if (res.ok) {
        const data = await res.json()
        setExpenses(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Erro ao carregar despesas:', error)
      toast.error('Erro ao carregar despesas')
    } finally {
      setLoading(false)
    }
  }

  async function fetchEmployees() {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error)
    }
  }

  function toggleExpenseSelection(expenseId: number) {
    setSelectedExpenses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId)
      } else {
        newSet.add(expenseId)
      }
      return newSet
    })
  }

  function selectAllUnpaid() {
    // Apenas seleciona despesas de reembolso não pagas
    const unpaidIds = filteredExpenses
      .filter(e => !e.paid && e.expense_type === 'reimbursement')
      .map(e => e.id)
    setSelectedExpenses(new Set(unpaidIds))
  }

  function deselectAll() {
    setSelectedExpenses(new Set())
  }

  function openUnapproveDialog(expense: Expense) {
    setExpenseToUnapprove(expense)
    setUnapproveReason('')
    setShowUnapproveDialog(true)
  }

  async function handleUnapprove() {
    if (!expenseToUnapprove) return
    if (!unapproveReason.trim()) {
      toast.error('Informe o motivo da desaprovação')
      return
    }

    setIsUnapproving(true)
    try {
      const res = await fetch(`/api/expenses/${expenseToUnapprove.id}/unapprove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unapproveReason.trim() })
      })

      if (res.ok) {
        toast.success('Remessa voltou para análise. A despesa ficará com status pendente.')
        setShowUnapproveDialog(false)
        setExpenseToUnapprove(null)
        setUnapproveReason('')
        fetchExpenses()
        fetchBatches()
      } else {
        const data = await res.json()
        console.error('[v0] Erro ao desaprovar:', data)
        toast.error(data.error || 'Erro ao desaprovar despesa')
      }
    } catch (error) {
      console.error('[v0] Erro ao desaprovar despesa:', error)
      toast.error('Erro ao desaprovar despesa')
    } finally {
      setIsUnapproving(false)
    }
  }

  async function markAsPaid(expenseIds: number[]) {
    if (expenseIds.length === 0) return

    try {
      setProcessing(true)
      const res = await fetch('/api/expenses/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_ids: expenseIds })
      })

      if (res.ok) {
        toast.success(`${expenseIds.length} despesa(s) marcada(s) como paga(s)`)
        setSelectedExpenses(new Set())
        fetchExpenses()
      } else {
        toast.error('Erro ao marcar como pago')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao marcar como pago')
    } finally {
      setProcessing(false)
    }
  }

  async function markAsUnpaid(expenseIds: number[]) {
    if (expenseIds.length === 0) return

    try {
      setProcessing(true)
      const res = await fetch('/api/expenses/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_ids: expenseIds, paid: false })
      })

      if (res.ok) {
        toast.success(`${expenseIds.length} despesa(s) marcada(s) como não paga(s)`)
        setSelectedExpenses(new Set())
        fetchExpenses()
      } else {
        toast.error('Erro ao desmarcar pagamento')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao desmarcar pagamento')
    } finally {
      setProcessing(false)
    }
  }

  // Filtrar despesas
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = searchTerm === '' || 
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCategoryLabel(expense.category).toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
    const matchesEmployee = employeeFilter === 'all' || expense.user_id?.toString() === employeeFilter
    const matchesPaid = paidFilter === 'all' || 
      (paidFilter === 'paid' && expense.paid) || 
      (paidFilter === 'unpaid' && !expense.paid)

    // Filtro de data
    const expenseDate = new Date(expense.expense_date)
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate = dateTo ? new Date(dateTo) : null
    
    const matchesDateFrom = !fromDate || expenseDate >= fromDate
    const matchesDateTo = !toDate || expenseDate <= toDate
    
    return matchesSearch && matchesCategory && matchesEmployee && matchesPaid && matchesDateFrom && matchesDateTo
  })

  // Calcular totais
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const paidAmount = filteredExpenses.filter(e => e.paid).reduce((sum, e) => sum + Number(e.amount), 0)
  const unpaidAmount = filteredExpenses.filter(e => !e.paid).reduce((sum, e) => sum + Number(e.amount), 0)
  const paidCount = filteredExpenses.filter(e => e.paid).length
  // Contar apenas reembolsos não pagos
  const unpaidCount = filteredExpenses.filter(e => !e.paid && e.expense_type === 'reimbursement').length

  // Agrupar por funcionário
  const byEmployee = filteredExpenses.reduce((acc, expense) => {
    const key = expense.user_name || 'Desconhecido'
    if (!acc[key]) acc[key] = { count: 0, amount: 0 }
    acc[key].count++
    acc[key].amount += Number(expense.amount)
    return acc
  }, {} as Record<string, { count: number, amount: number }>)

// Filtrar remessas
  const filteredBatches = batches.filter(batch => {
    const matchesSearch = searchTerm === '' ||
      batch.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Filtro por número da remessa
    const matchesBatchNumber = batchNumberFilter === '' ||
      batch.id.toString().includes(batchNumberFilter) ||
      `#${batch.id}`.includes(batchNumberFilter)
    
    const matchesEmployee = employeeFilter === 'all' || batch.user_id?.toString() === employeeFilter
    
    // Filtrar por status de pagamento
    const paidCount = Number(batch.paid_count || 0)
    const expenseCount = Number(batch.expense_count || 0)
    let paymentStatus: 'paid' | 'unpaid' | 'partial' = 'unpaid'
    if (expenseCount > 0) {
      if (paidCount === 0) paymentStatus = 'unpaid'
      else if (paidCount === expenseCount) paymentStatus = 'paid'
      else paymentStatus = 'partial'
    }
    const matchesPayment = batchPaidFilter === 'all' || batchPaidFilter === paymentStatus
    
    return matchesSearch && matchesBatchNumber && matchesEmployee && matchesPayment
  })

  // Totais das remessas
  const batchesTotalAmount = filteredBatches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)

  function getSettlementTypeLabel(type: string) {
    const labels: Record<string, string> = {
      'reimbursement': 'Reembolso',
      'corporate_card': 'Cartão Corporativo',
      'advance': 'Adiantamento',
    }
    return labels[type] || type
  }

  function getSettlementTypeIcon(type: string) {
    switch (type) {
      case 'reimbursement': return <Wallet className="w-3.5 h-3.5" />
      case 'corporate_card': return <CreditCard className="w-3.5 h-3.5" />
      case 'advance': return <Banknote className="w-3.5 h-3.5" />
      default: return <Receipt className="w-3.5 h-3.5" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando despesas...</p>
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
            Despesas Aprovadas
          </h1>
          <p className="text-muted-foreground">
            Despesas aprovadas pela equipe financeira
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <FileText className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remessas Aprovadas</p>
                <p className="text-2xl font-bold">{batches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Despesas Aprovadas</p>
                <p className="text-2xl font-bold">{expenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-emerald-950/40 rounded-lg">
                <Wallet className="w-5 h-5 text-green-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total (Remessas)</p>
                <p className="text-xl font-bold text-green-600 dark:text-emerald-400">{formatCurrency(batchesTotalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funcionários</p>
                <p className="text-2xl font-bold">{Object.keys(byEmployee).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Remessas ({batches.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Despesas ({expenses.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab de Remessas */}
        <TabsContent value="batches" className="space-y-4 mt-4">
          {/* Filtros Expansíveis para Remessas */}
          <Collapsible open={showBatchFilters} onOpenChange={setShowBatchFilters}>
            <Card>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Filtros</span>
                    {hasBatchActiveFilters && (
                      <Badge variant="secondary" className="text-xs">
                        Ativos
                      </Badge>
                    )}
                  </div>
                  {showBatchFilters ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Nº da Remessa</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Ex: 39 ou #39"
                          value={batchNumberFilter}
                          onChange={(e) => setBatchNumberFilter(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Nome ou email..."
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
                      <Label className="text-sm">Pagamento</Label>
                      <Select value={batchPaidFilter} onValueChange={setBatchPaidFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                          <SelectItem value="unpaid">Pendente</SelectItem>
                          <SelectItem value="partial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {hasBatchActiveFilters && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={clearBatchFilters}>
                        Limpar filtros
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Ações em massa */}
          {canMarkAsPaid && selectedBatches.size > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={markSelectedBatchesAsPaid}
                    disabled={processing}
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    Marcar como Pago ({selectedBatches.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedBatches(new Set())}
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seleção em massa - apenas para remessas de reembolso */}
          {canMarkAsPaid && filteredBatches.filter(b => b.settlement_type === 'reimbursement').length > 0 && (
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const unpaidBatches = filteredBatches
                    .filter(b => b.settlement_type === 'reimbursement' && getBatchPaymentStatus(b) !== 'paid')
                    .map(b => b.id)
                  setSelectedBatches(new Set(unpaidBatches))
                }}
              >
                Selecionar Pendentes ({filteredBatches.filter(b => b.settlement_type === 'reimbursement' && getBatchPaymentStatus(b) !== 'paid').length})
              </Button>
              {selectedBatches.size > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedBatches.size} selecionada(s)
                </span>
              )}
            </div>
          )}

          {filteredBatches.length === 0 ? (
            <Empty>
              <FileText className="h-10 w-10 text-muted-foreground" />
              <EmptyTitle>Nenhuma remessa aprovada</EmptyTitle>
              <EmptyDescription>
                Remessas aprovadas aparecerão aqui
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-4">
              {filteredBatches.map((batch) => {
                const paymentStatus = getBatchPaymentStatus(batch)
                return (
                <Card key={batch.id} className={`overflow-hidden ${paymentStatus === 'paid' ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-green-200 dark:border-green-800'}`}>
                  <div>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="flex items-start sm:items-center gap-2 sm:gap-4 min-w-0 flex-1">
                          {/* Checkbox apenas para remessas de reembolso */}
                          {canMarkAsPaid && batch.settlement_type === 'reimbursement' && (
                            <Checkbox
                              checked={selectedBatches.has(batch.id)}
                              onCheckedChange={(checked) => {
                                setSelectedBatches(prev => {
                                  const newSet = new Set(prev)
                                  if (checked) newSet.add(batch.id)
                                  else newSet.delete(batch.id)
                                  return newSet
                                })
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 mt-2 sm:mt-0"
                            />
                          )}
                          <div 
                            className="flex items-start sm:items-center gap-2 sm:gap-4 cursor-pointer min-w-0 flex-1"
                            onClick={() => toggleBatchExpand(batch.id)}
                          >
                            <div className="p-2 bg-green-100 dark:bg-emerald-950/40 rounded-lg shrink-0">
                              {expandedBatches.has(batch.id) 
                                ? <ChevronDown className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                                : <ChevronRight className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                              }
                            </div>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-1 sm:gap-2">
                                <span className="text-primary font-bold">#{batch.id}</span>
                                <span className="text-muted-foreground hidden sm:inline">-</span>
                                <span className="flex items-center gap-1 truncate">
                                  <User className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{batch.user_name}</span>
                                </span>
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
                        </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg sm:text-2xl font-bold whitespace-nowrap">{formatCurrency(Number(batch.total_amount))}</p>
                            <div className="flex flex-col items-end gap-1 mt-1">
                              <Badge className="bg-green-100 text-green-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Aprovada
                              </Badge>
                              {/* Badges de pagamento apenas para reembolso */}
                              {batch.settlement_type === 'reimbursement' && (
                                <>
                                  {paymentStatus === 'paid' && (
                                    <Badge className="bg-emerald-500 text-white text-xs">
                                      <Banknote className="w-3 h-3 mr-1" />
                                      Pago
                                    </Badge>
                                  )}
                                  {paymentStatus === 'partial' && (
                                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-xs">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pagamento Parcial
                                    </Badge>
                                  )}
                                  {paymentStatus === 'unpaid' && (
                                    <Badge variant="outline" className="border-amber-300 text-amber-600 dark:border-amber-700/60 dark:text-amber-400 text-xs">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Aguardando
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                    {expandedBatches.has(batch.id) && (
                      <CardContent className="border-t pt-4 space-y-4">
                        {/* Dados de Reembolso */}
                        {batch.settlement_type === 'reimbursement' && (
                          <Card className="bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                <Wallet className="w-4 h-4" />
                                Dados para Reembolso
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {batch.payment_data?.barcode && (
                                <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Barcode className="w-5 h-5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs text-muted-foreground">Código de Barras do Boleto</p>
                                      <p className="font-mono text-sm truncate">{batch.payment_data.barcode}</p>
                                    </div>
                                  </div>
                                  <Button size="sm" variant="ghost" className="self-end sm:self-auto shrink-0" onClick={() => copyToClipboard(batch.payment_data?.barcode || '')}>
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                              {batch.payment_data?.pix && (
                                <div className="flex flex-col gap-2 p-3 bg-background rounded-lg border sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <QrCode className="w-5 h-5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs text-muted-foreground">Chave PIX</p>
                                      <p className="font-mono text-sm truncate">{batch.payment_data.pix}</p>
                                    </div>
                                  </div>
                                  <Button size="sm" variant="ghost" className="self-end sm:self-auto shrink-0" onClick={() => copyToClipboard(batch.payment_data?.pix || '')}>
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                              {batch.bank_account_data && (
                                <div className="p-3 bg-background rounded-lg border">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Banknote className="w-4 h-4 text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground font-medium">Dados Bancários</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                    <p className="truncate"><span className="text-muted-foreground">Banco:</span> {batch.bank_account_data.bank}</p>
                                    <p className="truncate"><span className="text-muted-foreground">Agência:</span> {batch.bank_account_data.agency}</p>
                                    <p className="truncate"><span className="text-muted-foreground">Conta:</span> {batch.bank_account_data.account}</p>
                                    {batch.bank_account_data.pix && (
                                      <p className="truncate"><span className="text-muted-foreground">PIX:</span> {batch.bank_account_data.pix}</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Informações de Adiantamento */}
                        {batch.settlement_type === 'advance' && (
                          <Card className="bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                <Banknote className="w-4 h-4" />
                                Informações do Adiantamento
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {batch.advance_received_amount && (
                                  <p><span className="text-muted-foreground">Valor Adiantado:</span> {formatCurrency(batch.advance_received_amount)}</p>
                                )}
                                {batch.advance_balance_amount !== null && (
                                  <p><span className="text-muted-foreground">Saldo:</span> {formatCurrency(batch.advance_balance_amount)}</p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Despesas da Remessa */}
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Receipt className="w-4 h-4" />
                            Despesas ({batch.expense_count})
                          </h4>
                          
                          {loadingExpenses.has(batch.id) ? (
                            <div className="flex items-center justify-center p-8">
                              <Spinner className="w-6 h-6" />
                            </div>
                          ) : batchExpenses[batch.id]?.length ? (
                            <div className="space-y-2">
                              {batchExpenses[batch.id].map(expense => (
                                <div key={expense.id} className="border rounded-lg overflow-hidden">
                                  <ExpenseCard
                                    expense={expense}
                                    showCheckbox={false}
                                    showActions={false}
                                  />
                                  {/* Botão de desaprovar na despesa dentro da remessa - só se está aprovada/processada */}
                                  {canMarkAsPaid && ['approved', 'aprovado', 'processed', 'Processada'].includes(expense.status) && (
                                    <div className="flex justify-end px-4 pb-3 bg-muted/30">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/40 dark:border-amber-800/60"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openUnapproveDialog(expense)
                                        }}
                                      >
                                        <Undo2 className="w-4 h-4 mr-1" />
                                        Desaprovar
                                      </Button>
                                    </div>
                                  )}
                                  {/* Indicador de despesa já em correção */}
                                  {expense.status === 'correction' && (
                                    <div className="flex justify-end px-4 pb-3 bg-amber-50/50 dark:bg-amber-950/30">
                                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        Em correção
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Clique para expandir e ver as despesas
                            </p>
                          )}
                        </div>
                      {/* Botão de marcar como pago - apenas para reembolso */}
                        {canMarkAsPaid && paymentStatus !== 'paid' && batch.settlement_type === 'reimbursement' && (
                          <div className="flex justify-end pt-2 border-t">
                            <Button
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => markBatchAsPaid(batch.id)}
                              disabled={processing}
                            >
                              <Banknote className="w-4 h-4 mr-2" />
                              Marcar Remessa como Paga
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </div>
                </Card>
              )})}
            </div>
          )}
        </TabsContent>

        {/* Tab de Despesas Individuais */}
        <TabsContent value="expenses" className="space-y-4 mt-4">

      {/* Filtros Expansíveis para Despesas */}
      <Collapsible open={showExpenseFilters} onOpenChange={setShowExpenseFilters}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Filtros</span>
                {hasExpenseActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Ativos
                  </Badge>
                )}
              </div>
              {showExpenseFilters ? (
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
                      placeholder="Buscar..."
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
                      <SelectValue />
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
                  <Label className="text-sm">Pagamento</Label>
                  <Select value={paidFilter} onValueChange={setPaidFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pagas</SelectItem>
                      <SelectItem value="unpaid">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Data Fim</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              {hasExpenseActiveFilters && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearExpenseFilters}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Barra de Ações em Lote */}
      {canMarkAsPaid && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllUnpaid}
                  disabled={unpaidCount === 0}
                >
                  Selecionar Pendentes ({unpaidCount})
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={deselectAll}
                  disabled={selectedExpenses.size === 0}
                >
                  Limpar Seleção
                </Button>
                {selectedExpenses.size > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedExpenses.size} selecionada(s)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => markAsPaid(Array.from(selectedExpenses))}
                  disabled={processing || selectedExpenses.size === 0}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {processing ? <Spinner className="w-4 h-4 mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
                  Marcar como Pago
                </Button>
                <Button
                  variant="outline"
                  onClick={() => markAsUnpaid(Array.from(selectedExpenses))}
                  disabled={processing || selectedExpenses.size === 0}
                  size="sm"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Desmarcar Pagamento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Despesas */}
      {filteredExpenses.length === 0 ? (
        <Empty
          icon={CheckCircle2}
          title="Nenhuma despesa aprovada"
          description="Despesas aprovadas no período selecionado aparecerão aqui"
        />
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => (
            <div key={expense.id} className="border rounded-lg overflow-hidden">
              {/* Barra superior com checkbox e status de pagamento */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
                <div className="flex items-center gap-3">
                  {/* Checkbox apenas para despesas de reembolso */}
                  {canMarkAsPaid && expense.expense_type === 'reimbursement' && (
                    <Checkbox
                      checked={selectedExpenses.has(expense.id)}
                      onCheckedChange={() => toggleExpenseSelection(expense.id)}
                    />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {expense.user_name} - {formatDate(expense.expense_date)}
                  </span>
                </div>
                {/* Badge de Pagamento - apenas para reembolso */}
                {expense.expense_type === 'reimbursement' && (
                  <div>
                    {expense.paid ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <Banknote className="w-3 h-3 mr-1" />
                        Pago
                        {expense.paid_at && (
                          <span className="ml-1 text-xs opacity-75">
                            em {formatDate(expense.paid_at)}
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        <Clock className="w-3 h-3 mr-1" />
                        Pagamento Pendente
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {/* Card da despesa */}
              <ExpenseCard
                expense={expense}
                showCheckbox={false}
                showActions={false}
              />
              {/* Botão de desaprovar - só se está aprovada/processada */}
              {canMarkAsPaid && ['approved', 'aprovado', 'processed', 'Processada'].includes(expense.status) && (
                <div className="flex justify-end px-4 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/40 dark:border-amber-800/60"
                    onClick={() => openUnapproveDialog(expense)}
                  >
                    <Undo2 className="w-4 h-4 mr-1" />
                    Desaprovar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Desaprovação */}
      <Dialog open={showUnapproveDialog} onOpenChange={setShowUnapproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desaprovar Despesa</DialogTitle>
            <DialogDescription>
              A despesa será enviada de volta para análise. O funcionário poderá visualizar o motivo e fazer as correções necessárias.
            </DialogDescription>
          </DialogHeader>
          
          {expenseToUnapprove && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{expenseToUnapprove.description}</p>
              <p className="text-muted-foreground">
                {formatCurrency(Number(expenseToUnapprove.amount))} • {formatDate(expenseToUnapprove.expense_date)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="unapprove-reason">Motivo da Desaprovação *</Label>
            <Textarea
              id="unapprove-reason"
              placeholder="Descreva o motivo pelo qual a despesa está sendo desaprovada e o que precisa ser corrigido..."
              value={unapproveReason}
              onChange={(e) => setUnapproveReason(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnapproveDialog(false)}
              disabled={isUnapproving}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnapprove}
              disabled={isUnapproving || !unapproveReason.trim()}
            >
              {isUnapproving ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Desaprovando...
                </>
              ) : (
                <>
                  <Undo2 className="w-4 h-4 mr-2" />
                  Desaprovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
