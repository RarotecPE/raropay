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

function getSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql

  const connectionString = getRawConnection()

  if (!connectionString) {
    // Em build (NEXT_PHASE) não quebra o build, retorna um stub que só falha se realmente usado em runtime
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
    if (isBuild) {
      // Stub callable que não faz nada durante build, mas falha se usado fora do build sem env
      const dummyFn: any = (..._args: unknown[]) => {
        // Durante build, retorna array vazio para não quebrar coleta de páginas
        // Em runtime sem env, lança erro explicativo
        if (process.env.NEXT_PHASE === 'phase-production-build') {
          return Promise.resolve([]) as unknown as ReturnType<typeof postgres>
        }
        throw new Error('DATABASE_CONNECTION não configurada')
      }
      dummyFn.unsafe = dummyFn
      dummyFn.begin = async () => { throw new Error('DATABASE_CONNECTION não configurada') }
      dummyFn.end = async () => {}
      return dummyFn as unknown as ReturnType<typeof postgres>
    }
    throw new Error('DATABASE_CONNECTION não configurada')
  }

  _sql = createSql(connectionString)
  return _sql
}

// Função base que delega para o sql real (lazy)
function sqlBase(...args: Parameters<ReturnType<typeof postgres>>): ReturnType<ReturnType<typeof postgres>> {
  const real = getSql() as unknown as (...a: unknown[]) => unknown
  return real(...args) as ReturnType<ReturnType<typeof postgres>>
}

// Proxy que torna sql callable como tag e expõe propriedades (end, unsafe, etc)
export const sql = new Proxy(sqlBase as unknown as ReturnType<typeof postgres>, {
  get(target, prop, receiver) {
    // Propriedades do próprio wrapper (se houver)
    if (prop in target) {
      return Reflect.get(target, prop, receiver)
    }
    const real = getSql() as unknown as Record<string | symbol, unknown>
    const val = real[prop as string]
    if (typeof val === 'function') {
      return (val as (...a: unknown[]) => unknown).bind(real)
    }
    return val
  },
  apply(_target, _thisArg, args) {
    const real = getSql() as unknown as (...a: unknown[]) => unknown
    return real(...(args as unknown[]))
  },
}) as unknown as ReturnType<typeof postgres>

// Re-exportar tipos
export * from './types'
