import { list, del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function DELETE() {
  try {
    // Listar todos os blobs
    const { blobs } = await list()
    
    if (blobs.length === 0) {
      return NextResponse.json({ message: 'Nenhum arquivo encontrado', deleted: 0 })
    }
    
    // Deletar cada blob
    const deleted: string[] = []
    for (const blob of blobs) {
      await del(blob.url)
      deleted.push(blob.pathname)
    }
    
    return NextResponse.json({ 
      message: `${deleted.length} arquivo(s) deletado(s)`,
      deleted 
    })
  } catch (error) {
    console.error('Erro ao limpar blobs:', error)
    return NextResponse.json({ error: 'Erro ao limpar blobs' }, { status: 500 })
  }
}
