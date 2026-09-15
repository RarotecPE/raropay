import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { cache } from "react"
import * as bcrypt from "bcryptjs"
import { sql, type UserRole } from "./db"

export const SESSION_COOKIE = "raropay_global_session"
export const SSO_STATE_COOKIE = "raropay_sso_state"
export const SSO_NEXT_COOKIE = "raropay_sso_next"
export const PERSISTENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10

export const SENTINEL_PASSWORD_HASH = "raronexus-auth-only"

const roleLabels: Record<UserRole, string> = {
  employee: "Funcionário",
  manager: "Gestor",
  director: "Diretoria",
  admin: "Administrador",
  financial: "Financeiro",
  coordinator: "Coordenador",
}

const roleDescriptions: Record<UserRole, string> = {
  employee: "Acesso operacional às próprias despesas.",
  manager: "Acesso gerencial às despesas e relatórios permitidos.",
  director: "Acesso de diretoria às áreas administrativas.",
  admin: "Acesso administrativo completo.",
  financial: "Acesso financeiro ao processamento e gestão.",
  coordinator: "Acesso de coordenação às áreas permitidas.",
}

const roleAliases: Record<string, UserRole | null> = {
  employee: "employee",
  funcionario: "employee",
  "funcionário": "employee",
  colaborador: "employee",
  manager: "manager",
  gestor: "manager",
  gerente: "manager",
  director: "director",
  diretoria: "director",
  diretor: "director",
  admin: "admin",
  administrator: "admin",
  administrador: "admin",
  financial: "financial",
  finance: "financial",
  financeiro: "financial",
  coordinator: "coordinator",
  coordenador: "coordinator",
  coordenacao: "coordinator",
  "coordenação": "coordinator",
  nao_autorizado: null,
  "não_autorizado": null,
  unauthorized: null,
}

export interface SessionUser {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  department: string | null
  avatar_url?: string | null
  raronexus_id?: string
}

interface RaroNexusUser {
  id: string
  nome: string
  email: string
  avatar_url?: string | null
}

interface RaroNexusRole {
  id?: string
  nome: string
  chave: string
}

interface RaroNexusSession {
  user: RaroNexusUser
  role: RaroNexusRole
}

export function getRaroNexusConfig() {
  const baseUrl = process.env.RARONEXUS_BASE_URL?.replace(/\/+$/, "")
  const clientId = process.env.RARONEXUS_CLIENT_ID
  const clientSecret = process.env.RARONEXUS_CLIENT_SECRET
  const appBaseUrl = process.env.RAROPAY_BASE_URL?.replace(/\/+$/, "")

  if (!baseUrl || !clientId || !clientSecret || !appBaseUrl) {
    throw new Error("Configuração RaroNexus incompleta")
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    appBaseUrl,
    redirectUri: `${appBaseUrl}/api/auth/raronexus/callback`,
  }
}

export function sanitizeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) {
    return fallback
  }

  return next
}

export function mapRaroNexusRole(role: string | null | undefined): UserRole | null {
  if (!role) return null
  return roleAliases[role.trim().toLowerCase()] ?? null
}

export function getSessionCookieOptions(maxAge = PERSISTENT_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export function getTempCookieOptions(maxAge = 60 * 5) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export function clearAuthCookies(response: NextResponse) {
  const clearOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }

  response.cookies.set(SESSION_COOKIE, "", clearOptions)
  response.cookies.set(SSO_STATE_COOKIE, "", clearOptions)
  response.cookies.set(SSO_NEXT_COOKIE, "", clearOptions)
  response.cookies.set("auth-token", "", clearOptions)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash === SENTINEL_PASSWORD_HASH) return false
  return bcrypt.compare(password, hash)
}

export async function login(): Promise<{ success: boolean; error: string }> {
  return {
    success: false,
    error: "Login local desabilitado. Use RaroNexus.",
  }
}

export async function createToken(): Promise<string> {
  throw new Error("Login local desabilitado. Use RaroNexus.")
}

