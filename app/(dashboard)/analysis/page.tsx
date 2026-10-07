'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ExpenseCard, ExpenseData } from '@/components/expense-card'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  CreditCard,
  Wallet,
  Receipt,
  AlertTriangle,
  Building2,
  Edit3,
  Filter,
  Hotel,
  Fuel,
  Car,
  ParkingCircle,
  Package,
  Camera,
  History,
  Utensils,
  Trash2,
  Pencil
} from 'lucide-react'
import { formatCurrency, formatDate, getCategoryLabel, getExpenseTypeLabel, getStatusLabel } from '@/lib/format'

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
  observations: string | null
  finance_observations?: string | null
  total_amount: number
  expense_count: number
  status: string
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  category_totals?: Array<{ category: string; total: number }>
}

export default function AnalysisPage() {
  const { user } = useAuth()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [batchNumberFilter, setBatchNumberFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [dateStartFilter, setDateStartFilter] = useState('')
  const [dateEndFilter, setDateEndFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set())
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])
  
  // Verificar se há filtros ativos (exceto status que já tem os painéis)
  const hasActiveFilters = searchTerm !== '' || batchNumberFilter !== '' || employeeFilter !== 'all' || dateStartFilter !== '' || dateEndFilter !== '' || paymentTypeFilter !== 'all' || categoryFilter !== 'all'
  
  function clearFilters() {
    setSearchTerm('')
    setBatchNumberFilter('')
    setEmployeeFilter('all')
    setDateStartFilter('')
    setDateEndFilter('')
    setPaymentTypeFilter('all')
    setCategoryFilter('all')
  }
  const [batchExpenses, setBatchExpenses] = useState<Record<number, ExpenseData[]>>({})
  const [loadingExpenses, setLoadingExpenses] = useState<Set<number>>(new Set())

  // Estados do modal de rejeição
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  // Modal de correção
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false)
  const [correctionReason, setCorrectionReason] = useState('')
  const [selectedExpensesForCorrection, setSelectedExpensesForCorrection] = useState<Set<number>>(new Set())

  // Modal de rejeição individual
  const [rejectItemModalOpen, setRejectItemModalOpen] = useState(false)
  const [selectedExpenseForReject, setSelectedExpenseForReject] = useState<ExpenseData | null>(null)
  const [itemRejectionReason, setItemRejectionReason] = useState('')

  // Modal de correção individual
  const [correctionItemModalOpen, setCorrectionItemModalOpen] = useState(false)
  const [selectedExpenseForCorrection, setSelectedExpenseForCorrection] = useState<ExpenseData | null>(null)
  const [itemCorrectionReason, setItemCorrectionReason] = useState('')

  // Modal de aprovar em massa
  const [approveAllModalOpen, setApproveAllModalOpen] = useState(false)
  const [selectedExpensesForApprove, setSelectedExpensesForApprove] = useState<Set<number>>(new Set())

  // Modal de rejeitar em massa
  const [rejectAllModalOpen, setRejectAllModalOpen] = useState(false)
  const [selectedExpensesForReject, setSelectedExpensesForReject] = useState<Set<number>>(new Set())
  const [bulkRejectionReason, setBulkRejectionReason] = useState('')

  // Filtro de intervalo de datas por batch
  const [batchDateFilters, setBatchDateFilters] = useState<Record<number, { startDate: string; endDate: string }>>({})
  
  // Modal de visualização de despesa
  const [viewExpenseModalOpen, setViewExpenseModalOpen] = useState(false)
  const [selectedExpenseForView, setSelectedExpenseForView] = useState<ExpenseData | null>(null)

  // Modal de edição de observações da remessa (admin)
  const [editBatchObsModalOpen, setEditBatchObsModalOpen] = useState(false)
  const [selectedBatchForEdit, setSelectedBatchForEdit] = useState<Batch | null>(null)
  const [editObservations, setEditObservations] = useState('')
  const [editFinanceObservations, setEditFinanceObservations] = useState('')

  // Modal de edição de descrição da despesa (admin)
  const [editExpenseDescModalOpen, setEditExpenseDescModalOpen] = useState(false)
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<ExpenseData | null>(null)
  const [editDescription, setEditDescription] = useState('')

  const canAnalyze = user?.role === "manager" || user?.role === "director" || user?.role === "admin" || user?.role === "financial"

  useEffect(() => {
    if (canAnalyze) {
      fetchBatches()
      fetchEmployees()
    }
  }, [statusFilter, canAnalyze])

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

  async function fetchBatches() {
    try {
      setLoading(true)
      const url = statusFilter === 'all' 
        ? '/api/batches'
        : `/api/batches?status=${statusFilter}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setBatches(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Erro ao carregar remessas:', error)
      toast.error('Erro ao carregar remessas')
    } finally {
      setLoading(false)
    }
  }

async function loadBatchExpenses(batchId: number, forceReload = false) {
  if (!forceReload && batchExpenses[batchId]) return
  
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

  async function handleApprove(batch: Batch) {
    try {
      setProcessing(true)
      const res = await fetch(`/api/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          reviewed_by: user?.id
        })
      })

      if (res.ok) {
        toast.success('Remessa aprovada com sucesso!')
        fetchBatches()
      } else {
        toast.error('Erro ao aprovar remessa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao aprovar remessa')
    } finally {
      setProcessing(false)
    }
  }

  function openRejectModal(batch: Batch) {
    setSelectedBatch(batch)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  function openCorrectionModal(batch: Batch) {
    setSelectedBatch(batch)
    setCorrectionReason('')
    setSelectedExpensesForCorrection(new Set())
    // Garantir que as despesas da remessa estejam carregadas
    if (!batchExpenses[batch.id]) {
      loadBatchExpenses(batch.id)
    }
    setCorrectionModalOpen(true)
  }

function openApproveAllModal(batch: Batch) {
  setSelectedBatch(batch)
  setSelectedExpensesForApprove(new Set())
  // Garantir que as despesas da remessa estejam carregadas
  if (!batchExpenses[batch.id]) {
    loadBatchExpenses(batch.id)
  }
  setApproveAllModalOpen(true)
  }

  function openRejectAllModal(batch: Batch) {
    setSelectedBatch(batch)
    setSelectedExpensesForReject(new Set())
    setBulkRejectionReason('')
    // Garantir que as despesas da remessa estejam carregadas
    if (!batchExpenses[batch.id]) {
      loadBatchExpenses(batch.id)
    }
    setRejectAllModalOpen(true)
  }

  function toggleExpenseForApprove(expenseId: number) {
    setSelectedExpensesForApprove(prev => {
      const newSet = new Set(prev)
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId)
      } else {
        newSet.add(expenseId)
      }
      return newSet
    })
  }

  function toggleExpenseForReject(expenseId: number) {
    setSelectedExpensesForReject(prev => {
      const newSet = new Set(prev)
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId)
      } else {
        newSet.add(expenseId)
      }
      return newSet
    })
  }

  function selectAllExpensesForApprove() {
    if (selectedBatch && batchExpenses[selectedBatch.id]) {
      const pendingIds = batchExpenses[selectedBatch.id]
        .filter(e => e.status !== 'approved' && e.status !== 'rejected' && e.status !== 'correction')
        .map(e => e.id)
      setSelectedExpensesForApprove(new Set(pendingIds))
    }
  }

  function selectAllExpensesForReject() {
    if (selectedBatch && batchExpenses[selectedBatch.id]) {
      const pendingIds = batchExpenses[selectedBatch.id]
        .filter(e => e.status !== 'approved' && e.status !== 'rejected' && e.status !== 'correction')
        .map(e => e.id)
      setSelectedExpensesForReject(new Set(pendingIds))
    }
  }

  async function handleBulkApprove() {
    if (!selectedBatch) return
    if (selectedExpensesForApprove.size === 0) {
      toast.error('Selecione pelo menos uma despesa para aprovar')
      return
    }

    try {
      setProcessing(true)
      let successCount = 0
      for (const expenseId of selectedExpensesForApprove) {
        const res = await fetch(`/api/expenses/${expenseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved', reviewed_by: user?.id })
        })
        if (res.ok) successCount++
      }
      
toast.success(`${successCount} despesa(s) aprovada(s)`)
    setApproveAllModalOpen(false)
    // Recarregar remessas e despesas
    await fetchBatches()
    setBatchExpenses(prev => {
      const newExpenses = { ...prev }
      delete newExpenses[selectedBatch.id]
      return newExpenses
    })
    await loadBatchExpenses(selectedBatch.id, true)
    } catch (error) {
    console.error('Erro:', error)
    toast.error('Erro ao aprovar despesas')
    } finally {
    setProcessing(false)
    }
  }

  async function handleBulkReject() {
    if (!selectedBatch) return
    if (selectedExpensesForReject.size === 0) {
      toast.error('Selecione pelo menos uma despesa para rejeitar')
      return
    }
    if (!bulkRejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição')
      return
    }

    try {
      setProcessing(true)
      let successCount = 0
      for (const expenseId of selectedExpensesForReject) {
        const res = await fetch(`/api/expenses/${expenseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'rejected', 
            rejection_reason: bulkRejectionReason,
            reviewed_by: user?.id 
          })
        })
        if (res.ok) successCount++
      }
      
