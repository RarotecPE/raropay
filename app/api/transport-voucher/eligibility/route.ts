import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Indica se o usuário logado pode lançar despesas de Vale-Transporte,
// e retorna o limite mensal (se houver) e o total já utilizado no mês.
// Query params:
//   - month: YYYY-MM (padrão: mês atual)
//   - excludeId: ID de despesa a excluir do total (usado ao EDITAR)
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const excludeIdParam = searchParams.get('excludeId')
    const excludeId = excludeIdParam ? parseInt(excludeIdParam) : null

    const result = await sql`
      SELECT transport_voucher_enabled, transport_voucher_limit
      FROM users
      WHERE id = ${session.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ enabled: false, limit: null, used: 0 })
    }

    const enabled = result[0].transport_voucher_enabled || false
    const limit = result[0].transport_voucher_limit !== null ? Number(result[0].transport_voucher_limit) : null

    // Intervalo do mês informado
    const startDate = `${month}-01`
    const [year, mon] = month.split('-').map(Number)
    const endDateObj = new Date(year, mon, 0) // último dia do mês
    const endDate = `${month}-${String(endDateObj.getDate()).padStart(2, '0')}`

    // Total utilizado no mês (todas as despesas de VT exceto rejeitadas),
    // excluindo a própria despesa quando estiver editando
    const usageRows = await sql`
      SELECT COALESCE(SUM(amount), 0) AS used
      FROM expenses
      WHERE user_id = ${session.id}
        AND category = 'transport_voucher'
        AND expense_date >= ${startDate}
        AND expense_date <= ${endDate}
        AND status != 'rejected'
        AND (${excludeId}::int IS NULL OR id != ${excludeId}::int)
    `

    const used = Number(usageRows[0]?.used || 0)

    return NextResponse.json({ enabled, limit, used })
  } catch (error) {
    console.error('[v0] Erro ao verificar elegibilidade do vale-transporte:', error)
    return NextResponse.json({ enabled: false, limit: null, used: 0 })
  }
}
