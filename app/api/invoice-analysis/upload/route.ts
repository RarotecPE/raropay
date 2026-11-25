import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from "@/lib/auth"
import {
  createPresignedPutUrl,
  deleteFile,
  getFileBuffer,
  putBuffer,
  putFile,
} from "@/lib/r2-storage"

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { action, fileName, fileType, fileSize, uploadId, totalChunks } = body

      if (!ALLOWED_TYPES.includes(fileType)) {
        return NextResponse.json({ error: 'Tipo de arquivo nao permitido. Use PDF ou imagens.' }, { status: 400 })
      }

      if (Number(fileSize) > MAX_SIZE) {
        return NextResponse.json({ error: 'Arquivo muito grande. Maximo 10MB.' }, { status: 400 })
      }

      const timestamp = Date.now()
      const targetName = `invoice-analysis/${user.id}/${timestamp}-${fileName}`

      if (action === 'presign') {
        const presigned = createPresignedPutUrl(targetName)
        return NextResponse.json({
          uploadUrl: presigned.uploadUrl,
          pathname: presigned.pathname,
          url: presigned.url,
          file_name: fileName,
          file_path: presigned.pathname,
          file_type: fileType,
          file_size: fileSize,
        })
      }

      if (action === 'complete') {
        const count = Number(totalChunks)
        if (!uploadId || !count || count < 1 || count > 20) {
          return NextResponse.json({ error: 'Parametros de upload invalidos' }, { status: 400 })
        }

        const chunkPaths = Array.from({ length: count }, (_, idx) => `__chunks/${user.id}/${uploadId}/${idx}`)
        const chunkBuffers = await Promise.all(chunkPaths.map((p) => getFileBuffer(p)))
        const fullBuffer = Buffer.concat(chunkBuffers)

        if (fullBuffer.byteLength > MAX_SIZE) {
          await Promise.allSettled(chunkPaths.map((p) => deleteFile(p)))
          return NextResponse.json({ error: 'Arquivo muito grande. Maximo 10MB.' }, { status: 400 })
        }

        const storedFile = await putBuffer(targetName, fullBuffer, fileType)
        await Promise.allSettled(chunkPaths.map((p) => deleteFile(p)))

        return NextResponse.json({
          pathname: storedFile.pathname,
          url: storedFile.url,
          file_name: fileName,
          file_path: storedFile.pathname,
          file_type: fileType,
          file_size: fullBuffer.byteLength,
        })
      }

      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    const formData = await request.formData()
    const action = formData.get('action')

    if (action === 'chunk') {
      const uploadId = String(formData.get('uploadId') || '').replace(/[^a-zA-Z0-9_-]/g, '')
      const chunkIndex = Number(formData.get('chunkIndex'))
      const chunk = formData.get('chunk') as File | null

      if (!uploadId || Number.isNaN(chunkIndex) || !chunk) {
        return NextResponse.json({ error: 'Chunk invalido' }, { status: 400 })
      }

      const chunkPath = `__chunks/${user.id}/${uploadId}/${chunkIndex}`
      await putFile(chunkPath, chunk)
      return NextResponse.json({ ok: true })
    }

    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo nao permitido. Use PDF ou imagens.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 10MB.' }, { status: 400 })
    }

    const timestamp = Date.now()
    const fileName = `invoice-analysis/${user.id}/${timestamp}-${file.name}`
    const storedFile = await putFile(fileName, file)

    return NextResponse.json({
      file_name: file.name,
      file_path: storedFile.pathname,
      file_type: file.type,
      file_size: file.size
    })
  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 })
  }
}
