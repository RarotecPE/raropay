import { sql } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { getSession, canViewAllExpenses } from "@/lib/auth"
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination"

function safeJson(val: any) {
  if (!val) return null
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

// GET - Listar remessas
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const userId = searchParams.get("user_id") || searchParams.get("userId")
    const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim() || ''
    const settlementType = searchParams.get("settlement_type") || searchParams.get("settlementType")
    const startDate = searchParams.get("startDate") || searchParams.get("start_date")
    const endDate = searchParams.get("endDate") || searchParams.get("end_date")
    const batchIdParam = searchParams.get("batch_id") || searchParams.get("id")
    const paidStatus = searchParams.get("paid_status") || searchParams.get("paidStatus")

    const canViewAll = canViewAllExpenses(session.role)

    // Paginação
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("pageSize") || searchParams.get("limit")
    const shouldPaginate = Boolean(pageParam || pageSizeParam || searchParams.get("paginate") === "true")
    const { page, pageSize, offset, limit } = parsePaginationParams(searchParams, 10)

    let targetUserId: number | null = null
    if (!canViewAll) {
      targetUserId = session.id
    } else if (userId && userId !== 'all') {
      targetUserId = parseInt(userId)
    }

    const parsedBatchId = batchIdParam && batchIdParam !== 'all' ? parseInt(batchIdParam.replace('#', '')) : null
    const isPendingOrCorrection = status === 'pending'

    let batches: any[]
    let totalCount = 0
    let totalAmount = 0

    if (shouldPaginate) {
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
          ) as category_totals,
          COUNT(*) OVER() as full_count,
          COALESCE(SUM(b.total_amount) OVER(), 0) as full_amount
        FROM expense_batches b
        JOIN users u ON b.user_id = u.id
        WHERE
          (${targetUserId !== null}::boolean = false OR b.user_id = ${targetUserId ?? 0})
          AND (${isPendingOrCorrection}::boolean = false OR b.status IN ('pending', 'correction'))
          AND (
            (${!isPendingOrCorrection && Boolean(status && status !== 'all')}::boolean = false)
            OR b.status = ${status ?? ''}
          )
          AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR b.settlement_type = ${settlementType ?? ''})
          AND (${parsedBatchId !== null}::boolean = false OR b.id = ${parsedBatchId ?? 0})
          AND (${Boolean(startDate)}::boolean = false OR b.created_at >= ${startDate ?? '1970-01-01'}::date)
          AND (${Boolean(endDate)}::boolean = false OR b.created_at <= (${endDate ?? '2999-12-31'}::date + interval '1 day'))
          AND (
            ${Boolean(search)}::boolean = false
            OR (
              CAST(b.id AS TEXT) LIKE ${'%' + search.replace('#', '') + '%'}
              OR u.name ILIKE ${'%' + search + '%'}
              OR u.email ILIKE ${'%' + search + '%'}
            )
          )
          AND (
            ${!paidStatus || paidStatus === 'all'}::boolean = true
            OR (${paidStatus === 'paid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) = 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) > 0)
            OR (${paidStatus === 'unpaid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) = 0)
            OR (${paidStatus === 'partial'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) > 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) > 0)
          )
        ORDER BY b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      if (batches.length > 0) {
        totalCount = Number(batches[0].full_count || 0)
        totalAmount = Number(batches[0].full_amount || 0)
      } else if (offset > 0) {
        const countRes = await sql`
          SELECT COUNT(*) as count, COALESCE(SUM(b.total_amount), 0) as total_amount
          FROM expense_batches b
          JOIN users u ON b.user_id = u.id
          WHERE
            (${targetUserId !== null}::boolean = false OR b.user_id = ${targetUserId ?? 0})
            AND (${isPendingOrCorrection}::boolean = false OR b.status IN ('pending', 'correction'))
            AND (
              (${!isPendingOrCorrection && Boolean(status && status !== 'all')}::boolean = false)
              OR b.status = ${status ?? ''}
            )
            AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR b.settlement_type = ${settlementType ?? ''})
            AND (${parsedBatchId !== null}::boolean = false OR b.id = ${parsedBatchId ?? 0})
            AND (${Boolean(startDate)}::boolean = false OR b.created_at >= ${startDate ?? '1970-01-01'}::date)
            AND (${Boolean(endDate)}::boolean = false OR b.created_at <= (${endDate ?? '2999-12-31'}::date + interval '1 day'))
            AND (
              ${Boolean(search)}::boolean = false
              OR (
                CAST(b.id AS TEXT) LIKE ${'%' + search.replace('#', '') + '%'}
                OR u.name ILIKE ${'%' + search + '%'}
                OR u.email ILIKE ${'%' + search + '%'}
              )
            )
            AND (
              ${!paidStatus || paidStatus === 'all'}::boolean = true
              OR (${paidStatus === 'paid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) = 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) > 0)
              OR (${paidStatus === 'unpaid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) = 0)
              OR (${paidStatus === 'partial'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) > 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) > 0)
            )
        `
        totalCount = Number(countRes[0]?.count || 0)
        totalAmount = Number(countRes[0]?.total_amount || 0)
      }

      const [statusCountsRes] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'correction') as correction,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) as all_count
        FROM expense_batches b
        WHERE (${targetUserId !== null}::boolean = false OR b.user_id = ${targetUserId ?? 0})
      `

      const sanitizedData = batches.map(({ full_count, full_amount, ...b }) => b)

      return NextResponse.json({
        data: sanitizedData,
        pagination: buildPaginationMeta(totalCount, page, pageSize),
        summary: {
          totalAmount,
          totalCount,
          statusCounts: {
            pending: Number(statusCountsRes?.pending || 0),
            correction: Number(statusCountsRes?.correction || 0),
            approved: Number(statusCountsRes?.approved || 0),
            rejected: Number(statusCountsRes?.rejected || 0),
            all: Number(statusCountsRes?.all_count || 0),
          },
        },
      })
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
        WHERE
          (${targetUserId !== null}::boolean = false OR b.user_id = ${targetUserId ?? 0})
          AND (${isPendingOrCorrection}::boolean = false OR b.status IN ('pending', 'correction'))
          AND (
            (${!isPendingOrCorrection && Boolean(status && status !== 'all')}::boolean = false)
            OR b.status = ${status ?? ''}
          )
          AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR b.settlement_type = ${settlementType ?? ''})
          AND (${parsedBatchId !== null}::boolean = false OR b.id = ${parsedBatchId ?? 0})
          AND (${Boolean(startDate)}::boolean = false OR b.created_at >= ${startDate ?? '1970-01-01'}::date)
          AND (${Boolean(endDate)}::boolean = false OR b.created_at <= (${endDate ?? '2999-12-31'}::date + interval '1 day'))
          AND (
            ${Boolean(search)}::boolean = false
            OR (
              CAST(b.id AS TEXT) LIKE ${'%' + search.replace('#', '') + '%'}
              OR u.name ILIKE ${'%' + search + '%'}
              OR u.email ILIKE ${'%' + search + '%'}
            )
          )
          AND (
            ${!paidStatus || paidStatus === 'all'}::boolean = true
            OR (${paidStatus === 'paid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) = 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id) > 0)
            OR (${paidStatus === 'unpaid'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) = 0)
            OR (${paidStatus === 'partial'}::boolean = true AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = true) > 0 AND (SELECT COUNT(*) FROM expenses WHERE batch_id = b.id AND paid = false) > 0)
          )
        ORDER BY b.created_at DESC
      `

      return NextResponse.json(batches)
    }
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
    const totalAmount = (expenses as any[]).reduce((sum: number, exp: { amount: number }) => sum + Number(exp.amount), 0)

    // Determinar tipo de liquidação baseado nas despesas
    const expenseTypes = [...new Set((expenses as any[]).map((e: { expense_type: string }) => e.expense_type))]
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
        ${safeJson(payment_data) ? sql.json(safeJson(payment_data)) : null},
        ${safeJson(bankAccountData) ? sql.json(safeJson(bankAccountData)) : null},
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
