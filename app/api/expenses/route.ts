import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canViewAllExpenses } from '@/lib/auth'
import { parsePaginationParams, buildPaginationMeta } from '@/lib/pagination'

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

// Listar despesas
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const userId = searchParams.get('userId') || searchParams.get('user_id')
    const search = searchParams.get('search')?.trim() || searchParams.get('q')?.trim() || ''
    const category = searchParams.get('category')
    const settlementType = searchParams.get('settlement_type') || searchParams.get('expense_type')
    const startDate = searchParams.get('startDate') || searchParams.get('start_date')
    const endDate = searchParams.get('endDate') || searchParams.get('end_date')
    const paidParam = searchParams.get('paid')
    const batchIdParam = searchParams.get('batch_id') || searchParams.get('batchId')

    const canViewAll = canViewAllExpenses(session.role)
    const isDraft = status === 'draft'

    // Paginação
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize') || searchParams.get('limit')
    const shouldPaginate = Boolean(pageParam || pageSizeParam || searchParams.get('paginate') === 'true')
    const { page, pageSize, offset, limit } = parsePaginationParams(searchParams, 15)

    // Regra estrita: Rascunhos são 100% pessoais do usuário logado.
    if (isDraft && userId && userId !== 'all' && parseInt(userId) !== session.id) {
      if (shouldPaginate) {
        return NextResponse.json({
          data: [],
          pagination: buildPaginationMeta(0, page, pageSize),
          summary: { totalAmount: 0, totalCount: 0 },
        })
      }
      return NextResponse.json([])
    }

    // Definir targetUserId de acordo com permissões
    let targetUserId: number | null = null
    if (isDraft || !canViewAll) {
      targetUserId = session.id
    } else if (userId && userId !== 'all') {
      targetUserId = parseInt(userId)
    }

    const parsedBatchId = batchIdParam && batchIdParam !== 'all' ? parseInt(batchIdParam) : null

    let expenses: any[]
    let totalCount = 0
    let totalAmount = 0

    if (shouldPaginate) {
      expenses = await sql`
        SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
               COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
               e.paid, e.paid_at, e.paid_by,
               r.name as requester_name,
                COUNT(*) OVER() as full_count,
                COALESCE(SUM(e.amount) OVER(), 0) as full_amount,
                COUNT(CASE WHEN e.paid = true THEN 1 END) OVER() as full_paid_count,
                COUNT(CASE WHEN e.paid = false OR e.paid IS NULL THEN 1 END) OVER() as full_unpaid_count,
                COALESCE(SUM(CASE WHEN e.paid = true THEN e.amount ELSE 0 END) OVER(), 0) as full_paid_amount,
                COALESCE(SUM(CASE WHEN e.paid = false OR e.paid IS NULL THEN e.amount ELSE 0 END) OVER(), 0) as full_unpaid_amount
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN expense_batches eb ON e.batch_id = eb.id
        LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
        WHERE
          (${targetUserId !== null}::boolean = false OR e.user_id = ${targetUserId ?? 0})
          AND (${targetUserId === null}::boolean = false OR (e.status != 'draft' OR e.user_id = ${session.id}))
          AND (${Boolean(status && status !== 'all')}::boolean = false OR e.status = ${status ?? ''})
          AND (${Boolean(category && category !== 'all')}::boolean = false OR e.category = ${category ?? ''})
          AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR e.expense_type = ${settlementType ?? ''})
          AND (${parsedBatchId !== null}::boolean = false OR e.batch_id = ${parsedBatchId ?? 0})
          AND (${Boolean(startDate)}::boolean = false OR e.expense_date >= ${startDate ?? '1970-01-01'}::date)
          AND (${Boolean(endDate)}::boolean = false OR e.expense_date <= ${endDate ?? '2999-12-31'}::date)
          AND (
            ${paidParam === 'paid' || paidParam === 'true'}::boolean = false 
            OR e.paid = true
          )
          AND (
            ${paidParam === 'unpaid' || paidParam === 'false'}::boolean = false 
            OR (e.paid = false OR e.paid IS NULL)
          )
          AND (
            ${Boolean(search)}::boolean = false 
            OR (e.description ILIKE ${'%' + search + '%'} OR u.name ILIKE ${'%' + search + '%'})
          )
        ORDER BY e.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      let paidCount = 0
      let unpaidCount = 0
      let paidAmount = 0
      let unpaidAmount = 0

      if (expenses.length > 0) {
        totalCount = Number(expenses[0].full_count || 0)
        totalAmount = Number(expenses[0].full_amount || 0)
        paidCount = Number(expenses[0].full_paid_count || 0)
        unpaidCount = Number(expenses[0].full_unpaid_count || 0)
        paidAmount = Number(expenses[0].full_paid_amount || 0)
        unpaidAmount = Number(expenses[0].full_unpaid_amount || 0)
      } else if (offset > 0) {
        // Se a página requisitada estiver fora do intervalo (ex: após deleção), buscar o count real
        const countRes = await sql`
          SELECT 
            COUNT(*) as count, 
            COALESCE(SUM(e.amount), 0) as total_amount,
            COUNT(CASE WHEN e.paid = true THEN 1 END) as paid_count,
            COUNT(CASE WHEN e.paid = false OR e.paid IS NULL THEN 1 END) as unpaid_count,
            COALESCE(SUM(CASE WHEN e.paid = true THEN e.amount ELSE 0 END), 0) as paid_amount,
            COALESCE(SUM(CASE WHEN e.paid = false OR e.paid IS NULL THEN e.amount ELSE 0 END), 0) as unpaid_amount
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          WHERE
            (${targetUserId !== null}::boolean = false OR e.user_id = ${targetUserId ?? 0})
            AND (${targetUserId === null}::boolean = false OR (e.status != 'draft' OR e.user_id = ${session.id}))
            AND (${Boolean(status && status !== 'all')}::boolean = false OR e.status = ${status ?? ''})
            AND (${Boolean(category && category !== 'all')}::boolean = false OR e.category = ${category ?? ''})
            AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR e.expense_type = ${settlementType ?? ''})
            AND (${parsedBatchId !== null}::boolean = false OR e.batch_id = ${parsedBatchId ?? 0})
            AND (${Boolean(startDate)}::boolean = false OR e.expense_date >= ${startDate ?? '1970-01-01'}::date)
            AND (${Boolean(endDate)}::boolean = false OR e.expense_date <= ${endDate ?? '2999-12-31'}::date)
            AND (
              ${paidParam === 'paid' || paidParam === 'true'}::boolean = false 
              OR e.paid = true
            )
            AND (
              ${paidParam === 'unpaid' || paidParam === 'false'}::boolean = false 
              OR (e.paid = false OR e.paid IS NULL)
            )
            AND (
              ${Boolean(search)}::boolean = false 
              OR (e.description ILIKE ${'%' + search + '%'} OR u.name ILIKE ${'%' + search + '%'})
            )
        `
        totalCount = Number(countRes[0]?.count || 0)
        totalAmount = Number(countRes[0]?.total_amount || 0)
        paidCount = Number(countRes[0]?.paid_count || 0)
        unpaidCount = Number(countRes[0]?.unpaid_count || 0)
        paidAmount = Number(countRes[0]?.paid_amount || 0)
        unpaidAmount = Number(countRes[0]?.unpaid_amount || 0)
      }

      const sanitizedData = expenses.map(({ full_count, full_amount, full_paid_count, full_unpaid_count, full_paid_amount, full_unpaid_amount, ...item }) => item)

      return NextResponse.json({
        data: sanitizedData,
        pagination: buildPaginationMeta(totalCount, page, pageSize),
        summary: {
          totalAmount,
          totalCount,
          paidCount,
          unpaidCount,
          paidAmount,
          unpaidAmount,
        },
      })
    } else {
      // Modo legado não-paginado (mantém 100% de retrocompatibilidade)
      expenses = await sql`
        SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
               COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
               e.paid, e.paid_at, e.paid_by,
               r.name as requester_name
        FROM expenses e
        JOIN users u ON e.user_id = u.id
        LEFT JOIN expense_batches eb ON e.batch_id = eb.id
        LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
        WHERE
          (${targetUserId !== null}::boolean = false OR e.user_id = ${targetUserId ?? 0})
          AND (${targetUserId === null}::boolean = false OR (e.status != 'draft' OR e.user_id = ${session.id}))
          AND (${Boolean(status && status !== 'all')}::boolean = false OR e.status = ${status ?? ''})
          AND (${Boolean(category && category !== 'all')}::boolean = false OR e.category = ${category ?? ''})
          AND (${Boolean(settlementType && settlementType !== 'all')}::boolean = false OR e.expense_type = ${settlementType ?? ''})
          AND (${parsedBatchId !== null}::boolean = false OR e.batch_id = ${parsedBatchId ?? 0})
          AND (${Boolean(startDate)}::boolean = false OR e.expense_date >= ${startDate ?? '1970-01-01'}::date)
          AND (${Boolean(endDate)}::boolean = false OR e.expense_date <= ${endDate ?? '2999-12-31'}::date)
          AND (
            ${paidParam === 'paid' || paidParam === 'true'}::boolean = false 
            OR e.paid = true
          )
          AND (
            ${paidParam === 'unpaid' || paidParam === 'false'}::boolean = false 
            OR (e.paid = false OR e.paid IS NULL)
          )
          AND (
            ${Boolean(search)}::boolean = false 
            OR (e.description ILIKE ${'%' + search + '%'} OR u.name ILIKE ${'%' + search + '%'})
          )
        ORDER BY e.created_at DESC
      `

      return NextResponse.json(expenses)
    }
  } catch (error) {
    console.error('[v0] Erro ao buscar despesas:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}

// Criar despesa
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    
    const {
      expense_type,
      category,
      description,
      amount,
      expense_date,
      municipality,
      state,
      status,
      receipt_pathname,
      location_type,
      // Hospedagem
      accommodation_name,
      accommodation_cnpj,
      checkin_date,
      checkout_date,
      nights_count,
      daily_rate,
      is_capital,
      has_breakfast,
      single_room_qty,
      single_room_value,
      double_room_qty,
      double_room_value,
      triple_room_qty,
      triple_room_value,
      extra_expenses,
      linked_employees,
      linked_external_parties,
      // Alimentação
      meal_type,
      meal_time,
      establishment_name,
      establishment_cnpj,
      number_of_people,
      // Combustível
      vehicle_id,
      vehicle_plate,
      km_before,
      km_after,
      total_km,
      liters,
      fuel_type,
      gas_station_name,
      trip_type,
      departure_city,
      departure_state,
      arrival_city,
      arrival_state,
      stops,
      is_irregular_route,
      odometer_photos,
      // Localização precisa (endereço/estabelecimento) e rota real
      origin_lat,
      origin_lng,
      origin_place,
      destination_lat,
      destination_lng,
      destination_place,
      route_distance_km,
      route_source,
      // Estacionamento
      parking_name,
      parking_cnpj,
      parking_type,
      parking_reason,
      entry_time,
      exit_time,
      // Deslocamento
      transport_type,
      transport_mode,
      transport_voucher_type,
      origin,
      destination,
      distance_km,
      estimated_distance,
      is_round_trip,
      // Itens/Compras
      store_type,
      store_name,
      items,
      purchase_reason,
      requester,
      // Parcelas
      installments,
      current_installment,
      // Identificação (controle gerencial)
      made_by_self,
      made_by_employee_name,
      participated,
      // Pagamento
      payment_barcode,
      pix_code,
      // Terceiros
      third_party_name,
      third_party_cpf,
    } = body

    if (!expense_type || !category || amount === undefined || !expense_date) {
      return NextResponse.json({ error: 'Campos obrigatórios não preenchidos' }, { status: 400 })
    }

  // Mapear status: 'processed' ou 'pending' vão para 'processed', qualquer outro vai para 'draft'
  // O formulário envia 'processed' quando clica em Processar, 'draft' quando clica em Salvar Rascunho
  const finalStatus = (status === 'processed' || status === 'pending') ? 'processed' : 'draft'
    
    // Calcular km_per_liter se aplicável
    let calculatedKmPerLiter = null
    let calculatedTotalKm = null
    if (km_before && km_after && liters && parseFloat(liters) > 0) {
      calculatedTotalKm = parseFloat(km_after) - parseFloat(km_before)
      calculatedKmPerLiter = calculatedTotalKm / parseFloat(liters)
    }

    // Verificar limites da categoria
    let exceedsLimit = false
    let limitExceededReason = null
    const parsedAmount = parseFloat(amount)
    
    if (category === 'accommodation') {
      // Hospedagem: buscar limite baseado em capital ou interior
      const subCategory = is_capital ? 'capital' : 'interior'
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category} AND sub_category = ${subCategory}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      if (categoryLimit && categoryLimit.daily_limit > 0) {
        const totalPeople = (single_room_qty || 0) + ((double_room_qty || 0) * 2) + ((triple_room_qty || 0) * 3) || 1
        const totalNights = nights_count || 1
        const dailyPerPerson = parsedAmount / totalNights / totalPeople
        
        if (dailyPerPerson > categoryLimit.daily_limit) {
          exceedsLimit = true
          limitExceededReason = `Média diária/pessoa (R$ ${dailyPerPerson.toFixed(2)}) excede limite de R$ ${categoryLimit.daily_limit} (${is_capital ? 'Capital' : 'Interior'})`
        }
      }
    } else if (category === 'food') {
      // Alimentação: buscar limite baseado no tipo de refeição (breakfast, lunch, dinner)
      const mealTypeMap: Record<string, string> = {
        'Café da Manhã': 'breakfast',
        'Almoço': 'lunch',
        'Jantar': 'dinner'
      }
      const subCategory = mealTypeMap[meal_type] || 'lunch'
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category} AND sub_category = ${subCategory}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      if (categoryLimit && categoryLimit.daily_limit > 0) {
        const totalPeople = number_of_people || 1
        const perPerson = parsedAmount / totalPeople
        
        if (perPerson > categoryLimit.daily_limit) {
          exceedsLimit = true
          limitExceededReason = `Média por pessoa (R$ ${perPerson.toFixed(2)}) excede limite de R$ ${categoryLimit.daily_limit} (${meal_type})`
        }
      }
    } else if (category === 'fuel') {
      // Combustível: verificar km/l mínimo
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      if (categoryLimit && categoryLimit.min_km_per_liter > 0 && calculatedKmPerLiter) {
        if (calculatedKmPerLiter < categoryLimit.min_km_per_liter) {
          exceedsLimit = true
          limitExceededReason = `Km/L (${calculatedKmPerLiter.toFixed(2)}) abaixo do mínimo de ${categoryLimit.min_km_per_liter} km/l`
        }
      }
    }

    const result = await sql`
      INSERT INTO expenses (
        user_id, expense_type, category, description, amount,
        expense_date, municipality, state, status, receipt_pathname, location_type,
        accommodation_name, accommodation_cnpj, checkin_date, checkout_date, daily_rate, 
        is_capital, has_breakfast, nights_count,
        single_room_qty, single_room_value, double_room_qty, double_room_value,
        triple_room_qty, triple_room_value, extra_expenses, linked_employees, linked_external_parties,
        meal_type, meal_time, establishment_name, establishment_cnpj, number_of_people,
        vehicle_id, vehicle_plate, km_before, km_after, total_km, liters, 
        fuel_type, gas_station_name, km_per_liter,
        trip_type, departure_city, departure_state, arrival_city, arrival_state, stops, is_round_trip, is_irregular_route, odometer_photos,
        origin_lat, origin_lng, origin_place, destination_lat, destination_lng, destination_place, route_distance_km, route_source,
        parking_name, parking_cnpj, parking_type, parking_reason, entry_time, exit_time,
        transport_type, transport_mode, transport_voucher_type, origin, destination, distance_km, estimated_distance,
        store_type, store_name, items, purchase_reason, requester,
        installments, current_installment,
        made_by_self, made_by_employee_name, participated,
        payment_barcode, pix_code,
        third_party_name, third_party_cpf,
        exceeds_limit, limit_exceeded_reason
      ) VALUES (
        ${session.id}, ${expense_type}, ${category}, ${description || null}, ${amount},
        ${expense_date}, ${municipality || null}, ${state || null}, ${finalStatus}, ${receipt_pathname || null}, ${location_type || null},
        ${accommodation_name || null}, ${accommodation_cnpj || null}, ${checkin_date || null}, ${checkout_date || null}, ${daily_rate || null},
        ${is_capital || false}, ${has_breakfast || false}, ${nights_count || null},
        ${single_room_qty || null}, ${single_room_value || null}, ${double_room_qty || null}, ${double_room_value || null},
        ${triple_room_qty || null}, ${triple_room_value || null}, 
        ${safeJson(extra_expenses) ? sql.json(safeJson(extra_expenses)) : null}, 
        ${safeJson(linked_employees) ? sql.json(safeJson(linked_employees)) : null},
        ${safeJson(linked_external_parties) ? sql.json(safeJson(linked_external_parties)) : null},
        ${meal_type || null}, ${meal_time || null}, ${establishment_name || null}, ${establishment_cnpj || null}, ${number_of_people || null},
        ${vehicle_id || null}, ${vehicle_plate || null}, ${km_before || null}, ${km_after || null}, ${total_km || calculatedTotalKm}, ${liters || null},
        ${fuel_type || null}, ${gas_station_name || null}, ${calculatedKmPerLiter},
        ${trip_type || null}, ${departure_city || null}, ${departure_state || null}, ${arrival_city || null}, ${arrival_state || null}, ${safeJson(stops) ? sql.json(safeJson(stops)) : null}, ${is_round_trip || false}, ${is_irregular_route || false}, ${safeJson(odometer_photos) ? sql.json(safeJson(odometer_photos)) : null},
        ${origin_lat ?? null}, ${origin_lng ?? null}, ${origin_place || null}, ${destination_lat ?? null}, ${destination_lng ?? null}, ${destination_place || null}, ${route_distance_km ?? null}, ${route_source || null},
        ${parking_name || null}, ${parking_cnpj || null}, ${parking_type || null}, ${parking_reason || null}, ${entry_time || null}, ${exit_time || null},
        ${transport_type || null}, ${transport_mode || null}, ${transport_voucher_type || null}, ${origin || null}, ${destination || null}, ${distance_km || null}, ${estimated_distance || null},
        ${store_type || null}, ${store_name || null}, ${safeJson(items) ? sql.json(safeJson(items)) : null}, ${purchase_reason || null}, ${requester || null},
        ${installments || 1}, ${current_installment || 1},
        ${made_by_self !== false}, ${made_by_employee_name || null}, ${participated !== false},
        ${payment_barcode || null}, ${pix_code || null},
        ${third_party_name || null}, ${third_party_cpf || null},
        ${exceedsLimit}, ${limitExceededReason}
      )
      RETURNING *
    `

    await sql`
      INSERT INTO expense_history (expense_id, action, user_id, new_status)
      VALUES (${result[0].id}, 'Despesa criada', ${session.id}, ${finalStatus})
    `

    const created = result[0]
    if (created && finalStatus !== 'draft') {
      const { auditClient, getRequestContext } = await import('@/lib/audit')
      auditClient.log({
        category: 'finance',
        action: 'expense.created',
        severity: exceedsLimit ? 'WARNING' : 'INFO',
        actor: {
          type: 'user',
          userId: String(session.id),
          name: session.name,
          email: session.email,
          role: session.role,
        },
        targets: [
          {
            type: 'expense',
            id: String(created.id),
            label: `Despesa #${created.id} - ${category} (R$ ${parsedAmount.toFixed(2)})`,
          },
          {
            type: 'user',
            id: String(session.id),
            label: `${session.name} (${session.email})`,
          },
        ],
        context: getRequestContext(request),
        details: {
          expense_id: created.id,
          user_id: session.id,
          user_name: session.name,
          expense_type,
          category,
          description: description || null,
          amount: parsedAmount,
          expense_date,
          municipality: municipality || null,
          state: state || null,
          status: finalStatus,
          hasReceipt: Boolean(created.receipt_pathname || receipt_pathname),
          receipt_pathname: created.receipt_pathname || receipt_pathname || null,
          ...(created.odometer_photos ? { odometer_photos: created.odometer_photos } : {}),
          exceeds_limit: exceedsLimit,
          limit_exceeded_reason: limitExceededReason,
        },
      })
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[v0] Erro ao criar despesa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}
