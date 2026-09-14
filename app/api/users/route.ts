import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession, canManageUsers, hashPassword } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const activeOnly = searchParams.get('active') === 'true'

    let users
    if (activeOnly) {
      users = await sql`
        SELECT id, name, email, role, department, active, active as is_active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
        FROM users
        WHERE active = true
        ORDER BY name
      `
    } else {
      users = await sql`
        SELECT id, name, email, role, department, active, active as is_active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
        FROM users
        ORDER BY name
      `
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('[v0] Erro ao buscar usuários:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!canManageUsers(session.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password, role, department, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit } = body
    // Limite do VT: só aplica se habilitado; nulo/vazio = ilimitado
    const transportLimit = transport_voucher_enabled
      ? (transport_voucher_limit === null || transport_voucher_limit === undefined || transport_voucher_limit === '' ? null : Number(transport_voucher_limit))
      : null

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await hashPassword(password)

    // Criar usuário
    const [newUser] = await sql`
      INSERT INTO users (name, email, password_hash, role, department, active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role || 'employee'}, ${department || null}, true, ${meal_voucher_enabled || false}, ${meal_voucher_limit || 250}, ${transport_voucher_enabled || false}, ${transportLimit})
      RETURNING id, name, email, role, department, active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
    `

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('[v0] Erro ao criar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    )
  }
}
