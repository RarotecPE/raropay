"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { 
  CreditCard, 
  Calendar, 
  Eye,
  AlertTriangle,
  MessageSquare,
  Search,
  ChevronRight
} from "lucide-react"

import { PaginationControl } from "@/components/pagination-control"
import { PaginationMeta } from "@/lib/pagination"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

interface CardInvoice {
  id: number
  reference_month: string
  reference_name: string
  start_date: string
  end_date: string
  due_date: string
}

interface AnalysisRequest {
  id: number
  invoice_id: number
  subject: string
  status: 'pending' | 'in_progress' | 'resolved'
  created_at: string
  unread_count: number
  invoice_name: string
}

export default function MyInvoicesPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  
  type MyInvoiceItem = CardInvoice & { my_expense_count: number; my_total_amount: number }
  const { data: rawInvoices, isLoading: loadingInvoices } = useSWR<{ data: MyInvoiceItem[]; pagination: PaginationMeta } | MyInvoiceItem[]>(
    `/api/my-invoices?page=${page}&pageSize=${pageSize}&paginate=true`,
    fetcher
  )
  const invoices = Array.isArray(rawInvoices) ? rawInvoices : rawInvoices?.data || []
  const pagination = !Array.isArray(rawInvoices) ? rawInvoices?.pagination : undefined

  const { data: analysisRequests, isLoading: loadingRequests } = useSWR<AnalysisRequest[]>("/api/invoice-analysis", fetcher)
  const { data: user } = useSWR("/api/auth/session", fetcher)

  // Agrupar solicitações por fatura
  const requestsByInvoice = useMemo(() => {
    if (!analysisRequests || !Array.isArray(analysisRequests)) return {}
    return analysisRequests.reduce((acc, req) => {
      if (!acc[req.invoice_id]) {
        acc[req.invoice_id] = []
      }
      acc[req.invoice_id].push(req)
      return acc
    }, {} as Record<number, AnalysisRequest[]>)
  }, [analysisRequests])

  // Filtrar solicitações
  const filteredRequests = useMemo(() => {
    if (!analysisRequests || !Array.isArray(analysisRequests)) return []
    
    return analysisRequests.filter(req => {
      if (statusFilter !== "all" && req.status !== statusFilter) return false
      if (searchTerm && !req.subject.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !req.invoice_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [analysisRequests, statusFilter, searchTerm])

  // Contar pendentes
  const pendingCount = analysisRequests?.filter(r => r.status !== 'resolved').length || 0
  const unreadCount = analysisRequests?.reduce((acc, r) => acc + Number(r.unread_count || 0), 0) || 0

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70">
            Pendente
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/70">
            Em Andamento
          </Badge>
        )
      case 'resolved':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70">
            Resolvida
          </Badge>
        )
      default:
        return null
    }
  }

  if (loadingInvoices || loadingRequests) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-primary" />
          Minhas Faturas
        </h1>
        <p className="text-muted-foreground">
          Acompanhe as faturas do cartão corporativo e solicitações de análise
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Faturas Disponíveis</p>
                <p className="text-2xl font-bold">{pagination?.totalCount ?? invoices?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={pendingCount > 0 ? "border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${pendingCount > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
                <AlertTriangle className={`w-6 h-6 ${pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Análises Pendentes</p>
                <p className={`text-2xl font-bold ${pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={unreadCount > 0 ? "border-red-300 bg-red-50/50 dark:border-red-800/60 dark:bg-red-950/20" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${unreadCount > 0 ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"}`}>
                <MessageSquare className={`w-6 h-6 ${unreadCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground dark:text-slate-400">Mensagens Não Lidas</p>
                <p className={`text-2xl font-bold ${unreadCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{unreadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solicitações de Análise */}
      {analysisRequests && analysisRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Solicitações de Análise do Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por assunto ou fatura..."
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
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Solicitações */}
            <div className="space-y-3">
              {filteredRequests.map((request) => {
                const hasUnread = Number(request.unread_count) > 0
                return (
                  <div
                    key={request.id}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      hasUnread 
                        ? "border-red-300 bg-red-50/30 dark:border-red-800/60 dark:bg-red-950/20" 
                        : "border-border bg-card"
                    }`}
                    onClick={() => router.push(`/my-invoices/analysis/${request.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{request.subject}</h4>
                          {hasUnread && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {Number(request.unread_count)} nova(s)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground dark:text-slate-400">
                          Fatura: <span className="font-medium text-foreground">{request.invoice_name}</span> • Criada em {formatDate(request.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(request.status)}
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredRequests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação encontrada
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Faturas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Faturas do Cartão Corporativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <>
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const invoiceRequests = requestsByInvoice[invoice.id] || []
                const hasPending = invoiceRequests.some(r => r.status !== 'resolved')
                const hasUnread = invoiceRequests.some(r => Number(r.unread_count) > 0)
                
                return (
                  <div
                    key={invoice.id}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      hasUnread 
                        ? "border-red-300 bg-red-50/30 dark:border-red-800/60 dark:bg-red-950/20" 
                        : hasPending 
                          ? "border-amber-300 bg-amber-50/30 dark:border-amber-800/60 dark:bg-amber-950/20" 
                          : "border-border bg-card"
                    }`}
                    onClick={() => router.push(`/my-invoices/${invoice.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <CreditCard className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold flex items-center gap-2 text-foreground">
                            Fatura {invoice.reference_name}
                            {hasPending && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70">
                                Análise Pendente
                              </Badge>
                            )}
                            {hasUnread && (
                              <Badge className="bg-red-500 text-white text-xs">
                                Nova Mensagem
                              </Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground dark:text-slate-400 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {formatDate(invoice.start_date)} → {formatDate(invoice.end_date)}
                          </p>
                          <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1">
                            {invoice.my_expense_count} despesa{invoice.my_expense_count !== 1 ? 's' : ''} • <span className="font-medium text-foreground">{formatCurrency(Number(invoice.my_total_amount))}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <PaginationControl
                  currentPage={page}
                  pageSize={pageSize}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setPage(1)
                  }}
                  pageSizeOptions={[12, 24, 48]}
                />
              </div>
            )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma fatura disponível no momento</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
