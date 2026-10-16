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
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Apenas admin, financeiro ou diretor podem desaprovar
    if (!['admin', 'financial', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

    if (isNaN(expenseId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })
    }

    // Verificar se a despesa existe e está aprovada
    const expenseResult = await sql`
      SELECT e.*, eb.settlement_type as batch_settlement_type, u.name as user_name
      FROM expenses e
      LEFT JOIN expense_batches eb ON e.batch_id = eb.id
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = ${expenseId}
    `

    if (expenseResult.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = expenseResult[0]
    console.log('[v0] Despesa encontrada:', { id: expense.id, status: expense.status, batch_id: expense.batch_id })

    // Status "processed" ou "Processada" também é considerado aprovado (despesas processadas em faturas de cartão)
    const approvedStatuses = ['approved', 'aprovado', 'processed', 'Processada']
    if (!approvedStatuses.includes(expense.status)) {
      return NextResponse.json({ error: 'Despesa não está aprovada' }, { status: 400 })
    }

    // Verificar se já foi paga (apenas para reembolsos - cartão corporativo e adiantamento não têm controle de pagamento)
    const settlementType = expense.batch_settlement_type || expense.expense_type
    if (settlementType === 'reimbursement' && expense.paid) {
      return NextResponse.json({ error: 'Não é possível desaprovar uma despesa de reembolso que já foi paga' }, { status: 400 })
    }

    // Atualizar status da despesa para "pending" (volta para análise do financeiro)
    // A despesa permanece vinculada à remessa
    await sql`
      UPDATE expenses 
      SET 
        status = 'pending',
        unapproved_at = NOW(),
        unapproved_by = ${session.id},
        unapproval_reason = ${reason.trim()},
        updated_at = NOW()
      WHERE id = ${expenseId}
    `

    // Voltar o status da remessa para "pending" para aparecer na tela de análise
    if (expense.batch_id) {
      await sql`
        UPDATE expense_batches
        SET 
          status = 'pending',
          updated_at = NOW()
        WHERE id = ${expense.batch_id}
      `
    }

    const ownerName = String(expense.user_name || `Usuário #${expense.user_id}`)
    const { auditClient, getRequestContext } = await import('@/lib/audit')
    auditClient.log({
      category: 'finance',
      action: 'expense.unapproved',
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
          unapproval_reason: expense.unapproval_reason ?? null,
        },
        after: {
          status: 'pending',
          unapproval_reason: reason.trim(),
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
        new_status: 'pending',
        unapproval_reason: reason.trim(),
      },
    })

    return NextResponse.json({ 
      success: true,
      message: 'Despesa desaprovada e enviada para análise'
    })
  } catch (error: unknown) {
    console.error('Erro ao desaprovar despesa:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: 'Erro interno do servidor', details: errorMessage }, { status: 500 })
  }
}
