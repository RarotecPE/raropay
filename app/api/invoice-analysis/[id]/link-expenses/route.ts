import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getSession()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const requestId = parseInt(id)
    const analysisRequest = await sql`
      SELECT * FROM invoice_analysis_requests WHERE id = ${requestId}
    `

    if (analysisRequest.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const requestData = analysisRequest[0]

    if (requestData.requester_id !== user.id && user.role !== "admin" && user.role !== "financial") {
      return NextResponse.json({ error: "Sem permissão para adicionar despesas" }, { status: 403 })
    }

    const body = await request.json()
    const { expenses } = body as { expenses?: Array<{ expense_id: number; reason?: string | null }> }

    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return NextResponse.json({ error: "Nenhuma despesa selecionada" }, { status: 400 })
    }

    const addedExpenses: number[] = []
    for (const expense of expenses) {
      const existing = await sql`
        SELECT id FROM invoice_analysis_expenses
        WHERE request_id = ${requestId} AND expense_id = ${expense.expense_id}
      `

      if (existing.length === 0) {
        await sql`
          INSERT INTO invoice_analysis_expenses (request_id, expense_id, reason)
          VALUES (${requestId}, ${expense.expense_id}, ${expense.reason || null})
        `
        addedExpenses.push(expense.expense_id)
      }
    }

    if (addedExpenses.length > 0) {
      const expenseDescriptions = await sql`
        SELECT description, amount FROM expenses WHERE id = ANY(${addedExpenses})
      `

      const expenseList = expenseDescriptions
        .map((expense: { description: string; amount: number }) => `- ${expense.description} (R$ ${Number(expense.amount).toFixed(2)})`)
        .join("\n")

      const systemMessage = `Despesas adicionadas para revisão:\n${expenseList}`

      await sql`
        INSERT INTO invoice_analysis_messages (request_id, sender_id, message)
        VALUES (${requestId}, ${user.id}, ${systemMessage})
      `

      if (requestData.status === "pending") {
        await sql`
          UPDATE invoice_analysis_requests
          SET status = 'in_progress', updated_at = NOW()
          WHERE id = ${requestId}
        `
      }
    }

    return NextResponse.json({
      success: true,
      added_count: addedExpenses.length,
    })
  } catch (error) {
    console.error("Erro ao vincular despesas:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getSession()

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const requestId = parseInt(id)
    const analysisRequest = await sql`
      SELECT iar.*, ci.start_date, ci.end_date
      FROM invoice_analysis_requests iar
      JOIN card_invoices ci ON ci.id = iar.invoice_id
      WHERE iar.id = ${requestId}
    `

    if (analysisRequest.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const requestData = analysisRequest[0]

    if (requestData.requester_id !== user.id && user.role !== "admin" && user.role !== "financial") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const availableExpenses = await sql`
      SELECT e.*
      FROM expenses e
      WHERE e.user_id = ${requestData.employee_id}
        AND e.expense_type = 'corporate_card'
        AND e.expense_date >= ${requestData.start_date}
        AND e.expense_date <= ${requestData.end_date}
        AND e.id NOT IN (
          SELECT expense_id FROM invoice_analysis_expenses WHERE request_id = ${requestId}
        )
      ORDER BY e.expense_date DESC
    `

    return NextResponse.json(availableExpenses)
  } catch (error) {
    console.error("Erro ao buscar despesas disponíveis:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
