'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Empty } from '@/components/ui/empty'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { Send, Search, Clock, CheckCircle2, CreditCard, Wallet, Receipt, Building2, FileText, AlertCircle, Check, X, Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatCurrency, getCategoryLabel, getExpenseTypeLabel } from '@/lib/format'

type Expense = ExpenseData

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

export default function ProcessedExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [settlementTypeFilter, setSettlementTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || startDate !== '' || endDate !== ''

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setStartDate('')
    setEndDate('')
  }
  
  // Estado do modal de envio
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sending, setSending] = useState(false)
  
  // Estados do formulário de envio
  const [advanceBalance, setAdvanceBalance] = useState<string>('')
  const [balanceAmount, setBalanceAmount] = useState<string>('')
  const [refundMethod, setRefundMethod] = useState<string>('')
  const [observations, setObservations] = useState('')
  const [advanceExceeded, setAdvanceExceeded] = useState<boolean | null>(null)
  
  // Dados do adiantamento recebido
  const [advanceReceivedAmount, setAdvanceReceivedAmount] = useState('')
  const [advanceReceivedDate, setAdvanceReceivedDate] = useState('')
  
  // Dados de pagamento (código de barras e PIX)
  const [paymentBarcode, setPaymentBarcode] = useState('')
  const [paymentPix, setPaymentPix] = useState('')
  
  // Dados do boleto (legado - manter para compatibilidade)
  const [boletoBank, setBoletoBank] = useState('')
  const [boletoBeneficiary, setBoletoBeneficiary] = useState('')
  const [boletoBarcode, setBoletoBarcode] = useState('')
  const [boletoAmount, setBoletoAmount] = useState('')
  const [boletoDueDate, setBoletoDueDate] = useState('')
  
  // Estado de exclusão
  const [deleting, setDeleting] = useState<number | null>(null)

  async function handleDeleteExpense(id: number) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Despesa excluída com sucesso')
        // Remover dos selecionados se estava selecionada
        setSelectedIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(id)
          return newSet
        })
        fetchExpenses()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao excluir despesa')
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
      toast.error('Erro ao excluir despesa')
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    fetchExpenses()
  }, [user?.id])

  async function fetchExpenses() {
    if (!user?.id) return
    try {
      setLoading(true)
      // Buscar despesas com status "processed" (prontas para envio)
      const res = await fetch(`/api/expenses?status=processed&user_id=${user.id}`)
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

  // Filtrar despesas
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = searchTerm === '' || 
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCategoryLabel(expense.category).toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
      const matchesSettlementType = settlementTypeFilter === 'all' || expense.expense_type === settlementTypeFilter
      
      // Filtro de data
      const expenseDate = expense.expense_date?.split('T')[0] || ''
      const matchesDateFrom = !startDate || expenseDate >= startDate
      const matchesDateTo = !endDate || expenseDate <= endDate
      
      return matchesSearch && matchesCategory && matchesSettlementType && matchesDateFrom && matchesDateTo
    })
  }, [expenses, searchTerm, categoryFilter, settlementTypeFilter, startDate, endDate])

  // Despesas selecionadas
  const selectedExpenses = useMemo(() => {
    return expenses.filter(e => selectedIds.has(e.id))
  }, [expenses, selectedIds])

  // Análise dos tipos de despesas selecionadas
  const expenseAnalysis = useMemo(() => {
    const types = selectedExpenses.map(e => e.expense_type)
    const hasCartao = types.includes('cartao_corporativo') || types.includes('corporate_card')
    const hasAdiantamento = types.includes('adiantamento') || types.includes('advance')
    const hasReembolso = types.includes('reembolso') || types.includes('refund') || types.includes('reimbursement')
    const total = selectedExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    
    // Se tem reembolso mas não tem adiantamento, precisa mostrar dados de pagamento
    const needsPaymentInfo = hasReembolso && !hasAdiantamento
    
    return { hasCartao, hasAdiantamento, hasReembolso, total, types: [...new Set(types)], needsPaymentInfo }
  }, [selectedExpenses])

  // Calcular totais
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const selectedTotal = selectedExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  function selectAll() {
    if (selectedIds.size === filteredExpenses.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredExpenses.map(e => e.id)))
    }
  }

  function openSendModal() {
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos uma despesa')
      return
    }
    // Reset form
    setAdvanceBalance('')
    setBalanceAmount('')
    setRefundMethod('')
    setObservations('')
    setAdvanceExceeded(null)
    setAdvanceReceivedAmount('')
    setAdvanceReceivedDate('')
    setPaymentBarcode('')
    setPaymentPix('')
    setBoletoBank('')
    setBoletoBeneficiary('')
    setBoletoBarcode('')
    setBoletoAmount('')
    setBoletoDueDate('')
    setSendModalOpen(true)
  }

  async function handleSendBatch() {
    try {
      setSending(true)

      // Sem validações obrigatórias para dados de pagamento

      // Montar dados de pagamento se informados
      const paymentData = (paymentBarcode || paymentPix) ? {
        barcode: paymentBarcode || null,
        pix: paymentPix || null,
      } : null

      // Criar a remessa
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          expense_ids: Array.from(selectedIds),
          settlement_type: expenseAnalysis.types.length === 1 ? expenseAnalysis.types[0] : 'misto',
          advance_balance: advanceBalance || null,
          advance_exceeded: advanceExceeded,
          advance_received_amount: advanceReceivedAmount ? parseFloat(advanceReceivedAmount.replace(/[^\d,]/g, '').replace(',', '.')) : null,
          advance_received_date: advanceReceivedDate || null,
          balance_amount: balanceAmount ? parseFloat(balanceAmount.replace(/[^\d,]/g, '').replace(',', '.')) : null,
          refund_method: refundMethod || null,
          payment_data: paymentData,
          observations: observations || null
        })
      })

      if (res.ok) {
        toast.success('Prestação de contas enviada com sucesso!')
        setSendModalOpen(false)
        setSelectedIds(new Set())
        fetchExpenses()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao enviar prestação de contas')
      }
    } catch (error) {
      console.error('Erro ao enviar:', error)
      toast.error('Erro ao enviar prestação de contas')
    } finally {
      setSending(false)
    }
  }

  // Determinar se precisa mostrar campos de pagamento
  // 1. Se tem APENAS reembolso (sem adiantamento): sempre mostrar
  // 2. Se tem adiantamento: mostrar somente se o usuário indicou que excedeu
  const showPaymentFields = expenseAnalysis.needsPaymentInfo || (expenseAnalysis.hasAdiantamento && advanceExceeded === true)

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
            <Receipt className="w-6 h-6 text-primary" />
            Despesas Processadas
          </h1>
          <p className="text-muted-foreground">
            Selecione as despesas e envie sua prestação de contas
          </p>
        </div>
        
        {selectedIds.size > 0 && (
          <Button onClick={openSendModal} className="gap-2">
            <Send className="w-4 h-4" />
            Enviar Prestação de Contas ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {/* Pendentes de Envio */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 rounded-xl">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
                <p className="text-2xl font-bold text-primary">{expenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Valor Total */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selecionadas */}
        <Card className={`transition-all ${selectedIds.size > 0 ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selecionadas</p>
                <p className="text-xl font-bold text-emerald-600">{selectedIds.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Selecionado */}
        <Card className={`transition-all ${selectedIds.size > 0 ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Send className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Selecionado</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categorias */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categorias</p>
                <p className="text-xl font-bold text-purple-600">
                  {new Set(expenses.map(e => e.category)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seleção */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0}
              onCheckedChange={selectAll}
              id="select-all"
            />
            <Label htmlFor="select-all" className="text-sm cursor-pointer font-medium">
              Selecionar todas ({filteredExpenses.length} despesas)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Filtros Expansíveis */}
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
          icon={Receipt}
          title="Nenhuma despesa processada"
          description="Quando você processar despesas, elas aparecerão aqui para envio"
        />
      ) : (
        <div className="space-y-4">
          {filteredExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              isChecked={selectedIds.has(expense.id)}
              showCheckbox={true}
              showActions={false}
              showDelete={true}
              onToggleCheck={() => toggleSelect(expense.id)}
              onDelete={() => handleDeleteExpense(expense.id)}
              deleting={deleting === expense.id}
            />
          ))}
        </div>
      )}

      {/* Modal de Envio de Prestação de Contas */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Enviar Prestação de Contas
            </DialogTitle>
            <DialogDescription>
              Você está enviando {selectedIds.size} despesa(s) totalizando {formatCurrency(selectedTotal)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Resumo das despesas por tipo */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="font-medium">Resumo por Tipo de Despesa</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                {expenseAnalysis.hasCartao && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Cartão Corporativo</span>
                  </div>
                )}
                {expenseAnalysis.hasAdiantamento && (
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <span className="text-sm">Adiantamento</span>
                  </div>
                )}
                {expenseAnalysis.hasReembolso && (
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Reembolso</span>
                  </div>
                )}
              </div>
            </div>

            {/* Situação do Adiantamento */}
            {expenseAnalysis.hasAdiantamento && (
              <FieldGroup>
                <Field>
                  <FieldLabel className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Situação do Saldo do Adiantamento *
                  </FieldLabel>
                  <RadioGroup value={advanceBalance} onValueChange={setAdvanceBalance} className="mt-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="positivo" id="saldo-positivo" />
                      <Label htmlFor="saldo-positivo" className="cursor-pointer">
                        <span className="font-medium text-green-600">Saldo Positivo</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (sobrou dinheiro do adiantamento)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="zero" id="saldo-zero" />
                      <Label htmlFor="saldo-zero" className="cursor-pointer">
                        <span className="font-medium">Consumido Integralmente</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (adiantamento utilizado por completo)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="negativo" id="saldo-negativo" />
                      <Label htmlFor="saldo-negativo" className="cursor-pointer">
                        <span className="font-medium text-red-600">Saldo Negativo</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (precisei usar recurso próprio)
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </Field>

                {(advanceBalance === 'positivo' || advanceBalance === 'negativo') && (
                  <Field>
                    <FieldLabel>
                      {advanceBalance === 'positivo' ? 'Valor a Devolver' : 'Valor a Receber'} (R$) *
                    </FieldLabel>
                    <Input
                      placeholder="0,00"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      className="text-right font-mono"
                    />
                  </Field>
                )}
              </FieldGroup>
            )}

            {/* Dados do adiantamento - só aparece se tem adiantamento vinculado */}
            {expenseAnalysis.hasAdiantamento && (
              <div className="p-4 border rounded-lg space-y-4 bg-amber-50/50 border-amber-200">
                <h4 className="font-medium flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  Dados do Adiantamento Recebido
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Valor Adiantado (R$) *</FieldLabel>
                    <Input
                      placeholder="0,00"
                      value={advanceReceivedAmount}
                      onChange={(e) => setAdvanceReceivedAmount(e.target.value)}
                      className="text-right font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Data do Adiantamento</FieldLabel>
                    <Input
                      type="date"
                      value={advanceReceivedDate}
                      onChange={(e) => setAdvanceReceivedDate(e.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    As despesas ultrapassaram o valor do adiantamento?
                  </FieldLabel>
                  <RadioGroup 
                    value={advanceExceeded === null ? '' : advanceExceeded ? 'sim' : 'nao'} 
                    onValueChange={(v) => setAdvanceExceeded(v === 'sim')} 
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="advance-no" />
                      <Label htmlFor="advance-no" className="cursor-pointer">
                        <span className="font-medium">Não</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (o adiantamento cobriu todas as despesas)
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="advance-yes" />
                      <Label htmlFor="advance-yes" className="cursor-pointer">
                        <span className="font-medium text-amber-600">Sim</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          (precisei usar recurso próprio além do adiantamento)
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </Field>
              </div>
            )}

            {/* Dados de Pagamento - aparece se: 
                1. Tem apenas reembolso (sem adiantamento), OU
                2. Tem adiantamento e o usuário indicou que excedeu */}
            {showPaymentFields && (
              <div className="p-4 border rounded-lg space-y-4 bg-blue-50/50 border-blue-200">
                <h4 className="font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Dados para Reembolso (opcional)
                </h4>
                <p className="text-sm text-muted-foreground">
                  Informe os dados bancários para receber o reembolso. Os campos não são obrigatórios.
                </p>
                
                <Field>
                  <FieldLabel>Código de Barras do Boleto</FieldLabel>
                  <Input
                    placeholder="Cole aqui o código de barras do boleto (linha digitável)"
                    value={paymentBarcode}
                    onChange={(e) => setPaymentBarcode(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>Chave PIX</FieldLabel>
                  <Input
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    value={paymentPix}
                    onChange={(e) => setPaymentPix(e.target.value)}
                  />
                </Field>
              </div>
            )}

            {/* Observações */}
            <Field>
              <FieldLabel>Observações (opcional)</FieldLabel>
              <Textarea
                placeholder="Informações adicionais para a equipe financeira..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
              />
            </Field>

            {/* Aviso */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Atenção</p>
                <p>Após o envio, as despesas ficarão bloqueadas para edição até que a equipe financeira analise a prestação de contas.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSendModalOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={handleSendBatch} disabled={sending} className="gap-2">
              {sending ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Prestação de Contas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
