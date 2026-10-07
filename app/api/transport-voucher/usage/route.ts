import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Retorna o uso do vale-transporte do usuário logado no mês.
// O limite do VT é opcional: quando null, o benefício é ilimitado (apenas acompanhamento).
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || session.id
    const month = searchParams.get('month') // formato: YYYY-MM

    const targetMonth = month || new Date().toISOString().slice(0, 7)
    const [year, monthNum] = targetMonth.split('-').map(Number)

    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`

    const userResult = await sql`
      SELECT transport_voucher_enabled, transport_voucher_limit
      FROM users
      WHERE id = ${userId}
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const user = userResult[0]

    if (!user.transport_voucher_enabled) {
      return NextResponse.json({
        enabled: false,
        limit: null,
        used: 0,
        available: null,
        percentage: 0,
        expenses: [],
        history: [],
      })
    }

    // Limite pode ser null (ilimitado)
    const limit = user.transport_voucher_limit !== null ? parseFloat(user.transport_voucher_limit) : null

    // Despesas de vale-transporte do mês (todos os status exceto rejeitadas)
    const expenses = await sql`
      SELECT id, description, amount, expense_date, status, created_at
      FROM expenses
      WHERE user_id = ${userId}
        AND category = 'transport_voucher'
        AND expense_date >= ${startDate}
        AND expense_date <= ${endDate}
        AND status != 'rejected'
      ORDER BY expense_date DESC
    `

    const used = (expenses as any[]).reduce(
      (sum: number, exp: { amount: string | number }) => sum + parseFloat(String(exp.amount)),
      0,
    )

    const available = limit !== null ? Math.max(0, limit - used) : null
    const percentage = limit !== null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

    // Histórico dos últimos 3 meses
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const historyStartDate = threeMonthsAgo.toISOString().slice(0, 10)

    const history = await sql`
      SELECT
        TO_CHAR(expense_date, 'YYYY-MM') as month,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses
      WHERE user_id = ${userId}
        AND category = 'transport_voucher'
        AND expense_date >= ${historyStartDate}
        AND status != 'rejected'
      GROUP BY TO_CHAR(expense_date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 3
    `

    return NextResponse.json({
      enabled: true,
      limit,
      used: Math.round(used * 100) / 100,
      available,
      percentage,
      month: targetMonth,
      expenses,
      history,
    })
  } catch (error) {
    console.error('[v0] Erro ao buscar uso do vale-transporte:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
