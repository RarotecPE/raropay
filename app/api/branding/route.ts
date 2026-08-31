import { NextResponse } from "next/server"
import { getAppBranding } from "@/lib/branding.server"

export async function GET() {
  const branding = await getAppBranding()
  return NextResponse.json({ branding })
}
