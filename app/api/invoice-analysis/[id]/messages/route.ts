import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

// POST - Enviar mensagem na solicitação
export async function POST(
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
    const { message, attachments } = body

    if (!message) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 })
    }

    // Buscar solicitação para verificar permissão
    const requests = await sql`
      SELECT iar.*, u.name as employee_name, ci.reference_name as invoice_name
      FROM invoice_analysis_requests iar
      LEFT JOIN users u ON u.id = iar.employee_id
      LEFT JOIN card_invoices ci ON ci.id = iar.invoice_id
      WHERE iar.id = ${parseInt(id)}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const analysisRequest = requests[0] as any

    // Verificar permissão
    if (!['admin', 'financial'].includes(user.role) && analysisRequest.employee_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    // Criar mensagem
    const result = await sql`
      INSERT INTO invoice_analysis_messages (request_id, sender_id, message)
      VALUES (${parseInt(id)}, ${user.id}, ${message})
      RETURNING *
    `

    const messageId = result[0].id

    // Adicionar anexos se houver
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await sql`
          INSERT INTO invoice_analysis_attachments (request_id, message_id, file_name, file_path, file_type, file_size, uploaded_by)
          VALUES (${parseInt(id)}, ${messageId}, ${attachment.file_name}, ${attachment.file_path}, ${attachment.file_type}, ${attachment.file_size}, ${user.id})
        `
      }
    }

    // Se é funcionário respondendo, atualizar status para in_progress
    if (analysisRequest.employee_id === user.id && analysisRequest.status === 'pending') {
      await sql`
        UPDATE invoice_analysis_requests
        SET status = 'in_progress', updated_at = NOW()
        WHERE id = ${parseInt(id)}
      `
    }

    auditClient.log({
      category: "finance",
      action: "card_invoice.message_sent",
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
          id: String(analysisRequest.id),
          label: analysisRequest.subject,
        },
        {
          type: "card_invoice",
          id: String(analysisRequest.invoice_id),
          label: analysisRequest.invoice_name || `Fatura #${analysisRequest.invoice_id}`,
        },
        {
          type: "user",
          id: String(analysisRequest.employee_id),
          label: analysisRequest.employee_name || `Colaborador #${analysisRequest.employee_id}`,
        },
      ],
      context: getRequestContext(request),
      details: {
        message_id: messageId,
        invoice_id: analysisRequest.invoice_id,
        invoice_name: analysisRequest.invoice_name || null,
        employee_id: analysisRequest.employee_id,
        employee_name: analysisRequest.employee_name || null,
        subject: analysisRequest.subject,
        attachments_count: Array.isArray(attachments) ? attachments.length : 0,
      },
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
