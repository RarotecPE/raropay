import { NextResponse, type NextRequest } from "next/server"
import {
  clearAuthCookies,
  getGlobalSessionToken,
  getRaroNexusConfig,
  invalidateSessionCache,
} from "@/lib/auth"

export async function POST(request: NextRequest) {
  const token = getGlobalSessionToken(request)

  if (token) {
    invalidateSessionCache(token)
    try {
      const config = getRaroNexusConfig()
      await fetch(`${config.baseUrl}/api/v1/sessions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
      })
    } catch (error) {
      console.error("Erro ao revogar sessão RaroNexus:", error)
    }
  }

  const response = NextResponse.json({ ok: true, success: true })
  clearAuthCookies(response)
  return response
}
