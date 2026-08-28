import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getBooleanSetting, setSetting } from "@/lib/settings"
import { SETTING_ADVANCE_PIX_ENABLED } from "@/lib/advance-constants"

// GET: qualquer usuário logado pode ler as configurações do adiantamento
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const pixEnabled = await getBooleanSetting(SETTING_ADVANCE_PIX_ENABLED, false)
  return NextResponse.json({ pixEnabled })
}

// PATCH: apenas admin pode habilitar/desabilitar o PIX
export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem alterar esta configuração" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { pixEnabled } = body

    if (typeof pixEnabled !== "boolean") {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 })
    }

    await setSetting(SETTING_ADVANCE_PIX_ENABLED, pixEnabled ? "true" : "false", session.id)
    return NextResponse.json({ pixEnabled })
  } catch (error) {
    console.error("Erro ao salvar configuração de adiantamento:", error)
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 })
  }
}
