import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from "@/lib/auth"
import { getFile } from "@/lib/r2-storage"

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const pathname = request.nextUrl.searchParams.get('pathname')

    if (!pathname) {
      return NextResponse.json({ error: 'Pathname nao fornecido' }, { status: 400 })
    }

    const result = await getFile(pathname)

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
