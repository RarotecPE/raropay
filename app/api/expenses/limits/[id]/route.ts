import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { auditClient, getRequestContext } from "@/lib/audit"

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

    const [existing] = await sql`
      SELECT * FROM category_limits WHERE id = ${id}
    `

    const [updated] = await sql`
      UPDATE category_limits 
      SET daily_limit = ${daily_limit}, 
          min_km_per_liter = ${min_km_per_liter || null},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (updated) {
      const limitLabel = updated.sub_category_name
        ? `${updated.category_name} (${updated.sub_category_name})`
        : String(updated.category_name || updated.category || `Limite #${id}`)

      auditClient.log({
        category: "finance",
        action: "expense_limit.updated",
        severity: "INFO",
        actor: {
          type: "user",
          userId: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        targets: [
          { type: "expense_limit", id: String(id), label: limitLabel },
        ],
        context: getRequestContext(request),
        diff: existing
          ? {
              before: {
                category_name: existing.category_name,
                sub_category_name: existing.sub_category_name ?? null,
                daily_limit: Number(existing.daily_limit),
                min_km_per_liter: existing.min_km_per_liter !== null ? Number(existing.min_km_per_liter) : null,
              },
              after: {
                category_name: updated.category_name,
                sub_category_name: updated.sub_category_name ?? null,
                daily_limit: Number(updated.daily_limit),
                min_km_per_liter: updated.min_km_per_liter !== null ? Number(updated.min_km_per_liter) : null,
              },
            }
          : undefined,
        details: {
          limit_id: Number(id),
          category: updated.category,
          category_name: updated.category_name,
          sub_category: updated.sub_category ?? null,
          sub_category_name: updated.sub_category_name ?? null,
          daily_limit: Number(updated.daily_limit),
          min_km_per_liter: updated.min_km_per_liter !== null ? Number(updated.min_km_per_liter) : null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao atualizar limite:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
