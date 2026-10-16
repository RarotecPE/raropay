import { NextRequest, NextResponse } from "next/server"
import { getSession, canManageUsers } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

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
      phone,
      department,
      meal_voucher_enabled,
      meal_voucher_limit,
      transport_voucher_enabled,
      transport_voucher_limit,
    } = body

    const nextPhone = phone ?? null
    const nextDepartment = department ?? null
    const nextMealVoucherEnabled = meal_voucher_enabled ?? null
    const nextMealVoucherLimit = meal_voucher_limit ?? null
    const nextTransportVoucherEnabled = transport_voucher_enabled ?? null
    const phoneProvided = Object.prototype.hasOwnProperty.call(body, "phone")
    const departmentProvided = Object.prototype.hasOwnProperty.call(body, "department")
    const transportLimitProvided = Object.prototype.hasOwnProperty.call(body, "transport_voucher_limit")
    const transportLimit = transportLimitProvided
      ? (transport_voucher_limit === null || transport_voucher_limit === undefined || transport_voucher_limit === "" ? null : Number(transport_voucher_limit))
      : null

    const [existingUser] = await sql`
      SELECT id, name, email, phone, department, meal_voucher_enabled, meal_voucher_limit,
             transport_voucher_enabled, transport_voucher_limit
      FROM users WHERE id = ${userId}
    `

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    const [updatedUser] = await sql`
      UPDATE users SET
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

      auditClient.log({
        category: "users",
        action: "user.local_profile_updated",
        severity: "INFO",
        actor: {
          type: "user",
          userId: String(session.id),
          name: session.name,
          email: session.email,
          role: session.role,
        },
        targets: [
          {
            type: "user",
            id: String(updatedUser.id),
            label: `${updatedUser.name} (${updatedUser.email})`,
          },
        ],
        context: getRequestContext(request),
        diff: {
          before: {
            phone: existingUser.phone ?? null,
            department: existingUser.department ?? null,
            meal_voucher_enabled: Boolean(existingUser.meal_voucher_enabled),
            meal_voucher_limit: existingUser.meal_voucher_limit !== null ? Number(existingUser.meal_voucher_limit) : null,
            transport_voucher_enabled: Boolean(existingUser.transport_voucher_enabled),
            transport_voucher_limit: existingUser.transport_voucher_limit !== null ? Number(existingUser.transport_voucher_limit) : null,
          },
          after: {
            phone: updatedUser.phone ?? null,
            department: updatedUser.department ?? null,
            meal_voucher_enabled: Boolean(updatedUser.meal_voucher_enabled),
            meal_voucher_limit: updatedUser.meal_voucher_limit !== null ? Number(updatedUser.meal_voucher_limit) : null,
            transport_voucher_enabled: Boolean(updatedUser.transport_voucher_enabled),
            transport_voucher_limit: updatedUser.transport_voucher_limit !== null ? Number(updatedUser.transport_voucher_limit) : null,
          },
        },
        details: {
          user_id: updatedUser.id,
          user_name: updatedUser.name,
          user_email: updatedUser.email,
          department: updatedUser.department,
          meal_voucher_enabled: Boolean(updatedUser.meal_voucher_enabled),
          meal_voucher_limit: updatedUser.meal_voucher_limit !== null ? Number(updatedUser.meal_voucher_limit) : null,
          transport_voucher_enabled: Boolean(updatedUser.transport_voucher_enabled),
          transport_voucher_limit: updatedUser.transport_voucher_limit !== null ? Number(updatedUser.transport_voucher_limit) : null,
        },
      })
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