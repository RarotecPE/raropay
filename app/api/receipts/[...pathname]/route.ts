import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFile } from '@/lib/r2-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pathname: string[] }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const { pathname } = await params
    const result = await getFile(pathname.join('/'))

    if (!result) {
      return new NextResponse('Arquivo nao encontrado', { status: 404 })
    }

    if (result.etag && request.headers.get('if-none-match') === result.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': result.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.contentType,
        'X-Content-Type-Options': 'nosniff',
        ...(result.etag ? { 'ETag': result.etag } : {}),
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error)
    return NextResponse.json({ error: 'Erro ao buscar arquivo' }, { status: 500 })
  }
}
