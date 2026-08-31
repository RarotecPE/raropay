import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { listFiles } from '@/lib/r2-storage'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    if (!['admin', 'director'].includes(session.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

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

    let storageStats = {
      totalFiles: 0,
      totalSizeBytes: 0,
      filesByType: {} as Record<string, { count: number; size: number }>
    }

    try {
      const files = await listFiles()
      storageStats.totalFiles = files.length
      storageStats.totalSizeBytes = files.reduce((acc, file) => acc + file.size, 0)

      files.forEach(file => {
        const ext = file.pathname.split('.').pop()?.toLowerCase() || 'unknown'
        if (!storageStats.filesByType[ext]) {
          storageStats.filesByType[ext] = { count: 0, size: 0 }
        }
        storageStats.filesByType[ext].count++
        storageStats.filesByType[ext].size += file.size
      })
    } catch (err) {
      console.error('Erro ao obter estatisticas do R2:', err)
    }

    const dbPricePerGB = 0.35
    const storagePricePerGB = 0.015
    const dbSizeBytes = parseInt(dbStats[0]?.db_size_bytes) || 0
    const dbSizeGB = dbSizeBytes / (1024 * 1024 * 1024)
    const storageSizeGB = storageStats.totalSizeBytes / (1024 * 1024 * 1024)

    return NextResponse.json({
      database: {
        sizeBytes: dbSizeBytes,
        sizeGB: dbSizeGB.toFixed(4),
        estimatedCost: (dbSizeGB * dbPricePerGB).toFixed(2),
        pricePerGB: dbPricePerGB,
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
        sizeBytes: storageStats.totalSizeBytes,
        sizeGB: storageSizeGB.toFixed(4),
        estimatedCost: (storageSizeGB * storagePricePerGB).toFixed(2),
        pricePerGB: storagePricePerGB,
        totalFiles: storageStats.totalFiles,
        filesByType: storageStats.filesByType
      }
    })
  } catch (error) {
    console.error('Erro ao obter estatisticas de storage:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
