import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { deleteFile, listFiles } from '@/lib/r2-storage'
import { auditClient, getRequestContext } from '@/lib/audit'

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    if (!['admin', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const files = await listFiles()

    if (files.length === 0) {
      return NextResponse.json({ message: 'Nenhum arquivo encontrado', deleted: 0 })
    }

    const deleted: string[] = []
    for (const file of files) {
      await deleteFile(file.pathname)
      deleted.push(file.pathname)
    }

    auditClient.log({
      category: 'storage',
      action: 'storage.blobs_cleaned',
      severity: 'WARNING',
      actor: {
        type: 'user',
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        { type: 'storage', id: 'r2-blobs', label: `Limpeza de Comprovantes no Storage (${deleted.length} arquivos)` },
      ],
      context: getRequestContext(request),
      details: {
        deleted_count: deleted.length,
        deleted_files: deleted.slice(0, 100),
      },
    })

    return NextResponse.json({
      message: `${deleted.length} arquivo(s) deletado(s)`,
      deleted
    })
  } catch (error) {
    console.error('Erro ao limpar arquivos do R2:', error)
    return NextResponse.json({ error: 'Erro ao limpar arquivos' }, { status: 500 })
  }
}