toast.success(`${successCount} despesa(s) rejeitada(s)`)
    setRejectAllModalOpen(false)
    // Recarregar remessas e despesas
    await fetchBatches()
    setBatchExpenses(prev => {
      const newExpenses = { ...prev }
      delete newExpenses[selectedBatch.id]
      return newExpenses
    })
    await loadBatchExpenses(selectedBatch.id, true)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao rejeitar despesas')
    } finally {
      setProcessing(false)
    }
  }

  function toggleExpenseForCorrection(expenseId: number) {
    setSelectedExpensesForCorrection(prev => {
      const newSet = new Set(prev)
      if (newSet.has(expenseId)) {
        newSet.delete(expenseId)
      } else {
        newSet.add(expenseId)
      }
      return newSet
    })
  }

  function selectAllExpensesForCorrection() {
    if (selectedBatch && batchExpenses[selectedBatch.id]) {
      const allIds = batchExpenses[selectedBatch.id].map(e => e.id)
      setSelectedExpensesForCorrection(new Set(allIds))
    }
  }

  function deselectAllExpensesForCorrection() {
    setSelectedExpensesForCorrection(new Set())
  }

  async function handleReject() {
    if (!selectedBatch) return
    if (!rejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch(`/api/batches/${selectedBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason,
          reviewed_by: user?.id
        })
      })

      if (res.ok) {
        toast.success('Remessa rejeitada')
        setRejectModalOpen(false)
        fetchBatches()
      } else {
        toast.error('Erro ao rejeitar remessa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao rejeitar remessa')
    } finally {
      setProcessing(false)
    }
  }

  // Aprovar item individual
  async function handleApproveItem(expense: ExpenseData, batchId: number) {
    try {
      setProcessing(true)
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          reviewed_by: user?.id
        })
      })

      if (res.ok) {
        toast.success('Despesa aprovada!')
        // Recarregar remessas e despesas
        await fetchBatches()
        setBatchExpenses(prev => {
          const newExpenses = { ...prev }
          delete newExpenses[batchId]
          return newExpenses
        })
        await loadBatchExpenses(batchId, true) // forceReload
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao aprovar despesa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao aprovar despesa')
    } finally {
      setProcessing(false)
    }
  }

  function openRejectItemModal(expense: ExpenseData) {
    setSelectedExpenseForReject(expense)
    setItemRejectionReason('')
    setRejectItemModalOpen(true)
  }

  async function handleRejectItem() {
    if (!selectedExpenseForReject) return
    if (!itemRejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch(`/api/expenses/${selectedExpenseForReject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: itemRejectionReason,
          reviewed_by: user?.id
        })
      })

