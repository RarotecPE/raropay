import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { putFile } from '@/lib/r2-storage'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo nao permitido. Use JPG, PNG, WebP ou PDF.' },
        { status: 400 }
      )
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
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
