import "server-only"

import { DEFAULT_BRANDING, type AppBranding } from "./branding"

interface RaroNexusBrandingPayload {
  success?: boolean
  data?: {
    nome?: string | null
    logo_url?: string | null
  }
}

function absoluteInternalUrl(path: string) {
  const baseUrl = process.env.RAROPAY_BASE_URL?.replace(/\/+$/, "") || "http://localhost:3003"
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

function resolveAssetUrl(value: string | null | undefined) {
  const url = value?.trim()
  if (!url) return null

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  if (url.startsWith("/")) {
    return absoluteInternalUrl(url)
  }

  return null
}

export async function getAppBranding(): Promise<AppBranding> {
  const baseUrl = process.env.RARONEXUS_BASE_URL?.replace(/\/+$/, "")
  const clientId = process.env.RARONEXUS_CLIENT_ID?.trim()

  if (!baseUrl || !clientId) {
    return DEFAULT_BRANDING
  }

  try {
    const url = new URL("/api/v1/applications/public", baseUrl)
    url.searchParams.set("client_id", clientId)

    const response = await fetch(url, {
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      return DEFAULT_BRANDING
    }

    const payload = await response.json() as RaroNexusBrandingPayload
    if (!payload.success || !payload.data) {
      return DEFAULT_BRANDING
    }

    const name = payload.data.nome?.trim() || DEFAULT_BRANDING.name
    const logoUrl = resolveAssetUrl(payload.data.logo_url) || DEFAULT_BRANDING.logoUrl

    return {
      name,
      logoUrl,
      faviconUrl: logoUrl,
    }
  } catch (error) {
    console.error("Erro ao carregar branding RaroNexus:", error)
    return DEFAULT_BRANDING
  }
}
