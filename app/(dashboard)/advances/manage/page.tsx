'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { Wallet, Check, X, MessageSquare, Clock, Eye } from 'lucide-react'
import { formatCurrency, getCategoryLabel } from '@/lib/format'
import {
  ADVANCE_STATUS_LABELS, ADVANCE_STATUS_CLASSES, PAYMENT_METHOD_LABELS,
} from '@/lib/advance-constants'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface AdvanceRequest {
  id: number
  user_id: number
  amount: string
  payment_method: string
  category: string
  categories: string[] | null
  boleto_code: string | null
  reason: string
  city: string | null
  status: string
  employee_name: string
  employee_department: string | null
  created_at: string
  message_count: number
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'clarification', label: 'Em esclarecimento' },
]

type ActionType = 'approved' | 'rejected' | 'clarification'

export default function ManageAdvancesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  // Dialog de ação
  const [actionTarget, setActionTarget] = useState<AdvanceRequest | null>(null)
  const [actionType, setActionType] = useState<ActionType>('approved')
  const [reviewNote, setReviewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Proteção de acesso: apenas financeiro
  useEffect(() => {
    if (!authLoading && user && user.role !== 'financial') {
      router.replace('/dashboard')
    }
  }, [authLoading, user, router])

  async function loadRequests() {
    try {
      const res = await fetch('/api/advance-requests')
      if (res.ok) setRequests(await res.json())
      else if (res.status === 401) router.replace('/login')
    } catch {
      toast.error('Erro ao carregar solicitações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(
    () => (statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)),
    [requests, statusFilter]
  )

  // Resumo
  const summary = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length
    const approvedAmount = requests
      .filter((r) => r.status === 'approved')
      .reduce((sum, r) => sum + Number(r.amount), 0)
    const totalAmount = requests.reduce((sum, r) => sum + Number(r.amount), 0)
    return { pending, approvedAmount, totalAmount, total: requests.length }
  }, [requests])

  // Gráfico: total solicitado por funcionário (todas as solicitações)
  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of requests) {
      map.set(r.employee_name, (map.get(r.employee_name) || 0) + Number(r.amount))
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [requests])

  function openAction(req: AdvanceRequest, type: ActionType) {
    setActionTarget(req)
    setActionType(type)
    setReviewNote('')
  }

  async function submitAction() {
    if (!actionTarget) return
    if (actionType === 'clarification' && !reviewNote.trim()) {
      toast.error('Escreva o que precisa ser esclarecido')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/advance-requests/${actionTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: actionType, review_note: reviewNote || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao atualizar')
        return
      }
      toast.success('Solicitação atualizada!')
      setActionTarget(null)
      loadRequests()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Spinner /> Carregando...
      </div>
    )
  }

  const actionLabels: Record<ActionType, string> = {
    approved: 'Aprovar solicitação',
    rejected: 'Rejeitar solicitação',
    clarification: 'Solicitar esclarecimento',
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          Gestão de Adiantamentos
        </h1>
        <p className="text-muted-foreground">Analise e acompanhe as solicitações dos funcionários</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total de solicitações" value={String(summary.total)} icon={<Wallet className="w-4 h-4" />} />
        <SummaryCard label="Pendentes" value={String(summary.pending)} icon={<Clock className="w-4 h-4" />} />
        <SummaryCard label="Aprovado (R$)" value={formatCurrency(summary.approvedAmount)} icon={<Check className="w-4 h-4" />} />
        <SummaryCard label="Total solicitado (R$)" value={formatCurrency(summary.totalAmount)} icon={<Wallet className="w-4 h-4" />} />
      </div>

      {/* Gráfico por funcionário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adiantamentos por funcionário</CardTitle>
          <CardDescription>Total solicitado (R$) por pessoa</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para exibir.</p>
          ) : (
            <div className="w-full" style={{ height: Math.max(240, chartData.length * 48) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(Number(v))} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={140} fontSize={12} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista com filtro e ações */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-lg">Solicitações</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação encontrada.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((req) => (
                <div key={req.id} className="border rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{formatCurrency(Number(req.amount))}</span>
                      <Badge variant="outline" className={ADVANCE_STATUS_CLASSES[req.status]}>
                        {ADVANCE_STATUS_LABELS[req.status]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{req.employee_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {formatCategories(req)} · {req.reason}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                      <span>{PAYMENT_METHOD_LABELS[req.payment_method]}</span>
                      {req.payment_method === 'boleto' && req.boleto_code && (
                        <span className="font-mono truncate max-w-[160px]" title={req.boleto_code}>
                          Boleto: {req.boleto_code}
                        </span>
                      )}
                      {Number(req.message_count) > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {req.message_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/advances/${req.id}`)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver
                    </Button>
                    {req.status !== 'approved' && (
                      <Button variant="outline" size="sm" onClick={() => openAction(req, 'approved')}
                        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <Check className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                    )}
                    {req.status !== 'clarification' && req.status !== 'approved' && (
                      <Button variant="outline" size="sm" onClick={() => openAction(req, 'clarification')}
                        className="text-blue-700 border-blue-200 hover:bg-blue-50">
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Esclarecer
                      </Button>
                    )}
                    {req.status !== 'rejected' && (
                      <Button variant="outline" size="sm" onClick={() => openAction(req, 'rejected')}
                        className="text-red-700 border-red-200 hover:bg-red-50">
                        <X className="w-4 h-4 mr-1" />
                        Rejeitar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de ação */}
      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabels[actionType]}</DialogTitle>
            <DialogDescription>
              {actionTarget && (
                <>
                  {formatCurrency(Number(actionTarget.amount))} · {actionTarget.employee_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="review-note">
              {actionType === 'clarification'
                ? 'O que precisa ser esclarecido? *'
                : 'Observação (opcional)'}
            </Label>
            <Textarea
              id="review-note"
              placeholder={
                actionType === 'clarification'
                  ? 'Descreva o que o funcionário deve esclarecer...'
                  : 'Adicione uma observação, se desejar'
              }
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submitAction} disabled={submitting}>
              {submitting ? <Spinner className="mr-2" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatCategories(req: AdvanceRequest): string {
  const list =
    req.categories && req.categories.length > 0
      ? req.categories
      : req.category
        ? [req.category]
        : []
  return list.map(getCategoryLabel).join(', ') || '-'
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
