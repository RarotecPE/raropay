import { sql } from '@/lib/db'
import { getSetting, setSetting } from '@/lib/settings'
import { formatCurrency } from '@/lib/format'
import type { SessionUser } from '@/lib/auth'

export interface NotificationItem {
  id: string
  type:
    | 'correction'
    | 'advance_clarification'
    | 'advance_status'
    | 'batch_status'
    | 'invoice_alert'
    | 'advance_pending'
    | 'batch_pending'
    | 'invoice_revision'
  title: string
  message: string
  link: string
  category: 'actionable' | 'event'
  badgeText: string
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'amber' | 'emerald' | 'blue'
  isRead: boolean
  createdAt: string
}

interface UserReadState {
  lastReadAt: string | null
  readIds: string[]
}

/**
 * Lê o estado de leitura de notificações do usuário a partir da tabela app_settings.
 */
async function getUserReadState(userId: number): Promise<UserReadState> {
  try {
    const raw = await getSetting(`notifications_read_user_${userId}`)
    if (!raw) {
      return { lastReadAt: null, readIds: [] }
    }
    const parsed = JSON.parse(raw)
    return {
      lastReadAt: parsed.lastReadAt || null,
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
    }
  } catch {
    return { lastReadAt: null, readIds: [] }
  }
}

/**
 * Salva o estado de leitura do usuário.
 */
async function saveUserReadState(userId: number, state: UserReadState): Promise<void> {
  try {
    // Mantém no máximo os últimos 200 IDs lidos para evitar tamanho excessivo
    const trimmedIds = state.readIds.slice(-200)
    await setSetting(
      `notifications_read_user_${userId}`,
      JSON.stringify({
        lastReadAt: state.lastReadAt,
        readIds: trimmedIds,
      }),
      userId
    )
  } catch (error) {
    console.error('[notifications] Erro ao salvar estado de leitura:', error)
  }
}

/**
 * Marca um item específico como lido para o usuário.
 */
export async function markNotificationAsRead(userId: number, notificationId: string): Promise<void> {
  const state = await getUserReadState(userId)
  if (!state.readIds.includes(notificationId)) {
    state.readIds.push(notificationId)
    await saveUserReadState(userId, state)
  }
}

/**
 * Marca todas as notificações atuais como lidas.
 */
export async function markAllNotificationsAsRead(userId: number, currentIds: string[]): Promise<void> {
  const state = await getUserReadState(userId)
  const allIds = Array.from(new Set([...state.readIds, ...currentIds]))
  await saveUserReadState(userId, {
    lastReadAt: new Date().toISOString(),
    readIds: allIds,
  })
}

/**
 * Coleta todas as notificações (pendências ativas + eventos de desfecho) para o usuário.
 */
