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

    // Buscar despesas do funcionário neste período
    const expenses = await sql`
      SELECT *
      FROM expenses
      WHERE user_id = ${user.id}
        AND expense_type = 'corporate_card'
        AND expense_date >= ${invoice.start_date}
        AND expense_date <= ${invoice.end_date}
      ORDER BY expense_date DESC
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
