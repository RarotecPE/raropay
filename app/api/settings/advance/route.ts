import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getBooleanSetting, setSetting } from "@/lib/settings"
import { SETTING_ADVANCE_PIX_ENABLED } from "@/lib/advance-constants"
import { auditClient, getRequestContext } from "@/lib/audit"

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

    const previousPixEnabled = await getBooleanSetting(SETTING_ADVANCE_PIX_ENABLED, false)
    await setSetting(SETTING_ADVANCE_PIX_ENABLED, pixEnabled ? "true" : "false", session.id)

    auditClient.log({
      category: "advances",
      action: "advance.settings_updated",
      severity: "WARNING",
      actor: {
        type: "user",
        userId: String(session.id),
        name: session.name,
        email: session.email,
        role: session.role,
      },
      targets: [
        { type: "setting", id: SETTING_ADVANCE_PIX_ENABLED, label: "Configuração de Adiantamento via PIX" },
      ],
      context: getRequestContext(request),
      diff: {
        before: { pixEnabled: previousPixEnabled },
        after: { pixEnabled },
      },
      details: {
        setting_key: SETTING_ADVANCE_PIX_ENABLED,
        pixEnabled,
      },
    })

    return NextResponse.json({ pixEnabled })
  } catch (error) {
    console.error("Erro ao salvar configuração de adiantamento:", error)
    return NextResponse.json({ error: "Erro ao salvar configuração" }, { status: 500 })
  }
}
