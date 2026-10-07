import { NextResponse, type NextRequest } from "next/server"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/advances/:path*",
    "/analysis/:path*",
    "/card-invoices/:path*",
    "/expenses/:path*",
    "/financial/:path*",
    "/management/:path*",
    "/my-invoices/:path*",
    "/profile/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
}

const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/branding",
  "/api/institucional",
  "/api/ibge",
  "/api/geo",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Liberar rotas públicas de API
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return NextResponse.next()
    }
  }

  const token =
    request.cookies.get("raropay_global_session")?.value ||
    request.cookies.get("raronexus_global_session")?.value ||
    request.cookies.get("session_id")?.value ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")!.slice(7)
      : null)

  // Tratamento para requisições de API privadas
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json(
        {
          error: "Não autorizado. Sessão ausente ou inválida.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // Tratamento para páginas protegidas do Dashboard
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

