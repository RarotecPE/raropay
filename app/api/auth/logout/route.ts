import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  
  // Usar as mesmas opções do login para garantir que o cookie seja removido corretamente
  cookieStore.set('auth-token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 0,
    path: '/',
  })
  
  return NextResponse.json({ success: true })
}