if (res.ok) {
      toast.success('Despesa rejeitada')
      setRejectItemModalOpen(false)
      // Recarregar remessas e despesas
      await fetchBatches()
      const batchId = selectedExpenseForReject.batch_id
      if (batchId) {
        setBatchExpenses(prev => {
          const newExpenses = { ...prev }
          delete newExpenses[batchId]
          return newExpenses
        })
        await loadBatchExpenses(batchId, true)
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      toast.error(errorData.error || 'Erro ao rejeitar despesa')
    }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao rejeitar despesa')
    } finally {
      setProcessing(false)
    }
  }

  function openCorrectionItemModal(expense: ExpenseData) {
    setSelectedExpenseForCorrection(expense)
    setItemCorrectionReason('')
    setCorrectionItemModalOpen(true)
  }
  
function openViewExpenseModal(expense: ExpenseData) {
    setSelectedExpenseForView(expense)
    setViewExpenseModalOpen(true)
  }

  // Funções de edição para admin
  function openEditBatchObsModal(batch: Batch) {
    setSelectedBatchForEdit(batch)
    setEditObservations(batch.observations || '')
    setEditFinanceObservations(batch.finance_observations || '')
    setEditBatchObsModalOpen(true)
  }

  async function handleSaveBatchObservations() {
    if (!selectedBatchForEdit) return

    try {
      setProcessing(true)
      const res = await fetch(`/api/batches/${selectedBatchForEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observations: editObservations,
          finance_observations: editFinanceObservations
        })
      })

      if (res.ok) {
        toast.success('Observações atualizadas com sucesso')
        setEditBatchObsModalOpen(false)
        setBatches(prev => prev.map(b => 
          b.id === selectedBatchForEdit.id 
            ? { ...b, observations: editObservations, finance_observations: editFinanceObservations }
            : b
        ))
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao atualizar observações')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao atualizar observações')
    } finally {
      setProcessing(false)
    }
  }

  function openEditExpenseDescModal(expense: ExpenseData) {
    setSelectedExpenseForEdit(expense)
    setEditDescription(expense.description || '')
    setEditExpenseDescModalOpen(true)
  }

  async function handleSaveExpenseDescription() {
    if (!selectedExpenseForEdit) return

    try {
      setProcessing(true)
      const res = await fetch(`/api/expenses/${selectedExpenseForEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedExpenseForEdit,
          description: editDescription,
          status: 'keep'
        })
      })

      if (res.ok) {
        toast.success('Descrição atualizada com sucesso')
        setEditExpenseDescModalOpen(false)
        const batchId = selectedExpenseForEdit.batch_id
        if (batchId) {
          setBatchExpenses(prev => ({
            ...prev,
            [batchId]: prev[batchId]?.map(e => 
              e.id === selectedExpenseForEdit.id 
                ? { ...e, description: editDescription }
                : e
            ) || []
          }))
        }
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao atualizar descrição')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao atualizar descrição')
    } finally {
      setProcessing(false)
    }
  }

  // Verificar se é admin (pode excluir qualquer despesa)
  const isAdmin = user?.role === 'admin' || user?.role === 'director'

  async function handleDeleteExpense(expense: ExpenseData) {
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir despesas')
      return
    }

    if (!confirm(`Tem certeza que deseja excluir esta despesa?\n\nID: ${expense.id}\nValor: ${formatCurrency(expense.amount)}\n\nEsta ação é irreversível e irá excluir também os arquivos associados.`)) {
      return
    }

    try {
      setProcessing(true)
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Despesa excluída com sucesso (${data.deletedFiles || 0} arquivo(s) removido(s))`)
        // Recarregar remessas e despesas
        await fetchBatches()
        const batchId = expense.batch_id
        if (batchId) {
          setBatchExpenses(prev => {
            const newExpenses = { ...prev }
            delete newExpenses[batchId]
            return newExpenses
          })
          await loadBatchExpenses(batchId, true)
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao excluir despesa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir despesa')
    } finally {
      setProcessing(false)
    }
  }

  async function handleCorrectionItem() {
    if (!selectedExpenseForCorrection) return
    if (!itemCorrectionReason.trim()) {
      toast.error('Informe o que precisa ser corrigido')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch(`/api/expenses/${selectedExpenseForCorrection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'correction',
          rejection_reason: itemCorrectionReason,
          reviewed_by: user?.id
        })
      })

