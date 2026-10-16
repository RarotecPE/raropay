import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canApproveExpenses } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!canApproveExpenses(session.role)) {
      return NextResponse.json({ error: 'Sem permissão para rejeitar despesas' }, { status: 403 })
    }

    const { id } = await params
    const expenseId = parseInt(id)
    const { reason } = await request.json()

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Motivo da rejeição é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a despesa existe e está pendente
    const existing = await sql`
      SELECT e.*, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = ${expenseId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = existing[0]

    if (!['pending', 'analysis', 'submitted'].includes(expense.status)) {
      return NextResponse.json(
        { error: 'Apenas despesas pendentes, enviadas ou em análise podem ser rejeitadas' },
        { status: 400 }
      )
    }

    // Atualizar despesa - SAI da remessa (batch_id = NULL)
    // Guardar original_batch_id para histórico
    const result = await sql`
      UPDATE expenses SET
        status = 'rejected',
        rejection_reason = ${reason.trim()},
        approved_by = ${session.id},
        approved_at = NOW(),
        updated_at = NOW(),
        original_batch_id = COALESCE(original_batch_id, batch_id),
        batch_id = NULL
      WHERE id = ${expenseId}
      RETURNING *
    `

    // Registrar no histórico
    await sql`
      INSERT INTO expense_history (expense_id, action, user_id, previous_status, new_status, notes)
      VALUES (${expenseId}, 'Despesa rejeitada', ${session.id}, ${expense.status}, 'rejected', ${reason.trim()})
    `

    // Atualizar status da remessa se necessário
    if (expense.batch_id) {
      const statusCounts = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('pending', 'submitted')) as pending_count,
          COUNT(*) FILTER (WHERE status = 'correction') as correction_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) as total_count
        FROM expenses 
        WHERE batch_id = ${expense.batch_id}
      `
      
      const counts = statusCounts[0]
      const pendingCount = parseInt(counts.pending_count)
      const correctionCount = parseInt(counts.correction_count)
      const approvedCount = parseInt(counts.approved_count)
      const totalCount = parseInt(counts.total_count)
      
      if (totalCount === 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'rejected',
            total_amount = 0,
            reviewed_by = ${session.id},
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else if (pendingCount === 0 && correctionCount === 0 && approvedCount > 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'approved',
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            reviewed_by = ${session.id},
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else if (correctionCount > 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'correction',
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else {
        await sql`
          UPDATE expense_batches SET
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      }
    }

    const ownerName = String(expense.user_name || `Usuário #${expense.user_id}`)
    const { auditClient, getRequestContext } = await import('@/lib/audit')
    auditClient.log({
      category: 'finance',
      action: 'expense.rejected',
      severity: 'WARNING',
      actor: {
        type: 'user',
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        {
          type: 'expense',
          id: String(expenseId),
          label: `Despesa #${expenseId} - ${ownerName} (R$ ${Number(expense.amount).toFixed(2)})`,
        },
        {
          type: 'user',
          id: String(expense.user_id),
          label: ownerName,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          status: expense.status,
          rejection_reason: expense.rejection_reason ?? null,
        },
        after: {
          status: 'rejected',
          rejection_reason: reason.trim(),
        },
      },
      details: {
        expense_id: expenseId,
        user_id: expense.user_id,
        user_name: ownerName,
        category: expense.category,
        description: expense.description ?? null,
        amount: Number(expense.amount),
        previous_status: expense.status,
        new_status: 'rejected',
        rejection_reason: reason.trim(),
      },
    })

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Erro ao rejeitar despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
