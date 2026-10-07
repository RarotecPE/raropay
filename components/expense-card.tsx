'use client'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  User,
  Calendar,
  MapPin,
  Eye,
  CheckCircle,
  XCircle,
  Building2,
  Utensils,
  Fuel,
  Car,
  ParkingCircle,
  Paperclip,
  FileText,
  BedDouble,
  Clock,
  Users,
  Receipt,
  Gauge,
  Route,
  Store,
  CreditCard,
  DollarSign,
  CalendarDays,
  Package,
  Trash2,
  AlertTriangle,
  Bus
} from "lucide-react"
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
import { Spinner } from '@/components/ui/spinner'
import Link from "next/link"
import { formatCurrency, formatDate, getCategoryLabel, getExpenseTypeLabel, getStatusBadge } from "@/lib/format"

function parseJsonArray<T = any>(val: any): T[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// Interface expandida da despesa com todos os campos relevantes
export interface ExpenseData {
  id: number
  expense_type: string
  category: string
  amount: number
  expense_date: string
  municipality: string
  state: string
  description: string
  status: string
  receipt_pathname: string | null
  created_at: string
  user_id: number
  user_name: string
  // Hospedagem
  accommodation_name?: string
  accommodation_cnpj?: string
  checkin_date?: string
  checkout_date?: string
  nights_count?: number
  has_breakfast?: boolean
  single_room_qty?: number
  single_room_value?: number
  double_room_qty?: number
  double_room_value?: number
  triple_room_qty?: number
  triple_room_value?: number
  daily_rate?: number
  is_capital?: boolean
  // Alimentação
  meal_type?: string
  meal_time?: string
  establishment_name?: string
  establishment_cnpj?: string
  establishment_type?: string
  number_of_people?: number
  linked_employees?: any[]
  linked_external_parties?: any[]
  // Identificação (controle gerencial)
  made_by_self?: boolean
  made_by_employee_name?: string
  participated?: boolean
  // Combustível
  fuel_type?: string
  gas_station_name?: string
  liters?: number
  price_per_liter?: number
  vehicle_plate?: string
  vehicle_id?: number
  km_before?: number
  km_after?: number
  total_km?: number
  km_per_liter?: number
  departure_city?: string
  departure_state?: string
  arrival_city?: string
  arrival_state?: string
  stops?: any[]
  is_irregular_route?: boolean
  // Deslocamento / Vale-Transporte
  transport_type?: string
  transport_mode?: string
  transport_voucher_type?: string
  origin?: string
  destination?: string
  distance_km?: number
  different_arrival?: boolean
  // Estacionamento
  parking_name?: string
  parking_type?: string
  parking_reason?: string
  entry_time?: string
  exit_time?: string
  // Itens escritório / outras
  items?: any[]
  purchase_reason?: string
  requester?: string
  requester_name?: string
  location_type?: string
  // Parcelas
  installments?: number
  current_installment?: number
  total_installments?: number
  // Extras de hospedagem
  extra_expenses?: Array<{
    description: string
    value: number
    isMeal?: boolean
    mealType?: string
    numberOfPeople?: number
  }>
  // Limite excedido
  exceeds_limit?: boolean
  limit_exceeded_reason?: string
  // Batch
  batch_id?: number
  // Pagamento
  paid?: boolean
  paid_at?: string
}

interface ExpenseCardProps {
  expense: ExpenseData
  isChecked?: boolean
  showCheckbox?: boolean
  showActions?: boolean
  showDelete?: boolean
  onToggleCheck?: () => void
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
  onView?: () => void
  onUpdate?: () => void
  processing?: boolean
  deleting?: boolean
}

// Ícone por categoria
function getCategoryIcon(category: string) {
  switch (category) {
    case 'accommodation': return <BedDouble className="h-4 w-4" />
    case 'food':
    case 'meal_voucher': return <Utensils className="h-4 w-4" />
    case 'fuel': return <Fuel className="h-4 w-4" />
    case 'transport': return <Car className="h-4 w-4" />
    case 'transport_voucher': return <Bus className="h-4 w-4" />
    case 'parking': return <ParkingCircle className="h-4 w-4" />
    case 'office_supplies': return <Paperclip className="h-4 w-4" />
    default: return <FileText className="h-4 w-4" />
  }
}

// Labels de tipo de refeição
function getMealTypeLabel(type: string) {
  const labels: Record<string, string> = {
    breakfast: 'Café da Manhã',
    lunch: 'Almoço',
    dinner: 'Jantar',
    snack: 'Lanche'
  }
  return labels[type] || type
}

// Labels de tipo de combustível
function getFuelTypeLabel(type: string) {
  const labels: Record<string, string> = {
    gasoline: 'Gasolina',
    ethanol: 'Etanol',
    diesel: 'Diesel',
    gnv: 'GNV'
  }
  return labels[type] || type
}

// Labels de tipo de estacionamento
function getParkingTypeLabel(type: string) {
  const labels: Record<string, string> = {
    rotativo: 'Rotativo',
    shopping: 'Shopping',
    empresarial: 'Empresarial',
    aeroporto: 'Aeroporto',
    rua: 'Rua'
  }
  return labels[type] || type
}

// Labels de motivo do estacionamento
function getParkingReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    reuniao: 'Reunião',
    alimentacao: 'Alimentação',
    compra_entrega: 'Compra/Entrega/Retirada',
    guarda_veiculo: 'Guarda de Veículo',
    mensalista: 'Mensalista'
  }
  return labels[reason] || reason
}

