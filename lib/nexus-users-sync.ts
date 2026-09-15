import { sql, type UserRole } from "@/lib/db"
import { getRaroNexusConfig, mapRaroNexusRole, SENTINEL_PASSWORD_HASH } from "@/lib/auth"

type NexusAuthorizedUser = {
  id: string
  nome: string
  email: string
  avatar_url?: string | null
  role_nome?: string | null
  role_chave?: string | null
}

type NexusAuthorizedUsersPayload = {
  success?: boolean
  data?: NexusAuthorizedUser[]
  message?: string
}

type LocalUserRow = {
  id: number
  nexus_user_id: string | null
  nexus_email: string | null
  email: string | null
  name: string | null
  role: UserRole | null
  active: boolean | null
}

let syncPromise: Promise<void> | null = null

async function fetchAuthorizedNexusUsers() {
  const config = getRaroNexusConfig()

  const response = await fetch(`${config.baseUrl}/api/v1/applications/authorized-users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  })

  const payload = (await response.json().catch(() => null)) as NexusAuthorizedUsersPayload | null
  if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
    throw new Error(payload?.message || "Não foi possível sincronizar usuários do RaroNexus.")
  }

  return payload.data
}

export async function syncAuthorizedNexusUsers() {
  if (syncPromise) return syncPromise

  syncPromise = (async () => {
    const nexusUsers = await fetchAuthorizedNexusUsers()

    await sql.begin(async (tx) => {
      const localUsers = await tx<LocalUserRow[]>`
        SELECT id, nexus_user_id, nexus_email, email, name, role, active
        FROM users
      `

      const byNexusId = new Map<string, LocalUserRow>()
      const byEmail = new Map<string, LocalUserRow>()
      const authorizedNexusIds = new Set<string>()
      const authorizedEmails = new Set<string>()

      for (const user of localUsers) {
        if (user.nexus_user_id) byNexusId.set(String(user.nexus_user_id).trim().toLowerCase(), user)
        if (user.email) byEmail.set(String(user.email).trim().toLowerCase(), user)
      }

      for (const nexusUser of nexusUsers) {
        const nexusUserId = nexusUser.id?.trim()
        const email = nexusUser.email?.trim().toLowerCase()
        const role = mapRaroNexusRole(nexusUser.role_chave)

        if (!nexusUserId || !email || !role) continue

        authorizedNexusIds.add(nexusUserId)
        authorizedEmails.add(email)

        const name = (nexusUser.nome || email).trim()
        const existing = byNexusId.get(nexusUserId.toLowerCase()) || byEmail.get(email)

        if (existing) {
          const needsUpdate =
            existing.nexus_user_id !== nexusUserId ||
            (existing.nexus_email?.trim().toLowerCase() ?? "") !== email ||
            (existing.email?.trim().toLowerCase() ?? "") !== email ||
            (existing.name?.trim() ?? "") !== name ||
            existing.role !== role ||
            existing.active !== true

          if (needsUpdate) {
            await tx`
              UPDATE users
              SET nexus_user_id = ${nexusUserId}::uuid,
                  nexus_email = ${email},
                  name = ${name},
                  email = ${email},
                  role = ${role},
                  active = true,
                  updated_at = NOW()
              WHERE id = ${existing.id}
            `
          }
        } else {
          await tx`
            INSERT INTO users (nexus_user_id, nexus_email, name, email, password_hash, role, department, active)
            VALUES (${nexusUserId}::uuid, ${email}, ${name}, ${email}, ${SENTINEL_PASSWORD_HASH}, ${role}, null, true)
          `
        }
      }

      const idsToInactivate = localUsers
        .filter((localUser) => {
          const nexusUserId = localUser.nexus_user_id ? String(localUser.nexus_user_id).trim() : ""
          const email = localUser.email ? String(localUser.email).trim().toLowerCase() : ""
          const isAuthorized = nexusUserId
            ? authorizedNexusIds.has(nexusUserId)
            : Boolean(email && authorizedEmails.has(email))

          return !isAuthorized && localUser.active !== false
        })
        .map((user) => user.id)

      if (idsToInactivate.length > 0) {
        await tx`
          UPDATE users
          SET active = false,
              updated_at = NOW()
          WHERE id = ANY(${idsToInactivate})
        `
      }
    })
  })().finally(() => {
    syncPromise = null
  })

  return syncPromise
}