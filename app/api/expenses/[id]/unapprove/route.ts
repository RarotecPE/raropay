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
      SELECT e.*, eb.settlement_type as batch_settlement_type
      FROM expenses e
      LEFT JOIN expense_batches eb ON e.batch_id = eb.id
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
    console.log('[v0] Verificando batch_id para atualizar remessa:', expense.batch_id)
    if (expense.batch_id) {
      console.log('[v0] Atualizando remessa para pending:', expense.batch_id)
      await sql`
        UPDATE expense_batches
        SET 
          status = 'pending',
          updated_at = NOW()
        WHERE id = ${expense.batch_id}
      `
      console.log('[v0] Remessa atualizada com sucesso')
    } else {
      console.log('[v0] Despesa não tem batch_id, remessa não será atualizada')
    }

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