async function introspectToken(token: string): Promise<RaroNexusSession | null> {
  const config = getRaroNexusConfig()

  const response = await fetch(`${config.baseUrl}/api/v1/sessions/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      client_id: config.clientId,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json() as {
    success?: boolean
    data?: {
      active?: boolean
      user?: RaroNexusUser
      role?: RaroNexusRole
    }
  }

  if (!payload.success || !payload.data?.active || !payload.data.user || !payload.data.role) {
    return null
  }

  return {
    user: payload.data.user,
    role: payload.data.role,
  }
}

interface LocalUserRow {
  id: number
  nexus_user_id: string | null
  nexus_email: string | null
  name: string
  email: string
  phone: string | null
  role: UserRole
  department: string | null
  active: boolean
}

export async function ensureLocalUser(session: RaroNexusSession): Promise<SessionUser | null> {
  const role = mapRaroNexusRole(session.role.chave)

  if (!role) {
    return null
  }

  const email = session.user.email.trim().toLowerCase()
  const name = session.user.nome.trim() || email

  const [existing] = await sql<LocalUserRow[]>`
    SELECT id, nexus_user_id, nexus_email, name, email, phone, role, department, active
    FROM users
    WHERE nexus_user_id = ${session.user.id}::uuid
       OR LOWER(nexus_email) = ${email}
       OR LOWER(email) = ${email}
    ORDER BY CASE WHEN nexus_user_id = ${session.user.id}::uuid THEN 0 ELSE 1 END
    LIMIT 1
  `

  if (existing) {
    const [updated] = await sql<LocalUserRow[]>`
      UPDATE users
      SET nexus_user_id = ${session.user.id}::uuid,
          nexus_email = ${email},
          name = ${name},
          email = ${email},
          role = ${role},
          active = true,
          updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING id, nexus_user_id, nexus_email, name, email, phone, role, department, active
    `

    if (!updated) return null
    return toSessionUser(updated, session)
  }

  const [created] = await sql<LocalUserRow[]>`
    INSERT INTO users (nexus_user_id, nexus_email, name, email, password_hash, role, department, active)
    VALUES (${session.user.id}::uuid, ${email}, ${name}, ${email}, ${SENTINEL_PASSWORD_HASH}, ${role}, null, true)
    RETURNING id, nexus_user_id, nexus_email, name, email, phone, role, department, active
  `

  if (!created) return null
  return toSessionUser(created, session)
}

function toSessionUser(localUser: LocalUserRow, nexusSession: RaroNexusSession): SessionUser | null {
  if (!localUser?.active) {
    return null
  }

  return {
    id: Number(localUser.id),
    name: localUser.name,
    email: localUser.email,
    phone: localUser.phone ?? null,
    role: localUser.role,
    department: localUser.department ?? null,
    avatar_url: nexusSession.user.avatar_url ?? null,
    raronexus_id: nexusSession.user.id,
  }
}

export function getGlobalSessionToken(request: NextRequest | Request): string | null {
  if ("cookies" in request) {
    const nextReq = request as NextRequest
    return (
      nextReq.cookies.get(SESSION_COOKIE)?.value ??
      nextReq.cookies.get("raronexus_global_session")?.value ??
      null
    )
  }
  return null
}

export async function getGlobalSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return (
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get("raronexus_global_session")?.value ??
    null
  )
}

interface CachedSession {
  user: SessionUser
  expiresAt: number
}

const sessionCache = new Map<string, CachedSession>()
const sessionInflight = new Map<string, Promise<SessionUser | null>>()
const SESSION_CACHE_TTL_MS = 15_000 // 15s de cache em memória para requisições concorrentes

export function invalidateSessionCache(token?: string | null) {
  if (token) {
    sessionCache.delete(token)
    sessionInflight.delete(token)
  } else {
    sessionCache.clear()
    sessionInflight.clear()
  }
}

export async function getSessionFromToken(token: string | null): Promise<SessionUser | null> {
  if (!token) return null

  const cached = sessionCache.get(token)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user
  }

  const pending = sessionInflight.get(token)
  if (pending) return pending

  const promise = (async () => {
    try {
      const session = await introspectToken(token)
      if (!session) {
        sessionCache.delete(token)
        return null
      }
      const localUser = await ensureLocalUser(session)
      if (localUser) {
        sessionCache.set(token, {
          user: localUser,
          expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
        })
      } else {
        sessionCache.delete(token)
      }
      return localUser
    } catch (error) {
      console.error("Erro ao introspectar sessão RaroNexus:", error)
      return null
    }
  })().finally(() => {
    sessionInflight.delete(token)
  })

  sessionInflight.set(token, promise)
  return promise
}

export async function getSessionFromRequest(request: NextRequest | Request): Promise<SessionUser | null> {
  const token = getGlobalSessionToken(request)
  return getSessionFromToken(token)
}

export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  const token = await getGlobalSessionTokenFromCookies()
  return getSessionFromToken(token)
})

export function getRoleLabel(role: UserRole) {
  return roleLabels[role] || role
}

export function getRoleDescription(role: UserRole) {
  return roleDescriptions[role] || ""
}

export function getPermissions(role: UserRole) {
  return {
    canApproveExpenses: canApproveExpenses(role),
    canViewAllExpenses: canViewAllExpenses(role),
    canManageUsers: canManageUsers(role),
    canViewReports: canViewReports(role),
    canAccessFinancial: ["financial", "admin", "director"].includes(role),
    canAccessAdmin: ["admin", "director"].includes(role),
  }
}

export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function canApproveExpenses(userRole: UserRole | string): boolean {
  return ["manager", "director", "financial"].includes(userRole)
}

export function canViewAllExpenses(userRole: UserRole | string): boolean {
  return ["director", "admin", "financial"].includes(userRole)
}

export function canManageUsers(userRole: UserRole | string): boolean {
  return ["director", "admin", "financial", "manager", "coordinator"].includes(userRole)
}

export function canViewReports(userRole: UserRole | string): boolean {
  return ["manager", "director", "admin", "financial"].includes(userRole)
}
