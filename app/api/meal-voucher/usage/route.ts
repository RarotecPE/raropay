import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Retorna o uso do vale-refeição do usuário no mês atual
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || session.id
    const month = searchParams.get('month') // formato: YYYY-MM
    // ID de uma despesa a excluir do total (usado ao EDITAR, para não contar a própria despesa em dobro)
    const excludeIdParam = searchParams.get('excludeId')
    const excludeId = excludeIdParam ? parseInt(excludeIdParam) : null
    
    // Se não especificado, usa o mês atual
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    const [year, monthNum] = targetMonth.split('-').map(Number)
    
    // Primeiro dia e último dia do mês
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`

    // Buscar dados do usuário (limite e se está habilitado)
    const userResult = await sql`
      SELECT meal_voucher_enabled, meal_voucher_limit 
      FROM users 
      WHERE id = ${userId}
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const user = userResult[0]
    
    if (!user.meal_voucher_enabled) {
      return NextResponse.json({ 
        enabled: false,
        limit: 0,
        used: 0,
        available: 0,
        expenses: []
      })
    }

    const limit = parseFloat(user.meal_voucher_limit) || 250.00

    // Buscar despesas de vale-refeição do mês (todos os status exceto rejeitadas)
    // Ao editar uma despesa, ela é excluída do cálculo para não ser contada em dobro
    const expenses = await sql`
      SELECT id, description, amount, expense_date, status, created_at
      FROM expenses
      WHERE user_id = ${userId}
        AND category = 'meal_voucher'
        AND expense_date >= ${startDate}
        AND expense_date <= ${endDate}
        AND status != 'rejected'
        AND (${excludeId}::int IS NULL OR id != ${excludeId}::int)
      ORDER BY expense_date DESC
    `

    // Calcular total usado
    const used = (expenses as any[]).reduce((sum: number, exp: { amount: string | number }) => 
      sum + parseFloat(String(exp.amount)), 0)
    
    const available = Math.max(0, limit - used)

    // Buscar histórico dos últimos 3 meses
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
        AND category = 'meal_voucher'
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
      available: Math.round(available * 100) / 100,
      percentage: Math.min(100, Math.round((used / limit) * 100)),
      month: targetMonth,
      expenses,
      history
    })
  } catch (error) {
    console.error('Erro ao buscar uso do vale-refeição:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
