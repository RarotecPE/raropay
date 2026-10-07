import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from "@/lib/auth"
import { getFile } from "@/lib/r2-storage"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const rawPath = request.nextUrl.searchParams.get('pathname')

    if (!rawPath) {
      return NextResponse.json({ error: 'Pathname nao fornecido' }, { status: 400 })
    }

    const cleanPath = rawPath.replace(/^\/+/, "")

    // Gestores e financeiro (admin, director, financial) têm acesso a todas as faturas
    const isManager = ['admin', 'director', 'financial'].includes(user.role)
    if (!isManager) {
      const isOwnFile = cleanPath.startsWith(`invoice-analysis/${user.id}/`)
      if (!isOwnFile) {
        // Verifica no banco de dados se o arquivo pertence a uma solicitação do usuário
        const atts = await sql`
          SELECT iar.employee_id, iar.requester_id, iaa.uploaded_by
          FROM invoice_analysis_attachments iaa
          JOIN invoice_analysis_requests iar ON iar.id = iaa.request_id
          WHERE iaa.file_path = ${rawPath} OR iaa.file_path LIKE ${'%' + cleanPath}
          LIMIT 1
        `
        if (atts.length === 0 || (atts[0].employee_id !== user.id && atts[0].requester_id !== user.id && atts[0].uploaded_by !== user.id)) {
          return NextResponse.json({ error: 'Acesso negado a este arquivo de fatura' }, { status: 403 })
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
    return NextResponse.json({ error: 'Falha ao servir arquivo' }, { status: 500 })
  }
}
