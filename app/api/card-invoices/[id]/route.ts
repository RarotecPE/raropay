import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Buscar fatura específica com despesas
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!['admin', 'financial'].includes(user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { id } = await params

    // Buscar fatura
    const invoices = await sql`
      SELECT * FROM card_invoices WHERE id = ${parseInt(id)}
    `

    if (invoices.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }

    const invoice = invoices[0]

    // Buscar despesas de cartão corporativo no período da fatura
    const expenses = await sql`
      SELECT e.*, u.name as user_name
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.expense_type = 'corporate_card'
        AND e.expense_date >= ${invoice.start_date}
        AND e.expense_date <= ${invoice.end_date}
      ORDER BY e.expense_date DESC
    `

    // Estatísticas
    const stats = await sql`
      SELECT 
        COUNT(*) as total_expenses,
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as approved_amount,
        COUNT(*) FILTER (WHERE status IN ('pending', 'submitted', 'analysis')) as pending_count,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('pending', 'submitted', 'analysis')), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'rejected'), 0) as rejected_amount
      FROM expenses
      WHERE expense_type = 'corporate_card'
        AND expense_date >= ${invoice.start_date}
        AND expense_date <= ${invoice.end_date}
    `

    // Por funcionário
    const byEmployee = await sql`
      SELECT 
        u.id,
        u.name,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.expense_type = 'corporate_card'
        AND e.expense_date >= ${invoice.start_date}
        AND e.expense_date <= ${invoice.end_date}
      GROUP BY u.id, u.name
      ORDER BY total DESC
    `

    // Por categoria
    const byCategory = await sql`
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_type = 'corporate_card'
        AND expense_date >= ${invoice.start_date}
        AND expense_date <= ${invoice.end_date}
      GROUP BY category
      ORDER BY total DESC
    `

    return NextResponse.json({
      invoice,
      expenses,
      stats: stats[0],
      byEmployee,
      byCategory
    })
  } catch (error) {
    console.error("Erro ao buscar fatura:", error)
    return NextResponse.json({ error: "Erro ao buscar fatura" }, { status: 500 })
  }
}

// PUT - Atualizar fatura
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!['admin', 'financial'].includes(user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { month, year, start_date, end_date, due_date, notes } = body

    // Criar reference_month no formato YYYY-MM
    const reference_month = `${year}-${String(month).padStart(2, '0')}`
    
    // Criar nome amigável
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const reference_name = `${monthNames[month - 1]} ${year}`

    // Permitir múltiplas faturas para o mesmo período (diferentes cartões/bancos)
    // Use o campo "notes" para identificar o banco/cartão

    const result = await sql`
      UPDATE card_invoices
      SET reference_month = ${reference_month},
          reference_name = ${reference_name},
          start_date = ${start_date},
          end_date = ${end_date},
          due_date = ${due_date},
          notes = ${notes || null},
          updated_at = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Erro ao atualizar fatura:", error)
    return NextResponse.json({ error: "Erro ao atualizar fatura" }, { status: 500 })
  }
}

// DELETE - Excluir fatura
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!['admin', 'financial'].includes(user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { id } = await params

    const result = await sql`
      DELETE FROM card_invoices WHERE id = ${parseInt(id)}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir fatura:", error)
    return NextResponse.json({ error: "Erro ao excluir fatura" }, { status: 500 })
  }
}
