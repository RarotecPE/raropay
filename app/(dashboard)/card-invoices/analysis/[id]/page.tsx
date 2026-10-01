"use client"

import { useState, useRef, use } from "react"
import { useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { 
  ArrowLeft,
  Calendar,
  MessageSquare,
  Paperclip,
  Send,
  FileText,
  Image as ImageIcon,
  X,
  Download,
  User,
  Building2,
  CheckCircle2,
  Plus,
  DollarSign,
  AlertCircle
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function formatDate(dateStr: string) {
  if (!dateStr) return "-"
  const dateOnly = dateStr.split('T')[0]
  const date = new Date(dateOnly + 'T12:00:00')
  if (isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

interface Attachment {
  id: number
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: number
  uploaded_by_name: string
  message_id?: number
}

interface Message {
  id: number
  sender_id: number
  sender_name: string
  sender_role: string
  message: string
  created_at: string
  read_at?: string
}

interface AnalysisRequest {
  id: number
  invoice_id: number
  employee_id: number
  employee_name: string
  requester_id: number
  requester_name: string
  subject: string
  status: 'pending' | 'in_progress' | 'resolved'
  created_at: string
  resolved_at?: string
  invoice_name: string
  start_date: string
  end_date: string
}

interface UploadedFile {
  file_name: string
  file_path: string
  file_type: string
  file_size: number
}

interface LinkedExpense {
  id: number
  expense_id: number
  reason?: string
  edited_at?: string
  edit_notes?: string
  description: string
  amount: number
  expense_date: string
  category: string
  status: string
  expense_type: string
}

interface AvailableExpense {
  id: number
  description: string
  amount: number
  expense_date: string
  category: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value)
}

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
  transport_voucher: "Vale-Transporte",
  other: "Outras Despesas"
}

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados para adicionar despesas
  const [showAddExpensesDialog, setShowAddExpensesDialog] = useState(false)
  const [selectedExpensesToAdd, setSelectedExpensesToAdd] = useState<{ expense_id: number; reason: string }[]>([])
  const [isAddingExpenses, setIsAddingExpenses] = useState(false)

  const { data, isLoading, error } = useSWR<{
    request: AnalysisRequest
    messages: Message[]
    attachments: Attachment[]
    linkedExpenses: LinkedExpense[]
  }>(`/api/invoice-analysis/${id}`, fetcher, {
    refreshInterval: 30000
  })

  // Buscar despesas disponíveis para adicionar
  const { data: availableExpenses } = useSWR<AvailableExpense[]>(
    showAddExpensesDialog ? `/api/invoice-analysis/${id}/link-expenses` : null,
    fetcher
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (uploadedFiles.length + files.length > 10) {
      toast.error("Máximo de 10 arquivos por mensagem")
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

  const toggleExpenseToAdd = (expenseId: number) => {
    setSelectedExpensesToAdd(prev => {
      const exists = prev.find(e => e.expense_id === expenseId)
      if (exists) {
        return prev.filter(e => e.expense_id !== expenseId)
      }
      return [...prev, { expense_id: expenseId, reason: '' }]
    })
  }

  const updateExpenseReason = (expenseId: number, reason: string) => {
    setSelectedExpensesToAdd(prev =>
      prev.map(e => e.expense_id === expenseId ? { ...e, reason } : e)
    )
  }

  const handleAddExpenses = async () => {
    if (selectedExpensesToAdd.length === 0) {
      toast.error("Selecione ao menos uma despesa")
      return
    }

    setIsAddingExpenses(true)

    try {
      const response = await fetch(`/api/invoice-analysis/${id}/link-expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: selectedExpensesToAdd })
      })

      if (!response.ok) {
        throw new Error("Erro ao adicionar despesas")
      }

      const result = await response.json()
      toast.success(`${result.added_count} despesa(s) adicionada(s) para revisão`)
      setShowAddExpensesDialog(false)
      setSelectedExpensesToAdd([])
      mutate(`/api/invoice-analysis/${id}`)
    } catch (error) {
      toast.error("Erro ao adicionar despesas")
    } finally {
      setIsAddingExpenses(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error("Digite uma mensagem")
      return
    }

    setIsSending(true)

    try {
      const response = await fetch(`/api/invoice-analysis/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          attachments: uploadedFiles
        })
      })

      if (!response.ok) {
        throw new Error("Erro ao enviar mensagem")
      }

      toast.success("Mensagem enviada")
      setMessage("")
      setUploadedFiles([])
      mutate(`/api/invoice-analysis/${id}`)
    } catch (error) {
      toast.error("Erro ao enviar mensagem")
    } finally {
      setIsSending(false)
    }
  }

  const handleResolve = async () => {
    setIsResolving(true)

    try {
      const response = await fetch(`/api/invoice-analysis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' })
      })

      if (!response.ok) {
        throw new Error("Erro ao resolver solicitação")
      }

      toast.success("Solicitação marcada como resolvida")
      mutate(`/api/invoice-analysis/${id}`)
    } catch (error) {
      toast.error("Erro ao resolver solicitação")
    } finally {
      setIsResolving(false)
    }
  }

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">Erro ao carregar solicitação</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const { request, messages = [], attachments = [], linkedExpenses = [] } = data

  const attachmentsByMessage = (attachments || []).reduce((acc, att) => {
    const key = att.message_id || 'initial'
    if (!acc[key]) acc[key] = []
    acc[key].push(att)
    return acc
  }, {} as Record<string | number, Attachment[]>)

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/card-invoices/${request.invoice_id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            {request.subject}
          </h1>
          <p className="text-muted-foreground">
            Fatura {request.invoice_name} • Funcionário: {request.employee_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(request.status)}
          {request.status !== 'resolved' && (
            <Button 
              variant="outline" 
              className="border-green-300 text-green-700 hover:bg-green-50"
              onClick={handleResolve}
              disabled={isResolving}
            >
              {isResolving ? (
                <Spinner className="w-4 h-4 mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Marcar Resolvida
            </Button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Funcionário</p>
                <p className="font-medium">{request.employee_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Período da Fatura</p>
                <p className="font-medium">{formatDate(request.start_date)} → {formatDate(request.end_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Solicitado por</p>
                <p className="font-medium">{request.requester_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Data da Solicitação</p>
                <p className="font-medium">{formatDateTime(request.created_at)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Despesas Vinculadas para Revisão */}
      <Card className="border-amber-500/25 bg-amber-500/5 dark:border-amber-500/30 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Despesas para Revisão
              {linkedExpenses.length > 0 && (
                <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50">
                  {linkedExpenses.length}
                </Badge>
              )}
            </CardTitle>
            {request.status !== 'resolved' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddExpensesDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Despesas
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Despesas marcadas para o funcionário verificar e/ou editar
          </p>
        </CardHeader>
        <CardContent>
          {linkedExpenses.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>Nenhuma despesa vinculada ainda.</p>
              <p className="text-sm">Clique em &quot;Adicionar Despesas&quot; para solicitar revisão de despesas específicas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedExpenses.map(expense => (
                <div 
                  key={expense.id}
                  className={`p-3 rounded-lg border bg-card ${
                    expense.edited_at ? 'border-green-300 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{expense.description}</span>
                        {expense.edited_at && (
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs">
                            Editada
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          {formatCurrency(Number(expense.amount))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(expense.expense_date)}
                        </span>
                        <span className="px-2 py-0.5 bg-muted rounded text-xs">
                          {categoryLabels[expense.category] || expense.category}
                        </span>
                      </div>
                      {expense.reason && (
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                          <strong>Motivo:</strong> {expense.reason}
                        </p>
                      )}
                      {expense.edit_notes && (
                        <p className="mt-1 text-sm text-green-700 dark:text-emerald-300">
                          <strong>Alterações:</strong> {expense.edit_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle>Conversa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            {messages.map((msg) => {
              const isFinancial = ['admin', 'financial'].includes(msg.sender_role)
              const messageAttachments = attachmentsByMessage[msg.id] || []
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isFinancial ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                    <div className={`rounded-lg p-4 ${
                      isFinancial 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {isFinancial ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span className="font-medium text-sm">{msg.sender_name}</span>
                        <span className={`text-xs ${isFinancial ? 'opacity-75' : 'text-muted-foreground'}`}>
                          {formatDateTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      
                      {messageAttachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {messageAttachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/invoice-analysis/file?pathname=${encodeURIComponent(att.file_path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded ${
                                isFinancial ? 'bg-primary-foreground/10' : 'bg-background'
                              } hover:opacity-80 transition-opacity`}
                            >
                              {getFileIcon(att.file_type)}
                              <span className="text-sm flex-1 truncate">{att.file_name}</span>
                              <span className="text-xs opacity-75">{formatFileSize(att.file_size)}</span>
                              <Download className="w-4 h-4" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {attachmentsByMessage['initial'] && attachmentsByMessage['initial'].length > 0 && (
              <div className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                  <div className="rounded-lg p-4 bg-primary text-primary-foreground">
                    <p className="text-sm opacity-75 mb-2">Anexos da solicitação:</p>
                    <div className="space-y-2">
                      {attachmentsByMessage['initial'].map((att) => (
                        <a
                          key={att.id}
                          href={`/api/invoice-analysis/file?pathname=${encodeURIComponent(att.file_path)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded bg-primary-foreground/10 hover:opacity-80 transition-opacity"
                        >
                          {getFileIcon(att.file_type)}
                          <span className="text-sm flex-1 truncate">{att.file_name}</span>
                          <span className="text-xs opacity-75">{formatFileSize(att.file_size)}</span>
                          <Download className="w-4 h-4" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Área de resposta */}
          {request.status !== 'resolved' && (
            <div className="border-t pt-4">
              <Textarea
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mb-3"
              />

              {uploadedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm"
                    >
                      {getFileIcon(file.file_type)}
                      <span className="truncate max-w-[150px]">{file.file_name}</span>
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

              <div className="flex items-center gap-2">
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
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || uploadedFiles.length >= 10}
                >
                  {isUploading ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </Button>
                <span className="text-xs text-muted-foreground flex-1">
                  {uploadedFiles.length}/10 arquivos
                </span>
                <Button onClick={handleSendMessage} disabled={isSending || !message.trim()}>
                  {isSending ? (
                    <Spinner className="w-4 h-4 mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          )}

          {request.status === 'resolved' && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-emerald-400 bg-green-50 dark:bg-emerald-950/30 p-4 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
                <span>Esta solicitação foi marcada como resolvida em {formatDateTime(request.resolved_at || '')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Adicionar Despesas */}
      <Dialog open={showAddExpensesDialog} onOpenChange={setShowAddExpensesDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Despesas para Revisão</DialogTitle>
            <DialogDescription>
              Selecione as despesas que o funcionário deve verificar ou editar. Uma mensagem será enviada automaticamente no chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!availableExpenses ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="w-6 h-6" />
              </div>
            ) : availableExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Não há mais despesas disponíveis para adicionar.</p>
                <p className="text-sm">Todas as despesas do período já foram vinculadas.</p>
              </div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {availableExpenses.map(expense => {
                  const isSelected = selectedExpensesToAdd.some(e => e.expense_id === expense.id)
                  return (
                    <div 
                      key={expense.id}
                      className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleExpenseToAdd(expense.id)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleExpenseToAdd(expense.id)}
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
                            value={selectedExpensesToAdd.find(e => e.expense_id === expense.id)?.reason || ''}
                            onChange={(e) => updateExpenseReason(expense.id, e.target.value)}
                            className="text-sm h-8"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {selectedExpensesToAdd.length > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {selectedExpensesToAdd.length} despesa(s) selecionada(s)
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddExpensesDialog(false)
              setSelectedExpensesToAdd([])
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddExpenses} 
              disabled={isAddingExpenses || selectedExpensesToAdd.length === 0}
            >
              {isAddingExpenses ? (
                <Spinner className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
