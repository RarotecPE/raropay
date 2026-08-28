import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import * as bcrypt from "bcryptjs"
import { sql, type UserRole } from "./db"

export const SESSION_COOKIE = "raropay_global_session"
export const SSO_STATE_COOKIE = "raropay_sso_state"
export const SSO_NEXT_COOKIE = "raropay_sso_next"

const SENTINEL_PASSWORD_HASH = "raronexus-auth-only"

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

export function getSessionCookieOptions(maxAge = 60 * 60 * 24 * 7) {
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

export async function ensureLocalUser(session: RaroNexusSession): Promise<SessionUser | null> {
  const role = mapRaroNexusRole(session.role.chave)

  if (!role) {
    return null
  }

  const email = session.user.email.trim().toLowerCase()
  const name = session.user.nome.trim() || email

  const [existing] = await sql`
    SELECT id, name, email, phone, role, department, active
    FROM users
    WHERE LOWER(email) = ${email}
    LIMIT 1
  `

  if (existing) {
    const [updated] = await sql`
      UPDATE users
      SET name = ${name},
          email = ${email},
          role = ${role},
          active = true,
          updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING id, name, email, phone, role, department, active
    `

    return toSessionUser(updated, session)
  }

  const [created] = await sql`
    INSERT INTO users (name, email, password_hash, role, department, active)
    VALUES (${name}, ${email}, ${SENTINEL_PASSWORD_HASH}, ${role}, null, true)
    RETURNING id, name, email, phone, role, department, active
  `

  return toSessionUser(created, session)
}

function toSessionUser(localUser: {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  department: string | null
  active: boolean
}, nexusSession: RaroNexusSession): SessionUser | null {
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

export async function getSessionFromRequest(request: NextRequest | Request): Promise<SessionUser | null> {
  const token = "cookies" in request
    ? request.cookies.get(SESSION_COOKIE)?.value
    : undefined

  if (!token) {
    return null
  }

  try {
    const session = await introspectToken(token)
    if (!session) return null
    return ensureLocalUser(session)
  } catch (error) {
    console.error("Erro ao introspectar sessão RaroNexus:", error)
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) {
    return null
  }

  try {
    const session = await introspectToken(token)
    if (!session) return null
    return ensureLocalUser(session)
  } catch (error) {
    console.error("Erro ao obter sessão:", error)
    return null
  }
}

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
