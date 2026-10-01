'use client'

// @refresh reset
// Página de Detalhes da Despesa - v10 - Forçando recompilação total

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { 
  categoryLabels, 
  expenseTypeLabels, 
  statusLabels, 
  mealTypeLabels,
  fuelTypeOptions,
} from '@/lib/types'
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Pencil,
  Download,
  MapPin,
  Calendar,
  Receipt,
  User,
  History,
  Utensils,
  Hotel,
  Fuel,
  Car,
  ParkingCircle,
  Users,
  Building,
  CreditCard,
  Navigation,
  Gauge,
  Package,
  Store,
  Banknote,
  QrCode,
  Hash,
  AlertCircle,
  Route,
  CircleDollarSign,
  Phone,
  Camera,
  Eye,
  Bus,
} from 'lucide-react'

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  processed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  submitted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  correction: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  analysis: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

const statusIcons: Record<string, typeof FileText> = {
  draft: FileText,
  processed: FileText,
  submitted: Clock,
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  correction: AlertCircle,
  analysis: Clock,
}

const categoryIcons: Record<string, typeof FileText> = {
  food: Utensils,
  meal_voucher: Utensils,
  accommodation: Hotel,
  fuel: Fuel,
  vehicle: Car,
  parking: ParkingCircle,
  travel: Navigation,
  transport: Car,
  transport_voucher: Bus,
  office_supplies: Package,
  other: Receipt,
}

const parkingReasonLabels: Record<string, string> = {
  reuniao: 'Reunião',
  alimentacao: 'Alimentação',
  compra_entrega: 'Compra/Entrega/Retirada de Materiais',
  guarda_veiculo: 'Guarda de Veículo',
  mensalista: 'Mensalista',
}

// Labels de tipo de parcelamento
const installmentTypeLabels: Record<string, string> = {
  'single': 'Único',
  'installment': 'Parcelado',
  'recurring': 'Recorrente',
  'a_vista': 'À Vista',
  'parcelado': 'Parcelado',
}

// Labels de motivo de viagem (global)
const globalTripTypeLabels: Record<string, string> = {
  'visita_cliente': 'Visita a Cliente',
  'reuniao': 'Reunião',
  'entrega': 'Entrega',
  'coleta': 'Coleta',
  'viagem_trabalho': 'Viagem a Trabalho',
  'deslocamento_diario': 'Deslocamento Diário',
  'metropolitan': 'Metropolitano',
  'intermunicipal': 'Intermunicipal',
  'interstate': 'Interestadual',
  'outro': 'Outro',
}

// Componente para exibir um item de detalhe
function DetailItem({ 
  icon: Icon, 
  label, 
  value,
  highlight = false,
  fullWidth = false,
}: { 
  icon: typeof FileText
  label: string
  value: string | number | null | undefined
  highlight?: boolean
  fullWidth?: boolean
}) {
  if (value === null || value === undefined || value === '' || value === 'null') return null
  
  return (
    <div className={`flex items-start gap-3 ${fullWidth ? 'col-span-full' : ''}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-sm ${highlight ? 'font-semibold' : 'font-medium'}`}>{value}</p>
      </div>
    </div>
  )
}

// Helper para formatar horário
function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':')
    return `${parts[0]}:${parts[1]}`
  }
  return timeStr
}

