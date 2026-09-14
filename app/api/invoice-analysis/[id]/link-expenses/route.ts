import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// POST - Vincular despesas para revisão
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Verificar se a solicitação existe
    const analysisRequest = await sql`
      SELECT * FROM invoice_analysis_requests WHERE id = ${parseInt(id)}
    `

    if (analysisRequest.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const request_data = analysisRequest[0]

    // Apenas o financeiro (requester) ou admin pode adicionar despesas
    if (request_data.requester_id !== user.id && user.role !== 'admin' && user.role !== 'financial') {
      return NextResponse.json({ error: "Sem permissão para adicionar despesas" }, { status: 403 })
    }

    const body = await request.json()
    const { expenses } = body // Array de { expense_id, reason }

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return NextResponse.json({ error: "Nenhuma despesa selecionada" }, { status: 400 })
    }

    // Vincular as despesas
    const addedExpenses: number[] = []
    for (const expense of expenses) {
      // Verificar se já não está vinculada
      const existing = await sql`
        SELECT id FROM invoice_analysis_expenses
        WHERE request_id = ${parseInt(id)} AND expense_id = ${expense.expense_id}
      `

      if (existing.length === 0) {
        await sql`
          INSERT INTO invoice_analysis_expenses (request_id, expense_id, reason)
          VALUES (${parseInt(id)}, ${expense.expense_id}, ${expense.reason || null})
        `
        addedExpenses.push(expense.expense_id)
      }
    }

    // Se adicionou alguma despesa, criar uma mensagem no chat informando
    if (addedExpenses.length > 0) {
      // Buscar descrições das despesas adicionadas
      const expenseDescriptions = await sql`
        SELECT description, amount FROM expenses WHERE id = ANY(${addedExpenses})
      `

      const expenseList = expenseDescriptions
        .map((e) => `• ${e.description} (R$ ${Number(e.amount).toFixed(2)})`)
        .join('\n')

      const systemMessage = `📋 **Despesas adicionadas para revisão:**\n${expenseList}`

      await sql`
        INSERT INTO invoice_analysis_messages (request_id, sender_id, message)
        VALUES (${parseInt(id)}, ${user.id}, ${systemMessage})
      `

      // Atualizar status para in_progress se ainda estava pending
      if (request_data.status === 'pending') {
        await sql`
          UPDATE invoice_analysis_requests
          SET status = 'in_progress', updated_at = NOW()
          WHERE id = ${parseInt(id)}
        `
      }
    }

    return NextResponse.json({
      success: true,
      added_count: addedExpenses.length
    })
  } catch (error) {
    console.error("Erro ao vincular despesas:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// GET - Buscar despesas disponíveis para vincular (do funcionário da solicitação)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params

    // Buscar a solicitação (com período da fatura)
    const analysisRequest = await sql`
      SELECT iar.*, ci.start_date, ci.end_date
      FROM invoice_analysis_requests iar
      JOIN card_invoices ci ON ci.id = iar.invoice_id
      WHERE iar.id = ${parseInt(id)}
    `

    if (analysisRequest.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const request_data = analysisRequest[0]

    // Apenas o financeiro (requester) ou admin pode listar despesas para adicionar
    if (request_data.requester_id !== user.id && user.role !== 'admin' && user.role !== 'financial') {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar despesas do funcionário no período da fatura que ainda não estão vinculadas
    const availableExpenses = await sql`
      SELECT e.*
      FROM expenses e
      WHERE e.user_id = ${request_data.employee_id}
        AND e.expense_type = 'corporate_card'
        AND e.expense_date >= ${request_data.start_date}
        AND e.expense_date <= ${request_data.end_date}
        AND e.id NOT IN (
          SELECT expense_id FROM invoice_analysis_expenses WHERE request_id = ${parseInt(id)}
        )
      ORDER BY e.expense_date DESC
    `

    return NextResponse.json(availableExpenses)
  } catch (error) {
    console.error("Erro ao buscar despesas disponíveis:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
