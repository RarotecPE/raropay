'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Plus, Wallet, MessageSquare, ChevronRight, AlertCircle, Lock } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  ADVANCE_STATUS_LABELS, ADVANCE_STATUS_CLASSES, ADVANCE_CATEGORIES, PAYMENT_METHOD_LABELS,
} from '@/lib/advance-constants'

interface AdvanceRequest {
  id: number
  amount: string
  payment_method: string
  category: string
  categories: string[] | null
  boleto_code: string | null
  reason: string
  city: string | null
  usage_start: string | null
  usage_end: string | null
  status: string
  review_note: string | null
  created_at: string
  message_count: number
}

interface Banking {
  pix_key: string | null
  bank_agency: string | null
  bank_account: string | null
}

export default function AdvancesPage() {
  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [banking, setBanking] = useState<Banking | null>(null)
  const [pixEnabled, setPixEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('bank_account')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [boletoCode, setBoletoCode] = useState('')
  const [reason, setReason] = useState('')
  const [city, setCity] = useState('')
  const [usageStart, setUsageStart] = useState('')
  const [usageEnd, setUsageEnd] = useState('')

  async function loadData() {
    try {
      const [reqRes, bankRes, settingsRes] = await Promise.all([
        fetch('/api/advance-requests'),
        fetch('/api/profile/banking'),
        fetch('/api/settings/advance'),
      ])
      if (reqRes.ok) setRequests(await reqRes.json())
      if (bankRes.ok) {
        const data = await bankRes.json()
        setBanking(data.banking)
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setPixEnabled(!!data.pixEnabled)
      }
    } catch {
      toast.error('Erro ao carregar solicitações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function resetForm() {
    setAmount('')
    setPaymentMethod('bank_account')
    setSelectedCategories([])
    setBoletoCode('')
    setReason('')
    setCity('')
    setUsageStart('')
    setUsageEnd('')
  }

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  const pixMissing = paymentMethod === 'pix' && !banking?.pix_key
  const accountMissing =
    paymentMethod === 'bank_account' && (!banking?.bank_agency || !banking?.bank_account)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast.error('Informe um valor válido')
      return
    }
    if (selectedCategories.length === 0) {
      toast.error('Selecione ao menos um tipo de despesa')
      return
    }
    if (!reason.trim()) {
      toast.error('Informe o motivo/objetivo')
      return
    }
    if (paymentMethod === 'boleto' && !boletoCode.trim()) {
      toast.error('Informe o código do boleto')
      return
    }
    if (pixMissing || accountMissing) {
      toast.error('Cadastre seus dados bancários no perfil antes de continuar')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/advance-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: paymentMethod,
          categories: selectedCategories,
          boleto_code: paymentMethod === 'boleto' ? boletoCode.trim() : null,
          reason,
          city,
          usage_start: usageStart || null,
          usage_end: usageEnd || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao enviar solicitação')
        return
      }
      toast.success('Solicitação enviada ao financeiro!')
      setDialogOpen(false)
      resetForm()
      loadData()
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            Adiantamentos
          </h1>
          <p className="text-muted-foreground">Solicite adiantamentos e acompanhe o status</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Solicitação de Adiantamento</DialogTitle>
              <DialogDescription>
                O valor será enviado ao financeiro para análise.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor solicitado (R$) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label>Forma de recebimento *</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={submitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">{PAYMENT_METHOD_LABELS.bank_account}</SelectItem>
                    <SelectItem value="boleto">{PAYMENT_METHOD_LABELS.boleto}</SelectItem>
                    <SelectItem value="pix" disabled={!pixEnabled}>
                      <span className="flex items-center gap-2">
                        {PAYMENT_METHOD_LABELS.pix}
                        {!pixEnabled && <Lock className="w-3 h-3" />}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!pixEnabled && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    O recebimento via PIX está desabilitado pelo administrador.
                  </p>
                )}
                {paymentMethod === 'pix' && banking?.pix_key && (
                  <p className="text-xs text-muted-foreground">PIX cadastrado: {banking.pix_key}</p>
                )}
                {paymentMethod === 'bank_account' && banking?.bank_account && (
                  <p className="text-xs text-muted-foreground">
                    Ag. {banking.bank_agency} / CC {banking.bank_account}
                  </p>
                )}
                {(pixMissing || accountMissing) && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 dark:border-destructive/40 rounded-md p-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Você ainda não cadastrou esses dados.{' '}
                      <Link href="/profile" className="underline font-medium">
                        Cadastre no seu perfil
                      </Link>{' '}
                      para continuar.
                    </span>
                  </div>
                )}
              </div>

              {paymentMethod === 'boleto' && (
                <div className="space-y-2">
                  <Label htmlFor="boleto-code">Código do boleto *</Label>
                  <Input
                    id="boleto-code"
                    placeholder="Linha digitável do boleto"
                    value={boletoCode}
                    onChange={(e) => setBoletoCode(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de despesa * <span className="text-xs font-normal text-muted-foreground">(selecione uma ou mais)</span></Label>
                <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                  {ADVANCE_CATEGORIES.map((cat) => (
                    <label
                      key={cat.value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCategories.includes(cat.value)}
                        onCheckedChange={() => toggleCategory(cat.value)}
                        disabled={submitting}
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo / Objetivo *</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva o motivo do adiantamento"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Cidade de utilização"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usage-start">Período - início</Label>
                  <Input
                    id="usage-start"
                    type="date"
                    value={usageStart}
                    onChange={(e) => setUsageStart(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usage-end">Período - fim</Label>
                  <Input
                    id="usage-end"
                    type="date"
                    value={usageEnd}
                    onChange={(e) => setUsageEnd(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Spinner className="mr-2" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Solicitação'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Spinner /> Carregando...
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Você ainda não fez nenhuma solicitação de adiantamento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link key={req.id} href={`/advances/${req.id}`} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg">{formatCurrency(Number(req.amount))}</span>
                      <Badge variant="outline" className={ADVANCE_STATUS_CLASSES[req.status]}>
                        {ADVANCE_STATUS_LABELS[req.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">{req.reason}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                      <span>{PAYMENT_METHOD_LABELS[req.payment_method]}</span>
                      {Number(req.message_count) > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {req.message_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
