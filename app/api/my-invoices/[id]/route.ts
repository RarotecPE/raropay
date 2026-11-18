import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Detalhes da fatura com despesas do funcionário
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

    // Buscar dados da fatura
    const invoices = await sql`
      SELECT * FROM card_invoices WHERE id = ${parseInt(id)}
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }

    const invoice = invoices[0]
    const startDate = typeof invoice.start_date === 'string'
      ? invoice.start_date.split('T')[0]
      : (invoice.start_date instanceof Date ? invoice.start_date.toISOString().split('T')[0] : invoice.start_date)
    const endDate = typeof invoice.end_date === 'string'
      ? invoice.end_date.split('T')[0]
      : (invoice.end_date instanceof Date ? invoice.end_date.toISOString().split('T')[0] : invoice.end_date)

    const referenceMonth = invoice.reference_month

    // Buscar despesas do funcionário por competência ou período da fatura
    const expenses = await sql`
      SELECT *
      FROM expenses e
      WHERE e.user_id = ${user.id}
        AND e.expense_type = 'corporate_card'
        AND (
          e.extra_expenses->>'competence' = ${referenceMonth}
          OR (
            e.extra_expenses->>'competence' IS NULL
            AND e.expense_date >= ${startDate}::date
            AND e.expense_date <= ${endDate}::date
          )
        )
      ORDER BY e.expense_date DESC
    `

    // Calcular estatísticas
    const expensesList = expenses as any[]
    const stats = {
      total_expenses: expensesList.length,
      total_amount: expensesList.reduce((sum: number, e: { amount: number | string }) => sum + Number(e.amount), 0),
      approved_count: expensesList.filter((e: { status: string }) => e.status === 'approved').length,
      approved_amount: expensesList.filter((e: { status: string }) => e.status === 'approved').reduce((sum: number, e: { amount: number | string }) => sum + Number(e.amount), 0),
      pending_count: expensesList.filter((e: { status: string }) => e.status === 'pending').length,
      pending_amount: expensesList.filter((e: { status: string }) => e.status === 'pending').reduce((sum: number, e: { amount: number | string }) => sum + Number(e.amount), 0),
      rejected_count: expensesList.filter((e: { status: string }) => e.status === 'rejected').length,
      rejected_amount: expensesList.filter((e: { status: string }) => e.status === 'rejected').reduce((sum: number, e: { amount: number | string }) => sum + Number(e.amount), 0),
    }

    // Agrupar por categoria
    const byCategory = expensesList.reduce((acc: Record<string, { category: string; count: number; total: number }>, e: { category: string | null; amount: number | string }) => {
      const cat = e.category || 'other'
      if (!acc[cat]) {
        acc[cat] = { category: cat, count: 0, total: 0 }
      }
      acc[cat].count++
      acc[cat].total += Number(e.amount)
      return acc
    }, {})

    return NextResponse.json({
      invoice,
      expenses,
      stats,
      byCategory: Object.values(byCategory).sort((a: any, b: any) => b.total - a.total)
    })
  } catch (error) {
    console.error("Erro ao buscar detalhes da fatura:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
