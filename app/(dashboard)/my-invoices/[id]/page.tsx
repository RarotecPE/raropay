"use client"

import { useState, useMemo, use } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { 
  ArrowLeft,
  CreditCard,
  Calendar,
  Search,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronRight
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

function formatDate(dateStr: string) {
  if (!dateStr) return "-"
  const dateOnly = dateStr.split('T')[0]
  const date = new Date(dateOnly + 'T12:00:00')
  if (isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

interface Expense {
  id: number
  description: string
  amount: number
  category: string
  expense_date: string
  status: string
}

interface AnalysisRequest {
  id: number
  subject: string
  status: string
  created_at: string
  unread_count: number
}

export default function MyInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const { data: invoiceData, isLoading: loadingInvoice } = useSWR(
    `/api/my-invoices/${id}`,
    fetcher
  )

  const { data: analysisRequests } = useSWR<AnalysisRequest[]>(
    `/api/invoice-analysis?invoice_id=${id}`,
    fetcher
  )

  // A API /api/my-invoices/[id] já retorna apenas as despesas do usuário logado
  const myExpenses = invoiceData?.expenses || []

  // Filtrar por busca e status
  const filteredExpenses = useMemo(() => {
    return myExpenses.filter((expense: Expense) => {
      if (statusFilter !== "all" && expense.status !== statusFilter) return false
      if (searchTerm && !expense.description.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [myExpenses, statusFilter, searchTerm])

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: myExpenses.length,
      totalAmount: myExpenses.reduce((sum: number, e: Expense) => sum + Number(e.amount), 0),
      approved: myExpenses.filter((e: Expense) => e.status === 'approved').length,
      approvedAmount: myExpenses.filter((e: Expense) => e.status === 'approved').reduce((sum: number, e: Expense) => sum + Number(e.amount), 0),
      pending: myExpenses.filter((e: Expense) => e.status === 'pending').length,
      pendingAmount: myExpenses.filter((e: Expense) => e.status === 'pending').reduce((sum: number, e: Expense) => sum + Number(e.amount), 0),
      rejected: myExpenses.filter((e: Expense) => e.status === 'rejected').length,
      rejectedAmount: myExpenses.filter((e: Expense) => e.status === 'rejected').reduce((sum: number, e: Expense) => sum + Number(e.amount), 0),
    }
  }, [myExpenses])

  // Solicitações pendentes para esta fatura
  const pendingRequests = analysisRequests?.filter(r => r.status !== 'resolved') || []
  const hasUnread = analysisRequests?.some(r => r.unread_count > 0) || false

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border dark:border-emerald-800/50">Aprovada</Badge>
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:border dark:border-amber-800/50">Em Análise</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 dark:border dark:border-red-800/50">Rejeitada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!invoiceData?.invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">Fatura não encontrada</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const { invoice } = invoiceData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/my-invoices')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Fatura {invoice.reference_name}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(invoice.start_date)} → {formatDate(invoice.end_date)}
          </p>
        </div>
      </div>

      {/* Alerta de Solicitações Pendentes */}
      {pendingRequests.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  {pendingRequests.length} Solicitação(ões) de Análise Pendente(s)
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  O financeiro solicitou sua análise para esta fatura. Por favor, verifique e responda.
                </p>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/my-invoices/analysis/${req.id}`)}
                    >
                      <div>
                        <p className="font-medium">{req.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          Criada em {formatDate(req.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.unread_count > 0 && (
                          <Badge className="bg-red-500 text-white">
                            {req.unread_count} nova(s)
                          </Badge>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Minhas Despesas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-emerald-950/50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-emerald-400">{stats.approved}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.approvedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.rejectedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Despesas */}
      <Card>
        <CardHeader>
          <CardTitle>Minhas Despesas nesta Fatura</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar despesas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="approved">Aprovadas</SelectItem>
                <SelectItem value="pending">Em Análise</SelectItem>
                <SelectItem value="rejected">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          {filteredExpenses.length > 0 ? (
            <div className="space-y-3">
              {filteredExpenses.map((expense: Expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{expense.description}</span>
                      {getStatusBadge(expense.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {categoryLabels[expense.category] || expense.category} • {formatDate(expense.expense_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(Number(expense.amount))}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma despesa encontrada neste período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
