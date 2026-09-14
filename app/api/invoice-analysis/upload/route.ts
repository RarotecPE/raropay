import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo (apenas PDF e imagens)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use PDF ou imagens.' }, { status: 400 })
    }

    // Validar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
    }

    // Upload para Vercel Blob
    const timestamp = Date.now()
    const fileName = `invoice-analysis/${user.id}/${timestamp}-${file.name}`
    
    const blob = await put(fileName, file, {
      access: 'private',
    })

    return NextResponse.json({
      file_name: file.name,
      file_path: blob.pathname,
      file_type: file.type,
      file_size: file.size
    })
  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ error: 'Falha no upload' }, { status: 500 })
  }
}
