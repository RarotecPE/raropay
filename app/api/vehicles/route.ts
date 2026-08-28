import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canManageUsers } from '@/lib/auth'

// Listar veículos
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar veículos ativos
    // Todos os veículos ativos são visíveis para qualquer usuário
    // (necessário para criar despesas de combustível com qualquer veículo)
    const vehicles = await sql`
      SELECT v.*, u.name as owner_name, d.name as driver_name
      FROM vehicles v
      LEFT JOIN users u ON v.owner_id = u.id
      LEFT JOIN users d ON v.driver_id = d.id
      WHERE v.active = true
      ORDER BY v.model ASC, v.plate ASC
    `

    return NextResponse.json(vehicles)
  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Criar veículo
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Apenas gestores podem cadastrar veículos da empresa
    const body = await request.json()
    const { plate, model, brand, year, fuel_type, km_per_liter, owner_type, owner_id } = body

    if (!plate || !model || !brand) {
      return NextResponse.json({ error: 'Placa, modelo e marca são obrigatórios' }, { status: 400 })
    }

    // Verificar se placa já existe
    const existing = await sql`SELECT id FROM vehicles WHERE plate = ${plate.toUpperCase()}`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Veículo com esta placa já cadastrado' }, { status: 400 })
    }

    // Se não for gestor, só pode cadastrar veículo próprio
    const finalOwnerType = canViewAllExpenses(session.role) ? (owner_type || 'company') : 'employee'
    const finalOwnerId = finalOwnerType === 'employee' ? session.id : (owner_id || null)

    const result = await sql`
      INSERT INTO vehicles (plate, model, brand, year, fuel_type, km_per_liter, owner_type, owner_id)
      VALUES (${plate.toUpperCase()}, ${model}, ${brand}, ${year || null}, ${fuel_type || null}, ${km_per_liter || null}, ${finalOwnerType}, ${finalOwnerId})
      RETURNING *
    `

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error('Erro ao criar veículo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
