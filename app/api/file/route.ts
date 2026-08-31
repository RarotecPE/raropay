import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFile } from '@/lib/r2-storage'

export async function GET(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  try {
    const pathname = request.nextUrl.searchParams.get('pathname')

    if (!pathname) {
      return NextResponse.json({ error: 'Pathname nao informado' }, { status: 400 })
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
    return NextResponse.json({ error: 'Erro ao carregar arquivo' }, { status: 500 })
  }
}