export default function ExpenseDetailsPageV10({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ embed?: string }> }) {
  const { id } = use(params)
  const { embed } = use(searchParams)
  const isEmbedded = embed === 'true'
  const router = useRouter()
  const [expense, setExpense] = useState<Record<string, any> | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchExpense() {
      try {
        const response = await fetch(`/api/expenses/${id}`)
        if (response.ok) {
          const data = await response.json()
          console.log('[v0] Expense data received:', data)
          setExpense(data.expense)
          setHistory(data.history || [])
        } else if (response.status === 404) {
          router.push('/expenses/history')
        }
      } catch (error) {
        console.error('Erro ao buscar despesa:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchExpense()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (!expense) {
    return null
  }

  const StatusIcon = statusIcons[expense.status] || FileText
  const CategoryIcon = categoryIcons[expense.category] || Receipt
  const statusColor = statusColors[expense.status] || 'bg-muted text-muted-foreground'
  const canEdit = expense.status === 'draft' || expense.status === 'rejected' || expense.status === 'correction'

  // Helper para obter label do tipo de combustível
  const getFuelTypeLabel = (value: string) => {
    const option = fuelTypeOptions.find(opt => opt.value === value)
    return option?.label || value
  }

return (
    <div className={`space-y-6 ${isEmbedded ? 'p-6 max-w-full' : 'max-w-4xl mx-auto'}`}>
      {/* Header - oculto no modo embed */}
      {!isEmbedded && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Detalhes da Despesa</h1>
            <p className="text-muted-foreground">#{expense.id}</p>
          </div>
        {canEdit && (
            <Button asChild>
              <Link href={`/expenses/${id}/edit`}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Status e Valor Principal */}
      <Card className="border-l-4" style={{ borderLeftColor: expense.status === 'approved' ? '#10b981' : expense.status === 'rejected' ? '#ef4444' : '#3b82f6' }}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${statusColor}`}>
                <CategoryIcon className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={statusColor}>
                    {statusLabels[expense.status] || expense.status}
                  </Badge>
                  <Badge variant="outline">
                    {expenseTypeLabels[expense.expense_type] || expense.expense_type}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold">{categoryLabels[expense.category] || expense.category}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(expense.expense_date)}
                  {expense.municipality && ` • ${expense.municipality}`}
                  {expense.state && `/${expense.state}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{formatCurrency(expense.amount)}</p>
            </div>
          </div>

          {expense.rejection_reason && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm font-medium text-destructive">Motivo da rejeição:</p>
              <p className="text-sm text-destructive/80">{expense.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ALIMENTAÇÃO */}
        {(expense.category === 'food' || expense.category === 'meal_voucher') && (() => {
          // Parse linked_employees se for string
          let linkedEmployees: any[] = []
          if (expense.linked_employees) {
            if (typeof expense.linked_employees === 'string') {
              try { linkedEmployees = JSON.parse(expense.linked_employees) } catch { linkedEmployees = [] }
            } else if (Array.isArray(expense.linked_employees)) {
              linkedEmployees = expense.linked_employees
            }
          }
          
          // Parse linked_external_parties se for string
          let linkedExternal: any[] = []
          if (expense.linked_external_parties) {
            if (typeof expense.linked_external_parties === 'string') {
              try { linkedExternal = JSON.parse(expense.linked_external_parties) } catch { linkedExternal = [] }
            } else if (Array.isArray(expense.linked_external_parties)) {
              linkedExternal = expense.linked_external_parties
            }
          }
          
          // Funcionários e terceiros (novo formato - todos em linked_employees)
          const funcionarios = linkedEmployees.filter((p: any) => p.isEmployee === true)
          const terceirosNovo = linkedEmployees.filter((p: any) => p.isEmployee === false)
          
          // Combinar terceiros de ambos os formatos
          const todosTerceiros = [...terceirosNovo, ...linkedExternal]
          
          // Número de pessoas (declarado ou calculado)
          // O total deve ser: funcionários vinculados + terceiros + 1 (o próprio usuário que criou a despesa)
          const numPessoasDeclarado = expense.number_of_people ? Number(expense.number_of_people) : null
          const pessoasCalculadas = funcionarios.length + todosTerceiros.length + 1 // +1 = próprio usuário
          const totalPessoas = numPessoasDeclarado || pessoasCalculadas
          const valorPorPessoa = totalPessoas > 0 ? expense.amount / totalPessoas : expense.amount
          
          // Labels de estabelecimento
          const establishmentTypeLabels: Record<string, string> = {
            'restaurante': 'Restaurante',
            'lanchonete': 'Lanchonete',
            'padaria': 'Padaria',
            'cafeteria': 'Cafeteria',
            'self_service': 'Self-Service',
            'fast_food': 'Fast Food',
            'bar': 'Bar',
            'hotel': 'Hotel',
            'outro': 'Outro',
          }
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Utensils className="w-4 h-4" />
                Detalhes da Alimentação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo da Refeição */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
                <div className="flex flex-wrap items-stretch justify-center gap-6">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                    <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(expense.amount)}</span>
                  </div>
                  <div className="w-px bg-orange-200 dark:bg-orange-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Tipo de Refeição</span>
                    <span className="text-lg font-semibold capitalize">{expense.meal_type ? (mealTypeLabels[expense.meal_type] || expense.meal_type) : 'Não informado'}</span>
                  </div>
                  <div className="w-px bg-orange-200 dark:bg-orange-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Pessoas</span>
                    <span className="text-2xl font-bold">{totalPessoas}</span>
                  </div>
                  <div className="w-px bg-orange-200 dark:bg-orange-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Por Pessoa</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPorPessoa)}</span>
                  </div>
                </div>
              </div>
              
              {/* Data e Horário */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Data e Horário
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem icon={Calendar} label="Data da Refeição" value={expense.expense_date ? formatDate(expense.expense_date) : null} highlight />
                  <DetailItem icon={Clock} label="Horário" value={formatTime(expense.meal_time)} />
                  <DetailItem icon={MapPin} label="Local" value={expense.municipality && expense.state ? `${expense.municipality}/${expense.state}` : (expense.municipality || expense.state)} />
                </div>
              </div>
              
              {/* Funcionários vinculados */}
              {funcionarios.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Funcionários Participantes ({funcionarios.length})
                  </h4>
                  <div className="space-y-2">
                    {funcionarios.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {(person.name || person.user_name || 'F')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || person.user_name || `Funcionário ID: ${person.user_id}`}</p>
                            {person.department && <p className="text-xs text-muted-foreground">{person.department}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default">Funcionário</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Terceiros vinculados */}
              {todosTerceiros.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Terceiros Participantes ({todosTerceiros.length})
                  </h4>
                  <div className="space-y-2">
                    {todosTerceiros.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                            {(person.name || 'T')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || 'Não identificado'}</p>
                            {person.cpf && <p className="text-xs text-muted-foreground font-mono">CPF: {person.cpf}</p>}
                            {person.company && <p className="text-xs text-muted-foreground">{person.company}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">Terceiro</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Descrição/Observações */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* HOSPEDAGEM */}
        {expense.category === 'accommodation' && (() => {
          // Parse linked_employees se for string
          let linkedEmployees: any[] = []
          if (expense.linked_employees) {
            if (typeof expense.linked_employees === 'string') {
              try { linkedEmployees = JSON.parse(expense.linked_employees) } catch { linkedEmployees = [] }
            } else if (Array.isArray(expense.linked_employees)) {
              linkedEmployees = expense.linked_employees
            }
          }
          
          // Parse extra_expenses se for string
          let extraExpenses: any[] = []
          if (expense.extra_expenses) {
            if (typeof expense.extra_expenses === 'string') {
              try { extraExpenses = JSON.parse(expense.extra_expenses) } catch { extraExpenses = [] }
            } else if (Array.isArray(expense.extra_expenses)) {
              extraExpenses = expense.extra_expenses
            }
          }
          
          // Contar funcionários e terceiros
          const funcionarios = linkedEmployees.filter((p: any) => p.isEmployee === true)
          const terceiros = linkedEmployees.filter((p: any) => p.isEmployee === false)
          const totalPessoas = linkedEmployees.length + 1 // +1 para o próprio funcionário que criou
          
          // Separar extras: refeições oficiais vs outros
          const extrasRefeicao = extraExpenses.filter((e: any) => e.isMeal === true)
          const extrasNaoRefeicao = extraExpenses.filter((e: any) => e.isMeal !== true)
          const totalExtrasRefeicao = extrasRefeicao.reduce((sum: number, e: any) => sum + Number(e.amount || e.value || 0), 0)
          const totalExtrasNaoRefeicao = extrasNaoRefeicao.reduce((sum: number, e: any) => sum + Number(e.amount || e.value || 0), 0)
          
          // Calcular valor por pessoa/diária (EXCLUI refeições oficiais)
          const nights = Number(expense.nights_count) || 1
          const valorHospedagemSemRefeicao = expense.amount - totalExtrasRefeicao
          const valorPorPessoa = totalPessoas > 0 ? valorHospedagemSemRefeicao / totalPessoas : valorHospedagemSemRefeicao
          const valorPorPessoaDiaria = nights > 0 && totalPessoas > 0 ? valorHospedagemSemRefeicao / nights / totalPessoas : valorHospedagemSemRefeicao
          
          // Calcular total de quartos
          const totalQuartos = (Number(expense.single_room_qty) || 0) + (Number(expense.double_room_qty) || 0) + (Number(expense.triple_room_qty) || 0)
          const totalExtras = extraExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || e.value || 0), 0)
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hotel className="w-4 h-4" />
                Detalhes da Hospedagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo da Hospedagem */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 space-y-4">
                {/* Linha principal - flex horizontal */}
                <div className="flex flex-wrap items-center gap-6">
                  <div className="min-w-[100px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Hospedagem</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(valorHospedagemSemRefeicao)}</p>
                  </div>
                  <div className="min-w-[60px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Diárias</p>
                    <p className="text-xl font-bold">{nights}</p>
                  </div>
                  <div className="min-w-[60px]">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pessoas</p>
                    <p className="text-xl font-bold">{totalPessoas}</p>
                  </div>
                  <div className="min-w-[120px] bg-emerald-100 dark:bg-emerald-900/40 px-3 py-2 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Média/Pessoa/Diária</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPorPessoaDiaria)}</p>
                  </div>
                </div>
                
                {/* Refeições e total - texto simples */}
                {totalExtrasRefeicao > 0 && (
                  <div className="pt-3 border-t border-blue-200 dark:border-blue-700 space-y-1.5 text-sm">
                    <p>
                      <span className="text-muted-foreground">Refeições Oficiais: </span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalExtrasRefeicao)}</span>
                      <span className="text-muted-foreground ml-1">({extrasRefeicao.length} refeição{extrasRefeicao.length > 1 ? 'ões' : ''})</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Total Geral: </span>
                      <span className="font-bold">{formatCurrency(expense.amount)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground pt-1">
                      * Refeições oficiais não são incluídas na média de hospedagem
                    </p>
                  </div>
                )}
              </div>
              
              {/* Estabelecimento */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Estabelecimento
                </h4>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Hotel/Pousada</p>
                      <p className="font-medium text-lg">{expense.accommodation_name || 'Não informado'}</p>
                    </div>
                    {expense.accommodation_cnpj && (
                      <div>
                        <p className="text-xs text-muted-foreground">CNPJ</p>
                        <p className="font-mono">{expense.accommodation_cnpj}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo de Local</p>
                      <p className="font-medium">
                        {expense.is_capital === true ? 'Capital' : expense.is_capital === false ? 'Interior' : (expense.location_type === 'capital' ? 'Capital' : expense.location_type === 'interior' ? 'Interior' : 'Não informado')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Café da Manhã</p>
                      <p className="font-medium">
                        {expense.has_breakfast === true ? 'Incluso' : expense.has_breakfast === false ? 'Não incluso' : 'Não informado'}
                      </p>
                    </div>
                    {expense.municipality && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">Localização</p>
                        <p className="font-medium">{expense.municipality}{expense.state ? `/${expense.state}` : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Período da Hospedagem */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Período da Hospedagem
                </h4>
                <div className="p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex-1 p-3 rounded bg-background border-l-4 border-emerald-500">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-in</p>
                      <p className="font-medium text-lg">
                        {expense.checkin_date ? formatDate(expense.checkin_date) : (expense.check_in ? formatDate(expense.check_in) : 'Não informado')}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-center justify-center px-4">
                      <p className="text-2xl font-bold text-primary">{nights}</p>
                      <p className="text-xs text-muted-foreground">noite(s)</p>
                    </div>
                    <div className="flex-1 p-3 rounded bg-background border-l-4 border-blue-500">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Check-out</p>
                      <p className="font-medium text-lg">
                        {expense.checkout_date ? formatDate(expense.checkout_date) : (expense.check_out ? formatDate(expense.check_out) : 'Não informado')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quartos */}
              {totalQuartos > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Hotel className="w-4 h-4" />
                    Quartos Reservados ({totalQuartos})
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {expense.single_room_qty && Number(expense.single_room_qty) > 0 && (
                      <div className="p-4 rounded-lg border bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Individual</p>
                        <p className="text-3xl font-bold mt-1">{expense.single_room_qty}</p>
                        <p className="text-sm text-muted-foreground">quarto(s)</p>
                        <p className="text-lg font-medium text-primary mt-2">
                          {expense.single_room_value ? formatCurrency(Number(expense.single_room_value)) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-muted-foreground">por quarto/noite</p>
                      </div>
                    )}
                    {expense.double_room_qty && Number(expense.double_room_qty) > 0 && (
                      <div className="p-4 rounded-lg border bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Duplo</p>
                        <p className="text-3xl font-bold mt-1">{expense.double_room_qty}</p>
                        <p className="text-sm text-muted-foreground">quarto(s)</p>
                        <p className="text-lg font-medium text-primary mt-2">
                          {expense.double_room_value ? formatCurrency(Number(expense.double_room_value)) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-muted-foreground">por quarto/noite</p>
                      </div>
                    )}
                    {expense.triple_room_qty && Number(expense.triple_room_qty) > 0 && (
                      <div className="p-4 rounded-lg border bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Triplo</p>
                        <p className="text-3xl font-bold mt-1">{expense.triple_room_qty}</p>
                        <p className="text-sm text-muted-foreground">quarto(s)</p>
                        <p className="text-lg font-medium text-primary mt-2">
                          {expense.triple_room_value ? formatCurrency(Number(expense.triple_room_value)) : 'R$ 0,00'}
                        </p>
                        <p className="text-xs text-muted-foreground">por quarto/noite</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Despesas Extras */}
              {extraExpenses.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Despesas Extras ({extraExpenses.length})
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Descrição</th>
                          <th className="text-left px-3 py-2 font-medium">Tipo</th>
                          <th className="text-right px-3 py-2 font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extraExpenses.map((extra: any, idx: number) => {
                          const mealTypeLabels: Record<string, string> = {
                            'breakfast': 'Café da Manhã',
                            'lunch': 'Almoço',
                            'dinner': 'Jantar'
                          }
                          const mealLimits: Record<string, number> = {
                            'breakfast': 30,
                            'lunch': 40,
                            'dinner': 30
                          }
                          const value = Number(extra.amount || extra.value || 0)
                          const pessoasRefeicao = extra.numberOfPeople || 1
                          const valorPorPessoa = value / pessoasRefeicao
                          const mealLimit = extra.mealType ? mealLimits[extra.mealType] || 40 : null
                          const isOverLimit = Boolean(extra.isMeal && mealLimit && valorPorPessoa > mealLimit)
                          
                          return (
                            <tr key={`extra-${idx}`} className={`border-t ${isOverLimit ? 'bg-amber-50' : ''}`}>
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">
                                {extra.description || extra.name || `Item ${idx + 1}`}
                                {extra.isMeal && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({pessoasRefeicao} pessoa{pessoasRefeicao > 1 ? 's' : ''})
                                  </span>
                                )}
                                {isOverLimit && (
                                  <span className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                                    <AlertCircle className="size-3 flex-shrink-0" />
                                    <span>Acima da referência ({formatCurrency(valorPorPessoa)}/pessoa)</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {extra.isMeal ? (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    {mealTypeLabels[extra.mealType] || 'Refeição'}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="text-right px-3 py-2 font-medium">{formatCurrency(value)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr className="border-t-2">
                          <td colSpan={3} className="px-3 py-2 font-medium text-right">Total Extras:</td>
                          <td className="px-3 py-2 font-bold text-right text-primary">{formatCurrency(totalExtras)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Divisão de valores */}
              {totalPessoas > 1 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Divisão de Valores
                  </h4>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex flex-wrap items-stretch justify-center gap-6">
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Hospedagem</span>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(valorHospedagemSemRefeicao)}</span>
                      </div>
                      <div className="w-px bg-blue-200 dark:bg-blue-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[80px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Pessoas</span>
                        <span className="text-2xl font-bold">{totalPessoas}</span>
                      </div>
                      <div className="w-px bg-blue-200 dark:bg-blue-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Por Pessoa</span>
                        <span className="text-2xl font-bold">{formatCurrency(valorPorPessoa)}</span>
                      </div>
                      <div className="w-px bg-blue-200 dark:bg-blue-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Por Pessoa/Diária</span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPorPessoaDiaria)}</span>
                      </div>
                    </div>
                    
                    {/* Refeições e total - texto simples */}
                    {totalExtrasRefeicao > 0 && (
                      <div className="pt-3 border-t border-primary/20 space-y-1.5 text-sm">
                        <p>
                          <span className="text-muted-foreground">Refeições Oficiais: </span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalExtrasRefeicao)}</span>
                          <span className="text-muted-foreground ml-1">({extrasRefeicao.length} refeição{extrasRefeicao.length > 1 ? 'ões' : ''})</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Total Geral: </span>
                          <span className="font-bold">{formatCurrency(expense.amount)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Funcionários hospedados */}
              {funcionarios.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Funcionários Hospedados ({funcionarios.length})
                  </h4>
                  <div className="space-y-2">
                    {funcionarios.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {(person.name || person.user_name || 'F')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || person.user_name || `Funcionário ID: ${person.user_id}`}</p>
                            {person.department && <p className="text-xs text-muted-foreground">{person.department}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default">Funcionário</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Terceiros hospedados */}
              {terceiros.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Terceiros Hospedados ({terceiros.length})
                  </h4>
                  <div className="space-y-2">
                    {terceiros.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                            {(person.name || 'T')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || 'Não identificado'}</p>
                            {person.cpf && <p className="text-xs text-muted-foreground font-mono">CPF: {person.cpf}</p>}
                            {person.company && <p className="text-xs text-muted-foreground">{person.company}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">Terceiro</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Descrição/Observações */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* COMBUSTÍVEL */}
        {expense.category === 'fuel' && (() => {
          // Parse stops se for string
          let stops: any[] = []
          if (expense.stops) {
            if (typeof expense.stops === 'string') {
              try { stops = JSON.parse(expense.stops) } catch { stops = [] }
            } else if (Array.isArray(expense.stops)) {
              stops = expense.stops
            }
          }
          
          // Parse odometer_photos se for string
          let odometerPhotos: any[] = []
          if (expense.odometer_photos) {
            if (typeof expense.odometer_photos === 'string') {
              try { odometerPhotos = JSON.parse(expense.odometer_photos) } catch { odometerPhotos = [] }
            } else if (Array.isArray(expense.odometer_photos)) {
              odometerPhotos = expense.odometer_photos
            }
          }
          
          // Calcular valores derivados
          const totalAbastecido = expense.liters && expense.price_per_liter 
            ? Number(expense.liters) * Number(expense.price_per_liter) 
            : expense.amount
          
          const kmRodados = expense.total_km || (expense.km_after && expense.km_before 
            ? Number(expense.km_after) - Number(expense.km_before) 
            : null)
          
          const consumoCalculado = expense.km_per_liter || (kmRodados && expense.liters 
            ? kmRodados / Number(expense.liters) 
            : null)
          
          // Labels de motivo de viagem
          const tripTypeLabels: Record<string, string> = {
            'visita_cliente': 'Visita a Cliente',
            'reuniao': 'Reunião',
            'entrega': 'Entrega',
            'coleta': 'Coleta',
            'viagem_trabalho': 'Viagem a Trabalho',
            'deslocamento_diario': 'Deslocamento Diário',
            'metropolitan': 'Metropolitano',
            'intermunicipal': 'Intermunicipal',
            'interstate': 'Interestadual',
            'outro': 'Outro',
          }
          
          // Labels de tipo de parcelamento
          const installmentTypeLabels: Record<string, string> = {
            'single': 'Único',
            'installment': 'Parcelado',
            'recurring': 'Recorrente',
          }
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="w-4 h-4" />
                Detalhes do Abastecimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo do Abastecimento */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800">
                <div className="flex flex-wrap items-stretch justify-center gap-6">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(expense.amount)}</span>
                  </div>
                  {expense.liters && (
                    <>
                      <div className="w-px bg-green-200 dark:bg-green-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Litros</span>
                        <span className="text-2xl font-bold">{Number(expense.liters).toFixed(2)} L</span>
                      </div>
                    </>
                  )}
                  {expense.price_per_liter && (
                    <>
                      <div className="w-px bg-green-200 dark:bg-green-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Preço/Litro</span>
                        <span className="text-2xl font-bold">{formatCurrency(Number(expense.price_per_liter))}</span>
                      </div>
                    </>
                  )}
                  {consumoCalculado && (
                    <>
                      <div className="w-px bg-green-200 dark:bg-green-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Consumo</span>
                        <span className={`text-2xl font-bold ${consumoCalculado < 8 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {consumoCalculado.toFixed(2)} km/L
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Dados do Veículo */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Veículo
                </h4>
                <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Placa</span>
                      <p className="font-bold text-lg">{expense.vehicle_plate || 'Não informado'}</p>
                    </div>
                    {expense.vehicle_model && expense.vehicle_brand && (
                      <div>
                        <span className="text-xs text-muted-foreground">Veículo</span>
                        <p className="font-medium">{expense.vehicle_brand} {expense.vehicle_model}</p>
                      </div>
                    )}
                    {expense.fuel_type && (
                      <div>
                        <span className="text-xs text-muted-foreground">Combustível Abastecido</span>
                        <p className="font-medium text-primary">{getFuelTypeLabel(expense.fuel_type)}</p>
                      </div>
                    )}
                    {expense.vehicle_fuel_type && expense.vehicle_fuel_type !== expense.fuel_type && (
                      <div>
                        <span className="text-xs text-muted-foreground">Tipo do Veículo</span>
                        <p className="font-medium text-muted-foreground">{getFuelTypeLabel(expense.vehicle_fuel_type)}</p>
                      </div>
                    )}
                  </div>
                  {(expense.vehicle_owner_name || expense.driver_name) && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Proprietário/Motorista</span>
                      <p className="font-medium">{expense.vehicle_owner_name || expense.driver_name}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Dados do Posto */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Posto de Combustível
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem icon={Building} label="Nome do Posto" value={expense.gas_station_name} highlight />
                  <DetailItem icon={MapPin} label="Local" value={expense.municipality && expense.state ? `${expense.municipality}/${expense.state}` : (expense.municipality || expense.state)} />
                  <DetailItem icon={Calendar} label="Data do Abastecimento" value={expense.expense_date ? formatDate(expense.expense_date) : null} />
                </div>
              </div>
              
              {/* Odômetro */}
              {(expense.km_before || expense.km_after || kmRodados) && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Odômetro
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex flex-wrap justify-center gap-4">
                      {expense.km_before && (
                        <div className="text-center p-3 rounded bg-background min-w-[120px]">
                          <p className="text-xs text-muted-foreground mb-1">Km Saída</p>
                          <p className="text-xl font-bold">{Number(expense.km_before).toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">quilômetros</p>
                        </div>
                      )}
                      {expense.km_after && (
                        <div className="text-center p-3 rounded bg-background min-w-[120px]">
                          <p className="text-xs text-muted-foreground mb-1">Km Chegada</p>
                          <p className="text-xl font-bold">{Number(expense.km_after).toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">quilômetros</p>
                        </div>
                      )}
                      {kmRodados && (
                        <div className="text-center p-3 rounded bg-primary/10 min-w-[120px]">
                          <p className="text-xs text-muted-foreground mb-1">Total Rodado (Informado)</p>
                          <p className="text-xl font-bold text-primary">{Number(kmRodados).toLocaleString('pt-BR')}</p>
                          <p className="text-xs text-muted-foreground">quilômetros</p>
                        </div>
                      )}
                    </div>
                    {/* Estimativa do Sistema vs Declarado */}
                    {expense.estimated_distance && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap justify-center gap-4">
                          <div className="flex items-center gap-3 p-2 px-4 rounded bg-blue-50 dark:bg-blue-950/30">
                            <span className="text-sm text-muted-foreground">Estimativa do Sistema:</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{Number(expense.estimated_distance).toLocaleString('pt-BR')} km</span>
                          </div>
                          {expense.distance_km && (
                            <div className="flex items-center gap-3 p-2 px-4 rounded bg-muted/50">
                              <span className="text-sm text-muted-foreground">Distância Declarada:</span>
                              <span className="font-semibold">{Number(expense.distance_km).toLocaleString('pt-BR')} km</span>
                            </div>
                          )}
                        </div>
                        {expense.distance_km && expense.estimated_distance && (
                          <div className="mt-2 text-center">
                            {(() => {
                              const diff = Number(expense.distance_km) - Number(expense.estimated_distance)
                              const percentDiff = (diff / Number(expense.estimated_distance)) * 100
                              const isSignificant = Math.abs(percentDiff) > 10
                              return isSignificant ? (
                                <p className={`text-sm ${diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {diff > 0 ? 'Acima' : 'Abaixo'} da estimativa em {Math.abs(diff).toLocaleString('pt-BR')} km ({Math.abs(percentDiff).toFixed(1)}%)
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">Dentro da estimativa esperada</p>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    {!expense.estimated_distance && expense.distance_km && (
                      <div className="mt-3 pt-3 border-t text-center">
                        <p className="text-sm text-muted-foreground">
                          Distância declarada: <span className="font-medium">{Number(expense.distance_km).toLocaleString('pt-BR')} km</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Trajeto */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Trajeto da Viagem
                </h4>
                <div className="space-y-4">
                  {/* Origem e Destino visual */}
                  {(expense.departure_city || expense.arrival_city || expense.origin || expense.destination) && (
                    <div className="p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        <div className="p-3 rounded bg-background border-l-4 border-emerald-500">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Saída</p>
                          <p className="font-medium break-words">
                            {expense.departure_city 
                              ? `${expense.departure_city}${expense.departure_state ? `/${expense.departure_state}` : ''}`
                              : expense.origin || 'Não informado'}
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center justify-center">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-current shrink-0" />
                            <div className="w-6 h-0.5 bg-current shrink-0" />
                            <Navigation className="w-4 h-4 shrink-0" />
                            <div className="w-6 h-0.5 bg-current shrink-0" />
                            <div className="w-2 h-2 rounded-full bg-current shrink-0" />
                          </div>
                        </div>
{(expense.different_arrival || expense.arrival_city || expense.destination) && (
  <div className="p-3 rounded bg-background border-l-4 border-blue-500">
  <p className="text-xs text-muted-foreground uppercase tracking-wide">Chegada</p>
  <p className="font-medium break-words">
  {expense.arrival_city
  ? `${expense.arrival_city}${expense.arrival_state ? `/${expense.arrival_state}` : ''}`
  : expense.destination || 'Mesmo local de origem'}
  </p>
  </div>
  )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem 
                      icon={FileText} 
                      label="Tipo do Trajeto" 
                      value={expense.trip_type ? (tripTypeLabels[expense.trip_type] || expense.trip_type) : null} 
                    />
{/* Removido: is_round_trip não é mais usado */}
                    {expense.is_irregular_route && (
                      <div className="col-span-full p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-amber-800 dark:text-amber-200">Rota Irregular</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              Esta viagem utilizou uma rota diferente do padrão e pode requerer justificativa.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Paradas */}
              {stops.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Paradas no Trajeto ({stops.length})
                  </h4>
                  <div className="space-y-2">
                    {stops.map((stop: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {stop.municipality || stop.city || 'Local não informado'}
                            {stop.state && `/${stop.state}`}
                          </p>
                          {stop.reason && (
                            <p className="text-sm text-muted-foreground">
                              Motivo: {stop.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Arquivos do Odômetro (imagens ou PDFs) */}
              {odometerPhotos.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Arquivos do Hodômetro ({odometerPhotos.length})
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {odometerPhotos.map((photo: any, idx: number) => {
                      const storedPath = photo.pathname || photo.url || photo
                      const isPdf = typeof storedPath === 'string' && storedPath.toLowerCase().endsWith('.pdf')
                      const fileName = photo.name || `hodometro-${idx + 1}${isPdf ? '.pdf' : '.jpg'}`
                      // Usar API /api/file?pathname= para servir arquivos privados
                      const apiUrl = `/api/file?pathname=${encodeURIComponent(storedPath)}`
                      
                      return (
                        <div key={idx} className="relative rounded-lg overflow-hidden border bg-muted">
                          {isPdf ? (
                            <div className="aspect-video flex flex-col items-center justify-center bg-muted/50 p-4">
                              <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground text-center truncate max-w-full">{fileName}</p>
                            </div>
                          ) : (
                            <div className="aspect-video">
                              <img 
                                src={apiUrl} 
                                alt={`Odômetro ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          {photo.type && (
                            <div className="absolute bottom-2 left-2">
                              <Badge variant="secondary" className="text-xs">
                                {photo.type === 'before' ? 'Antes' : photo.type === 'after' ? 'Depois' : photo.type}
                              </Badge>
                            </div>
                          )}
                          {/* Botões de ação - sempre visíveis */}
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 shadow-sm"
                              asChild
                            >
                              <a href={apiUrl} target="_blank" rel="noopener noreferrer" title="Visualizar">
                                <Eye className="w-4 h-4" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 shadow-sm"
                              asChild
                            >
                              <a href={apiUrl} download={fileName} title="Baixar">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* Descrição/Observações */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* ESTACIONAMENTO */}
        {expense.category === 'parking' && (() => {
          // Parse linked_employees se for string
          let linkedEmployees: any[] = []
          if (expense.linked_employees) {
            if (typeof expense.linked_employees === 'string') {
              try { linkedEmployees = JSON.parse(expense.linked_employees) } catch { linkedEmployees = [] }
            } else if (Array.isArray(expense.linked_employees)) {
              linkedEmployees = expense.linked_employees
            }
          }
          
          // Calcular duração se houver horário de entrada e saída
          let duracao = ''
          if (expense.entry_time && expense.exit_time) {
            const [entryH, entryM] = expense.entry_time.split(':').map(Number)
            const [exitH, exitM] = expense.exit_time.split(':').map(Number)
            let diffMinutes = (exitH * 60 + exitM) - (entryH * 60 + entryM)
            if (diffMinutes < 0) diffMinutes += 24 * 60 // passou da meia-noite
            const hours = Math.floor(diffMinutes / 60)
            const minutes = diffMinutes % 60
            duracao = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
          }
          
          // Tipos de estacionamento
          const parkingTypeLabels: Record<string, string> = {
            'rotativo': 'Rotativo (por hora)',
            'mensalista': 'Mensalista',
            'diaria': 'Diária',
            'pernoite': 'Pernoite',
            'avulso': 'Avulso',
          }
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ParkingCircle className="w-4 h-4" />
                Detalhes do Estacionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800">
                <div className="flex flex-wrap items-stretch justify-center gap-6">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                    <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(expense.amount)}</span>
                  </div>
                  <div className="w-px bg-violet-200 dark:bg-violet-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Tipo</span>
                    <span className="text-lg font-semibold capitalize">{expense.parking_type ? (parkingTypeLabels[expense.parking_type] || expense.parking_type) : 'Não informado'}</span>
                  </div>
                  {duracao && (
                    <>
                      <div className="w-px bg-violet-200 dark:bg-violet-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Duração</span>
                        <span className="text-2xl font-bold">{duracao}</span>
                      </div>
                    </>
                  )}
                  <div className="w-px bg-violet-200 dark:bg-violet-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Data</span>
                    <span className="text-lg font-semibold">{expense.expense_date ? formatDate(expense.expense_date) : 'Não informado'}</span>
                  </div>
                </div>
              </div>
              
              {/* Estabelecimento */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Estabelecimento
                </h4>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nome do Estacionamento</p>
                      <p className="font-medium text-lg">{expense.parking_name || 'Não informado'}</p>
                    </div>
                    {expense.parking_cnpj && (
                      <div>
                        <p className="text-xs text-muted-foreground">CNPJ</p>
                        <p className="font-mono">{expense.parking_cnpj}</p>
                      </div>
                    )}
                    {expense.parking_reason && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">Motivo da Parada</p>
                        <p className="font-medium">{parkingReasonLabels[expense.parking_reason] || expense.parking_reason}</p>
                      </div>
                    )}
                    {expense.municipality && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">Localização</p>
                        <p className="font-medium">{expense.municipality}{expense.state ? `/${expense.state}` : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Período */}
              {(expense.entry_time || expense.exit_time) && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Período de Estacionamento
                  </h4>
                  <div className="p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <div className="flex-1 p-3 rounded bg-background border-l-4 border-emerald-500">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Entrada</p>
                        <p className="font-medium text-lg">{expense.entry_time ? formatTime(expense.entry_time) : 'Não informado'}</p>
                      </div>
                      {duracao && (
                        <div className="hidden sm:flex flex-col items-center justify-center px-4">
                          <p className="text-xl font-bold text-primary">{duracao}</p>
                        </div>
                      )}
                      <div className="flex-1 p-3 rounded bg-background border-l-4 border-blue-500">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Saída</p>
                        <p className="font-medium text-lg">{expense.exit_time ? formatTime(expense.exit_time) : 'Não informado'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Veículo */}
              {expense.vehicle_plate && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Veículo
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Car className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Placa do Veículo</p>
                        <p className="text-xl font-bold font-mono tracking-wider">{expense.vehicle_plate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Identificação de quem efetuou (controle gerencial) */}
              {expense.made_by_self === false && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Identificação da Despesa
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Efetuada por</span>
                      <span className="font-medium">{expense.made_by_employee_name || 'Não informado'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Solicitante participou?</span>
                      <Badge variant={expense.participated ? 'default' : 'secondary'}>
                        {expense.participated ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Pessoas vinculadas */}
              {linkedEmployees.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pessoas no Veículo ({linkedEmployees.length})
                  </h4>
                  <div className="space-y-2">
                    {linkedEmployees.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${person.isEmployee ? 'bg-primary/10 text-primary' : 'bg-secondary'}`}>
                            {(person.name || person.user_name || 'P')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || person.user_name || `ID: ${person.user_id}`}</p>
                            {person.cpf && <p className="text-xs text-muted-foreground font-mono">CPF: {person.cpf}</p>}
                          </div>
                        </div>
                        <Badge variant={person.isEmployee ? 'default' : 'secondary'}>
                          {person.isEmployee ? 'Funcion��rio' : 'Terceiro'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Descrição/Observações */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* DESLOCAMENTO/TRANSPORTE */}
        {(expense.category === 'travel' || expense.category === 'transport' || expense.category === 'transport_voucher') && (() => {
          // Parse linked_employees se for string
          let linkedEmployees: any[] = []
          if (expense.linked_employees) {
            if (typeof expense.linked_employees === 'string') {
              try { linkedEmployees = JSON.parse(expense.linked_employees) } catch { linkedEmployees = [] }
            } else if (Array.isArray(expense.linked_employees)) {
              linkedEmployees = expense.linked_employees
            }
          }
          
          // Parse linked_external_parties se for string
          let linkedExternal: any[] = []
          if (expense.linked_external_parties) {
            if (typeof expense.linked_external_parties === 'string') {
              try { linkedExternal = JSON.parse(expense.linked_external_parties) } catch { linkedExternal = [] }
            } else if (Array.isArray(expense.linked_external_parties)) {
              linkedExternal = expense.linked_external_parties
            }
          }
          
          const funcionarios = linkedEmployees.filter((p: any) => p.isEmployee === true)
          const terceirosNovo = linkedEmployees.filter((p: any) => p.isEmployee === false)
          const todosTerceiros = [...terceirosNovo, ...linkedExternal]
          const totalPessoas = funcionarios.length + todosTerceiros.length + 1
          const valorPorPessoa = totalPessoas > 0 ? expense.amount / totalPessoas : expense.amount
          
// Determinar tipo de transporte formatado
  const transportLabels: Record<string, string> = {
  'uber': 'Uber',
  '99': '99',
  '99pop': '99 Pop',
  'taxi': 'Táxi',
  'onibus': 'Ônibus',
  'bus': 'Ônibus',
  'aviao': 'Avião',
  'plane': 'Avião',
  'airplane': 'Avião',
  'proprio': 'Veículo Próprio',
  'own_car': 'Veículo Próprio',
  'alugado': 'Veículo Alugado',
  'rental_car': 'Veículo Alugado',
  'frota': 'Veículo da Frota',
  'company_car': 'Veículo da Empresa',
  'motorcycle_app': 'Mototáxi App',
  'metro': 'Metrô',
  'train': 'Trem',
  'boat': 'Barco/Balsa',
  'other': 'Outro',
  }
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                Detalhes do Deslocamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border border-cyan-200 dark:border-cyan-800">
                <div className="flex flex-wrap items-stretch justify-center gap-6">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(expense.amount)}</span>
                  </div>
                  <div className="w-px bg-cyan-200 dark:bg-cyan-700 hidden sm:block" />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Transporte</span>
                    <span className="text-lg font-semibold capitalize">{expense.transport_mode ? (transportLabels[expense.transport_mode] || expense.transport_mode) : 'Não informado'}</span>
                  </div>
                  {expense.distance_km && (
                    <>
                      <div className="w-px bg-cyan-200 dark:bg-cyan-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Distância</span>
                        <span className="text-2xl font-bold">{Number(expense.distance_km).toLocaleString('pt-BR')} km</span>
                      </div>
                    </>
                  )}
                  {totalPessoas > 1 && (
                    <>
                      <div className="w-px bg-cyan-200 dark:bg-cyan-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[120px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Por Pessoa</span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPorPessoa)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Tipo e Data */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Informações do Transporte
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {expense.transport_voucher_type && (
                    <DetailItem
                      icon={Bus}
                      label="Tipo de Despesa"
                      value={
                        expense.transport_voucher_type === 'fuel'
                          ? 'Combustível'
                          : expense.transport_voucher_type === 'app'
                            ? 'Deslocamento por aplicativo'
                            : expense.transport_voucher_type === 'public'
                              ? 'Transporte público'
                              : expense.transport_voucher_type
                      }
                      highlight
                    />
                  )}
                  <DetailItem icon={Car} label="Tipo de Transporte" value={expense.transport_type ? (transportLabels[expense.transport_type] || expense.transport_type) : null} highlight />
                  <DetailItem icon={Calendar} label="Data" value={expense.expense_date ? formatDate(expense.expense_date) : null} />
                  {/* Removido: is_round_trip não é mais usado */}
                  <DetailItem icon={Route} label="Distância" value={expense.distance_km ? `${Number(expense.distance_km).toLocaleString('pt-BR')} km` : null} />
                  <DetailItem icon={FileText} label="Tipo do Trajeto" value={expense.trip_type ? (globalTripTypeLabels[expense.trip_type] || expense.trip_type) : expense.purchase_reason} />
                  {expense.municipality && (
                    <DetailItem icon={MapPin} label="Localização" value={`${expense.municipality}${expense.state ? `/${expense.state}` : ''}`} />
                  )}
                </div>
              </div>
              
{/* Trajeto Visual - só mostra destino se different_arrival for true ou se há destino definido */}
  {(expense.origin || expense.departure_city) && (
  <div>
  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
  <Route className="w-4 h-4" />
  Trajeto
  </h4>
                  <div className="p-4 rounded-lg border bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/20 dark:to-blue-950/20">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                      <div className="flex-1 p-3 rounded bg-background border-l-4 border-emerald-500">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Origem</p>
                        <p className="font-medium text-lg">
                          {expense.origin || (expense.departure_city ? `${expense.departure_city}${expense.departure_state ? `/${expense.departure_state}` : ''}` : 'Não informado')}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center justify-center px-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-current" />
                          <div className="w-8 h-0.5 bg-current" />
                          <div className="w-2 h-2 rounded-full bg-current" />
                          <div className="w-8 h-0.5 bg-current" />
                          <Navigation className="w-4 h-4" />
                        </div>
                      </div>
{(expense.different_arrival || expense.destination || expense.arrival_city) && (
  <div className="flex-1 p-3 rounded bg-background border-l-4 border-blue-500">
  <p className="text-xs text-muted-foreground uppercase tracking-wide">Destino</p>
  <p className="font-medium text-lg">
  {expense.destination || (expense.arrival_city ? `${expense.arrival_city}${expense.arrival_state ? `/${expense.arrival_state}` : ''}` : 'Mesmo local de origem')}
  </p>
  </div>
  )}
  </div>
  {expense.different_arrival && (
  <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
  <AlertCircle className="w-3 h-3" />
  Destino diferente do local de origem
  </p>
  )}
{/* Removido: is_round_trip não é mais usado */}
                  </div>
                </div>
              )}
              
              {/* Divisão de valores */}
              {totalPessoas > 1 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Divisão de Valores
                  </h4>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800">
                    <div className="flex flex-wrap items-stretch justify-center gap-6">
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(expense.amount)}</span>
                      </div>
                      <div className="w-px bg-purple-200 dark:bg-purple-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[80px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Pessoas</span>
                        <span className="text-2xl font-bold">{totalPessoas}</span>
                      </div>
                      <div className="w-px bg-purple-200 dark:bg-purple-700 hidden sm:block" />
                      <div className="flex flex-col items-center min-w-[100px]">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Por Pessoa</span>
                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorPorPessoa)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Funcionários no trajeto */}
              {funcionarios.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Funcionários no Trajeto ({funcionarios.length})
                  </h4>
                  <div className="space-y-2">
                    {funcionarios.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {(person.name || person.user_name || 'F')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || person.user_name || `Funcionário ID: ${person.user_id}`}</p>
                            {person.department && <p className="text-xs text-muted-foreground">{person.department}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default">Funcionário</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Terceiros/Passageiros */}
              {todosTerceiros.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Passageiros / Terceiros ({todosTerceiros.length})
                  </h4>
                  <div className="space-y-2">
                    {todosTerceiros.map((person: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                            {(person.name || 'T')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{person.name || 'Não identificado'}</p>
                            {person.cpf && <p className="text-xs text-muted-foreground font-mono">CPF: {person.cpf}</p>}
                            {person.company && <p className="text-xs text-muted-foreground">{person.company}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">Terceiro</Badge>
                          <p className="text-sm font-medium mt-1">{formatCurrency(valorPorPessoa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Descrição/Observações */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* MATERIAL DE ESCRITÓRIO / OUTRAS DESPESAS */}
        {(expense.category === 'office_supplies' || expense.category === 'other') && (() => {
          // Parse items se for string
          let items: any[] = []
          if (expense.items) {
            if (typeof expense.items === 'string') {
              try { items = JSON.parse(expense.items) } catch { items = [] }
            } else if (Array.isArray(expense.items)) {
              items = expense.items
            }
          }
          
                  // Calcular total dos itens - suportar múltiplos formatos
                  const totalItens = items.reduce((sum: number, item: any) => {
                    let itemTotal = 0
                    if (item.totalPrice !== undefined && item.totalPrice !== null) {
                      // Se totalPrice é string formatada "R$ 10,00", converter
                      itemTotal = typeof item.totalPrice === 'string'
                        ? Number(item.totalPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                        : Number(item.totalPrice)
                    } else if (item.total !== undefined && item.total !== null) {
                      itemTotal = Number(item.total)
                    } else if (item.totalValue !== undefined && item.totalValue !== null) {
                      itemTotal = Number(item.totalValue)
                    } else if (item.valor_total !== undefined && item.valor_total !== null) {
                      itemTotal = Number(item.valor_total)
                    } else {
                      const qty = Number(item.quantity || item.qty || 1) || 1
                      let unitValue = 0
                      if (item.unitPrice !== undefined && item.unitPrice !== null) {
                        unitValue = typeof item.unitPrice === 'string'
                          ? Number(item.unitPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                          : Number(item.unitPrice)
                      } else if (item.unit_value !== undefined && item.unit_value !== null) {
                        unitValue = Number(item.unit_value)
                      } else if (item.unitValue !== undefined && item.unitValue !== null) {
                        unitValue = Number(item.unitValue)
                      } else if (item.price !== undefined && item.price !== null) {
                        unitValue = Number(item.price)
                      } else if (item.valor !== undefined && item.valor !== null) {
                        unitValue = Number(item.valor)
                      }
                      if (!isNaN(unitValue) && unitValue > 0) {
                        itemTotal = qty * unitValue
                      }
                    }
                    // Garantir que não soma NaN
                    return sum + (isNaN(itemTotal) ? 0 : itemTotal)
                  }, 0)
                  
                  // Se totalItens é 0 mas temos itens, usar o valor total da despesa
                  const displayTotalItens = totalItens > 0 ? totalItens : expense.amount
          
          // Labels para tipo de loja
          const storeTypeLabels: Record<string, string> = {
            'fisica': 'Loja Física',
            'online': 'Loja Online',
            'marketplace': 'Marketplace',
            'atacado': 'Atacado',
            'varejo': 'Varejo',
          }
          
          return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                {expense.category === 'office_supplies' ? 'Detalhes da Compra de Material' : 'Detalhes da Despesa'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo */}
              <div className={`p-5 rounded-xl border ${expense.category === 'office_supplies' 
                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800' 
                : 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 border-slate-200 dark:border-slate-800'}`}>
                <div className="flex flex-wrap items-stretch justify-center gap-6">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Valor Total</span>
                    <span className={`text-2xl font-bold ${expense.category === 'office_supplies' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                  <div className={`w-px hidden sm:block ${expense.category === 'office_supplies' ? 'bg-amber-200 dark:bg-amber-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Itens</span>
                    <span className="text-2xl font-bold">{items.length}</span>
                  </div>
                  <div className={`w-px hidden sm:block ${expense.category === 'office_supplies' ? 'bg-amber-200 dark:bg-amber-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Loja</span>
                    <span className="text-lg font-semibold truncate max-w-[150px]">{expense.store_name || expense.store_type ? (storeTypeLabels[expense.store_type] || expense.store_type) : 'Não informado'}</span>
                  </div>
                  <div className={`w-px hidden sm:block ${expense.category === 'office_supplies' ? 'bg-amber-200 dark:bg-amber-700' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className="flex flex-col items-center min-w-[120px]">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Data</span>
                    <span className="text-lg font-semibold">{expense.expense_date ? formatDate(expense.expense_date) : 'Não informado'}</span>
                  </div>
                </div>
              </div>
              
              {/* Dados da Compra */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Informações da Compra
                </h4>
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo de Loja</p>
                      <p className="font-medium">{expense.store_type ? (storeTypeLabels[expense.store_type] || expense.store_type) : 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Nome da Loja/Estabelecimento</p>
                      <p className="font-medium">{expense.store_name || 'Não informado'}</p>
                    </div>
                    {expense.purchase_reason && (
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground">Motivo da Compra</p>
                        <p className="font-medium">{expense.purchase_reason}</p>
                      </div>
                    )}
{(expense.requester_name || expense.requester) && (
                      <div>
                        <p className="text-xs text-muted-foreground">Solicitante</p>
                        <p className="font-medium">{expense.requester_name || expense.requester}</p>
                      </div>
                    )}
                    {expense.municipality && (
                      <div>
                        <p className="text-xs text-muted-foreground">Localização</p>
                        <p className="font-medium">{expense.municipality}{expense.state ? `/${expense.state}` : ''}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Tabela de Itens */}
              {items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Itens Comprados ({items.length} {items.length === 1 ? 'item' : 'itens'})
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">Descrição</th>
                          <th className="text-center px-3 py-2 font-medium">Qtd</th>
                          <th className="text-right px-3 py-2 font-medium">Valor Unit.</th>
                          <th className="text-right px-3 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item: any, idx: number) => {
                          const qty = Number(item.quantity || item.qty || 1) || 1
                          // Suportar múltiplos formatos de valor unitário
                          let unitValue = 0
                          if (item.unitPrice !== undefined && item.unitPrice !== null) {
                            unitValue = typeof item.unitPrice === 'string' 
                              ? Number(item.unitPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                              : Number(item.unitPrice)
                          } else if (item.unit_value !== undefined && item.unit_value !== null) {
                            unitValue = Number(item.unit_value)
                          } else if (item.unitValue !== undefined && item.unitValue !== null) {
                            unitValue = Number(item.unitValue)
                          } else if (item.price !== undefined && item.price !== null) {
                            unitValue = Number(item.price)
                          } else if (item.valor !== undefined && item.valor !== null) {
                            unitValue = Number(item.valor)
                          }
                          if (isNaN(unitValue)) unitValue = 0
                          
                          // Suportar múltiplos formatos de total do item
                          let itemTotal = 0
                          if (item.totalPrice !== undefined && item.totalPrice !== null) {
                            itemTotal = typeof item.totalPrice === 'string'
                              ? Number(item.totalPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                              : Number(item.totalPrice)
                          } else if (item.total !== undefined && item.total !== null) {
                            itemTotal = Number(item.total)
                          } else if (item.totalValue !== undefined && item.totalValue !== null) {
                            itemTotal = Number(item.totalValue)
                          } else if (item.valor_total !== undefined && item.valor_total !== null) {
                            itemTotal = Number(item.valor_total)
                          } else if (unitValue > 0) {
                            itemTotal = qty * unitValue
                          }
                          if (isNaN(itemTotal)) itemTotal = 0
                          
                          // Se não temos valor unitário nem total do item, calcular baseado no valor da despesa
                          if (unitValue === 0 && itemTotal === 0 && expense.amount > 0) {
                            // Calcular valor proporcional baseado na quantidade total de itens
                            const totalQty = items.reduce((sum: number, i: any) => sum + (Number(i.quantity || i.qty || 1) || 1), 0)
                            itemTotal = (expense.amount / totalQty) * qty
                            unitValue = itemTotal / qty
                          }
                          
                          // Se temos total mas não unitário, calcular unitário
                          if (unitValue === 0 && itemTotal > 0 && qty > 0) {
                            unitValue = itemTotal / qty
                          }
                          
                          return (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium">{item.description || item.name || 'Item sem descrição'}</td>
                              <td className="text-center px-3 py-2">{qty}</td>
                              <td className="text-right px-3 py-2">{unitValue > 0 ? formatCurrency(unitValue) : '-'}</td>
                              <td className="text-right px-3 py-2 font-medium">{itemTotal > 0 ? formatCurrency(itemTotal) : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr className="border-t-2">
                          <td colSpan={4} className="px-3 py-2 font-medium text-right">Total dos Itens:</td>
                          <td className="px-3 py-2 font-bold text-right text-primary">{formatCurrency(displayTotalItens)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {Math.abs(displayTotalItens - expense.amount) > 0.01 && displayTotalItens !== expense.amount && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      * O valor total da despesa ({formatCurrency(expense.amount)}) pode incluir taxas, frete ou outros custos
                    </p>
                  )}
                </div>
              )}
              
              {/* Descrição/Observaç��es */}
              {expense.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Observações
                  </h4>
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm whitespace-pre-wrap">{expense.description}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})()}

        {/* INFORMAÇÕES BÁSICAS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem icon={Calendar} label="Data da Despesa" value={formatDate(expense.expense_date)} highlight />
            <DetailItem icon={MapPin} label="Município" value={expense.municipality} />
            <DetailItem icon={MapPin} label="Estado" value={expense.state} />
            <DetailItem icon={MapPin} label="Tipo de Local" value={expense.location_type === 'capital' ? 'Capital' : expense.location_type === 'interior' ? 'Interior' : expense.location_type} />
            <DetailItem icon={User} label="Usuário" value={expense.user_name} />
            
            {expense.description && (
              <div className="col-span-full">
                <DetailItem icon={FileText} label="Descrição / Observações" value={expense.description} fullWidth />
              </div>
            )}
          </CardContent>
        </Card>

        {/* TERCEIROS */}
        {(expense.third_party_name || expense.third_party_cpf) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Terceiro Vinculado
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailItem icon={User} label="Nome" value={expense.third_party_name} />
              <DetailItem icon={CreditCard} label="CPF" value={expense.third_party_cpf} />
            </CardContent>
          </Card>
        )}

        {/* PARCELAS */}
        {((expense.installments && expense.installments > 1) || expense.total_installments || expense.installment_number) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Informações de Parcelamento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailItem icon={Hash} label="Parcela Atual" value={`${expense.current_installment || expense.installment_number || 1} de ${expense.installments || expense.total_installments || 1}`} highlight />
              <DetailItem icon={FileText} label="Tipo de Parcelamento" value={expense.installment_type ? (installmentTypeLabels[expense.installment_type] || expense.installment_type) : null} />
            </CardContent>
          </Card>
        )}

        {/* PAGAMENTO */}
        {(expense.payment_barcode || expense.barcode || expense.pix_code || expense.payment_pix) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Dados de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(expense.payment_barcode || expense.barcode) && (
                <DetailItem icon={Banknote} label="Código de Barras" value={expense.payment_barcode || expense.barcode} fullWidth />
              )}
              {(expense.pix_code || expense.payment_pix) && (
                <DetailItem icon={QrCode} label="Código PIX / Copia e Cola" value={expense.pix_code || expense.payment_pix} fullWidth />
              )}
            </CardContent>
          </Card>
        )}

        {/* COMPROVANTE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Comprovante
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expense.receipt_pathname || expense.receipt_url ? (() => {
              // Para arquivos privados, usar a API /api/file
              const storedPath = expense.receipt_pathname || expense.receipt_url
              const isPdf = storedPath?.toLowerCase().endsWith('.pdf')
              // Usar API /api/file?pathname= para servir arquivos privados
              const receiptApiUrl = `/api/file?pathname=${encodeURIComponent(storedPath)}`
              
              return (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-6 flex flex-col items-center justify-center min-h-[150px]">
                    {isPdf ? (
                      <>
                        <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Documento PDF</p>
                      </>
                    ) : (
                      <img 
                        src={receiptApiUrl} 
                        alt="Comprovante" 
                        className="max-h-[200px] object-contain rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <a href={receiptApiUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      Visualizar Comprovante
                    </a>
                  </Button>
                </div>
              )
            })() : (
              <div className="bg-muted/50 rounded-lg p-6 flex flex-col items-center justify-center min-h-[120px]">
                <CircleDollarSign className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum comprovante anexado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* INFORMAÇÕES DO REGISTRO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Informações do Registro
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailItem icon={Calendar} label="Criado em" value={formatDateTime(expense.created_at)} />
            <DetailItem icon={Clock} label="Atualizado em" value={formatDateTime(expense.updated_at)} />
            {expense.approved_at && (
              <DetailItem icon={CheckCircle} label="Aprovado em" value={formatDateTime(expense.approved_at)} />
            )}
            {expense.approved_by && (
              <DetailItem icon={User} label="Aprovado por" value={`ID: ${expense.approved_by}`} />
            )}
            {expense.batch_id && (
              <DetailItem icon={Package} label="Remessa" value={`#${expense.batch_id}`} />
            )}
          </CardContent>
        </Card>

        {/* HISTÓRICO */}
        {history && history.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico de Alterações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-muted space-y-6">
                {history.map((entry, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-background border-2 border-primary" />
                    <div>
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.previous_status && entry.new_status && (
                        <p className="text-sm text-muted-foreground">
                          {statusLabels[entry.previous_status] || entry.previous_status} → {statusLabels[entry.new_status] || entry.new_status}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(entry.created_at)}
                        {entry.user_name && ` • ${entry.user_name}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
