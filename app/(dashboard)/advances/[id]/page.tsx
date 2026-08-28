'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { ArrowLeft, Send, Wallet } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency, getCategoryLabel } from '@/lib/format'
import {
  ADVANCE_STATUS_LABELS, ADVANCE_STATUS_CLASSES, PAYMENT_METHOD_LABELS,
} from '@/lib/advance-constants'

interface AdvanceDetail {
  id: number
  user_id: number
  amount: string
  payment_method: string
  pix_key: string | null
  bank_agency: string | null
  bank_account: string | null
  boleto_code: string | null
  category: string
  categories: string[] | null
  reason: string
  city: string | null
  usage_start: string | null
  usage_end: string | null
  status: string
  review_note: string | null
  employee_name: string
  employee_department: string | null
  reviewed_by_name: string | null
  created_at: string
}

interface Message {
  id: number
  user_id: number
  message: string
  created_at: string
  sender_name: string
  sender_role: string
}

export default function AdvanceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const id = params.id as string

  const [detail, setDetail] = useState<AdvanceDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function loadDetail() {
    try {
      const res = await fetch(`/api/advance-requests/${id}`)
      if (!res.ok) {
        toast.error('Solicitação não encontrada')
        router.push('/advances')
        return
      }
      const data = await res.json()
      setDetail(data.request)
      setMessages(data.messages)
    } catch {
      toast.error('Erro ao carregar solicitação')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/advance-requests/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      })
      if (!res.ok) {
        toast.error('Erro ao enviar mensagem')
        return
      }
      setNewMessage('')
      loadDetail()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Spinner /> Carregando...
      </div>
    )
  }

  if (!detail) return null

  // Categorias: usa o array novo; se ausente (registros antigos), cai para o campo legado
  const categoryList =
    detail.categories && detail.categories.length > 0
      ? detail.categories
      : detail.category
        ? [detail.category]
        : []

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '-'

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/advances')} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      {/* Resumo da solicitação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-xl flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              {formatCurrency(Number(detail.amount))}
            </CardTitle>
            <Badge variant="outline" className={ADVANCE_STATUS_CLASSES[detail.status]}>
              {ADVANCE_STATUS_LABELS[detail.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <Info label="Solicitante" value={detail.employee_name} />
            <Info
              label="Tipo de despesa"
              value={categoryList.map(getCategoryLabel).join(', ') || '-'}
            />
            <Info label="Forma de recebimento" value={PAYMENT_METHOD_LABELS[detail.payment_method]} />
            <Info
              label="Dados de recebimento"
              value={
                detail.payment_method === 'pix'
                  ? detail.pix_key || '-'
                  : detail.payment_method === 'boleto'
                    ? 'Ver código do boleto abaixo'
                    : `Ag. ${detail.bank_agency || '-'} / CC ${detail.bank_account || '-'}`
              }
            />
            <Info label="Cidade" value={detail.city || '-'} />
            <Info
              label="Período de utilização"
              value={
                detail.usage_start || detail.usage_end
                  ? `${fmtDate(detail.usage_start)} a ${fmtDate(detail.usage_end)}`
                  : '-'
              }
            />
            <Info label="Solicitado em" value={fmtDate(detail.created_at)} />
            {detail.reviewed_by_name && (
              <Info label="Analisado por" value={detail.reviewed_by_name} />
            )}
          </div>

          {detail.payment_method === 'boleto' && detail.boleto_code && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Código do boleto</p>
              <p className="text-sm font-mono break-all bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
                {detail.boleto_code}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Motivo / Objetivo</p>
            <p className="text-sm bg-muted/50 rounded-md p-3">{detail.reason}</p>
          </div>

          {detail.review_note && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Observação do financeiro</p>
              <p className="text-sm bg-blue-50 border border-blue-200 text-blue-900 rounded-md p-3">
                {detail.review_note}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thread de esclarecimento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Esclarecimentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMine = msg.user_id === user?.id
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isMine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="text-xs opacity-80 mb-0.5">
                        {msg.sender_name}
                        {msg.sender_role === 'financial' ? ' (Financeiro)' : ''}
                      </p>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {new Date(msg.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t">
            <Textarea
              placeholder="Escreva uma mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              rows={2}
              className="resize-none"
            />
            <Button type="submit" disabled={sending || !newMessage.trim()} size="icon" className="shrink-0 self-end">
              {sending ? <Spinner /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
