import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    // Hash da senha admin123
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    // Atualizar ou inserir o usuário admin
    await sql`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Administrador', 'admin@rarotec.com.br', ${hashedPassword}, 'director')
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = ${hashedPassword}
    `
    
    return NextResponse.json({ 
      success: true,
      message: 'Usuário admin criado/atualizado com sucesso!',
      credentials: {
        email: 'admin@rarotec.com.br',
        password: 'admin123'
      }
    })
  } catch (error) {
    console.error('Erro ao criar admin:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Erro ao criar usuário admin' 
    }, { status: 500 })
  }
}
