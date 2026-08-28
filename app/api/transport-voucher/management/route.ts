import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canManageUsers } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Apenas financeiro, gestores, diretores e admin podem ver
    if (!canManageUsers(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Ler o mês selecionado (formato YYYY-MM). Se não informado, usa o mês atual.
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month') // ex: "2026-06"

    const now = new Date()
    let currentMonth = now.getMonth() + 1
    let currentYear = now.getFullYear()
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split('-').map(Number)
      currentYear = year
      currentMonth = month
    }
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // Buscar todos os usuários com vale-transporte habilitado e seus gastos do mês
    const usersWithVoucher = await sql`
      SELECT
        u.id,
        u.name,
        u.department,
        COALESCE(SUM(
          CASE WHEN e.category = 'transport_voucher'
               AND e.status != 'rejected'
               AND e.expense_date >= ${startOfMonth}::date
               AND e.expense_date <= ${endOfMonth}::date
          THEN e.amount ELSE 0 END
        ), 0) as used_amount,
        COUNT(
          CASE WHEN e.category = 'transport_voucher'
               AND e.status != 'rejected'
               AND e.expense_date >= ${startOfMonth}::date
               AND e.expense_date <= ${endOfMonth}::date
          THEN 1 END
        ) as transactions_count
      FROM users u
      LEFT JOIN expenses e ON e.user_id = u.id
      WHERE u.transport_voucher_enabled = true AND u.active = true
      GROUP BY u.id, u.name, u.department
      ORDER BY used_amount DESC, u.name
    `

    // Calcular totais (não há limite no vale-transporte)
    const totalUsed = usersWithVoucher.reduce((acc, u) => acc + Number(u.used_amount), 0)
    const totalTransactions = usersWithVoucher.reduce((acc, u) => acc + Number(u.transactions_count), 0)
    const usersCount = usersWithVoucher.length
    // Maior gasto individual do mês, usado como referência para comparação relativa
    const maxUsed = usersWithVoucher.reduce((acc, u) => Math.max(acc, Number(u.used_amount)), 0)
    const avgPerUser = usersCount > 0 ? totalUsed / usersCount : 0

    // Buscar histórico dos últimos 6 meses
    const history = await sql`
      SELECT
        TO_CHAR(e.expense_date, 'YYYY-MM') as month,
        COUNT(DISTINCT e.user_id) as users_count,
        COUNT(*) as transactions_count,
        SUM(e.amount) as total_amount
      FROM expenses e
      INNER JOIN users u ON u.id = e.user_id AND u.transport_voucher_enabled = true
      WHERE e.category = 'transport_voucher'
        AND e.status != 'rejected'
        AND e.expense_date >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY TO_CHAR(e.expense_date, 'YYYY-MM')
      ORDER BY month DESC
    `

    return NextResponse.json({
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        monthName: new Date(currentYear, currentMonth - 1).toLocaleString('pt-BR', { month: 'long' }),
        usersCount,
        totalUsed,
        totalTransactions,
        avgPerUser: Math.round(avgPerUser * 100) / 100,
        maxUsed,
      },
      users: usersWithVoucher.map(u => {
        const used = Number(u.used_amount)
        return {
          id: u.id,
          name: u.name,
          department: u.department,
          used,
          transactionsCount: Number(u.transactions_count),
          // Participação relativa ao maior gastador do mês (para comparação visual)
          sharePercent: maxUsed > 0 ? Math.round((used / maxUsed) * 100) : 0,
          // Participação no total do mês
          totalSharePercent: totalUsed > 0 ? Math.round((used / totalUsed) * 100) : 0,
        }
      }),
      history: history.map(h => {
        const [year, month] = (h.month as string).split('-').map(Number)
        const totalAmount = Number(h.total_amount) || 0
        const usersCountH = Number(h.users_count) || 0
        return {
          month,
          year,
          monthName: new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long' }),
          usersCount: usersCountH,
          transactionsCount: Number(h.transactions_count),
          totalUsed: totalAmount,
          avgPerUser: usersCountH > 0 ? Math.round((totalAmount / usersCountH) * 100) / 100 : 0,
        }
      }),
    })
  } catch (error) {
    console.error('[v0] Erro ao buscar dados de vale-transporte:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
