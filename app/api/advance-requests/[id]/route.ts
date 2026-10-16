import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Detalhe da solicitação + thread de mensagens
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
    const requestId = parseInt(id)

    const requests = await sql`
      SELECT ar.*,
             u.name as employee_name,
             u.department as employee_department,
             rev.name as reviewed_by_name
      FROM advance_requests ar
      JOIN users u ON u.id = ar.user_id
      LEFT JOIN users rev ON rev.id = ar.reviewed_by
      WHERE ar.id = ${requestId}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const advanceRequest = requests[0]

    // Permissão: financeiro e admin vêem tudo; funcionário só a própria
    if (user.role !== "financial" && user.role !== "admin" && advanceRequest.user_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const messages = await sql`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM advance_request_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.request_id = ${requestId}
      ORDER BY m.created_at ASC
    `

    return NextResponse.json({ request: advanceRequest, messages })
  } catch (error) {
    console.error("Erro ao buscar solicitação de adiantamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// PATCH - Atualizar status (financeiro e admin): approved, rejected, clarification
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (user.role !== "financial" && user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { id } = await params
    const requestId = parseInt(id)
    const body = await request.json()
    const { status, review_note } = body

    const validStatuses = ["approved", "rejected", "clarification", "pending"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 })
    }

    const requests = await sql`
      SELECT ar.*, u.name as employee_name, u.email as employee_email
      FROM advance_requests ar
      JOIN users u ON u.id = ar.user_id
      WHERE ar.id = ${requestId}
    `
    if (requests.length === 0) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 })
    }

    const beforeReq = requests[0]
    const employeeName = String(beforeReq.employee_name || `Colaborador #${beforeReq.user_id}`)

    await sql`
      UPDATE advance_requests
      SET status = ${status},
          review_note = ${review_note || null},
          reviewed_by = ${user.id},
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${requestId}
    `

    // Se pediu esclarecimento e escreveu uma nota, registra na thread
    if (status === "clarification" && review_note && review_note.trim()) {
      await sql`
        INSERT INTO advance_request_messages (request_id, user_id, message)
        VALUES (${requestId}, ${user.id}, ${review_note.trim()})
      `
    }

    const { auditClient, getRequestContext } = await import("@/lib/audit")
    const actionMap: Record<string, string> = {
      approved: "advance.approved",
      rejected: "advance.rejected",
      clarification: "advance.clarification_requested",
      pending: "advance.status_changed",
    }

    auditClient.log({
      category: "advances",
      action: actionMap[status] || "advance.status_changed",
      severity: status === "rejected" ? "WARNING" : "INFO",
      actor: {
        type: "user",
        userId: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
      targets: [
        {
          type: "advance_request",
          id: String(requestId),
          label: `Adiantamento #${requestId} - ${employeeName} (R$ ${Number(beforeReq.amount).toFixed(2)})`,
        },
        {
          type: "user",
          id: String(beforeReq.user_id),
          label: employeeName,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          status: beforeReq.status,
          review_note: beforeReq.review_note ?? null,
        },
        after: {
          status,
          review_note: review_note || null,
        },
      },
      details: {
        request_id: requestId,
        employee_id: beforeReq.user_id,
        employee_name: employeeName,
        amount: Number(beforeReq.amount),
        payment_method: beforeReq.payment_method,
        previous_status: beforeReq.status,
        new_status: status,
        review_note: review_note || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao atualizar solicitação de adiantamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
