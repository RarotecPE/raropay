// Endpoint movido para /api/auth/password
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint foi movido. Use /api/auth/password' },
    { status: 301 }
  )
}
