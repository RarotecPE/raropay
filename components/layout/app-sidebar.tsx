'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/components/auth-provider'
import { useBranding } from '@/hooks/use-branding'
import { getInitials } from '@/lib/format'
import { roleLabels } from '@/lib/types'
import {
  ChevronUp,
  FileText,
  Home,
  LogOut,
  PlusCircle,
  History,
  BarChart3,
  UsersRound,
  Settings,
  Users,
  User,
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
  const { user, logout } = useAuth()
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
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden">
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="max-h-8 max-w-8 object-contain"
            <Image 
              src="/images/logo-rarotec.png" 
              alt="Rarotec" 
              width={32} 
              height={32}
              className="object-contain w-auto h-auto"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">{branding.name}</span>
            <span className="font-semibold text-sidebar-foreground">Rarotec</span>
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

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full h-auto py-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                      {user ? getInitials(user.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="truncate text-sm font-medium">
                      {user?.name || 'Carregando...'}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {user ? roleLabels[user.role] : ''}
                    </span>
                  </div>
                  <ChevronUp className="w-4 h-4 opacity-50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/profile">
                    <User className="w-4 h-4 mr-2" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair do sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
