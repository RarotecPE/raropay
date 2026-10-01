'use client'

// Formulário de Despesa - Compartilhado entre criação e edição
// Build timestamp: 2026-03-27-shared-form
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { MunicipalityCombobox } from '@/components/municipality-combobox'
import { LocationSearch, type GeoPlace } from '@/components/location-search'
import { formatCurrency, formatCurrencyInput, parseCurrency, brazilianStates } from '@/lib/format'

// Mapa carregado apenas no cliente (Leaflet depende de window)
const RouteMap = dynamic(() => import('@/components/route-map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Carregando mapa...
    </div>
  ),
})
import { 
  expenseTypeLabels, 
  categoryLabels, 
  mealTypeLabels,
  locationTypeLabels,
  transportTypeOptions,
  fuelTypeOptions,
  defaultLimits,
  type ExpenseType, 
  type ExpenseCategory,
  type MealType,
  type LocationType,
  type CategoryLimit,
  type Vehicle
} from '@/lib/types'
import {
  Upload,
  X,
  AlertTriangle,
  CreditCard,
  Wallet,
  ReceiptText,
  Hotel,
  UtensilsCrossed,
  Utensils,
  Fuel,
  Car,
  ParkingCircle,
  Paperclip,
  FileText,
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  Calculator,
  Users,
  UserPlus,
  Info,
  MapPin,
  Navigation,
  Camera,
  Bus,
  AlertCircle,
} from 'lucide-react'

const expenseTypeIcons: Record<ExpenseType, typeof CreditCard> = {
  corporate_card: CreditCard,
  advance: Wallet,
  reimbursement: ReceiptText,
}

const categoryIcons: Record<ExpenseCategory, typeof Hotel> = {
  accommodation: Hotel,
  food: UtensilsCrossed,
  fuel: Fuel,
  transport: Car,
  parking: ParkingCircle,
  office_supplies: Paperclip,
  meal_voucher: Utensils,
  transport_voucher: Bus,
  other: FileText,
}

// Capitais brasileiras para determinar limite
const capitalCities = [
  'Rio Branco', 'Maceió', 'Macapá', 'Manaus', 'Salvador', 'Fortaleza', 'Brasília',
  'Vitória', 'Goiânia', 'São Luís', 'Cuiabá', 'Campo Grande', 'Belo Horizonte',
  'Belém', 'João Pessoa', 'Curitiba', 'Recife', 'Teresina', 'Rio de Janeiro',
  'Natal', 'Porto Alegre', 'Porto Velho', 'Boa Vista', 'Florianópolis', 'São Paulo',
  'Aracaju', 'Palmas'
]

interface LinkedPerson {
  id: string
  name: string
  cpf: string
  isEmployee: boolean
}

// Parada intermediária: mantém município/estado (relatórios) e, quando disponível,
// a localização precisa (endereço/estabelecimento) com coordenadas.
interface StopPoint {
  municipality: string
  state: string
  place?: string
  lat?: number | null
  lng?: number | null
}

interface ExtraExpense {
  id: string
  description: string
  value: number
  isMeal: boolean
  mealType?: MealType
  numberOfPeople?: number
}

// Interface para dados iniciais (usado na edição)
export interface ExpenseFormInitialData {
  id?: number
  expense_type?: string
  category?: string
  description?: string
  receipt_url?: string
  receipt_pathname?: string
  state?: string
  municipality?: string
  location_type?: string
  // Hospedagem
  accommodation_name?: string
  has_breakfast?: boolean
  checkin_date?: string
  checkout_date?: string
  single_room_value?: number
  single_room_qty?: number
  double_room_value?: number
  double_room_qty?: number
  triple_room_value?: number
  triple_room_qty?: number
  extra_expenses?: ExtraExpense[]
  linked_persons?: LinkedPerson[]
  // Alimentação
  meal_type?: string
  meal_date?: string
  establishment_name?: string
  establishment_cnpj?: string
  number_of_people?: number
  amount?: number
  // Combustível
  vehicle_id?: number
  vehicle_plate?: string
  fuel_date?: string
  transport_type?: string
  transport_voucher_type?: string
  departure_city?: string
  departure_state?: string
  arrival_city?: string
  arrival_state?: string
  stops?: StopPoint[]
  distance_km?: number
  is_irregular_route?: boolean
  origin_lat?: number | null
  origin_lng?: number | null
  origin_place?: string | null
  destination_lat?: number | null
  destination_lng?: number | null
  destination_place?: string | null
  route_distance_km?: number | null
  route_source?: string | null
  liters?: number
  fuel_type?: string
  gas_station_name?: string
  km_before?: number
  km_after?: number
  odometer_files?: {pathname: string, name: string}[]
  // Estacionamento
  parking_type?: string
  parking_name?: string
  parking_reason?: string
  parking_linked_persons?: {type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[]
  // Deslocamento
  transport_mode?: string
  transport_date?: string
  different_arrival?: boolean
  transport_linked_persons?: {type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[]
  origin?: string
  destination?: string
  // Itens de escritório
  office_store_type?: string
  office_store_name?: string
  office_items?: {name: string, quantity: number, unitPrice: string, totalPrice: string}[]
  office_purchase_reason?: string
  office_requester?: string
  // Outras despesas
  other_store_type?: string
  other_store_name?: string
  other_items?: {name: string, quantity: number, unitPrice: string, totalPrice: string}[]
  other_purchase_reason?: string
  other_requester?: string
  // Parcelas
  installments?: number
  current_installment?: number
  // Identificação (controle gerencial)
  made_by_self?: boolean
  made_by_employee_name?: string
  participated?: boolean
  // Pagamento
  payment_barcode?: string
  payment_pix?: string
}

interface ExpenseFormProps {
  mode: 'create' | 'edit'
  initialData?: ExpenseFormInitialData
  expenseId?: number
}

export default function ExpenseForm({ mode, initialData, expenseId }: ExpenseFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingExpense, setLoadingExpense] = useState(mode === 'edit')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [limits, setLimits] = useState<CategoryLimit[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  
  // Referências dinâmicas baseadas nos valores do banco
  const dynamicLimits = useMemo(() => {
    const getLimit = (cat: string, subCat?: string) => {
      const found = limits.find(l => l.category === cat && (subCat ? l.sub_category === subCat : true))
      return found?.daily_limit || 0
    }
    const getMinKmPerLiter = (cat: string) => {
      const found = limits.find(l => l.category === cat)
      return found?.min_km_per_liter || defaultLimits.fuel_min_km_per_liter
    }
    
    return {
      accommodation_capital: getLimit('accommodation', 'capital') || defaultLimits.accommodation_capital,
      accommodation_interior: getLimit('accommodation', 'interior') || defaultLimits.accommodation_interior,
      food_breakfast: getLimit('food', 'breakfast') || defaultLimits.food_breakfast,
      food_lunch: getLimit('food', 'lunch') || defaultLimits.food_lunch,
      food_dinner: getLimit('food', 'dinner') || defaultLimits.food_dinner,
      fuel_min_km_per_liter: getMinKmPerLiter('fuel'),
    }
  }, [limits])
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])
  const [municipalities, setMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false)

  // Form state - Básico
  const [expenseType, setExpenseType] = useState<ExpenseType | ''>('')
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const [description, setDescription] = useState('')
  const [receiptPathname, setReceiptPathname] = useState('')
  const [receiptFileName, setReceiptFileName] = useState('')

  // Localização - Pré-fixado em Pernambuco
  const [state, setState] = useState('PE')
  const [municipality, setMunicipality] = useState('')
  const [locationType, setLocationType] = useState<LocationType | ''>('')
  // Município pendente para aplicar após carregar a lista
  const [pendingMunicipality, setPendingMunicipality] = useState('')

  // =====================
  // HOSPEDAGEM
  // =====================
  const [accommodationName, setAccommodationName] = useState('')
  const [hasBreakfast, setHasBreakfast] = useState<boolean | null>(null)
  const [checkinDate, setCheckinDate] = useState('')
  const [checkoutDate, setCheckoutDate] = useState('')
  
  // Quartos
  const [singleRoomValue, setSingleRoomValue] = useState('')
  const [singleRoomQty, setSingleRoomQty] = useState('0')
  const [doubleRoomValue, setDoubleRoomValue] = useState('')
  const [doubleRoomQty, setDoubleRoomQty] = useState('0')
  const [tripleRoomValue, setTripleRoomValue] = useState('')
  const [tripleRoomQty, setTripleRoomQty] = useState('0')
  
  // Despesas extras de hospedagem
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([])
  
  // Pessoas vinculadas
  const [linkedPersons, setLinkedPersons] = useState<LinkedPerson[]>([])
  
  // =====================
  // ALIMENTAÇÃO
  // =====================
  const [mealType, setMealType] = useState<MealType | ''>('')
  const [mealDate, setMealDate] = useState(new Date().toISOString().split('T')[0])
  const [breakfastTime, setBreakfastTime] = useState('')
  const [establishmentName, setEstablishmentName] = useState('')
  const [establishmentCnpj, setEstablishmentCnpj] = useState('')
  const [numberOfPeople, setNumberOfPeople] = useState('1')
  const [mealAmount, setMealAmount] = useState('')

