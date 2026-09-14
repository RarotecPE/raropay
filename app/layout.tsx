import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { getAppBranding } from '@/lib/branding.server'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getAppBranding()

  return {
    title: branding.name,
    description: `Gerenciamento financeiro do ${branding.name}`,
    generator: 'v0.app',
    icons: {
      icon: branding.faviconUrl,
      shortcut: branding.faviconUrl,
      apple: branding.logoUrl,
    },
  }
export const metadata: Metadata = {
  title: 'Sistema Financeiro Rarotec',
  description: 'Gerenciamento de despesas corporativas da Rarotec',
  generator: 'v0.app',
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
        {children}
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
