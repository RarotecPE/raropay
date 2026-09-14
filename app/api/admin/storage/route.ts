import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { list } from '@vercel/blob'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    
    // Apenas admin e director podem ver estatísticas de storage
    if (!['admin', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Obter estatísticas do banco de dados (Neon)
    const dbStats = await sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users) as users_count,
        (SELECT COUNT(*)::int FROM expenses) as expenses_count,
        (SELECT COUNT(*)::int FROM expense_batches) as batches_count,
        (SELECT COUNT(*)::int FROM expense_history) as history_count,
        (SELECT COUNT(*)::int FROM vehicles) as vehicles_count,
        (SELECT COUNT(*)::int FROM category_limits) as limits_count,
        pg_database_size(current_database()) as db_size_bytes
    `
    
    // Obter estatísticas do Blob Storage
    let blobStats = {
      totalFiles: 0,
      totalSizeBytes: 0,
      filesByType: {} as Record<string, { count: number; size: number }>
    }
    
    try {
      // Listar todos os blobs (pode precisar de paginação para muitos arquivos)
      let cursor: string | undefined
      let allBlobs: Array<{ pathname: string; size: number }> = []
      
      do {
        const response = await list({ cursor, limit: 1000 })
        allBlobs = [...allBlobs, ...response.blobs]
        cursor = response.cursor
      } while (cursor)
      
      blobStats.totalFiles = allBlobs.length
      blobStats.totalSizeBytes = allBlobs.reduce((acc, blob) => acc + blob.size, 0)
      
      // Agrupar por tipo de arquivo
      allBlobs.forEach(blob => {
        const ext = blob.pathname.split('.').pop()?.toLowerCase() || 'unknown'
        if (!blobStats.filesByType[ext]) {
          blobStats.filesByType[ext] = { count: 0, size: 0 }
        }
        blobStats.filesByType[ext].count++
        blobStats.filesByType[ext].size += blob.size
      })
    } catch (err) {
      console.error('Erro ao obter estatísticas do Blob:', err)
    }

    // Preços por GB (planos pay-per-use)
    // Neon Launch: $0.35/GB/mês
    // Vercel Blob Pro: $0.15/GB/mês
    const neonPricePerGB = 0.35
    const blobPricePerGB = 0.15

    const dbSizeBytes = parseInt(dbStats[0]?.db_size_bytes) || 0
    const dbSizeGB = dbSizeBytes / (1024 * 1024 * 1024)
    const blobSizeGB = blobStats.totalSizeBytes / (1024 * 1024 * 1024)

    return NextResponse.json({
      database: {
        sizeBytes: dbSizeBytes,
        sizeGB: dbSizeGB.toFixed(4),
        estimatedCost: (dbSizeGB * neonPricePerGB).toFixed(2),
        pricePerGB: neonPricePerGB,
        tables: {
          users: dbStats[0]?.users_count || 0,
          expenses: dbStats[0]?.expenses_count || 0,
          batches: dbStats[0]?.batches_count || 0,
          history: dbStats[0]?.history_count || 0,
          vehicles: dbStats[0]?.vehicles_count || 0,
          limits: dbStats[0]?.limits_count || 0
        }
      },
      blob: {
        sizeBytes: blobStats.totalSizeBytes,
        sizeGB: blobSizeGB.toFixed(4),
        estimatedCost: (blobSizeGB * blobPricePerGB).toFixed(2),
        pricePerGB: blobPricePerGB,
        totalFiles: blobStats.totalFiles,
        filesByType: blobStats.filesByType
      }
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas de storage:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
