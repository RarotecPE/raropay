"use client"

import { useState, useMemo, use, useRef } from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate as swrMutate } from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CreditCard,
  Calendar,
  ArrowLeft,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Banknote,
  User,
  ArrowRight,
  TrendingUp,
  PieChart,
  Search,
  XCircle,
  Package,
  MessageSquare,
  Paperclip,
  Send,
  X,
  Image as ImageIcon,
  ChevronRight,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExpenseCard } from "@/components/expense-card"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then(res => res.json())

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const categoryLabels: Record<string, string> = {
  fuel: "Combustível",
  food: "Alimentação",
  transport: "Transporte",
  accommodation: "Hospedagem",
  office_supplies: "Material de Escritório",
  travel: "Viagem",
  communication: "Comunicação",
  maintenance: "Manutenção",
  parking: "Estacionamento",
  meal_voucher: "Vale-Refeição",
  other: "Outras Despesas"
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  processed: "Processada",
  submitted: "Enviada",
  pending: "Pendente",
  analysis: "Em Análise",
  approved: "Aprovada",
  rejected: "Rejeitada",
  correction: "Correção"
}

function formatDate(dateStr: string) {
  if (!dateStr) return "-"
  // Handle both YYYY-MM-DD and full ISO date strings
  const dateOnly = dateStr.split('T')[0]
  const date = new Date(dateOnly + 'T12:00:00')
  if (isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value || 0)
}

interface InvoiceData {
  invoice: {
    id: number
    reference_month: string // Formato YYYY-MM
    reference_name: string // Nome amigável: "Janeiro 2026"
    start_date: string
    end_date: string
    due_date: string
    notes?: string
  }
  expenses: any[]
  stats: {
    total_expenses: number
    total_amount: number
    approved_count: number
    approved_amount: number
    pending_count: number
    pending_amount: number
    rejected_count: number
    rejected_amount: number
  }
  byEmployee: { id: number; name: string; count: number; total: number }[]
  byCategory: { category: string; count: number; total: number }[]
}

