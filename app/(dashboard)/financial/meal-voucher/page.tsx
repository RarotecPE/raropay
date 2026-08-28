"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/components/auth-provider"
import { formatCurrency } from "@/lib/format"
import { Utensils, ArrowLeft, TrendingUp, Users, Wallet, History } from "lucide-react"
import Link from "next/link"

interface UserVoucherData {
  id: number
  name: string
  department: string | null
  limit: number
  used: number
  available: number
  utilizationRate: number
}

interface MonthData {
  month: number
  year: number
  monthName: string
  totalLimit: number
  totalUsed: number
  totalAvailable: number
  utilizationRate: number
  usersCount: number
}

interface ManagementData {
  currentMonth: MonthData
  history: MonthData[]
  users: UserVoucherData[]
}

export default function MealVoucherManagementPage() {
  const { user } = useAuth()
  const [data, setData] = useState<ManagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>("current")

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  async function fetchData() {
    try {
      setLoading(true)
      const params = selectedMonth !== "current" ? `?month=${selectedMonth}` : ""
      const response = await fetch(`/api/meal-voucher/management${params}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error)
    } finally {
      setLoading(false)
    }
  }

  // Verificar permissão
  if (user && !["admin", "financial", "manager", "director", "coordinator"].includes(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!data || data.users.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/financial/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Utensils className="h-6 w-6 text-orange-500" />
              Gerenciamento de Vale-Refeição
            </h1>
            <p className="text-muted-foreground">Controle mensal por funcionário</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum funcionário com vale-refeição habilitado.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Gerar opções de meses (últimos 6 meses)
  const monthOptions = [
    { value: "current", label: `${data.currentMonth.monthName.charAt(0).toUpperCase() + data.currentMonth.monthName.slice(1)} ${data.currentMonth.year} (Atual)` },
    ...data.history.map((h) => ({
      value: `${h.year}-${String(h.month).padStart(2, "0")}`,
      label: `${h.monthName.charAt(0).toUpperCase() + h.monthName.slice(1)} ${h.year}`
    }))
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/financial/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Utensils className="h-6 w-6 text-orange-500" />
              Gerenciamento de Vale-Refeição
            </h1>
            <p className="text-muted-foreground">Controle mensal por funcionário</p>
          </div>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Funcionários
            </CardDescription>
            <CardTitle className="text-2xl">{data.currentMonth.usersCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Com vale habilitado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Limite Total
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(data.currentMonth.totalLimit)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Soma dos limites</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Utilizado
            </CardDescription>
            <CardTitle className="text-2xl text-orange-600">{formatCurrency(data.currentMonth.totalUsed)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full ${data.currentMonth.utilizationRate > 90 ? 'bg-red-500' : data.currentMonth.utilizationRate > 75 ? 'bg-amber-500' : 'bg-orange-500'}`}
                  style={{ width: `${Math.min(100, data.currentMonth.utilizationRate)}%` }}
                />
              </div>
              <span className="text-xs font-medium">{data.currentMonth.utilizationRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wallet className="h-4 w-4" />
              Disponível
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{formatCurrency(data.currentMonth.totalAvailable)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Saldo restante</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Funcionário</CardTitle>
          <CardDescription>
            {data.currentMonth.monthName.charAt(0).toUpperCase() + data.currentMonth.monthName.slice(1)} {data.currentMonth.year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead className="text-right">Utilizado</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-center">Uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">{userItem.name}</TableCell>
                    <TableCell className="text-muted-foreground">{userItem.department || "-"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(userItem.limit)}</TableCell>
                    <TableCell className="text-right font-mono text-orange-600">{formatCurrency(userItem.used)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{formatCurrency(userItem.available)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              userItem.utilizationRate > 90 ? 'bg-red-500' : 
                              userItem.utilizationRate > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, userItem.utilizationRate)}%` }}
                          />
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`min-w-[50px] justify-center ${
                            userItem.utilizationRate > 90 ? 'border-red-500 text-red-600' : 
                            userItem.utilizationRate > 75 ? 'border-amber-500 text-amber-600' : 
                            'border-emerald-500 text-emerald-600'
                          }`}
                        >
                          {userItem.utilizationRate}%
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      {data.history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico Mensal
            </CardTitle>
            <CardDescription>Consolidado dos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-center">Funcionários</TableHead>
                    <TableHead className="text-right">Limite Total</TableHead>
                    <TableHead className="text-right">Utilizado</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-center">Taxa de Uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((month, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {month.monthName.charAt(0).toUpperCase() + month.monthName.slice(1)} {month.year}
                      </TableCell>
                      <TableCell className="text-center">{month.usersCount}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(month.totalLimit)}</TableCell>
                      <TableCell className="text-right font-mono text-orange-600">{formatCurrency(month.totalUsed)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">{formatCurrency(month.totalAvailable)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${month.utilizationRate > 90 ? 'bg-red-500' : month.utilizationRate > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, month.utilizationRate)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{month.utilizationRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
