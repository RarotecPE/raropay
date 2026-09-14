"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Building2, Landmark, Mail, Phone, User, Lock, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  employee: "Funcionário",
  director: "Diretor",
  financial: "Financeiro",
  coordinator: "Coordenador",
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [pixKey, setPixKey] = useState("")
  const [bankAgency, setBankAgency] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [bankingLoading, setBankingLoading] = useState(true)
  const [bankingSaving, setBankingSaving] = useState(false)

  // Troca de senha (funcionalidade da feature branch)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    async function loadBanking() {
      try {
        const res = await fetch("/api/profile/banking")
        if (res.ok) {
          const data = await res.json()
          setPixKey(data.banking?.pix_key || "")
          setBankAgency(data.banking?.bank_agency || "")
          setBankAccount(data.banking?.bank_account || "")
        }
      } finally {
        setBankingLoading(false)
      }
    }

    loadBanking()
  }, [])

  async function handleSaveBanking(e: React.FormEvent) {
    e.preventDefault()
    setBankingSaving(true)

    try {
      const res = await fetch("/api/profile/banking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pix_key: pixKey,
          bank_agency: bankAgency,
          bank_account: bankAccount,
        }),
      })

      if (!res.ok) {
        toast.error("Erro ao salvar dados bancários")
        return
      }

      toast.success("Dados bancários salvos com sucesso!")
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setBankingSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError("")

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem")
      return
    }
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres")
      return
    }

    setPasswordLoading(true)
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPasswordError(data.error || "Erro ao alterar senha")
        return
      }
      toast.success("Senha alterada com sucesso!")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setPasswordError("Erro de conexão. Tente novamente.")
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">Visualize seus dados do RaroNexus e informações complementares do Raropay</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>Seus dados de acesso são gerenciados pelo RaroNexus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileItem icon={<User className="w-4 h-4" />} label="Nome" value={user?.name} />
            <ProfileItem icon={<Mail className="w-4 h-4" />} label="E-mail" value={user?.email} />
            <ProfileItem icon={<Phone className="w-4 h-4" />} label="Telefone" value={user?.phone} />
            <ProfileItem icon={<Building2 className="w-4 h-4" />} label="Função" value={roleLabels[user?.role || ""] || user?.role} />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Caso sua conta possua senha local, você pode alterá-la aqui. Contas autenticadas exclusivamente via RaroNexus devem alterar a senha no portal corporativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{passwordError}</p>}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">Senha atual</FieldLabel>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={passwordLoading}
                    placeholder="Digite sua senha atual"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={passwordLoading}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirmar nova senha</FieldLabel>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={passwordLoading}
                    placeholder="Repita a nova senha"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? (
                <>
                  <Spinner className="mr-2" /> Alterando...
                </>
              ) : (
                "Alterar Senha"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Dados Bancários
          </CardTitle>
          <CardDescription>
            Informe seu PIX e/ou conta do Banco do Brasil. Esses dados serão reutilizados nas suas solicitações de adiantamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bankingLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Spinner /> Carregando...
            </div>
          ) : (
            <form onSubmit={handleSaveBanking} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pix-key">Chave PIX</FieldLabel>
                  <Input
                    id="pix-key"
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    disabled={bankingSaving}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="bank-agency">Agência (Banco do Brasil)</FieldLabel>
                    <Input
                      id="bank-agency"
                      placeholder="Ex: 1234-5"
                      value={bankAgency}
                      onChange={(e) => setBankAgency(e.target.value)}
                      disabled={bankingSaving}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bank-account">Conta-Corrente (Banco do Brasil)</FieldLabel>
                    <Input
                      id="bank-account"
                      placeholder="Ex: 12345-6"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      disabled={bankingSaving}
                    />
                  </Field>
                </div>
              </FieldGroup>
              <Button type="submit" disabled={bankingSaving}>
                {bankingSaving ? (
                  <>
                    <Spinner className="mr-2" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Dados Bancários"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileItem({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  )
}
