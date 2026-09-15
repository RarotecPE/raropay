'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/components/auth-provider'
import { useBranding } from '@/hooks/use-branding'
import {
  FileText,
  Home,
  PlusCircle,
  History,
  BarChart3,
  UsersRound,
  Settings,
  Users,
  Car,
  Send,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  XCircle,
  CreditCard,
  Wallet,
  UtensilsCrossed,
  Bus,
} from 'lucide-react'

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const branding = useBranding()
  const { setOpenMobile } = useSidebar()

  // Verifica se é usuário financeiro (só tem acesso a gestão)
  const isFinancialUser = user?.role === 'financial'

  // Menu principal do funcionário (não aparece para financeiro)
  const mainMenuItems = [
    {
      title: 'Início',
      url: '/dashboard',
      icon: Home,
      description: 'Visão geral',
    },
    {
      title: 'Nova Despesa',
      url: '/expenses/new',
      icon: PlusCircle,
      description: 'Registrar despesa',
    },
    {
      title: 'Rascunhos',
      url: '/expenses/drafts',
      icon: FileText,
      description: 'Despesas não enviadas',
    },
    {
      title: 'Enviar Prestação',
      url: '/expenses/submitted',
      icon: Send,
      description: 'Despesas prontas para envio',
    },
    {
      title: 'Minhas Remessas',
      url: '/expenses/batches',
      icon: FileSearch,
      description: 'Prestações enviadas',
    },
    {
      title: 'Correção',
      url: '/expenses/corrections',
      icon: AlertCircle,
      description: 'Aguardando correção',
    },
    {
      title: 'Aprovadas',
      url: '/expenses/my-approved',
      icon: CheckCircle2,
      description: 'Minhas despesas aprovadas',
    },
    {
      title: 'Rejeitadas',
      url: '/expenses/rejected',
      icon: XCircle,
      description: 'Despesas rejeitadas',
    },
    {
      title: 'Histórico',
      url: '/expenses/history',
      icon: History,
      description: 'Todas as despesas',
    },
    {
      title: 'Minhas Faturas',
      url: '/my-invoices',
      icon: CreditCard,
      description: 'Faturas do cartão',
    },
    {
      title: 'Adiantamentos',
      url: '/advances',
      icon: Wallet,
      description: 'Solicitar adiantamento',
    },
    // Relatórios pessoais: exclusivo do funcionário comum (gestão acessa em "Gestão")
    ...(user?.role === 'employee'
      ? [
          {
            title: 'Relatórios',
            url: '/reports',
            icon: BarChart3,
            description: 'Meus relatórios de despesas',
          },
        ]
      : []),
  ]

  // Menu de gestão (financeiro/diretor/admin)
  const managementMenuItems = [
    {
      title: 'Início',
      url: '/admin/dashboard',
      icon: Home,
      description: 'Painel administrativo',
      roles: ['admin', 'director'],
    },
    {
      title: 'Início',
      url: '/financial/dashboard',
      icon: Home,
      description: 'Visão geral financeira',
      roles: ['financial'],
    },
    {
      title: 'Adiantamentos',
      url: '/advances/manage',
      icon: Wallet,
      description: 'Gestão de adiantamentos',
      roles: ['financial'],
    },
    {
      title: 'Análise',
      url: '/analysis',
      icon: ClipboardCheck,
      description: 'Analisar despesas',
      roles: ['director', 'admin', 'financial'],
    },
    {
      title: 'Aprovadas',
      url: '/expenses/approved',
      icon: CheckCircle2,
      description: 'Despesas aprovadas',
      roles: ['director', 'admin', 'financial'],
    },
    {
      title: 'Rejeitadas',
      url: '/management/rejected',
      icon: XCircle,
      description: 'Despesas rejeitadas',
      roles: ['financial'],
    },
    {
      title: 'Correções',
      url: '/expenses/corrections',
      icon: AlertCircle,
      description: 'Despesas em correção',
      roles: ['financial'],
    },
    {
      title: 'Histórico Geral',
      url: '/expenses/history',
      icon: History,
      description: 'Histórico de despesas',
      roles: ['financial'],
    },
    {
      title: 'Relatórios',
      url: '/reports',
      icon: BarChart3,
      description: 'Relatórios gerenciais',
      roles: ['manager', 'director', 'admin', 'financial'],
    },
    {
      title: 'Gasto por Pessoa',
      url: '/reports/by-person',
      icon: UsersRound,
      description: 'Rateio gerencial por pessoa',
      roles: ['admin', 'financial'],
    },
    {
      title: 'Vale-Refeição',
      url: '/financial/meal-voucher',
      icon: UtensilsCrossed,
      description: 'Acompanhamento do vale-refeição',
      roles: ['manager', 'coordinator', 'director', 'admin', 'financial'],
    },
    {
      title: 'Vale-Transporte',
      url: '/financial/transport-voucher',
      icon: Bus,
      description: 'Acompanhamento do vale-transporte',
      roles: ['manager', 'coordinator', 'director', 'admin', 'financial'],
    },
    {
      title: 'Faturas Cartão',
      url: '/card-invoices',
      icon: CreditCard,
      description: 'Faturas do cartão corporativo',
      roles: ['admin', 'financial'],
    },
    {
      title: 'Veículos',
      url: '/admin/vehicles',
      icon: Car,
      description: 'Gestão de frota',
      roles: ['manager', 'coordinator', 'director', 'admin'],
    },
    {
      title: 'Usuários',
      url: '/settings/users',
      icon: Users,
      description: 'Gerenciar usuários',
      roles: ['manager', 'coordinator', 'director', 'admin'],
    },
    {
      title: 'Configurações',
      url: '/settings',
      icon: Settings,
      description: 'Configurações do sistema',
      roles: ['director', 'admin'],
    },
  ]

  const filteredManagementItems = managementMenuItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )

  function handleNavigation() {
    setOpenMobile(false)
  }

  function isActive(url: string) {
    if (url === '/dashboard') {
      return pathname === url
    }
    return pathname.startsWith(url)
  }

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={handleNavigation}>
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-[34px] w-[34px] object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">{branding.name}</span>
            <span className="text-xs text-sidebar-foreground/60">Gestão de Despesas</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Menu principal - não aparece para usuários financeiros */}
        {!isFinancialUser && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.url)}
                      tooltip={item.description}
                      className="transition-all duration-200"
                    >
                      <Link href={item.url} onClick={handleNavigation}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredManagementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredManagementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.url)}
                      tooltip={item.description}
                      className="transition-all duration-200"
                    >
                      <Link href={item.url} onClick={handleNavigation}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
