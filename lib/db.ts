import postgres from 'postgres'

function getRawConnection() {
  const raw = (process.env.DATABASE_CONNECTION ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '') as string
  return raw.trim().replace(/^["']|["']$/g, '')
}

function normalizeConnectionString(value: string) {
  const match = value.match(/^(postgres(?:ql)?:\/\/)([^/@]*)(@.*)$/)
  if (!match) return value
  const [, protocol, credentials, rest] = match
  try {
    decodeURIComponent(credentials)
    return value
  } catch {}
  const separator = credentials.indexOf(':')
  if (separator === -1) {
    return `${protocol}${encodeURIComponent(credentials)}${rest}`
  }
  const user = credentials.slice(0, separator)
  const password = credentials.slice(separator + 1)
  return `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(password)}${rest}`
}

function createSql(value: string) {
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://') && value.includes(';')) {
    const [hostPort, database, username, ...passwordParts] = value.split(';')
    const [host, portValue] = hostPort.split(':')
    const password = passwordParts.join(';')
    return postgres({
      host,
      port: portValue ? Number(portValue) : 5432,
      database,
      username,
      password,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    })
  }
  return postgres(normalizeConnectionString(value), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  })
}

let _sql: ReturnType<typeof postgres> | null = null

function getSql() {
  if (_sql) return _sql
  const connectionString = getRawConnection()
  if (!connectionString) {
    // Durante build sem env, retorna proxy que falha apenas se usado em runtime
    // Isso evita que o build quebre na fase de coleta de páginas
    if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV !== 'production') {
      // Em build, cria um proxy que lança erro apenas quando chamado
      const dummy = new Proxy(() => {}, {
        get(_, prop) {
          if (prop === 'then') return undefined
          return () => {
            throw new Error('DATABASE_CONNECTION não configurada')
          }
        },
        apply() {
          throw new Error('DATABASE_CONNECTION não configurada')
        },
      }) as unknown as ReturnType<typeof postgres>
      return dummy
    }
    throw new Error('DATABASE_CONNECTION não configurada')
  }
  _sql = createSql(connectionString)
  return _sql
}

// Exporta como proxy para manter compatibilidade com `sql` tag
const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_, prop) {
    const real = getSql() as any
    const val = real[prop]
    if (typeof val === 'function') return val.bind(real)
    return val
  },
  apply(_, __, args) {
    const real = getSql() as any
    return real(...args)
  },
}) as unknown as ReturnType<typeof postgres>

export { sql }

// Re-exportar tipos
export * from './types'
