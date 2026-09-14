import { cookies } from 'next/headers'
import { sql, type User, type UserRole } from './db'
import * as bcrypt from 'bcryptjs'
import * as jose from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'rarotec-sistema-financeiro-secret-key-2024'
)

export interface SessionUser {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  department: string | null
}

// Criar hash de senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// Verificar senha
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Criar token JWT
export async function createToken(user: SessionUser): Promise<string> {
  return new jose.SignJWT({ 
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    department: user.department
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

// Verificar token JWT
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

// Obter usuário da sessão atual
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  
  if (!token) {
    return null
  }
  
  return verifyToken(token)
}

// Login do usuário
export async function login(email: string, password: string): Promise<{ success: boolean; user?: SessionUser; error?: string }> {
  try {
    const users = await sql`
      SELECT id, name, email, phone, password_hash, role, department, active
      FROM users
      WHERE email = ${email.toLowerCase()}
    `
    
    if (users.length === 0) {
      return { success: false, error: 'E-mail ou senha inválidos' }
    }
    
    const user = users[0] as User
    
    if (!user.active) {
      return { success: false, error: 'Usuário desativado. Entre em contato com o administrador.' }
    }
    
    const validPassword = await verifyPassword(password, user.password_hash)
    
    if (!validPassword) {
      return { success: false, error: 'E-mail ou senha inválidos' }
    }
    
    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department
    }
    
    return { success: true, user: sessionUser }
  } catch (error) {
    console.error('Erro no login:', error)
    return { success: false, error: 'Erro ao realizar login. Tente novamente.' }
  }
}

// Verificar se o usuário tem permissão
export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

// Verificar se pode aprovar despesas
export function canApproveExpenses(userRole: UserRole | string): boolean {
  return ['manager', 'director', 'financial'].includes(userRole)
}

// Verificar se pode ver todas as despesas
export function canViewAllExpenses(userRole: UserRole | string): boolean {
  return ['director', 'admin', 'financial'].includes(userRole)
}

// Verificar se pode gerenciar usuários
export function canManageUsers(userRole: UserRole | string): boolean {
  return ['director', 'admin', 'financial', 'manager', 'coordinator'].includes(userRole)
}

// Verificar se pode ver relatórios completos
export function canViewReports(userRole: UserRole | string): boolean {
  return ['manager', 'director', 'admin', 'financial'].includes(userRole)
}
