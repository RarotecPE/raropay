'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { Spinner } from '@/components/ui/spinner'

function DashboardContentInner({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth()
  const searchParams = useSearchParams()
  const isEmbedded = searchParams.get('embed') === 'true'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Modo embed: renderiza apenas o conteúdo sem sidebar/header
  if (isEmbedded) {
    return (
      <main className="p-0">
        {children}
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    }>
      <DashboardContentInner>{children}</DashboardContentInner>
    </Suspense>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  )
}
