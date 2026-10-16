import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

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
      SELECT iar.*, u.name as employee_name, ci.reference_name as invoice_name
      FROM invoice_analysis_requests iar
      LEFT JOIN users u ON u.id = iar.employee_id
      LEFT JOIN card_invoices ci ON ci.id = iar.invoice_id
      WHERE iar.id = ${requestId}
    `

    if (analysisRequest.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const requestData = analysisRequest[0] as any

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
        SELECT id, description, amount FROM expenses WHERE id = ANY(${addedExpenses})
      `

      const expenseList = (expenseDescriptions as any[])
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

      auditClient.log({
        category: "finance",
        action: "card_invoice.expense_linked",
        severity: "INFO",
        actor: {
          type: "user",
          userId: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        targets: [
          {
            type: "invoice_analysis_request",
            id: String(requestId),
            label: requestData.subject,
          },
          {
            type: "card_invoice",
            id: String(requestData.invoice_id),
            label: requestData.invoice_name || `Fatura #${requestData.invoice_id}`,
          },
          {
            type: "user",
            id: String(requestData.employee_id),
            label: requestData.employee_name || `Colaborador #${requestData.employee_id}`,
          },
        ],
        context: getRequestContext(request),
        details: {
          invoice_id: requestData.invoice_id,
          invoice_name: requestData.invoice_name || null,
          employee_id: requestData.employee_id,
          employee_name: requestData.employee_name || null,
          added_expense_ids: addedExpenses,
          linked_expenses: (expenseDescriptions as any[]).map((e) => ({
            id: e.id,
            description: e.description,
            amount: Number(e.amount),
          })),
        },
      })
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

    const startDate = typeof requestData.start_date === 'string'
      ? requestData.start_date.split('T')[0]
      : (requestData.start_date instanceof Date ? requestData.start_date.toISOString().split('T')[0] : requestData.start_date)
    const endDate = typeof requestData.end_date === 'string'
      ? requestData.end_date.split('T')[0]
      : (requestData.end_date instanceof Date ? requestData.end_date.toISOString().split('T')[0] : requestData.end_date)

    const availableExpenses = await sql`
      SELECT e.*
      FROM expenses e
      WHERE e.user_id = ${requestData.employee_id}
        AND e.expense_type = 'corporate_card'
        AND e.expense_date >= ${startDate}::date
        AND e.expense_date <= ${endDate}::date
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
