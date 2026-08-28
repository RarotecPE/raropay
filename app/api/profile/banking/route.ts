import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'

// Buscar dados bancários do usuário logado
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const rows = await sql`
      SELECT pix_key, bank_agency, bank_account
      FROM users
      WHERE id = ${session.id}
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ banking: rows[0] })
  } catch (error) {
    console.error('Erro ao buscar dados bancários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Atualizar dados bancários do usuário logado
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const pixKey = typeof body.pix_key === 'string' ? body.pix_key.trim() : null
    const bankAgency = typeof body.bank_agency === 'string' ? body.bank_agency.trim() : null
    const bankAccount = typeof body.bank_account === 'string' ? body.bank_account.trim() : null

    await sql`
      UPDATE users
      SET
        pix_key = ${pixKey || null},
        bank_agency = ${bankAgency || null},
        bank_account = ${bankAccount || null},
        updated_at = NOW()
      WHERE id = ${session.id}
    `

    return NextResponse.json({
      success: true,
      banking: { pix_key: pixKey, bank_agency: bankAgency, bank_account: bankAccount },
    })
  } catch (error) {
    console.error('Erro ao atualizar dados bancários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
