'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { usePathname } from 'next/navigation'

const pathTitles: Record<string, string> = {
  '/dashboard': 'Início',
  '/expenses/new': 'Nova Despesa',
  '/expenses/drafts': 'Rascunhos',
  '/expenses/history': 'Histórico',
  '/analysis': 'Análise',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
  '/settings/users': 'Usuários',
}

export function AppHeader() {
  const pathname = usePathname()
  const title = pathTitles[pathname] || 'Página'

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="-ml-2" />
      <Separator orientation="vertical" className="h-6" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Sistema</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  )
}