// Labels de motivo da compra
function getPurchaseReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    solicitacao: 'Solicitação',
    reposicao: 'Reposição',
    necessidade: 'Necessidade'
  }
  return labels[reason] || reason
}

// Labels de tipo de estabelecimento
function getEstablishmentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    fisico: 'Físico',
    online: 'Online',
    restaurant: 'Restaurante',
    fastfood: 'Fast Food',
    cafeteria: 'Cafeteria',
    padaria: 'Padaria',
    mercado: 'Mercado',
    outro: 'Outro'
  }
  return labels[type] || type
}

export function ExpenseCard({
  expense,
  isChecked = false,
  showCheckbox = false,
  showActions = false,
  showDelete = false,
  onToggleCheck,
  onApprove,
  onReject,
  onDelete,
  onView,
  processing = false,
  deleting = false
}: ExpenseCardProps) {
  
  // Renderizar detalhes específicos por categoria
  function renderCategoryDetails() {
    switch (expense.category) {
      case 'accommodation': {
        // Calcular valores separados
        const extras = parseJsonArray(expense.extra_expenses)
        const linkedEmployees = parseJsonArray(expense.linked_employees)
        const linkedExternalParties = parseJsonArray(expense.linked_external_parties)
        const extrasNaoRefeicao = extras.filter((e: any) => !e.isMeal)
        const extrasRefeicao = extras.filter((e: any) => e.isMeal)
        const totalExtrasNaoRefeicao = extrasNaoRefeicao.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0)
        const totalExtrasRefeicao = extrasRefeicao.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0)
        
        // Calcular quartos
        const quartosTotal = 
          ((expense.single_room_qty || 0) * (expense.single_room_value || 0) +
           (expense.double_room_qty || 0) * (expense.double_room_value || 0) +
           (expense.triple_room_qty || 0) * (expense.triple_room_value || 0)) * (expense.nights_count || 1)
        
        // Valor para média (exclui refeições oficiais)
        const valorParaMedia = quartosTotal + totalExtrasNaoRefeicao
        
        // Pessoas vinculadas
        const totalPessoas = 1 + linkedEmployees.length + linkedExternalParties.length
        
        // Média por pessoa/diária
        const mediaPorPessoaDiaria = expense.nights_count && totalPessoas 
          ? valorParaMedia / expense.nights_count / totalPessoas 
          : 0
        
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {expense.accommodation_name && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Estabelecimento</p>
                    <p className="font-medium">{expense.accommodation_name}</p>
                  </div>
                </div>
              )}
              {expense.checkin_date && expense.checkout_date && (
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Período</p>
                    <p className="font-medium">
                      {formatDate(expense.checkin_date)} - {formatDate(expense.checkout_date)}
                    </p>
                  </div>
                </div>
              )}
              {expense.nights_count && (
                <div className="flex items-start gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Diárias</p>
                    <p className="font-medium">{expense.nights_count} noite(s)</p>
                  </div>
                </div>
              )}
              {totalPessoas > 1 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Pessoas</p>
                    <p className="font-medium">{totalPessoas} pessoa(s)</p>
                  </div>
                </div>
              )}
              {(expense.single_room_qty || expense.double_room_qty || expense.triple_room_qty) && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-muted-foreground text-xs mb-1">Quartos</p>
                  <div className="flex flex-wrap gap-2">
                    {expense.single_room_qty > 0 && (
                      <Badge variant="outline">
                        {expense.single_room_qty}x Solteiro ({formatCurrency(expense.single_room_value || 0)}/diária)
                      </Badge>
                    )}
                    {expense.double_room_qty > 0 && (
                      <Badge variant="outline">
                        {expense.double_room_qty}x Casal ({formatCurrency(expense.double_room_value || 0)}/diária)
                      </Badge>
                    )}
                    {expense.triple_room_qty > 0 && (
                      <Badge variant="outline">
                        {expense.triple_room_qty}x Triplo ({formatCurrency(expense.triple_room_value || 0)}/diária)
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {expense.has_breakfast !== undefined && (
                <div className="flex items-center gap-2">
                  <Badge variant={expense.has_breakfast ? "default" : "secondary"}>
                    {expense.has_breakfast ? "Com café da manhã" : "Sem café da manhã"}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Despesas Extras */}
            {extras.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                {/* Extras que NÃO são refeição (computam na média) */}
                {extrasNaoRefeicao.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Despesas Extras (incluídas na média)</p>
                    <div className="flex flex-wrap gap-2">
                      {extrasNaoRefeicao.map((extra, idx) => (
                        <Badge key={idx} variant="outline">
                          {extra.description}: {formatCurrency(extra.value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Extras que SÃO refeição oficial (NÃO computam na média de hospedagem) */}
                {extrasRefeicao.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Refeições Oficiais (limite separado)</p>
                    <div className="flex flex-wrap gap-2">
                      {extrasRefeicao.map((extra, idx) => {
                        const pessoasRefeicao = extra.numberOfPeople || 1
                        return (
                          <Badge key={idx} variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Utensils className="h-3 w-3 mr-1" />
                            {extra.mealType === 'lunch' ? 'Almoço' : extra.mealType === 'dinner' ? 'Jantar' : extra.mealType === 'breakfast' ? 'Café da Manhã' : extra.description}: {formatCurrency(extra.value)}
                            {pessoasRefeicao > 1 ? (
                              <span className="ml-1 opacity-75">({formatCurrency(extra.value / pessoasRefeicao)}/pessoa x{pessoasRefeicao})</span>
                            ) : (
                              <span className="ml-1 opacity-75">(1 pessoa)</span>
                            )}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Resumo de valores */}
            {expense.nights_count && mediaPorPessoaDiaria > 0 && (
              <div className="border-t pt-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="bg-muted/50 px-3 py-1.5 rounded">
                    <span className="text-muted-foreground text-xs">Hospedagem: </span>
                    <span className="font-medium">{formatCurrency(valorParaMedia)}</span>
                  </div>
                  <div className="bg-primary/10 px-3 py-1.5 rounded">
                    <span className="text-muted-foreground text-xs">Média/pessoa/diária: </span>
                    <span className="font-semibold text-primary">{formatCurrency(mediaPorPessoaDiaria)}</span>
                  </div>
                  {totalExtrasRefeicao > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded">
                      <span className="text-muted-foreground text-xs">Refeições: </span>
                      <span className="font-medium text-blue-700 dark:text-blue-300">{formatCurrency(totalExtrasRefeicao)}</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                        ({extrasRefeicao.length} refeição{extrasRefeicao.length > 1 ? 'ões' : ''})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'food':
      case 'meal_voucher': {
        const linkedEmployees = parseJsonArray(expense.linked_employees)
        const linkedExternalParties = parseJsonArray(expense.linked_external_parties)
        // Calcular pessoas vinculadas
        const totalPessoasRefeicao = 1 + linkedEmployees.length + linkedExternalParties.length
        const mediaPorPessoaRefeicao = totalPessoasRefeicao > 0 ? expense.amount / totalPessoasRefeicao : expense.amount
        
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {expense.meal_type && (
                <div className="flex items-start gap-2">
                  <Utensils className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Refeição</p>
                    <p className="font-medium">{getMealTypeLabel(expense.meal_type)}</p>
                  </div>
                </div>
              )}
              {expense.establishment_name && (
                <div className="flex items-start gap-2">
                  <Store className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Estabelecimento</p>
                    <p className="font-medium">{expense.establishment_name}</p>
                  </div>
                </div>
              )}
              {expense.establishment_type && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Tipo</p>
                    <p className="font-medium">{getEstablishmentTypeLabel(expense.establishment_type)}</p>
                  </div>
                </div>
              )}
              {totalPessoasRefeicao > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Pessoas</p>
                    <p className="font-medium">{totalPessoasRefeicao}</p>
                  </div>
                </div>
              )}
              {linkedEmployees.length > 0 && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-muted-foreground text-xs mb-1">Funcionários Vinculados</p>
                  <div className="flex flex-wrap gap-1">
                    {linkedEmployees.map((emp: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {emp.name || `ID: ${emp.user_id}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Média por pessoa */}
            {totalPessoasRefeicao > 1 && (
              <div className="border-t pt-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
                  <div className="flex flex-wrap items-stretch justify-center gap-4">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Total</span>
                      <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(expense.amount)}</span>
                    </div>
                    <div className="w-px bg-orange-200 dark:bg-orange-700 hidden sm:block" />
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Pessoas</span>
                      <span className="text-lg font-bold">{totalPessoasRefeicao}</span>
                    </div>
                    <div className="w-px bg-orange-200 dark:bg-orange-700 hidden sm:block" />
                    <div className="flex flex-col items-center min-w-[80px]">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Por Pessoa</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(mediaPorPessoaRefeicao)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'fuel':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {expense.fuel_type && (
              <div className="flex items-start gap-2">
                <Fuel className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Combustível</p>
                  <p className="font-medium">{getFuelTypeLabel(expense.fuel_type)}</p>
                </div>
              </div>
            )}
            {expense.gas_station_name && (
              <div className="flex items-start gap-2">
                <Store className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Posto</p>
                  <p className="font-medium">{expense.gas_station_name}</p>
                </div>
              </div>
            )}
            {expense.liters && (
              <div className="flex items-start gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Litros</p>
                  <p className="font-medium">{expense.liters}L</p>
                </div>
              </div>
            )}
            {expense.price_per_liter && (
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Preço/Litro</p>
                  <p className="font-medium">{formatCurrency(expense.price_per_liter)}</p>
                </div>
              </div>
            )}
            {expense.vehicle_plate && (
              <div className="flex items-start gap-2">
                <Car className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Veículo</p>
                  <p className="font-medium">{expense.vehicle_plate}</p>
                </div>
              </div>
            )}
            {expense.departure_city && expense.arrival_city && (
              <div className="flex items-start gap-2 col-span-2">
                <Route className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Trajeto</p>
                  <p className="font-medium">{expense.departure_city} → {expense.arrival_city}</p>
                </div>
              </div>
            )}
            {expense.total_km && (
              <div className="flex items-start gap-2">
                <Route className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">KM Total</p>
                  <p className="font-medium">{expense.total_km} km</p>
                </div>
              </div>
            )}
            {expense.km_per_liter && (
              <div className="flex items-start gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Consumo</p>
                  <p className="font-medium">{expense.km_per_liter.toFixed(1)} km/L</p>
                </div>
              </div>
            )}
            {expense.is_irregular_route && (
              <div className="col-span-2 md:col-span-4">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  Percurso Irregular
                </Badge>
              </div>
            )}
          </div>
        )

      case 'transport':
      case 'transport_voucher':
      case 'travel':
        // Labels para o meio de transporte
        const transportModeLabels: Record<string, string> = {
          'uber': 'Uber',
          '99': '99',
          '99pop': '99 Pop',
          'taxi': 'Táxi',
          'bus': 'Ônibus',
          'onibus': 'Ônibus',
          'plane': 'Avião',
          'airplane': 'Avião',
          'aviao': 'Avião',
          'motorcycle_app': 'Mototáxi App',
          'rental_car': 'Carro Alugado',
          'alugado': 'Carro Alugado',
          'own_car': 'Carro Próprio',
          'proprio': 'Carro Próprio',
          'company_car': 'Carro da Empresa',
          'frota': 'Carro da Frota',
          'metro': 'Metrô',
          'train': 'Trem',
          'boat': 'Barco/Balsa',
          'other': 'Outro'
        }
        // Labels para tipo de trajeto / motivo
        const transportTypeLabels: Record<string, string> = {
          'metropolitan': 'Metropolitano',
          'intermunicipal': 'Intermunicipal',
          'interstate': 'Interestadual',
          'visita_cliente': 'Visita a Cliente',
          'reuniao': 'Reunião',
          'entrega': 'Entrega',
          'coleta': 'Coleta',
          'viagem_trabalho': 'Viagem a Trabalho',
          'deslocamento_diario': 'Deslocamento Diário',
          'outro': 'Outro',
        }
        // Labels para categoria de vale-transporte
        const transportVoucherTypeLabels: Record<string, string> = {
          'fuel': 'Combustível',
          'app': 'Deslocamento por aplicativo',
          'public': 'Transporte público',
        }
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {expense.transport_voucher_type && (
              <div className="flex items-start gap-2">
                <Bus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Modalidade</p>
                  <p className="font-medium">{transportVoucherTypeLabels[expense.transport_voucher_type] || expense.transport_voucher_type}</p>
                </div>
              </div>
            )}
            {expense.transport_mode && (
              <div className="flex items-start gap-2">
                <Car className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Transporte</p>
                  <p className="font-medium">{transportModeLabels[expense.transport_mode] || expense.transport_mode}</p>
                </div>
              </div>
            )}
            {expense.transport_type && (
              <div className="flex items-start gap-2">
                <Route className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Tipo</p>
                  <p className="font-medium">{transportTypeLabels[expense.transport_type] || expense.transport_type}</p>
                </div>
              </div>
            )}
            {expense.departure_city && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Partida</p>
                  <p className="font-medium">{expense.departure_city}</p>
                </div>
              </div>
            )}
            {expense.different_arrival && expense.arrival_city && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Chegada</p>
                  <p className="font-medium">{expense.arrival_city}</p>
                </div>
              </div>
            )}
            {expense.distance_km && (
              <div className="flex items-start gap-2">
                <Route className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Distância</p>
                  <p className="font-medium">{expense.distance_km} km</p>
                </div>
              </div>
            )}
          </div>
        )

      case 'parking':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {expense.parking_name && (
              <div className="flex items-start gap-2">
                <ParkingCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Estabelecimento</p>
                  <p className="font-medium">{expense.parking_name}</p>
                </div>
              </div>
            )}
            {expense.parking_type && (
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Tipo</p>
                  <p className="font-medium">{getParkingTypeLabel(expense.parking_type)}</p>
                </div>
              </div>
            )}
            {expense.parking_reason && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Motivo</p>
                  <p className="font-medium">{getParkingReasonLabel(expense.parking_reason)}</p>
                </div>
              </div>
            )}
            {expense.entry_time && expense.exit_time && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Horário</p>
                  <p className="font-medium">{expense.entry_time} - {expense.exit_time}</p>
                </div>
              </div>
            )}
          </div>
        )

      case 'office_supplies':
      case 'other':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {expense.establishment_name && (
              <div className="flex items-start gap-2">
                <Store className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Estabelecimento</p>
                  <p className="font-medium">{expense.establishment_name}</p>
                </div>
              </div>
            )}
            {expense.location_type && (
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Tipo Loja</p>
                  <p className="font-medium">{getEstablishmentTypeLabel(expense.location_type)}</p>
                </div>
              </div>
            )}
            {expense.purchase_reason && (
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Motivo</p>
                  <p className="font-medium">{getPurchaseReasonLabel(expense.purchase_reason)}</p>
                </div>
              </div>
            )}
            {(expense.requester_name || expense.requester) && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Solicitante</p>
                  <p className="font-medium">{expense.requester_name || expense.requester}</p>
                </div>
              </div>
            )}
            {(() => {
              const items = parseJsonArray(expense.items)
              return items.length > 0 && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-muted-foreground text-xs mb-1">Itens</p>
                  <div className="space-y-1">
                    {items.map((item: any, i: number) => {
                      // Parsear totalPrice de string formatada "R$ 10,00" para número
                      let itemTotal = 0
                      if (item.totalPrice) {
                        itemTotal = typeof item.totalPrice === 'string'
                          ? Number(item.totalPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                          : Number(item.totalPrice)
                      } else if (item.total) {
                        itemTotal = Number(item.total)
                      } else if (item.unitPrice) {
                        // Tentar calcular do preço unitário
                        const unitPrice = typeof item.unitPrice === 'string'
                          ? Number(item.unitPrice.replace(/[^\d,.-]/g, '').replace(',', '.'))
                          : Number(item.unitPrice)
                        itemTotal = unitPrice * (item.quantity || 1)
                      }
                      
                      // Se ainda não tem valor, usar valor global dividido pelos itens
                      if (!itemTotal || isNaN(itemTotal)) {
                        itemTotal = expense.amount / items.length
                      }
                      
                      return (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                          <span>{item.quantity || 1}x {item.name || 'Item sem descrição'}</span>
                          <span className="font-medium">{formatCurrency(itemTotal)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div 
      className={`p-4 rounded-lg border transition-colors ${
        isChecked ? 'bg-primary/5 border-primary/30' : 'bg-card hover:bg-muted/30'
      }`}
    >
      {/* Header do card */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3 flex-1">
          {showCheckbox && (
            <Checkbox
              checked={isChecked}
              onCheckedChange={onToggleCheck}
              className="mt-1"
            />
          )}
          
          <div className="flex-1 space-y-3">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {getCategoryIcon(expense.category)}
                {getCategoryLabel(expense.category)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getExpenseTypeLabel(expense.expense_type)}
              </Badge>
                {getStatusBadge(expense.status)}
                {/* Badges de pagamento apenas para reembolso */}
                {expense.status === 'approved' && expense.expense_type === 'reimbursement' && expense.paid && (
                  <Badge className="text-xs bg-emerald-500 text-white">
                    Pago
                  </Badge>
                )}
                {expense.status === 'approved' && expense.expense_type === 'reimbursement' && !expense.paid && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:border-amber-700/60 dark:text-amber-400">
                    Aguardando Pagamento
                  </Badge>
                )}
  {expense.installments && expense.installments > 1 && (
  <Badge variant="outline" className="text-xs">
  Parcela {expense.current_installment || 1}/{expense.total_installments || expense.installments}
  </Badge>
  )}
              {expense.batch_id && (
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  <FileText className="w-3 h-3 mr-1" />
                  Remessa #{expense.batch_id}
                </Badge>
              )}
              {expense.exceeds_limit && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs" title={expense.limit_exceeded_reason || 'Acima da referência'}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Acima da referência
                </Badge>
              )}
            </div>

            {/* Descrição */}
            {expense.description && (
              <p className="text-sm line-clamp-2">{expense.description}</p>
            )}

            {/* Informações básicas */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {expense.user_name}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(expense.expense_date)}
              </span>
              {(() => {
                // Determinar localização baseado na categoria
                let location = ''
                if (expense.municipality && expense.state) {
                  location = `${expense.municipality}/${expense.state}`
                } else if (expense.municipality) {
                  location = expense.municipality
                } else if (expense.state) {
                  location = expense.state
                } else if (expense.departure_city && expense.departure_state) {
                  // Combustível
                  location = `${expense.departure_city}/${expense.departure_state}`
                } else if (expense.origin) {
                  // Deslocamento - origin já vem no formato "Cidade/Estado"
                  location = expense.origin
                }
                
                return location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                ) : null
              })()}
            </div>

            {/* Detalhes específicos da categoria */}
            <div className="pt-2 border-t border-dashed">
              {renderCategoryDetails()}
            </div>

            {/* Identificação de quem efetuou (controle gerencial) */}
            {expense.made_by_self === false && (
              <div className="pt-2 border-t border-dashed flex flex-wrap items-center gap-2 text-xs">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Efetuada por:</span>
                <span className="font-medium">{expense.made_by_employee_name || 'Não informado'}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {expense.participated ? 'Solicitante participou' : 'Solicitante não participou'}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Valor e ações */}
        <div className="flex items-center gap-4 md:flex-col md:items-end">
          <div className="text-right">
            <p className="text-xl font-bold">{formatCurrency(expense.amount)}</p>
            {expense.receipt_pathname && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Receipt className="h-3 w-3" />
                Comprovante anexado
              </span>
            )}
          </div>

<div className="flex gap-2">
                {onView ? (
                  <Button variant="outline" size="sm" onClick={onView}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/expenses/${expense.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Link>
                  </Button>
                )}
            
            {showActions && expense.status === 'pending' && (
              <>
                <Button 
                  size="sm" 
                  onClick={onApprove}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={onReject}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            
            {showDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={deleting}
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    {deleting ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. A despesa será permanentemente excluída.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
