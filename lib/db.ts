import postgres from 'postgres'

const connectionString = process.env.DATABASE_CONNECTION?.trim().replace(/^["']|["']$/g, "")

if (!connectionString) {
  throw new Error('DATABASE_CONNECTION não configurada')
}

function normalizeConnectionString(value: string) {
  const match = value.match(/^(postgres(?:ql)?:\/\/)([^/@]*)(@.*)$/)
  if (!match) return value

  const [, protocol, credentials, rest] = match
  try {
    decodeURIComponent(credentials)
    return value
  } catch {
    // Credentials copied from control panels may contain raw reserved chars.
  }

  const separator = credentials.indexOf(':')

  if (separator === -1) {
    return `${protocol}${encodeURIComponent(credentials)}${rest}`
  }

  const user = credentials.slice(0, separator)
  const password = credentials.slice(separator + 1)

  return `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(password)}${rest}`
}

function createSql(value: string) {
  if (!value.startsWith("postgres://") && !value.startsWith("postgresql://") && value.includes(";")) {
    const [hostPort, database, username, ...passwordParts] = value.split(";")
    const [host, portValue] = hostPort.split(":")
    const password = passwordParts.join(";")

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

const sql = createSql(connectionString)

export { sql }

// Re-exportar tipos do arquivo types.ts para manter compatibilidade
export * from './types'
