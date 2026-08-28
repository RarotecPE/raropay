import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function DELETE() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Apenas admin e director podem limpar dados
    if (session.role !== "admin" && session.role !== "director") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Deletar na ordem correta para respeitar foreign keys
    // 1. Primeiro o histórico (depende de expenses)
    const historyResult = await sql`DELETE FROM expense_history`
    
    // 2. Depois as despesas (depende de expense_batches)
    const expensesResult = await sql`DELETE FROM expenses`
    
    // 3. Por último as remessas
    const batchesResult = await sql`DELETE FROM expense_batches`

    return NextResponse.json({
      success: true,
      deleted: {
        history: historyResult.count || 0,
        expenses: expensesResult.count || 0,
        batches: batchesResult.count || 0
      }
    })
  } catch (error) {
    console.error("Erro ao limpar dados:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
