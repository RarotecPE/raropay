import { NextRequest, NextResponse } from "next/server"
import { getSession, canViewAllExpenses } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Buscar despesas de uma remessa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params

    // Buscar a remessa para verificar permissão
    const [batch] = await sql`
      SELECT user_id FROM expense_batches WHERE id = ${parseInt(id)}
    `

    if (!batch) {
      return NextResponse.json({ error: "Remessa não encontrada" }, { status: 404 })
    }

    // Verificar permissão: usuário comum só pode ver suas próprias remessas
    if (!canViewAllExpenses(session.role) && batch.user_id !== session.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Buscar as despesas da remessa com todos os campos
    const expenses = await sql`
      SELECT 
        e.*,
        TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date,
        u.name as user_name
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.batch_id = ${parseInt(id)} 
      ORDER BY e.expense_date DESC
    `

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Erro ao buscar despesas da remessa:", error)
    return NextResponse.json({ error: "Erro ao buscar despesas" }, { status: 500 })
  }
}