  // =====================
  // COMBUSTÍVEL
  // =====================
  const [vehicleId, setVehicleId] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [fuelDate, setFuelDate] = useState('')
  const [tripType, setTripType] = useState<'metropolitan' | 'intermunicipal' | 'interstate' | ''>('')
  const [departureCity, setDepartureCity] = useState('')
  const [departureState, setDepartureState] = useState('PE')
  const [departureMunicipalities, setDepartureMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingDeparture, setLoadingDeparture] = useState(false)
  // Localização precisa (endereço/estabelecimento) da partida
  const [departurePlace, setDeparturePlace] = useState('')
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [stops, setStops] = useState<StopPoint[]>([])
  const [destinationCity, setDestinationCity] = useState('')
  const [destinationState, setDestinationState] = useState('PE')
  const [destinationMunicipalities, setDestinationMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingDestination, setLoadingDestination] = useState(false)
  // Localização precisa (endereço/estabelecimento) do destino
  const [destinationPlace, setDestinationPlace] = useState('')
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [totalKm, setTotalKm] = useState('')
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null)
  // Geometria e origem do cálculo da rota (para o mapa e para indicar precisão)
  const [routeGeometry, setRouteGeometry] = useState<{ lat: number; lng: number }[]>([])
  const [routeSource, setRouteSource] = useState<'osrm' | 'haversine' | null>(null)
  const [isIrregularRoute, setIsIrregularRoute] = useState(false)
  const [liters, setLiters] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [gasStationName, setGasStationName] = useState('')
  const [fuelAmount, setFuelAmount] = useState('')
  const [odometerFiles, setOdometerFiles] = useState<{pathname: string, name: string}[]>([])
  const [stopMunicipalities, setStopMunicipalities] = useState<{[key: number]: {id: number, name: string}[]}>({})
  const [loadingStopMunicipalities, setLoadingStopMunicipalities] = useState<{[key: number]: boolean}>({})
  
  // Estados antigos mantidos para compatibilidade
  const [kmBefore, setKmBefore] = useState('')
  const [kmAfter, setKmAfter] = useState('')

  // =====================
  // ESTACIONAMENTO
  // =====================
  const [parkingState, setParkingState] = useState('PE')
  const [parkingCity, setParkingCity] = useState('')
  const [parkingMunicipalities, setParkingMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingParkingMunicipalities, setLoadingParkingMunicipalities] = useState(false)
  const [parkingDate, setParkingDate] = useState('')
  const [parkingType, setParkingType] = useState('')
  const [parkingName, setParkingName] = useState('')
  const [parkingReason, setParkingReason] = useState('')
  const [parkingAmount, setParkingAmount] = useState('')
  const [parkingLinkedPersons, setParkingLinkedPersons] = useState<{type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[]>([])

  // =====================
  // DESLOCAMENTO
  // =====================
  const [transportType, setTransportType] = useState('') // tipo de trajeto (metropolitano, intermunicipal)
  const [transportMode, setTransportMode] = useState('') // modo de transporte (uber, 99pop, avião, etc)
  const [transportVoucherType, setTransportVoucherType] = useState('') // categoria do vale-transporte (fuel, app, public)
  const [transportDate, setTransportDate] = useState('')
  const [transportDepartureState, setTransportDepartureState] = useState('PE')
  const [transportDepartureCity, setTransportDepartureCity] = useState('')
  const [transportDepartureMunicipalities, setTransportDepartureMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingTransportDeparture, setLoadingTransportDeparture] = useState(false)
  const [hasDifferentArrival, setHasDifferentArrival] = useState(false)
  const [transportArrivalState, setTransportArrivalState] = useState('PE')
  const [transportArrivalCity, setTransportArrivalCity] = useState('')
  const [transportArrivalMunicipalities, setTransportArrivalMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingTransportArrival, setLoadingTransportArrival] = useState(false)
  const [transportLinkedPersons, setTransportLinkedPersons] = useState<{type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[]>([])
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [transportAmount, setTransportAmount] = useState('')
  // Localização precisa + rota real (compartilhado por Deslocamento e Vale-Transporte)
  const [transportOriginCoords, setTransportOriginCoords] = useState<{ lat: number, lng: number } | null>(null)
  const [transportOriginPlace, setTransportOriginPlace] = useState('')
  const [transportDestinationCoords, setTransportDestinationCoords] = useState<{ lat: number, lng: number } | null>(null)
  const [transportDestinationPlace, setTransportDestinationPlace] = useState('')
  const [transportRouteDistance, setTransportRouteDistance] = useState<number | null>(null)
  const [transportRouteSource, setTransportRouteSource] = useState<'osrm' | 'haversine' | null>(null)
  const [transportRouteGeometry, setTransportRouteGeometry] = useState<{ lat: number; lng: number }[]>([])
  const [loadingTransportRoute, setLoadingTransportRoute] = useState(false)

  // =====================
  // ITENS DE ESCRITÓRIO
  // =====================
  const [officeState, setOfficeState] = useState('PE')
  const [officeCity, setOfficeCity] = useState('')
  const [officeMunicipalities, setOfficeMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingOfficeMunicipalities, setLoadingOfficeMunicipalities] = useState(false)
  const [pendingOfficeCity, setPendingOfficeCity] = useState('')
  const [officeDate, setOfficeDate] = useState('')
  const [officeStoreType, setOfficeStoreType] = useState('')
  const [officeStoreName, setOfficeStoreName] = useState('')
  const [officeItems, setOfficeItems] = useState<{name: string, quantity: number, unitPrice: string, totalPrice: string}[]>([])
  const [officePurchaseReason, setOfficePurchaseReason] = useState('')
  const [officeRequester, setOfficeRequester] = useState('')
  const [officeAmount, setOfficeAmount] = useState('')
  
  // =====================
  // OUTRAS DESPESAS
  // =====================
  const [otherState, setOtherState] = useState('PE')
  const [otherCity, setOtherCity] = useState('')
  const [otherMunicipalities, setOtherMunicipalities] = useState<{id: number, name: string}[]>([])
  const [loadingOtherMunicipalities, setLoadingOtherMunicipalities] = useState(false)
  const [pendingOtherCity, setPendingOtherCity] = useState('')
  const [otherDate, setOtherDate] = useState('')
  const [otherStoreType, setOtherStoreType] = useState('')
  const [otherStoreName, setOtherStoreName] = useState('')
  const [otherItems, setOtherItems] = useState<{name: string, quantity: number, unitPrice: string, totalPrice: string}[]>([])
  const [otherPurchaseReason, setOtherPurchaseReason] = useState('')
  const [otherRequester, setOtherRequester] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
  
  // =====================
  // VALE-REFEIÇÃO
  // =====================
  const [mealVoucherEnabled, setMealVoucherEnabled] = useState(false)
  const [transportVoucherEnabled, setTransportVoucherEnabled] = useState(false)
  const [transportVoucherLimit, setTransportVoucherLimit] = useState<number | null>(null)
  const [transportVoucherUsed, setTransportVoucherUsed] = useState(0)
  const [mealVoucherLimit, setMealVoucherLimit] = useState(250)
  const [mealVoucherUsed, setMealVoucherUsed] = useState(0)
  const [mealVoucherDate, setMealVoucherDate] = useState(new Date().toISOString().split('T')[0])
  const [mealVoucherEstablishment, setMealVoucherEstablishment] = useState('')
  const [mealVoucherAmount, setMealVoucherAmount] = useState('')
  const [mealVoucherDescription, setMealVoucherDescription] = useState('')
  
  // =====================
  // PARCELAS E PAGAMENTO
  // =====================
  const [installments, setInstallments] = useState('1')
  const [currentInstallment, setCurrentInstallment] = useState('1')
  const [paymentBarcode, setPaymentBarcode] = useState('')
  const [paymentPix, setPaymentPix] = useState('')

  // Identificação de quem efetuou/participou (apenas para relatório/controle gerencial)
  const [madeBySelf, setMadeBySelf] = useState(true)
  const [madeByEmployeeName, setMadeByEmployeeName] = useState('')
  const [participated, setParticipated] = useState(true)

  // Warnings
  const [limitWarning, setLimitWarning] = useState<string | null>(null)
  const [fuelWarning, setFuelWarning] = useState<string | null>(null)
  const [error, setError] = useState('')

  // =====================
  // CÁLCULOS AUTOMÁTICOS
  // =====================
  
  // Quantidade de diárias
  const numberOfNights = useMemo(() => {
    if (!checkinDate || !checkoutDate) return 0
    const checkin = new Date(checkinDate)
    const checkout = new Date(checkoutDate)
    const diff = checkout.getTime() - checkin.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [checkinDate, checkoutDate])

  // Valor total dos quartos
  const roomsTotal = useMemo(() => {
    const single = parseCurrency(singleRoomValue) * parseInt(singleRoomQty || '0')
    const double = parseCurrency(doubleRoomValue) * parseInt(doubleRoomQty || '0')
    const triple = parseCurrency(tripleRoomValue) * parseInt(tripleRoomQty || '0')
    return (single + double + triple) * numberOfNights
  }, [singleRoomValue, singleRoomQty, doubleRoomValue, doubleRoomQty, tripleRoomValue, tripleRoomQty, numberOfNights])

  // Valor total das despesas extras (todas)
  const extrasTotal = useMemo(() => {
    return extraExpenses.reduce((sum, exp) => sum + exp.value, 0)
  }, [extraExpenses])

  // Valor das despesas extras que NÃO são refeições oficiais (para cálculo da média de hospedagem)
  const extrasNonMealTotal = useMemo(() => {
    return extraExpenses.filter(exp => !exp.isMeal).reduce((sum, exp) => sum + exp.value, 0)
  }, [extraExpenses])

  // Valor das despesas extras que SÃO refeições oficiais (contabilizado separadamente)
  const extrasMealTotal = useMemo(() => {
    return extraExpenses.filter(exp => exp.isMeal).reduce((sum, exp) => sum + exp.value, 0)
  }, [extraExpenses])

  // Valor total da hospedagem (inclui tudo para o valor final da despesa)
  const accommodationTotal = useMemo(() => {
    return roomsTotal + extrasTotal
  }, [roomsTotal, extrasTotal])

  // Valor da hospedagem para cálculo de média (exclui refeições oficiais)
  const accommodationTotalForAverage = useMemo(() => {
    return roomsTotal + extrasNonMealTotal
  }, [roomsTotal, extrasNonMealTotal])

  // Limite de hospedagem baseado na localização
  const accommodationLimit = useMemo(() => {
    if (locationType === 'capital') return dynamicLimits.accommodation_capital
    if (locationType === 'interior') return dynamicLimits.accommodation_interior
    return 0
  }, [locationType, dynamicLimits])

  // KM por litro
  const kmPerLiter = useMemo(() => {
    const before = parseFloat(kmBefore)
    const after = parseFloat(kmAfter)
    const lts = parseFloat(liters)
    if (before && after && lts && lts > 0 && after > before) {
      return (after - before) / lts
    }
    return null
  }, [kmBefore, kmAfter, liters])

  // Valor final com base na categoria
  const finalAmount = useMemo(() => {
    switch (category) {
      case 'accommodation':
        return accommodationTotal
      case 'food':
        return parseCurrency(mealAmount)
      case 'fuel':
        return parseCurrency(fuelAmount)
      case 'parking':
        return parseCurrency(parkingAmount)
      case 'transport':
      case 'transport_voucher':
        return parseCurrency(transportAmount)
  case 'office_supplies':
  return parseCurrency(officeAmount)
  case 'other':
  return parseCurrency(otherAmount)
  case 'meal_voucher':
  return parseCurrency(mealVoucherAmount)
  default:
  return 0
  }
  }, [category, accommodationTotal, mealAmount, fuelAmount, parkingAmount, transportAmount, officeAmount, otherAmount, mealVoucherAmount])

  // Data oficial da despesa (checkout para hospedagem, ou hoje)
  const expenseDate = useMemo(() => {
    if (category === 'accommodation' && checkoutDate) {
      return checkoutDate
    }
    return new Date().toISOString().split('T')[0]
  }, [category, checkoutDate])

  // =====================
  // EFFECTS
  // =====================

  useEffect(() => {
  fetchLimits()
  fetchVehicles()
  fetchEmployees()
  fetchMealVoucherInfo()
  fetchTransportVoucherEligibility()
  
    // Carregar dados iniciais quando em modo de edição
    if (mode === 'edit' && expenseId) {
      loadExpenseData()
    }
  }, [])

  // Recalcular o uso do vale-refeição sempre que a data informada mudar,
  // para que a contabilização considere o mês da data e não o mês atual
  useEffect(() => {
    if (category === 'meal_voucher' && mealVoucherDate) {
      fetchMealVoucherInfo()
    }
  }, [mealVoucherDate, category])

  // Recalcular o uso do vale-transporte conforme o mês da data do trajeto
  useEffect(() => {
    if (category === 'transport_voucher' && transportDate) {
      fetchTransportVoucherEligibility()
    }
  }, [transportDate, category])

  // Carregar dados da despesa para edição
  async function loadExpenseData() {
    if (!expenseId) return
    
    setLoadingExpense(true)
    try {
      const res = await fetch(`/api/expenses/${expenseId}`)
      if (!res.ok) throw new Error('Erro ao carregar despesa')
      
      const data = await res.json()
      const expense = data.expense || data // Compatibilidade com ambos formatos
      
      // Verificar se pode editar (draft, rejected ou correction)
      if (!['draft', 'rejected', 'correction'].includes(expense.status)) {
        toast.error('Esta despesa não pode ser editada')
        router.push(`/expenses/${expenseId}`)
        return
      }
      
      // Dados básicos
      setExpenseType(expense.expense_type || '')
      setCategory(expense.category || '')
      setDescription(expense.description || '')
      // O comprovante pode estar em receipt_url ou receipt_pathname
      const receiptPath = expense.receipt_url || expense.receipt_pathname || ''
      setReceiptPathname(receiptPath)
      setReceiptFileName(receiptPath ? 'Comprovante anexado' : '')
      
      // Hospedagem
      if (expense.category === 'accommodation') {
        setAccommodationName(expense.accommodation_name || '')
        setHasBreakfast(expense.has_breakfast ?? null)
        // Usar checkin_date ou check_in dependendo do formato
        const checkin = expense.checkin_date || expense.check_in
        const checkout = expense.checkout_date || expense.check_out
        setCheckinDate(checkin ? (typeof checkin === 'string' ? checkin.split('T')[0] : checkin) : '')
        setCheckoutDate(checkout ? (typeof checkout === 'string' ? checkout.split('T')[0] : checkout) : '')
        if (expense.single_room_value) setSingleRoomValue(formatCurrencyInput(String(Math.round(expense.single_room_value * 100))))
        if (expense.single_room_qty) setSingleRoomQty(String(expense.single_room_qty))
        if (expense.double_room_value) setDoubleRoomValue(formatCurrencyInput(String(Math.round(expense.double_room_value * 100))))
        if (expense.double_room_qty) setDoubleRoomQty(String(expense.double_room_qty))
        if (expense.triple_room_value) setTripleRoomValue(formatCurrencyInput(String(Math.round(expense.triple_room_value * 100))))
        if (expense.triple_room_qty) setTripleRoomQty(String(expense.triple_room_qty))
        if (expense.extra_expenses) setExtraExpenses(expense.extra_expenses)
        // linked_persons são armazenados em linked_employees e linked_external_parties
        const linkedPersons: LinkedPerson[] = []
        if (expense.linked_employees) {
          expense.linked_employees.forEach((emp: {user_id: number, name: string}) => {
            linkedPersons.push({ type: 'employee', id: crypto.randomUUID(), userId: emp.user_id, name: emp.name })
          })
        }
        if (expense.linked_external_parties) {
          expense.linked_external_parties.forEach((party: {name: string, cpf: string}) => {
            linkedPersons.push({ type: 'third_party', id: crypto.randomUUID(), name: party.name, cpf: party.cpf })
          })
        }
        if (linkedPersons.length > 0) setLinkedPersons(linkedPersons)
        setState(expense.state || 'PE')
        // Usar pendingMunicipality para que seja aplicado após carregar a lista
        if (expense.municipality) setPendingMunicipality(expense.municipality)
        setLocationType(expense.location_type || '')
      }
      
      // Alimentação
      if (expense.category === 'food') {
        setMealType(expense.meal_type || '')
        setMealDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setEstablishmentName(expense.establishment_name || '')
        setEstablishmentCnpj(expense.establishment_cnpj || '')
        setNumberOfPeople(expense.number_of_people ? String(expense.number_of_people) : '1')
        setMealAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
        setState(expense.state || 'PE')
        if (expense.municipality) setPendingMunicipality(expense.municipality)
        // Carregar funcionários e terceiros vinculados
        const foodLinkedPersons: LinkedPerson[] = []
        if (expense.linked_employees) {
          expense.linked_employees.forEach((emp: {user_id: number, name: string}) => {
            foodLinkedPersons.push({ type: 'employee', id: crypto.randomUUID(), userId: emp.user_id, name: emp.name })
          })
        }
        if (expense.linked_external_parties) {
          expense.linked_external_parties.forEach((party: {name: string, cpf: string}) => {
            foodLinkedPersons.push({ type: 'third_party', id: crypto.randomUUID(), name: party.name, cpf: party.cpf })
          })
        }
        if (foodLinkedPersons.length > 0) setLinkedPersons(foodLinkedPersons)
      }
      
      // Combustível
      if (expense.category === 'fuel') {
        setVehicleId(expense.vehicle_id ? String(expense.vehicle_id) : '')
        setVehiclePlate(expense.vehicle_plate || '')
        setFuelDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setTripType(expense.transport_type || '')
        setDepartureCity(expense.departure_city || '')
        setDepartureState(expense.departure_state || 'PE')
        setDestinationCity(expense.arrival_city || '')
        setDestinationState(expense.arrival_state || 'PE')
        // Localização precisa (coordenadas + rótulo), quando existir
        setDeparturePlace(expense.origin_place || '')
        if (expense.origin_lat != null && expense.origin_lng != null) {
          setDepartureCoords({ lat: Number(expense.origin_lat), lng: Number(expense.origin_lng) })
        }
        setDestinationPlace(expense.destination_place || '')
        if (expense.destination_lat != null && expense.destination_lng != null) {
          setDestinationCoords({ lat: Number(expense.destination_lat), lng: Number(expense.destination_lng) })
        }
        setTotalKm(expense.total_km ? String(expense.total_km) : '')
        setIsIrregularRoute(expense.is_irregular_route || false)
        setLiters(expense.liters ? String(expense.liters) : '')
        setFuelType(expense.fuel_type || '')
        setGasStationName(expense.gas_station_name || '')
        setFuelAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
        if (expense.km_before) setKmBefore(String(expense.km_before))
        if (expense.km_after) setKmAfter(String(expense.km_after))
        if (expense.stops) setStops(expense.stops)
        // Carregar fotos do hodômetro
        if (expense.odometer_photos && Array.isArray(expense.odometer_photos)) {
          setOdometerFiles(expense.odometer_photos)
        }
      }
      
      // Estacionamento
      if (expense.category === 'parking') {
        setParkingState(expense.state || 'PE')
        setParkingCity(expense.municipality || '')
        setParkingDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setParkingType(expense.parking_type || '')
        setParkingName(expense.parking_name || '')
        setParkingReason(expense.parking_reason || '')
        setParkingAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
        // linked_persons são armazenados em linked_employees e linked_external_parties
        const parkingLinked: {type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[] = []
        if (expense.linked_employees) {
          expense.linked_employees.forEach((emp: {user_id: number, name: string}) => {
            parkingLinked.push({ type: 'employee', user_id: emp.user_id, name: emp.name })
          })
        }
        if (expense.linked_external_parties) {
          expense.linked_external_parties.forEach((party: {name: string, cpf: string}) => {
            parkingLinked.push({ type: 'third_party', name: party.name, cpf: party.cpf })
          })
        }
        if (parkingLinked.length > 0) setParkingLinkedPersons(parkingLinked)
      }
      
      // Deslocamento / Vale-Transporte
      if (expense.category === 'transport' || expense.category === 'transport_voucher') {
    setTransportType(expense.transport_type || '')
    setTransportMode(expense.transport_mode || '')
    setTransportVoucherType(expense.transport_voucher_type || '')
        setTransportDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setTransportDepartureState(expense.departure_state || 'PE')
        setTransportDepartureCity(expense.departure_city || '')
        setHasDifferentArrival(expense.different_arrival || false)
        setTransportArrivalState(expense.arrival_state || 'PE')
        setTransportArrivalCity(expense.arrival_city || '')
        setOrigin(expense.origin || '')
        setDestination(expense.destination || '')
        setDistanceKm(expense.distance_km ? String(expense.distance_km) : '')
        setTransportAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
        // Localização precisa e rota salvas
        if (expense.origin_place) setTransportOriginPlace(expense.origin_place)
        if (expense.origin_lat != null && expense.origin_lng != null) {
          setTransportOriginCoords({ lat: Number(expense.origin_lat), lng: Number(expense.origin_lng) })
        }
        if (expense.destination_place) setTransportDestinationPlace(expense.destination_place)
        if (expense.destination_lat != null && expense.destination_lng != null) {
          setTransportDestinationCoords({ lat: Number(expense.destination_lat), lng: Number(expense.destination_lng) })
        }
        // linked_persons são armazenados em linked_employees e linked_external_parties
        const transportLinked: {type: 'employee' | 'third_party', user_id?: number, name?: string, cpf?: string}[] = []
        if (expense.linked_employees) {
          expense.linked_employees.forEach((emp: {user_id: number, name: string}) => {
            transportLinked.push({ type: 'employee', user_id: emp.user_id, name: emp.name })
          })
        }
        if (expense.linked_external_parties) {
          expense.linked_external_parties.forEach((party: {name: string, cpf: string}) => {
            transportLinked.push({ type: 'third_party', name: party.name, cpf: party.cpf })
          })
        }
        if (transportLinked.length > 0) setTransportLinkedPersons(transportLinked)
      }
      
      // Itens de escritório
      if (expense.category === 'office_supplies') {
        setOfficeState(expense.state || 'PE')
        if (expense.municipality) setPendingOfficeCity(expense.municipality)
        setOfficeDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setOfficeStoreType(expense.store_type || '')
        setOfficeStoreName(expense.store_name || '')
        if (expense.items) setOfficeItems(expense.items)
        setOfficePurchaseReason(expense.purchase_reason || '')
        setOfficeRequester(expense.requester || '')
        setOfficeAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
      }
      
      // Outras despesas
      if (expense.category === 'other') {
        setOtherState(expense.state || 'PE')
        if (expense.municipality) setPendingOtherCity(expense.municipality)
        setOtherDate(expense.expense_date ? expense.expense_date.split('T')[0] : '')
        setOtherStoreType(expense.store_type || '')
        setOtherStoreName(expense.store_name || '')
        if (expense.items) setOtherItems(expense.items)
        setOtherPurchaseReason(expense.purchase_reason || '')
        setOtherRequester(expense.requester || '')
        setOtherAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
      }

      // Vale-Refeição
      if (expense.category === 'meal_voucher') {
        setMealVoucherDate(expense.expense_date ? expense.expense_date.split('T')[0] : new Date().toISOString().split('T')[0])
        setMealVoucherAmount(formatCurrencyInput(String(Math.round((expense.amount || 0) * 100))))
        const establishment = expense.establishment_name || ''
        setMealVoucherEstablishment(establishment)
        // Na gravação o estabelecimento é prefixado na descrição ("Estabelecimento - Detalhes").
        // Aqui revertemos para recuperar apenas os detalhes digitados.
        let pureDescription = expense.description || ''
        if (establishment && pureDescription.startsWith(establishment)) {
          pureDescription = pureDescription.slice(establishment.length)
          if (pureDescription.startsWith(' - ')) {
            pureDescription = pureDescription.slice(3)
          }
        }
        setMealVoucherDescription(pureDescription)
      }
      
      // Parcelas
      if (expense.installments) setInstallments(String(expense.installments))
      if (expense.current_installment) setCurrentInstallment(String(expense.current_installment))

      // Identificação (controle gerencial)
      const loadedMadeBySelf = expense.made_by_self !== false
      setMadeBySelf(loadedMadeBySelf)
      setMadeByEmployeeName(expense.made_by_employee_name || '')
      setParticipated(expense.participated !== false)
      
      // Pagamento
      setPaymentBarcode(expense.payment_barcode || '')
      setPaymentPix(expense.payment_pix || '')
      
    } catch (err) {
      console.error('Erro ao carregar despesa:', err)
      toast.error('Erro ao carregar dados da despesa')
      router.push('/expenses/corrections')
    } finally {
      setLoadingExpense(false)
    }
  }

  useEffect(() => {
    if (state) {
      fetchMunicipalities(state)
    } else {
      setMunicipalities([])
      setMunicipality('')
    }
  }, [state])
  
  // Aplicar município pendente quando a lista de municípios for carregada
  useEffect(() => {
    if (pendingMunicipality && municipalities.length > 0 && !loadingMunicipalities) {
      // Verificar se o município pendente existe na lista
      const found = municipalities.find(m => m.name === pendingMunicipality)
      if (found) {
        setMunicipality(pendingMunicipality)
      }
      setPendingMunicipality('')
    }
  }, [municipalities, pendingMunicipality, loadingMunicipalities])

  // Auto-detectar capital/interior
  useEffect(() => {
    if (municipality) {
      const isCapital = capitalCities.includes(municipality)
      setLocationType(isCapital ? 'capital' : 'interior')
    }
  }, [municipality])

  // Verificar limites
  useEffect(() => {
    checkLimits()
  }, [finalAmount, category, locationType, mealType, dynamicLimits, linkedPersons, numberOfNights, accommodationTotalForAverage])

  // Verificar efici��ncia de combustível
  useEffect(() => {
    if (kmPerLiter !== null && kmPerLiter < dynamicLimits.fuel_min_km_per_liter) {
      setFuelWarning(`Consumo de ${kmPerLiter.toFixed(2)} KM/L está abaixo do mínimo de ${dynamicLimits.fuel_min_km_per_liter} KM/L. Justifique na descrição.`)
    } else {
      setFuelWarning(null)
    }
  }, [kmPerLiter, dynamicLimits.fuel_min_km_per_liter])

  // Carregar municípios de partida
  useEffect(() => {
    if (departureState && category === 'fuel') {
      setLoadingDeparture(true)
      fetch(`/api/ibge/municipalities?state=${departureState}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setDepartureMunicipalities(data)
        })
        .finally(() => setLoadingDeparture(false))
    }
  }, [departureState, category])

  // Carregar municípios de destino
  useEffect(() => {
    if (destinationState && category === 'fuel') {
      setLoadingDestination(true)
      fetch(`/api/ibge/municipalities?state=${destinationState}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setDestinationMunicipalities(data)
        })
        .finally(() => setLoadingDestination(false))
    }
  }, [destinationState, category])

  // Chave serializada para detectar mudanças nas paradas (para municípios)
  const stopsStateKey = useMemo(() => stops.map(s => s.state).join(','), [stops])

  // Carregar municípios das paradas
  useEffect(() => {
    stops.forEach((stop, index) => {
      // Refaz a busca quando não há lista ou quando ela está vazia (ex: após trocar o estado).
      // Obs: um array vazio [] é "truthy" em JS, por isso checamos o length explicitamente.
      const current = stopMunicipalities[index]
      if (stop.state && (!current || current.length === 0)) {
        setLoadingStopMunicipalities(prev => ({ ...prev, [index]: true }))
        fetch(`/api/ibge/municipalities?state=${stop.state}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setStopMunicipalities(prev => ({ ...prev, [index]: data }))
            }
          })
          .finally(() => setLoadingStopMunicipalities(prev => ({ ...prev, [index]: false })))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsStateKey])

  // Chave serializada para detectar mudanças nas paradas
  const stopsSerializedKey = useMemo(() => JSON.stringify(stops), [stops])

  // Chave que muda quando as coordenadas precisas mudam (para recalcular a rota)
  const coordsKey = useMemo(
    () => JSON.stringify({ d: departureCoords, a: destinationCoords }),
    [departureCoords, destinationCoords]
  )

  // Calcular distância e rota real quando mudar o percurso
  useEffect(() => {
    async function calculateEstimatedDistance() {
      // Precisa de origem e destino (por endereço preciso OU por município)
      const hasOrigin = !!departureCoords || !!departureCity
      const hasDestination = !!destinationCoords || !!destinationCity
      if (!hasOrigin || !hasDestination) {
        setEstimatedDistance(null)
        setRouteGeometry([])
        setRouteSource(null)
        return
      }

      // Considera paradas com coordenadas OU com município preenchido
      const validStops = stops.filter(
        s => (typeof s.lat === 'number' && typeof s.lng === 'number') || (s.municipality && s.municipality.trim() !== '')
      )
      const route = [
        { municipality: departureCity, state: departureState, lat: departureCoords?.lat ?? null, lng: departureCoords?.lng ?? null },
        ...validStops.map(s => ({ municipality: s.municipality, state: s.state, lat: s.lat ?? null, lng: s.lng ?? null })),
        { municipality: destinationCity, state: destinationState, lat: destinationCoords?.lat ?? null, lng: destinationCoords?.lng ?? null },
      ]

      try {
        const response = await fetch('/api/distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ route })
        })
        const data = await response.json()
        if (data.estimated_distance !== undefined && data.estimated_distance !== null) {
          setEstimatedDistance(data.estimated_distance)
          setRouteGeometry(Array.isArray(data.geometry) ? data.geometry : [])
          setRouteSource(data.route_source ?? null)
        } else {
          setEstimatedDistance(null)
          setRouteGeometry([])
          setRouteSource(null)
        }
      } catch (error) {
        console.error('[v0] Erro ao calcular distância:', error)
      }
    }

    const timeoutId = setTimeout(calculateEstimatedDistance, 500)
    return () => clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departureCity, departureState, destinationCity, destinationState, stopsSerializedKey, coordsKey])

  // Chave que muda quando as coordenadas do trajeto (Deslocamento/Vale-Transporte) mudam
  const transportCoordsKey = useMemo(
    () => JSON.stringify({ o: transportOriginCoords, d: transportDestinationCoords }),
    [transportOriginCoords, transportDestinationCoords]
  )

  // Calcular distância e rota real para Deslocamento e Vale-Transporte
  useEffect(() => {
    if (category !== 'transport' && category !== 'transport_voucher') return

    async function calculateTransportRoute() {
      if (!transportOriginCoords || !transportDestinationCoords) {
        setTransportRouteDistance(null)
        setTransportRouteGeometry([])
        setTransportRouteSource(null)
        return
      }

      const route = [
        {
          municipality: transportDepartureCity,
          state: transportDepartureState,
          lat: transportOriginCoords.lat,
          lng: transportOriginCoords.lng,
        },
        {
          municipality: transportArrivalCity,
          state: transportArrivalState,
          lat: transportDestinationCoords.lat,
          lng: transportDestinationCoords.lng,
        },
      ]

      try {
        setLoadingTransportRoute(true)
        const response = await fetch('/api/distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ route }),
        })
        const data = await response.json()
        if (data.estimated_distance !== undefined && data.estimated_distance !== null) {
          setTransportRouteDistance(data.estimated_distance)
          setTransportRouteGeometry(Array.isArray(data.geometry) ? data.geometry : [])
          setTransportRouteSource(data.route_source ?? null)
        } else {
          setTransportRouteDistance(null)
          setTransportRouteGeometry([])
          setTransportRouteSource(null)
        }
      } catch (error) {
        console.error('[v0] Erro ao calcular rota do transporte:', error)
      } finally {
        setLoadingTransportRoute(false)
      }
    }

    const timeoutId = setTimeout(calculateTransportRoute, 500)
    return () => clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportCoordsKey, category])

  // Carregar municípios de partida para deslocamento
  useEffect(() => {
    if (transportDepartureState && category === 'transport') {
      setLoadingTransportDeparture(true)
      fetch(`/api/ibge/municipalities?state=${transportDepartureState}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTransportDepartureMunicipalities(data)
        })
        .finally(() => setLoadingTransportDeparture(false))
    }
  }, [transportDepartureState, category])

  // Carregar municípios de chegada para deslocamento
  useEffect(() => {
    if (transportArrivalState && category === 'transport' && hasDifferentArrival) {
      setLoadingTransportArrival(true)
      fetch(`/api/ibge/municipalities?state=${transportArrivalState}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTransportArrivalMunicipalities(data)
        })
        .finally(() => setLoadingTransportArrival(false))
    }
  }, [transportArrivalState, category, hasDifferentArrival])

  // Carregar municípios para estacionamento
  useEffect(() => {
    if (parkingState && category === 'parking') {
      setLoadingParkingMunicipalities(true)
      fetch(`/api/ibge/municipalities?state=${parkingState}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setParkingMunicipalities(data)
        })
        .finally(() => setLoadingParkingMunicipalities(false))
    }
  }, [parkingState, category])

// Carregar municípios para itens de escritório
  useEffect(() => {
  if (officeState && category === 'office_supplies') {
  setLoadingOfficeMunicipalities(true)
  fetch(`/api/ibge/municipalities?state=${officeState}`)
  .then(res => res.json())
  .then(data => {
  if (Array.isArray(data)) setOfficeMunicipalities(data)
  })
  .finally(() => setLoadingOfficeMunicipalities(false))
  }
  }, [officeState, category])
  
  // Aplicar município pendente para itens de escritório
  useEffect(() => {
    if (pendingOfficeCity && officeMunicipalities.length > 0 && !loadingOfficeMunicipalities) {
      const found = officeMunicipalities.find(m => m.name === pendingOfficeCity)
      if (found) setOfficeCity(pendingOfficeCity)
      setPendingOfficeCity('')
    }
  }, [officeMunicipalities, pendingOfficeCity, loadingOfficeMunicipalities])

// Carregar municípios para outras despesas
  useEffect(() => {
  if (otherState && category === 'other') {
  setLoadingOtherMunicipalities(true)
  fetch(`/api/ibge/municipalities?state=${otherState}`)
  .then(res => res.json())
  .then(data => {
  if (Array.isArray(data)) setOtherMunicipalities(data)
  })
  .finally(() => setLoadingOtherMunicipalities(false))
  }
  }, [otherState, category])
  
  // Aplicar município pendente para outras despesas
  useEffect(() => {
    if (pendingOtherCity && otherMunicipalities.length > 0 && !loadingOtherMunicipalities) {
      const found = otherMunicipalities.find(m => m.name === pendingOtherCity)
      if (found) setOtherCity(pendingOtherCity)
      setPendingOtherCity('')
    }
  }, [otherMunicipalities, pendingOtherCity, loadingOtherMunicipalities])

  // =====================
  // FUNÇÕES
  // =====================

  async function fetchLimits() {
    try {
      const response = await fetch('/api/expenses/limits')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) setLimits(data)
      }
    } catch (error) {
      console.error('Erro ao buscar limites:', error)
    }
  }

  async function fetchVehicles() {
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setVehicles(data)
          // Pré-selecionar veículo do funcionário logado (se houver)
          if (user?.id) {
            const userVehicle = data.find((v: Vehicle) => v.driver_id === user.id)
            if (userVehicle && !vehicleId) {
              setVehicleId(userVehicle.id.toString())
              setVehiclePlate(userVehicle.plate)
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar veículos:', error)
    }
  }

  async function fetchEmployees() {
  try {
  const response = await fetch('/api/users')
  if (response.ok) {
  const data = await response.json()
  if (Array.isArray(data)) setEmployees(data.map((u: {id: number, name: string}) => ({ id: u.id, name: u.name })))
  }
  } catch (error) {
  console.error('Erro ao buscar funcionários:', error)
  }
  }
  
  async function fetchMealVoucherInfo() {
    try {
      // Contabiliza o uso pelo mês da data informada na despesa, não pelo mês atual
      const month = mealVoucherDate ? mealVoucherDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
      // Ao editar, exclui a própria despesa do total para não contá-la em dobro no limite
      const excludeParam = mode === 'edit' && expenseId ? `&excludeId=${expenseId}` : ''
      const response = await fetch(`/api/meal-voucher/usage?month=${month}${excludeParam}`)
      if (response.ok) {
        const data = await response.json()
        setMealVoucherEnabled(data.enabled || false)
        setMealVoucherLimit(data.limit || 250)
        setMealVoucherUsed(data.used || 0)
      }
    } catch (error) {
      console.error('Erro ao buscar info do vale-refeição:', error)
    }
  }

  async function fetchTransportVoucherEligibility() {
    try {
      // Contabiliza o uso pelo mês da data do trajeto (não pelo mês atual)
      const month = transportDate ? transportDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
      // Ao editar, exclui a própria despesa do total para não contá-la em dobro no limite
      const excludeParam = mode === 'edit' && expenseId ? `&excludeId=${expenseId}` : ''
      const response = await fetch(`/api/transport-voucher/eligibility?month=${month}${excludeParam}`)
      if (response.ok) {
        const data = await response.json()
        setTransportVoucherEnabled(data.enabled || false)
        setTransportVoucherLimit(data.limit ?? null)
        setTransportVoucherUsed(data.used || 0)
      }
    } catch (error) {
      console.error('Erro ao verificar elegibilidade do vale-transporte:', error)
    }
  }
  
  async function fetchMunicipalities(stateCode: string) {
    console.log('[v0] Buscando municípios para estado:', stateCode)
    setLoadingMunicipalities(true)
    try {
      const response = await fetch(`/api/ibge/municipalities?state=${stateCode}`)
      console.log('[v0] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('[v0] Municípios carregados:', data?.length || 0)
        if (Array.isArray(data)) {
          setMunicipalities(data)
        } else {
          console.error('[v0] Resposta não é array:', data)
          setMunicipalities([])
        }
      } else {
        console.error('[v0] Erro na resposta:', response.status)
        setMunicipalities([])
      }
    } catch (error) {
      console.error('[v0] Erro ao buscar municípios:', error)
      setMunicipalities([])
    } finally {
      setLoadingMunicipalities(false)
    }
  }

  function checkLimits() {
    if (!finalAmount || !category) {
      setLimitWarning(null)
      return
    }

    let limit = 0
    let limitName = ''

    if (category === 'accommodation') {
      // Calcular total de pessoas baseado nos quartos:
      // - Quarto individual = 1 pessoa
      // - Quarto duplo = 2 pessoas
      // - Quarto triplo = 3 pessoas
      const singleQty = parseInt(singleRoomQty || '0')
      const doubleQty = parseInt(doubleRoomQty || '0')
      const tripleQty = parseInt(tripleRoomQty || '0')
      
      const personsFromRooms = (singleQty * 1) + (doubleQty * 2) + (tripleQty * 3)
      
      // Se não houver quartos, usar pessoas vinculadas + 1 (próprio usuário)
      const totalPersons = personsFromRooms > 0 ? personsFromRooms : (linkedPersons.length + 1)
      
      // Verificar por diária por pessoa: usando valor que EXCLUI refeições oficiais
      const dailyValuePerPerson = numberOfNights > 0 && totalPersons > 0 
        ? accommodationTotalForAverage / numberOfNights / totalPersons 
        : accommodationTotalForAverage
      
      if (locationType === 'capital') {
        limit = dynamicLimits.accommodation_capital
        limitName = 'Hospedagem em Capital (por diária/pessoa)'
      } else if (locationType === 'interior') {
        limit = dynamicLimits.accommodation_interior
        limitName = 'Hospedagem em Interior (por diária/pessoa)'
      }
      
      if (limit > 0 && dailyValuePerPerson > limit) {
        setLimitWarning(`Média por diária/pessoa (${formatCurrency(dailyValuePerPerson)}) excede o limite de ${formatCurrency(limit)} para ${limitName}. Esta despesa será enviada para análise especial.`)
        return
      } else if (limit > 0 && dailyValuePerPerson > limit * 0.8) {
        setLimitWarning(`Atenção: Média por diária/pessoa (${formatCurrency(dailyValuePerPerson)}) próximo do limite de ${formatCurrency(limit)} para ${limitName}.`)
        return
      } else {
        // Hospedagem dentro do limite - limpar aviso e sair
        setLimitWarning(null)
        return
      }
    } else if (category === 'food') {
      if (mealType === 'breakfast') {
        limit = dynamicLimits.food_breakfast
        limitName = 'Café da Manhã'
      } else if (mealType === 'lunch') {
        limit = dynamicLimits.food_lunch
        limitName = 'Almoço'
      } else if (mealType === 'dinner') {
        limit = dynamicLimits.food_dinner
        limitName = 'Jantar'
      }
      
      // Para alimentação, calcular valor por pessoa (pessoas vinculadas + o autor, apenas se participou)
      // O autor conta quando a despesa foi efetuada por ele (madeBySelf) ou quando marcou que participou.
      const authorCounts = madeBySelf || participated
      const totalPeople = Math.max(1, linkedPersons.length + (authorCounts ? 1 : 0))
      const valuePerPerson = finalAmount / totalPeople
      
      if (limit > 0 && valuePerPerson > limit) {
        setLimitWarning(`Média por pessoa (${formatCurrency(valuePerPerson)}) excede o limite de ${formatCurrency(limit)} para ${limitName}. Esta despesa será enviada para análise especial.`)
      } else if (limit > 0 && valuePerPerson > limit * 0.8) {
        setLimitWarning(`Atenção: Média por pessoa (${formatCurrency(valuePerPerson)}) próximo do limite de ${formatCurrency(limit)} para ${limitName}.`)
      } else {
        setLimitWarning(null)
      }
      return
    } else {
      const categoryLimit = limits.find(l => l.category === category)
      if (categoryLimit) {
        limit = categoryLimit.daily_limit
        limitName = categoryLimit.category_name
      }
    }

    if (limit > 0 && finalAmount > limit) {
      setLimitWarning(`Valor excede o limite de ${formatCurrency(limit)} para ${limitName}. Esta despesa será enviada para análise especial.`)
    } else if (limit > 0 && finalAmount > limit * 0.8) {
      setLimitWarning(`Atenção: Valor próximo do limite de ${formatCurrency(limit)} para ${limitName}.`)
    } else {
      setLimitWarning(null)
    }
  }

  // Funções para pessoas vinculadas no deslocamento
  function addTransportLinkedPerson(type: 'employee' | 'third_party') {
    setTransportLinkedPersons([...transportLinkedPersons, { type }])
  }

  function removeTransportLinkedPerson(index: number) {
    setTransportLinkedPersons(transportLinkedPersons.filter((_, i) => i !== index))
  }

  function updateTransportLinkedPerson(index: number, field: string, value: string | number) {
    const newPersons = [...transportLinkedPersons]
    newPersons[index] = { ...newPersons[index], [field]: value }
    setTransportLinkedPersons(newPersons)
  }

  // Funções para pessoas vinculadas no estacionamento
  function addParkingLinkedPerson(type: 'employee' | 'third_party') {
    setParkingLinkedPersons([...parkingLinkedPersons, { type }])
  }

  function removeParkingLinkedPerson(index: number) {
    setParkingLinkedPersons(parkingLinkedPersons.filter((_, i) => i !== index))
  }

  function updateParkingLinkedPerson(index: number, field: string, value: string | number) {
    const newPersons = [...parkingLinkedPersons]
    newPersons[index] = { ...newPersons[index], [field]: value }
    setParkingLinkedPersons(newPersons)
  }

  // Funções para itens de escritório
  function addOfficeItem() {
    setOfficeItems([...officeItems, { name: '', quantity: 1, unitPrice: '', totalPrice: '' }])
  }

  function removeOfficeItem(index: number) {
    setOfficeItems(officeItems.filter((_, i) => i !== index))
  }

  function updateOfficeItem(index: number, field: string, value: string | number) {
    const newItems = [...officeItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Calcular total automaticamente
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity
      const unitPrice = field === 'unitPrice' ? parseCurrency(String(value)) : parseCurrency(newItems[index].unitPrice)
      newItems[index].totalPrice = formatCurrency(quantity * unitPrice)
    }
    
    setOfficeItems(newItems)
    
    // Atualizar valor total
    const total = newItems.reduce((sum, item) => sum + parseCurrency(item.totalPrice), 0)
    setOfficeAmount(formatCurrency(total))
  }

  // Funções para itens de outras despesas
  function addOtherItem() {
    setOtherItems([...otherItems, { name: '', quantity: 1, unitPrice: '', totalPrice: '' }])
  }

  function removeOtherItem(index: number) {
    setOtherItems(otherItems.filter((_, i) => i !== index))
  }

  function updateOtherItem(index: number, field: string, value: string | number) {
    const newItems = [...otherItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Calcular total automaticamente
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity
      const unitPrice = field === 'unitPrice' ? parseCurrency(String(value)) : parseCurrency(newItems[index].unitPrice)
      newItems[index].totalPrice = formatCurrency(quantity * unitPrice)
    }
    
    setOtherItems(newItems)
    
    // Atualizar valor total
    const total = newItems.reduce((sum, item) => sum + parseCurrency(item.totalPrice), 0)
    setOtherAmount(formatCurrency(total))
  }

  // Funções para gerenciar paradas
  function addStop() {
    setStops([...stops, { municipality: '', state: 'PE' }])
  }

  function removeStop(index: number) {
    setStops(stops.filter((_, i) => i !== index))
  }

  function updateStop(index: number, field: 'municipality' | 'state' | 'place', value: string) {
    // Atualização funcional para suportar múltiplas chamadas no mesmo handler
    // (ex: trocar 'state' e limpar 'municipality' de uma vez) sem sobrescrever.
    setStops(prev => {
      const newStops = [...prev]
      // Ao ajustar município/estado/local manualmente, remove as coordenadas precisas anteriores
      newStops[index] = { ...newStops[index], [field]: value, lat: null, lng: null }
      if (field !== 'place') {
        newStops[index].place = ''
      }
      return newStops
    })
  }

  // Seleção de local preciso (endereço/estabelecimento) para uma parada
  function selectStopPlace(index: number, place: GeoPlace) {
    setStops(prev => {
      const newStops = [...prev]
      newStops[index] = {
        ...newStops[index],
        municipality: place.city || newStops[index].municipality,
        state: place.state || newStops[index].state,
        place: place.label,
        lat: place.lat,
        lng: place.lng,
      }
      return newStops
    })
  }

  // Seleção de local preciso da partida (auto-preenche cidade/estado para relatórios)
  function selectDeparturePlace(place: GeoPlace) {
    setDeparturePlace(place.label)
    setDepartureCoords({ lat: place.lat, lng: place.lng })
    if (place.state) setDepartureState(place.state)
    if (place.city) setDepartureCity(place.city)
  }

  function clearDeparturePlace() {
    setDeparturePlace('')
    setDepartureCoords(null)
  }

  // Seleção de local preciso do destino
  function selectDestinationPlace(place: GeoPlace) {
    setDestinationPlace(place.label)
    setDestinationCoords({ lat: place.lat, lng: place.lng })
    if (place.state) setDestinationState(place.state)
    if (place.city) setDestinationCity(place.city)
  }

  function clearDestinationPlace() {
    setDestinationPlace('')
    setDestinationCoords(null)
  }

  // ---- Localização precisa para Deslocamento / Vale-Transporte ----
  function selectTransportOriginPlace(place: GeoPlace) {
    setTransportOriginPlace(place.label)
    setTransportOriginCoords({ lat: place.lat, lng: place.lng })
    if (place.state) setTransportDepartureState(place.state)
    if (place.city) setTransportDepartureCity(place.city)
  }

  function clearTransportOriginPlace() {
    setTransportOriginPlace('')
    setTransportOriginCoords(null)
  }

  function selectTransportDestinationPlace(place: GeoPlace) {
    setTransportDestinationPlace(place.label)
    setTransportDestinationCoords({ lat: place.lat, lng: place.lng })
    setHasDifferentArrival(true)
    if (place.state) setTransportArrivalState(place.state)
    if (place.city) setTransportArrivalCity(place.city)
  }

  function clearTransportDestinationPlace() {
    setTransportDestinationPlace('')
    setTransportDestinationCoords(null)
  }

  // Upload do hodômetro (até 4 arquivos)
  async function handleOdometerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
if (odometerFiles.length >= 4) {
  alert('Máximo de 4 arquivos do hodômetro permitidos')
  return
  }
    
    // Upload para Blob storage
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
  const data = await response.json()
  if (data.pathname) {
  setOdometerFiles(prev => [...prev, { pathname: data.pathname, name: file.name }])
  }
    } catch (error) {
      console.error('Erro ao fazer upload do hodômetro:', error)
    }
  }

  // Remover foto do hodômetro
  function removeOdometerFile(index: number) {
    setOdometerFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Cálculos de combustível
  const pricePerLiter = useMemo(() => {
    const amount = parseCurrency(fuelAmount)
    const litersNum = parseFloat(liters) || 0
    if (litersNum > 0 && amount > 0) {
      return amount / litersNum
    }
    return null
  }, [fuelAmount, liters])

  const fuelKmPerLiter = useMemo(() => {
    const totalKmNum = parseFloat(totalKm) || 0
    const litersNum = parseFloat(liters) || 0
    if (litersNum > 0 && totalKmNum > 0) {
      return totalKmNum / litersNum
    }
    return null
  }, [totalKm, liters])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao fazer upload')

  setReceiptPathname(data.pathname) // Salvar pathname para usar com /api/file
  setReceiptFileName(file.name)
      toast.success('Comprovante anexado!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer upload')
    } finally {
      setUploadingFile(false)
    }
  }

  function handleVehicleSelect(id: string) {
    setVehicleId(id)
    const vehicle = vehicles.find(v => v.id === parseInt(id))
    if (vehicle) {
      setVehiclePlate(vehicle.plate)
      // Só preenche automaticamente se não for flex (flex precisa que usuário escolha)
      if (vehicle.fuel_type && vehicle.fuel_type !== 'flex') {
        setFuelType(vehicle.fuel_type)
      } else {
        // Para veículos flex, limpa o campo para forçar seleção
        setFuelType('')
      }
    }
  }

  function addExtraExpense() {
    setExtraExpenses([...extraExpenses, {
      id: crypto.randomUUID(),
      description: '',
      value: 0,
      isMeal: false,
    }])
  }

  function updateExtraExpense(id: string, field: keyof ExtraExpense, value: any) {
    setExtraExpenses(extraExpenses.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ))
  }

  function removeExtraExpense(id: string) {
    setExtraExpenses(extraExpenses.filter(exp => exp.id !== id))
  }

  function addLinkedPerson(isEmployee: boolean) {
    setLinkedPersons([...linkedPersons, {
      id: crypto.randomUUID(),
      name: '',
      cpf: '',
      isEmployee,
    }])
  }

  function updateLinkedPerson(id: string, field: keyof LinkedPerson, value: any) {
    setLinkedPersons(linkedPersons.map(person => 
      person.id === id ? { ...person, [field]: value } : person
    ))
  }

  function removeLinkedPerson(id: string) {
    setLinkedPersons(linkedPersons.filter(person => person.id !== id))
  }

  function calculateTotal() {
  // Para hospedagem, força recalcular baseado nos valores inseridos
  if (category === 'accommodation') {
  return accommodationTotal
  }
  // Para estacionamento
  if (category === 'parking') {
  return parkingAmount ? parseCurrency(parkingAmount) : 0
  }
  return finalAmount
  }

  async function handleSubmit(asDraft: boolean) {
    setError('')
    
    // Validações básicas
    if (!expenseType) {
      setError('Selecione o tipo de despesa')
      return
    }
    if (!category) {
      setError('Selecione a categoria')
      return
    }
    
    const totalAmount = calculateTotal()
    if (!asDraft && totalAmount <= 0) {
      setError('Informe um valor válido')
      return
    }

    // Validações específicas por categoria (apenas se não for rascunho)
    if (!asDraft) {
      if (category === 'accommodation') {
        if (!state || !municipality) { setError('Informe o Município/UF'); return }
        if (!checkinDate) { setError('Informe a data de check-in'); return }
        if (!checkoutDate) { setError('Informe a data de check-out'); return }
        if (numberOfNights <= 0) { setError('Check-out deve ser após check-in'); return }
        if (!receiptPathname) { setError('Anexe a nota fiscal ou documento equivalente'); return }
        
        // Verificar se tem pelo menos um quarto
        const singleQty = parseInt(singleRoomQty || '0')
        const doubleQty = parseInt(doubleRoomQty || '0')
        const tripleQty = parseInt(tripleRoomQty || '0')
        const totalRooms = singleQty + doubleQty + tripleQty
        
        if (totalRooms === 0) { setError('Informe pelo menos um quarto'); return }
        
        // Nota: A vinculação de pessoas é apenas referência, não obrigatória
      }
      if (category === 'food') {
        if (!mealType) { setError('Selecione o tipo de refeição'); return }
      }
  if (category === 'fuel') {
  if (!vehiclePlate) { setError('Informe a placa do veículo'); return }
  if (!liters) { setError('Informe a quantidade de litros'); return }
  if (!totalKm) { setError('Informe o total de KM rodados'); return }
  }
  
  if (category === 'meal_voucher') {
    if (!mealVoucherDate) { setError('Informe a data'); return }
    if (!mealVoucherAmount || parseCurrency(mealVoucherAmount) <= 0) { setError('Informe um valor válido'); return }
    const newTotal = mealVoucherUsed + parseCurrency(mealVoucherAmount)
    if (newTotal > mealVoucherLimit) { 
      setError(`Este valor excede o limite disponível de ${formatCurrency(Math.max(0, mealVoucherLimit - mealVoucherUsed))}`)
      return 
    }
  }
  // Vale-Transporte: só valida limite quando houver um definido (null = ilimitado)
  if (category === 'transport_voucher' && transportVoucherLimit !== null) {
    const newTotal = transportVoucherUsed + parseCurrency(transportAmount)
    if (newTotal > transportVoucherLimit) {
      setError(`Este valor excede o limite disponível de ${formatCurrency(Math.max(0, transportVoucherLimit - transportVoucherUsed))}`)
      return
    }
  }
    }

    setLoading(true)

    try {
  const payload = {
  expense_type: expenseType,
  category,
  amount: totalAmount,
  expense_date: category === 'food' ? mealDate :
  category === 'fuel' ? fuelDate :
  category === 'parking' ? parkingDate :
  category === 'transport' || category === 'transport_voucher' ? transportDate :
  category === 'office_supplies' ? officeDate :
  category === 'other' ? otherDate :
  category === 'meal_voucher' ? mealVoucherDate :
  expenseDate,
  state: category === 'parking' ? parkingState :
  category === 'office_supplies' ? officeState :
  category === 'other' ? otherState :
  category === 'fuel' ? departureState :
  category === 'transport' || category === 'transport_voucher' ? transportDepartureState :
  state || null,
  municipality: category === 'parking' ? parkingCity :
  category === 'office_supplies' ? officeCity :
  category === 'other' ? otherCity :
  category === 'fuel' ? departureCity :
  category === 'transport' || category === 'transport_voucher' ? transportDepartureCity :
  municipality || null,
  description: category === 'meal_voucher' 
    ? (mealVoucherEstablishment ? `${mealVoucherEstablishment}${mealVoucherDescription ? ' - ' + mealVoucherDescription : ''}` : mealVoucherDescription || null)
    : description || null,
  receipt_pathname: receiptPathname || null,
  status: asDraft ? 'draft' : 'processed', // 'processed' = pronta para incluir em uma remessa
  location_type: locationType || null,
  
  // Vale-Refeição
  establishment_name: category === 'meal_voucher' ? mealVoucherEstablishment || null : 
    category === 'food' ? establishmentName || null : null,
  
  // Hospedagem
      checkin_date: checkinDate || null,
      checkout_date: checkoutDate || null,
      nights_count: numberOfNights || null,
      daily_rate: (parseCurrency(singleRoomValue) + parseCurrency(doubleRoomValue) + parseCurrency(tripleRoomValue)) / 
                  Math.max(1, parseInt(singleRoomQty || '0') + parseInt(doubleRoomQty || '0') + parseInt(tripleRoomQty || '0')) || null,
is_capital: locationType === 'capital',
  accommodation_name: accommodationName || null,
  has_breakfast: hasBreakfast,
  single_room_value: parseCurrency(singleRoomValue) || null,
      single_room_qty: parseInt(singleRoomQty) || null,
      double_room_value: parseCurrency(doubleRoomValue) || null,
      double_room_qty: parseInt(doubleRoomQty) || null,
      triple_room_value: parseCurrency(tripleRoomValue) || null,
      triple_room_qty: parseInt(tripleRoomQty) || null,
      extra_expenses: extraExpenses.length > 0 ? extraExpenses : null,
      linked_employees: linkedPersons.length > 0 ? linkedPersons : null,
      
      // Alimentação
      meal_type: mealType || null,
      meal_time: breakfastTime || null,
      establishment_name: establishmentName || null,
      establishment_cnpj: establishmentCnpj || null,
      // Calcular total de pessoas para a divisão.
      // Alimentação: pessoas vinculadas + o autor APENAS se ele efetuou/participou da despesa.
      // Hospedagem: mantém o próprio usuário + vinculados (a divisão real usa a contagem por quartos).
      number_of_people: category === 'food'
        ? Math.max(1, linkedPersons.length + ((madeBySelf || participated) ? 1 : 0))
        : category === 'accommodation'
          ? 1 + linkedPersons.length // +1 para incluir o próprio usuário
          : (numberOfPeople ? parseInt(numberOfPeople) : null),
      
      // Combustível
      vehicle_id: vehicleId ? parseInt(vehicleId) : null,
      vehicle_plate: vehiclePlate || null,
      km_before: kmBefore ? parseFloat(kmBefore) : null,
      km_after: kmAfter ? parseFloat(kmAfter) : null,
      total_km: totalKm ? parseFloat(totalKm) : (kmAfter && kmBefore ? parseFloat(kmAfter) - parseFloat(kmBefore) : null),
      liters: liters ? parseFloat(liters) : null,
      fuel_type: fuelType || null,
      gas_station_name: gasStationName || null,
      trip_type: tripType || null,
      departure_city: departureCity || null,
      departure_state: departureState || null,
      arrival_city: destinationCity || null,
      arrival_state: destinationState || null,
  stops: stops.length > 0 ? stops : null,
  // Localização precisa (endereço/estabelecimento) e rota real de estrada.
  // Combustível usa departure/destinationCoords; Deslocamento e Vale-Transporte usam transport*Coords.
  origin_lat: (category === 'transport' || category === 'transport_voucher' ? transportOriginCoords : departureCoords)?.lat ?? null,
  origin_lng: (category === 'transport' || category === 'transport_voucher' ? transportOriginCoords : departureCoords)?.lng ?? null,
  origin_place: (category === 'transport' || category === 'transport_voucher' ? transportOriginPlace : departurePlace) || null,
  destination_lat: (category === 'transport' || category === 'transport_voucher' ? transportDestinationCoords : destinationCoords)?.lat ?? null,
  destination_lng: (category === 'transport' || category === 'transport_voucher' ? transportDestinationCoords : destinationCoords)?.lng ?? null,
  destination_place: (category === 'transport' || category === 'transport_voucher' ? transportDestinationPlace : destinationPlace) || null,
  route_distance_km: (category === 'transport' || category === 'transport_voucher')
    ? (transportRouteSource === 'osrm' ? transportRouteDistance : null)
    : (routeSource === 'osrm' ? estimatedDistance : null),
  route_source: (category === 'transport' || category === 'transport_voucher') ? transportRouteSource : routeSource,
  is_irregular_route: isIrregularRoute || false,
  odometer_photos: odometerFiles.length > 0 ? odometerFiles : null,
  
  // Estacionamento
      parking_name: parkingName || null,
      parking_type: parkingType || null,
      parking_reason: parkingReason || null,
      
      // Deslocamento
      transport_type: transportType || null,
      transport_mode: transportMode || null, // uber, 99pop, avião, etc
      transport_voucher_type: transportVoucherType || null, // fuel, app, public (categoria do vale-transporte)
      origin: transportDepartureCity ? `${transportDepartureCity}/${transportDepartureState}` : (origin || null),
      destination: hasDifferentArrival && transportArrivalCity ? `${transportArrivalCity}/${transportArrivalState}` : (destination || null),
      distance_km: distanceKm ? parseFloat(distanceKm) : null,
      estimated_distance: (category === 'transport' || category === 'transport_voucher')
        ? (transportRouteDistance || null)
        : (estimatedDistance || null),
      is_round_trip: !hasDifferentArrival,
      linked_external_parties: transportLinkedPersons.length > 0 ? transportLinkedPersons : null,
      
      // Itens de Escritório
      store_type: officeStoreType || otherStoreType || null,
      store_name: officeStoreName || otherStoreName || null,
      items: officeItems.length > 0 ? officeItems : (otherItems.length > 0 ? otherItems : null),
      purchase_reason: officePurchaseReason || otherPurchaseReason || null,
      requester: officeRequester || otherRequester || null,
      
      // Parcelas
      installments: parseInt(String(installments)),
      current_installment: parseInt(String(currentInstallment)),

      // Identificação (somente controle gerencial / relatórios)
      made_by_self: madeBySelf,
      made_by_employee_name: madeBySelf ? null : (madeByEmployeeName || null),
      // Quando efetuada pelo próprio usuário, considera-se que participou.
      participated: madeBySelf ? true : participated,
      
      // Pagamento
      payment_barcode: paymentBarcode || null,
      pix_code: paymentPix || null,
    }

      // Se estiver em modo de edição, usar PUT, senão POST
      const url = mode === 'edit' && expenseId 
        ? `/api/expenses/${expenseId}` 
        : '/api/expenses'
      
      const response = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar despesa')

      if (mode === 'edit') {
        toast.success('Despesa atualizada!')
        router.push('/expenses/corrections')
      } else {
        toast.success(asDraft ? 'Rascunho salvo!' : 'Despesa enviada para aprovação!')
        router.push(asDraft ? '/expenses/drafts' : '/expenses/history')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar despesa'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // =====================
  // RENDER
  // =====================
  
  // Loading enquanto carrega dados para edição
  if (loadingExpense) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }
  
  return (
    <div className="w-full pb-20 sm:pb-8">
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <Button variant="ghost" size="icon" asChild className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 touch-manipulation">
          <Link href={mode === 'edit' ? '/expenses/corrections' : '/dashboard'}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{mode === 'edit' ? 'Editar Despesa' : 'Nova Despesa'}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm truncate">
            {mode === 'edit' ? 'Corrija os dados conforme solicitado' : 'Preencha os dados da despesa'}
          </p>
        </div>
      </div>

      {/* Alertas */}
      {limitWarning && (
        <Alert variant={limitWarning.includes('excede') ? 'destructive' : 'warning'} className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{limitWarning}</AlertDescription>
        </Alert>
      )}
      
      {fuelWarning && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{fuelWarning}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Tipo de Despesa e Categoria lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tipo de Despesa */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Tipo de Despesa</CardTitle>
              <CardDescription>Como esta despesa será paga?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {(Object.keys(expenseTypeLabels) as ExpenseType[]).map((type) => {
                  const Icon = expenseTypeIcons[type]
                  const isSelected = expenseType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setExpenseType(type)}
                      className={`flex items-center sm:flex-col gap-3 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 transition-colors flex-1 min-h-[48px] touch-manipulation ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 active:bg-muted'
                      }`}
                    >
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm text-left sm:text-center ${isSelected ? 'font-medium' : ''}`}>
                        {expenseTypeLabels[type]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Categoria */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Categoria</CardTitle>
              <CardDescription>Qual o tipo de gasto?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3">
                {(Object.keys(categoryLabels) as ExpenseCategory[])
                  .filter(cat => cat !== 'meal_voucher' || mealVoucherEnabled)
                  .filter(cat => cat !== 'transport_voucher' || transportVoucherEnabled)
                  .map((cat) => {
                  const Icon = categoryIcons[cat]
                  const isSelected = category === cat
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-lg border-2 transition-colors min-h-[72px] touch-manipulation ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 active:bg-muted'
                      }`}
                    >
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs text-center leading-tight ${isSelected ? 'font-medium' : ''}`}>
                        {categoryLabels[cat]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formulário específico por categoria */}
        {category === 'accommodation' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Hotel className="w-5 h-5" />
                Hospedagem
              </CardTitle>
              <CardDescription>
                Referência: {locationType === 'capital' ? formatCurrency(dynamicLimits.accommodation_capital) : locationType === 'interior' ? formatCurrency(dynamicLimits.accommodation_interior) : 'Selecione a localização'} por pessoa/diária
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Município/UF e Estabelecimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Estado *</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {brazilianStates.map((s) => (
                        <SelectItem key={s.code} value={s.code} className="py-3 sm:py-2">{s.code} - {s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Município *</Label>
                  <MunicipalityCombobox
                    value={municipality}
                    onValueChange={setMunicipality}
                    municipalities={Array.isArray(municipalities) ? municipalities : []}
                    disabled={!state || loadingMunicipalities}
                    loading={loadingMunicipalities}
                    placeholder="Pesquisar..."
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Nome do Hotel/Pousada</Label>
                  <Input
                    placeholder="Ex: Hotel Central"
                    value={accommodationName}
                    onChange={(e) => setAccommodationName(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Café da Manhã?</Label>
                  <Select 
                    value={hasBreakfast === null ? '' : hasBreakfast ? 'yes' : 'no'} 
                    onValueChange={(val) => setHasBreakfast(val === 'yes' ? true : val === 'no' ? false : null)}
                  >
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes" className="py-3 sm:py-2">Sim, incluso</SelectItem>
                      <SelectItem value="no" className="py-3 sm:py-2">Não incluso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Tipo de localização (auto-detectado) */}
              {municipality && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {locationType === 'capital' ? 'Capital' : 'Interior'} - Referência: {formatCurrency(accommodationLimit)}/pessoa/diária
                  </span>
                </div>
              )}

              <Separator />

              <Separator />

              {/* Datas */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Check-in *</Label>
                  <Input
                    type="date"
                    value={checkinDate}
                    onChange={(e) => setCheckinDate(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Check-out *</Label>
                  <Input
                    type="date"
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    min={checkinDate}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Diárias</Label>
                  <div className="h-11 sm:h-10 flex items-center justify-center px-3 rounded-md border bg-muted">
                    <span className="font-medium text-lg sm:text-base">{numberOfNights}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Quartos */}
              <div className="space-y-3 sm:space-y-4">
                <Label className="text-base font-medium">Quartos</Label>
                
                {/* Quarto Individual */}
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2 sm:gap-4 items-end">
                  <div className="col-span-3 sm:col-span-2 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Quarto Individual (por diária)</Label>
                    <Input
                      placeholder="R$ 0,00"
                      value={singleRoomValue}
                      onChange={(e) => setSingleRoomValue(formatCurrencyInput(e.target.value))}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="col-span-1 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Qtd</Label>
                    <Select value={singleRoomQty} onValueChange={setSingleRoomQty}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quarto Duplo */}
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2 sm:gap-4 items-end">
                  <div className="col-span-3 sm:col-span-2 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Quarto Duplo (por diária)</Label>
                    <Input
                      placeholder="R$ 0,00"
                      value={doubleRoomValue}
                      onChange={(e) => setDoubleRoomValue(formatCurrencyInput(e.target.value))}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="col-span-1 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Qtd</Label>
                    <Select value={doubleRoomQty} onValueChange={setDoubleRoomQty}>
                      <SelectTrigger className="h-11 sm:h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5].map(n => (
                          <SelectItem key={n} value={n.toString()} className="py-3 sm:py-2">{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quarto Triplo */}
                <div className="grid grid-cols-4 sm:grid-cols-3 gap-2 sm:gap-4 items-end">
                  <div className="col-span-3 sm:col-span-2 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Quarto Triplo (por diária)</Label>
                    <Input
                      placeholder="R$ 0,00"
                      value={tripleRoomValue}
                      onChange={(e) => setTripleRoomValue(formatCurrencyInput(e.target.value))}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                  <div className="col-span-1 space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm text-muted-foreground">Qtd</Label>
                    <Select value={tripleRoomQty} onValueChange={setTripleRoomQty}>
                      <SelectTrigger className="h-11 sm:h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0,1,2,3,4,5].map(n => (
                          <SelectItem key={n} value={n.toString()} className="py-3 sm:py-2">{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Subtotal quartos */}
                {roomsTotal > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm">Subtotal Quartos ({numberOfNights} diária{numberOfNights !== 1 ? 's' : ''}):</span>
                    <span className="font-medium">{formatCurrency(roomsTotal)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Despesas Extras */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Despesas Extras</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExtraExpense}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Inclua água, lanches, serviços de quarto, etc. Marque se a despesa for uma refeição oficial.
                </p>

                {extraExpenses.map((exp) => (
                  <div key={exp.id} className="p-3 sm:p-4 rounded-lg border space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Descrição"
                        value={exp.description}
                        onChange={(e) => updateExtraExpense(exp.id, 'description', e.target.value)}
                        className="flex-1 h-11 sm:h-10 text-base sm:text-sm"
                      />
                      <Input
                        placeholder="R$ 0,00"
                        value={exp.value ? formatCurrency(exp.value) : ''}
                        onChange={(e) => updateExtraExpense(exp.id, 'value', parseCurrency(formatCurrencyInput(e.target.value)))}
                        className="w-full sm:w-32 h-11 sm:h-10 text-base sm:text-sm"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeExtraExpense(exp.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`meal-${exp.id}`}
                          checked={exp.isMeal}
                          onCheckedChange={(checked) => {
                            updateExtraExpense(exp.id, 'isMeal', checked)
                            if (checked && !exp.numberOfPeople) {
                              updateExtraExpense(exp.id, 'numberOfPeople', 1)
                            }
                          }}
                        />
                        <Label htmlFor={`meal-${exp.id}`} className="text-sm">É uma refeição oficial</Label>
                      </div>
                      {exp.isMeal && (
                        <>
                          <Select
                            value={exp.mealType || ''}
                            onValueChange={(value) => updateExtraExpense(exp.id, 'mealType', value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(mealTypeLabels) as MealType[]).map((type) => (
                                <SelectItem key={type} value={type}>
                                  {mealTypeLabels[type]} - Ref: {formatCurrency(
                                    type === 'breakfast' ? dynamicLimits.food_breakfast :
                                    type === 'lunch' ? dynamicLimits.food_lunch :
                                    dynamicLimits.food_dinner
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`people-${exp.id}`} className="text-sm whitespace-nowrap">Qtd. pessoas:</Label>
                            <Select
                              value={String(exp.numberOfPeople || 1)}
                              onValueChange={(value) => updateExtraExpense(exp.id, 'numberOfPeople', parseInt(value))}
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: linkedPersons.length + 1 }, (_, i) => i + 1).map((num) => (
                                  <SelectItem key={num} value={String(num)}>
                                    {num}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Alerta de referência excedida para refeições */}
                    {exp.isMeal && exp.mealType && exp.value > 0 && (
                      (() => {
                        const limit = exp.mealType === 'breakfast' ? dynamicLimits.food_breakfast :
                                      exp.mealType === 'lunch' ? dynamicLimits.food_lunch :
                                      dynamicLimits.food_dinner
                        const totalPessoas = exp.numberOfPeople || 1
                        const valorPorPessoa = exp.value / totalPessoas
                        if (valorPorPessoa > limit) {
                          return (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-sm">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>
                                Valor por pessoa ({formatCurrency(valorPorPessoa)}) acima da referência de {formatCurrency(limit)} para {mealTypeLabels[exp.mealType]}
                              </span>
                            </div>
                          )
                        }
                        return null
                      })()
                    )}
                  </div>
                ))}

                {extrasTotal > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-muted">
                    <span className="text-sm">Subtotal Extras:</span>
                    <span className="font-medium">{formatCurrency(extrasTotal)}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Pessoas Vinculadas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Pessoas Vinculadas</Label>
                    {(() => {
                      const singleQty = parseInt(singleRoomQty || '0')
                      const doubleQty = parseInt(doubleRoomQty || '0')
                      const tripleQty = parseInt(tripleRoomQty || '0')
                      const expectedOtherPersons = (singleQty * 1) + (doubleQty * 2) + (tripleQty * 3) - 1
                      const linkedCount = linkedPersons.length
                      const missing = expectedOtherPersons - linkedCount
                      
                      if (expectedOtherPersons > 0 && missing > 0) {
                        return (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            Vincule mais {missing} pessoa{missing > 1 ? 's' : ''} ({linkedCount}/{expectedOtherPersons} vinculadas)
                          </p>
                        )
                      } else if (expectedOtherPersons > 0) {
                        return (
                          <p className="text-xs text-green-600 dark:text-emerald-400 mt-1">
                            {linkedCount}/{expectedOtherPersons} pessoa{expectedOtherPersons > 1 ? 's' : ''} vinculada{expectedOtherPersons > 1 ? 's' : ''}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addLinkedPerson(true)}>
                      <Users className="w-4 h-4 mr-2" />
                      Funcionário
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addLinkedPerson(false)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Terceiro
                    </Button>
                  </div>
                </div>

                {linkedPersons.map((person) => (
                  <div key={person.id} className="flex gap-2 items-center">
                    <Badge variant={person.isEmployee ? 'default' : 'secondary'} className="shrink-0">
                      {person.isEmployee ? 'Funcionário' : 'Terceiro'}
                    </Badge>
                    {person.isEmployee ? (
                      <Select
                        value={person.name}
                        onValueChange={(value) => updateLinkedPerson(person.id, 'name', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione funcionário" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <Input
                          placeholder="Nome"
                          value={person.name}
                          onChange={(e) => updateLinkedPerson(person.id, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="CPF"
                          value={person.cpf}
                          onChange={(e) => updateLinkedPerson(person.id, 'cpf', e.target.value)}
                          className="w-36"
                        />
                      </>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLinkedPerson(person.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Total da Hospedagem */}
              <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    <span className="font-medium">Valor Total Pago</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(accommodationTotal)}</span>
                </div>
                {numberOfNights > 0 && accommodationTotal > 0 && (() => {
                  // Calcular pessoas baseado nos quartos
                  const singleQty = parseInt(singleRoomQty || '0')
                  const doubleQty = parseInt(doubleRoomQty || '0')
                  const tripleQty = parseInt(tripleRoomQty || '0')
                  const personsFromRooms = (singleQty * 1) + (doubleQty * 2) + (tripleQty * 3)
                  const totalPersons = personsFromRooms > 0 ? personsFromRooms : (linkedPersons.length + 1)
                  const avgPerPerson = accommodationTotalForAverage / numberOfNights / totalPersons
                  const refLimit = locationType === 'capital' ? dynamicLimits.accommodation_capital : dynamicLimits.accommodation_interior
                  
                  return (
                  <div className="text-sm text-muted-foreground mt-2 space-y-1">
                    <p>
                      {numberOfNights} diária{numberOfNights !== 1 ? 's' : ''} | {totalPersons} pessoa{totalPersons > 1 ? 's' : ''}
                      {personsFromRooms > 0 && (
                        <span className="text-xs ml-1">
                          ({singleQty > 0 ? `${singleQty}x individual` : ''}{doubleQty > 0 ? `${singleQty > 0 ? ', ' : ''}${doubleQty}x duplo` : ''}{tripleQty > 0 ? `${(singleQty > 0 || doubleQty > 0) ? ', ' : ''}${tripleQty}x triplo` : ''})
                        </span>
                      )}
                    </p>
                    <p className="font-medium">
                      Média por diária/pessoa: {formatCurrency(avgPerPerson)}
                      {locationType && (
                        <span className={`ml-2 ${avgPerPerson > refLimit ? 'text-destructive' : 'text-success'}`}>
                          (Ref: {formatCurrency(refLimit)})
                        </span>
                      )}
                    </p>
                    {extrasMealTotal > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        * Refeições oficiais ({formatCurrency(extrasMealTotal)}) não incluídas na média de hospedagem
                      </p>
                    )}
                  </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alimentação */}
        {category === 'food' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5" />
                Alimentação
              </CardTitle>
              <CardDescription>
                Referência por pessoa: Café {formatCurrency(dynamicLimits.food_breakfast)} | Almoço {formatCurrency(dynamicLimits.food_lunch)} | Jantar {formatCurrency(dynamicLimits.food_dinner)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Município/UF, Data, Tipo de Refeição em grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Estado *</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {brazilianStates.map((s) => (
                        <SelectItem key={s.code} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Município *</Label>
                  <MunicipalityCombobox
                    value={municipality}
                    onValueChange={setMunicipality}
                    municipalities={Array.isArray(municipalities) ? municipalities : []}
                    disabled={!state || loadingMunicipalities}
                    loading={loadingMunicipalities}
                    placeholder="Pesquisar..."
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Data da Refeição *</Label>
                  <Input
                    type="date"
                    value={mealDate}
                    onChange={(e) => setMealDate(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Tipo de Refeição *</Label>
                  <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(mealTypeLabels) as MealType[]).map((type) => (
                        <SelectItem key={type} value={type} className="py-3 sm:py-2">
                          {mealTypeLabels[type]} - {formatCurrency(
                            type === 'breakfast' ? dynamicLimits.food_breakfast :
                            type === 'lunch' ? dynamicLimits.food_lunch :
                            dynamicLimits.food_dinner
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Valor da Refeição e Horário (se café) */}
              {mealType && (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Valor da Refeição *</Label>
                    <Input
                      placeholder="0,00"
                      value={mealAmount}
                      onChange={(e) => setMealAmount(formatCurrencyInput(e.target.value))}
                      className="h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                  {mealType === 'breakfast' && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <Label className="text-sm">Horário *</Label>
                      <Input
                        type="time"
                        value={breakfastTime}
                        onChange={(e) => setBreakfastTime(e.target.value)}
                        className="h-11 sm:h-10 text-base sm:text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Funcionários Vinculados */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <Label className="text-sm">Pessoas Vinculadas</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLinkedPerson(true)}
                      className="flex-1 sm:flex-none h-10 sm:h-8 text-sm touch-manipulation"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Funcionário
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addLinkedPerson(false)}
                      className="flex-1 sm:flex-none h-10 sm:h-8 text-sm touch-manipulation"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Terceiro
                    </Button>
                  </div>
                </div>

                {linkedPersons.map((person) => (
                  <div key={person.id} className="flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        {person.isEmployee ? 'Funcionário' : 'Terceiro Externo'}
                      </span>
                      {person.isEmployee ? (
                        <Select
                          value={person.name}
                          onValueChange={(value) => updateLinkedPerson(person.id, 'name', value)}
                        >
                          <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.name} className="py-3 sm:py-2">{emp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome"
                            value={person.name}
                            onChange={(e) => updateLinkedPerson(person.id, 'name', e.target.value)}
                            className="h-11 sm:h-10 text-base sm:text-sm"
                          />
                          <Input
                            placeholder="CPF"
                            value={person.cpf}
                            onChange={(e) => updateLinkedPerson(person.id, 'cpf', e.target.value)}
                            className="h-11 sm:h-10 text-base sm:text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLinkedPerson(person.id)}
                      className="h-10 w-10 sm:h-9 sm:w-9 self-end touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Resumo com média por pessoa */}
              {mealAmount && linkedPersons.length > 0 && (() => {
                // O autor entra na divisão apenas se efetuou a despesa ou marcou que participou.
                const authorCounts = madeBySelf || participated
                const peopleCount = Math.max(1, linkedPersons.length + (authorCounts ? 1 : 0))
                return (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Média por pessoa ({peopleCount} {peopleCount === 1 ? 'pessoa' : 'pessoas'}):
                    </span>
                    <span className="font-medium">
                      {formatCurrency(parseCurrency(mealAmount) / peopleCount)}
                    </span>
                  </div>
                  {mealType && (
                    <div className="mt-2 text-xs text-muted-foreground">
Referência por pessoa: {formatCurrency(
                            mealType === 'breakfast' ? dynamicLimits.food_breakfast :
                            mealType === 'lunch' ? dynamicLimits.food_lunch :
                            dynamicLimits.food_dinner
                          )}
                    </div>
                  )}
                </div>
                )
              })()}

            </CardContent>
          </Card>
        )}

        {/* Combustível */}
        {category === 'fuel' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5" />
                Combustível
              </CardTitle>
              <CardDescription>
                Mínimo de {dynamicLimits.fuel_min_km_per_liter} KM/L
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Data e Tipo de Trajeto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Data do Abastecimento *</Label>
                  <Input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Tipo de Trajeto *</Label>
                  <Select value={tripType} onValueChange={(v) => setTripType(v as typeof tripType)}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metropolitan" className="py-3 sm:py-2">Metropolitano</SelectItem>
                      <SelectItem value="intermunicipal" className="py-3 sm:py-2">Intermunicipal</SelectItem>
                      <SelectItem value="interstate" className="py-3 sm:py-2">Interestadual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Local de Partida */}
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-3 sm:space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="w-4 h-4" />
                  Local de Partida *
                </h4>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Endereço ou estabelecimento</Label>
                  <LocationSearch
                    value={departurePlace}
                    coords={departureCoords}
                    onSelect={selectDeparturePlace}
                    onClear={clearDeparturePlace}
                    placeholder="Ex: Posto Shell, Av. Boa Viagem, Recife..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Busque o local exato de partida. Estado e município são preenchidos automaticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Estado</Label>
                    <Select value={departureState} onValueChange={setDepartureState}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`dep-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Município</Label>
                    <MunicipalityCombobox
                      value={departureCity}
                      onValueChange={setDepartureCity}
                      municipalities={departureMunicipalities}
                      disabled={loadingDeparture}
                      loading={loadingDeparture}
                      placeholder="Pesquisar..."
                    />
                  </div>
                </div>
              </div>

              {/* Paradas Intermediárias */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <Label className="text-sm">Paradas Intermediárias</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStop} className="h-10 sm:h-8 touch-manipulation">
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Parada
                  </Button>
                </div>
                
                {stops.map((stop, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <LocationSearch
                          value={stop.place || ''}
                          coords={typeof stop.lat === 'number' && typeof stop.lng === 'number' ? { lat: stop.lat, lng: stop.lng } : null}
                          onSelect={(place) => selectStopPlace(index, place)}
                          onClear={() => updateStop(index, 'place', '')}
                          placeholder="Endereço ou estabelecimento da parada..."
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeStop(index)} className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 touch-manipulation">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select 
                        value={stop.state} 
                        onValueChange={(v) => {
                          updateStop(index, 'state', v)
                          // Zera a lista para refazer a busca de municípios do novo estado
                          setStopMunicipalities(prev => ({ ...prev, [index]: [] }))
                        }}
                      >
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {brazilianStates.map((s) => (
                            <SelectItem key={`stop-${index}-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <MunicipalityCombobox
                        value={stop.municipality}
                        onValueChange={(v) => updateStop(index, 'municipality', v)}
                        municipalities={stopMunicipalities[index] || []}
                        disabled={loadingStopMunicipalities[index]}
                        loading={loadingStopMunicipalities[index]}
                        placeholder="Município..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Local de Destino */}
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-3 sm:space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="w-4 h-4" />
                  Local de Destino *
                </h4>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Endereço ou estabelecimento</Label>
                  <LocationSearch
                    value={destinationPlace}
                    coords={destinationCoords}
                    onSelect={selectDestinationPlace}
                    onClear={clearDestinationPlace}
                    placeholder="Ex: Cliente, obra, filial, endereço..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Busque o local exato de destino. Estado e município são preenchidos automaticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Estado</Label>
                    <Select value={destinationState} onValueChange={setDestinationState}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`dest-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Município</Label>
                    <MunicipalityCombobox
                      value={destinationCity}
                      onValueChange={setDestinationCity}
                      municipalities={destinationMunicipalities}
                      disabled={loadingDestination}
                      loading={loadingDestination}
                      placeholder="Pesquisar..."
                    />
                  </div>
                </div>
              </div>

              {/* Quilometragem e Estimativa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label>Quilometragem Total Percorrida *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={totalKm}
                    onChange={(e) => setTotalKm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estimativa do Sistema</Label>
                  <div className="h-10 flex items-center px-3 rounded-md bg-muted text-muted-foreground">
                    {estimatedDistance ? (
                      <span className="flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        {routeSource === 'osrm' ? `${estimatedDistance} km` : `~${estimatedDistance} km`}
                        {routeSource === 'osrm' ? (
                          <span className="text-xs text-green-600 dark:text-emerald-400 font-medium">(Rota Offline)</span>
                        ) : (
                          <span className="text-xs">(estimativa)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm">Informe partida e destino</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mapa da rota */}
              {(departureCoords || destinationCoords) && (
                <div className="space-y-2">
                  <Label className="text-sm">Rota no mapa</Label>
                  <div className="relative z-0 isolate h-64 sm:h-80 w-full overflow-hidden rounded-lg border">
                    <RouteMap
                      points={[
                        ...(departureCoords
                          ? [{ lat: departureCoords.lat, lng: departureCoords.lng, label: departurePlace || 'Partida', kind: 'origin' as const }]
                          : []),
                        ...stops
                          .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
                          .map(s => ({ lat: s.lat as number, lng: s.lng as number, label: s.place || s.municipality, kind: 'stop' as const })),
                        ...(destinationCoords
                          ? [{ lat: destinationCoords.lat, lng: destinationCoords.lng, label: destinationPlace || 'Destino', kind: 'destination' as const }]
                          : []),
                      ]}
                      geometry={routeGeometry}
                    />
                  </div>
                  {routeSource === 'haversine' && (departureCoords && destinationCoords) && (
                    <p className="text-xs text-muted-foreground">
                      Não foi possível calcular a rota por estrada agora; exibindo distância aproximada em linha reta.
                    </p>
                  )}
                </div>
              )}

{/* Alerta de diferença de KM - tolerância de 30% */}
              {estimatedDistance && totalKm && Math.abs(parseFloat(totalKm) - estimatedDistance) > estimatedDistance * 0.3 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Diferença acima de 30% entre KM informado ({totalKm}) e estimativa ({estimatedDistance}km). 
                  Considere marcar como percurso irregular se houver desvios.
                </div>
              )}

              {/* Flag de Percurso Irregular */}
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30">
                <Checkbox
                  id="irregular-route"
                  checked={isIrregularRoute}
                  onCheckedChange={(checked) => setIsIrregularRoute(checked === true)}
                />
                <label htmlFor="irregular-route" className="text-sm cursor-pointer">
                  Percurso irregular (idas e vindas, trajetos internos, consumo atípico)
                </label>
              </div>

              {/* Veículo e Combustível */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Veículo Abastecido *</Label>
                  <Select value={vehicleId} onValueChange={handleVehicleSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()}>
                          {v.model} - {v.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Combustível Abastecido *</Label>
                  <Select value={fuelType} onValueChange={setFuelType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o combustível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasoline">Gasolina</SelectItem>
                      <SelectItem value="ethanol">Etanol</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="gnv">GNV</SelectItem>
                      <SelectItem value="electric">Elétrico</SelectItem>
                    </SelectContent>
                  </Select>
                  {vehicleId && vehicles.find(v => v.id === parseInt(vehicleId))?.fuel_type === 'flex' && (
                    <p className="text-xs text-muted-foreground">Veículo flex - selecione o combustível abastecido</p>
                  )}
                </div>
              </div>

              {/* Placa */}
              <div className="space-y-2">
                <Label>Placa</Label>
                <Input
                  placeholder="ABC-1234"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  disabled={!!vehicleId}
                  className="max-w-[200px]"
                />
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Pago *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={fuelAmount}
                    onChange={(e) => setFuelAmount(formatCurrencyInput(e.target.value))}
                    className="text-right font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Litros Abastecidos *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={liters}
                    onChange={(e) => setLiters(e.target.value)}
                  />
                </div>
              </div>

              {/* Cálculos automáticos */}
              {(pricePerLiter || fuelKmPerLiter) && (
                <div className="grid grid-cols-2 gap-4">
                  {pricePerLiter && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">Valor do Litro:</span>
                      <span className="ml-2 font-medium">{formatCurrency(pricePerLiter)}</span>
                    </div>
                  )}
                  {fuelKmPerLiter && (
                    <div className={`p-3 rounded-lg ${fuelKmPerLiter >= dynamicLimits.fuel_min_km_per_liter ? 'bg-green-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                      <span className="text-sm">Consumo:</span>
                      <span className={`ml-2 font-medium ${fuelKmPerLiter >= dynamicLimits.fuel_min_km_per_liter ? 'text-green-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {fuelKmPerLiter.toFixed(2)} KM/L
                      </span>
                    </div>
                  )}
                </div>
              )}

              {fuelKmPerLiter !== null && fuelKmPerLiter < dynamicLimits.fuel_min_km_per_liter && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200 text-sm">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  Consumo abaixo do mínimo de {dynamicLimits.fuel_min_km_per_liter} KM/L. Justifique nas observações.
                </div>
              )}

              {/* Upload do Hodômetro (até 4 arquivos - imagem ou PDF) */}
              <div className="space-y-2">
                <Label>Arquivos do Hodômetro * (até 4)</Label>
                <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, PDF</p>
                
                {/* Lista de arquivos já adicionados */}
                {odometerFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {odometerFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 text-primary">
                          {file.name.toLowerCase().endsWith('.pdf') ? <FileText className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                          <span className="text-sm truncate max-w-[120px]">{file.name}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOdometerFile(index)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Botão para adicionar mais */}
                {odometerFiles.length < 4 && (
                  <div className="border-2 border-dashed rounded-lg p-4">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleOdometerUpload}
                      className="hidden"
                      id="odometer-upload"
                    />
                    <label
                      htmlFor="odometer-upload"
                      className="flex flex-col items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {odometerFiles.length === 0 
                          ? 'Clique para anexar arquivo do hodômetro' 
                          : `Adicionar mais (${4 - odometerFiles.length} restantes)`}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estacionamento */}
        {category === 'parking' && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ParkingCircle className="w-5 h-5" />
                Estacionamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Município/UF */}
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-3 sm:space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="w-4 h-4" />
                  Localização *
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Estado</Label>
                    <Select value={parkingState} onValueChange={setParkingState}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`parking-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Município</Label>
                    <MunicipalityCombobox
                      value={parkingCity}
                      onValueChange={setParkingCity}
                      municipalities={parkingMunicipalities}
                      disabled={loadingParkingMunicipalities}
                      loading={loadingParkingMunicipalities}
                      placeholder="Pesquisar..."
                    />
                  </div>
                </div>
              </div>

              {/* Data, Tipo, Nome, Motivo em grid compacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Data *</Label>
                  <Input
                    type="date"
                    value={parkingDate}
                    onChange={(e) => setParkingDate(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Tipo *</Label>
                  <Select value={parkingType} onValueChange={setParkingType}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rotativo" className="py-3 sm:py-2">Rotativo</SelectItem>
                      <SelectItem value="shopping" className="py-3 sm:py-2">Shopping</SelectItem>
                      <SelectItem value="empresarial" className="py-3 sm:py-2">Empresarial</SelectItem>
                      <SelectItem value="aeroporto" className="py-3 sm:py-2">Aeroporto</SelectItem>
                      <SelectItem value="rua" className="py-3 sm:py-2">Rua</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Nome do Estabelecimento *</Label>
                  <Input
                    placeholder="Nome do estacionamento"
                    value={parkingName}
                    onChange={(e) => setParkingName(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Motivo da Parada *</Label>
                  <Select value={parkingReason} onValueChange={setParkingReason}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reuniao" className="py-3 sm:py-2">Reunião</SelectItem>
                      <SelectItem value="alimentacao" className="py-3 sm:py-2">Alimentação</SelectItem>
                      <SelectItem value="compra_entrega" className="py-3 sm:py-2">Compra/Entrega</SelectItem>
                      <SelectItem value="guarda_veiculo" className="py-3 sm:py-2">Guarda Veículo</SelectItem>
                      <SelectItem value="mensalista" className="py-3 sm:py-2">Mensalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Valor */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-sm">Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={parkingAmount}
                  onChange={(e) => setParkingAmount(e.target.value)}
                />
              </div>

              {/* Pessoas Vinculadas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pessoas Vinculadas</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addParkingLinkedPerson('employee')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Funcionário
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addParkingLinkedPerson('third_party')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Terceiro
                    </Button>
                  </div>
                </div>

                {parkingLinkedPersons.map((person, index) => (
                  <div key={index} className="flex items-end gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {person.type === 'employee' ? 'Funcionário' : 'Terceiro Externo'}
                      </span>
                      {person.type === 'employee' ? (
                        <Select
                          value={person.user_id?.toString() || ''}
                          onValueChange={(v) => updateParkingLinkedPerson(index, 'user_id', parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o funcionário" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome"
                            value={person.name || ''}
                            onChange={(e) => updateParkingLinkedPerson(index, 'name', e.target.value)}
                          />
                          <Input
                            placeholder="CPF"
                            value={person.cpf || ''}
                            onChange={(e) => updateParkingLinkedPerson(index, 'cpf', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeParkingLinkedPerson(index)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deslocamento */}
        {(category === 'transport' || category === 'transport_voucher') && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                {category === 'transport_voucher' ? <Bus className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                {category === 'transport_voucher' ? 'Vale-Transporte' : 'Deslocamento'}
              </CardTitle>
              {category === 'transport_voucher' && (
                <CardDescription>
                  {transportVoucherLimit !== null
                    ? `Limite mensal de ${formatCurrency(transportVoucherLimit)}. Informe o trajeto e o valor pago.`
                    : 'Benefício sem limite de valor. Informe o trajeto e o valor pago.'}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Categoria do Vale-Transporte (apenas para VT) */}
              {category === 'transport_voucher' && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Tipo de Despesa *</Label>
                  <Select value={transportVoucherType} onValueChange={setTransportVoucherType}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fuel" className="py-3 sm:py-2">Combustível</SelectItem>
                      <SelectItem value="app" className="py-3 sm:py-2">Deslocamento por aplicativo</SelectItem>
                      <SelectItem value="public" className="py-3 sm:py-2">Transporte público</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo de Transporte (oculto no Vale-Transporte: substituído pelo Tipo de Despesa acima) */}
              {category !== 'transport_voucher' && (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Tipo de Transporte *</Label>
                  <Select value={transportMode} onValueChange={setTransportMode}>
                    <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uber" className="py-3 sm:py-2">Uber</SelectItem>
                      <SelectItem value="99pop" className="py-3 sm:py-2">99Pop</SelectItem>
                      <SelectItem value="taxi" className="py-3 sm:py-2">Táxi</SelectItem>
                      <SelectItem value="bus" className="py-3 sm:py-2">Ônibus</SelectItem>
                      <SelectItem value="metro" className="py-3 sm:py-2">Metrô</SelectItem>
                      <SelectItem value="train" className="py-3 sm:py-2">Trem</SelectItem>
                      <SelectItem value="airplane" className="py-3 sm:py-2">Avião</SelectItem>
                      <SelectItem value="rental_car" className="py-3 sm:py-2">Carro Alugado</SelectItem>
                      <SelectItem value="motorcycle_app" className="py-3 sm:py-2">Moto (App)</SelectItem>
                      <SelectItem value="boat" className="py-3 sm:py-2">Barco/Balsa</SelectItem>
                      <SelectItem value="other" className="py-3 sm:py-2">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Local de Partida (endereço preciso) */}
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-3 sm:space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="w-4 h-4" />
                  Local de Partida *
                </h4>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Endereço ou estabelecimento</Label>
                  <LocationSearch
                    value={transportOriginPlace}
                    coords={transportOriginCoords}
                    onSelect={selectTransportOriginPlace}
                    onClear={clearTransportOriginPlace}
                    placeholder="Ex: Casa, escritório, endereço de partida..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Busque o local exato de partida. Estado e município são preenchidos automaticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Estado</Label>
                    <Select value={transportDepartureState} onValueChange={setTransportDepartureState}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`trans-dep-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Município</Label>
                    <MunicipalityCombobox
                      value={transportDepartureCity}
                      onValueChange={setTransportDepartureCity}
                      municipalities={transportDepartureMunicipalities}
                      disabled={loadingTransportDeparture}
                      loading={loadingTransportDeparture}
                      placeholder="Pesquisar..."
                    />
                  </div>
                </div>
              </div>

              {/* Local de Destino (endereço preciso) */}
              <div className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-3 sm:space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                  <MapPin className="w-4 h-4" />
                  Local de Destino *
                </h4>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Endereço ou estabelecimento</Label>
                  <LocationSearch
                    value={transportDestinationPlace}
                    coords={transportDestinationCoords}
                    onSelect={selectTransportDestinationPlace}
                    onClear={clearTransportDestinationPlace}
                    placeholder="Ex: Cliente, obra, filial, endereço..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Busque o local exato de destino. Estado e município são preenchidos automaticamente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-sm">Estado</Label>
                    <Select value={transportArrivalState} onValueChange={setTransportArrivalState}>
                      <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`trans-arr-${s.code}`} value={s.code} className="py-3 sm:py-2">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label>Município</Label>
                    <MunicipalityCombobox
                      value={transportArrivalCity}
                      onValueChange={setTransportArrivalCity}
                      municipalities={transportArrivalMunicipalities}
                      disabled={loadingTransportArrival}
                      loading={loadingTransportArrival}
                      placeholder="Pesquisar município..."
                    />
                  </div>
                </div>
              </div>

              {/* Estimativa do Sistema */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-sm">Estimativa do Sistema</Label>
                <div className="h-10 flex items-center px-3 rounded-md bg-muted text-muted-foreground">
                  {loadingTransportRoute ? (
                    <span className="text-sm">Calculando rota...</span>
                  ) : transportRouteDistance ? (
                    <span className="flex items-center gap-2">
                      <Navigation className="w-4 h-4" />
                      {transportRouteSource === 'osrm' ? `${transportRouteDistance} km` : `~${transportRouteDistance} km`}
                      {transportRouteSource === 'osrm' ? (
                        <span className="text-xs text-green-600 dark:text-emerald-400 font-medium">(Rota Offline)</span>
                      ) : (
                        <span className="text-xs">(estimativa)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-sm">Informe partida e destino</span>
                  )}
                </div>
              </div>

              {/* Mapa da rota */}
              {(transportOriginCoords || transportDestinationCoords) && (
                <div className="space-y-2">
                  <Label className="text-sm">Rota no mapa</Label>
                  <div className="relative z-0 isolate h-64 sm:h-80 w-full overflow-hidden rounded-lg border">
                    <RouteMap
                      points={[
                        ...(transportOriginCoords
                          ? [{ lat: transportOriginCoords.lat, lng: transportOriginCoords.lng, label: transportOriginPlace || 'Partida', kind: 'origin' as const }]
                          : []),
                        ...(transportDestinationCoords
                          ? [{ lat: transportDestinationCoords.lat, lng: transportDestinationCoords.lng, label: transportDestinationPlace || 'Destino', kind: 'destination' as const }]
                          : []),
                      ]}
                      geometry={transportRouteGeometry}
                    />
                  </div>
                  {transportRouteSource === 'haversine' && (transportOriginCoords && transportDestinationCoords) && (
                    <p className="text-xs text-muted-foreground">
                      Não foi possível calcular a rota por estrada agora; exibindo distância aproximada em linha reta.
                    </p>
                  )}
                </div>
              )}

              {/* Data e Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Data do Trajeto *</Label>
                  <Input
                    type="date"
                    value={transportDate}
                    onChange={(e) => setTransportDate(e.target.value)}
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Valor *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={transportAmount}
                      onChange={(e) => setTransportAmount(formatCurrencyInput(e.target.value))}
                      className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Acompanhamento do limite mensal do Vale-Transporte */}
              {category === 'transport_voucher' && transportVoucherLimit !== null && (() => {
                const projected = transportVoucherUsed + parseCurrency(transportAmount)
                const available = Math.max(0, transportVoucherLimit - transportVoucherUsed)
                const exceeded = projected > transportVoucherLimit
                const pct = Math.min(100, Math.round((projected / transportVoucherLimit) * 100))
                return (
                  <div className="space-y-2 rounded-lg border p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                      <span>Limite mensal: <strong className="text-foreground">{formatCurrency(transportVoucherLimit)}</strong></span>
                      <span>Utilizado: <strong className="text-foreground">{formatCurrency(transportVoucherUsed)}</strong></span>
                      <span>Disponível: <strong className="text-foreground">{formatCurrency(available)}</strong></span>
                    </div>
                    {exceeded && (
                      <div className="flex items-start gap-2 text-xs sm:text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Este valor excede o limite disponível de {formatCurrency(available)}.</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Uso do limite mensal</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${exceeded ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Pessoas Vinculadas */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <Label className="text-sm">Pessoas Vinculadas</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTransportLinkedPerson('employee')}
                      className="flex-1 sm:flex-none h-10 sm:h-8 touch-manipulation"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Funcionário
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTransportLinkedPerson('third_party')}
                      className="flex-1 sm:flex-none h-10 sm:h-8 touch-manipulation"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Terceiro
                    </Button>
                  </div>
                </div>

                {transportLinkedPersons.map((person, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 space-y-1.5">
                      <span className="text-xs text-muted-foreground">
                        {person.type === 'employee' ? 'Funcionário' : 'Terceiro Externo'}
                      </span>
                      {person.type === 'employee' ? (
                        <Select
                          value={person.user_id?.toString() || ''}
                          onValueChange={(v) => updateTransportLinkedPerson(index, 'user_id', parseInt(v))}
                        >
                          <SelectTrigger className="h-11 sm:h-10 text-base sm:text-sm">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id.toString()} className="py-3 sm:py-2">{emp.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome"
                            value={person.name || ''}
                            onChange={(e) => updateTransportLinkedPerson(index, 'name', e.target.value)}
                            className="h-11 sm:h-10 text-base sm:text-sm"
                          />
                          <Input
                            placeholder="CPF"
                            value={person.cpf || ''}
                            onChange={(e) => updateTransportLinkedPerson(index, 'cpf', e.target.value)}
                            className="h-11 sm:h-10 text-base sm:text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTransportLinkedPerson(index)}
                      className="h-10 w-10 sm:h-9 sm:w-9 self-end touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>
        )}

        {/* Itens de Escritório */}
        {category === 'office_supplies' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Itens de Escritório
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Município/UF */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Localização *
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={officeState} onValueChange={setOfficeState}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`office-${s.code}`} value={s.code}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Município</Label>
                    <MunicipalityCombobox
                      value={officeCity}
                      onValueChange={setOfficeCity}
                      municipalities={officeMunicipalities}
                      disabled={loadingOfficeMunicipalities}
                      loading={loadingOfficeMunicipalities}
                      placeholder="Pesquisar município..."
                    />
                  </div>
                </div>
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={officeDate}
                  onChange={(e) => setOfficeDate(e.target.value)}
                />
              </div>

              {/* Tipo do Estabelecimento */}
              <div className="space-y-2">
                <Label>Tipo do Estabelecimento *</Label>
                <Select value={officeStoreType} onValueChange={setOfficeStoreType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisico">Físico</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nome do Estabelecimento */}
              <div className="space-y-2">
                <Label>Nome do Estabelecimento *</Label>
                <Input
                  placeholder="Nome da loja ou site"
                  value={officeStoreName}
                  onChange={(e) => setOfficeStoreName(e.target.value)}
                />
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Item(ns) *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOfficeItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                {officeItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                  </p>
                )}

                {officeItems.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeOfficeItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nome do item"
                        value={item.name}
                        onChange={(e) => updateOfficeItem(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOfficeItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Unit.</Label>
                        <Input
                          placeholder="R$ 0,00"
                          value={item.unitPrice}
                          onChange={(e) => updateOfficeItem(index, 'unitPrice', formatCurrencyInput(e.target.value))}
                          className="text-right font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={item.totalPrice || 'R$ 0,00'}
                          readOnly
                          className="text-right font-mono text-sm bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {officeItems.length > 0 && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 font-medium">
                    <span>Total dos Itens:</span>
                    <span className="font-mono">{officeAmount || 'R$ 0,00'}</span>
                  </div>
                )}
              </div>

              {/* Motivo da Compra */}
              <div className="space-y-2">
                <Label>Motivo da Compra *</Label>
                <Select value={officePurchaseReason} onValueChange={setOfficePurchaseReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solicitacao">Solicitação</SelectItem>
                    <SelectItem value="reposicao">Reposição</SelectItem>
                    <SelectItem value="necessidade">Necessidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Solicitante */}
              <div className="space-y-2">
                <Label>Solicitante</Label>
                <Select value={officeRequester} onValueChange={setOfficeRequester}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o solicitante" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Outras Despesas */}
        {category === 'other' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Outras Despesas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Município/UF */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Localização *
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={otherState} onValueChange={setOtherState}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((s) => (
                          <SelectItem key={`other-${s.code}`} value={s.code}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Município</Label>
                    <MunicipalityCombobox
                      value={otherCity}
                      onValueChange={setOtherCity}
                      municipalities={otherMunicipalities}
                      disabled={loadingOtherMunicipalities}
                      loading={loadingOtherMunicipalities}
                      placeholder="Pesquisar município..."
                    />
                  </div>
                </div>
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={otherDate}
                  onChange={(e) => setOtherDate(e.target.value)}
                />
              </div>

              {/* Tipo do Estabelecimento */}
              <div className="space-y-2">
                <Label>Tipo do Estabelecimento *</Label>
                <Select value={otherStoreType} onValueChange={setOtherStoreType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisico">Físico</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Nome do Estabelecimento */}
              <div className="space-y-2">
                <Label>Nome do Estabelecimento *</Label>
                <Input
                  placeholder="Nome da loja ou site"
                  value={otherStoreName}
                  onChange={(e) => setOtherStoreName(e.target.value)}
                />
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Item(ns) *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOtherItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                {otherItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                  </p>
                )}

                {otherItems.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Item {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeOtherItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Nome do item"
                        value={item.name}
                        onChange={(e) => updateOtherItem(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOtherItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor Unit.</Label>
                        <Input
                          placeholder="R$ 0,00"
                          value={item.unitPrice}
                          onChange={(e) => updateOtherItem(index, 'unitPrice', formatCurrencyInput(e.target.value))}
                          className="text-right font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={item.totalPrice || 'R$ 0,00'}
                          readOnly
                          className="text-right font-mono text-sm bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {otherItems.length > 0 && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 font-medium">
                    <span>Total dos Itens:</span>
                    <span className="font-mono">{otherAmount || 'R$ 0,00'}</span>
                  </div>
                )}
              </div>

              {/* Motivo da Compra */}
              <div className="space-y-2">
                <Label>Motivo da Compra *</Label>
                <Select value={otherPurchaseReason} onValueChange={setOtherPurchaseReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solicitacao">Solicitação</SelectItem>
                    <SelectItem value="reposicao">Reposição</SelectItem>
                    <SelectItem value="necessidade">Necessidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Solicitante */}
              <div className="space-y-2">
                <Label>Solicitante</Label>
                <Select value={otherRequester} onValueChange={setOtherRequester}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o solicitante" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulário Vale-Refeição */}
        {category === 'meal_voucher' && mealVoucherEnabled && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                Vale-Refeição
              </CardTitle>
              <CardDescription>
                Limite mensal: {formatCurrency(mealVoucherLimit)} | Utilizado: {formatCurrency(mealVoucherUsed)} | Disponível: {formatCurrency(Math.max(0, mealVoucherLimit - mealVoucherUsed))}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alerta de limite */}
              {mealVoucherUsed >= mealVoucherLimit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Você já atingiu o limite mensal do vale-refeição.
                  </AlertDescription>
                </Alert>
              )}
              
              {mealVoucherUsed + parseCurrency(mealVoucherAmount) > mealVoucherLimit && parseCurrency(mealVoucherAmount) > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Este valor excede o limite disponível de {formatCurrency(Math.max(0, mealVoucherLimit - mealVoucherUsed))}.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={mealVoucherDate}
                    onChange={(e) => setMealVoucherDate(e.target.value)}
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={mealVoucherAmount}
                    onChange={(e) => setMealVoucherAmount(formatCurrencyInput(e.target.value))}
                    className="h-11 sm:h-10 font-mono"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Estabelecimento</Label>
                <Input
                  placeholder="Nome do restaurante/lanchonete"
                  value={mealVoucherEstablishment}
                  onChange={(e) => setMealVoucherEstablishment(e.target.value)}
                  className="h-11 sm:h-10"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Detalhes da refeição (opcional)"
                  value={mealVoucherDescription}
                  onChange={(e) => setMealVoucherDescription(e.target.value)}
                  rows={2}
                />
              </div>
              
              {/* Barra de progresso do limite */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uso do limite mensal</span>
                  <span className="font-medium">{Math.min(100, Math.round(((mealVoucherUsed + parseCurrency(mealVoucherAmount)) / mealVoucherLimit) * 100))}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      (mealVoucherUsed + parseCurrency(mealVoucherAmount)) > mealVoucherLimit 
                        ? 'bg-red-500' 
                        : (mealVoucherUsed + parseCurrency(mealVoucherAmount)) > mealVoucherLimit * 0.75 
                          ? 'bg-amber-500' 
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, ((mealVoucherUsed + parseCurrency(mealVoucherAmount)) / mealVoucherLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parcelas e Identificação */}
        {category && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Parcelas e Identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Parcela</Label>
                  <Select value={installments} onValueChange={(v) => {
                    setInstallments(v)
                    if (parseInt(currentInstallment) > parseInt(v)) {
                      setCurrentInstallment(v)
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Única</SelectItem>
                      {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {parseInt(installments) > 1 && (
                  <div className="space-y-2">
                    <Label>Parcela Atual</Label>
                    <Select value={currentInstallment} onValueChange={setCurrentInstallment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: parseInt(installments) }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}ª parcela</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Identificação de quem efetuou / participou (somente controle gerencial) */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-3">
                  Informações para controle gerencial e relatórios. Não afetam aprovação nem financeiro.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Efetuada por mim */}
                  <div className="space-y-2">
                    <Label className="text-sm">Despesa efetuada por mim</Label>
                    <div className="flex items-center gap-3 h-11 sm:h-10">
                      <Switch
                        checked={madeBySelf}
                        onCheckedChange={(checked) => {
                          setMadeBySelf(checked)
                          if (checked) {
                            // Voltou para "mim": limpa executor e assume participação
                            setMadeByEmployeeName('')
                            setParticipated(true)
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">{madeBySelf ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>

                  {/* Quem efetuou (só quando não foi por mim) */}
                  {!madeBySelf && (
                    <div className="space-y-2">
                      <Label className="text-sm">Quem efetuou a despesa?</Label>
                      <Select value={madeByEmployeeName} onValueChange={setMadeByEmployeeName}>
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue placeholder="Selecione o funcionário" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Você participou? (só relevante quando não foi por mim) */}
                  {!madeBySelf && (
                    <div className="space-y-2">
                      <Label className="text-sm">Você participou da despesa?</Label>
                      <div className="flex items-center gap-3 h-11 sm:h-10">
                        <Switch checked={participated} onCheckedChange={setParticipated} />
                        <span className="text-sm text-muted-foreground">{participated ? 'Sim' : 'Não'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observações, Comprovante e Resumo */}
        {category && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Observações e Comprovante */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Observações e Comprovante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Observações Gerais</Label>
                  <Textarea
                    placeholder="Informações adicionais sobre a despesa"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-sm">Nota Fiscal / Comprovante *</Label>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={uploadingFile}
                      className="flex-1 h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                    >
                      {uploadingFile ? (
                        <>
                          <Spinner className="w-4 h-4 mr-2" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                          {receiptFileName || 'Anexar arquivo'}
                        </>
                      )}
                    </Button>
                    {receiptFileName && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setReceiptPathname('')
                          setReceiptFileName('')
                        }}
                        className="h-12 w-12 sm:h-10 sm:w-10 touch-manipulation"
                      >
                        <X className="w-5 h-5 sm:w-4 sm:h-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG, PDF (máx. 10MB)</p>
                </div>
              </CardContent>
            </Card>

            {/* Resumo e Ações - Sticky no mobile */}
            <Card className="border-2 border-primary/20 sticky bottom-0 sm:static z-10 rounded-t-xl sm:rounded-xl shadow-lg sm:shadow-none">
              <CardContent className="pt-4 sm:pt-6 pb-4 flex flex-col h-full justify-between">
                <div className="flex sm:flex-col items-center sm:items-stretch justify-between sm:justify-start gap-2 sm:gap-0 mb-3 sm:mb-4 sm:text-center">
                  <span className="text-sm text-muted-foreground">Valor Total</span>
                  <p className="text-2xl sm:text-3xl font-bold text-primary sm:mt-1">{formatCurrency(finalAmount)}</p>
                </div>

                <div className="flex sm:flex-col gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSubmit(true)}
                    disabled={loading}
                    className="flex-1 h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    <span className="hidden sm:inline">Salvar </span>Rascunho
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                    className="flex-1 h-12 sm:h-10 text-base sm:text-sm touch-manipulation"
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Processar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
