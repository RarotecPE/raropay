import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissão
    const allowedRoles = ['admin', 'financial', 'director']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const batchId = parseInt(id)

    // Verificar se a remessa existe e está aprovada
    const [batch] = await sql`
      SELECT * FROM expense_batches WHERE id = ${batchId}
    `

    if (!batch) {
      return NextResponse.json({ error: 'Remessa não encontrada' }, { status: 404 })
    }

    if (batch.status !== 'approved') {
      return NextResponse.json({ error: 'Remessa não está aprovada' }, { status: 400 })
    }

    // Marcar todas as despesas da remessa como pagas
    await sql`
      UPDATE expenses SET
        paid = true,
        paid_at = NOW(),
        paid_by = ${session.id},
        updated_at = NOW()
      WHERE batch_id = ${batchId}
    `

    // Registrar no histórico de cada despesa
    const expenses = await sql`
      SELECT id FROM expenses WHERE batch_id = ${batchId}
    `

    for (const expense of expenses) {
      await sql`
        INSERT INTO expense_history (expense_id, action, user_id, notes)
        VALUES (${expense.id}, 'Pagamento registrado (via remessa)', ${session.id}, 'Marcado como pago através da remessa')
      `
    }

    return NextResponse.json({ success: true, message: 'Remessa marcada como paga' })
  } catch (error) {
    console.error('Erro ao marcar remessa como paga:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
