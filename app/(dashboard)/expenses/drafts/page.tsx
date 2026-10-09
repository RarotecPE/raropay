'use client'

// Página de Rascunhos - v2 (Processar Despesa)
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { PaginationControl } from '@/components/pagination-control'
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/format'
import { categoryLabels, expenseTypeLabels, type Expense } from '@/lib/types'
import {
  FileText,
  PlusCircle,
  Pencil,
  Trash2,
  Send,
  MoreVertical,
  Eye,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function DraftsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  function openViewModal(expense: Expense) {
    setSelectedExpense(expense)
    setViewModalOpen(true)
  }

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('status', 'draft')
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const response = await fetch(`/api/expenses?${params.toString()}`)
      const data = await response.json()
      
      if (response.ok && data.data && data.pagination) {
        setExpenses(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotalCount(data.pagination.totalCount)
      } else if (response.ok && Array.isArray(data)) {
        setExpenses(data)
        setTotalPages(1)
        setTotalCount(data.length)
      } else {
        setExpenses([])
        setTotalPages(1)
        setTotalCount(0)
      }
    } catch (error) {
      console.error('Erro ao buscar rascunhos:', error)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  async function handleProcessExpense(expense: Expense) {
    setActionLoading(expense.id)
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expense,
          status: 'pending', // A API converte 'pending' para 'processed'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao processar despesa')
      }

      toast.success('Despesa processada! Vá em "Enviar Prestação" para enviar ao financeiro.')
      fetchDrafts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar despesa')
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(id: number) {
    setActionLoading(id)
    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Erro ao excluir despesa')
      }

      toast.success('Rascunho excluído')
      fetchDrafts()
    } catch (error) {
      toast.error('Erro ao excluir rascunho')
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rascunhos</h1>
          <p className="text-muted-foreground">
            Despesas salvas que ainda não foram enviadas
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Despesa
          </Link>
        </Button>
      </div>

      {!Array.isArray(expenses) || expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-3 rounded-full bg-muted mb-4">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Nenhum rascunho</h3>
              <p className="text-muted-foreground mb-4">
                Você não possui despesas salvas como rascunho.
              </p>
              <Button asChild>
                <Link href="/expenses/new">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Criar Nova Despesa
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 overflow-hidden">
          {(Array.isArray(expenses) ? expenses : []).map((expense) => (
            <Card key={expense.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1 overflow-hidden">
                  <div className="hidden sm:block p-3 rounded-lg bg-muted shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">
                        {categoryLabels[expense.category]}
                      </h3>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {expenseTypeLabels[expense.expense_type]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <span className="shrink-0">{formatDate(expense.expense_date)}</span>
                      {expense.municipality && (
                        <>
                          <span className="shrink-0">-</span>
                          <span className="truncate">{expense.municipality}/{expense.state}</span>
                        </>
                      )}
                    </div>
                    {expense.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1 max-w-full">
                        {expense.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={actionLoading === expense.id}>
                        {actionLoading === expense.id ? (
                          <Spinner className="w-4 h-4" />
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openViewModal(expense)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizar Card
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/expenses/${expense.id}/edit`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleProcessExpense(expense)}>
                        <Send className="w-4 h-4 mr-2" />
                        Processar Despesa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => e.preventDefault()}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir rascunho?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O rascunho será permanentemente excluído.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(expense.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
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
          itemName="rascunhos"
          disabled={loading}
        />
      )}

      {/* Modal de Visualização do Card */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="w-[95vw] max-w-7xl h-[90vh] p-0 overflow-hidden">
          <div className="sr-only">
            <DialogTitle>Visualizar Card da Despesa</DialogTitle>
            <DialogDescription>Visualização detalhada do card de despesa</DialogDescription>
          </div>
          {selectedExpense && (
            <iframe
              src={`/expenses/${selectedExpense.id}?embed=true`}
              className="w-full h-full border-0"
              title="Visualização do Card da Despesa"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
