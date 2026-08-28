import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

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
      SELECT * FROM invoice_analysis_requests WHERE id = ${parseInt(id)}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const analysisRequest = requests[0]

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

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
