import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getAppBranding } from "@/lib/branding.server"
import { fetchInstitucionalInfo } from "@/lib/institucional"

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const allowedRoles = ["manager", "director", "admin", "financial"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const [branding, institucional] = await Promise.all([
      getAppBranding(),
      fetchInstitucionalInfo()
    ])
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get("endDate") || new Date().toISOString().split('T')[0]
    const status = searchParams.get("status") || "all"

    // Buscar despesas
    const expenses = await sql`
      SELECT 
        e.*,
        u.name as user_name
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.expense_date >= ${startDate} AND e.expense_date <= ${endDate}
        AND (${status} = 'all' OR e.status = ${status})
      ORDER BY e.expense_date DESC
    `

    // Calcular totais
    const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
    const approvedAmount = expenses
      .filter(exp => exp.status === 'approved')
      .reduce((sum, exp) => sum + Number(exp.amount), 0)

    const categoryLabels: Record<string, string> = {
      accommodation: "Hospedagem",
      food: "Alimentação",
      fuel: "Combustível",
      transport: "Deslocamento",
      parking: "Estacionamento",
      office_supplies: "Itens de Escritório",
      meal_voucher: "Vale-Refeição",
      transport_voucher: "Vale-Transporte",
      travel: "Viagem",
      other: "Outras Despesas",
    }

    const typeLabels: Record<string, string> = {
      corporate_card: "Cartão Corporativo",
      cartao_corporativo: "Cartão Corporativo",
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
      enviada: "Enviada",
      analysis: "Em Análise",
      approved: "Aprovada",
      aprovada: "Aprovada",
      rejected: "Rejeitada",
      rejeitada: "Rejeitada",
      correction: "Em Correção",
    }

    // Gerar HTML do relatório
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Despesas - ${branding.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 40px; 
      color: #1a1a1a;
      font-size: 12px;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #10b981;
      padding-bottom: 20px;
    }
    .header h1 { 
      font-size: 24px; 
      color: #10b981;
      margin-bottom: 5px;
    }
    .header p { color: #666; }
    .summary { 
      display: flex; 
      gap: 20px; 
      margin-bottom: 30px; 
      flex-wrap: wrap;
    }
    .summary-card { 
      flex: 1; 
      min-width: 150px;
      padding: 15px; 
      background: #f9fafb; 
      border-radius: 8px;
      border-left: 4px solid #10b981;
    }
    .summary-card h3 { font-size: 11px; color: #666; margin-bottom: 5px; }
    .summary-card p { font-size: 18px; font-weight: bold; color: #1a1a1a; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 20px;
    }
    th, td { 
      padding: 10px 8px; 
      text-align: left; 
      border-bottom: 1px solid #e5e7eb;
    }
    th { 
      background: #f9fafb; 
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
    }
    tr:hover { background: #f9fafb; }
    .status { 
      padding: 3px 8px; 
      border-radius: 4px; 
      font-size: 10px;
      font-weight: 500;
    }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .status-draft { background: #e5e7eb; color: #374151; }
    .status-processed { background: #dbeafe; color: #1e40af; }
    .status-correction { background: #ffedd5; color: #c2410c; }
    .amount { text-align: right; font-weight: 500; }
    .exceeds { color: #dc2626; }
    .footer { 
      margin-top: 30px; 
      text-align: center; 
      color: #666; 
      font-size: 10px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    @media print {
      body { padding: 20px; }
      .summary-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${branding.logoUrl}" alt="${institucional.nome}" style="width: 64px; height: 64px; object-fit: contain; margin-bottom: 12px;" />
    <h1>${institucional.razao_social}</h1>
    <p style="font-size: 11px; color: #666; margin-top: 4px;">CNPJ: ${institucional.cnpj} &bull; ${institucional.endereco} &bull; Tel: ${institucional.telefone}</p>
    <p style="font-size: 14px; font-weight: 600; margin-top: 10px; color: #10b981;">Relatório de Despesas</p>
    <p style="margin-top: 4px; font-size: 11px;">Período: ${formatDate(startDate)} a ${formatDate(endDate)}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total de Despesas</h3>
      <p>${expenses.length}</p>
    </div>
    <div class="summary-card">
      <h3>Valor Total</h3>
      <p>${formatCurrency(totalAmount)}</p>
    </div>
    <div class="summary-card">
      <h3>Aprovadas</h3>
      <p>${expenses.filter(e => e.status === 'approved').length}</p>
    </div>
    <div class="summary-card">
      <h3>Valor Aprovado</h3>
      <p>${formatCurrency(approvedAmount)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Funcionário</th>
        <th>Tipo</th>
        <th>Categoria</th>
        <th>Local</th>
        <th>Status</th>
        <th style="text-align: right">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${expenses.map(exp => `
        <tr>
          <td>${formatDate(exp.expense_date)}</td>
          <td>${exp.user_name}</td>
          <td>${typeLabels[exp.expense_type] || exp.expense_type}</td>
          <td>${categoryLabels[exp.category] || exp.category}</td>
          <td>${exp.municipality}/${exp.state}</td>
          <td><span class="status status-${exp.status}">${statusLabels[exp.status] || exp.status}</span></td>
          <td class="amount ${exp.exceeds_limit ? 'exceeds' : ''}">${formatCurrency(exp.amount)}${exp.exceeds_limit ? ' *' : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${expenses.some(e => e.exceeds_limit) ? '<p style="margin-top: 10px; font-size: 10px; color: #dc2626;">* Valor acima do limite da categoria</p>' : ''}

  <div class="footer">
    <p>Gerado em ${new Date().toLocaleString('pt-BR')} por ${user.name}</p>
    <p style="margin-top: 4px;">${institucional.razao_social} &bull; CNPJ ${institucional.cnpj} &bull; Contato: ${institucional.email}</p>
    <p style="margin-top: 4px; color: #9ca3af;">${institucional.sistema?.nome || branding.name} &bull; ${institucional.sistema?.descricao || "Sistema de Gestão Financeira"}</p>
  </div>
</body>
</html>
    `

    const { auditClient, getRequestContext } = await import("@/lib/audit")
    auditClient.log({
      category: "finance",
      action: "report.exported",
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
          type: "financial_report",
          id: `${startDate}_${endDate}`,
          label: `Relatório de Despesas (${startDate} a ${endDate})`,
        },
      ],
      context: getRequestContext(request),
      details: {
        start_date: startDate,
        end_date: endDate,
        status_filter: status,
        expenses_count: expenses.length,
        total_amount: totalAmount,
        approved_amount: approvedAmount,
      },
    })

    // Retornar HTML que pode ser impresso como PDF pelo navegador
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio-despesas-${startDate}-${endDate}.html"`,
      },
    })
  } catch (error: any) {
    console.error("Erro ao gerar PDF:", error)
    return NextResponse.json({ error: error?.message || "Erro interno do servidor" }, { status: 502 })
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR')
}
