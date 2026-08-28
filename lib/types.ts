// Tipos do banco de dados - podem ser importados no cliente e servidor
export type UserRole = 'employee' | 'manager' | 'director' | 'admin' | 'financial' | 'coordinator'

export type ExpenseType = 'corporate_card' | 'advance' | 'reimbursement'

export type ExpenseCategory = 
  | 'accommodation' 
  | 'food' 
  | 'fuel' 
  | 'transport' 
  | 'parking' 
  | 'office_supplies' 
  | 'meal_voucher'
  | 'transport_voucher'
  | 'other'

export type MealType = 'breakfast' | 'lunch' | 'dinner'

export type ExpenseStatus = 'draft' | 'processed' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'correction' | 'analysis'

export type LocationType = 'capital' | 'interior'

export interface User {
  id: number
  name: string
  surname: string | null
  email: string
  cpf: string | null
  password_hash: string
  role: UserRole
  department: string | null
  bank_account: string | null
  bank_agency: string | null
  pix_key: string | null
  active: boolean
  meal_voucher_enabled: boolean
  meal_voucher_limit: number | null
  transport_voucher_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: number
  plate: string
  model: string
  brand: string
  year: number | null
  fuel_type: string | null
  km_per_liter: number | null
  owner_type: 'company' | 'employee' | 'third_party'
  owner_id: number | null
  driver_id: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  user_id: number
  expense_type: ExpenseType
  category: ExpenseCategory
  description: string | null
  amount: number
  expense_date: string
  municipality: string | null
  state: string | null
  status: ExpenseStatus
  receipt_url: string | null
  receipt_pathname: string | null
  approved_by: number | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  
  // Campos de hospedagem
  accommodation_name: string | null
  accommodation_cnpj: string | null
  checkin_date: string | null
  checkout_date: string | null
  daily_rate: number | null
  location_type: LocationType | null
  has_breakfast: boolean | null
  
  // Campos de alimentação
  meal_type: MealType | null
  establishment_name: string | null
  establishment_cnpj: string | null
  number_of_people: number | null
  
  // Campos de combustível
  vehicle_id: number | null
  vehicle_plate: string | null
  km_before: number | null
  km_after: number | null
  liters: number | null
  fuel_type: string | null
  gas_station_name: string | null
  
  // Campos de estacionamento
  parking_name: string | null
  parking_cnpj: string | null
  entry_time: string | null
  exit_time: string | null
  
  // Campos de deslocamento
  transport_type: string | null
  origin: string | null
  destination: string | null
  distance_km: number | null

  // Localização precisa e rota (compartilhado por combustível, deslocamento e vale-transporte)
  origin_lat: number | null
  origin_lng: number | null
  origin_place: string | null
  destination_lat: number | null
  destination_lng: number | null
  destination_place: string | null
  route_distance_km: number | null
  route_source: string | null
  
  // Campos de parcelas
  installments: number | null
  current_installment: number | null
  
  // Campos de pagamento
  payment_barcode: string | null
  payment_pix: string | null
  
  // Terceiros vinculados
  third_party_name: string | null
  third_party_cpf: string | null
  
  // Campos adicionais de join
  user_name?: string
  approver_name?: string
  vehicle_model?: string
}

export interface CategoryLimit {
  id: number
  category: string
  category_name: string
  daily_limit: number
  alert_threshold: number
  limit_type: string | null
  sub_category: string | null
  min_km_per_liter: number | null
  created_at: string
  updated_at: string
}

export interface ExpenseHistory {
  id: number
  expense_id: number
  action: string
  user_id: number
  notes: string | null
  previous_status: ExpenseStatus | null
  new_status: ExpenseStatus | null
  created_at: string
  user_name?: string
}

// Mapeamentos para exibição
export const expenseTypeLabels: Record<ExpenseType, string> = {
  corporate_card: 'Cartão Corporativo',
  advance: 'Adiantamento',
  reimbursement: 'Reembolso',
}

export const categoryLabels: Record<ExpenseCategory, string> = {
  accommodation: 'Hospedagem',
  food: 'Alimentação',
  fuel: 'Combustível',
  transport: 'Deslocamento',
  parking: 'Estacionamento',
  office_supplies: 'Itens de Escritório',
  meal_voucher: 'Vale-Refeição',
  transport_voucher: 'Vale-Transporte',
  other: 'Outras Despesas',
}

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Café da Manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
}

export const statusLabels: Record<ExpenseStatus, string> = {
  draft: 'Rascunho',
  processed: 'Processada',
  submitted: 'Enviada',
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  correction: 'Em Correção',
  analysis: 'Em Análise',
  }

export const roleLabels: Record<string, string> = {
  employee: 'Funcionário',
  manager: 'Gestor',
  director: 'Diretoria Financeira',
  admin: 'Administrador',
  finance: 'Financeiro',
  }

export const locationTypeLabels: Record<LocationType, string> = {
  capital: 'Capital',
  interior: 'Interior',
}

export const transportTypeOptions = [
  { value: 'uber', label: 'Uber/99' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'bus', label: 'Ônibus' },
  { value: 'metro', label: 'Metrô' },
  { value: 'airplane', label: 'Avião' },
  { value: 'rental', label: 'Carro Alugado' },
  { value: 'own_vehicle', label: 'Veículo Próprio' },
  { value: 'other', label: 'Outro' },
]

// Opções de combustível que pode ser ABASTECIDO (usado em despesas)
export const fuelTypeOptions = [
  { value: 'gasoline', label: 'Gasolina' },
  { value: 'ethanol', label: 'Etanol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gnv', label: 'GNV' },
  { value: 'electric', label: 'Elétrico' },
]

// Opções de tipo de VEÍCULO (usado no cadastro de veículos)
export const vehicleFuelTypeOptions = [
  { value: 'gasoline', label: 'Gasolina' },
  { value: 'ethanol', label: 'Etanol' },
  { value: 'flex', label: 'Flex (Gasolina/Etanol)' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gnv', label: 'GNV' },
  { value: 'electric', label: 'Elétrico' },
  { value: 'hybrid', label: 'Híbrido (Gasolina/Elétrico)' },
]

// Limites padrão por categoria
export const defaultLimits = {
  accommodation_interior: 180.00,
  accommodation_capital: 230.00,
  food_breakfast: 30.00,
  food_lunch: 40.00,
  food_dinner: 30.00,
  fuel_min_km_per_liter: 10.00,
}
