"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CreditCard,
  Plus,
  Calendar,
  Pencil,
  Trash2,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Banknote,
  ArrowRight,
  ChevronRight,
} from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then(res => res.json())

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

interface CardInvoice {
  id: number
  reference_month: string // Formato: YYYY-MM
  reference_name: string // Nome amigável: "Janeiro 2026"
  start_date: string
  end_date: string
  due_date: string
  notes?: string
  created_at: string
  updated_at: string
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

export default function CardInvoicesPage() {
  const router = useRouter()
  const { data: invoices, error, isLoading, mutate } = useSWR<CardInvoice[]>("/api/card-invoices", fetcher)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<CardInvoice | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<CardInvoice | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    start_date: "",
    end_date: "",
    due_date: "",
    notes: ""
  })

  useEffect(() => {
    if (editingInvoice) {
      // Extrair mês e ano do reference_month (formato YYYY-MM)
      const [year, month] = editingInvoice.reference_month.split('-').map(Number)
      
      // Extrair apenas a parte da data (YYYY-MM-DD) para os inputs HTML date
      const extractDate = (dateStr: string) => {
        if (!dateStr) return ""
        return dateStr.split('T')[0]
      }
      
      setFormData({
        month: month,
        year: year,
        start_date: extractDate(editingInvoice.start_date),
        end_date: extractDate(editingInvoice.end_date),
        due_date: extractDate(editingInvoice.due_date),
        notes: editingInvoice.notes || ""
      })
    } else {
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        start_date: "",
        end_date: "",
        due_date: "",
        notes: ""
      })
    }
  }, [editingInvoice])

  const handleOpenNew = () => {
    setEditingInvoice(null)
    setIsDialogOpen(true)
  }

  const handleEdit = (invoice: CardInvoice) => {
    setEditingInvoice(invoice)
    setIsDialogOpen(true)
  }

  const handleDelete = (invoice: CardInvoice) => {
    setDeletingInvoice(invoice)
    setIsDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.start_date || !formData.end_date || !formData.due_date) {
      toast.error("Preencha todas as datas obrigatórias")
      return
    }

    // Validar que data de início seja anterior à data de fechamento
    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      toast.error("A data de início deve ser anterior à data de fechamento")
      return
    }

    // Validar que data de fechamento seja anterior à data de vencimento
    if (new Date(formData.end_date) >= new Date(formData.due_date)) {
      toast.error("A data de fechamento deve ser anterior à data de vencimento")
      return
    }

    setIsSaving(true)
    try {
      const url = editingInvoice 
        ? `/api/card-invoices/${editingInvoice.id}`
        : "/api/card-invoices"
      
      const response = await fetch(url, {
        method: editingInvoice ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erro ao salvar")
      }

      toast.success(editingInvoice ? "Fatura atualizada!" : "Fatura criada!")
      setIsDialogOpen(false)
      setEditingInvoice(null)
      mutate()
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar fatura")
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingInvoice) return

    try {
      const response = await fetch(`/api/card-invoices/${deletingInvoice.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Erro ao excluir")
      }

      toast.success("Fatura excluída!")
      setIsDeleteDialogOpen(false)
      setDeletingInvoice(null)
      mutate()
    } catch (error) {
      toast.error("Erro ao excluir fatura")
    }
  }

  const getDueDateStatus = (dueDate: string) => {
    if (!dueDate) return { label: "Sem vencimento", color: "bg-gray-100 text-gray-800" }
    
    // Handle both YYYY-MM-DD and full ISO date strings
    const dateOnly = dueDate.split('T')[0]
    const due = new Date(dateOnly + 'T12:00:00')
    
    if (isNaN(due.getTime())) return { label: "Data inválida", color: "bg-gray-100 text-gray-800" }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { label: "Vencimento Encerrado", color: "bg-red-100 text-red-800" }
    } else {
      return { label: "Vencimento em dia", color: "bg-green-100 text-green-800" }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>Erro ao carregar faturas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-primary" />
            Faturas do Cartão Corporativo
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os períodos de fatura para cruzamento com despesas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNew}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Fatura
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingInvoice ? "Editar Fatura" : "Nova Fatura"}
              </DialogTitle>
              <DialogDescription>
                Defina o período de competência e as datas da fatura do cartão
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Competência */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="month">Mês de Competência</Label>
                  <Select
                    value={formData.month.toString()}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, month: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((name, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Select
                    value={formData.year.toString()}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, year: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027, 2028].map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Datas */}
              <div className="space-y-2">
                <Label htmlFor="start_date">
                  Data de Início <span className="text-muted-foreground text-xs">(despesas a partir de)</span>
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">
                  Data de Fechamento <span className="text-muted-foreground text-xs">(despesas até)</span>
                </Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">
                  Data de Vencimento <span className="text-muted-foreground text-xs">(pagamento)</span>
                </Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre esta fatura..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Spinner className="w-4 h-4 mr-2" />}
                {editingInvoice ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Como funciona?</p>
              <p className="mt-1">
                Cadastre os períodos de cada fatura do cartão corporativo. O sistema irá cruzar automaticamente 
                as despesas registradas com a data de início e fechamento informadas, permitindo verificar se 
                os valores batem com a fatura do banco.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Faturas */}
      {invoices && invoices.length > 0 ? (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const dueStatus = getDueDateStatus(invoice.due_date)
            
            return (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Info Principal */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
  <h3 className="font-semibold text-lg">
    Fatura {invoice.reference_name}
  </h3>
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
                        {invoice.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            {invoice.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 ml-auto">
                      <Badge className={dueStatus.color}>
                        {dueStatus.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/card-invoices/${invoice.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver Detalhes
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(invoice)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(invoice)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <CreditCard className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-lg">Nenhuma fatura cadastrada</h3>
              <p className="text-muted-foreground mt-1 max-w-md">
                Comece cadastrando os períodos de fatura do cartão corporativo para cruzar com as despesas registradas.
              </p>
              <Button className="mt-4" onClick={handleOpenNew}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Primeira Fatura
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fatura</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fatura de{" "}
              <strong>
                {deletingInvoice?.reference_name}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
