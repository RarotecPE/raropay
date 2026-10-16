import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canViewAllExpenses } from '@/lib/auth'
import { deleteFile } from '@/lib/r2-storage'

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

// Buscar despesa por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

    const expenses = await sql`
      SELECT e.*, 
             TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date,
             u.name as user_name, 
             a.name as approver_name,
             v.model as vehicle_model,
             v.brand as vehicle_brand,
             v.fuel_type as vehicle_fuel_type,
             COALESCE(d.name, o.name) as vehicle_owner_name,
             e.fuel_type as fuel_type,
             r.name as requester_name
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users a ON e.approved_by = a.id
      LEFT JOIN vehicles v ON e.vehicle_id = v.id
      LEFT JOIN users d ON v.driver_id = d.id
      LEFT JOIN users o ON v.owner_id = o.id
      LEFT JOIN users r ON e.requester IS NOT NULL AND e.requester ~ '^[0-9]+$' AND r.id = CAST(e.requester AS INTEGER)
      WHERE e.id = ${expenseId}
    `

    if (expenses.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = expenses[0]

    // Verificar permissão: rascunhos são estritamente privados do autor
    if (expense.status === 'draft' && expense.user_id !== session.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar permissão
    if (expense.user_id !== session.id && !canViewAllExpenses(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Buscar histórico
    const history = await sql`
      SELECT h.*, u.name as user_name
      FROM expense_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.expense_id = ${expenseId}
      ORDER BY h.created_at DESC
    `

    return NextResponse.json({ expense, history })
  } catch (error) {
    console.error('Erro ao buscar despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Atualizar despesa
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

    // Verificar se a despesa existe e pertence ao usuário
    const existing = await sql`
      SELECT * FROM expenses WHERE id = ${expenseId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = existing[0]

    // Apenas o dono pode editar, e apenas se estiver em rascunho ou rejeitada
    if (expense.user_id !== session.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (!['draft', 'rejected', 'correction'].includes(expense.status)) {
      return NextResponse.json(
        { error: 'Apenas despesas em rascunho, rejeitadas ou em correção podem ser editadas' },
        { status: 400 }
      )
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
    } = body

    // Determinar o novo status baseado na situação:
    // - Se estava em correção e foi reenviada, volta para 'pending' (para análise do financeiro)
    // Lógica de status:
    // - 'draft' = rascunho, ainda não finalizada
    // - 'processed' = finalizada, pronta para incluir em uma remessa
    // - 'pending' = já está em uma remessa aguardando análise (só pode ser definido pelo sistema quando tem batch_id)
    let newStatus: string
    if (status === 'draft') {
      newStatus = 'draft'
    } else if (expense.status === 'correction' || expense.status === 'rejected') {
      // Despesa corrigida volta para pending se já tem batch_id, senão vai para processed
      newStatus = expense.batch_id ? 'pending' : 'processed'
    } else if (expense.batch_id) {
      // Se já está em uma remessa, pode ir para pending
      newStatus = 'pending'
    } else {
      // Sem remessa, vai para processed (pronta para incluir em uma remessa)
      // NUNCA colocar como 'pending' sem batch_id para evitar despesas órfãs
      newStatus = 'processed'
    }

    // Verificar limites da categoria
    let exceedsLimit = false
    let limitExceededReason = null
    const parsedAmount = parseFloat(amount)
    
    if (category === 'accommodation') {
      // Hospedagem: buscar limite baseado em capital ou interior
      const subCategory = body.is_capital ? 'capital' : 'interior'
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category} AND sub_category = ${subCategory}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      if (categoryLimit && categoryLimit.daily_limit > 0) {
        const singleQty = body.single_room_qty || 0
        const doubleQty = body.double_room_qty || 0
        const tripleQty = body.triple_room_qty || 0
        const totalPeople = singleQty + (doubleQty * 2) + (tripleQty * 3) || 1
        const totalNights = body.nights_count || 1
        const dailyPerPerson = parsedAmount / totalNights / totalPeople
        
        if (dailyPerPerson > categoryLimit.daily_limit) {
          exceedsLimit = true
          limitExceededReason = `Média diária/pessoa (R$ ${dailyPerPerson.toFixed(2)}) excede limite de R$ ${categoryLimit.daily_limit} (${body.is_capital ? 'Capital' : 'Interior'})`
        }
      }
    } else if (category === 'food') {
      // Alimentação: buscar limite baseado no tipo de refeição
      const mealTypeMap: Record<string, string> = {
        'Café da Manhã': 'breakfast',
        'Almoço': 'lunch',
        'Jantar': 'dinner'
      }
      const subCategory = mealTypeMap[body.meal_type] || 'lunch'
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category} AND sub_category = ${subCategory}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      if (categoryLimit && categoryLimit.daily_limit > 0) {
        const totalPeople = body.number_of_people || 1
        const perPerson = parsedAmount / totalPeople
        
        if (perPerson > categoryLimit.daily_limit) {
          exceedsLimit = true
          limitExceededReason = `Média por pessoa (R$ ${perPerson.toFixed(2)}) excede limite de R$ ${categoryLimit.daily_limit} (${body.meal_type})`
        }
      }
    } else if (category === 'fuel') {
      // Combustível: verificar km/l mínimo
      const limitsResult = await sql`SELECT * FROM category_limits WHERE category = ${category}`
      const categoryLimit = limitsResult.length > 0 ? limitsResult[0] : null
      
      // Calcular km/l se possível
      let calculatedKmPerLiter = null
      if (body.km_before && body.km_after && body.liters && parseFloat(body.liters) > 0) {
        const totalKm = parseFloat(body.km_after) - parseFloat(body.km_before)
        calculatedKmPerLiter = totalKm / parseFloat(body.liters)
      }
      
      if (categoryLimit && categoryLimit.min_km_per_liter > 0 && calculatedKmPerLiter) {
        if (calculatedKmPerLiter < categoryLimit.min_km_per_liter) {
          exceedsLimit = true
          limitExceededReason = `Km/L (${calculatedKmPerLiter.toFixed(2)}) abaixo do mínimo de ${categoryLimit.min_km_per_liter} km/l`
        }
      }
    }

    // Campos específicos por categoria
    const transport_type = body.transport_type || null
    const transport_mode = body.transport_mode || null
    const transport_voucher_type = body.transport_voucher_type || null
    const departure_city = body.departure_city || null
    const departure_state = body.departure_state || null
    const arrival_city = body.arrival_city || null
    const arrival_state = body.arrival_state || null
    const distance_km = body.distance_km || null
    const stops = body.stops || null
    const is_irregular_route = body.is_irregular_route || false
    // Localização precisa (endereço/estabelecimento) e rota real
    const origin_lat = body.origin_lat ?? null
    const origin_lng = body.origin_lng ?? null
    const origin_place = body.origin_place || null
    const destination_lat = body.destination_lat ?? null
    const destination_lng = body.destination_lng ?? null
    const destination_place = body.destination_place || null
    const route_distance_km = body.route_distance_km ?? null
    const route_source = body.route_source || null

    const meal_type = body.meal_type || null
    const establishment_name = body.establishment_name || null
    const number_of_people = body.number_of_people || null

    const fuel_type = body.fuel_type || null
    const gas_station_name = body.gas_station_name || null
    const liters = body.liters || null
    const price_per_liter = body.price_per_liter || null
    const vehicle_plate = body.vehicle_plate || null
    const km_before = body.km_before || null
    const km_after = body.km_after || null
    const total_km = body.total_km || null
    const odometer_photos = body.odometer_photos || null

    const parking_name = body.parking_name || null
    const parking_type = body.parking_type || null
    const parking_reason = body.parking_reason || null

    const accommodation_name = body.accommodation_name || null
    const checkin_date = body.checkin_date || null
    const checkout_date = body.checkout_date || null
    const nights_count = body.nights_count || null

    // Identificação (controle gerencial)
    const made_by_self = body.made_by_self !== false
    const made_by_employee_name = made_by_self ? null : (body.made_by_employee_name || null)
    const participated = made_by_self ? true : (body.participated !== false)

    const result = await sql`
      UPDATE expenses SET
        expense_type = ${expense_type},
        category = ${category},
        description = ${description || null},
        amount = ${amount},
        expense_date = ${expense_date},
        municipality = ${municipality || null},
        state = ${state || null},
        status = ${newStatus},
        receipt_pathname = ${receipt_pathname || expense.receipt_pathname},
        rejection_reason = NULL,
        exceeds_limit = ${exceedsLimit},
        limit_exceeded_reason = ${limitExceededReason},
        transport_type = ${transport_type},
        transport_mode = ${transport_mode},
        transport_voucher_type = ${transport_voucher_type},
        departure_city = ${departure_city},
        departure_state = ${departure_state},
        arrival_city = ${arrival_city},
        arrival_state = ${arrival_state},
        distance_km = ${distance_km},
        stops = ${safeJson(stops) ? sql.json(safeJson(stops)) : null},
        is_irregular_route = ${is_irregular_route},
        origin_lat = ${origin_lat},
        origin_lng = ${origin_lng},
        origin_place = ${origin_place},
        destination_lat = ${destination_lat},
        destination_lng = ${destination_lng},
        destination_place = ${destination_place},
        route_distance_km = ${route_distance_km},
        route_source = ${route_source},
        meal_type = ${meal_type},
        establishment_name = ${establishment_name},
        number_of_people = ${number_of_people},
        fuel_type = ${fuel_type},
        gas_station_name = ${gas_station_name},
        liters = ${liters},
        price_per_liter = ${price_per_liter},
        vehicle_plate = ${vehicle_plate},
        km_before = ${km_before},
        km_after = ${km_after},
        total_km = ${total_km},
        odometer_photos = COALESCE(${safeJson(odometer_photos) ? sql.json(safeJson(odometer_photos)) : null}, odometer_photos),
        parking_name = ${parking_name},
        parking_type = ${parking_type},
        parking_reason = ${parking_reason},
        accommodation_name = ${accommodation_name},
        checkin_date = ${checkin_date},
        checkout_date = ${checkout_date},
        nights_count = ${nights_count},
        made_by_self = ${made_by_self},
        made_by_employee_name = ${made_by_employee_name},
        participated = ${participated},
        updated_at = NOW()
      WHERE id = ${expenseId}
      RETURNING *
    `

    // Registrar no histórico
    const wasCorrection = expense.status === 'correction' || expense.status === 'rejected'
    const action = wasCorrection ? 'Despesa corrigida e reenviada' : 'Despesa atualizada'
    await sql`
      INSERT INTO expense_history (expense_id, action, user_id, previous_status, new_status)
      VALUES (${expenseId}, ${action}, ${session.id}, ${expense.status}, ${newStatus})
    `

    // Se a despesa foi corrigida ou pertence a uma remessa, atualizar status e total da remessa
    // A despesa usa batch_id (atual) ou original_batch_id (se foi removida da remessa)
    const batchId = expense.batch_id || expense.original_batch_id
    if (wasCorrection && batchId) {
      // Verificar se a despesa precisa voltar para a remessa original
      if (!expense.batch_id && expense.original_batch_id) {
        // Despesa foi removida da remessa, voltar para a original
        await sql`
          UPDATE expenses SET batch_id = ${expense.original_batch_id}
          WHERE id = ${expenseId}
        `
      }
      
      // Verificar se ainda há outras despesas em correção na remessa
      const correctionCheck = await sql`
        SELECT COUNT(*) as correction_count
        FROM expenses
        WHERE batch_id = ${batchId}
        AND status = 'correction'
        AND id != ${expenseId}
      `
      
      const stillHasCorrections = parseInt(correctionCheck[0].correction_count) > 0
      
      // Se não há mais despesas em correção, voltar remessa para "pending" (para análise)
      // Se ainda há, manter como "correction"
      const nextBatchStatus = !stillHasCorrections ? 'pending' : 'correction'
      await sql`
        UPDATE expense_batches SET
          status = ${nextBatchStatus},
          total_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE batch_id = ${batchId}
          ),
          updated_at = NOW()
        WHERE id = ${batchId}
      `
    } else if (expense.batch_id) {
      // Se a despesa já pertencia a uma remessa, atualizar o total da remessa
      await sql`
        UPDATE expense_batches SET
          total_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE batch_id = ${expense.batch_id}
          ),
          updated_at = NOW()
        WHERE id = ${expense.batch_id}
      `
    }

    const updatedExpense = result[0]
    if (updatedExpense && newStatus !== 'draft') {
      const { auditClient, getRequestContext } = await import('@/lib/audit')
      const wasDraft = expense.status === 'draft'
      auditClient.log({
        category: 'finance',
        action: wasDraft ? 'expense.created' : 'expense.updated',
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
            id: String(expenseId),
            label: `Despesa #${expenseId} - ${category} (R$ ${parsedAmount.toFixed(2)})`,
          },
          {
            type: 'user',
            id: String(session.id),
            label: `${session.name} (${session.email})`,
          },
        ],
        context: getRequestContext(request),
        diff: wasDraft
          ? undefined
          : {
              before: {
                expense_type: expense.expense_type,
                category: expense.category,
                description: expense.description ?? null,
                amount: Number(expense.amount),
                expense_date: expense.expense_date,
                municipality: expense.municipality ?? null,
                state: expense.state ?? null,
                status: expense.status,
                receipt_pathname: expense.receipt_pathname ?? null,
              },
              after: {
                expense_type: updatedExpense.expense_type,
                category: updatedExpense.category,
                description: updatedExpense.description ?? null,
                amount: Number(updatedExpense.amount),
                expense_date: updatedExpense.expense_date,
                municipality: updatedExpense.municipality ?? null,
                state: updatedExpense.state ?? null,
                status: updatedExpense.status,
                receipt_pathname: updatedExpense.receipt_pathname ?? null,
              },
            },
        details: {
          expense_id: expenseId,
          user_id: session.id,
          user_name: session.name,
          expense_type: updatedExpense.expense_type,
          category: updatedExpense.category,
          description: updatedExpense.description ?? null,
          amount: Number(updatedExpense.amount),
          expense_date: updatedExpense.expense_date,
          municipality: updatedExpense.municipality ?? null,
          state: updatedExpense.state ?? null,
          status: updatedExpense.status,
          receipt_pathname: updatedExpense.receipt_pathname ?? null,
          ...(updatedExpense.odometer_photos ? { odometer_photos: updatedExpense.odometer_photos } : {}),
          exceeds_limit: exceedsLimit,
          limit_exceeded_reason: limitExceededReason,
        },
      })
    }

    return NextResponse.json(updatedExpense)
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Aprovar/Rejeitar despesa individual (usado por gestores/financeiro)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se tem permissão para aprovar/rejeitar
    const allowedRoles = ['manager', 'director', 'admin', 'financial']
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Sem permissão para aprovar/rejeitar despesas' }, { status: 403 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

    // Verificar se a despesa existe
    const existing = await sql`
      SELECT e.*, u.name as user_name, u.email as user_email
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = ${expenseId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = existing[0]
    const body = await request.json()
    const { status, rejection_reason, reviewed_by } = body

    // Validar status permitidos
    if (!['approved', 'rejected', 'correction'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Validar se a despesa pode ser alterada (não já aprovada/rejeitada)
    if (expense.status === 'approved' || expense.status === 'rejected') {
      return NextResponse.json({ error: 'Esta despesa já foi processada' }, { status: 400 })
    }

    // Se rejeitando ou solicitando correção, precisa do motivo
    if ((status === 'rejected' || status === 'correction') && !rejection_reason) {
      return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })
    }

    // Usar session.id se reviewed_by não foi fornecido
    const approverId = reviewed_by || session.id

    // Atualizar a despesa
    const shouldRemoveFromBatch = status === 'rejected'
    
    const result = await sql`
      UPDATE expenses SET
        status = ${status},
        rejection_reason = ${(status === 'rejected' || status === 'correction') ? rejection_reason : null},
        approved_by = ${approverId},
        approved_at = NOW(),
        updated_at = NOW(),
        original_batch_id = COALESCE(original_batch_id, batch_id),
        batch_id = ${shouldRemoveFromBatch ? null : expense.batch_id}
      WHERE id = ${expenseId}
      RETURNING *
    `

    // Registrar no histórico
    const actionLabels: Record<string, string> = {
      'approved': 'Despesa aprovada individualmente',
      'rejected': 'Despesa rejeitada individualmente',
      'correction': 'Solicitada correção da despesa'
    }
    const action = actionLabels[status] || 'Status atualizado'
    await sql`
      INSERT INTO expense_history (expense_id, action, user_id, previous_status, new_status, notes)
      VALUES (${expenseId}, ${action}, ${session.id}, ${expense.status}, ${status}, ${rejection_reason || null})
    `

    // Verificar e atualizar status da remessa
    if (expense.batch_id) {
      const statusCounts = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('pending', 'submitted')) as pending_count,
          COUNT(*) FILTER (WHERE status = 'correction') as correction_count,
          COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
          COUNT(*) as total_count
        FROM expenses 
        WHERE batch_id = ${expense.batch_id}
      `
      
      const counts = statusCounts[0]
      const pendingCount = parseInt(counts.pending_count)
      const correctionCount = parseInt(counts.correction_count)
      const approvedCount = parseInt(counts.approved_count)
      const totalCount = parseInt(counts.total_count)
      
      if (totalCount === 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'cancelled',
            total_amount = 0,
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else if (pendingCount === 0 && correctionCount === 0 && approvedCount > 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'approved',
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            reviewed_by = ${approverId},
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else if (correctionCount > 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'correction',
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      } else if (pendingCount > 0) {
        await sql`
          UPDATE expense_batches SET
            status = 'pending',
            total_amount = (
              SELECT COALESCE(SUM(amount), 0)
              FROM expenses
              WHERE batch_id = ${expense.batch_id}
            ),
            updated_at = NOW()
          WHERE id = ${expense.batch_id}
        `
      }
    }

    const ownerName = String(expense.user_name || `Usuário #${expense.user_id}`)
    const auditActionMap: Record<string, string> = {
      approved: 'expense.approved',
      rejected: 'expense.rejected',
      correction: 'expense.correction_requested',
    }
    const { auditClient, getRequestContext } = await import('@/lib/audit')
    auditClient.log({
      category: 'finance',
      action: auditActionMap[status] || 'expense.updated',
      severity: status === 'rejected' || status === 'correction' ? 'WARNING' : 'INFO',
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
          id: String(expenseId),
          label: `Despesa #${expenseId} - ${ownerName} (R$ ${Number(expense.amount).toFixed(2)})`,
        },
        {
          type: 'user',
          id: String(expense.user_id),
          label: ownerName,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          status: expense.status,
          rejection_reason: expense.rejection_reason ?? null,
        },
        after: {
          status,
          rejection_reason: (status === 'rejected' || status === 'correction') ? rejection_reason : null,
        },
      },
      details: {
        expense_id: expenseId,
        user_id: expense.user_id,
        user_name: ownerName,
        category: expense.category,
        description: expense.description ?? null,
        amount: Number(expense.amount),
        previous_status: expense.status,
        new_status: status,
        rejection_reason: rejection_reason || null,
      },
    })

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Erro ao aprovar/rejeitar despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Excluir despesa
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    const expenseId = parseInt(id)

    // Verificar se a despesa existe
    const existing = await sql`
      SELECT e.*, u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.id = ${expenseId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })
    }

    const expense = existing[0]
    const isAdmin = session.role === 'admin' || session.role === 'director'
    const isOwner = expense.user_id === session.id

    // Rascunhos são estritamente pessoais: apenas o autor pode excluir seu rascunho
    if (expense.status === 'draft' && !isOwner) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Admin pode excluir qualquer despesa (exceto rascunhos de terceiros)
    // Usuário comum só pode excluir suas próprias despesas em rascunho ou processadas
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (!isAdmin && !['draft', 'processed'].includes(expense.status)) {
      return NextResponse.json(
        { error: 'Apenas despesas não enviadas podem ser excluídas' },
        { status: 400 }
      )
    }

    // Coletar todos os caminhos de arquivos para deletar do Blob
    const filesToDelete: string[] = []
    
    // Comprovante principal
    if (expense.receipt_pathname) {
      filesToDelete.push(expense.receipt_pathname)
    }
    
    // Fotos do odômetro (hospedagem/combustível)
    if (expense.odometer_photos) {
      try {
        const odometerPhotos = typeof expense.odometer_photos === 'string' 
          ? JSON.parse(expense.odometer_photos) 
          : expense.odometer_photos
        if (Array.isArray(odometerPhotos)) {
          odometerPhotos.forEach((photo: { pathname?: string }) => {
            if (photo?.pathname) filesToDelete.push(photo.pathname)
          })
        }
      } catch {
        // Ignorar erro de parse
      }
    }
    
    // Fotos extras (hospedagem)
    if (expense.accommodation_data) {
      try {
        const accData = typeof expense.accommodation_data === 'string'
          ? JSON.parse(expense.accommodation_data)
          : expense.accommodation_data
        
        // Foto da fatura
        if (accData?.invoicePhoto?.pathname) {
          filesToDelete.push(accData.invoicePhoto.pathname)
        }
        
        // Fotos extras
        if (Array.isArray(accData?.extraExpenses)) {
          accData.extraExpenses.forEach((exp: { receiptPhoto?: { pathname?: string } }) => {
            if (exp?.receiptPhoto?.pathname) {
              filesToDelete.push(exp.receiptPhoto.pathname)
            }
          })
        }
      } catch {
        // Ignorar erro de parse
      }
    }

    // Deletar histórico da despesa
    await sql`DELETE FROM expense_history WHERE expense_id = ${expenseId}`
    
    // Deletar a despesa
    await sql`DELETE FROM expenses WHERE id = ${expenseId}`

    // Atualizar total da remessa se a despesa estava em uma
    if (expense.batch_id) {
      await sql`
        UPDATE expense_batches 
        SET total_amount = (
          SELECT COALESCE(SUM(amount), 0) 
          FROM expenses 
          WHERE batch_id = ${expense.batch_id}
        ),
        updated_at = NOW()
        WHERE id = ${expense.batch_id}
      `
      
      // Verificar se a remessa ficou vazia
      const remaining = await sql`
        SELECT COUNT(*)::int as count FROM expenses WHERE batch_id = ${expense.batch_id}
      `
      if (remaining[0].count === 0) {
        await sql`DELETE FROM expense_batches WHERE id = ${expense.batch_id}`
      }
    }

    // Deletar arquivos do Blob (em background, não bloqueia a resposta)
    const deletePromises = filesToDelete.map(async (pathname) => {
      try {
        await deleteFile(pathname)
      } catch (err) {
        console.error(`Erro ao deletar arquivo ${pathname}:`, err)
      }
    })
    
    // Aguardar deleção dos arquivos (não crítico, pode falhar)
    await Promise.allSettled(deletePromises)

    if (expense.status !== 'draft') {
      const ownerName = String(expense.user_name || session.name || `Usuário #${expense.user_id}`)
      const { auditClient, getRequestContext } = await import('@/lib/audit')
      auditClient.log({
        category: 'finance',
        action: 'expense.deleted',
        severity: 'WARNING',
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
            id: String(expenseId),
            label: `Despesa #${expenseId} - ${ownerName} (R$ ${Number(expense.amount).toFixed(2)})`,
          },
          {
            type: 'user',
            id: String(expense.user_id),
            label: ownerName,
          },
        ],
        context: getRequestContext(request),
        details: {
          expense_id: expenseId,
          user_id: expense.user_id,
          user_name: ownerName,
          expense_type: expense.expense_type,
          category: expense.category,
          description: expense.description ?? null,
          amount: Number(expense.amount),
          expense_date: expense.expense_date,
          status: expense.status,
          receipt_pathname: expense.receipt_pathname ?? null,
          deleted_files_count: filesToDelete.length,
        },
      })
    }

    return NextResponse.json({ 
      success: true, 
      deletedFiles: filesToDelete.length 
    })
  } catch (error) {
    console.error('Erro ao excluir despesa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
