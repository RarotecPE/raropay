import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Indica se o usuário logado pode lançar despesas de Vale-Transporte
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const result = await sql`
      SELECT transport_voucher_enabled
      FROM users
      WHERE id = ${session.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ enabled: false })
    }

    return NextResponse.json({ enabled: result[0].transport_voucher_enabled || false })
  } catch (error) {
    console.error('[v0] Erro ao verificar elegibilidade do vale-transporte:', error)
    return NextResponse.json({ enabled: false })
  }
}
