import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

// GET - Buscar alertas do usuário
export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const alerts: {
      type: string
      title: string
      description: string
      count: number
      url: string
      priority: 'high' | 'medium' | 'low'
    }[] = []

    if (['admin', 'financial'].includes(user.role)) {
      // Alertas para financeiro/admin

      // Solicitações de análise pendentes de resposta do funcionário
      const pendingRequests = await sql`
        SELECT COUNT(*) as count
        FROM invoice_analysis_requests
        WHERE status = 'pending'
      `
      if (Number(pendingRequests[0].count) > 0) {
        alerts.push({
          type: 'analysis_pending',
          title: 'Análises Pendentes',
          description: `${pendingRequests[0].count} solicitação(ões) aguardando resposta de funcionários`,
          count: Number(pendingRequests[0].count),
          url: '/card-invoices',
          priority: 'medium'
        })
      }

      // Solicitações com novas respostas (não lidas)
      const unreadResponses = await sql`
        SELECT DISTINCT iar.id
        FROM invoice_analysis_requests iar
        JOIN invoice_analysis_messages iam ON iam.request_id = iar.id
        WHERE iar.status = 'in_progress'
          AND iam.sender_id != ${user.id}
          AND iam.read_at IS NULL
      `
      if (unreadResponses.length > 0) {
        // Se tiver apenas uma, vai direto para o chat. Senão, vai para a lista de faturas
        const url = unreadResponses.length === 1 
          ? `/card-invoices/analysis/${unreadResponses[0].id}`
          : '/card-invoices'
        
        alerts.push({
          type: 'analysis_response',
          title: 'Novas Respostas',
          description: `${unreadResponses.length} solicitação(ões) com novas respostas de funcionários`,
          count: unreadResponses.length,
          url,
          priority: 'high'
        })
      }

      // Remessas pendentes de aprovação
      const pendingBatches = await sql`
        SELECT COUNT(*) as count
        FROM expense_batches
        WHERE status = 'pending'
      `
      if (Number(pendingBatches[0].count) > 0) {
        alerts.push({
          type: 'batches_pending',
          title: 'Remessas Pendentes',
          description: `${pendingBatches[0].count} remessa(s) aguardando aprovação`,
          count: Number(pendingBatches[0].count),
          url: '/analysis',
          priority: 'high'
        })
      }

    } else {
      // Alertas para funcionário comum

      // Solicitações de análise pendentes
      const analysisRequests = await sql`
        SELECT id
        FROM invoice_analysis_requests
        WHERE employee_id = ${user.id}
          AND status IN ('pending', 'in_progress')
      `
      if (analysisRequests.length > 0) {
        // Se tiver apenas uma, vai direto para o chat
        const url = analysisRequests.length === 1 
          ? `/my-invoices/analysis/${analysisRequests[0].id}`
          : '/my-invoices'
        
        alerts.push({
          type: 'analysis_request',
          title: 'Análise Solicitada',
          description: `${analysisRequests.length} solicitação(ões) de análise do financeiro`,
          count: analysisRequests.length,
          url,
          priority: 'high'
        })
      }

      // Mensagens não lidas nas solicitações
      const unreadMessages = await sql`
        SELECT DISTINCT iar.id
        FROM invoice_analysis_requests iar
        JOIN invoice_analysis_messages iam ON iam.request_id = iar.id
        WHERE iar.employee_id = ${user.id}
          AND iam.sender_id != ${user.id}
          AND iam.read_at IS NULL
      `
      if (unreadMessages.length > 0) {
        // Se tiver apenas uma, vai direto para o chat
        const url = unreadMessages.length === 1 
          ? `/my-invoices/analysis/${unreadMessages[0].id}`
          : '/my-invoices'
        
        alerts.push({
          type: 'analysis_message',
          title: 'Novas Mensagens',
          description: `${unreadMessages.length} solicitação(ões) com novas mensagens do financeiro`,
          count: unreadMessages.length,
          url,
          priority: 'high'
        })
      }

      // Remessas rejeitadas
      const rejectedBatches = await sql`
        SELECT COUNT(*) as count
        FROM expense_batches
        WHERE user_id = ${user.id}
          AND status = 'rejected'
      `
      if (Number(rejectedBatches[0].count) > 0) {
        alerts.push({
          type: 'batch_rejected',
          title: 'Remessas Rejeitadas',
          description: `${rejectedBatches[0].count} remessa(s) foram rejeitadas`,
          count: Number(rejectedBatches[0].count),
          url: '/expenses/history',
          priority: 'medium'
        })
      }
    }

    // Ordenar por prioridade
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

    return NextResponse.json(alerts)
  } catch (error) {
    console.error("Erro ao buscar alertas:", error)
    // Retornar array vazio em caso de erro para não quebrar o frontend
    return NextResponse.json([])
  }
}
