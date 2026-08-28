import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    { error: "Login local desabilitado. Use RaroNexus." },
    { status: 410 }
  )
}
