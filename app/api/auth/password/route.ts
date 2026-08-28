import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Alteração de senha local desabilitada. Use o RaroNexus." },
    { status: 410 }
  )
}
