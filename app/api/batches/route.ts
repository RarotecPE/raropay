import { sql } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { getSession, canViewAllExpenses } from "@/lib/auth"

// GET - Listar remessas
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const canViewAll = canViewAllExpenses(session.role)

    // Subquery para obter totais por categoria como JSON
    const categoryTotalsSubquery = `
      (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
       FROM (
         SELECT category, COALESCE(SUM(amount), 0) as total
         FROM expenses
         WHERE batch_id = b.id
         GROUP BY category
         ORDER BY total DESC
       ) cat_totals
      ) as category_totals
    `

    let batches
    
    if (!canViewAll) {
      // Usuário comum: só vê suas próprias remessas
      if (status) {
        // Se status = 'pending', incluir também 'correction' (para o usuário ver suas remessas aguardando correção)
        if (status === 'pending') {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.user_id = ${session.id} AND b.status IN ('pending', 'correction')
            ORDER BY b.created_at DESC
          `
        } else {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.user_id = ${session.id} AND b.status = ${status}
            ORDER BY b.created_at DESC
          `
        }
      } else {
        batches = await sql`
          SELECT 
            b.*,
            u.name as user_name,
            u.email as user_email,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
            (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
             FROM (
               SELECT category, COALESCE(SUM(amount), 0) as total
               FROM expenses
               WHERE batch_id = b.id
               GROUP BY category
               ORDER BY total DESC
             ) cat_totals
            ) as category_totals
          FROM expense_batches b
          JOIN users u ON b.user_id = u.id
          WHERE b.user_id = ${session.id}
          ORDER BY b.created_at DESC
        `
      }
    } else {
      // Admin/Financeiro: pode ver todas as remessas
      const userId = searchParams.get("user_id")
      
      if (userId && userId !== 'all' && status) {
        // Se status = 'pending', incluir também 'correction'
        if (status === 'pending') {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.user_id = ${parseInt(userId)} AND b.status IN ('pending', 'correction')
            ORDER BY b.created_at DESC
          `
        } else {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.user_id = ${parseInt(userId)} AND b.status = ${status}
            ORDER BY b.created_at DESC
          `
        }
      } else if (userId && userId !== 'all') {
        batches = await sql`
          SELECT 
            b.*,
            u.name as user_name,
            u.email as user_email,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
            (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
             FROM (
               SELECT category, COALESCE(SUM(amount), 0) as total
               FROM expenses
               WHERE batch_id = b.id
               GROUP BY category
               ORDER BY total DESC
             ) cat_totals
            ) as category_totals
          FROM expense_batches b
          JOIN users u ON b.user_id = u.id
          WHERE b.user_id = ${parseInt(userId)}
          ORDER BY b.created_at DESC
        `
      } else if (status) {
        // Se status = 'pending', incluir também 'correction' (ambos precisam de atenção do financeiro)
        if (status === 'pending') {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.status IN ('pending', 'correction')
            ORDER BY b.created_at DESC
          `
        } else {
          batches = await sql`
            SELECT 
              b.*,
              u.name as user_name,
              u.email as user_email,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
              (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
              (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
              (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
               FROM (
                 SELECT category, COALESCE(SUM(amount), 0) as total
                 FROM expenses
                 WHERE batch_id = b.id
                 GROUP BY category
                 ORDER BY total DESC
               ) cat_totals
              ) as category_totals
            FROM expense_batches b
            JOIN users u ON b.user_id = u.id
            WHERE b.status = ${status}
            ORDER BY b.created_at DESC
          `
        }
      } else {
        batches = await sql`
          SELECT 
            b.*,
            u.name as user_name,
            u.email as user_email,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) as expense_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'approved') as approved_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'rejected') as rejected_count,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND status = 'correction') as correction_count,
            (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE batch_id = b.id) as total_amount,
            (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) as paid_count,
            (SELECT COALESCE(json_agg(json_build_object('category', category, 'total', total)), '[]'::json)
             FROM (
               SELECT category, COALESCE(SUM(amount), 0) as total
               FROM expenses
               WHERE batch_id = b.id
               GROUP BY category
               ORDER BY total DESC
             ) cat_totals
            ) as category_totals
          FROM expense_batches b
          JOIN users u ON b.user_id = u.id
          ORDER BY b.created_at DESC
        `
      }
    }

    return NextResponse.json(batches)
  } catch (error) {
    console.error("Erro ao buscar remessas:", error)
    return NextResponse.json({ error: "Erro ao buscar remessas" }, { status: 500 })
  }
}

// POST - Criar nova remessa de prestação de contas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      user_id,
      expense_ids,
      settlement_type, // cartao_corporativo, adiantamento, reembolso, misto
      advance_balance, // positivo, negativo, zero (só para adiantamento)
      advance_exceeded, // boolean - se as despesas excederam o adiantamento
      advance_received_amount, // valor do adiantamento recebido
      advance_received_date, // data do adiantamento recebido
      balance_amount, // valor do saldo (positivo ou negativo)
      refund_method, // conta_bb, boleto (só se precisar reembolso)
      payment_data, // dados de pagamento (código de barras e PIX)
      observations,
    } = body

    if (!user_id || !expense_ids || expense_ids.length === 0) {
      return NextResponse.json(
        { error: "user_id e expense_ids são obrigatórios" },
        { status: 400 }
      )
    }

    // Buscar dados bancários do usuário para incluir na remessa
    const [userData] = await sql`
      SELECT bank_account, pix_key FROM users WHERE id = ${user_id}
    `

    // Verificar se todas as despesas pertencem ao usuário e estão processadas ou em correção
    const expenseIdsArray = expense_ids.map((id: number | string) => parseInt(String(id)))
    const expenses = await sql`
      SELECT id, expense_type, amount, status, batch_id 
      FROM expenses 
      WHERE id = ANY(${expenseIdsArray}) 
        AND user_id = ${user_id}
        AND status IN ('processed', 'correction')
    `

    if (expenses.length !== expense_ids.length) {
      return NextResponse.json(
        { error: "Algumas despesas não estão disponíveis para envio" },
        { status: 400 }
      )
    }

    // Calcular valor total
    const totalAmount = expenses.reduce((sum: number, exp: { amount: number }) => sum + Number(exp.amount), 0)

    // Determinar tipo de liquidação baseado nas despesas
    const expenseTypes = [...new Set(expenses.map((e: { expense_type: string }) => e.expense_type))]
    let finalSettlementType = settlement_type
    if (!finalSettlementType) {
      if (expenseTypes.length === 1) {
        finalSettlementType = expenseTypes[0]
      } else {
        finalSettlementType = 'misto'
      }
    }

    // Preparar dados bancários para salvar na remessa
    const bankAccountData = userData?.bank_account || userData?.pix_key ? {
      bank_account: userData.bank_account || null,
      pix: userData.pix_key || null
    } : null

    // Criar a remessa
    const [batch] = await sql`
      INSERT INTO expense_batches (
        user_id,
        settlement_type,
        advance_balance,
        advance_balance_amount,
        advance_exceeded,
        advance_received_amount,
        advance_received_date,
        refund_method,
        payment_data,
        bank_account_data,
        observations,
        total_amount,
        total_expenses,
        status
      ) VALUES (
        ${user_id},
        ${finalSettlementType},
        ${advance_balance || null},
        ${balance_amount || null},
        ${advance_exceeded ?? null},
        ${advance_received_amount || null},
        ${advance_received_date || null},
        ${refund_method || null},
        ${payment_data ? JSON.stringify(payment_data) : null},
        ${bankAccountData ? JSON.stringify(bankAccountData) : null},
        ${observations || null},
        ${totalAmount},
        ${expenses.length},
        'pending'
      )
      RETURNING *
    `

    // Atualizar as despesas com o batch_id e mudar status para submitted
    await sql`
      UPDATE expenses 
      SET batch_id = ${batch.id}, status = 'submitted', updated_at = NOW()
      WHERE id = ANY(${expenseIdsArray})
    `

    return NextResponse.json(batch, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar remessa:", error)
    return NextResponse.json({ error: "Erro ao criar remessa" }, { status: 500 })
  }
}
