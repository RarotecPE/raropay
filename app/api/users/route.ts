import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const activeOnly = searchParams.get("active") === "true"

    const users = activeOnly
      ? await sql`
          SELECT id, name, email, role, department, active, active as is_active,
                 meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, created_at
          FROM users
          WHERE active = true
          ORDER BY name
        `
      : await sql`
          SELECT id, name, email, role, department, active, active as is_active,
                 meal_voucher_enabled, meal_voucher_limit, transport_voucher_enabled, created_at
          FROM users
          ORDER BY name
        `

    return NextResponse.json(users)
  } catch (error) {
    console.error("[v0] Erro ao buscar usuários:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor", details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Cadastro local desabilitado. Gerencie usuários no RaroNexus." },
    { status: 410 }
  )
}