export async function getNotificationsForUser(user: SessionUser): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
  actionableCount: number
}> {
  const readState = await getUserReadState(user.id)
  const items: NotificationItem[] = []

  const isFinancialOrAdmin = ['financial', 'admin', 'director'].includes(user.role)
  const isManagerOrCoord = ['manager', 'coordinator'].includes(user.role)

  // ==========================================
  // NOTIFICAÇÕES PESSOAIS DO USUÁRIO
  // ==========================================

  // 1.1 Despesas em Correção (Solicitação de ajuste direcionada ao usuário)
  const correctionExpenses = (await sql`
    SELECT id, description, amount, updated_at
    FROM expenses
    WHERE user_id = ${user.id} AND status = 'correction'
    ORDER BY updated_at DESC
    LIMIT 10
  `) as any[]

  for (const exp of correctionExpenses) {
    const id = `exp-correction-${exp.id}`
    const isRead = readState.readIds.includes(id) || (readState.lastReadAt ? new Date(exp.updated_at) <= new Date(readState.lastReadAt) : false)
    items.push({
      id,
      type: 'correction',
      title: 'Despesa para Correção',
      message: `${exp.description ? `"${exp.description}"` : 'Despesa'} (${formatCurrency(Number(exp.amount))}) precisa de ajuste solicitado pelo financeiro.`,
      link: '/expenses/corrections',
      category: 'actionable',
      badgeText: 'Correção',
      badgeVariant: 'destructive',
      isRead,
      createdAt: exp.updated_at ? new Date(exp.updated_at).toISOString() : new Date().toISOString(),
    })
  }

  // 1.2 Dúvida / Esclarecimento em Adiantamento (Solicitação direcionada ao usuário)
  const clarificationAdvances = (await sql`
    SELECT id, amount, review_note, updated_at
    FROM advance_requests
    WHERE user_id = ${user.id} AND status = 'clarification'
    ORDER BY updated_at DESC
    LIMIT 10
  `) as any[]

  for (const adv of clarificationAdvances) {
    const id = `adv-clarification-${adv.id}`
    const isRead = readState.readIds.includes(id) || (readState.lastReadAt ? new Date(adv.updated_at) <= new Date(readState.lastReadAt) : false)
    items.push({
      id,
      type: 'advance_clarification',
      title: 'Esclarecimento em Adiantamento',
      message: `Adiantamento de ${formatCurrency(Number(adv.amount))}: "${adv.review_note || 'O financeiro solicitou detalhes.'}"`,
      link: `/advances/${adv.id}`,
      category: 'actionable',
      badgeText: 'Dúvida',
      badgeVariant: 'amber',
      isRead,
      createdAt: adv.updated_at ? new Date(adv.updated_at).toISOString() : new Date().toISOString(),
    })
  }

  // 1.3 Desfecho de Adiantamento - Aprovado ou Rejeitado (Últimos 30 dias)
  const finishedAdvances = (await sql`
    SELECT id, amount, status, review_note, updated_at
    FROM advance_requests
    WHERE user_id = ${user.id}
      AND status IN ('approved', 'rejected')
      AND updated_at >= NOW() - INTERVAL '30 days'
    ORDER BY updated_at DESC
    LIMIT 10
  `) as any[]

  for (const adv of finishedAdvances) {
    const id = `adv-status-${adv.id}-${adv.status}`
    const isRead = readState.readIds.includes(id) || (readState.lastReadAt ? new Date(adv.updated_at) <= new Date(readState.lastReadAt) : false)

    // Se já foi lida, não exibe mais no sino (marcar como lida faz a mensagem sumir)
    if (isRead) continue

    const isApproved = adv.status === 'approved'
    items.push({
      id,
      type: 'advance_status',
      title: isApproved ? 'Adiantamento Aprovado' : 'Adiantamento Rejeitado',
      message: isApproved
        ? `Sua solicitação de ${formatCurrency(Number(adv.amount))} foi aprovada pelo financeiro.`
        : `Sua solicitação de ${formatCurrency(Number(adv.amount))} foi rejeitada${adv.review_note ? `: "${adv.review_note}"` : '.'}`,
      link: `/advances/${adv.id}`,
      category: 'event',
      badgeText: isApproved ? 'Aprovado' : 'Rejeitado',
      badgeVariant: isApproved ? 'emerald' : 'destructive',
      isRead: false,
      createdAt: adv.updated_at ? new Date(adv.updated_at).toISOString() : new Date().toISOString(),
    })
  }

  // 1.4 Desfecho de Prestações de Contas / Remessas (Aprovada ou Rejeitada - Últimos 30 dias)
  const batchEvents = (await sql`
    SELECT 
      eb.id, 
      COALESCE(
        (SELECT SUM(e.amount) FROM expenses e WHERE e.batch_id = eb.id),
        eb.total_amount,
        0
      ) as total_amount, 
      eb.status, 
      eb.updated_at
    FROM expense_batches eb
    WHERE eb.user_id = ${user.id}
      AND eb.status IN ('approved', 'rejected')
      AND eb.updated_at >= NOW() - INTERVAL '30 days'
    ORDER BY eb.updated_at DESC
    LIMIT 10
  `) as any[]

  for (const batch of batchEvents) {
    const id = `batch-status-${batch.id}-${batch.status}`
    const isRead = readState.readIds.includes(id) || (readState.lastReadAt ? new Date(batch.updated_at) <= new Date(readState.lastReadAt) : false)

    // Se já foi lida, não exibe mais no sino (marcar como lida faz a mensagem sumir)
    if (isRead) continue

    const isApproved = batch.status === 'approved'
    const title = isApproved ? 'Prestação de Contas Aprovada' : 'Prestação de Contas Rejeitada'
    const badgeText = isApproved ? 'Aprovada' : 'Rejeitada'
    const badgeVariant: NotificationItem['badgeVariant'] = isApproved ? 'emerald' : 'destructive'

    items.push({
      id,
      type: 'batch_status',
      title,
      message: `Remessa #${batch.id} (${formatCurrency(Number(batch.total_amount))}) teve o status atualizado.`,
      link: '/expenses/batches',
      category: 'event',
      badgeText,
      badgeVariant,
      isRead: false,
      createdAt: batch.updated_at ? new Date(batch.updated_at).toISOString() : new Date().toISOString(),
    })
  }

  // ==========================================
  // 2. NOTIFICAÇÕES OPERACIONAIS (GESTÃO E FINANCEIRO)
  // ==========================================
  if (isFinancialOrAdmin || isManagerOrCoord) {
    const deptFilter = isFinancialOrAdmin ? null : user.department

    // 2.1 Adiantamentos Pendentes de Análise (Ação operacional)
    const pendingAdvances = (await sql`
      SELECT ar.id, ar.amount, ar.reason, ar.created_at, u.name as employee_name, u.department
      FROM advance_requests ar
      JOIN users u ON u.id = ar.user_id
      WHERE ar.status = 'pending'
        AND (${deptFilter}::text IS NULL OR u.department = ${deptFilter})
      ORDER BY ar.created_at DESC
      LIMIT 10
    `) as any[]

    for (const adv of pendingAdvances) {
      const id = `manage-adv-pending-${adv.id}`
      items.push({
        id,
        type: 'advance_pending',
        title: 'Adiantamento para Análise',
        message: `${adv.employee_name}: ${formatCurrency(Number(adv.amount))} - ${adv.reason || 'Sem motivo'}`,
        link: '/advances/manage',
        category: 'actionable',
        badgeText: 'Adiantamento',
        badgeVariant: 'amber',
        isRead: false,
        createdAt: adv.created_at ? new Date(adv.created_at).toISOString() : new Date().toISOString(),
      })
    }

    // 2.2 Prestações de Contas / Remessas Enviadas para Conferência (Ação operacional)
    const pendingBatches = (await sql`
      SELECT 
        eb.id, 
        COALESCE(
          (SELECT SUM(e.amount) FROM expenses e WHERE e.batch_id = eb.id),
          eb.total_amount,
          0
        ) as total_amount, 
        COALESCE(eb.updated_at, eb.created_at) as notification_date,
        u.name as employee_name, 
        u.department
      FROM expense_batches eb
      JOIN users u ON u.id = eb.user_id
      WHERE eb.status = 'pending'
        AND (${deptFilter}::text IS NULL OR u.department = ${deptFilter})
      ORDER BY COALESCE(eb.updated_at, eb.created_at) DESC
      LIMIT 10
    `) as any[]

    for (const b of pendingBatches) {
      const id = `manage-batch-pending-${b.id}`
      items.push({
        id,
        type: 'batch_pending',
        title: 'Nova Prestação de Contas',
        message: `${b.employee_name}: Remessa #${b.id} (${formatCurrency(Number(b.total_amount))}) aguardando conferência.`,
        link: '/analysis',
        category: 'actionable',
        badgeText: 'Remessa',
        badgeVariant: 'blue',
        isRead: false,
        createdAt: b.notification_date ? new Date(b.notification_date).toISOString() : new Date().toISOString(),
      })
    }

    // 2.3 Solicitações de Revisão de Fatura de Cartão (Ação operacional)
    try {
      const pendingRevisions = (await sql`
        SELECT iar.id, iar.status, iar.created_at, u.name as employee_name, u.department
        FROM invoice_analysis_requests iar
        JOIN users u ON u.id = iar.user_id
        WHERE iar.status IN ('pending', 'in_progress')
          AND (${deptFilter}::text IS NULL OR u.department = ${deptFilter})
        ORDER BY iar.created_at DESC
        LIMIT 5
      `) as any[]

      for (const rev of pendingRevisions) {
        const id = `manage-invoice-rev-${rev.id}`
        items.push({
          id,
          type: 'invoice_revision',
          title: 'Revisão de Fatura de Cartão',
          message: `${rev.employee_name} solicitou análise/revisão em despesas de fatura corporativa.`,
          link: '/card-invoices',
          category: 'actionable',
          badgeText: 'Fatura',
          badgeVariant: 'secondary',
          isRead: false,
          createdAt: rev.created_at ? new Date(rev.created_at).toISOString() : new Date().toISOString(),
        })
      }
    } catch {
      // Ignora caso a tabela não exista em algum ambiente
    }
  }

  // Ordena por data (mais recentes primeiro)
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Calcula totais
  const unreadCount = items.filter((item) => !item.isRead).length
  const actionableCount = items.filter((item) => item.category === 'actionable').length

  return {
    notifications: items,
    unreadCount,
    actionableCount,
  }
}



