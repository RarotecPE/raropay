import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { auditClient, getRequestContext } from '@/lib/audit'

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

    const [beforeRow] = await sql`
      SELECT pix_key, bank_agency, bank_account
      FROM users
      WHERE id = ${session.id}
    `

    const body = await request.json()
    const pixKey = typeof body.pix_key === 'string' ? body.pix_key.trim() : null
    const bankAgency = typeof body.bank_agency === 'string' ? body.bank_agency.trim() : null
    const bankAccount = typeof body.bank_account === 'string' ? body.bank_account.trim() : null

    const nextBanking = {
      pix_key: pixKey || null,
      bank_agency: bankAgency || null,
      bank_account: bankAccount || null,
    }

    await sql`
      UPDATE users
      SET
        pix_key = ${nextBanking.pix_key},
        bank_agency = ${nextBanking.bank_agency},
        bank_account = ${nextBanking.bank_account},
        updated_at = NOW()
      WHERE id = ${session.id}
    `

    auditClient.log({
      category: 'banking',
      action: 'banking.updated',
      severity: 'CRITICAL',
      actor: {
        type: 'user',
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        { type: 'user', id: String(session.id), label: `${session.name} (${session.email})` },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          pix_key: beforeRow?.pix_key ?? null,
          bank_agency: beforeRow?.bank_agency ?? null,
          bank_account: beforeRow?.bank_account ?? null,
        },
        after: nextBanking,
      },
      details: {
        user_id: session.id,
        user_name: session.name,
        user_email: session.email,
        pix_key: nextBanking.pix_key,
        bank_agency: nextBanking.bank_agency,
        bank_account: nextBanking.bank_account,
      },
    })

    return NextResponse.json({
      success: true,
      banking: { pix_key: pixKey, bank_agency: bankAgency, bank_account: bankAccount },
    })
  } catch (error) {
    console.error('Erro ao atualizar dados bancários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
