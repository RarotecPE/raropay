import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// PATCH - Editar despesa vinculada a uma solicitação de análise
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id, expenseId } = await params
    const body = await request.json()
    const { description, amount, expense_date, category, expense_type, km_before, km_after, total_km, receipt_pathname } = body

    // Verificar se a solicitação existe e pertence ao funcionário
    const requests = await sql`
      SELECT iar.*, iae.id as link_id
      FROM invoice_analysis_requests iar
      JOIN invoice_analysis_expenses iae ON iae.request_id = iar.id
      WHERE iar.id = ${parseInt(id)}
        AND iae.expense_id = ${parseInt(expenseId)}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação ou despesa não encontrada" }, { status: 404 })
    }

    const analysisRequest = requests[0]

    // Verificar permissão - apenas o funcionário da solicitação pode editar
    if (analysisRequest.employee_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Verificar se a despesa pertence ao funcionário
    const expenses = await sql`
      SELECT * FROM expenses WHERE id = ${parseInt(expenseId)} AND user_id = ${user.id}
    `

    if (expenses.length === 0) {
      return NextResponse.json({ error: "Despesa não encontrada ou não pertence a você" }, { status: 404 })
    }

    const oldExpense = expenses[0]

    // Atualizar a despesa
    const updated = await sql`
      UPDATE expenses
      SET 
        description = COALESCE(${description}, description),
        amount = COALESCE(${amount ? parseFloat(amount) : null}, amount),
        expense_date = COALESCE(${expense_date}, expense_date),
        category = COALESCE(${category}, category),
        expense_type = COALESCE(${expense_type}, expense_type),
        km_before = COALESCE(${km_before ? parseFloat(km_before) : null}, km_before),
        km_after = COALESCE(${km_after ? parseFloat(km_after) : null}, km_after),
        total_km = COALESCE(${total_km ? parseFloat(total_km) : null}, total_km),
        receipt_pathname = COALESCE(${receipt_pathname}, receipt_pathname),
        updated_at = NOW()
      WHERE id = ${parseInt(expenseId)}
      RETURNING *
    `

    // Registrar a edição na tabela de vínculo
    const typeLabels: Record<string, string> = {
      corporate_card: 'Cartão Corporativo',
      reimbursement: 'Reembolso',
      advance: 'Adiantamento'
    }
    
    const changes = []
    if (description && description !== oldExpense.description) {
      changes.push(`Descrição: "${oldExpense.description}" → "${description}"`)
    }
    if (amount && parseFloat(amount) !== parseFloat(oldExpense.amount)) {
      changes.push(`Valor: R$ ${oldExpense.amount} → R$ ${amount}`)
    }
    if (expense_date && expense_date !== oldExpense.expense_date) {
      changes.push(`Data: ${oldExpense.expense_date} → ${expense_date}`)
    }
    if (category && category !== oldExpense.category) {
      changes.push(`Categoria: ${oldExpense.category} → ${category}`)
    }
    if (expense_type && expense_type !== oldExpense.expense_type) {
      changes.push(`Tipo: ${typeLabels[oldExpense.expense_type] || oldExpense.expense_type} → ${typeLabels[expense_type] || expense_type}`)
    }
    if (km_before && parseFloat(km_before) !== parseFloat(oldExpense.km_before || '0')) {
      changes.push(`Km Inicial: ${oldExpense.km_before || 0} → ${km_before}`)
    }
    if (km_after && parseFloat(km_after) !== parseFloat(oldExpense.km_after || '0')) {
      changes.push(`Km Final: ${oldExpense.km_after || 0} → ${km_after}`)
    }
    if (total_km && parseFloat(total_km) !== parseFloat(oldExpense.total_km || '0')) {
      changes.push(`Km Total: ${oldExpense.total_km || 0} → ${total_km}`)
    }
    if (receipt_pathname && receipt_pathname !== oldExpense.receipt_pathname) {
      changes.push(`Comprovante atualizado`)
    }

    if (changes.length > 0) {
      await sql`
        UPDATE invoice_analysis_expenses
        SET edited_at = NOW(), edit_notes = ${changes.join('; ')}
        WHERE request_id = ${parseInt(id)} AND expense_id = ${parseInt(expenseId)}
      `

      // Criar mensagem automática sobre a edição
      await sql`
        INSERT INTO invoice_analysis_messages (request_id, sender_id, message)
        VALUES (${parseInt(id)}, ${user.id}, ${'[Despesa editada] ' + changes.join('; ')})
      `

      // Atualizar status da solicitação se estiver pendente
      if (analysisRequest.status === 'pending') {
        await sql`
          UPDATE invoice_analysis_requests
          SET status = 'in_progress', updated_at = NOW()
          WHERE id = ${parseInt(id)}
        `
      }
    }

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error("Erro ao editar despesa:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
