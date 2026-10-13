'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Empty } from '@/components/ui/empty'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { PaginationControl } from '@/components/pagination-control'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { AlertCircle, Search, Edit, MessageSquare, Clock, ChevronDown, ChevronUp, Send, CheckSquare, Filter, FileText } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate, getCategoryLabel } from '@/lib/format'
import Link from 'next/link'

type Expense = ExpenseData & {
  rejection_reason?: string
  rejected_at?: string
  rejected_by?: string
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

export default function CorrectionsPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

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
  const [showFilters, setShowFilters] = useState(false)
  const [expandedReasons, setExpandedReasons] = useState<Set<number>>(new Set())
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set())
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [observations, setObservations] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('status', 'correction')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      if (searchTerm) params.set('search', searchTerm)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (settlementTypeFilter !== 'all') params.set('settlement_type', settlementTypeFilter)
      if (batchFilter && batchFilter !== 'all') params.set('batch_id', batchFilter.replace('#', ''))
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/expenses?${params.toString()}`)
      const json = await res.json()
      if (res.ok && json.data && json.pagination) {
        setExpenses(json.data)
        setTotalPages(json.pagination.totalPages)
        setTotalCount(json.pagination.totalCount)
        setSummaryTotalAmount(Number(json.summary?.totalAmount || 0))
      } else if (res.ok && Array.isArray(json)) {
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
      console.error('Erro ao carregar despesas:', error)
      toast.error('Erro ao carregar despesas')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchTerm, categoryFilter, settlementTypeFilter, batchFilter, startDate, endDate])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, categoryFilter, settlementTypeFilter, batchFilter, startDate, endDate])

  function toggleReason(expenseId: number) {
    setExpandedReasons(prev => {
      const next = new Set(prev)
      if (next.has(expenseId)) {
        next.delete(expenseId)
      } else {
        next.add(expenseId)
      }
      return next
    })
  }

  function toggleExpenseSelection(expenseId: number) {
    setSelectedExpenses(prev => {
      const next = new Set(prev)
      if (next.has(expenseId)) {
        next.delete(expenseId)
      } else {
        next.add(expenseId)
      }
      return next
    })
  }

  function selectAllExpenses() {
    setSelectedExpenses(new Set(filteredExpenses.map(e => e.id)))
  }

  function deselectAllExpenses() {
    setSelectedExpenses(new Set())
  }

  async function handleSubmitCorrections() {
    if (selectedExpenses.size === 0) {
      toast.error('Selecione pelo menos uma despesa para reenviar')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          expense_ids: Array.from(selectedExpenses),
          observations: observations || 'Correções realizadas conforme solicitado',
        })
      })

      if (res.ok) {
        toast.success('Despesas corrigidas enviadas com sucesso!')
        setSubmitModalOpen(false)
        setSelectedExpenses(new Set())
        setObservations('')
        fetchExpenses()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao enviar correções')
      }
    } catch (error) {
      console.error('Erro ao enviar correções:', error)
      toast.error('Erro ao enviar correções')
    } finally {
      setSubmitting(false)
    }
  }

  // Despesas da página
  const filteredExpenses = expenses

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all' || settlementTypeFilter !== 'all' || batchFilter !== '' || startDate !== '' || endDate !== ''

  function clearFilters() {
    setSearchTerm('')
    setCategoryFilter('all')
    setSettlementTypeFilter('all')
    setBatchFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  // Calcular totais
  const totalAmount = summaryTotalAmount || filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const selectedAmount = filteredExpenses
    .filter(e => selectedExpenses.has(e.id))
    .reduce((sum, e) => sum + Number(e.amount), 0)

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
            <AlertCircle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            Correções Solicitadas
          </h1>
          <p className="text-muted-foreground">
            Despesas que precisam ser corrigidas conforme solicitado pela equipe financeira
          </p>
        </div>
        {selectedExpenses.size > 0 && (
          <Button onClick={() => setSubmitModalOpen(true)} className="bg-primary">
            <Send className="w-4 h-4 mr-2" />
            Reenviar Correções ({selectedExpenses.size})
          </Button>
        )}
      </div>

      {/* Alerta */}
      {filteredExpenses.length > 0 && (
        <Card className="border-amber-300/80 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/25">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Atenção</p>
                <p className="text-sm text-amber-800/90 dark:text-slate-300">
                  Você tem {filteredExpenses.length} despesa(s) aguardando correção. 
                  Leia o motivo da solicitação e faça as correções necessárias para reenviar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {/* Aguardando Correção */}
        <Card className="bg-gradient-to-br from-orange-100/70 to-orange-50/50 dark:from-orange-950/30 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-200 dark:bg-orange-800 rounded-xl">
                <AlertCircle className="w-5 h-5 text-orange-700 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aguardando</p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{filteredExpenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Total */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selecionadas */}
        <Card className={`transition-all ${selectedExpenses.size > 0 ? "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedExpenses.size > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                <CheckSquare className={`w-5 h-5 ${selectedExpenses.size > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selecionadas</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{selectedExpenses.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Selecionado */}
        <Card className={`transition-all ${selectedExpenses.size > 0 ? "ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedExpenses.size > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                <Send className={`w-5 h-5 ${selectedExpenses.size > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Selecionado</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span className="font-medium">Filtros</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs">
                    Ativos
                  </Badge>
                )}
              </div>
              {showFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
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
        </Collapsible>
      </Card>

      {/* Lista de Despesas */}
      {filteredExpenses.length === 0 ? (
        <Empty
          icon={AlertCircle}
          title="Nenhuma correção pendente"
          description="Despesas que precisam de correção aparecerão aqui"
        />
      ) : (
        <div className="space-y-4">
          {/* Botões de seleção */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Selecione as despesas já corrigidas para reenviar
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllExpenses}>
                Selecionar Todas
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllExpenses}>
                Limpar
              </Button>
            </div>
          </div>
          
          {filteredExpenses.map((expense) => (
            <div key={expense.id} className="space-y-2">
              {/* Card de Motivo da Correção */}
              <Card className={`border-amber-300/80 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/25 ${selectedExpenses.has(expense.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox 
                        checked={selectedExpenses.has(expense.id)}
                        onCheckedChange={() => toggleExpenseSelection(expense.id)}
                        className="mt-1"
                      />
                      <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="space-y-1 flex-1">
                        <p className="font-medium text-sm text-amber-900 dark:text-amber-200">Motivo da Solicitação de Correção</p>
                        <p className={`text-sm text-amber-800/90 dark:text-slate-300 ${!expandedReasons.has(expense.id) ? 'line-clamp-2' : ''}`}>
                          {expense.rejection_reason || 'Não informado'}
                        </p>
                        {expense.rejection_reason && expense.rejection_reason.length > 100 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto p-0 text-xs text-primary"
                            onClick={() => toggleReason(expense.id)}
                          >
                            {expandedReasons.has(expense.id) ? (
                              <>Ver menos <ChevronUp className="w-3 h-3 ml-1" /></>
                            ) : (
                              <>Ver mais <ChevronDown className="w-3 h-3 ml-1" /></>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/expenses/${expense.id}/edit`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Corrigir
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card da Despesa */}
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

      {/* Modal de Reenvio */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Reenviar Despesas Corrigidas
            </DialogTitle>
            <DialogDescription>
              Você está reenviando {selectedExpenses.size} despesa(s) totalizando {formatCurrency(selectedAmount)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Informações sobre as correções realizadas..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitCorrections} disabled={submitting}>
              {submitting ? <Spinner className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Reenviar Correções
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
