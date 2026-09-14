'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { 
  Users, 
  Plus,
  Search, 
  Edit, 
  Trash2, 
  Shield, 
  User,
  Mail,
  Phone,
  Building,
  UserCog,
  CheckCircle,
  XCircle,
  Utensils,
  Bus
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/format"

interface UserData {
  id: number
  name: string
  email: string
  phone: string | null
  department: string | null
  role: string
  is_active: boolean
  meal_voucher_enabled: boolean
  meal_voucher_limit: number | null
  transport_voucher_enabled: boolean
  transport_voucher_limit: number | null
  created_at: string
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  financial: "Financeiro",
  employee: "Funcionário"
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  manager: "bg-purple-100 text-purple-800 border-purple-200",
  financial: "bg-blue-100 text-blue-800 border-blue-200",
  employee: "bg-gray-100 text-gray-800 border-gray-200"
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [processing, setProcessing] = useState(false)

  // Form states
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formDepartment, setFormDepartment] = useState("")
  const [formRole, setFormRole] = useState("employee")
  const [formMealVoucherEnabled, setFormMealVoucherEnabled] = useState(false)
  const [formMealVoucherLimit, setFormMealVoucherLimit] = useState("250")
  const [formTransportVoucherEnabled, setFormTransportVoucherEnabled] = useState(false)
  const [formTransportVoucherLimit, setFormTransportVoucherLimit] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error)
      toast.error("Erro ao carregar usuários")
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormName("")
    setFormEmail("")
    setFormPhone("")
    setFormDepartment("")
    setFormRole("employee")
    setFormMealVoucherEnabled(false)
    setFormMealVoucherLimit("250")
    setFormTransportVoucherEnabled(false)
    setFormTransportVoucherLimit("")
    setEditingUser(null)
  }

  function openEditDialog(user: UserData) {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPhone(user.phone || "")
    setFormDepartment(user.department || "")
    setFormRole(user.role)
    setFormMealVoucherEnabled(user.meal_voucher_enabled || false)
    setFormMealVoucherLimit(user.meal_voucher_limit ? String(user.meal_voucher_limit) : "250")
    setFormTransportVoucherEnabled(user.transport_voucher_enabled || false)
    setFormTransportVoucherLimit(user.transport_voucher_limit ? String(user.transport_voucher_limit) : "")
    setIsDialogOpen(true)
  }

  function openNewDialog() {
    toast.error("Cadastre novos usuários no RaroNexus")
  }

  async function handleSubmit() {
    if (!formName || !formEmail) {
      toast.error("Nome e email são obrigatórios")
      return
    }

    if (!editingUser) {
      toast.error("Senha é obrigatória para novos usuários")
      return
    }

    try {
      setProcessing(true)
      
      const payload = {
        name: formName,
        email: formEmail,
        phone: formPhone || null,
        department: formDepartment || null,
        role: formRole,
        meal_voucher_enabled: formMealVoucherEnabled,
        meal_voucher_limit: formMealVoucherEnabled ? parseFloat(formMealVoucherLimit) || 250 : null,
        transport_voucher_enabled: formTransportVoucherEnabled,
        transport_voucher_limit: formTransportVoucherEnabled
          ? (formTransportVoucherLimit === "" ? null : parseFloat(formTransportVoucherLimit))
          : null,
      }

      const res = await fetch(
        editingUser ? `/api/users/${editingUser.id}` : "/api/users",
        {
          method: editingUser ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      )

      if (res.ok) {
        toast.success(editingUser ? "Usuário atualizado!" : "Usuário criado!")
        setIsDialogOpen(false)
        resetForm()
        fetchUsers()
      } else {
        try {
          const errorData = await res.json()
          toast.error(errorData.error || "Erro ao salvar usuário")
        } catch {
          toast.error(`Erro ao salvar usuário (${res.status})`)
        }
      }
    } catch (error) {
      console.error("Erro ao salvar usuário:", error)
      toast.error("Erro interno do servidor")
    } finally {
      setProcessing(false)
    }
  }

  async function toggleUserStatus(user: UserData) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active })
      })

      if (res.ok) {
        toast.success(user.is_active ? "Usuário desativado" : "Usuário ativado")
        fetchUsers()
      }
    } catch (error) {
      console.error("Erro ao alterar status:", error)
      toast.error("Erro ao alterar status")
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department?.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    
    return matchesSearch && matchesRole
  })

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.role === "admin").length,
    financial: users.filter(u => u.role === "financial").length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {false && <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>}
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? "Atualize as informações do usuário"
                  : "Preencha as informações para criar um novo usuário"
                }
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  placeholder="Nome do usuário"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    placeholder="Departamento"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Funcionário</SelectItem>
                    <SelectItem value="financial">Financeiro</SelectItem>
                    <SelectItem value="manager">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Vale-Refeição */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meal_voucher"
                    checked={formMealVoucherEnabled}
                    onCheckedChange={(checked) => setFormMealVoucherEnabled(checked as boolean)}
                  />
                  <Label htmlFor="meal_voucher" className="flex items-center gap-2 cursor-pointer">
                    <Utensils className="h-4 w-4 text-orange-500" />
                    Habilitar Vale-Refeição
                  </Label>
                </div>
                {formMealVoucherEnabled && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="meal_limit">Limite Mensal (R$)</Label>
                    <Input
                      id="meal_limit"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="250.00"
                      value={formMealVoucherLimit}
                      onChange={(e) => setFormMealVoucherLimit(e.target.value)}
                      className="w-40"
                    />
                  </div>
                )}
              </div>

              {/* Vale-Transporte */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transport_voucher"
                    checked={formTransportVoucherEnabled}
                    onCheckedChange={(checked) => setFormTransportVoucherEnabled(checked as boolean)}
                  />
                  <Label htmlFor="transport_voucher" className="flex items-center gap-2 cursor-pointer">
                    <Bus className="h-4 w-4 text-blue-500" />
                    Habilitar Vale-Transporte
                  </Label>
                </div>
                {formTransportVoucherEnabled ? (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="transport_limit">Limite Mensal (R$) - deixe vazio para ilimitado</Label>
                    <Input
                      id="transport_limit"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 300 (vazio = ilimitado)"
                      value={formTransportVoucherLimit}
                      onChange={(e) => setFormTransportVoucherLimit(e.target.value)}
                      className="w-60"
                    />
                    <p className="text-xs text-muted-foreground">
                      Se definido, o sistema controla utilização e bloqueia ao exceder. Vazio = sem limite.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">
                    Permite lançar despesas de Vale-Transporte. Defina um limite opcional para controle orçamentário.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={processing}>
                {processing ? "Salvando..." : (editingUser ? "Atualizar" : "Criar")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Financeiro</CardTitle>
            <Building className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.financial}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="financial">Financeiro</SelectItem>
                <SelectItem value="employee">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Vale-Refeição</TableHead>
                    <TableHead>Vale-Transporte</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.department || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleBadgeColors[user.role]}>
                          {roleLabels[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.meal_voucher_enabled ? (
                          <div className="flex items-center gap-1.5">
                            <Utensils className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">{formatCurrency(user.meal_voucher_limit || 250)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.transport_voucher_enabled ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Bus className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">
                                {user.transport_voucher_limit != null
                                  ? formatCurrency(user.transport_voucher_limit)
                                  : "Ilimitado"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleUserStatus(user)}
                          >
                            {user.is_active ? (
                              <XCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
