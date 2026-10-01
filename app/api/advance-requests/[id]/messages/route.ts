import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// POST - Adicionar mensagem à thread de esclarecimento
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
    const requestId = parseInt(id)
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    // Verificar solicitação e permissão
    const requests = await sql`
      SELECT * FROM advance_requests WHERE id = ${requestId}
    `
    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const advanceRequest = requests[0]
    if (user.role !== "financial" && user.role !== "admin" && advanceRequest.user_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const result = await sql`
      INSERT INTO advance_request_messages (request_id, user_id, message)
      VALUES (${requestId}, ${user.id}, ${message.trim()})
      RETURNING *
    `

    // Quando o funcionário responde a um pedido de esclarecimento,
    // devolve a solicitação para análise (pending)
    if (advanceRequest.user_id === user.id && advanceRequest.status === "clarification") {
      await sql`
        UPDATE advance_requests
        SET status = 'pending', updated_at = NOW()
        WHERE id = ${requestId}
      `
    }

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao adicionar mensagem:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
