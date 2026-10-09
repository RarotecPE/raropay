#!/usr/bin/env node
/**
 * scripts/maintenance.mjs
 *
 * Ferramenta unificada de manutenção do RaroPay / Rarotec
 * Mantém compatibilidade com infraestrutura da main:
 *  - Postgres via lib/db.ts (DATABASE_CONNECTION + fallback DATABASE_URL/POSTGRES_URL)
 *  - Cloudflare R2 via @aws-sdk/client-s3 (lib/r2-storage)
 *
 * Unifica os scripts divergentes entre main e feature/atualizar-nova-versao-raropay:
 *  - 003-fix-admin-user.mjs (postgres vs neon)
 *  - fix-passwords.js (postgres vs neon)
 *  - cleanup-blobs.mjs (R2 vs Vercel Blob)
 *
 * Uso:
 *   node scripts/maintenance.mjs --fix-admin
 *   node scripts/maintenance.mjs --fix-passwords --password 123456
 *   node scripts/maintenance.mjs --cleanup
 *   node scripts/maintenance.mjs --all
 *
 * Env vars necessárias:
 *   DATABASE_CONNECTION ou DATABASE_URL / POSTGRES_URL
 *   R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, (opcional R2_BASE_PREFIX)
 */

import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

// Auto-carrega .env da raiz do projeto se não estiver definido
if (!process.env.DATABASE_CONNECTION && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath)
    }
  } catch {}
}

