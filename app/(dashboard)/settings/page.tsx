"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { 
  Settings, 
  Users, 
  DollarSign,
  Edit,
  Trash2,
  UserPlus,
  Save,
  Shield,
  AlertTriangle,
  Database,
  AlertCircle,
  HardDrive,
  Cloud,
  FileText,
  Image,
  RefreshCw,
  Wallet
} from "lucide-react"

import { formatCurrency, getCategoryLabel, getRoleLabel } from "@/lib/format"

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface CategoryLimit {
  id: number
  category: string
  sub_category: string | null
  category_name: string
  daily_limit: number
  min_km_per_liter: number | null
}

interface StorageStats {
  database: {
    sizeBytes: number
    sizeGB: string
    estimatedCost: string
    pricePerGB: number
    tables: {
      users: number
      expenses: number
      batches: number
      history: number
      vehicles: number
      limits: number
    }
  }
  blob: {
    sizeBytes: number
    sizeGB: string
    estimatedCost: string
    pricePerGB: number
    totalFiles: number
    filesByType: Record<string, { count: number; size: number }>
  }
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [limits, setLimits] = useState<CategoryLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Estados para modais
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [editLimitOpen, setEditLimitOpen] = useState(false)
  const [newUserOpen, setNewUserOpen] = useState(false)
  