export default function CardInvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { data, error, isLoading, mutate } = useSWR<InvoiceData>(
    `/api/card-invoices/${resolvedParams.id}`,
    fetcher
  )
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState("all")
  const [employeeFilter, setEmployeeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Solicitação de análise
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null)
  const [analysisSubject, setAnalysisSubject] = useState("")
  const [analysisMessage, setAnalysisMessage] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<{ file_name: string; file_path: string; file_type: string; file_size: number }[]>([])
  const [selectedExpenses, setSelectedExpenses] = useState<{ expense_id: number; reason: string }[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSendingAnalysis, setIsSendingAnalysis] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Buscar solicitações de análise existentes
  const { data: analysisRequests } = useSWR(
    `/api/invoice-analysis?invoice_id=${resolvedParams.id}`,
    fetcher
  )

  // Filtrar despesas
  const filteredExpenses = useMemo(() => {
    if (!data?.expenses) return []
    
    return data.expenses.filter(expense => {
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter
      const matchesEmployee = employeeFilter === "all" || expense.user_id.toString() === employeeFilter
      const matchesSearch = !searchTerm || 
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesStatus && matchesEmployee && matchesSearch
    })
  }, [data?.expenses, statusFilter, employeeFilter, searchTerm])

  // Estatísticas filtradas
  const filteredStats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const approved = filteredExpenses.filter(e => e.status === 'approved')
    const pending = filteredExpenses.filter(e => ['pending', 'submitted', 'analysis'].includes(e.status))
    const rejected = filteredExpenses.filter(e => e.status === 'rejected')
    
    return {
      total_expenses: filteredExpenses.length,
      total_amount: total,
      approved_count: approved.length,
      approved_amount: approved.reduce((sum, e) => sum + Number(e.amount), 0),
      pending_count: pending.length,
      pending_amount: pending.reduce((sum, e) => sum + Number(e.amount), 0),
      rejected_count: rejected.length,
      rejected_amount: rejected.reduce((sum, e) => sum + Number(e.amount), 0)
    }
  }, [filteredExpenses])

  // Dados filtrados por funcionário e categoria (recalculados com base nos filtros)
  const filteredByEmployee = useMemo(() => {
    const employeeMap = new Map<number, { id: number; name: string; count: number; total: number }>()
    
    filteredExpenses.forEach(expense => {
      const existing = employeeMap.get(expense.user_id)
      if (existing) {
        existing.count++
        existing.total += Number(expense.amount)
      } else {
        employeeMap.set(expense.user_id, {
          id: expense.user_id,
          name: expense.user_name || 'Desconhecido',
          count: 1,
          total: Number(expense.amount)
        })
      }
    })
    
    return Array.from(employeeMap.values()).sort((a, b) => b.total - a.total)
  }, [filteredExpenses])

  const filteredByCategory = useMemo(() => {
    const categoryMap = new Map<string, { category: string; count: number; total: number }>()
    
    filteredExpenses.forEach(expense => {
      const cat = expense.category || 'other'
      const existing = categoryMap.get(cat)
      if (existing) {
        existing.count++
        existing.total += Number(expense.amount)
      } else {
        categoryMap.set(cat, {
          category: cat,
          count: 1,
          total: Number(expense.amount)
        })
      }
    })
    
    return Array.from(categoryMap.values()).sort((a, b) => b.total - a.total)
  }, [filteredExpenses])

  // Funções de upload para solicitação de análise
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (uploadedFiles.length + files.length > 10) {
      toast.error("Máximo de 10 arquivos por solicitação")
      return
    }

    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/invoice-analysis/upload', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro no upload')
        }

        const result = await response.json()
        setUploadedFiles(prev => [...prev, result])
      }
      toast.success("Arquivo(s) enviado(s)")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar arquivo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSendAnalysisRequest = async () => {
    if (!selectedEmployee || !analysisSubject.trim() || !analysisMessage.trim()) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    setIsSendingAnalysis(true)

    try {
      const response = await fetch('/api/invoice-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: parseInt(resolvedParams.id),
          employee_id: selectedEmployee,
          subject: analysisSubject.trim(),
          message: analysisMessage.trim(),
          attachments: uploadedFiles,
          linked_expenses: selectedExpenses
        })
      })

      if (!response.ok) {
        throw new Error("Erro ao criar solicitação")
      }

      toast.success("Solicitação de análise enviada!")
      setShowAnalysisDialog(false)
      setSelectedEmployee(null)
      setAnalysisSubject("")
      setAnalysisMessage("")
      setUploadedFiles([])
      setSelectedExpenses([])
      swrMutate(`/api/invoice-analysis?invoice_id=${resolvedParams.id}`)
    } catch (error) {
      toast.error("Erro ao enviar solicitação")
    } finally {
      setIsSendingAnalysis(false)
    }
  }

  // Despesas do funcionário selecionado
  const employeeExpenses = useMemo(() => {
    if (!selectedEmployee || !data?.expenses) return []
    return data.expenses.filter(e => e.user_id === selectedEmployee)
  }, [selectedEmployee, data?.expenses])

  const toggleExpenseSelection = (expenseId: number) => {
    setSelectedExpenses(prev => {
      const exists = prev.find(e => e.expense_id === expenseId)
      if (exists) {
        return prev.filter(e => e.expense_id !== expenseId)
      }
      return [...prev, { expense_id: expenseId, reason: '' }]
    })
  }

  const updateExpenseReason = (expenseId: number, reason: string) => {
    setSelectedExpenses(prev => 
      prev.map(e => e.expense_id === expenseId ? { ...e, reason } : e)
    )
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />
    }
    return <FileText className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Gerar PDF
  const downloadPDF = async () => {
    if (!data) return

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ])

    const doc = new jsPDF()
    const { invoice } = data

    // Header
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 0, 210, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text(`Fatura ${invoice.reference_name}`, 14, 18)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Período: ${formatDate(invoice.start_date)} a ${formatDate(invoice.end_date)}`, 14, 26)
    doc.text(`Vencimento: ${formatDate(invoice.due_date)}`, 14, 32)

    // Resumo
    doc.setTextColor(0, 0, 0)
    let y = 45
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Resumo da Fatura", 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`Total de Despesas: ${filteredStats.total_expenses}`, 14, y)
    doc.text(`Valor Total: ${formatCurrency(filteredStats.total_amount)}`, 100, y)
    y += 6
    doc.text(`Aprovadas: ${filteredStats.approved_count} (${formatCurrency(filteredStats.approved_amount)})`, 14, y)
    doc.text(`Pendentes: ${filteredStats.pending_count} (${formatCurrency(filteredStats.pending_amount)})`, 100, y)
    y += 6
    doc.text(`Rejeitadas: ${filteredStats.rejected_count} (${formatCurrency(filteredStats.rejected_amount)})`, 14, y)
    y += 12

    // Por Funcionário
    if (data.byEmployee.length > 0) {
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Despesas por Funcionário", 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [["Funcionário", "Qtd", "Valor"]],
        body: data.byEmployee.map(e => [e.name, e.count.toString(), formatCurrency(Number(e.total))]),
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
      })

      y = (doc as any).lastAutoTable.finalY + 10
    }

    // Por Categoria
    if (data.byCategory.length > 0) {
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Despesas por Categoria", 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [["Categoria", "Qtd", "Valor"]],
        body: data.byCategory.map(c => [
          categoryLabels[c.category] || c.category,
          c.count.toString(),
          formatCurrency(Number(c.total))
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
      })

      y = (doc as any).lastAutoTable.finalY + 10
    }

    // Lista de Despesas
    if (filteredExpenses.length > 0) {
      if (y > 240) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Lista de Despesas", 14, y)
      y += 4

      autoTable(doc, {
        startY: y,
        head: [["Data", "Funcionário", "Categoria", "Descrição", "Status", "Valor"]],
        body: filteredExpenses.map(e => [
          formatDate(e.expense_date),
          e.user_name,
          categoryLabels[e.category] || e.category,
          (e.description || "-").substring(0, 30) + (e.description?.length > 30 ? "..." : ""),
          statusLabels[e.status] || e.status,
          formatCurrency(Number(e.amount))
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 64, 175] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
        columnStyles: {
          3: { cellWidth: 40 }
        }
      })
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text(
        `Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} - Página ${i} de ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      )
    }

    doc.save(`fatura-${invoice.reference_name.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error || !data || !data.invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Erro ao carregar fatura ou acesso negado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>
    )
  }

  const { invoice, stats, byEmployee, byCategory } = data
  
  // Usar dados filtrados quando há filtro aplicado
  const hasFilters = employeeFilter !== "all" || statusFilter !== "all"
  const displayStats = hasFilters ? filteredStats : stats
  const displayByEmployee = hasFilters ? filteredByEmployee : byEmployee
  const displayByCategory = hasFilters ? filteredByCategory : byCategory

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/card-invoices")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-primary" />
              Fatura {invoice.reference_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(invoice.start_date)} 
                <ArrowRight className="w-3 h-3" />
                {formatDate(invoice.end_date)}
              </span>
              <span className="flex items-center gap-1">
                <Banknote className="w-4 h-4" />
                Vencimento: {formatDate(invoice.due_date)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAnalysisDialog(true)}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Solicitar Análise
          </Button>
          <Button onClick={downloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </div>

      {/* Solicitações de Análise Existentes */}
      {analysisRequests && analysisRequests.length > 0 && (
        <Card className="border-blue-500/25 bg-blue-500/5 dark:border-blue-500/30 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Solicitações de Análise
              <Badge variant="outline" className="ml-auto">
                {analysisRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysisRequests.map((req: { id: number; subject: string; status: string; employee_name: string; created_at: string; unread_count: number }) => (
                <div
                  key={req.id}
                  className={`flex items-center justify-between p-3 rounded-lg bg-card cursor-pointer hover:bg-muted/50 ${
                    req.unread_count > 0 ? 'border-2 border-red-300 dark:border-red-800' : 'border border-border'
                  }`}
                  onClick={() => router.push(`/card-invoices/analysis/${req.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{req.subject}</span>
                      {req.unread_count > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {req.unread_count} nova(s)
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {req.employee_name} • {formatDate(req.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50' :
                      req.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50' :
                      'bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50'
                    }>
                      {req.status === 'pending' ? 'Pendente' : 
                       req.status === 'in_progress' ? 'Em Andamento' : 'Resolvida'}
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {invoice.notes && (
        <Card className="bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">Observações</p>
                <p className="mt-1 text-amber-800/90 dark:text-amber-300/90">{invoice.notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Despesas</p>
                <p className="text-2xl font-bold">{displayStats.total_expenses}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(displayStats.total_amount))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-emerald-950/50">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-emerald-400">{displayStats.approved_count}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(displayStats.approved_amount))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{displayStats.pending_count}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(displayStats.pending_amount))}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/50">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{displayStats.rejected_count}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(displayStats.rejected_amount))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Por Funcionário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              Por Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
{displayByEmployee.length > 0 ? (
  <div className="space-y-3">
{displayByEmployee.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {emp.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.count} despesa(s)</p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(emp.total))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhuma despesa encontrada</p>
            )}
          </CardContent>
        </Card>

        {/* Por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="w-5 h-5" />
              Por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
{displayByCategory.length > 0 ? (
  <div className="space-y-3">
{displayByCategory.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{categoryLabels[cat.category] || cat.category}</p>
                      <p className="text-xs text-muted-foreground">{cat.count} despesa(s)</p>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(cat.total))}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Nenhuma despesa encontrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Despesas do Período</CardTitle>
          <CardDescription>
            Todas as despesas de cartão corporativo entre {formatDate(invoice.start_date)} e {formatDate(invoice.end_date)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Descrição ou funcionário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="approved">Aprovadas</SelectItem>
                  <SelectItem value="analysis">Em Análise</SelectItem>
                  <SelectItem value="submitted">Enviadas</SelectItem>
                  <SelectItem value="rejected">Rejeitadas</SelectItem>
                  <SelectItem value="processed">Processadas</SelectItem>
                  <SelectItem value="draft">Rascunhos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {byEmployee.map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resumo filtrado */}
          {(statusFilter !== "all" || employeeFilter !== "all" || searchTerm) && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Mostrando {filteredStats.total_expenses} despesa(s)
              </span>
              <span className="font-semibold">
                {formatCurrency(filteredStats.total_amount)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Despesas */}
      {filteredExpenses.length > 0 ? (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onUpdate={() => mutate()}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <CreditCard className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">Nenhuma despesa encontrada</h3>
              <p className="text-muted-foreground mt-1">
                Não há despesas de cartão corporativo no período selecionado com os filtros aplicados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Solicitação de Análise */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Análise ao Funcionário</DialogTitle>
            <DialogDescription>
              Envie uma solicitação de conferência ou ajuste para o funcionário verificar suas despesas desta fatura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select 
                value={selectedEmployee?.toString() || ""} 
                onValueChange={(v) => {
                  setSelectedEmployee(parseInt(v))
                  setSelectedExpenses([]) // Limpar despesas ao mudar funcionário
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {byEmployee.map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name} ({emp.count} despesa{emp.count !== 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleção de despesas para revisão */}
            {selectedEmployee && employeeExpenses.length > 0 && (
              <div className="space-y-2">
                <Label>Despesas para Revisão (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione as despesas específicas que precisam ser conferidas ou editadas pelo funcionário
                </p>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {employeeExpenses.map(expense => {
                    const isSelected = selectedExpenses.some(e => e.expense_id === expense.id)
                    return (
                      <div 
                        key={expense.id}
                        className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleExpenseSelection(expense.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleExpenseSelection(expense.id)}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm truncate">{expense.description}</span>
                              <span className="font-semibold text-sm ml-2">{formatCurrency(Number(expense.amount))}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{formatDate(expense.expense_date)}</span>
                              <span>•</span>
                              <span>{categoryLabels[expense.category] || expense.category}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-2 ml-6" onClick={e => e.stopPropagation()}>
                            <Input
                              placeholder="Motivo da revisão (opcional)"
                              value={selectedExpenses.find(e => e.expense_id === expense.id)?.reason || ''}
                              onChange={(e) => updateExpenseReason(expense.id, e.target.value)}
                              className="text-sm h-8"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedExpenses.length > 0 && (
                  <p className="text-xs text-blue-600">
                    {selectedExpenses.length} despesa(s) selecionada(s) para revisão
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Assunto *</Label>
              <Input
                placeholder="Ex: Conferência de despesas - Fevereiro 2026"
                value={analysisSubject}
                onChange={(e) => setAnalysisSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                placeholder="Descreva o que precisa ser conferido ou ajustado..."
                value={analysisMessage}
                onChange={(e) => setAnalysisMessage(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Anexos (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Anexe prints da fatura do cartão ou outros documentos (até 10 arquivos, PDF ou imagens)
              </p>
              
              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm"
                    >
                      {getFileIcon(file.file_type)}
                      <span className="truncate max-w-[120px]">{file.file_name}</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || uploadedFiles.length >= 10}
              >
                {isUploading ? (
                  <Spinner className="w-4 h-4 mr-2" />
                ) : (
                  <Paperclip className="w-4 h-4 mr-2" />
                )}
                Anexar Arquivo
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalysisDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendAnalysisRequest} 
              disabled={isSendingAnalysis || !selectedEmployee || !analysisSubject.trim() || !analysisMessage.trim()}
            >
              {isSendingAnalysis ? (
                <Spinner className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
