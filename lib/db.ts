import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

export { sql }

// Re-exportar tipos do arquivo types.ts para manter compatibilidade
export * from './types'
