import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

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
    const startDate = typeof invoice.start_date === 'string'
      ? invoice.start_date.split('T')[0]
      : (invoice.start_date instanceof Date ? invoice.start_date.toISOString().split('T')[0] : invoice.start_date)
    const endDate = typeof invoice.end_date === 'string'
      ? invoice.end_date.split('T')[0]
      : (invoice.end_date instanceof Date ? invoice.end_date.toISOString().split('T')[0] : invoice.end_date)

    // Buscar despesas de cartão corporativo no período da fatura
    const expenses = await sql`
      SELECT e.*, u.name as user_name
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.expense_type = 'corporate_card'
        AND e.expense_date >= ${startDate}::date
        AND e.expense_date <= ${endDate}::date
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
        AND expense_date >= ${startDate}::date
        AND expense_date <= ${endDate}::date
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
        AND e.expense_date >= ${startDate}::date
        AND e.expense_date <= ${endDate}::date
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
        AND expense_date >= ${startDate}::date
        AND expense_date <= ${endDate}::date
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

    const existingRows = await sql`
      SELECT * FROM card_invoices WHERE id = ${parseInt(id)}
    `
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }
    const beforeInvoice = existingRows[0] as any

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

    const afterInvoice = result[0] as any

    auditClient.log({
      category: "finance",
      action: "card_invoice.updated",
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
          type: "card_invoice",
          id: String(afterInvoice.id),
          label: afterInvoice.reference_name,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          reference_month: beforeInvoice.reference_month,
          reference_name: beforeInvoice.reference_name,
          start_date: beforeInvoice.start_date,
          end_date: beforeInvoice.end_date,
          due_date: beforeInvoice.due_date,
          notes: beforeInvoice.notes,
        },
        after: {
          reference_month: afterInvoice.reference_month,
          reference_name: afterInvoice.reference_name,
          start_date: afterInvoice.start_date,
          end_date: afterInvoice.end_date,
          due_date: afterInvoice.due_date,
          notes: afterInvoice.notes,
        },
      },
      details: {
        reference_month: afterInvoice.reference_month,
        reference_name: afterInvoice.reference_name,
      },
    })

    return NextResponse.json(afterInvoice)
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
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 })
    }

    const deletedInvoice = result[0] as any

    auditClient.log({
      category: "finance",
      action: "card_invoice.deleted",
      severity: "WARNING",
      actor: {
        type: "user",
        userId: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      targets: [
        {
          type: "card_invoice",
          id: String(deletedInvoice.id),
          label: deletedInvoice.reference_name,
        },
      ],
      context: getRequestContext(request),
      details: {
        reference_month: deletedInvoice.reference_month,
        reference_name: deletedInvoice.reference_name,
        start_date: deletedInvoice.start_date,
        end_date: deletedInvoice.end_date,
        due_date: deletedInvoice.due_date,
        notes: deletedInvoice.notes || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir fatura:", error)
    return NextResponse.json({ error: "Erro ao excluir fatura" }, { status: 500 })
  }
}
