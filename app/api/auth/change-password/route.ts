import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Autenticação exclusivamente via RaroNexus. Alteração de senha local desabilitada." },
    { status: 410 }
  )
}
