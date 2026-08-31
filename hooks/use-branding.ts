"use client"

import { useEffect, useState } from "react"
import { DEFAULT_BRANDING, type AppBranding } from "@/lib/branding"

export function useBranding() {
  const [branding, setBranding] = useState<AppBranding>(DEFAULT_BRANDING)

  useEffect(() => {
    let active = true

    async function loadBranding() {
      try {
        const response = await fetch("/api/branding", { cache: "no-store" })
        const data = await response.json()

        if (active && data?.branding) {
          setBranding(data.branding)
        }
      } catch {
        if (active) {
          setBranding(DEFAULT_BRANDING)
        }
      }
    }

    loadBranding()

    return () => {
      active = false
    }
  }, [])

  return branding
}
