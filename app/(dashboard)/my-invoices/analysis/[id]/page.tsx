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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Edit3,
  AlertCircle,
  DollarSign
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
  other: "Outras Despesas"
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
  receipt_url?: string
  receipt_pathname?: string
  km_before?: number
  km_after?: number
  total_km?: number
}

const expenseTypeLabels: Record<string, string> = {
  corporate_card: "Cartão Corporativo",
  reimbursement: "Reembolso",
  advance: "Adiantamento"
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

export default function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados para edição de despesas
  const [editingExpense, setEditingExpense] = useState<LinkedExpense | null>(null)
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    expense_date: '',
    category: '',
    expense_type: '',
    km_before: '',
    km_after: '',
    total_km: ''
  })
  const [isSavingExpense, setIsSavingExpense] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error } = useSWR<{
    request: AnalysisRequest
    messages: Message[]
    attachments: Attachment[]
    linkedExpenses: LinkedExpense[]
  }>(`/api/invoice-analysis/${id}`, fetcher, {
    refreshInterval: 30000 // Atualizar a cada 30 segundos
  })

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Em Andamento</Badge>
      case 'resolved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Resolvida</Badge>
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

  const openEditExpense = (expense: LinkedExpense) => {
    setEditingExpense(expense)
    setEditForm({
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date.split('T')[0],
      category: expense.category,
      expense_type: expense.expense_type || 'corporate_card',
      km_before: expense.km_before != null ? expense.km_before.toString() : '',
      km_after: expense.km_after != null ? expense.km_after.toString() : '',
      total_km: expense.total_km != null ? expense.total_km.toString() : ''
    })
    setReceiptFile(null)
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error("Apenas imagens ou PDF são permitidos")
      return
    }

    setReceiptFile(file)
  }

  const handleSaveExpense = async () => {
    if (!editingExpense) return

    setIsSavingExpense(true)

    try {
      // Se tiver um arquivo de comprovante, fazer upload primeiro
      let receiptPathname = editingExpense.receipt_pathname
      if (receiptFile) {
        setIsUploadingReceipt(true)
        const formData = new FormData()
        formData.append('file', receiptFile)

        const uploadResponse = await fetch('/api/invoice-analysis/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          throw new Error('Erro ao enviar comprovante')
        }

        const uploadResult = await uploadResponse.json()
        receiptPathname = uploadResult.file_path
        setIsUploadingReceipt(false)
      }

      const response = await fetch(`/api/invoice-analysis/${id}/expenses/${editingExpense.expense_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          receipt_pathname: receiptPathname
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar')
      }

      toast.success("Despesa atualizada com sucesso!")
      setEditingExpense(null)
      setReceiptFile(null)
      mutate(`/api/invoice-analysis/${id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar despesa")
    } finally {
      setIsSavingExpense(false)
      setIsUploadingReceipt(false)
    }
  }

  // Verificar se é despesa de combustível/veículo
  const isVehicleExpense = editingExpense?.category === 'fuel' || editingExpense?.category === 'transport'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error || !data || !data.request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground mb-4">Erro ao carregar solicitação</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const { request, messages = [], attachments = [], linkedExpenses = [] } = data

  // Agrupar anexos por mensagem
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            {request.subject}
          </h1>
          <p className="text-muted-foreground">
            Fatura {request.invoice_name} • Solicitado por {request.requester_name}
          </p>
        </div>
        {getStatusBadge(request.status)}
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
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
      {linkedExpenses && linkedExpenses.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Despesas para Revisão
              <Badge variant="outline" className="ml-auto bg-amber-100 text-amber-800 border-amber-300">
                {linkedExpenses.length}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              O financeiro solicitou que você verifique e/ou edite as despesas abaixo
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {linkedExpenses.map(expense => (
                <div 
                  key={expense.id}
                  className={`p-4 rounded-lg border bg-white ${
                    expense.edited_at ? 'border-green-300' : 'border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{expense.description}</span>
                        {expense.edited_at && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
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
                        <p className="mt-2 text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded">
                          <strong>Motivo:</strong> {expense.reason}
                        </p>
                      )}
                      {expense.edit_notes && (
                        <p className="mt-2 text-sm text-green-700 bg-green-50 px-2 py-1 rounded">
                          <strong>Alterações:</strong> {expense.edit_notes}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openEditExpense(expense)}
                      disabled={request.status === 'resolved'}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  className={`flex ${isFinancial ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                    <div className={`rounded-lg p-4 ${
                      isFinancial 
                        ? 'bg-muted' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {isFinancial ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span className="font-medium text-sm">{msg.sender_name}</span>
                        <span className={`text-xs ${isFinancial ? 'text-muted-foreground' : 'opacity-75'}`}>
                          {formatDateTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      
                      {/* Anexos da mensagem */}
                      {messageAttachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {messageAttachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/invoice-analysis/file?pathname=${encodeURIComponent(att.file_path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded ${
                                isFinancial ? 'bg-background' : 'bg-primary-foreground/10'
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

            {/* Anexos iniciais (sem mensagem) */}
            {attachmentsByMessage['initial'] && attachmentsByMessage['initial'].length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                  <div className="rounded-lg p-4 bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Anexos da solicitação:</p>
                    <div className="space-y-2">
                      {attachmentsByMessage['initial'].map((att) => (
                        <a
                          key={att.id}
                          href={`/api/invoice-analysis/file?pathname=${encodeURIComponent(att.file_path)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded bg-background hover:opacity-80 transition-opacity"
                        >
                          {getFileIcon(att.file_type)}
                          <span className="text-sm flex-1 truncate">{att.file_name}</span>
                          <span className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</span>
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
                placeholder="Digite sua resposta..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mb-3"
              />

              {/* Arquivos anexados */}
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
                  {uploadedFiles.length}/10 arquivos (PDF ou imagens, máx. 10MB cada)
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

          {/* Status resolvido */}
          {request.status === 'resolved' && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
                <span>Esta solicitação foi marcada como resolvida em {formatDateTime(request.resolved_at || '')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição de Despesa */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
            <DialogDescription>
              Edite os campos da despesa conforme solicitado pelo financeiro. As alterações serão registradas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editForm.expense_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, expense_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={editForm.category} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={editForm.expense_type} 
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, expense_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(expenseTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campos de Hodômetro (visíveis para despesas de veículo) */}
            {isVehicleExpense && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium">Hodômetro (Km)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Km Inicial</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.km_before}
                      onChange={(e) => {
                        const kmBefore = e.target.value
                        const kmAfter = editForm.km_after
                        const totalKm = kmAfter && kmBefore ? (parseFloat(kmAfter) - parseFloat(kmBefore)).toString() : editForm.total_km
                        setEditForm(prev => ({ ...prev, km_before: kmBefore, total_km: totalKm }))
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Km Final</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.km_after}
                      onChange={(e) => {
                        const kmAfter = e.target.value
                        const kmBefore = editForm.km_before
                        const totalKm = kmAfter && kmBefore ? (parseFloat(kmAfter) - parseFloat(kmBefore)).toString() : editForm.total_km
                        setEditForm(prev => ({ ...prev, km_after: kmAfter, total_km: totalKm }))
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Km Total</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={editForm.total_km}
                      onChange={(e) => setEditForm(prev => ({ ...prev, total_km: e.target.value }))}
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Upload de Comprovante */}
            <div className="space-y-2">
              <Label>Comprovante / Nota Fiscal</Label>
              <div className="flex items-center gap-3">
                {editingExpense?.receipt_pathname && !receiptFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Comprovante atual anexado</span>
                  </div>
                )}
                {receiptFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <FileText className="w-4 h-4" />
                    <span>{receiptFile.name}</span>
                    <button onClick={() => setReceiptFile(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleReceiptUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => receiptInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4 mr-1" />
                  {editingExpense?.receipt_pathname ? 'Substituir' : 'Anexar'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExpense(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveExpense} disabled={isSavingExpense || isUploadingReceipt}>
              {(isSavingExpense || isUploadingReceipt) ? (
                <Spinner className="w-4 h-4 mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
