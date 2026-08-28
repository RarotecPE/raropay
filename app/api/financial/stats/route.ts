import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    // Verificar se é financeiro
    if (!['financial', 'admin', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Data início do mês atual
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    // Remessas pendentes de análise (status enviado/pending)
    const pendingBatches = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(total_amount), 0)::numeric as total
      FROM expense_batches
      WHERE status IN ('pending', 'enviado', 'submitted')
    `
    
    // Contagem de despesas em remessas pendentes
    const pendingExpenses = await sql`
      SELECT COUNT(*)::int as count
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE eb.status IN ('pending', 'enviado', 'submitted')
    `

    // Remessas em correção
    const correctionBatches = await sql`
      SELECT COUNT(*)::int as count
      FROM expense_batches
      WHERE status = 'correction'
    `

    // Remessas aprovadas este mês
    const approvedBatches = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(total_amount), 0)::numeric as total
      FROM expense_batches
      WHERE status IN ('approved', 'aprovado')
      AND reviewed_at >= ${startOfMonth}
    `
    
    // Contagem de despesas em remessas aprovadas este mês
    const approvedExpenses = await sql`
      SELECT COUNT(*)::int as count
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE eb.status IN ('approved', 'aprovado')
      AND eb.reviewed_at >= ${startOfMonth}
    `

    // Remessas rejeitadas este mês
    const rejectedBatches = await sql`
      SELECT COUNT(*)::int as count
      FROM expense_batches
      WHERE status IN ('rejected', 'rejeitado')
      AND updated_at >= ${startOfMonth}
    `

    // Despesas de REEMBOLSO aprovadas aguardando pagamento
    const pendingPayment = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE e.status IN ('approved', 'aprovado')
      AND (e.paid = false OR e.paid IS NULL)
      AND eb.settlement_type = 'reimbursement'
    `
    
    // Remessas de REEMBOLSO aprovadas aguardando pagamento (com pelo menos 1 despesa não paga)
    const batchesPendingPayment = await sql`
      SELECT COUNT(DISTINCT eb.id)::int as count
      FROM expense_batches eb
      JOIN expenses e ON e.batch_id = eb.id
      WHERE eb.status IN ('approved', 'aprovado')
      AND (e.paid = false OR e.paid IS NULL)
      AND eb.settlement_type = 'reimbursement'
    `

    // Despesas de REEMBOLSO pagas este mês
    const paidThisMonth = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE e.paid = true
      AND e.paid_at >= ${startOfMonth}
      AND eb.settlement_type = 'reimbursement'
    `

    // Pendentes por tipo de pagamento - Reembolso
    const reimbursement = await sql`
      SELECT 
        COUNT(e.*)::int as count,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE e.status IN ('approved', 'aprovado')
      AND (e.paid = false OR e.paid IS NULL)
      AND eb.settlement_type = 'reimbursement'
    `

    // Pendentes por tipo de pagamento - Cartão Corporativo
    const corporateCard = await sql`
      SELECT 
        COUNT(e.*)::int as count,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE e.status IN ('approved', 'aprovado')
      AND (e.paid = false OR e.paid IS NULL)
      AND eb.settlement_type = 'corporate_card'
    `

    // Pendentes por tipo de pagamento - Adiantamento
    const advance = await sql`
      SELECT 
        COUNT(e.*)::int as count,
        COALESCE(SUM(e.amount), 0)::numeric as total
      FROM expenses e
      JOIN expense_batches eb ON e.batch_id = eb.id
      WHERE e.status IN ('approved', 'aprovado')
      AND (e.paid = false OR e.paid IS NULL)
      AND eb.settlement_type = 'advance'
    `

    // Funcionários com remessas pendentes
    const employeesWithPending = await sql`
      SELECT COUNT(DISTINCT user_id)::int as count
      FROM expense_batches
      WHERE status IN ('pending', 'enviado', 'submitted')
    `

    // Remessas recentes pendentes (com nome do usuário)
    const recentBatches = await sql`
      SELECT 
        eb.id,
        u.name as user_name,
        eb.status,
        eb.settlement_type,
        eb.total_amount,
        eb.created_at,
        (SELECT COUNT(*)::int FROM expenses WHERE batch_id = eb.id) as expense_count
      FROM expense_batches eb
      JOIN users u ON eb.user_id = u.id
      WHERE eb.status IN ('pending', 'enviado', 'submitted')
      ORDER BY eb.created_at DESC
      LIMIT 5
    `

    // Remessas de REEMBOLSO aprovadas que ainda NÃO foram pagas (pendentes de pagamento)
    const recentApproved = await sql`
      SELECT 
        eb.id,
        u.name as user_name,
        eb.settlement_type,
        eb.total_amount,
        eb.reviewed_at,
        false as is_paid
      FROM expense_batches eb
      JOIN users u ON eb.user_id = u.id
      WHERE eb.status IN ('approved', 'aprovado')
      AND eb.settlement_type = 'reimbursement'
      AND EXISTS (
        SELECT 1 FROM expenses e 
        WHERE e.batch_id = eb.id 
        AND (e.paid = false OR e.paid IS NULL)
      )
      ORDER BY eb.reviewed_at DESC
      LIMIT 5
    `

    return NextResponse.json({
      // Remessas
      batchesPendingAnalysis: pendingBatches[0]?.count || 0,
      batchesPendingAmount: parseFloat(pendingBatches[0]?.total) || 0,
      pendingExpensesCount: pendingExpenses[0]?.count || 0,
      batchesInCorrection: correctionBatches[0]?.count || 0,
      batchesApproved: approvedBatches[0]?.count || 0,
      batchesApprovedAmount: parseFloat(approvedBatches[0]?.total) || 0,
      approvedExpensesCount: approvedExpenses[0]?.count || 0,
      batchesRejected: rejectedBatches[0]?.count || 0,
      
      // Pagamentos
      batchesPendingPayment: batchesPendingPayment[0]?.count || 0,
      pendingPaymentAmount: parseFloat(pendingPayment[0]?.total) || 0,
      pendingPaymentCount: pendingPayment[0]?.count || 0,
      paidThisMonth: paidThisMonth[0]?.count || 0,
      paidThisMonthAmount: parseFloat(paidThisMonth[0]?.total) || 0,
      
      // Por tipo de pagamento
      reimbursementPending: reimbursement[0]?.count || 0,
      reimbursementAmount: parseFloat(reimbursement[0]?.total) || 0,
      corporateCardPending: corporateCard[0]?.count || 0,
      corporateCardAmount: parseFloat(corporateCard[0]?.total) || 0,
      advancePending: advance[0]?.count || 0,
      advanceAmount: parseFloat(advance[0]?.total) || 0,
      
      // Funcionários
      employeesWithPending: employeesWithPending[0]?.count || 0,
      
      // Listas
      recentBatches: recentBatches || [],
      recentApproved: recentApproved || [],
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas financeiras:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
