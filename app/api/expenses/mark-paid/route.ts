import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { auditClient, getRequestContext } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Apenas admin, financial e director podem marcar como pago
    const allowedRoles = ['admin', 'financial', 'director']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { expense_ids, paid = true } = await request.json()

    if (!expense_ids || !Array.isArray(expense_ids) || expense_ids.length === 0) {
      return NextResponse.json({ error: 'IDs de despesas não fornecidos' }, { status: 400 })
    }

    const targetExpenses = await sql`
      SELECT e.id, e.user_id, e.category, e.description, e.amount, e.paid, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = ANY(${expense_ids}::int[])
        AND e.status = 'approved'
    `

    if (paid) {
      // Marcar como pago
      await sql`
        UPDATE expenses
        SET paid = true, paid_at = NOW(), paid_by = ${session.id}
        WHERE id = ANY(${expense_ids}::int[])
          AND status = 'approved'
      `

      // Registrar no histórico
      for (const expenseId of expense_ids) {
        await sql`
          INSERT INTO expense_history (expense_id, action, user_id, new_status, notes)
          VALUES (${expenseId}, 'Despesa marcada como paga', ${session.id}, 'approved', 'Pagamento confirmado pelo financeiro')
        `
      }
    } else {
      // Desmarcar pagamento
      await sql`
        UPDATE expenses
        SET paid = false, paid_at = NULL, paid_by = NULL
        WHERE id = ANY(${expense_ids}::int[])
          AND status = 'approved'
      `

      // Registrar no histórico
      for (const expenseId of expense_ids) {
        await sql`
          INSERT INTO expense_history (expense_id, action, user_id, new_status, notes)
          VALUES (${expenseId}, 'Pagamento desmarcado', ${session.id}, 'approved', 'Pagamento removido pelo financeiro')
        `
      }
    }

    const totalAmount = (targetExpenses as any[]).reduce((acc, e) => acc + Number(e.amount || 0), 0)
    auditClient.log({
      category: 'finance',
      action: paid ? 'expense.marked_paid' : 'expense.payment_unmarked',
      severity: paid ? 'INFO' : 'WARNING',
      actor: {
        type: 'user',
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: (targetExpenses as any[]).map((e) => ({
        type: 'expense',
        id: String(e.id),
        label: `Despesa #${e.id} - ${e.user_name || `Usuário #${e.user_id}`} (R$ ${Number(e.amount).toFixed(2)})`,
      })),
      context: getRequestContext(request),
      diff: {
        before: { paid: !paid },
        after: { paid: Boolean(paid) },
      },
      details: {
        paid: Boolean(paid),
        count: targetExpenses.length,
        total_amount: totalAmount,
        expenses: (targetExpenses as any[]).map((e) => ({
          expense_id: e.id,
          user_id: e.user_id,
          user_name: e.user_name || null,
          category: e.category,
          description: e.description || null,
          amount: Number(e.amount),
        })),
      },
    })

    return NextResponse.json({ success: true, count: expense_ids.length })
  } catch (error) {
    console.error('[v0] Erro ao marcar despesas como pagas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
