import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createPresignedPutUrl,
  deleteFile,
  getFileBuffer,
  putBuffer,
  putFile,
} from '@/lib/r2-storage'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    // 1. Requisições JSON (Presigned URL ou finalização de upload em chunks)
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { action, fileName, fileType, fileSize, uploadId, totalChunks } = body

      if (!ALLOWED_TYPES.includes(fileType)) {
        return NextResponse.json(
          { error: 'Tipo de arquivo nao permitido. Use JPG, PNG, WebP ou PDF.' },
          { status: 400 }
        )
      }

      if (Number(fileSize) > MAX_SIZE) {
        return NextResponse.json(
          { error: 'Arquivo muito grande. Tamanho maximo: 10MB.' },
          { status: 400 }
        )
      }

      const timestamp = Date.now()
      const extension = String(fileName || 'bin').split('.').pop() || 'bin'
      const filename = `receipts/${session.id}/${timestamp}.${extension}`

      if (action === 'presign') {
        const presigned = createPresignedPutUrl(filename)
        return NextResponse.json({
          uploadUrl: presigned.uploadUrl,
          pathname: presigned.pathname,
          url: presigned.url,
        })
      }

      if (action === 'complete') {
        const count = Number(totalChunks)
        if (!uploadId || !count || count < 1 || count > 20) {
          return NextResponse.json({ error: 'Parametros de upload invalidos' }, { status: 400 })
        }

        const chunkPaths = Array.from({ length: count }, (_, idx) => `__chunks/${session.id}/${uploadId}/${idx}`)
        const chunkBuffers = await Promise.all(chunkPaths.map((p) => getFileBuffer(p)))
        const fullBuffer = Buffer.concat(chunkBuffers)

        if (fullBuffer.byteLength > MAX_SIZE) {
          await Promise.allSettled(chunkPaths.map((p) => deleteFile(p)))
          return NextResponse.json(
            { error: 'Arquivo muito grande. Tamanho maximo: 10MB.' },
            { status: 400 }
          )
        }

        const storedFile = await putBuffer(filename, fullBuffer, fileType)
        await Promise.allSettled(chunkPaths.map((p) => deleteFile(p)))

        return NextResponse.json({
          pathname: storedFile.pathname,
          url: storedFile.url,
        })
      }

      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    // 2. Requisições Multipart FormData (chunk individual ou arquivo único direto)
    const formData = await request.formData()
    const action = formData.get('action')

    if (action === 'chunk') {
      const uploadId = String(formData.get('uploadId') || '').replace(/[^a-zA-Z0-9_-]/g, '')
      const chunkIndex = Number(formData.get('chunkIndex'))
      const chunk = formData.get('chunk') as File | null

      if (!uploadId || Number.isNaN(chunkIndex) || !chunk) {
        return NextResponse.json({ error: 'Chunk invalido' }, { status: 400 })
      }

      const chunkPath = `__chunks/${session.id}/${uploadId}/${chunkIndex}`
      await putFile(chunkPath, chunk)
      return NextResponse.json({ ok: true })
    }

    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo nao permitido. Use JPG, PNG, WebP ou PDF.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho maximo: 10MB.' },
        { status: 400 }
      )
    }

    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `receipts/${session.id}/${timestamp}.${extension}`
    const storedFile = await putFile(filename, file)

    return NextResponse.json({
      pathname: storedFile.pathname,
      url: storedFile.url,
    })
  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 })
  }
}
