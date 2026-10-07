import { type NextRequest, NextResponse } from 'next/server'
import { getSession, canViewAllExpenses, canApproveExpenses } from '@/lib/auth'
import { getFile } from '@/lib/r2-storage'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  try {
    const rawPath = request.nextUrl.searchParams.get('pathname')

    if (!rawPath) {
      return NextResponse.json({ error: 'Pathname nao informado' }, { status: 400 })
    }

    const cleanPath = rawPath.replace(/^\/+/, "")

    // Gestores e financeiro (admin, director, financial, manager) têm acesso a todos os arquivos
    const isManager = canViewAllExpenses(session.role) || canApproveExpenses(session.role)
    if (!isManager) {
      const isOwnReceipt = cleanPath.startsWith(`receipts/${session.id}/`) || cleanPath.startsWith(`${session.id}/`)
      if (!isOwnReceipt) {
        // Validação no banco de dados se a despesa pertence ao usuário logado
        const expenses = await sql`
          SELECT id FROM expenses 
          WHERE user_id = ${session.id} 
            AND (receipt_url LIKE ${'%' + cleanPath} OR receipt_url = ${rawPath})
          LIMIT 1
        `
        if (expenses.length === 0) {
          return NextResponse.json({ error: 'Acesso negado a este arquivo' }, { status: 403 })
        }
      }
    }

    const result = await getFile(cleanPath)

    if (!result) {
      return new NextResponse('Arquivo nao encontrado', { status: 404 })
    }

    if (result.etag && request.headers.get('if-none-match') === result.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.contentType,
        ...(result.etag ? { ETag: result.etag } : {}),
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Erro ao servir arquivo:', error)
    return NextResponse.json({ error: 'Erro ao carregar arquivo' }, { status: 500 })
  }
}
