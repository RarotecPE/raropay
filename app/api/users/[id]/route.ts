import { NextRequest, NextResponse } from "next/server"
import { getSession, canManageUsers } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return PATCH(request, context)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      nexus_email,
      phone,
      department,
      meal_voucher_enabled,
      meal_voucher_limit,
      transport_voucher_enabled,
      transport_voucher_limit,
    } = body

    const nextNexusEmail = typeof nexus_email === "string" && nexus_email.trim()
      ? nexus_email.trim().toLowerCase()
      : null
    const nextPhone = phone ?? null
    const nextDepartment = department ?? null
    const nextMealVoucherEnabled = meal_voucher_enabled ?? null
    const nextMealVoucherLimit = meal_voucher_limit ?? null
    const nextTransportVoucherEnabled = transport_voucher_enabled ?? null
    const nexusEmailProvided = Object.prototype.hasOwnProperty.call(body, "nexus_email")
    const phoneProvided = Object.prototype.hasOwnProperty.call(body, "phone")
    const departmentProvided = Object.prototype.hasOwnProperty.call(body, "department")
    const transportLimitProvided = Object.prototype.hasOwnProperty.call(body, "transport_voucher_limit")
    const transportLimit = transportLimitProvided
      ? (transport_voucher_limit === null || transport_voucher_limit === undefined || transport_voucher_limit === "" ? null : Number(transport_voucher_limit))
      : null

    const [existingUser] = await sql`
      SELECT id FROM users WHERE id = ${userId}
    `

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    if (nexusEmailProvided && nextNexusEmail) {
      const [emailInUse] = await sql`
        SELECT id
        FROM users
        WHERE LOWER(nexus_email) = ${nextNexusEmail}
          AND id != ${userId}
        LIMIT 1
      `

      if (emailInUse) {
        return NextResponse.json(
          { error: "Este e-mail do RaroNexus já está vinculado a outro usuário." },
          { status: 400 },
        )
      }
    }

    const [updatedUser] = await sql`
      UPDATE users SET
        nexus_email = CASE WHEN ${nexusEmailProvided} THEN ${nextNexusEmail} ELSE nexus_email END,
        phone = CASE WHEN ${phoneProvided} THEN ${nextPhone} ELSE phone END,
        department = CASE WHEN ${departmentProvided} THEN ${nextDepartment} ELSE department END,
        meal_voucher_enabled = COALESCE(${nextMealVoucherEnabled}, meal_voucher_enabled),
        meal_voucher_limit = COALESCE(${nextMealVoucherLimit}, meal_voucher_limit),
        transport_voucher_enabled = COALESCE(${nextTransportVoucherEnabled}, transport_voucher_enabled),
        transport_voucher_limit = CASE WHEN ${transportLimitProvided} THEN ${transportLimit} ELSE transport_voucher_limit END,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, nexus_user_id, nexus_email, name, email, phone, role, department, active,
                meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
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

export async function DELETE() {
  return NextResponse.json(
    { error: "Exclusão local desabilitada. Gerencie o acesso do usuário no RaroNexus." },
    { status: 410 },
  )
}
