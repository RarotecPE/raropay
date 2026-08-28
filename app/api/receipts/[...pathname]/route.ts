import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { get } from '@vercel/blob'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pathname: string[] }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { pathname } = await params
    // O pathname pode vir encodado como URL completa, então decodificamos
    const fullPathname = decodeURIComponent(pathname.join('/'))
    
    // Extrair apenas o pathname do blob (sem o domínio)
    let blobPathname = fullPathname
    if (fullPathname.includes('.blob.vercel-storage.com/')) {
      // Extrair o pathname após o domínio
      const match = fullPathname.match(/\.blob\.vercel-storage\.com\/(.+)$/)
      if (match) {
        blobPathname = match[1]
        // Remover query params se existirem
        blobPathname = blobPathname.split('?')[0]
      }
    }

    // Buscar o blob usando get() com access: 'private'
    const result = await get(blobPathname, { 
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })

    if (!result || result.statusCode === 404) {
      return new NextResponse('Arquivo não encontrado', { status: 404 })
    }

    // Se o blob não mudou, retornar 304
    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'ETag': result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    // Retornar o stream do arquivo
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'ETag': result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error)
    return NextResponse.json({ error: 'Erro ao buscar arquivo' }, { status: 500 })
  }
}
