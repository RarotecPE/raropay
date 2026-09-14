import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { getAppBranding } from '@/lib/branding.server'
import { EnvironmentBanner } from '@/components/layout/EnvironmentBanner'
import './globals.css'

// Fonte Inter via Google Fonts é carregada via CSS no globals.css como fallback
// para permitir build offline. Se quiser voltar ao next/font/google, descomente abaixo:
// import { Inter } from 'next/font/google'
// const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const inter = { variable: '' }

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getAppBranding()

  return {
    title: branding.name,
    description: `Gerenciamento financeiro do ${branding.name}`,
    generator: 'v0.app',
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: branding.faviconUrl || "/favicon.png", type: "image/png" },
      ],
      shortcut: branding.faviconUrl || "/favicon.png",
      apple: [
        { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
        { url: branding.logoUrl },
      ],
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <EnvironmentBanner />
        {children}
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