if (res.ok) {
      toast.success('Solicitação de correção enviada')
      setCorrectionItemModalOpen(false)
      // Recarregar remessas e despesas
      await fetchBatches()
      const batchId = selectedExpenseForCorrection.batch_id
      if (batchId) {
        setBatchExpenses(prev => {
          const newExpenses = { ...prev }
          delete newExpenses[batchId]
          return newExpenses
        })
        await loadBatchExpenses(batchId, true)
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      toast.error(errorData.error || 'Erro ao solicitar correção')
    }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao solicitar correção')
    } finally {
      setProcessing(false)
    }
  }

  // Filtrar despesas por intervalo de datas
  function getFilteredExpenses(batchId: number) {
    const expenses = batchExpenses[batchId] || []
    const dateFilter = batchDateFilters[batchId]
    if (!dateFilter || (!dateFilter.startDate && !dateFilter.endDate)) return expenses
    
    return expenses.filter(e => {
      // Normalizar a data da despesa para formato YYYY-MM-DD
      const expenseDate = e.expense_date ? e.expense_date.split('T')[0] : ''
      if (!expenseDate) return false
      
      if (dateFilter.startDate && dateFilter.endDate) {
        return expenseDate >= dateFilter.startDate && expenseDate <= dateFilter.endDate
      } else if (dateFilter.startDate) {
        return expenseDate >= dateFilter.startDate
      } else if (dateFilter.endDate) {
        return expenseDate <= dateFilter.endDate
      }
      return true
    })
  }

  // Verificar se há filtro ativo
  function hasDateFilter(batchId: number): boolean {
    const filter = batchDateFilters[batchId]
    return !!(filter && (filter.startDate || filter.endDate))
  }

  // Obter min/max datas das despesas de uma remessa
  function getDateRange(batchId: number): { min: string; max: string } {
    const expenses = batchExpenses[batchId] || []
    const dates = expenses.map(e => e.expense_date).filter(Boolean).sort()
    return { min: dates[0] || '', max: dates[dates.length - 1] || '' }
  }

  // Aprovar todas despesas filtradas por data
  async function handleApproveByDate(batchId: number) {
    const filtered = getFilteredExpenses(batchId).filter(e => e.status !== 'approved' && e.status !== 'rejected')
    if (filtered.length === 0) {
      toast.error('Nenhuma despesa pendente para aprovar')
      return
    }

    try {
      setProcessing(true)
      let successCount = 0
      for (const expense of filtered) {
        const res = await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved', reviewed_by: user?.id })
        })
        if (res.ok) successCount++
      }
      
      toast.success(`${successCount} despesa(s) aprovada(s)`)
      await fetchBatches()
      setBatchExpenses(prev => {
        const newExpenses = { ...prev }
        delete newExpenses[batchId]
        return newExpenses
      })
      await loadBatchExpenses(batchId, true)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao aprovar despesas')
    } finally {
      setProcessing(false)
    }
  }

  // Rejeitar todas despesas filtradas por data
  async function handleRejectByDate(batchId: number, reason: string) {
    const filtered = getFilteredExpenses(batchId).filter(e => e.status !== 'approved' && e.status !== 'rejected')
    if (filtered.length === 0) {
      toast.error('Nenhuma despesa pendente para rejeitar')
      return
    }
    if (!reason.trim()) {
      toast.error('Informe o motivo da rejeição')
      return
    }

    try {
      setProcessing(true)
      let successCount = 0
      for (const expense of filtered) {
        const res = await fetch(`/api/expenses/${expense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected', rejection_reason: reason, reviewed_by: user?.id })
        })
        if (res.ok) successCount++
      }
      
      toast.success(`${successCount} despesa(s) rejeitada(s)`)
      await fetchBatches()
      setBatchExpenses(prev => {
        const newExpenses = { ...prev }
        delete newExpenses[batchId]
        return newExpenses
      })
      await loadBatchExpenses(batchId, true)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao rejeitar despesas')
    } finally {
      setProcessing(false)
    }
  }

  async function handleRequestCorrection() {
    if (!selectedBatch) return
    if (!correctionReason.trim()) {
      toast.error('Informe o que precisa ser corrigido')
      return
    }
    if (selectedExpensesForCorrection.size === 0) {
      toast.error('Selecione pelo menos uma despesa para correção')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch(`/api/batches/${selectedBatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'correction',
          rejection_reason: correctionReason,
          reviewed_by: user?.id,
          expense_ids_for_correction: Array.from(selectedExpensesForCorrection)
        })
      })

      if (res.ok) {
        toast.success('Solicitação de correção enviada')
        setCorrectionModalOpen(false)
        fetchBatches()
      } else {
        toast.error('Erro ao solicitar correção')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao solicitar correção')
    } finally {
      setProcessing(false)
    }
  }

  // Filtrar remessas
  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      const matchesSearch = searchTerm === '' ||
        batch.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.user_email.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Filtro por número da remessa
      const matchesBatchNumber = batchNumberFilter === '' ||
        batch.id.toString().includes(batchNumberFilter) ||
        `#${batch.id}`.includes(batchNumberFilter)
      
      // Filtro por funcionário
      const matchesEmployee = employeeFilter === 'all' || batch.user_id?.toString() === employeeFilter
      
      // Filtro por período (data de criação da remessa)
      const batchDate = batch.created_at ? batch.created_at.split('T')[0] : ''
      const matchesDateStart = !dateStartFilter || batchDate >= dateStartFilter
      const matchesDateEnd = !dateEndFilter || batchDate <= dateEndFilter
      
      // Filtro por tipo de pagamento (campo settlement_type na tabela)
      const matchesPaymentType = paymentTypeFilter === 'all' || batch.settlement_type === paymentTypeFilter
      
      // Filtro por categoria (verifica se alguma despesa do batch tem a categoria)
      const matchesCategory = categoryFilter === 'all' || 
        (batch.category_totals && batch.category_totals.some(cat => cat.category === categoryFilter))
      
      return matchesSearch && matchesBatchNumber && matchesEmployee && matchesDateStart && matchesDateEnd && matchesPaymentType && matchesCategory
    })
  }, [batches, searchTerm, batchNumberFilter, employeeFilter, dateStartFilter, dateEndFilter, paymentTypeFilter, categoryFilter])

  // Calcular totais
  const totals = useMemo(() => {
    const pending = batches.filter(b => b.status === 'pending').length
    const approved = batches.filter(b => b.status === 'approved').length
    const rejected = batches.filter(b => b.status === 'rejected').length
    const correction = batches.filter(b => b.status === 'correction').length
    const totalAmount = batches.reduce((sum, b) => sum + Number(b.total_amount || 0), 0)
    return { pending, approved, rejected, correction, totalAmount }
  }, [batches])

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
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/60">Pendente</Badge>
      case 'approved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/60">Aprovada</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejeitada</Badge>
      case 'correction':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 dark:border dark:border-orange-800/60">Em Correção</Badge>
      case 'analysis':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border dark:border-blue-800/60">Em Análise</Badge>
      case 'submitted':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/60">Enviada</Badge>
      case 'processed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border dark:border-blue-800/60">Processada</Badge>
      case 'draft':
        return <Badge variant="outline">Rascunho</Badge>
      default:
        return <Badge variant="outline">{getStatusLabel(status)}</Badge>
    }
  }

  if (!canAnalyze) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Empty>
          <AlertTriangle className="h-10 w-10 text-muted-foreground" />
          <EmptyTitle>Acesso Restrito</EmptyTitle>
          <EmptyDescription>
            Você não tem permissão para acessar esta área.
          </EmptyDescription>
        </Empty>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando remessas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Análise de Prestações de Contas
        </h1>
        <p className="text-muted-foreground">
          Analise e aprove as remessas de despesas enviadas pelos funcionários
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'correction' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter('correction')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                <Edit3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Em Correção</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totals.correction}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-emerald-900/40 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-emerald-400">{totals.approved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Wallet className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-xl font-bold">{formatCurrency(totals.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <Label className="text-sm">Tipo de Pagamento</Label>
                  <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
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

                <div className="space-y-2">
                  <Label className="text-sm">Categoria</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Categorias</SelectItem>
                      <SelectItem value="accommodation">Hospedagem</SelectItem>
                      <SelectItem value="food">Alimentação</SelectItem>
                      <SelectItem value="fuel">Combustível</SelectItem>
                      <SelectItem value="transport">Deslocamento</SelectItem>
                      <SelectItem value="parking">Estacionamento</SelectItem>
                      <SelectItem value="office_supplies">Itens de Escritório</SelectItem>
                      <SelectItem value="meal_voucher">Vale-Refeição</SelectItem>
                      <SelectItem value="other">Outras</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Busca Geral</Label>
                  <Input
                    placeholder="Nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={dateStartFilter}
                    onChange={(e) => setDateStartFilter(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Data Fim</Label>
                  <Input
                    type="date"
                    value={dateEndFilter}
                    onChange={(e) => setDateEndFilter(e.target.value)}
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

      {/* Lista de Remessas */}
      {filteredBatches.length === 0 ? (
        <Empty>
          <FileText className="h-10 w-10 text-muted-foreground" />
          <EmptyTitle>Nenhuma remessa encontrada</EmptyTitle>
          <EmptyDescription>
            {statusFilter === 'pending' 
              ? "Não há prestações de contas aguardando análise"
              : "Nenhuma remessa corresponde aos filtros selecionados"
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

                      <div className="flex items-center shrink-0">
                        <div className="text-right">
                          <p className="text-base sm:text-xl font-bold whitespace-nowrap">{formatCurrency(batch.total_amount)}</p>
                          {getStatusBadge(batch.status)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Subtotal por categoria (sempre visível no cabeçalho) */}
                    {batch.category_totals && batch.category_totals.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Subtotal por Categoria:</p>
                        <div className="flex flex-wrap gap-2">
                          {batch.category_totals.map((cat) => (
                            <Badge key={cat.category} variant="secondary" className="text-xs font-normal gap-1.5 py-1">
                              <span>{getCategoryLabel(cat.category)}:</span>
                              <span className="font-semibold">{formatCurrency(Number(cat.total))}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="border-t pt-4 space-y-4">
                    {/* Informações do Adiantamento */}
                    {(batch.advance_received_amount || batch.advance_exceeded !== null) && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                        <h4 className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-3">
                          <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Informações do Adiantamento
                        </h4>
                        <div className="grid gap-4 md:grid-cols-3">
                          {batch.advance_received_amount && (
                            <div>
                              <p className="text-sm text-muted-foreground dark:text-slate-400">Valor Adiantado</p>
                              <p className="font-semibold text-amber-800 dark:text-amber-300">{formatCurrency(batch.advance_received_amount)}</p>
                            </div>
                          )}
                          {batch.advance_received_date && (
                            <div>
                              <p className="text-sm text-muted-foreground">Data do Adiantamento</p>
                              <p className="font-medium">{formatDate(batch.advance_received_date)}</p>
                            </div>
                          )}
                          {batch.advance_exceeded !== null && (
                            <div>
                              <p className="text-sm text-muted-foreground">Excedeu o Adiantamento?</p>
                              <p className={`font-medium ${batch.advance_exceeded ? 'text-red-600' : 'text-green-600'}`}>
                                {batch.advance_exceeded ? 'Sim - Necessita reembolso' : 'Não - Adiantamento suficiente'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dados de Pagamento (PIX/Boleto) */}
                    {batch.payment_data && (batch.payment_data.barcode || batch.payment_data.pix) && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h4 className="font-medium flex items-center gap-2 text-blue-800 dark:text-blue-300 mb-3">
                          <Building2 className="w-4 h-4" />
                          Dados para Reembolso
                        </h4>
                        <div className="space-y-2">
                          {batch.payment_data.barcode && (
                            <div>
                              <p className="text-sm text-muted-foreground">Código de Barras do Boleto</p>
                              <p className="font-mono text-sm break-all bg-background p-2 rounded border border-border">{batch.payment_data.barcode}</p>
                            </div>
                          )}
                          {batch.payment_data.pix && (
                            <div>
                              <p className="text-sm text-muted-foreground">Chave PIX</p>
                              <p className="font-mono text-sm bg-background p-2 rounded border border-border">{batch.payment_data.pix}</p>
                            </div>
                          )}
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
                          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-2">Dados do Boleto (Legado)</p>
                          <div className="text-sm space-y-1">
                            <p><span className="text-muted-foreground dark:text-slate-400">Banco:</span> {batch.bank_slip_data.bank}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Beneficiário:</span> {batch.bank_slip_data.beneficiary}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Valor:</span> {formatCurrency(batch.bank_slip_data.amount)}</p>
                            <p><span className="text-muted-foreground dark:text-slate-400">Vencimento:</span> {formatDate(batch.bank_slip_data.due_date)}</p>
                            <p className="font-mono text-xs break-all">
                              <span className="text-muted-foreground dark:text-slate-400">Código:</span> {batch.bank_slip_data.barcode}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {(batch.observations || batch.finance_observations || isAdmin) && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Observações</p>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-blue-700 dark:text-blue-300 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                              onClick={() => openEditBatchObsModal(batch)}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                          )}
                        </div>
                        {batch.observations && (
                          <div className="mt-2">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Do Funcionário:</p>
                            <p className="text-sm text-blue-700 dark:text-slate-300">{batch.observations}</p>
                          </div>
                        )}
                        {batch.finance_observations && (
                          <div className="mt-2">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Do Financeiro:</p>
                            <p className="text-sm text-blue-700 dark:text-slate-300">{batch.finance_observations}</p>
                          </div>
                        )}
                        {!batch.observations && !batch.finance_observations && isAdmin && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">Nenhuma observação. Clique em Editar para adicionar.</p>
                        )}
                      </div>
                    )}

                    {batch.rejection_reason && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/60 rounded-lg">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          {batch.status === 'correction' ? 'Solicitação de Correção' : 'Motivo da Rejeição'}
                        </p>
                        <p className="text-sm text-red-700 dark:text-slate-300 mt-1">{batch.rejection_reason}</p>
                      </div>
                    )}

                    {/* Despesas */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          Despesas ({batch.expense_count})
                        </h4>
                        
                        {/* Filtro de Intervalo de Datas */}
                        {batchExpenses[batch.id] && (batch.status === 'pending' || batch.status === 'correction') && (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">De:</span>
                              <Input
                                type="date"
                                className="h-8 w-[140px]"
                                value={batchDateFilters[batch.id]?.startDate || ''}
                                min={getDateRange(batch.id).min}
                                max={batchDateFilters[batch.id]?.endDate || getDateRange(batch.id).max}
                                onChange={(e) => setBatchDateFilters(prev => ({
                                  ...prev,
                                  [batch.id]: { 
                                    startDate: e.target.value, 
                                    endDate: prev[batch.id]?.endDate || '' 
                                  }
                                }))}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Até:</span>
                              <Input
                                type="date"
                                className="h-8 w-[140px]"
                                value={batchDateFilters[batch.id]?.endDate || ''}
                                min={batchDateFilters[batch.id]?.startDate || getDateRange(batch.id).min}
                                max={getDateRange(batch.id).max}
                                onChange={(e) => setBatchDateFilters(prev => ({
                                  ...prev,
                                  [batch.id]: { 
                                    startDate: prev[batch.id]?.startDate || '', 
                                    endDate: e.target.value 
                                  }
                                }))}
                              />
                            </div>
                            
                            {hasDateFilter(batch.id) && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  onClick={() => handleApproveByDate(batch.id)}
                                  disabled={processing}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Aprovar Período
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  onClick={() => {
                                    const reason = prompt('Informe o motivo da rejeição:')
                                    if (reason) handleRejectByDate(batch.id, reason)
                                  }}
                                  disabled={processing}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Rejeitar Período
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {hasDateFilter(batch.id) && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          Mostrando {getFilteredExpenses(batch.id).length} de {batchExpenses[batch.id]?.length || 0} despesas
                          {batchDateFilters[batch.id]?.startDate && batchDateFilters[batch.id]?.endDate && (
                            <span>de {formatDate(batchDateFilters[batch.id].startDate)} até {formatDate(batchDateFilters[batch.id].endDate)}</span>
                          )}
                          {batchDateFilters[batch.id]?.startDate && !batchDateFilters[batch.id]?.endDate && (
                            <span>a partir de {formatDate(batchDateFilters[batch.id].startDate)}</span>
                          )}
                          {!batchDateFilters[batch.id]?.startDate && batchDateFilters[batch.id]?.endDate && (
                            <span>até {formatDate(batchDateFilters[batch.id].endDate)}</span>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 ml-auto"
                            onClick={() => setBatchDateFilters(prev => ({ ...prev, [batch.id]: { startDate: '', endDate: '' } }))}
                          >
                            Limpar
                          </Button>
                        </div>
                      )}
                      
                      {loadingExpenses.has(batch.id) ? (
                        <div className="flex items-center justify-center py-8">
                          <Spinner className="w-6 h-6" />
                        </div>
                      ) : batchExpenses[batch.id] ? (
                        <div className="space-y-3">
                          {getFilteredExpenses(batch.id).map((expense) => (
                            <div key={expense.id} className="border rounded-lg overflow-hidden">
                              <ExpenseCard
                                expense={expense}
                                showCheckbox={false}
                                showActions={false}
                                onView={() => openViewExpenseModal(expense)}
                              />
                              {/* Barra de ações por item - abaixo do card */}
                              {(batch.status === 'pending' || batch.status === 'correction') && expense.status !== 'approved' && expense.status !== 'rejected' && expense.status !== 'correction' && (
                                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-dashed">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleApproveItem(expense, batch.id)
                                    }}
                                    disabled={processing}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openRejectItemModal(expense)
                                    }}
                                    disabled={processing}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Rejeitar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openCorrectionItemModal(expense)
                                    }}
                                    disabled={processing}
                                  >
                                    <Edit3 className="w-4 h-4 mr-1" />
                                    Corrigir
                                  </Button>
                                  {isAdmin && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openEditExpenseDescModal(expense)
                                        }}
                                        disabled={processing}
                                      >
                                        <Pencil className="w-4 h-4 mr-1" />
                                        Editar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 bg-red-100 hover:bg-red-200 text-red-800 border-red-300"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteExpense(expense)
                                        }}
                                        disabled={processing}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Excluir
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                              {expense.status === 'correction' && (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 mt-2">
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  Aguardando correção do usuário
                                </Badge>
                              )}
                              {expense.status === 'approved' && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Aprovada
                                  </Badge>
                                  {isAdmin && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openEditExpenseDescModal(expense)
                                        }}
                                        disabled={processing}
                                      >
                                        <Pencil className="w-3 h-3 mr-1" />
                                        Editar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteExpense(expense)
                                        }}
                                        disabled={processing}
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        Excluir
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Clique para expandir e ver as despesas
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    {(batch.status === 'pending' || batch.status === 'correction') && (
                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => openCorrectionModal(batch)}
                          disabled={processing}
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Solicitar Correção
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => openRejectAllModal(batch)}
                          disabled={processing}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitar
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openApproveAllModal(batch)}
                          disabled={processing}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aprovar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Rejeição */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Rejeitar Remessa
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O funcionário será notificado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo da Rejeição *</Label>
              <Textarea
                placeholder="Descreva o motivo da rejei��ão..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Correção */}
      <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <Edit3 className="w-5 h-5" />
              Solicitar Correção
            </DialogTitle>
            <DialogDescription>
              Selecione as despesas que precisam de correção e descreva o que precisa ser ajustado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Seleção de despesas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Selecione as despesas para correção *</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllExpensesForCorrection}
                  >
                    Selecionar Todas
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={deselectAllExpensesForCorrection}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              
              {selectedBatch && loadingExpenses.has(selectedBatch.id) ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : selectedBatch && batchExpenses[selectedBatch.id] ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 dark:border-slate-800">
                  {batchExpenses[selectedBatch.id].map((expense) => {
                    const isSelected = selectedExpensesForCorrection.has(expense.id)
                    return (
                      <div 
                        key={expense.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-orange-50 border-orange-300 dark:bg-orange-950/40 dark:border-orange-600/70' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleExpenseForCorrection(expense.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 dark:bg-slate-900 dark:border-slate-700 dark:accent-orange-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                isSelected ? 'border-orange-300 dark:border-orange-600/50 dark:text-orange-300 dark:bg-orange-950/30' : ''
                              }`}
                            >
                              {getCategoryLabel(expense.category)}
                            </Badge>
                            {expense.expense_type && (
                              <Badge variant="secondary" className="text-xs">
                                {getExpenseTypeLabel(expense.expense_type)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {expense.expense_date ? formatDate(expense.expense_date) : 'Sem data'}
                            {expense.description && ` - ${expense.description}`}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">{formatCurrency(expense.amount)}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Carregando despesas...
                </p>
              )}
              
              {selectedExpensesForCorrection.size > 0 && (
                <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                  {selectedExpensesForCorrection.size} despesa(s) selecionada(s) para correção
                </p>
              )}
            </div>

            {/* Motivo da correção */}
            <div className="space-y-2">
              <Label>Descreva o que precisa ser corrigido *</Label>
              <Textarea
                placeholder="Ex: Comprovante ilegível, valor divergente, falta informação do estabelecimento..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRequestCorrection} 
              disabled={processing || selectedExpensesForCorrection.size === 0} 
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
              Solicitar Correção ({selectedExpensesForCorrection.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovar em Massa */}
      <Dialog open={approveAllModalOpen} onOpenChange={setApproveAllModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              Aprovar Despesas
            </DialogTitle>
            <DialogDescription>
              Selecione as despesas que deseja aprovar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Selecione as despesas para aprovar</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllExpensesForApprove}
                  >
                    Selecionar Todas
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedExpensesForApprove(new Set())}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              
              {selectedBatch && loadingExpenses.has(selectedBatch.id) ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : selectedBatch && batchExpenses[selectedBatch.id] ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 dark:border-slate-800">
                  {batchExpenses[selectedBatch.id]
                    .filter(e => e.status !== 'approved' && e.status !== 'rejected' && e.status !== 'correction')
                    .map((expense) => {
                    const isSelected = selectedExpensesForApprove.has(expense.id)
                    return (
                      <div 
                        key={expense.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-green-50 border-green-300 dark:bg-emerald-950/40 dark:border-emerald-600/70' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleExpenseForApprove(expense.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:bg-slate-900 dark:border-slate-700 dark:accent-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                isSelected ? 'border-green-300 dark:border-emerald-600/50 dark:text-emerald-300 dark:bg-emerald-950/30' : ''
                              }`}
                            >
                              {getCategoryLabel(expense.category)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {expense.expense_date ? formatDate(expense.expense_date) : 'Sem data'}
                            {expense.description && ` - ${expense.description}`}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">{formatCurrency(expense.amount)}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Carregando despesas...
                </p>
              )}
              
              {selectedExpensesForApprove.size > 0 && (
                <p className="text-sm text-green-600 dark:text-emerald-400 font-medium">
                  {selectedExpensesForApprove.size} despesa(s) selecionada(s) para aprovação
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveAllModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button 
              onClick={handleBulkApprove} 
              disabled={processing || selectedExpensesForApprove.size === 0} 
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Aprovar ({selectedExpensesForApprove.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeitar em Massa */}
      <Dialog open={rejectAllModalOpen} onOpenChange={setRejectAllModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              Rejeitar Despesas
            </DialogTitle>
            <DialogDescription>
              Selecione as despesas que deseja rejeitar e informe o motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Selecione as despesas para rejeitar</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={selectAllExpensesForReject}
                  >
                    Selecionar Todas
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedExpensesForReject(new Set())}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
              
              {selectedBatch && loadingExpenses.has(selectedBatch.id) ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="w-6 h-6" />
                </div>
              ) : selectedBatch && batchExpenses[selectedBatch.id] ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2 dark:border-slate-800">
                  {batchExpenses[selectedBatch.id]
                    .filter(e => e.status !== 'approved' && e.status !== 'rejected' && e.status !== 'correction')
                    .map((expense) => {
                    const isSelected = selectedExpensesForReject.has(expense.id)
                    return (
                      <div 
                        key={expense.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-600/70' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleExpenseForReject(expense.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 dark:bg-slate-900 dark:border-slate-700 dark:accent-red-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                isSelected ? 'border-red-300 dark:border-red-600/50 dark:text-red-300 dark:bg-red-950/30' : ''
                              }`}
                            >
                              {getCategoryLabel(expense.category)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {expense.expense_date ? formatDate(expense.expense_date) : 'Sem data'}
                            {expense.description && ` - ${expense.description}`}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">{formatCurrency(expense.amount)}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Carregando despesas...
                </p>
              )}
              
              {selectedExpensesForReject.size > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  {selectedExpensesForReject.size} despesa(s) selecionada(s) para rejeição
                </p>
              )}
            </div>

            {/* Motivo da rejeição */}
            <div className="space-y-2">
              <Label>Motivo da Rejeição *</Label>
              <Textarea
                placeholder="Descreva o motivo da rejeição..."
                value={bulkRejectionReason}
                onChange={(e) => setBulkRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectAllModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleBulkReject} 
              disabled={processing || selectedExpensesForReject.size === 0}
            >
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Rejeitar ({selectedExpensesForReject.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rejeição de Item Individual */}
      <Dialog open={rejectItemModalOpen} onOpenChange={setRejectItemModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Rejeitar Despesa
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição desta despesa específica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedExpenseForReject && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(selectedExpenseForReject.category)}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(selectedExpenseForReject.expense_date)}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(selectedExpenseForReject.amount)}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="itemRejectionReason">Motivo da Rejeição *</Label>
              <Textarea
                id="itemRejectionReason"
                placeholder="Ex: Comprovante inválido, valor acima do permitido, sem justificativa..."
                value={itemRejectionReason}
                onChange={(e) => setItemRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectItemModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectItem} disabled={processing}>
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Rejeitar Despesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Correção de Item Individual */}
      <Dialog open={correctionItemModalOpen} onOpenChange={setCorrectionItemModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Edit3 className="w-5 h-5" />
              Solicitar Correção
            </DialogTitle>
            <DialogDescription>
              Informe o que precisa ser corrigido nesta despesa. O funcionário será notificado.
            </DialogDescription>
          </DialogHeader>

          {selectedExpenseForCorrection && (
            <div className="py-2 px-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{getCategoryLabel(selectedExpenseForCorrection.category)}</p>
              <p className="text-sm text-muted-foreground">{formatDate(selectedExpenseForCorrection.expense_date)}</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(selectedExpenseForCorrection.amount)}</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>O que precisa ser corrigido? *</Label>
              <Textarea
                placeholder="Descreva o que precisa ser corrigido..."
                value={itemCorrectionReason}
                onChange={(e) => setItemCorrectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionItemModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleCorrectionItem} disabled={processing}>
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
              Solicitar Correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Visualização de Despesa - Iframe */}
      <Dialog open={viewExpenseModalOpen} onOpenChange={setViewExpenseModalOpen}>
        <DialogContent className="w-[95vw] max-w-7xl h-[90vh] p-0 overflow-hidden">
          <div className="sr-only">
            <DialogTitle>Detalhes da Despesa</DialogTitle>
            <DialogDescription>Visualização detalhada dos dados da despesa</DialogDescription>
          </div>
          {selectedExpenseForView && (
            <iframe
              src={`/expenses/${selectedExpenseForView.id}?embed=true`}
              className="w-full h-full border-0"
              title="Detalhes da Despesa"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Observações da Remessa */}
      <Dialog open={editBatchObsModalOpen} onOpenChange={setEditBatchObsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Pencil className="w-5 h-5" />
              Editar Observações da Remessa
            </DialogTitle>
            <DialogDescription>
              Edite as observações desta remessa. Apenas administradores podem fazer alterações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Observações do Funcionário</Label>
              <Textarea
                placeholder="Observações adicionadas pelo funcionário..."
                value={editObservations}
                onChange={(e) => setEditObservations(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações do Financeiro</Label>
              <Textarea
                placeholder="Observações internas do financeiro..."
                value={editFinanceObservations}
                onChange={(e) => setEditFinanceObservations(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBatchObsModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBatchObservations} disabled={processing}>
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Descrição da Despesa */}
      <Dialog open={editExpenseDescModalOpen} onOpenChange={setEditExpenseDescModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Pencil className="w-5 h-5" />
              Editar Despesa
            </DialogTitle>
            <DialogDescription>
              Edite a descrição/observação desta despesa. Apenas administradores podem fazer alterações.
            </DialogDescription>
          </DialogHeader>

          {selectedExpenseForEdit && (
            <div className="py-2 px-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{getCategoryLabel(selectedExpenseForEdit.category)}</p>
              <p className="text-sm text-muted-foreground">{formatDate(selectedExpenseForEdit.expense_date)}</p>
              <p className="text-sm font-semibold text-primary">{formatCurrency(selectedExpenseForEdit.amount)}</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descrição / Observação</Label>
              <Textarea
                placeholder="Descrição ou observação sobre esta despesa..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpenseDescModalOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={handleSaveExpenseDescription} disabled={processing}>
              {processing ? <Spinner className="w-4 h-4 mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