// ---------- DB ----------
function getConnectionString() {
  const raw = (process.env.DATABASE_CONNECTION ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '').trim().replace(/^["']|["']$/g, '')
  if (!raw) throw new Error('DATABASE_CONNECTION / DATABASE_URL não configurada')
  return raw
}

function normalizeConnectionString(value) {
  const match = value.match(/^(postgres(?:ql)?:\/\/)([^/@]*)(@.*)$/)
  if (!match) return value
  const [, protocol, credentials, rest] = match
  try {
    decodeURIComponent(credentials)
    return value
  } catch {}
  const sep = credentials.indexOf(':')
  if (sep === -1) return `${protocol}${encodeURIComponent(credentials)}${rest}`
  const user = credentials.slice(0, sep)
  const pass = credentials.slice(sep + 1)
  return `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}${rest}`
}

function createSql() {
  const conn = getConnectionString()
  // formato host:port;db;user;pass
  if (!conn.startsWith('postgres://') && !conn.startsWith('postgresql://') && conn.includes(';')) {
    const [hostPort, database, username, ...passwordParts] = conn.split(';')
    const [host, portValue] = hostPort.split(':')
    const password = passwordParts.join(';')
    return postgres({
      host,
      port: portValue ? Number(portValue) : 5432,
      database,
      username,
      password,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })
  }
  return postgres(normalizeConnectionString(conn), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  })
}

// ---------- Ações ----------
async function fixAdminUser() {
  const sql = createSql()
  try {
    const hashed = await bcrypt.hash('admin123', 12)
    console.log('[maintenance] Atualizando/criando usuário admin (admin@rarotec.com.br)...')
    // tenta com coluna role = 'admin' ou 'diretoria' dependendo do schema
    // Usa diretoria primeiro (compatível com feature), fallback para admin
    try {
      await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Administrador', 'admin@rarotec.com.br', ${hashed}, 'admin')
        ON CONFLICT (email)
        DO UPDATE SET password_hash = ${hashed}
      `
    } catch {
      // fallback para diretoria
      await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Administrador', 'admin@rarotec.com.br', ${hashed}, 'diretoria')
        ON CONFLICT (email)
        DO UPDATE SET password_hash = ${hashed}
      `
    }
    console.log('[maintenance] Admin OK - email: admin@rarotec.com.br / senha: admin123')
  } finally {
    await sql.end?.()
  }
}

async function fixPasswords({ password = '123456', email } = {}) {
  const sql = createSql()
  try {
    const hash = await bcrypt.hash(password, 10)
    console.log(`[maintenance] Hash gerado para senha "${password}": ${hash}`)
    if (email) {
      const res = await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${email} RETURNING id, name, email, role`
      console.log(`[maintenance] Atualizado usuário ${email}:`, res[0] || 'não encontrado')
    } else {
      await sql`UPDATE users SET password_hash = ${hash}`
      console.log('[maintenance] Todas as senhas atualizadas')
    }
    const users = await sql`SELECT id, name, email, role, active FROM users ORDER BY id`
    console.log('\n[maintenance] Usuários no sistema:')
    users.forEach((u) => console.log(` - #${u.id} ${u.name} (${u.email}) - ${u.role} ${u.active ? '' : '(inativo)'}`))
  } finally {
    await sql.end?.()
  }
}

async function fixSequences() {
  const sql = createSql()
  try {
    console.log('[maintenance] Sincronizando sequences com o MAX(id) de todas as tabelas...')

    const tablesWithSequences = await sql`
      SELECT 
        c.relname AS table_name,
        a.attname AS column_name,
        pg_get_serial_sequence(quote_ident(c.relname), quote_ident(a.attname)) AS sequence_name
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND pg_get_serial_sequence(quote_ident(c.relname), quote_ident(a.attname)) IS NOT NULL
      ORDER BY c.relname;
    `

    if (tablesWithSequences.length === 0) {
      console.log('[maintenance] Nenhuma sequence encontrada.')
      return
    }

    for (const item of tablesWithSequences) {
      const { table_name, column_name, sequence_name } = item
      if (!sequence_name) continue

      try {
        const maxResult = await sql.unsafe(`SELECT COALESCE(MAX("${column_name}"), 0) AS max_val FROM "${table_name}"`)
        const maxVal = Number(maxResult[0]?.max_val || 0)

        if (maxVal > 0) {
          await sql.unsafe(`SELECT setval('${sequence_name}', ${maxVal}, true)`)
          console.log(` - ${table_name}.${column_name} (${sequence_name}) -> sincronizada para ${maxVal} (próximo id: ${maxVal + 1})`)
        } else {
          await sql.unsafe(`SELECT setval('${sequence_name}', 1, false)`)
          console.log(` - ${table_name}.${column_name} (${sequence_name}) -> vazia, redefinida para 1`)
        }
      } catch (err) {
        console.warn(` [aviso] Não foi possível sincronizar ${table_name}.${column_name}: ${err.message}`)
      }
    }

    console.log('[maintenance] Sequences sincronizadas com sucesso!')
  } finally {
    await sql.end?.()
  }
}

function requiredEnv(name) {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Variável ${name} não configurada`)
  return v
}

async function cleanupR2() {
  const endpoint = requiredEnv('R2_ENDPOINT').replace(/\/+$/, '')
  const bucket = requiredEnv('R2_BUCKET')
  const basePrefix = (process.env.R2_BASE_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '')

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  })

  console.log(`[maintenance] Limpando R2 bucket=${bucket} prefix=${basePrefix || '(raiz)'}`)

  let token
  const files = []
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: basePrefix ? `${basePrefix}/` : undefined,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )
    files.push(...(resp.Contents ?? []).filter((o) => o.Key))
    token = resp.NextContinuationToken
  } while (token)

  if (files.length === 0) {
    console.log('[maintenance] Nenhum arquivo no R2')
    return
  }

  console.log(`[maintenance] ${files.length} arquivo(s) encontrados`)
  for (const f of files) {
    console.log(` Deletando ${f.Key}`)
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: f.Key }))
  }
  console.log(`[maintenance] ${files.length} arquivo(s) deletados`)
}

// ---------- CLI ----------
const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const getArg = (flag) => {
  const idx = args.indexOf(flag)
  if (idx !== -1 && args[idx + 1]) return args[idx + 1]
  // suporte --flag=value
  const pref = args.find((a) => a.startsWith(`${flag}=`))
  if (pref) return pref.split('=')[1]
  return null
}

async function main() {
  const doFixSequences = has('--fix-sequences') || has('--all')
  const doFixAdmin = has('--fix-admin') || has('--all')
  const doFixPw = has('--fix-passwords') || has('--all')
  const doCleanup = has('--cleanup') || has('--all')

  if (!doFixSequences && !doFixAdmin && !doFixPw && !doCleanup) {
    console.log(`
Uso: node scripts/maintenance.mjs [opções]

  --fix-sequences             Sincroniza todas as sequences de IDs com o MAX(id) de cada tabela
  --fix-admin                 Cria/atualiza admin@rarotec.com.br com senha admin123
  --fix-passwords             Redefine senhas (padrão 123456 para todos)
    --password <senha>        Senha a usar (default 123456)
    --email <email>           Se informado, altera só este usuário
  --cleanup                   Limpa todos os arquivos do R2 (requer envs R2_*)
  --all                       Executa fix-sequences + fix-admin + fix-passwords + cleanup

Exemplos:
  node scripts/maintenance.mjs --fix-sequences
  node scripts/maintenance.mjs --fix-admin
  node scripts/maintenance.mjs --fix-passwords --password 123456
  node scripts/maintenance.mjs --fix-passwords --email user@exemplo.com --password nova123
  node scripts/maintenance.mjs --cleanup
  node scripts/maintenance.mjs --all
`)
    process.exit(1)
  }

  if (doFixSequences) await fixSequences()
  if (doFixAdmin) await fixAdminUser()
  if (doFixPw) {
    const pw = getArg('--password') || '123456'
    const email = getArg('--email') || null
    await fixPasswords({ password: pw, email })
  }
  if (doCleanup) await cleanupR2()

  console.log('\n[maintenance] Concluído')
}

main().catch((e) => {
  console.error('[maintenance] Erro:', e)
  process.exit(1)
})
