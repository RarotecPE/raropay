import { NextResponse, type NextRequest } from "next/server"
import {
  SESSION_COOKIE,
  clearAuthCookies,
  getGlobalSessionToken,
  getPermissions,
  getRoleDescription,
  getRoleLabel,
  getSessionCookieOptions,
  getSessionFromRequest,
} from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)

  if (!session) {
    const response = NextResponse.json({
      authenticated: false,
      role: null,
      permissions: {},
      user: null,
    })
    clearAuthCookies(response)
    return response
  }

  const response = NextResponse.json({
    authenticated: true,
    role: session.role,
    label: getRoleLabel(session.role),
    description: getRoleDescription(session.role),
    user: session,
    permissions: getPermissions(session.role),
  })

  const token = getGlobalSessionToken(request)
  if (token && !request.cookies.get(SESSION_COOKIE)?.value) {
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions())
  }

  return response
}
