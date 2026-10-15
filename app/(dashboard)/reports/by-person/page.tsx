"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PaginationControl } from "@/components/pagination-control"
import { Button } from "@/components/ui/button"
import { Users, ArrowLeft, Info, Download } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"
import { fetchInstitucionalInfo } from "@/lib/institucional"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface PersonRow {
  name: string
  total: number
  count: number
  isThirdParty: boolean
}

interface ByPersonReport {
  startDate: string
  endDate: string
  status: string
  totalExpenses: number
  totalAmount: number
  byPerson: PersonRow[]
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"]

const STATUS_OPTIONS = [
  { value: "approved", label: "Apenas aprovadas" },
  { value: "paid", label: "Aprovadas e pagas" },
  { value: "pending", label: "Pendentes / em correção" },
  { value: "all", label: "Todas (exceto rejeitadas)" },
]

export default function ByPersonReportPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ByPersonReport | null>(null)

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState("approved")

  // Paginação da tabela
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    setPage(1)
  }, [startDate, endDate, status])

  const totalPages = Math.ceil((data?.byPerson.length || 0) / pageSize) || 1
  const paginatedByPerson = useMemo(() => {
    if (!data?.byPerson) return []
    const start = (page - 1) * pageSize
    return data.byPerson.slice(start, start + pageSize)
  }, [data?.byPerson, page, pageSize])

  async function generateReport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate, status })
      const res = await fetch(`/api/reports/by-person?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erro ao gerar relatório")
      }
      const json = await res.json()
      setData(json)
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar relatório")
    } finally {
      setLoading(false)
    }
  }

  // Gera automaticamente ao abrir
  useEffect(() => {
    generateReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generatePDF() {
    if (!data) return
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ])
      const [institucional] = await Promise.all([
        fetchInstitucionalInfo(),
      ])
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      const fmtDate = (d: string) => {
        const [y, m, day] = d.split("-")
        return `${day}/${m}/${y}`
      }

      doc.setFillColor(16, 185, 129)
      doc.rect(0, 0, pageWidth, 28, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.text((institucional.nome || "RAROTEC").toUpperCase(), pageWidth / 2, 10, { align: "center" })
      doc.setFontSize(10)
      doc.text(`${institucional.sistema?.nome || "RaroPay"} - Relatório de Gasto Real por Pessoa`, pageWidth / 2, 17, { align: "center" })
      doc.setFontSize(7.5)
      doc.text(`${institucional.razao_social} • CNPJ: ${institucional.cnpj}`, pageWidth / 2, 23, { align: "center" })

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      const statusLabel = STATUS_OPTIONS.find((s) => s.value === data.status)?.label || data.status
      doc.text(`Período: ${fmtDate(data.startDate)} a ${fmtDate(data.endDate)}`, pageWidth / 2, 38, {
        align: "center",
      })
      doc.text(`Filtro: ${statusLabel}`, pageWidth / 2, 44, { align: "center" })

      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(
        "Rateio igual entre participantes. Terceiros somados em linha separada. Uso gerencial.",
        pageWidth / 2,
        50,
        { align: "center" },
      )
      doc.setTextColor(0, 0, 0)

      autoTable(doc, {
        startY: 56,
        head: [["#", "Pessoa", "Despesas", "Gasto Rateado"]],
        body: data.byPerson.map((p, i) => [
          String(i + 1),
          p.isThirdParty ? `${p.name} (terceiros)` : p.name,
          String(p.count),
          formatCurrency(p.total),
        ]),
        foot: [["", "TOTAL", String(data.totalExpenses), formatCurrency(data.totalAmount)]],
        headStyles: { fillColor: [16, 185, 129] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
        styles: { fontSize: 9 },
      })

      const pageCount = doc.internal.pages.length - 1
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(156, 163, 175)
        doc.text(
          `${institucional.razao_social} (CNPJ: ${institucional.cnpj}) - Gerado em ${new Date().toLocaleString('pt-BR')}`,
          14,
          pageHeight - 6
        )
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth - 14,
          pageHeight - 6,
          { align: "right" }
        )
      }

      doc.save(`relatorio-por-pessoa-${data.startDate}-${data.endDate}.pdf`)
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error)
      toast.error(error instanceof Error ? error.message : (error?.message || "Erro ao gerar PDF"))
    }
  }

  const canView = user && ["admin", "financial"].includes(user.role)

  if (user && !canView) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Você não tem permissão para acessar este relatório.
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = data?.byPerson.slice(0, 12).map((p) => ({
    name: p.name.length > 14 ? p.name.slice(0, 12) + "…" : p.name,
    total: p.total,
    isThirdParty: p.isThirdParty,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold text-balance">Gasto Real por Pessoa</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Rateio gerencial do custo das despesas entre as pessoas envolvidas.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/reports">
            <ArrowLeft className="h-4 w-4" />
            Relatório de Despesas
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Defina o período e o status considerado no rateio.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="start">Data inicial</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Data final</Label>
              <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateReport} disabled={loading}>
              {loading ? <Spinner className="h-4 w-4" /> : null}
              Gerar relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Cada despesa é dividida igualmente entre os participantes (solicitante, quem efetuou e pessoas
          vinculadas). Terceiros não-funcionários são agrupados em uma linha separada. Este relatório é
          apenas para controle gerencial e não afeta aprovação ou financeiro.
        </p>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Rateado</p>
                <p className="text-2xl font-semibold text-primary">{formatCurrency(data.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Despesas consideradas</p>
                <p className="text-2xl font-semibold">{data.totalExpenses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pessoas</p>
                <p className="text-2xl font-semibold">{data.byPerson.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={generatePDF} variant="outline" disabled={data.byPerson.length === 0}>
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>

          {data.byPerson.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma despesa encontrada para os filtros selecionados.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Gasto por pessoa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                        <XAxis 
                          dataKey="name" 
                          angle={-35} 
                          textAnchor="end" 
                          height={60} 
                          fontSize={12}
                          stroke="var(--border)"
                          tick={{ fill: 'currentColor' }}
                          className="text-slate-600 dark:text-slate-200"
                        />
                        <YAxis 
                          fontSize={12} 
                          tickFormatter={(v) => `R$${v}`}
                          stroke="var(--border)"
                          tick={{ fill: 'currentColor' }}
                          className="text-slate-600 dark:text-slate-200"
                        />
                        <Tooltip 
                          formatter={(v: number) => formatCurrency(v)}
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            borderColor: 'var(--border)',
                            borderRadius: '0.5rem',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                          }}
                          labelStyle={{
                            color: 'var(--foreground)',
                            fontWeight: 600,
                            marginBottom: '0.25rem',
                          }}
                          itemStyle={{
                            color: 'var(--foreground)',
                          }}
                          cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
                        />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {chartData?.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.isThirdParty ? "#94a3b8" : COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Detalhamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">#</th>
                          <th className="py-2 pr-4 font-medium">Pessoa</th>
                          <th className="py-2 pr-4 font-medium text-right">Despesas</th>
                          <th className="py-2 font-medium text-right">Gasto Rateado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedByPerson.map((p, i) => {
                          const itemIndex = (page - 1) * pageSize + i + 1
                          return (
                            <tr key={`${p.name}-${itemIndex}`} className="border-b last:border-0">
                              <td className="py-2 pr-4 text-muted-foreground">{itemIndex}</td>
                              <td className="py-2 pr-4 font-medium">
                                {p.name}
                                {p.isThirdParty && (
                                  <span className="ml-2 text-xs text-muted-foreground">(terceiros)</span>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-right">{p.count}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(p.total)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="py-2 pr-4"></td>
                          <td className="py-2 pr-4">TOTAL</td>
                          <td className="py-2 pr-4 text-right">{data.totalExpenses}</td>
                          <td className="py-2 text-right text-primary">{formatCurrency(data.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-4">
                      <PaginationControl
                        currentPage={page}
                        pageSize={pageSize}
                        totalPages={totalPages}
                        totalCount={data.byPerson.length}
                        onPageChange={setPage}
                        onPageSizeChange={(newSize) => {
                          setPageSize(newSize)
                          setPage(1)
                        }}
                        pageSizeOptions={[25, 50, 100]}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
