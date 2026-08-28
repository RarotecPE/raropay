import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Listar faturas com despesas do funcionário
export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Buscar faturas que tenham despesas do funcionário logado
    const invoices = await sql`
      SELECT DISTINCT ci.*,
        (
          SELECT COUNT(*) 
          FROM expenses e 
          WHERE e.user_id = ${user.id}
            AND e.expense_type = 'corporate_card'
            AND e.expense_date >= ci.start_date 
            AND e.expense_date <= ci.end_date
        ) as my_expense_count,
        (
          SELECT COALESCE(SUM(e.amount), 0) 
          FROM expenses e 
          WHERE e.user_id = ${user.id}
            AND e.expense_type = 'corporate_card'
            AND e.expense_date >= ci.start_date 
            AND e.expense_date <= ci.end_date
        ) as my_total_amount
      FROM card_invoices ci
      WHERE EXISTS (
        SELECT 1 FROM expenses e 
        WHERE e.user_id = ${user.id}
          AND e.expense_type = 'corporate_card'
          AND e.expense_date >= ci.start_date 
          AND e.expense_date <= ci.end_date
      )
      ORDER BY ci.reference_month DESC
    `

    return NextResponse.json(invoices)
  } catch (error) {
    console.error("Erro ao buscar minhas faturas:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
