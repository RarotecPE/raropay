import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas gestores, diretoria, admin e financeiro podem ver relatórios
    const allowedRoles = ["manager", "director", "admin", "financial"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get("endDate") || new Date().toISOString().split('T')[0]
    const status = searchParams.get("status") || "all"
    const categoriesParam = searchParams.get("categories")
    const typesParam = searchParams.get("types")
    const employeeId = searchParams.get("employeeId")

    const categories = categoriesParam ? categoriesParam.split(",") : null
    const types = typesParam ? typesParam.split(",") : null

    // Mapear status para considerar ambos os idiomas (português e inglês)
    const statusMap: Record<string, string[]> = {
      'aprovado': ['aprovado', 'approved'],
      'approved': ['aprovado', 'approved'],
      'rejeitado': ['rejeitado', 'rejected'],
      'rejected': ['rejeitado', 'rejected'],
      'enviado': ['enviado', 'submitted', 'pending'],
      'submitted': ['enviado', 'submitted', 'pending'],
      'pending': ['enviado', 'submitted', 'pending'],
    }
    const statusValues = status !== 'all' ? (statusMap[status] || [status]) : null

    // Construir condições de filtro
    let baseCondition = `expense_date >= '${startDate}' AND expense_date <= '${endDate}'`
    if (statusValues) {
      baseCondition += ` AND status IN (${statusValues.map(s => `'${s}'`).join(",")})`
    }
    if (categories && categories.length > 0) {
      baseCondition += ` AND category IN (${categories.map(c => `'${c}'`).join(",")})`
    }
    if (types && types.length > 0) {
      baseCondition += ` AND expense_type IN (${types.map(t => `'${t}'`).join(",")})`
    }
    if (employeeId) {
      baseCondition += ` AND user_id = ${parseInt(employeeId)}`
    }

    // Resumo geral - considerar tanto status em português quanto em inglês
    // Inclui métricas estratégicas por tipo de liquidação (aprovado/rejeitado/pago)
    const summaryResult = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('aprovado', 'approved')) as approved,
        COUNT(*) FILTER (WHERE status IN ('enviado', 'submitted', 'pending')) as pending,
        COUNT(*) FILTER (WHERE status IN ('rejeitado', 'rejected')) as rejected,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('aprovado', 'approved')), 0) as approved_amount,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('rejeitado', 'rejected')), 0) as rejected_amount,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('aprovado', 'approved') AND paid = true), 0) as paid_amount,
        
        -- Contagens gerais por status
        COUNT(*) FILTER (WHERE status IN ('aprovado', 'approved') AND paid = true) as paid_count,
        
        -- Cartão Corporativo: contagens e valores
        COUNT(*) FILTER (WHERE expense_type = 'corporate_card') as corporate_card_count,
        COUNT(*) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('aprovado', 'approved')) as corporate_card_approved_count,
        COUNT(*) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('rejeitado', 'rejected')) as corporate_card_rejected_count,
        COUNT(*) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('aprovado', 'approved') AND paid = true) as corporate_card_paid_count,
        COALESCE(SUM(amount) FILTER (WHERE expense_type = 'corporate_card'), 0) as corporate_card_total,
        COALESCE(SUM(amount) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('aprovado', 'approved')), 0) as corporate_card_approved,
        COALESCE(SUM(amount) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('rejeitado', 'rejected')), 0) as corporate_card_rejected,
        COALESCE(SUM(amount) FILTER (WHERE expense_type = 'corporate_card' AND status IN ('aprovado', 'approved') AND paid = true), 0) as corporate_card_paid,
        
        -- Adiantamento: contagens e valores
        COUNT(*) FILTER (WHERE expense_type IN ('advance', 'adiantamento')) as advance_count,
        COUNT(*) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('aprovado', 'approved')) as advance_approved_count,
        COUNT(*) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('rejeitado', 'rejected')) as advance_rejected_count,
        COUNT(*) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('aprovado', 'approved') AND paid = true) as advance_paid_count,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('advance', 'adiantamento')), 0) as advance_total,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('aprovado', 'approved')), 0) as advance_approved,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('rejeitado', 'rejected')), 0) as advance_rejected,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('advance', 'adiantamento') AND status IN ('aprovado', 'approved') AND paid = true), 0) as advance_paid,
        
        -- Reembolso: contagens e valores
        COUNT(*) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso')) as reimbursement_count,
        COUNT(*) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('aprovado', 'approved')) as reimbursement_approved_count,
        COUNT(*) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('rejeitado', 'rejected')) as reimbursement_rejected_count,
        COUNT(*) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('aprovado', 'approved') AND paid = true) as reimbursement_paid_count,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso')), 0) as reimbursement_total,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('aprovado', 'approved')), 0) as reimbursement_approved,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('rejeitado', 'rejected')), 0) as reimbursement_rejected,
        COALESCE(SUM(amount) FILTER (WHERE expense_type IN ('reimbursement', 'refund', 'reembolso') AND status IN ('aprovado', 'approved') AND paid = true), 0) as reimbursement_paid
      FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
        AND (${!statusValues} OR status = ANY(${statusValues || []}::text[]))
        AND (${employeeId}::int IS NULL OR user_id = ${employeeId ? parseInt(employeeId) : null}::int)
    `

    // Por categoria
    const byCategory = await sql`
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
        AND (${!statusValues} OR status = ANY(${statusValues || []}::text[]))
        AND (${employeeId}::int IS NULL OR user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      GROUP BY category
      ORDER BY total DESC
    `

    // Por tipo
    const byType = await sql`
      SELECT 
        expense_type as type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
        AND (${!statusValues} OR status = ANY(${statusValues || []}::text[]))
        AND (${employeeId}::int IS NULL OR user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      GROUP BY expense_type
      ORDER BY total DESC
    `

    // Por mês
    const byMonth = await sql`
      SELECT 
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
        AND (${!statusValues} OR status = ANY(${statusValues || []}::text[]))
        AND (${employeeId}::int IS NULL OR user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
      ORDER BY month
    `

    // Por status
    const byStatus = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE expense_date >= ${startDate} AND expense_date <= ${endDate}
        AND (${employeeId}::int IS NULL OR user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      GROUP BY status
      ORDER BY total DESC
    `

    // Por funcionário
    const byEmployee = await sql`
      SELECT 
        u.name as employee_name,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.expense_date >= ${startDate} AND e.expense_date <= ${endDate}
        AND (${status} = 'all' OR e.status = ${status})
        AND (${employeeId}::int IS NULL OR e.user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      GROUP BY u.name
      ORDER BY total DESC
    `

    // Lista de despesas para o PDF
    const expenses = await sql`
      SELECT 
        e.id,
        e.expense_date,
        e.category,
        e.expense_type,
        e.amount,
        e.status,
        e.state,
        e.municipality,
        u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.expense_date >= ${startDate} AND e.expense_date <= ${endDate}
        AND (${status} = 'all' OR e.status = ${status})
        AND (${employeeId}::int IS NULL OR e.user_id = ${employeeId ? parseInt(employeeId) : null}::int)
      ORDER BY e.expense_date DESC
      LIMIT 500
    `

    const categoryLabels: Record<string, string> = {
      accommodation: "Hospedagem",
      food: "Alimentação",
      fuel: "Combustível",
      transport: "Deslocamento",
      parking: "Estacionamento",
      office_supplies: "Itens de Escritório",
      meal_voucher: "Vale-Refeição",
      transport_voucher: "Vale-Transporte",
      other: "Outras Despesas",
    }

    const typeLabels: Record<string, string> = {
      corporate_card: "Cartão Corporativo",
      advance: "Adiantamento",
      adiantamento: "Adiantamento",
      refund: "Reembolso",
      reimbursement: "Reembolso",
      reembolso: "Reembolso",
    }

    const statusLabels: Record<string, string> = {
      draft: "Rascunho",
      processed: "Processada",
      pending: "Pendente",
      submitted: "Enviada",
      enviado: "Enviada",
      approved: "Aprovada",
      aprovado: "Aprovada",
      rejected: "Rejeitada",
      rejeitado: "Rejeitada",
      correction: "Em Correção",
    }

    const summary = summaryResult[0] || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      total_amount: 0,
      approved_amount: 0,
      rejected_amount: 0,
      paid_amount: 0,
      paid_count: 0,
      // Cartão Corporativo
      corporate_card_count: 0,
      corporate_card_approved_count: 0,
      corporate_card_rejected_count: 0,
      corporate_card_paid_count: 0,
      corporate_card_total: 0,
      corporate_card_approved: 0,
      corporate_card_rejected: 0,
      corporate_card_paid: 0,
      // Adiantamento
      advance_count: 0,
      advance_approved_count: 0,
      advance_rejected_count: 0,
      advance_paid_count: 0,
      advance_total: 0,
      advance_approved: 0,
      advance_rejected: 0,
      advance_paid: 0,
      // Reembolso
      reimbursement_count: 0,
      reimbursement_approved_count: 0,
      reimbursement_rejected_count: 0,
      reimbursement_paid_count: 0,
      reimbursement_total: 0,
      reimbursement_approved: 0,
      reimbursement_rejected: 0,
      reimbursement_paid: 0,
    }

    return NextResponse.json({
      summary: {
        total: Number(summary.total),
        approved: Number(summary.approved),
        pending: Number(summary.pending),
        rejected: Number(summary.rejected),
        paidCount: Number(summary.paid_count),
        totalAmount: Number(summary.total_amount),
        approvedAmount: Number(summary.approved_amount),
        rejectedAmount: Number(summary.rejected_amount),
        paidAmount: Number(summary.paid_amount),
        // Cartão Corporativo
        corporateCardCount: Number(summary.corporate_card_count),
        corporateCardApprovedCount: Number(summary.corporate_card_approved_count),
        corporateCardRejectedCount: Number(summary.corporate_card_rejected_count),
        corporateCardPaidCount: Number(summary.corporate_card_paid_count),
        corporateCardTotal: Number(summary.corporate_card_total),
        corporateCardApproved: Number(summary.corporate_card_approved),
        corporateCardRejected: Number(summary.corporate_card_rejected),
        corporateCardPaid: Number(summary.corporate_card_paid),
        // Adiantamento
        advanceCount: Number(summary.advance_count),
        advanceApprovedCount: Number(summary.advance_approved_count),
        advanceRejectedCount: Number(summary.advance_rejected_count),
        advancePaidCount: Number(summary.advance_paid_count),
        advanceTotal: Number(summary.advance_total),
        advanceApproved: Number(summary.advance_approved),
        advanceRejected: Number(summary.advance_rejected),
        advancePaid: Number(summary.advance_paid),
        // Reembolso
        reimbursementCount: Number(summary.reimbursement_count),
        reimbursementApprovedCount: Number(summary.reimbursement_approved_count),
        reimbursementRejectedCount: Number(summary.reimbursement_rejected_count),
        reimbursementPaidCount: Number(summary.reimbursement_paid_count),
        reimbursementTotal: Number(summary.reimbursement_total),
        reimbursementApproved: Number(summary.reimbursement_approved),
        reimbursementRejected: Number(summary.reimbursement_rejected),
        reimbursementPaid: Number(summary.reimbursement_paid),
      },
      byCategory: byCategory.map(row => ({
        category: row.category,
        label: categoryLabels[row.category] || row.category,
        count: Number(row.count),
        total: Number(row.total),
      })),
      byType: byType.map(row => ({
        type: row.type,
        label: typeLabels[row.type] || row.type,
        count: Number(row.count),
        total: Number(row.total),
      })),
      byMonth: byMonth.map(row => ({
        month: row.month,
        count: Number(row.count),
        total: Number(row.total),
      })),
      byStatus: byStatus.map(row => ({
        status: row.status,
        label: statusLabels[row.status] || row.status,
        count: Number(row.count),
        total: Number(row.total),
      })),
      byEmployee: byEmployee.map(row => ({
        employee: row.employee_name || 'Sem nome',
        count: Number(row.count),
        total: Number(row.total),
      })),
      expenses: expenses.map(row => ({
        id: row.id,
        expense_date: row.expense_date,
        category: row.category,
        expense_type: row.expense_type,
        amount: Number(row.amount),
        status: row.status,
        state: row.state,
        municipality: row.municipality,
        user_name: row.user_name,
      })),
    })
  } catch (error) {
    console.error("Erro ao gerar relatório:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
