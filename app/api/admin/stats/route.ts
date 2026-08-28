import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    // Verificar se é admin ou director
    if (!['admin', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Data início do mês atual
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    // Total de usuários
    const totalUsers = await sql`
      SELECT COUNT(*)::int as count
      FROM users
    `

    // Usuários ativos (que fizeram despesa nos últimos 30 dias)
    const activeUsers = await sql`
      SELECT COUNT(DISTINCT user_id)::int as count
      FROM expenses
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `

    // Usuários por role
    const usersByRole = await sql`
      SELECT role, COUNT(*)::int as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `

    // Remessas pendentes de análise
    const pendingBatches = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(total_amount), 0)::numeric as total
      FROM expense_batches
      WHERE status IN ('pending', 'enviado', 'submitted')
    `

    // Remessas em correção
    const correctionBatches = await sql`
      SELECT COUNT(*)::int as count
      FROM expense_batches
      WHERE status = 'correction'
    `

    // Remessas aprovadas este mês (usando reviewed_at)
    const approvedBatches = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(total_amount), 0)::numeric as total
      FROM expense_batches
      WHERE status IN ('approved', 'aprovado')
      AND reviewed_at >= ${startOfMonth}
    `

    // Remessas rejeitadas este mês
    const rejectedBatches = await sql`
      SELECT COUNT(*)::int as count
      FROM expense_batches
      WHERE status IN ('rejected', 'rejeitado')
      AND updated_at >= ${startOfMonth}
    `

    // Total de despesas no sistema
    const totalExpenses = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::numeric as total
      FROM expenses
    `

    // Despesas aprovadas aguardando pagamento (usando paid)
    const pendingPayment = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::numeric as total
      FROM expenses
      WHERE status IN ('approved', 'aprovado')
      AND (paid = false OR paid IS NULL)
    `

    // Despesas pagas este mês (usando paid)
    const paidThisMonth = await sql`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::numeric as total
      FROM expenses
      WHERE paid = true
      AND paid_at >= ${startOfMonth}
    `

    // Usuários recentes
    const recentUsers = await sql`
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `

    // Converter usersByRole para objeto
    const usersByRoleObj: Record<string, number> = {}
    usersByRole.forEach((row: { role: string, count: number }) => {
      usersByRoleObj[row.role] = row.count
    })

    return NextResponse.json({
      // Usuários
      totalUsers: totalUsers[0]?.count || 0,
      activeUsers: activeUsers[0]?.count || 0,
      usersByRole: usersByRoleObj,
      
      // Remessas
      batchesPendingAnalysis: pendingBatches[0]?.count || 0,
      batchesPendingAmount: parseFloat(pendingBatches[0]?.total) || 0,
      batchesInCorrection: correctionBatches[0]?.count || 0,
      batchesApprovedMonth: approvedBatches[0]?.count || 0,
      batchesApprovedAmount: parseFloat(approvedBatches[0]?.total) || 0,
      batchesRejectedMonth: rejectedBatches[0]?.count || 0,
      
      // Despesas
      totalExpenses: totalExpenses[0]?.count || 0,
      totalExpensesAmount: parseFloat(totalExpenses[0]?.total) || 0,
      
      // Pagamentos
      pendingPaymentCount: pendingPayment[0]?.count || 0,
      pendingPaymentAmount: parseFloat(pendingPayment[0]?.total) || 0,
      paidThisMonth: paidThisMonth[0]?.count || 0,
      paidThisMonthAmount: parseFloat(paidThisMonth[0]?.total) || 0,
      
      // Listas
      recentUsers: recentUsers || [],
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas admin:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
