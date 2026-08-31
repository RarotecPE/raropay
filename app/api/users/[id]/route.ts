import { NextRequest, NextResponse } from "next/server"
import { getSession, canManageUsers } from "@/lib/auth"
import { sql } from "@/lib/db"

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

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    if (!canManageUsers(session.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()
    const {
      name,
      email,
      phone,
      role,
      department,
      active,
      is_active,
      meal_voucher_enabled,
      meal_voucher_limit,
      transport_voucher_enabled,
    } = body

    const isActive = active !== undefined ? active : is_active
    const nextName = name ?? null
    const nextEmail = email ?? null
    const nextPhone = phone ?? null
    const nextRole = role ?? null
    const nextDepartment = department ?? null
    const nextActive = isActive ?? null
    const nextMealVoucherEnabled = meal_voucher_enabled ?? null
    const nextMealVoucherLimit = meal_voucher_limit ?? null
    const nextTransportVoucherEnabled = transport_voucher_enabled ?? null

    const [existingUser] = await sql`
      SELECT id FROM users WHERE id = ${userId}
    `

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (nextEmail) {
      const [emailInUse] = await sql`
        SELECT id FROM users WHERE email = ${nextEmail} AND id != ${userId}
      `
      if (emailInUse) {
        return NextResponse.json({ error: "Email já em uso" }, { status: 400 })
      }
    }

    const [updatedUser] = await sql`
      UPDATE users SET
        name = COALESCE(${nextName}, name),
        email = COALESCE(${nextEmail}, email),
        phone = COALESCE(${nextPhone}, phone),
        role = COALESCE(${nextRole}, role),
        department = COALESCE(${nextDepartment}, department),
        active = COALESCE(${nextActive}, active),
        meal_voucher_enabled = COALESCE(${nextMealVoucherEnabled}, meal_voucher_enabled),
        meal_voucher_limit = COALESCE(${nextMealVoucherLimit}, meal_voucher_limit),
        transport_voucher_enabled = COALESCE(${nextTransportVoucherEnabled}, transport_voucher_enabled),
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, name, email, phone, role, department, active,
                meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, created_at
    `

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

    if (user.role !== "director") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)

    if (userId === user.id) {
      return NextResponse.json({ error: "Não é possível excluir seu próprio usuário" }, { status: 400 })
    }

    const expenses = await sql`
      SELECT COUNT(*) as count FROM expenses WHERE user_id = ${userId}
    `

    if (Number(expenses[0].count) > 0) {
      return NextResponse.json({
        error: "Não é possível excluir usuário com despesas registradas",
      }, { status: 400 })
    }

    await sql`DELETE FROM users WHERE id = ${userId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir usuário:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