  // Dados do formulário
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedLimit, setSelectedLimit] = useState<CategoryLimit | null>(null)
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    role: "employee",
  })
  const [editedRole, setEditedRole] = useState("")
  const [editedLimit, setEditedLimit] = useState("")
  const [editedKmPerLiter, setEditedKmPerLiter] = useState("")
  
  // Estado para limpeza de dados
  const [clearDataOpen, setClearDataOpen] = useState(false)
  const [clearingData, setClearingData] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  
  // Estado para estatísticas de storage
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null)
  const [loadingStorage, setLoadingStorage] = useState(false)

  // Estado para configuração de adiantamento (PIX)
  const [pixEnabled, setPixEnabled] = useState(false)
  const [savingPix, setSavingPix] = useState(false)

  const isAdmin = user?.role === "director" || user?.role === "admin" || user?.role === "finance"

  async function fetchAdvanceSettings() {
    try {
      const res = await fetch("/api/settings/advance")
      if (res.ok) {
        const data = await res.json()
        setPixEnabled(!!data.pixEnabled)
      }
    } catch (error) {
      console.error("Erro ao carregar configuração de adiantamento:", error)
    }
  }

  async function handleTogglePix(enabled: boolean) {
    setSavingPix(true)
    setPixEnabled(enabled) // otimista
    try {
      const res = await fetch("/api/settings/advance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixEnabled: enabled }),
      })
      if (!res.ok) {
        setPixEnabled(!enabled) // reverte
        const data = await res.json()
        toast.error(data.error || "Erro ao salvar configuração")
        return
      }
      toast.success(enabled ? "PIX habilitado para adiantamentos" : "PIX desabilitado para adiantamentos")
    } catch {
      setPixEnabled(!enabled)
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setSavingPix(false)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  useEffect(() => {
    // Carregar dados quando o componente montar
    fetchData()
    fetchStorageStats()
    fetchAdvanceSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [usersRes, limitsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/expenses/limits"),
      ])

      if (usersRes.ok) {
        const data = await usersRes.json()
        // A API retorna array diretamente
        console.log("[v0] Usuários carregados:", data)
        setUsers(Array.isArray(data) ? data : (data.users || []))
      }

      if (limitsRes.ok) {
        const data = await limitsRes.json()
        console.log("[v0] Limites carregados:", data)
        setLimits(Array.isArray(data) ? data : (data.limits || []))
      }
    } catch (error) {
      console.error("[v0] Erro ao carregar dados:", error)
      toast.error("Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateUser() {
    if (!newUserData.name || !newUserData.email) {
      toast.error("Preencha todos os campos")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserData),
      })

      if (res.ok) {
        toast.success("Usuário criado com sucesso")
        setNewUserOpen(false)
        setNewUserData({ name: "", email: "", role: "employee" })
        fetchData()
      } else {
        try {
          const data = await res.json()
          toast.error(data.error || "Erro ao criar usuário")
        } catch {
          toast.error(`Erro ao criar usuário (${res.status})`)
        }
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error)
      toast.error("Erro ao criar usuário")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateUserRole() {
    if (!selectedUser || !editedRole) return

    setSaving(true)
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editedRole }),
      })

      if (res.ok) {
        toast.success("Permissão atualizada")
        setEditUserOpen(false)
        setSelectedUser(null)
        fetchData()
      } else {
        try {
          const data = await res.json()
          toast.error(data.error || "Erro ao atualizar permissão")
        } catch {
          toast.error(`Erro ao atualizar permissão (${res.status})`)
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar permissão:", error)
      toast.error("Erro ao atualizar permissão")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateLimit() {
    if (!selectedLimit || !editedLimit) return

    setSaving(true)
    try {
      const res = await fetch(`/api/expenses/limits/${selectedLimit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({ 
      daily_limit: parseFloat(editedLimit) || 0,
      min_km_per_liter: editedKmPerLiter ? parseFloat(editedKmPerLiter) : null
    }),
  })

      if (res.ok) {
        toast.success("Limite atualizado")
        setEditLimitOpen(false)
        setSelectedLimit(null)
        fetchData()
      } else {
        toast.error("Erro ao atualizar limite")
      }
    } catch (error) {
      toast.error("Erro ao atualizar limite")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Usuário excluído")
        fetchData()
      } else {
        toast.error("Erro ao excluir usuário")
      }
    } catch (error) {
      toast.error("Erro ao excluir usuário")
    }
  }

  function openEditUser(user: User) {
    setSelectedUser(user)
    setEditedRole(user.role)
    setEditUserOpen(true)
  }

  function openEditLimit(limit: CategoryLimit) {
    setSelectedLimit(limit)
    setEditedLimit(String(limit.daily_limit))
    setEditedKmPerLiter(limit.min_km_per_liter ? String(limit.min_km_per_liter) : "")
    setEditLimitOpen(true)
  }

  async function fetchStorageStats() {
    if (user?.role !== 'admin' && user?.role !== 'director') return
    
    setLoadingStorage(true)
    try {
      const res = await fetch('/api/admin/storage')
      if (res.ok) {
        const data = await res.json()
        setStorageStats(data)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas de storage:', error)
    } finally {
      setLoadingStorage(false)
    }
  }

  async function handleClearExpenseData() {
    if (confirmText !== "CONFIRMAR") {
      toast.error("Digite CONFIRMAR para prosseguir")
      return
    }

    setClearingData(true)
    try {
      const res = await fetch("/api/admin/clear-expenses", {
        method: "DELETE",
      })

      if (res.ok) {
        const data = await res.json()
        toast.success(`Dados limpos: ${data.deleted.expenses} despesas, ${data.deleted.batches} remessas, ${data.deleted.history} registros de histórico`)
        setClearDataOpen(false)
        setConfirmText("")
      } else {
        const data = await res.json()
        toast.error(data.error || "Erro ao limpar dados")
      }
    } catch (error) {
      console.error("Erro ao limpar dados:", error)
      toast.error("Erro ao limpar dados")
    } finally {
      setClearingData(false)
    }
  }

  // Comentado temporariamente para teste - remover após testes
  // if (!isAdmin) {
  //   return (
  //     <div className="flex h-[50vh] items-center justify-center p-4">
  //       <Card className="max-w-md text-center">
  //         <CardHeader>
  //           <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
  //           <CardTitle>Acesso Restrito</CardTitle>
  //           <CardDescription>
  //             Apenas a diretoria financeira pode acessar as configurações do sistema.
  //           </CardDescription>
  //         </CardHeader>
  //       </Card>
  //     </div>
  //   )
  // }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie usuários e limites do sistema
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="users" className="flex flex-1 items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="limits" className="flex flex-1 items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Referências
          </TabsTrigger>
          {user?.role === "admin" && (
            <TabsTrigger value="advances" className="flex flex-1 items-center gap-2">
              <Wallet className="h-4 w-4" />
              Adiantamentos
            </TabsTrigger>
          )}
          {(user?.role === "admin" || user?.role === "director") && (
            <TabsTrigger value="maintenance" className="flex flex-1 items-center gap-2">
              <Database className="h-4 w-4" />
              Manutenção
            </TabsTrigger>
          )}
        </TabsList>

        {/* Aba de Usuários */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Gerenciamento de Usuários</CardTitle>
                <CardDescription>
                  Adicione novos usuários e gerencie suas permissões
                </CardDescription>
              </div>
              <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
                {false && <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>}
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do novo usuário
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nome Completo</FieldLabel>
                      <Input
                        value={newUserData.name}
                        onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                        placeholder="Nome do funcionário"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>E-mail</FieldLabel>
                      <Input
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        placeholder="email@rarotec.com.br"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Nível de Acesso</FieldLabel>
                      <Select 
                        value={newUserData.role} 
                        onValueChange={(value) => setNewUserData({ ...newUserData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Funcionário</SelectItem>
                          <SelectItem value="manager">Gestor</SelectItem>
                          <SelectItem value="director">Diretoria Financeira</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewUserOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateUser} disabled={saving}>
                      {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
                      Criar Usuário
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nível de Acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum usuário cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "director" || u.role === "admin" ? "default" : u.role === "manager" || u.role === "finance" ? "secondary" : "outline"}>
                            <Shield className="mr-1 h-3 w-3" />
                            {getRoleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditUser(u)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {String(u.id) !== String(user?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(String(u.id))}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Referências */}
        <TabsContent value="limits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referências por Categoria</CardTitle>
              <CardDescription>
                Valores de referência para cada categoria de despesa. Despesas acima da referência serão sinalizadas, mas não bloqueadas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nenhuma referência cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    limits.map((limit) => (
                      <TableRow key={limit.id}>
                        <TableCell className="font-medium">
                          {limit.category_name}
                        </TableCell>
                        <TableCell>
                          {limit.category === 'fuel' ? (
                            <span className="font-semibold text-primary">
                              Mínimo {limit.min_km_per_liter || 0} km/l
                            </span>
                          ) : (
                            <span className="font-semibold text-primary">
                              {formatCurrency(limit.daily_limit)}/pessoa
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditLimit(limit)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Adiantamentos (apenas admin) */}
        {user?.role === "admin" && (
          <TabsContent value="advances" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Configurações de Adiantamento
                </CardTitle>
                <CardDescription>
                  Controle as formas de recebimento disponíveis nas solicitações de adiantamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="font-medium">Habilitar recebimento via PIX</p>
                    <p className="text-sm text-muted-foreground">
                      Quando desativado, o PIX aparece bloqueado para os funcionários e apenas
                      Boleto e Conta-Corrente ficam disponíveis. Somente o administrador pode
                      alterar esta configuração.
                    </p>
                  </div>
                  <Switch
                    checked={pixEnabled}
                    onCheckedChange={handleTogglePix}
                    disabled={savingPix}
                    aria-label="Habilitar PIX para adiantamentos"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Aba de Manutenção */}
        {(user?.role === "admin" || user?.role === "director") && (
          <TabsContent value="maintenance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Manutenção do Sistema
                </CardTitle>
                <CardDescription>
                  Ferramentas de manutenção e limpeza de dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Indicador de Storage */}
                <div className="border rounded-lg p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-slate-600" />
                      <h3 className="font-semibold">Uso de Armazenamento</h3>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchStorageStats}
                      disabled={loadingStorage}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingStorage ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                  
                  {storageStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Banco de Dados (Neon) */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Banco de Dados (Neon)</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {formatBytes(storageStats.database.sizeBytes)} de <span className="text-xl">∞</span>
                            </span>
                            <span className="font-medium text-blue-600">
                              ~${storageStats.database.estimatedCost}/mês
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ${storageStats.database.pricePerGB}/GB/mês (Plano Launch)
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                          <div className="bg-muted/50 p-2 rounded border border-border">
                            <div className="font-medium text-foreground">{storageStats.database.tables.expenses}</div>
                            <div>Despesas</div>
                          </div>
                          <div className="bg-muted/50 p-2 rounded border border-border">
                            <div className="font-medium text-foreground">{storageStats.database.tables.batches}</div>
                            <div>Remessas</div>
                          </div>
                          <div className="bg-muted/50 p-2 rounded border border-border">
                            <div className="font-medium text-foreground">{storageStats.database.tables.users}</div>
                            <div>Usuários</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Arquivos (Cloudflare R2) */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Cloud className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">Arquivos (Cloudflare R2)</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {formatBytes(storageStats.blob.sizeBytes)} de <span className="text-xl">∞</span>
                            </span>
                            <span className="font-medium text-purple-600">
                              ~${storageStats.blob.estimatedCost}/mês
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ${storageStats.blob.pricePerGB}/GB/mês (Plano Pro)
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          <div className="bg-muted/50 p-2 rounded border border-border flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span className="font-medium text-foreground">{storageStats.blob.totalFiles}</span>
                            <span>arquivos</span>
                          </div>
                          {Object.entries(storageStats.blob.filesByType).map(([type, data]) => (
                            <div key={type} className="bg-muted/50 p-2 rounded border border-border flex items-center gap-1">
                              {type === 'pdf' ? <FileText className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                              <span className="font-medium text-foreground">{data.count}</span>
                              <span>.{type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {loadingStorage ? (
                        <div className="flex items-center justify-center gap-2">
                          <Spinner className="h-4 w-4" />
                          <span>Carregando estatísticas...</span>
                        </div>
                      ) : (
                        <span>Clique em Atualizar para carregar as estatísticas</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Limpar dados de despesas */}
                <div className="border rounded-lg p-4 bg-red-50/50">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900">Limpar Dados de Despesas</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Remove todas as despesas, remessas e histórico do sistema. 
                        <strong> Usuários e veículos NÃO serão afetados.</strong>
                      </p>
                      <div className="mt-4">
                        <Dialog open={clearDataOpen} onOpenChange={setClearDataOpen}>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Limpar Dados de Despesas
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-5 w-5" />
                                Confirmar Limpeza de Dados
                              </DialogTitle>
                              <DialogDescription>
                                Esta ação é irreversível e irá excluir permanentemente:
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                <li>Todas as despesas registradas</li>
                                <li>Todas as remessas de despesas</li>
                                <li>Todo o histórico de despesas</li>
                              </ul>
                              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-sm text-green-800 font-medium">
                                  Os seguintes dados serão mantidos:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-sm text-green-700 mt-1">
                                  <li>Todos os usuários</li>
                                  <li>Todos os veículos</li>
                                  <li>Limites de categoria</li>
                                </ul>
                              </div>
                              <div className="mt-4">
                                <label className="text-sm font-medium">
                                  Digite <span className="font-bold text-red-600">CONFIRMAR</span> para prosseguir:
                                </label>
                                <Input
                                  className="mt-2"
                                  value={confirmText}
                                  onChange={(e) => setConfirmText(e.target.value)}
                                  placeholder="CONFIRMAR"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => {
                                setClearDataOpen(false)
                                setConfirmText("")
                              }}>
                                Cancelar
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={handleClearExpenseData}
                                disabled={clearingData || confirmText !== "CONFIRMAR"}
                              >
                                {clearingData ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                Limpar Dados
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog de editar usuário */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Permissão</DialogTitle>
            <DialogDescription>
              Altere o nível de acesso de {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel>Nível de Acesso</FieldLabel>
            <Select value={editedRole} onValueChange={setEditedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Funcionário</SelectItem>
                <SelectItem value="manager">Gestor</SelectItem>
                <SelectItem value="director">Diretoria Financeira</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUserRole} disabled={saving}>
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

{/* Dialog de editar referência */}
      <Dialog open={editLimitOpen} onOpenChange={setEditLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Referência</DialogTitle>
            <DialogDescription>
              Altere a referência para {selectedLimit?.category_name || ""}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {selectedLimit?.category === 'fuel' ? (
              <Field>
                <FieldLabel>Km/L Mínimo de Referência</FieldLabel>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editedKmPerLiter}
                  onChange={(e) => setEditedKmPerLiter(e.target.value)}
                  placeholder="10"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Abaixo deste valor, a despesa será sinalizada para análise
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel>Referência por Pessoa (R$)</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editedLimit}
                  onChange={(e) => setEditedLimit(e.target.value)}
                  placeholder="0,00"
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLimitOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLimit} disabled={saving}>
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
