import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Obter detalhes de uma solicitação
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

    // Buscar solicitação
    const requests = await sql`
      SELECT iar.*, 
             u.name as employee_name,
             req.name as requester_name,
             ci.reference_name as invoice_name,
             ci.start_date,
             ci.end_date
      FROM invoice_analysis_requests iar
      JOIN users u ON u.id = iar.employee_id
      JOIN users req ON req.id = iar.requester_id
      JOIN card_invoices ci ON ci.id = iar.invoice_id
      WHERE iar.id = ${parseInt(id)}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const analysisRequest = requests[0]

    // Verificar permissão
    if (!['admin', 'financial'].includes(user.role) && analysisRequest.employee_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Buscar mensagens
    const messages = await sql`
      SELECT iam.*, u.name as sender_name, u.role as sender_role
      FROM invoice_analysis_messages iam
      JOIN users u ON u.id = iam.sender_id
      WHERE iam.request_id = ${parseInt(id)}
      ORDER BY iam.created_at ASC
    `

    // Buscar anexos
    const attachments = await sql`
      SELECT iaa.*, u.name as uploaded_by_name
      FROM invoice_analysis_attachments iaa
      JOIN users u ON u.id = iaa.uploaded_by
      WHERE iaa.request_id = ${parseInt(id)}
      ORDER BY iaa.created_at ASC
    `

    // Buscar despesas vinculadas
    const linkedExpenses = await sql`
      SELECT iae.*, 
             e.description, e.amount, e.expense_date, e.category, e.status,
             e.expense_type, e.receipt_url, e.receipt_pathname,
             e.km_before, e.km_after, e.total_km
      FROM invoice_analysis_expenses iae
      JOIN expenses e ON e.id = iae.expense_id
      WHERE iae.request_id = ${parseInt(id)}
      ORDER BY e.expense_date DESC
    `

    // Marcar mensagens como lidas
    await sql`
      UPDATE invoice_analysis_messages
      SET read_at = NOW()
      WHERE request_id = ${parseInt(id)} 
        AND sender_id != ${user.id}
        AND read_at IS NULL
    `

    return NextResponse.json({
      request: analysisRequest,
      messages,
      attachments,
      linkedExpenses
    })
  } catch (error) {
    console.error("Erro ao buscar solicitação:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// PATCH - Atualizar status da solicitação
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    // Buscar solicitação para verificar permissão
    const requests = await sql`
      SELECT * FROM invoice_analysis_requests WHERE id = ${parseInt(id)}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const analysisRequest = requests[0]

    // Apenas financeiro pode resolver, funcionário pode marcar como respondido
    if (['admin', 'financial'].includes(user.role)) {
      if (status === 'resolved') {
        await sql`
          UPDATE invoice_analysis_requests
          SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
          WHERE id = ${parseInt(id)}
        `
      }
    } else if (analysisRequest.employee_id === user.id) {
      if (status === 'in_progress') {
        await sql`
          UPDATE invoice_analysis_requests
          SET status = 'in_progress', updated_at = NOW()
          WHERE id = ${parseInt(id)}
        `
      }
    } else {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao atualizar solicitação:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
