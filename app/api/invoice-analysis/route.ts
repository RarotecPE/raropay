import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

// GET - Listar solicitações de análise
export async function GET(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoice_id')
    const employeeId = searchParams.get('employee_id')

    let requests

    if (['admin', 'financial'].includes(user.role)) {
      // Financeiro/Admin vê todas ou filtra por fatura
      if (invoiceId) {
        requests = await sql`
          SELECT iar.*, 
                 u.name as employee_name,
                 ci.reference_name as invoice_name,
                 (SELECT COUNT(*) FROM invoice_analysis_messages WHERE request_id = iar.id AND read_at IS NULL AND sender_id != ${user.id}) as unread_count
          FROM invoice_analysis_requests iar
          JOIN users u ON u.id = iar.employee_id
          JOIN card_invoices ci ON ci.id = iar.invoice_id
          WHERE iar.invoice_id = ${parseInt(invoiceId)}
          ORDER BY iar.created_at DESC
        `
      } else {
        requests = await sql`
          SELECT iar.*, 
                 u.name as employee_name,
                 ci.reference_name as invoice_name,
                 (SELECT COUNT(*) FROM invoice_analysis_messages WHERE request_id = iar.id AND read_at IS NULL AND sender_id != ${user.id}) as unread_count
          FROM invoice_analysis_requests iar
          JOIN users u ON u.id = iar.employee_id
          JOIN card_invoices ci ON ci.id = iar.invoice_id
          ORDER BY iar.created_at DESC
        `
      }
    } else {
      // Funcionário vê apenas suas próprias solicitações
      requests = await sql`
        SELECT iar.*, 
               u.name as employee_name,
               ci.reference_name as invoice_name,
               (SELECT COUNT(*) FROM invoice_analysis_messages WHERE request_id = iar.id AND read_at IS NULL AND sender_id != ${user.id}) as unread_count
        FROM invoice_analysis_requests iar
        JOIN users u ON u.id = iar.employee_id
        JOIN card_invoices ci ON ci.id = iar.invoice_id
        WHERE iar.employee_id = ${user.id}
        ORDER BY iar.created_at DESC
      `
    }

    const formattedRequests = requests.map((r: any) => ({
      ...r,
      unread_count: parseInt(r.unread_count || '0', 10)
    }))

    return NextResponse.json(formattedRequests)
  } catch (error) {
    console.error("Erro ao buscar solicitações:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// POST - Criar nova solicitação de análise
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
    const { invoice_id, employee_id, subject, message, attachments, linked_expenses } = body

    if (!invoice_id || !employee_id || !subject || !message) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Criar a solicitação
    const result = await sql`
      INSERT INTO invoice_analysis_requests (invoice_id, employee_id, requester_id, subject, status)
      VALUES (${invoice_id}, ${employee_id}, ${user.id}, ${subject}, 'pending')
      RETURNING *
    `

    const requestId = result[0].id

    // Criar a mensagem inicial
    await sql`
      INSERT INTO invoice_analysis_messages (request_id, sender_id, message)
      VALUES (${requestId}, ${user.id}, ${message})
    `

    // Adicionar anexos se houver
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await sql`
          INSERT INTO invoice_analysis_attachments (request_id, message_id, file_name, file_path, file_type, file_size, uploaded_by)
          VALUES (${requestId}, NULL, ${attachment.file_name}, ${attachment.file_path}, ${attachment.file_type}, ${attachment.file_size}, ${user.id})
        `
      }
    }

    // Vincular despesas à solicitação (se houver)
    if (linked_expenses && linked_expenses.length > 0) {
      for (const expense of linked_expenses) {
        await sql`
          INSERT INTO invoice_analysis_expenses (request_id, expense_id, reason)
          VALUES (${requestId}, ${expense.expense_id}, ${expense.reason || null})
        `
      }
    }

    const metaRows = await sql`
      SELECT u.name as employee_name, u.email as employee_email, ci.reference_name as invoice_name
      FROM users u
      CROSS JOIN card_invoices ci
      WHERE u.id = ${employee_id} AND ci.id = ${invoice_id}
      LIMIT 1
    `
    const meta = (metaRows[0] as any) || {}

    auditClient.log({
      category: "finance",
      action: "card_invoice.analysis_created",
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
          id: String(requestId),
          label: subject,
        },
        {
          type: "card_invoice",
          id: String(invoice_id),
          label: meta.invoice_name || `Fatura #${invoice_id}`,
        },
        {
          type: "user",
          id: String(employee_id),
          label: meta.employee_name || `Colaborador #${employee_id}`,
        },
      ],
      context: getRequestContext(request),
      details: {
        invoice_id,
        invoice_name: meta.invoice_name || null,
        employee_id,
        employee_name: meta.employee_name || null,
        employee_email: meta.employee_email || null,
        subject,
        hasAttachments: Array.isArray(attachments) && attachments.length > 0,
        attachments_count: Array.isArray(attachments) ? attachments.length : 0,
        attachments: Array.isArray(attachments)
          ? attachments.map((a: any) => ({
              file_name: a.file_name,
              file_path: a.file_path,
              file_type: a.file_type,
              file_size: a.file_size,
            }))
          : [],
        linked_expenses_count: Array.isArray(linked_expenses) ? linked_expenses.length : 0,
      },
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao criar solicitação:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
