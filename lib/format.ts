// Formatar valor em reais
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// Formatar data no padrão brasileiro
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  
  let d: Date
  if (typeof date === 'string') {
    // Extrair apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
    const dateOnly = date.split('T')[0]
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      // Criar data usando componentes locais para evitar conversão UTC
      const [year, month, day] = dateOnly.split('-').map(Number)
      d = new Date(year, month - 1, day, 12, 0, 0)
    } else {
      d = new Date(date)
    }
  } else {
    d = date
  }
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

// Formatar data e hora
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}

// Formatar data para input
export function formatDateForInput(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().split('T')[0]
}

// Parse valor em reais para número
export function parseCurrency(value: string): number {
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(cleaned) || 0
}

// Formatar valor para input de moeda
export function formatCurrencyInput(value: string): string {
  const numbers = value.replace(/\D/g, '')
  const amount = parseInt(numbers, 10) / 100
  
  if (isNaN(amount)) return ''
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Obter iniciais do nome
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Truncar texto
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Estados brasileiros
export const brazilianStates = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
]

// Labels de categorias (suporte a inglês e português)
const categoryLabels: Record<string, string> = {
  // Inglês
  accommodation: 'Hospedagem',
  food: 'Alimentação',
  fuel: 'Combustível',
  transport: 'Deslocamento',
  parking: 'Estacionamento',
  office_supplies: 'Material de Escritório',
  meal_voucher: 'Vale-Refeição',
  transport_voucher: 'Vale-Transporte',
  other: 'Outras Despesas',
  // Português (legado)
  hospedagem: 'Hospedagem',
  alimentacao: 'Alimentação',
  combustivel: 'Combustível',
  deslocamento: 'Deslocamento',
  estacionamento: 'Estacionamento',
  itens_escritorio: 'Itens de Escritório',
  vale_refeicao: 'Vale-Refeição',
  vale_transporte: 'Vale-Transporte',
  outras: 'Outras Despesas',
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category
}

// Labels de tipos de despesa (suporte a inglês e português)
const expenseTypeLabels: Record<string, string> = {
  // Inglês
  corporate_card: 'Cartão Corporativo',
  advance: 'Adiantamento',
  refund: 'Reembolso',
  reimbursement: 'Reembolso',
  mixed: 'Misto',
  // Português (legado)
  cartao_corporativo: 'Cartão Corporativo',
  adiantamento: 'Adiantamento',
  reembolso: 'Reembolso',
  misto: 'Misto',
}

export function getExpenseTypeLabel(type: string): string {
  return expenseTypeLabels[type] || type
}

// Labels de status (suporte a inglês e português)
const statusLabels: Record<string, string> = {
  // Inglês
  draft: 'Rascunho',
  pending: 'Pendente',
  submitted: 'Enviado',
  processed: 'Processada',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  correction: 'Correção',
  // Português (legado)
  rascunho: 'Rascunho',
  enviado: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

export function getStatusLabel(status: string): string {
  return statusLabels[status] || status
}

// Labels de nível de acesso
const roleLabels: Record<string, string> = {
  funcionario: 'Funcionário',
  gestor: 'Gestor',
  diretoria: 'Diretoria Financeira',
}

export function getRoleLabel(role: string): string {
  return roleLabels[role] || role
}

// Retorna o badge de status com a variante correta
import { Badge } from "@/components/ui/badge"
import React from "react"

export function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    // Inglês
    draft: "outline",
    pending: "secondary",
    submitted: "secondary",
    approved: "default",
    rejected: "destructive",
    correction: "outline",
    // Português (legado)
    rascunho: "outline",
    enviado: "secondary",
    aprovado: "default",
    rejeitado: "destructive",
  }
  
  const isApproved = status === "approved" || status === "aprovado"
  const isCorrection = status === "correction"
  
  let className = undefined
  if (isApproved) {
    className = "bg-success text-success-foreground"
  } else if (isCorrection) {
    className = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
  }
  
  return React.createElement(Badge, {
    variant: variants[status] || "outline",
    className,
  }, getStatusLabel(status))
}
