'use client'
// Profile page - alteração de senha
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth-provider'
import { User, Lock, Mail, Phone, Building2, Eye, EyeOff, Landmark } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Dados bancários (para adiantamentos)
  const [pixKey, setPixKey] = useState('')
  const [bankAgency, setBankAgency] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankingLoading, setBankingLoading] = useState(true)
  const [bankingSaving, setBankingSaving] = useState(false)

  useEffect(() => {
    async function loadBanking() {
      try {
        const res = await fetch('/api/profile/banking')
        if (res.ok) {
          const data = await res.json()
          setPixKey(data.banking?.pix_key || '')
          setBankAgency(data.banking?.bank_agency || '')
          setBankAccount(data.banking?.bank_account || '')
        }
      } catch {
        // silencioso: apenas não pré-preenche
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
      const res = await fetch('/api/profile/banking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pix_key: pixKey,
          bank_agency: bankAgency,
          bank_account: bankAccount,
        }),
      })
      if (!res.ok) {
        toast.error('Erro ao salvar dados bancários')
        return
      }
      toast.success('Dados bancários salvos com sucesso!')
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setBankingSaving(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gestor',
    employee: 'Funcionário',
    director: 'Diretor',
    financial: 'Financeiro',
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erro ao alterar senha')
        return
      }

      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">Visualize seus dados e altere sua senha</p>
      </div>

      {/* Informações do Usuário */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Seus dados cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome
              </p>
              <p className="font-medium">{user?.name || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                E-mail
              </p>
              <p className="font-medium">{user?.email || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefone
              </p>
              <p className="font-medium">{user?.phone || '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Função
              </p>
              <p className="font-medium">{roleLabels[user?.role || ''] || user?.role || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Bancários */}
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
                  'Salvar Dados Bancários'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Por segurança, sua senha deve ter pelo menos 6 caracteres
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">Senha Atual</FieldLabel>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="new-password">Nova Senha</FieldLabel>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Digite a nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">Confirmar Nova Senha</FieldLabel>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {error && <FieldError>{error}</FieldError>}
            </FieldGroup>

            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="mr-2" />
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
