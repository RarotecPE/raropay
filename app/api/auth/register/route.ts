import { type NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { hashPassword, getSession, canManageUsers } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    // Apenas diretores podem criar usuários (ou se não houver nenhum usuário ainda)
    const existingUsers = await sql`SELECT COUNT(*) as count FROM users`
    const hasUsers = parseInt(existingUsers[0].count) > 0
    
    if (hasUsers && (!session || !canManageUsers(session.role))) {
      return NextResponse.json(
        { error: 'Sem permissão para criar usuários' },
        { status: 403 }
      )
    }
    
    const { name, email, password, role, department } = await request.json()
    
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, e-mail e senha são obrigatórios' },
        { status: 400 }
      )
    }
    
    // Verificar se o e-mail já existe
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `
    
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado' },
        { status: 400 }
      )
    }
    
    const passwordHash = await hashPassword(password)
    
    const result = await sql`
      INSERT INTO users (name, email, password_hash, role, department)
      VALUES (${name}, ${email.toLowerCase()}, ${passwordHash}, ${role || 'employee'}, ${department || null})
      RETURNING id, name, email, role, department
    `
    
    return NextResponse.json({
      success: true,
      user: result[0],
    })
  } catch (error) {
    console.error('Erro ao registrar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
