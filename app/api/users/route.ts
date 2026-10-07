import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession, canManageUsers } from "@/lib/auth"
import { syncAuthorizedNexusUsers } from "@/lib/nexus-users-sync"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    await syncAuthorizedNexusUsers()

    const { searchParams } = request.nextUrl
    const activeOnly = searchParams.get("active") === "true"
    const isManager = canManageUsers(session.role)

    let users
    if (isManager) {
      users = activeOnly
        ? await sql`
            SELECT id, nexus_user_id, nexus_email, name, email, role, department, active, active as is_active,
                   meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
            FROM users
            WHERE active = true
            ORDER BY name
          `
        : await sql`
            SELECT id, nexus_user_id, nexus_email, name, email, role, department, active, active as is_active,
                   meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, transport_voucher_limit, created_at
            FROM users
            ORDER BY name
          `
    } else {
      // Usuários comuns recebem apenas os dados de identificação necessários para listagens, sem limites confidenciais
      users = activeOnly
        ? await sql`
            SELECT id, nexus_user_id, nexus_email, name, email, role, department, active, active as is_active, created_at
            FROM users
            WHERE active = true
            ORDER BY name
          `
        : await sql`
            SELECT id, nexus_user_id, nexus_email, name, email, role, department, active, active as is_active, created_at
            FROM users
            ORDER BY name
          `
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error("[v0] Erro ao buscar usuários:", error)
    return NextResponse.json(
      {
        error: "Não foi possível sincronizar usuários com o RaroNexus. Nenhum usuário foi alterado.",
        details: String(error),
      },
      { status: 502 },
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Cadastro local desabilitado. Gerencie usuários no RaroNexus." },
    { status: 410 },
  )
}
