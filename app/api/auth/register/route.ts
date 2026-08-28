import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Cadastro local desabilitado. Gerencie usuários no RaroNexus." },
    { status: 410 }
  )
}
