import { randomBytes } from "crypto"
import { NextResponse, type NextRequest } from "next/server"
import {
  SSO_NEXT_COOKIE,
  SSO_STATE_COOKIE,
  getRaroNexusConfig,
  getTempCookieOptions,
  sanitizeNextPath,
} from "@/lib/auth"

export async function GET(request: NextRequest) {
  const config = getRaroNexusConfig()
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"))
  const mode = request.nextUrl.searchParams.get("mode") === "silent" ? "silent" : "interactive"
  const state = `${mode}:${randomBytes(24).toString("hex")}`

  const authorizeUrl = new URL(`${config.baseUrl}/sso/authorize`)
  authorizeUrl.searchParams.set("client_id", config.clientId)
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizeUrl.searchParams.set("state", state)

  if (mode === "silent") {
    authorizeUrl.searchParams.set("prompt", "none")
  }

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(SSO_STATE_COOKIE, state, getTempCookieOptions())
  response.cookies.set(SSO_NEXT_COOKIE, nextPath, getTempCookieOptions())

  return response
}
