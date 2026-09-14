import { NextRequest, NextResponse } from "next/server"
import { getSession, hashPassword, canManageUsers } from "@/lib/auth"
import { sql } from "@/lib/db"

// PUT - Alias para PATCH (retrocompatibilidade)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    console.log("[v0] PATCH /api/users/[id] - session:", session)
    
    if (!session) {
      console.log("[v0] Usuário não autenticado")
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Verificar permissão para gerenciar usuários
    const hasPermission = canManageUsers(session.role)
    console.log("[v0] canManageUsers:", session.role, "->", hasPermission)
    
    if (!hasPermission) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()
    console.log("[v0] Body recebido:", JSON.stringify(body))
    
    const { name, email, password, role, department, active, is_active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit } = body
    
    // Aceitar tanto active quanto is_active
    const isActive = active !== undefined ? active : is_active

    // Limite do VT só é atualizado quando transport_voucher_enabled é enviado (ex.: form de usuário).
    // Em atualizações parciais (ex.: toggle de status), o valor atual é preservado.
    const transportLimitProvided = transport_voucher_enabled !== undefined && transport_voucher_enabled !== null
    const transportLimit = transport_voucher_enabled
      ? (transport_voucher_limit === null || transport_voucher_limit === undefined || transport_voucher_limit === '' ? null : Number(transport_voucher_limit))
      : null
    console.log("[v0] Dados processados - userId:", userId, "name:", name, "email:", email, "role:", role)

    // Verificar se usuário existe
    const [existingUser] = await sql`
      SELECT id FROM users WHERE id = ${userId}
    `

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Verificar se email já está em uso por outro usuário
    if (email) {
      const [emailInUse] = await sql`
        SELECT id FROM users WHERE email = ${email} AND id != ${userId}
      `
      if (emailInUse) {
        return NextResponse.json({ error: "Email já em uso" }, { status: 400 })
      }
    }

    // Se senha foi fornecida, fazer hash e atualizar tudo
    let updatedUser
    if (password && password.trim() !== '') {
      const hashedPassword = await hashPassword(password)
      const [result] = await sql`
        UPDATE users SET
          name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          password_hash = ${hashedPassword},
          role = COALESCE(${role}, role),
          department = ${department || null},
          active = COALESCE(${isActive}, active),
          meal_voucher_enabled = COALESCE(${meal_voucher_enabled}, meal_voucher_enabled),
          meal_voucher_limit = COALESCE(${meal_voucher_limit}, meal_voucher_limit),
          transport_voucher_enabled = COALESCE(${transport_voucher_enabled}, transport_voucher_enabled),
          transport_voucher_limit = CASE WHEN ${transportLimitProvided} THEN ${transportLimit} ELSE transport_voucher_limit END,
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, name, email, role, department, active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
      `
      updatedUser = result
    } else {
      const [result] = await sql`
        UPDATE users SET
          name = COALESCE(${name}, name),
          email = COALESCE(${email}, email),
          role = COALESCE(${role}, role),
          department = ${department || null},
          active = COALESCE(${isActive}, active),
          meal_voucher_enabled = COALESCE(${meal_voucher_enabled}, meal_voucher_enabled),
          meal_voucher_limit = COALESCE(${meal_voucher_limit}, meal_voucher_limit),
          transport_voucher_enabled = COALESCE(${transport_voucher_enabled}, transport_voucher_enabled),
          transport_voucher_limit = CASE WHEN ${transportLimitProvided} THEN ${transportLimit} ELSE transport_voucher_limit END,
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING id, name, email, role, department, active, meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
      `
      updatedUser = result
    }

    // Retornar is_active também para compatibilidade
    if (updatedUser) {
      updatedUser.is_active = updatedUser.active
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas diretoria pode excluir usuários
    if (user.role !== "director") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id } = await params

    // Não permitir excluir a si mesmo
    if (id === user.id) {
      return NextResponse.json({ error: "Não é possível excluir seu próprio usuário" }, { status: 400 })
    }

    // Verificar se existem despesas vinculadas
    const expenses = await sql`
      SELECT COUNT(*) as count FROM expenses WHERE user_id = ${id}
    `

    if (Number(expenses[0].count) > 0) {
      return NextResponse.json({ 
        error: "Não é possível excluir usuário com despesas registradas" 
      }, { status: 400 })
    }

    await sql`DELETE FROM users WHERE id = ${id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir usuário:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
