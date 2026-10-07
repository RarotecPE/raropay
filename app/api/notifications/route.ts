import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  getNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications"

export const dynamic = "force-dynamic"
export const revalidate = 0

// GET - Listar notificações do usuário atual
export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const data = await getNotificationsForUser(user)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar notificações:", error)
    return NextResponse.json(
      { error: "Erro ao carregar notificações", details: String(error) },
      { status: 500 }
    )
  }
}

// PATCH - Marcar notificação(ões) como lida(s)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()

    if (body.markAll) {
      const currentIds = Array.isArray(body.currentIds) ? body.currentIds : []
      await markAllNotificationsAsRead(user.id, currentIds)
      return NextResponse.json({ success: true, allRead: true })
    }

    if (body.notificationId) {
      await markNotificationAsRead(user.id, String(body.notificationId))
      return NextResponse.json({ success: true, notificationId: body.notificationId })
    }

    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  } catch (error) {
    console.error("Erro ao atualizar status de leitura da notificação:", error)
    return NextResponse.json(
      { error: "Erro ao atualizar notificação" },
      { status: 500 }
    )
  }
}

