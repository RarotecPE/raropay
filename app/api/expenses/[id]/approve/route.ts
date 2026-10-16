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
      return NextResponse.json({ error: 'Sem permissão para aprovar despesas' }, { status: 403 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

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
        { error: 'Apenas despesas pendentes, enviadas ou em análise podem ser aprovadas' },
        { status: 400 }
      )
    }

    // Não pode aprovar a própria despesa
    if (expense.user_id === session.id) {
      return NextResponse.json(
        { error: 'Você não pode aprovar suas próprias despesas' },
        { status: 400 }
      )
    }

    // Atualizar despesa
    const result = await sql`
      UPDATE expenses SET
        status = 'approved',
        approved_by = ${session.id},
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${expenseId}
      RETURNING *
    `

    // Registrar no histórico
    await sql`
      INSERT INTO expense_history (expense_id, action, user_id, previous_status, new_status)
      VALUES (${expenseId}, 'Despesa aprovada', ${session.id}, ${expense.status}, 'approved')
    `

    const ownerName = String(expense.user_name || `Usuário #${expense.user_id}`)
    const { auditClient, getRequestContext } = await import('@/lib/audit')
    auditClient.log({
      category: 'finance',
      action: 'expense.approved',
      severity: 'INFO',
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
        before: { status: expense.status },
        after: { status: 'approved' },
      },
      details: {
        expense_id: expenseId,
        user_id: expense.user_id,
        user_name: ownerName,
        category: expense.category,
        description: expense.description ?? null,
        amount: Number(expense.amount),
        previous_status: expense.status,
        new_status: 'approved',
      },
    })

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Erro ao aprovar despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
