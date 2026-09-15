'use client'

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  Building,
  Bus,
  CheckCircle,
  Edit,
  Search,
  Shield,
  User,
  Users,
  Utensils,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/format"

interface UserData {
  id: number
  nexus_user_id?: string | null
  nexus_email?: string | null
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
  director: "Diretoria",
  coordinator: "Coordenador",
  employee: "Funcionário",
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  manager: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  financial: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  director: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  coordinator: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
  employee: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700",
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [processing, setProcessing] = useState(false)

  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formNexusEmail, setFormNexusEmail] = useState("")
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
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(data?.error || "Erro ao carregar usuários")
        return
      }

      setUsers(Array.isArray(data) ? data : [])
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
    setFormNexusEmail("")
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
    setFormNexusEmail(user.nexus_email || "")
    setFormPhone(user.phone || "")
    setFormDepartment(user.department || "")
    setFormRole(user.role)
    setFormMealVoucherEnabled(user.meal_voucher_enabled || false)
    setFormMealVoucherLimit(user.meal_voucher_limit ? String(user.meal_voucher_limit) : "250")
    setFormTransportVoucherEnabled(user.transport_voucher_enabled || false)
    setFormTransportVoucherLimit(user.transport_voucher_limit ? String(user.transport_voucher_limit) : "")
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (!editingUser) return

    try {
      setProcessing(true)

      const payload = {
        nexus_email: formNexusEmail || null,
        phone: formPhone || null,
        department: formDepartment || null,
        meal_voucher_enabled: formMealVoucherEnabled,
        meal_voucher_limit: formMealVoucherEnabled ? parseFloat(formMealVoucherLimit) || 250 : null,
        transport_voucher_enabled: formTransportVoucherEnabled,
        transport_voucher_limit: formTransportVoucherEnabled
          ? (formTransportVoucherLimit === "" ? null : parseFloat(formTransportVoucherLimit))
          : null,
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success("Configurações do usuário atualizadas!")
        setIsDialogOpen(false)
        resetForm()
        fetchUsers()
      } else {
        const errorData = await res.json().catch(() => null)
        toast.error(errorData?.error || `Erro ao salvar usuário (${res.status})`)
      }
    } catch (error) {
      console.error("Erro ao salvar usuário:", error)
      toast.error("Erro interno do servidor")
    } finally {
      setProcessing(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.toLowerCase()
    const matchesSearch =
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.department?.toLowerCase().includes(query) ?? false)

    const matchesRole = roleFilter === "all" || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
    financial: users.filter((u) => u.role === "financial").length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Usuários sincronizados pelo RaroNexus. Edite aqui apenas dados complementares do RaroPay.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar configurações do usuário</DialogTitle>
              <DialogDescription>
                Identidade e função são gerenciadas pelo RaroNexus.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={formName} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formEmail} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nexus_email">E-mail do RaroNexus</Label>
                <Input
                  id="nexus_email"
                  type="email"
                  placeholder="email cadastrado no RaroNexus"
                  value={formNexusEmail}
                  onChange={(e) => setFormNexusEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se o e-mail for igual ao cadastrado no RaroNexus, deixe em branco.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Input id="role" value={roleLabels[formRole] || formRole} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    placeholder="-"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(00) 00000-0000"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>

              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meal_voucher"
                    checked={formMealVoucherEnabled}
                    onCheckedChange={(checked) => setFormMealVoucherEnabled(checked as boolean)}
                  />
                  <Label htmlFor="meal_voucher" className="flex cursor-pointer items-center gap-2">
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

              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transport_voucher"
                    checked={formTransportVoucherEnabled}
                    onCheckedChange={(checked) => setFormTransportVoucherEnabled(checked as boolean)}
                  />
                  <Label htmlFor="transport_voucher" className="flex cursor-pointer items-center gap-2">
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
                  <p className="pl-6 text-xs text-muted-foreground">
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
                {processing ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
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
                <SelectItem value="director">Diretoria</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="financial">Financeiro</SelectItem>
                <SelectItem value="coordinator">Coordenador</SelectItem>
                <SelectItem value="employee">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.department || <span className="text-muted-foreground">-</span>}</TableCell>
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
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.transport_voucher_enabled ? (
                          <div className="flex items-center gap-1.5">
                            <Bus className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">
                              {user.transport_voucher_limit != null
                                ? formatCurrency(user.transport_voucher_limit)
                                : "Ilimitado"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                            Inativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
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
