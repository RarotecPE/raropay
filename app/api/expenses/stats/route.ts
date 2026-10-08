import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canViewAllExpenses } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = session.id
    const canViewAll = canViewAllExpenses(session.role)
    const isFinanceiro = session.role === 'financial' || session.role === 'admin'
    
    // Buscar contagens por status (despesas individuais)
    // IMPORTANTE: total_approved e total_amount devem usar o mesmo filtro de data (mês atual)
    const statsQuery = canViewAll
      ? sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'draft' AND user_id = ${userId}) as total_drafts,
          COUNT(*) FILTER (WHERE status IN ('pending', 'submitted', 'analysis')) as total_pending,
          COUNT(*) FILTER (WHERE status = 'approved' AND expense_date >= date_trunc('month', CURRENT_DATE)) as total_approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
          COUNT(*) FILTER (WHERE status = 'processed' AND batch_id IS NULL) as ready_to_send,
          COUNT(*) FILTER (WHERE status = 'correction') as total_correction,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND expense_date >= date_trunc('month', CURRENT_DATE)), 0) as total_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'processed' AND batch_id IS NULL), 0) as ready_to_send_amount
        FROM expenses
      `
      : sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'draft') as total_drafts,
          COUNT(*) FILTER (WHERE status IN ('pending', 'submitted', 'analysis')) as total_pending,
          COUNT(*) FILTER (WHERE status = 'approved' AND expense_date >= date_trunc('month', CURRENT_DATE)) as total_approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as total_rejected,
          COUNT(*) FILTER (WHERE status = 'processed' AND batch_id IS NULL) as ready_to_send,
          COUNT(*) FILTER (WHERE status = 'correction') as total_correction,
          COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND expense_date >= date_trunc('month', CURRENT_DATE)), 0) as total_amount,
          COALESCE(SUM(amount) FILTER (WHERE status = 'processed' AND batch_id IS NULL), 0) as ready_to_send_amount
        FROM expenses
        WHERE user_id = ${userId}
      `

    const stats = await statsQuery

    // Buscar estatísticas de remessas do usuário
    const batchStatsQuery = canViewAll
      ? sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as batches_pending,
          COUNT(*) FILTER (WHERE status = 'approved') as batches_approved,
          COUNT(*) FILTER (WHERE status = 'correction') as batches_correction
        FROM expense_batches
      `
      : sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as batches_pending,
          COUNT(*) FILTER (WHERE status = 'approved') as batches_approved,
          COUNT(*) FILTER (WHERE status = 'correction') as batches_correction
        FROM expense_batches
        WHERE user_id = ${userId}
      `
    
    const batchStats = await batchStatsQuery

    // Para financeiro: buscar remessas pendentes de análise
    let pendingBatchesForAnalysis = 0
    let pendingBatchesAmount = 0
    if (isFinanceiro) {
      const pendingBatches = await sql`
        SELECT 
          COUNT(*) as count,
          COALESCE(SUM(total_amount), 0) as total
        FROM expense_batches
        WHERE status = 'pending'
      `
      pendingBatchesForAnalysis = parseInt(pendingBatches[0].count) || 0
      pendingBatchesAmount = parseFloat(pendingBatches[0].total) || 0
    }

    // Buscar despesas recentes
    const recentQuery = canViewAll
      ? sql`
        SELECT e.*, u.name as user_name
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        ORDER BY e.created_at DESC
        LIMIT 5
      `
      : sql`
        SELECT * FROM expenses
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 5
      `

    const recentExpenses = await recentQuery

    // Buscar remessas recentes do usuário
    const recentBatchesQuery = sql`
      SELECT 
        b.*,
        COUNT(e.id) as expense_count
      FROM expense_batches b
      LEFT JOIN expenses e ON e.batch_id = b.id
      WHERE b.user_id = ${userId}
      GROUP BY b.id
      ORDER BY b.created_at DESC
      LIMIT 3
    `
    const recentBatches = await recentBatchesQuery

    return NextResponse.json({
      totalDrafts: parseInt(stats[0].total_drafts) || 0,
      totalPending: parseInt(stats[0].total_pending) || 0,
      totalApproved: parseInt(stats[0].total_approved) || 0,
      totalRejected: parseInt(stats[0].total_rejected) || 0,
      totalCorrection: parseInt(stats[0].total_correction) || 0,
      readyToSend: parseInt(stats[0].ready_to_send) || 0,
      readyToSendAmount: parseFloat(stats[0].ready_to_send_amount) || 0,
      totalAmount: parseFloat(stats[0].total_amount) || 0,
      batchesPending: parseInt(batchStats[0].batches_pending) || 0,
      batchesApproved: parseInt(batchStats[0].batches_approved) || 0,
      batchesCorrection: parseInt(batchStats[0].batches_correction) || 0,
      pendingBatchesForAnalysis,
      pendingBatchesAmount,
      isFinanceiro,
      recentExpenses,
      recentBatches,
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
