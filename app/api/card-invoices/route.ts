import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

// GET - Listar faturas
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas financeiro e admin podem acessar
    if (!['admin', 'financial'].includes(session.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const invoices = await sql`
      SELECT * FROM card_invoices 
      ORDER BY reference_month DESC
    `

    return NextResponse.json(invoices)
  } catch (error) {
    console.error("Erro ao buscar faturas:", error)
    return NextResponse.json({ error: "Erro ao buscar faturas" }, { status: 500 })
  }
}

// POST - Criar nova fatura
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!['admin', 'financial'].includes(user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const body = await request.json()
    const { month, year, start_date, end_date, due_date, notes } = body

    // Formatar reference_month como YYYY-MM
    const reference_month = `${year}-${String(month).padStart(2, '0')}`
    
    // Criar nome amigável (ex: "Janeiro 2026")
    const reference_name = `${monthNames[month - 1]} ${year}`

    // Validar datas
    const startDateObj = new Date(start_date)
    const endDateObj = new Date(end_date)
    const dueDateObj = new Date(due_date)

    if (startDateObj >= endDateObj) {
      return NextResponse.json(
        { error: "A data de início deve ser anterior à data de fechamento" }, 
        { status: 400 }
      )
    }

    if (endDateObj >= dueDateObj) {
      return NextResponse.json(
        { error: "A data de fechamento deve ser anterior à data de vencimento" }, 
        { status: 400 }
      )
    }

    // Permitir múltiplas faturas para o mesmo período (diferentes cartões/bancos)
    // Use o campo "notes" para identificar o banco/cartão

    const result = await sql`
      INSERT INTO card_invoices (reference_month, reference_name, start_date, end_date, due_date, notes, created_by)
      VALUES (${reference_month}, ${reference_name}, ${start_date}, ${end_date}, ${due_date}, ${notes || null}, ${user.id})
      RETURNING *
    `

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao criar fatura:", error)
    return NextResponse.json({ error: "Erro ao criar fatura" }, { status: 500 })
  }
}
