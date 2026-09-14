'use client'

import { usePathname } from 'next/navigation'
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
import { DashboardHeaderActions } from '@/components/layout/dashboard-header-actions'

const pathTitles: Record<string, string> = {
  '/dashboard': 'Início',
  '/expenses/new': 'Nova Despesa',
  '/expenses/drafts': 'Rascunhos',
  '/expenses/submitted': 'Enviar Prestação',
  '/expenses/batches': 'Minhas Remessas',
  '/expenses/corrections': 'Correção',
  '/expenses/my-approved': 'Aprovadas',
  '/expenses/rejected': 'Rejeitadas',
  '/expenses/history': 'Histórico',
  '/my-invoices': 'Minhas Faturas',
  '/advances': 'Adiantamentos',
  '/advances/manage': 'Gestão de Adiantamentos',
  '/admin/dashboard': 'Painel Administrativo',
  '/financial/dashboard': 'Visão Geral Financeira',
  '/financial/meal-voucher': 'Vale-Refeição',
  '/financial/transport-voucher': 'Vale-Transporte',
  '/card-invoices': 'Faturas Cartão',
  '/admin/vehicles': 'Veículos',
  '/analysis': 'Análise',
  '/reports': 'Relatórios',
  '/reports/by-person': 'Gasto por Pessoa',
  '/profile': 'Meu Perfil',
  '/settings': 'Configurações',
  '/settings/users': 'Usuários',
}

export function AppHeader() {
  const pathname = usePathname()
  const title = pathTitles[pathname] || 'Página'

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-4 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <SidebarTrigger className="-ml-1 shrink-0 sm:-ml-2" />
        <Separator orientation="vertical" className="h-6 shrink-0" />
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="flex-nowrap whitespace-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Sistema</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <DashboardHeaderActions />
    </header>
  )
}
