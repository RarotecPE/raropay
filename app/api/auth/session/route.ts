import { NextResponse, type NextRequest } from "next/server"
import {
  clearAuthCookies,
  getPermissions,
  getRoleDescription,
  getRoleLabel,
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

  return NextResponse.json({
    authenticated: true,
    role: session.role,
    label: getRoleLabel(session.role),
    description: getRoleDescription(session.role),
    user: session,
    permissions: getPermissions(session.role),
  })
}
