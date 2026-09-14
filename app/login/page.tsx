"use client"
'use client'

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { Lock, Mail } from 'lucide-react'

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/api/")) {
    return "/dashboard"
  }

  return next
}

function startUrl(nextPath: string) {
  return `/api/auth/raronexus/start?next=${encodeURIComponent(nextPath)}`
}

function LoginContent() {
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branding = useBranding()
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams])
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const data = await response.json()
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

        if (!active) return
      const data = await response.json()

        if (data.authenticated) {
          router.replace(nextPath)
          return
        }
      if (!response.ok) {
        setError(data.error || 'Erro ao fazer login')
        return
      }

        window.location.replace(startUrl(nextPath))
      } catch {
        if (!active) return
        setChecking(false)
        setError("Nao foi possivel verificar a sessao. Tente novamente.")
      toast.success('Login realizado com sucesso!')
      
      // Redirecionar para dashboard específico baseado no role
      let redirectUrl = '/dashboard'
      if (data.user?.role === 'financial') {
        redirectUrl = '/financial/dashboard'
      } else if (data.user?.role === 'admin' || data.user?.role === 'director') {
        redirectUrl = '/admin/dashboard'
      }
      router.push(redirectUrl)
      router.refresh()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [nextPath, router])

  function handleLogin() {
    setError("")
    setChecking(true)
    window.location.assign(startUrl(nextPath))
  }

  return (
    <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img
            src={branding.logoUrl}
            alt={branding.name}
            className="mx-auto h-16 w-16 rounded-2xl bg-white object-contain"
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-normal">{branding.name}</h1>
            <p className="text-sm text-slate-300">
              Verificando sua sessao RaroNexus.
            </p>
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <Image
              src="/images/logo-rarotec.png"
              alt="Rarotec"
              width={100}
              height={100}
              className="w-20 h-20 object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Sistema Financeiro</h1>
          <p className="text-muted-foreground text-sm">Gestão de Despesas Corporativas</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
          <button
            type="button"
            onClick={handleLogin}
            disabled={checking}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <KeyRound className="h-5 w-5" />
            {checking ? "Conectando ao RaroNexus..." : "Entrar com RaroNexus"}
          </button>
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Entrar</CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                </Field>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          )}
        </div>
                <Field>
                  <FieldLabel htmlFor="password">Senha</FieldLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      disabled={loading}
                    />
                  </div>
                </Field>

                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner className="mr-2" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Sistema exclusivo para funcionários Rarotec
        </p>
      </div>
    </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <p className="text-sm text-slate-300">Carregando...</p>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
