// Constantes compartilhadas do fluxo de Adiantamentos

export const ADVANCE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  clarification: "Esclarecimento",
}

// Classes de cor (tokens semânticos) para os badges de status
export const ADVANCE_STATUS_CLASSES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
  rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60",
  clarification: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
}

// Tipos de despesa disponíveis para o adiantamento (categorias existentes do sistema)
export const ADVANCE_CATEGORIES: { value: string; label: string }[] = [
  { value: "accommodation", label: "Hospedagem" },
  { value: "food", label: "Alimentação" },
  { value: "fuel", label: "Combustível" },
  { value: "transport", label: "Deslocamento" },
  { value: "parking", label: "Estacionamento" },
  { value: "office_supplies", label: "Material de Escritório" },
  { value: "other", label: "Outras Despesas" },
]

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  bank_account: "Conta-Corrente (Banco do Brasil)",
  boleto: "Boleto",
}

// Chave da configuração (app_settings) que habilita o PIX nos adiantamentos
export const SETTING_ADVANCE_PIX_ENABLED = "advance_pix_enabled"
