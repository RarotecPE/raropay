import { type NextRequest, NextResponse } from 'next/server'
import { login, createToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      )
    }
    
    const result = await login(email, password)
    
    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }
    
    const token = await createToken(result.user)
    const cookieStore = await cookies()
    
    // sameSite: 'none' + secure: true é necessário para funcionar no preview do v0 (iframe)
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    })
    
    return NextResponse.json({
      success: true,
      user: result.user,
    })
  } catch (error) {
    console.error('Erro no login:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
