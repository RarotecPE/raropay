export interface InvoicePeriodLike {
  id?: number
  reference_month: string
  start_date: string | Date
  end_date: string | Date
}

function toIsoDateString(val: string | Date): string {
  if (!val) return ''
  if (typeof val === 'string') {
    return val.split('T')[0]
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]
  }
  return String(val).split('T')[0]
}

/**
 * Soma N meses a uma competência no formato 'YYYY-MM'
 */
export function addMonthsToCompetence(competence: string, monthsToAdd: number): string {
  const parts = String(competence).split('-').map(Number)
  if (parts.length < 2 || parts.some(isNaN)) {
    return competence
  }
  const [year, month] = parts
  const targetDate = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1))
  const targetYear = targetDate.getUTCFullYear()
  const targetMonth = targetDate.getUTCMonth() + 1
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`
}

/**
 * Soma N meses a uma data ISO 'YYYY-MM-DD', ajustando para o último dia do mês quando necessário
 */
export function addMonthsToIsoDate(dateStr: string, monthsToAdd: number): string {
  const parts = String(dateStr).split('T')[0].split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return dateStr
  }
  const [year, month, day] = parts
  const targetDate = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1))
  const targetYear = targetDate.getUTCFullYear()
  const targetMonth = targetDate.getUTCMonth()
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDayOfTargetMonth)

  const yyyy = String(targetYear)
  const mm = String(targetMonth + 1).padStart(2, '0')
  const dd = String(targetDay).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Determina a competência inicial ('YYYY-MM') para a 1ª parcela de uma despesa:
 * 1. Verifica se a data da despesa está incluída em algum período (start_date <= data <= end_date)
 *    de alguma fatura existente. Caso exista, retorna a competência (reference_month) dessa fatura.
 * 2. Caso não exista, seleciona a competência natural da data da despesa (YYYY-MM).
 * 3. Se já existir uma fatura nesta competência mas de outro período (ou seja, que não englobou a data),
 *    define como a próxima competência (YYYY-MM + 1 mês).
 */
export function resolveInitialCompetence(
  expenseDate: string,
  existingInvoices: InvoicePeriodLike[] = []
): string {
  const expDateStr = toIsoDateString(expenseDate)
  if (!expDateStr || expDateStr.length < 7) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  // 1. Verificar se a data da despesa está incluída em algum período de fatura existente
  const matchingInvoice = existingInvoices.find((inv) => {
    const startStr = toIsoDateString(inv.start_date)
    const endStr = toIsoDateString(inv.end_date)
    return startStr && endStr && expDateStr >= startStr && expDateStr <= endStr
  })

  if (matchingInvoice && matchingInvoice.reference_month) {
    return matchingInvoice.reference_month
  }

  // 2. Caso não exista, seleciona a competência da data da despesa
  const defaultCompetence = expDateStr.slice(0, 7)

  // 3. Se já existir uma fatura nesta competência mas de outro período, defina como a próxima competência
  const hasInvoiceInSameCompetenceOtherPeriod = existingInvoices.some(
    (inv) => inv.reference_month === defaultCompetence
  )

  if (hasInvoiceInSameCompetenceOtherPeriod) {
    return addMonthsToCompetence(defaultCompetence, 1)
  }

  return defaultCompetence
}

/**
 * Extrai a competência ('YYYY-MM') armazenada em uma despesa, se existir
 */
export function extractExpenseCompetence(expense: any): string | null {
  if (!expense) return null
  if (typeof expense.competence === 'string' && expense.competence.trim()) {
    return expense.competence.trim()
  }
  const extra = expense.extra_expenses
  if (!extra) return null

  if (typeof extra === 'string') {
    try {
      const parsed = JSON.parse(extra)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.competence === 'string') {
        return parsed.competence
      }
    } catch {
      return null
    }
  } else if (typeof extra === 'object' && !Array.isArray(extra) && typeof extra.competence === 'string') {
    return extra.competence
  }

  return null
}

/**
 * Monta o objeto JSON de extra_expenses preservando itens de hospedagem (se houver) e gravando a competência
 */
export function buildExtraExpensesWithCompetence(extraExpenses: any, competence: string): any {
  if (!extraExpenses) {
    return { competence }
  }

  let parsed = extraExpenses
  if (typeof extraExpenses === 'string') {
    try {
      parsed = JSON.parse(extraExpenses)
    } catch {
      parsed = null
    }
  }

  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? { competence, items: parsed } : { competence }
  }

  if (parsed && typeof parsed === 'object') {
    return { ...parsed, competence }
  }

  return { competence }
}

/**
 * Formata uma competência 'YYYY-MM' para exibição amigável 'MM/YYYY'
 */
export function formatCompetence(competence: string | null | undefined): string {
  if (!competence) return ''
  const parts = String(competence).split('-')
  if (parts.length !== 2) return competence
  return `${parts[1]}/${parts[0]}`
}
