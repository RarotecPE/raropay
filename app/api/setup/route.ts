import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Setup local desabilitado. Gerencie usuários no RaroNexus." },
    { status: 410 }
  )
}
