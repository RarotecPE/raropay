import { NextResponse, type NextRequest } from "next/server"
import {
  SESSION_COOKIE,
  SSO_NEXT_COOKIE,
  SSO_STATE_COOKIE,
  clearAuthCookies,
  ensureLocalUser,
  getRaroNexusConfig,
  getSessionCookieOptions,
  mapRaroNexusRole,
  sanitizeNextPath,
} from "@/lib/auth"

interface TokenResponse {
  success?: boolean
  message?: string
  data?: {
    global_session_token?: string
    user?: {
      id: string
      nome: string
      email: string
      avatar_url?: string | null
    }
    role?: {
      chave: string
      nome: string
    }
  }
}

export async function GET(request: NextRequest) {
  const config = getRaroNexusConfig()
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")
  const savedState = request.cookies.get(SSO_STATE_COOKIE)?.value
  const nextPath = sanitizeNextPath(request.cookies.get(SSO_NEXT_COOKIE)?.value)
  const mode = state?.startsWith("silent:") ? "silent" : "interactive"

  if (error) {
    return callbackResponse({
      status: "error",
      mode,
      message: "Não foi possível entrar com RaroNexus.",
      redirectTo: nextPath,
      clearSession: true,
    })
  }

  if (!code || !state || !savedState || state !== savedState) {
    return callbackResponse({
      status: "error",
      mode,
      message: "Sessão de login inválida. Tente novamente.",
      redirectTo: nextPath,
      clearSession: true,
    })
  }

  try {
    const tokenResponse = await fetch(`${config.baseUrl}/api/v1/sso/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    })

    if (!tokenResponse.ok) {
      return callbackResponse({
        status: "error",
        mode,
        message: "RaroNexus indisponível. Tente novamente.",
        redirectTo: nextPath,
        clearSession: true,
      })
    }

    const payload = await tokenResponse.json() as TokenResponse
    const token = payload.data?.global_session_token
    const user = payload.data?.user
    const role = payload.data?.role

    if (!payload.success || !token || !user || !role || !mapRaroNexusRole(role.chave)) {
      return callbackResponse({
        status: "error",
        mode,
        message: payload.message || "Usuário sem permissão para acessar o Raropay.",
        redirectTo: nextPath,
        clearSession: true,
      })
    }

    const localUser = await ensureLocalUser({ user, role })

    if (!localUser) {
      return callbackResponse({
        status: "error",
        mode,
        message: "Usuário sem permissão para acessar o Raropay.",
        redirectTo: nextPath,
        clearSession: true,
      })
    }

    return callbackResponse({
      status: "success",
      mode,
      message: "Autenticado com sucesso.",
      redirectTo: nextPath,
      token,
    })
  } catch (error) {
    console.error("Erro no callback RaroNexus:", error)
    return callbackResponse({
      status: "error",
      mode,
      message: "Não foi possível entrar com RaroNexus.",
      redirectTo: nextPath,
      clearSession: true,
    })
  }
}

function callbackResponse({
  status,
  mode,
  message,
  redirectTo,
  token,
  clearSession,
}: {
  status: "success" | "error"
  mode: "interactive" | "silent"
  message: string
  redirectTo: string
  token?: string
  clearSession?: boolean
}) {
  const payload = JSON.stringify({
    type: "raronexus:sso",
    status,
    mode,
    message,
    redirectTo,
  }).replace(/</g, "\\u003c")

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>RaroNexus</title>
  </head>
  <body>
    <script>
      const payload = ${payload};
      const target = window.opener || (window.parent !== window ? window.parent : null);
      if (target) {
        target.postMessage(payload, window.location.origin);
        window.close();
      } else if (payload.status === "success") {
        window.location.replace(payload.redirectTo || "/dashboard");
      } else {
        document.body.textContent = payload.message || "Não foi possível entrar com RaroNexus.";
      }
    </script>
  </body>
</html>`

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })

  if (token) {
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions())
    response.cookies.set(SSO_STATE_COOKIE, "", { ...getSessionCookieOptions(0), maxAge: 0 })
    response.cookies.set(SSO_NEXT_COOKIE, "", { ...getSessionCookieOptions(0), maxAge: 0 })
  }

  if (clearSession) {
    clearAuthCookies(response)
  }

  return response
}
