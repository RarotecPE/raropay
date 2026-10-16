import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canManageUsers } from '@/lib/auth'
import { auditClient, getRequestContext } from '@/lib/audit'

// Buscar veículo específico
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
    const vehicleId = parseInt(id)

    const result = await sql`
      SELECT v.*, u.name as owner_name
      FROM vehicles v
      LEFT JOIN users u ON v.owner_id = u.id
      WHERE v.id = ${vehicleId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('Erro ao buscar veículo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Atualizar veículo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!canManageUsers(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const vehicleId = parseInt(id)
    const body = await request.json()

    const { plate, model, brand, year, fuel_type, km_per_liter, owner_type, owner_id } = body

    if (!plate || !model || !brand) {
      return NextResponse.json({ error: 'Placa, modelo e marca são obrigatórios' }, { status: 400 })
    }

    const [beforeVehicle] = await sql`
      SELECT v.*, u.name as owner_name
      FROM vehicles v
      LEFT JOIN users u ON v.owner_id = u.id
      WHERE v.id = ${vehicleId}
    `
    if (!beforeVehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado' }, { status: 404 })
    }

    // Verificar se placa já existe em outro veículo
    const existing = await sql`SELECT id FROM vehicles WHERE plate = ${plate.toUpperCase()} AND id != ${vehicleId}`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Placa já cadastrada em outro veículo' }, { status: 400 })
    }

    let nextOwnerName: string | null = null
    if (owner_id) {
      const [ownerRow] = await sql`SELECT name FROM users WHERE id = ${owner_id}`
      nextOwnerName = ownerRow?.name ? String(ownerRow.name) : null
    }

    const result = await sql`
      UPDATE vehicles SET
        plate = ${plate.toUpperCase()},
        model = ${model},
        brand = ${brand},
        year = ${year || null},
        fuel_type = ${fuel_type || null},
        km_per_liter = ${km_per_liter || null},
        owner_type = ${owner_type || 'company'},
        owner_id = ${owner_id || null},
        updated_at = NOW()
      WHERE id = ${vehicleId}
      RETURNING *
    `

    const updated = result[0]
    auditClient.log({
      category: 'fleet',
      action: 'vehicle.updated',
      severity: 'INFO',
      actor: {
        type: 'user',
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        { type: 'vehicle', id: String(vehicleId), label: `${updated.brand} ${updated.model} (${updated.plate})` },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          plate: beforeVehicle.plate,
          brand: beforeVehicle.brand,
          model: beforeVehicle.model,
          year: beforeVehicle.year ?? null,
          fuel_type: beforeVehicle.fuel_type ?? null,
          km_per_liter: beforeVehicle.km_per_liter !== null ? Number(beforeVehicle.km_per_liter) : null,
          owner_type: beforeVehicle.owner_type,
          owner_name: beforeVehicle.owner_name ?? null,
        },
        after: {
          plate: updated.plate,
          brand: updated.brand,
          model: updated.model,
          year: updated.year ?? null,
          fuel_type: updated.fuel_type ?? null,
          km_per_liter: updated.km_per_liter !== null ? Number(updated.km_per_liter) : null,
          owner_type: updated.owner_type,
          owner_name: nextOwnerName,
        },
      },
      details: {
        vehicle_id: vehicleId,
        plate: updated.plate,
        brand: updated.brand,
        model: updated.model,
        owner_type: updated.owner_type,
        owner_name: nextOwnerName,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar veículo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Excluir (desativar) veículo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!canManageUsers(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params
    const vehicleId = parseInt(id)

    const [beforeVehicle] = await sql`
      SELECT v.*, u.name as owner_name
      FROM vehicles v
      LEFT JOIN users u ON v.owner_id = u.id
      WHERE v.id = ${vehicleId}
    `

    // Desativar em vez de excluir (soft delete)
    await sql`UPDATE vehicles SET active = false, updated_at = NOW() WHERE id = ${vehicleId}`

    if (beforeVehicle) {
      auditClient.log({
        category: 'fleet',
        action: 'vehicle.deactivated',
        severity: 'WARNING',
        actor: {
          type: 'user',
          userId: String(session.id),
          name: session.name,
          email: session.email,
          role: session.role,
        },
        targets: [
          { type: 'vehicle', id: String(vehicleId), label: `${beforeVehicle.brand} ${beforeVehicle.model} (${beforeVehicle.plate})` },
        ],
        context: getRequestContext(request),
        details: {
          vehicle_id: vehicleId,
          plate: beforeVehicle.plate,
          brand: beforeVehicle.brand,
          model: beforeVehicle.model,
          owner_name: beforeVehicle.owner_name ?? null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir veículo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
