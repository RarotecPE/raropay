import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou PDF.' },
        { status: 400 }
      )
    }

    // Validar tamanho (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Tamanho máximo: 10MB.' },
        { status: 400 }
      )
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `receipts/${session.id}/${timestamp}.${extension}`

    // A store está configurada como privada - usar access: 'private'
    const blob = await put(filename, file, {
      access: 'private', // Obrigatório para stores privadas
    })

    return NextResponse.json({ 
      pathname: blob.pathname,
      url: blob.url,
    })
  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 })
  }
}
