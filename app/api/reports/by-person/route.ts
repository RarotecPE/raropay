import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"

/**
 * Relatório "Gasto Real por Pessoa"
 *
 * Rateio matemático do custo de cada despesa entre as pessoas envolvidas,
 * exclusivamente para controle gerencial (não afeta aprovação/financeiro).
 *
 * Regras (definidas com o cliente):
 * - Divisão IGUAL entre todos os participantes da despesa.
 * - Terceiros (não-funcionários) são somados em uma linha separada "Terceiros".
 * - Quando "efetuada por mim = Não", o gasto é atribuído a quem participou/usufruiu.
 * - Padrão considera apenas despesas aprovadas (status ajustável via filtro).
 */

interface LinkedPerson {
  name?: string
  isEmployee?: boolean
}

const TERCEIROS_KEY = "__terceiros__"

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const allowedRoles = ["admin", "financial"]
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate =
      searchParams.get("startDate") ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0]
    // Padrão: apenas aprovadas
    const status = searchParams.get("status") || "approved"

    const statusMap: Record<string, string[]> = {
      approved: ["approved", "processed"],
      rejected: ["rejected"],
      pending: ["submitted", "correction"],
    }
    const onlyPaid = status === "paid"
    const statusValues = status !== "all" && !onlyPaid ? statusMap[status] || [status] : null

    const rows = await sql`
      SELECT
        e.id,
        e.amount,
        e.category,
        e.status,
        e.paid,
        TO_CHAR(e.expense_date, 'YYYY-MM-DD') as expense_date,
        e.made_by_self,
        e.made_by_employee_name,
        e.participated,
        e.linked_employees,
        e.linked_external_parties,
        u.name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.expense_date >= ${startDate} AND e.expense_date <= ${endDate}
        AND (${!statusValues} OR e.status = ANY(${statusValues || []}::text[]))
        AND (${!onlyPaid} OR e.paid = true)
      ORDER BY e.expense_date DESC
    `

    // Acumuladores
    const people: Record<
      string,
      { name: string; total: number; count: number; isThirdParty: boolean }
    > = {}
    let totalRateado = 0
    let consideredCount = 0

    const addShare = (key: string, name: string, isThirdParty: boolean, value: number) => {
      if (!people[key]) {
        people[key] = { name, total: 0, count: 0, isThirdParty }
      }
      people[key].total += value
      people[key].count += 1
    }

    const parseLinked = (raw: any): LinkedPerson[] => {
      if (!raw) return []
      try {
        const arr = typeof raw === "string" ? JSON.parse(raw) : raw
        return Array.isArray(arr) ? arr : []
      } catch {
        return []
      }
    }

    for (const row of rows) {
      const amount = Number(row.amount) || 0
      if (amount <= 0) continue

      const madeBySelf = row.made_by_self !== false
      const ownerParticipated = madeBySelf ? true : row.participated === true

      // Monta lista única de participantes: { name, isEmployee }
      const participants = new Map<string, { name: string; isEmployee: boolean }>()
      const pushPerson = (name?: string, isEmployee = true) => {
        const clean = (name || "").trim()
        if (!clean) return
        const key = `${isEmployee ? "e" : "t"}:${clean.toLowerCase()}`
        if (!participants.has(key)) participants.set(key, { name: clean, isEmployee })
      }

      if (madeBySelf) {
        // O próprio solicitante efetuou e participou
        pushPerson(row.user_name, true)
      } else {
        // Executor identificado é um funcionário participante
        pushPerson(row.made_by_employee_name, true)
        // Solicitante entra apenas se declarou que participou
        if (ownerParticipated) pushPerson(row.user_name, true)
      }

      // Pessoas vinculadas (funcionários e terceiros convivem em linked_employees)
      for (const p of parseLinked(row.linked_employees)) {
        pushPerson(p.name, p.isEmployee !== false)
      }
      // linked_external_parties são sempre terceiros
      for (const p of parseLinked(row.linked_external_parties)) {
        pushPerson(p.name, false)
      }

      const list = Array.from(participants.values())
      // Fallback: sem participantes identificados -> atribui ao solicitante
      if (list.length === 0) {
        pushPerson(row.user_name, true)
        list.push({ name: (row.user_name || "").trim() || "Não identificado", isEmployee: true })
      }

      const share = amount / list.length
      totalRateado += amount
      consideredCount += 1

      for (const person of list) {
        if (person.isEmployee) {
          addShare(`e:${person.name.toLowerCase()}`, person.name, false, share)
        } else {
          // Todos os terceiros agrupados em uma única linha
          addShare(TERCEIROS_KEY, "Terceiros", true, share)
        }
      }
    }

    const byPerson = Object.values(people)
      .map((p) => ({
        name: p.name,
        total: Math.round(p.total * 100) / 100,
        count: p.count,
        isThirdParty: p.isThirdParty,
      }))
      .sort((a, b) => {
        // Terceiros sempre por último
        if (a.isThirdParty !== b.isThirdParty) return a.isThirdParty ? 1 : -1
        return b.total - a.total
      })

    return NextResponse.json({
      startDate,
      endDate,
      status,
      totalExpenses: consideredCount,
      totalAmount: Math.round(totalRateado * 100) / 100,
      byPerson,
    })
  } catch (error) {
    console.error("Erro ao gerar relatório por pessoa:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
