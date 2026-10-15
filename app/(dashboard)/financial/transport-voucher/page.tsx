"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/components/auth-provider"
import { formatCurrency } from "@/lib/format"
import { Bus, ArrowLeft, TrendingUp, Users, Wallet, History } from "lucide-react"
import Link from "next/link"
import { PaginationControl } from "@/components/pagination-control"

interface UserVoucherData {
  id: number
  name: string
  department: string | null
  limit: number | null
  used: number
  available: number | null
  transactionsCount: number
  utilizationRate: number | null
}

interface MonthData {
  month: number
  year: number
  monthName: string
  usersCount: number
  transactionsCount: number
  totalUsed: number
  avgPerUser: number
}

interface CurrentMonthData {
  month: number
  year: number
  monthName: string
  hasLimits: boolean
  usersCount: number
  usersWithLimitCount: number
  totalLimit: number
  totalUsed: number
  totalUsedAll: number
  totalAvailable: number
  avgPerUser: number
  totalTransactions: number
  utilizationRate: number
}

interface ManagementData {
  currentMonth: CurrentMonthData
  history: MonthData[]
  users: UserVoucherData[]
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function TransportVoucherManagementPage() {
  const { user } = useAuth()
  const [data, setData] = useState<ManagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>("current")

  // Paginação
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    setPage(1)
  }, [selectedMonth])

  const totalPages = Math.ceil((data?.users.length || 0) / pageSize) || 1
  const paginatedUsers = useMemo(() => {
    if (!data?.users) return []
    const start = (page - 1) * pageSize
    return data.users.slice(start, start + pageSize)
  }, [data?.users, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  async function fetchData() {
    try {
      setLoading(true)
      const params = selectedMonth !== "current" ? `?month=${selectedMonth}` : ""
      const response = await fetch(`/api/transport-voucher/management${params}`)
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

  const header = (
    <div className="flex items-center gap-4">
      <Link href="/financial/dashboard">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bus className="h-6 w-6 text-sky-600" />
          Acompanhamento de Vale-Transporte
        </h1>
        <p className="text-muted-foreground">Controle mensal por funcionário</p>
      </div>
    </div>
  )

  if (!data || data.users.length === 0) {
    return (
      <div className="p-6 space-y-6">
        {header}
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum funcionário com vale-transporte habilitado.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Gerar opções de meses (mês atual + histórico)
  const monthOptions = [
    { value: "current", label: `${capitalize(data.currentMonth.monthName)} ${data.currentMonth.year} (Atual)` },
    ...data.history
      .filter((h) => !(h.month === data.currentMonth.month && h.year === data.currentMonth.year))
      .map((h) => ({
        value: `${h.year}-${String(h.month).padStart(2, "0")}`,
        label: `${capitalize(h.monthName)} ${h.year}`,
      })),
  ]

  const barColor = (rate: number) =>
    rate > 90 ? "bg-red-500" : rate > 75 ? "bg-amber-500" : "bg-sky-500"
  const badgeColor = (rate: number) =>
    rate > 90 ? "border-red-500 text-red-600" : rate > 75 ? "border-amber-500 text-amber-600" : "border-sky-500 text-sky-700"

  const hasLimits = data.currentMonth.hasLimits
  // Maior gasto do mês, usado na barra comparativa quando não há limites definidos
  const maxUsed = Math.max(0, ...data.users.map((u) => u.used))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {header}
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

        {data.currentMonth.hasLimits ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Wallet className="h-4 w-4" />
                  Limite Total
                </CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(data.currentMonth.totalLimit)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Soma dos limites{" "}
                  {data.currentMonth.usersWithLimitCount < data.currentMonth.usersCount &&
                    `(${data.currentMonth.usersWithLimitCount} de ${data.currentMonth.usersCount} com limite)`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Utilizado
                </CardDescription>
                <CardTitle className="text-2xl text-sky-700">{formatCurrency(data.currentMonth.totalUsed)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor(data.currentMonth.utilizationRate)}`}
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
                <CardTitle className={`text-2xl ${data.currentMonth.totalAvailable < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(data.currentMonth.totalAvailable)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Saldo restante dos limites</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Total Gasto
                </CardDescription>
                <CardTitle className="text-2xl text-sky-700">{formatCurrency(data.currentMonth.totalUsedAll)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">No mês selecionado</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Wallet className="h-4 w-4" />
                  Média por Funcionário
                </CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(data.currentMonth.avgPerUser)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Gasto médio no mês</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <History className="h-4 w-4" />
                  Lançamentos
                </CardDescription>
                <CardTitle className="text-2xl">{data.currentMonth.totalTransactions}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Despesas registradas</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabela de Funcionários */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Funcionário</CardTitle>
          <CardDescription>
            {capitalize(data.currentMonth.monthName)} {data.currentMonth.year}
            {!hasLimits && " · barra relativa ao maior gasto do mês"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {hasLimits ? (
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
                  {paginatedUsers.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell className="font-medium">{userItem.name}</TableCell>
                      <TableCell className="text-muted-foreground">{userItem.department || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {userItem.limit != null ? formatCurrency(userItem.limit) : <span className="text-muted-foreground">Ilimitado</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sky-700">{formatCurrency(userItem.used)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {userItem.available != null ? formatCurrency(userItem.available) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {userItem.utilizationRate != null ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${barColor(userItem.utilizationRate)}`}
                                style={{ width: `${Math.min(100, userItem.utilizationRate)}%` }}
                              />
                            </div>
                            <Badge variant="outline" className={`min-w-[50px] justify-center ${badgeColor(userItem.utilizationRate)}`}>
                              {userItem.utilizationRate}%
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <Badge variant="outline" className="min-w-[50px] justify-center text-muted-foreground">
                              -
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="text-center">Lançamentos</TableHead>
                    <TableHead className="text-right">Gasto no Mês</TableHead>
                    <TableHead className="text-center">Comparativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((userItem) => {
                    const pct = maxUsed > 0 ? Math.round((userItem.used / maxUsed) * 100) : 0
                    return (
                      <TableRow key={userItem.id}>
                        <TableCell className="font-medium">{userItem.name}</TableCell>
                        <TableCell className="text-muted-foreground">{userItem.department || "-"}</TableCell>
                        <TableCell className="text-center">{userItem.transactionsCount}</TableCell>
                        <TableCell className="text-right font-mono text-sky-700">{formatCurrency(userItem.used)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all bg-sky-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <Badge variant="outline" className="min-w-[50px] justify-center border-sky-500 text-sky-700">
                              {pct}%
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <PaginationControl
                currentPage={page}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={data.users.length}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setPage(1)
                }}
                pageSizeOptions={[20, 50, 100]}
              />
            </div>
          )}
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
                    <TableHead className="text-center">Lançamentos</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">Média/Funcionário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((month, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {capitalize(month.monthName)} {month.year}
                      </TableCell>
                      <TableCell className="text-center">{month.usersCount}</TableCell>
                      <TableCell className="text-center">{month.transactionsCount}</TableCell>
                      <TableCell className="text-right font-mono text-sky-700">{formatCurrency(month.totalUsed)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(month.avgPerUser)}</TableCell>
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
