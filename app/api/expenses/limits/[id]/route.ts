import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas admin ou diretoria podem alterar referências
    if (user.role !== "director" && user.role !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { daily_limit, min_km_per_liter } = body

    if (daily_limit === undefined || daily_limit < 0) {
      return NextResponse.json({ error: "Valor de limite inválido" }, { status: 400 })
    }

    await sql`
      UPDATE category_limits 
      SET daily_limit = ${daily_limit}, 
          min_km_per_liter = ${min_km_per_liter || null},
          updated_at = NOW()
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao atualizar limite:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
