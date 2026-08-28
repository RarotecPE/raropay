import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canViewAllExpenses } from '@/lib/auth'

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
    const canViewAll = canViewAllExpenses(session.role)
    
    let expenses
    
    // Usar SELECT * para pegar todas as colunas disponíveis
    // Incluir rejection_reason da tabela expense_batches quando a despesa tiver batch_id
    // IMPORTANTE: Converter expense_date para string com TO_CHAR para evitar problemas de timezone
    // IMPORTANTE: Buscar requester_name da tabela users para exibir nome do solicitante
    if (!canViewAll) {
      // Usuário comum: SEMPRE filtrar por user_id
      if (status && status !== 'all') {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          WHERE e.status = ${status} AND e.user_id = ${session.id}
          ORDER BY e.created_at DESC
        `
      } else {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          WHERE e.user_id = ${session.id}
          ORDER BY e.created_at DESC
        `
      }
    } else {
      if (status && status !== 'all' && userId && userId !== 'all') {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          WHERE e.status = ${status} AND e.user_id = ${parseInt(userId)}
          ORDER BY e.created_at DESC
        `
      } else if (status && status !== 'all') {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          WHERE e.status = ${status}
          ORDER BY e.created_at DESC
        `
      } else if (userId && userId !== 'all') {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          WHERE e.user_id = ${parseInt(userId)}
          ORDER BY e.created_at DESC
        `
      } else {
        expenses = await sql`
          SELECT e.*, TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date, u.name as user_name,
                 COALESCE(e.rejection_reason, eb.rejection_reason) as rejection_reason,
                 e.paid, e.paid_at, e.paid_by,
                 r.name as requester_name
          FROM expenses e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN expense_batches eb ON e.batch_id = eb.id
          LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
          ORDER BY e.created_at DESC
        `
      }
    }

    return NextResponse.json(expenses)
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
        transport_type, transport_mode, origin, destination, distance_km, estimated_distance,
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
        ${extra_expenses ? JSON.stringify(extra_expenses) : null}, 
        ${linked_employees ? JSON.stringify(linked_employees) : null},
        ${linked_external_parties ? JSON.stringify(linked_external_parties) : null},
        ${meal_type || null}, ${meal_time || null}, ${establishment_name || null}, ${establishment_cnpj || null}, ${number_of_people || null},
        ${vehicle_id || null}, ${vehicle_plate || null}, ${km_before || null}, ${km_after || null}, ${total_km || calculatedTotalKm}, ${liters || null},
        ${fuel_type || null}, ${gas_station_name || null}, ${calculatedKmPerLiter},
        ${trip_type || null}, ${departure_city || null}, ${departure_state || null}, ${arrival_city || null}, ${arrival_state || null}, ${stops ? JSON.stringify(stops) : null}, ${is_round_trip || false}, ${is_irregular_route || false}, ${odometer_photos ? JSON.stringify(odometer_photos) : null},
        ${origin_lat ?? null}, ${origin_lng ?? null}, ${origin_place || null}, ${destination_lat ?? null}, ${destination_lng ?? null}, ${destination_place || null}, ${route_distance_km ?? null}, ${route_source || null},
        ${parking_name || null}, ${parking_cnpj || null}, ${parking_type || null}, ${parking_reason || null}, ${entry_time || null}, ${exit_time || null},
        ${transport_type || null}, ${transport_mode || null}, ${origin || null}, ${destination || null}, ${distance_km || null}, ${estimated_distance || null},
        ${store_type || null}, ${store_name || null}, ${items ? JSON.stringify(items) : null}, ${purchase_reason || null}, ${requester || null},
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

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('[v0] Erro ao criar despesa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor', details: String(error) }, { status: 500 })
  }
}
