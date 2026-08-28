"use client"

import { useState, useEffect } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { FieldGroup, Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { 
  FileText, 
  Download, 
  Calendar,
  Filter,
  BarChart3,
  PieChart
} from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from "recharts"

interface ExpenseItem {
  id: number
  expense_date: string
  category: string
  expense_type: string
  amount: number
  status: string
  state: string
  municipality: string
  user_name: string
}

interface ReportData {
  summary: {
    total: number
    approved: number
    pending: number
    rejected: number
    paidCount: number
    totalAmount: number
    approvedAmount: number
    rejectedAmount: number
    paidAmount: number
    // Cartão Corporativo
    corporateCardCount: number
    corporateCardApprovedCount: number
    corporateCardRejectedCount: number
    corporateCardPaidCount: number
    corporateCardTotal: number
    corporateCardApproved: number
    corporateCardRejected: number
    corporateCardPaid: number
    // Adiantamento
    advanceCount: number
    advanceApprovedCount: number
    advanceRejectedCount: number
    advancePaidCount: number
    advanceTotal: number
    advanceApproved: number
    advanceRejected: number
    advancePaid: number
    // Reembolso
    reimbursementCount: number
    reimbursementApprovedCount: number
    reimbursementRejectedCount: number
    reimbursementPaidCount: number
    reimbursementTotal: number
    reimbursementApproved: number
    reimbursementRejected: number
    reimbursementPaid: number
  }
  byCategory: { category: string; label: string; total: number; count: number }[]
  byType: { type: string; label: string; total: number; count: number }[]
  byMonth: { month: string; total: number; count: number }[]
  byStatus: { status: string; label: string; total: number; count: number }[]
  byEmployee: { employee: string; total: number; count: number }[]
  expenses: ExpenseItem[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export default function ReportsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  
  // Filtros do relatório
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedEmployee, setSelectedEmployee] = useState("all")
  const [employees, setEmployees] = useState<{id: number, name: string}[]>([])

  // Buscar lista de funcionários
  useEffect(() => {
    async function fetchEmployees() {
      try {
        const res = await fetch('/api/users?active=true')
        if (res.ok) {
          const data = await res.json()
          // API retorna array diretamente, não { users: [...] }
          setEmployees(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error)
      }
    }
    fetchEmployees()
  }, [])

  const categories = [
    { value: "accommodation", label: "Hospedagem" },
    { value: "food", label: "Alimentação" },
    { value: "fuel", label: "Combustível" },
    { value: "transport", label: "Deslocamento" },
    { value: "parking", label: "Estacionamento" },
    { value: "office_supplies", label: "Itens de Escritório" },
    { value: "meal_voucher", label: "Vale-Refeição" },
    { value: "transport_voucher", label: "Vale-Transporte" },
    { value: "other", label: "Outras Despesas" },
  ]

  const expenseTypes = [
    { value: "corporate_card", label: "Cartão Corporativo" },
    { value: "advance", label: "Adiantamento" },
    { value: "reimbursement", label: "Reembolso" },
  ]

  async function generateReport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        status: selectedStatus,
      })
      
      if (selectedCategories.length > 0) {
        params.set("categories", selectedCategories.join(","))
      }
      if (selectedTypes.length > 0) {
        params.set("types", selectedTypes.join(","))
      }
      if (selectedEmployee !== "all") {
        params.set("employeeId", selectedEmployee)
      }

      const res = await fetch(`/api/reports?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReportData(data)
        toast.success("Relatório gerado com sucesso")
      } else {
        toast.error("Erro ao gerar relatório")
      }
    } catch (error) {
      toast.error("Erro ao gerar relatório")
    } finally {
      setLoading(false)
    }
  }

  async function downloadPDF() {
    if (!reportData) {
      toast.error("Gere o relatório primeiro")
      return
    }
    
    // Verificação segura - expenses pode não existir em dados antigos
    const expenses = reportData?.expenses
    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      toast.error("Gere o relatório novamente para baixar o PDF com lista de despesas")
      return
    }
    
    setLoading(true)
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      
      const categoryLabels: Record<string, string> = {
        accommodation: "Hospedagem",
        food: "Alimentação",
        fuel: "Combustível",
        transport: "Deslocamento",
        parking: "Estacionamento",
        office_supplies: "Itens de Escritório",
        meal_voucher: "Vale-Refeição",
        other: "Outras Despesas",
      }

      const typeLabels: Record<string, string> = {
        corporate_card: "Cartão Corporativo",
        advance: "Adiantamento",
        adiantamento: "Adiantamento",
        refund: "Reembolso",
        reimbursement: "Reembolso",
        reembolso: "Reembolso",
      }

      const statusLabels: Record<string, string> = {
        draft: "Rascunho",
        processed: "Processada",
        pending: "Pendente",
        approved: "Aprovada",
        aprovado: "Aprovada",
        rejected: "Rejeitada",
        rejeitado: "Rejeitada",
        correction: "Em Correção",
        submitted: "Enviada",
        enviado: "Enviada",
      }

      const formattedStartDate = new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR')
      const formattedEndDate = new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR')
      
      // Cores azuis do tema
      const primaryBlue: [number, number, number] = [37, 99, 235] // blue-600
      const darkBlue: [number, number, number] = [30, 58, 138] // blue-900
      const lightBlue: [number, number, number] = [59, 130, 246] // blue-500
      const accentBlue: [number, number, number] = [96, 165, 250] // blue-400
      
      // ========== CABEÇALHO MODERNO COM GRADIENTE VISUAL ==========
      // Fundo principal azul escuro
      doc.setFillColor(...darkBlue)
      doc.rect(0, 0, pageWidth, 50, 'F')
      
      // Faixa lateral esquerda branca para a logo
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, 55, 50, 'F')
      
      // Detalhe decorativo - linha vertical azul claro
      doc.setFillColor(...accentBlue)
      doc.rect(55, 0, 3, 50, 'F')
      
      // Linha inferior decorativa
      doc.setFillColor(...lightBlue)
      doc.rect(0, 50, pageWidth, 3, 'F')
      
      // Adicionar logo na área branca (contraste garantido)
      try {
        const logoImg = new Image()
        logoImg.crossOrigin = 'anonymous'
        logoImg.src = '/images/logo-rarotec.png'
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve
          logoImg.onerror = reject
          setTimeout(resolve, 1000) // fallback timeout
        })
        if (logoImg.complete && logoImg.naturalHeight !== 0) {
          const logoHeight = 28
          const logoWidth = (logoImg.naturalWidth / logoImg.naturalHeight) * logoHeight
          // Centralizar logo na área branca
          const logoX = (55 - logoWidth) / 2
          doc.addImage(logoImg, 'PNG', logoX, 11, logoWidth, logoHeight)
        }
      } catch {
        // Se não conseguir carregar a logo, continua sem ela
      }
      
      // Título principal na área azul
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.text("SISTEMA FINANCEIRO RAROTEC", 130, 18, { align: "center" })
      
      // Subtítulo
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(191, 219, 254) // blue-200
      doc.text("Relatório de Despesas", 130, 30, { align: "center" })
      
      // Período com destaque
      doc.setFontSize(10)
      doc.setTextColor(255, 255, 255)
      doc.text(`Período: ${formattedStartDate} a ${formattedEndDate}`, 130, 42, { align: "center" })
      
      // ========== RESUMO COMPACTO EM TABELA ==========
      const startY = 62 // Mais espaço após o cabeçalho
      const startX = 10
      
      // Cores
      const greenSuccess: [number, number, number] = [16, 185, 129]
      const redDanger: [number, number, number] = [239, 68, 68]
      const blueText: [number, number, number] = [37, 99, 235]
      
      // Título da seção centralizado
      doc.setFontSize(11)
      doc.setTextColor(...darkBlue)
      doc.setFont("helvetica", "bold")
      doc.text("Resumo Financeiro", pageWidth / 2, startY + 4, { align: "center" })
      
      // Tabela de resumo estratégico - largura total da página
      const s = reportData.summary
      const marginX = 10 // margem lateral igual às outras tabelas
      const subHeaderColor: [number, number, number] = [71, 85, 105] // slate-600 para texto escuro
      
      autoTable(doc, {
        startY: startY + 8,
        head: [[
          { content: '', styles: { fillColor: darkBlue } },
          { content: 'Total', colSpan: 2, styles: { halign: 'center', fillColor: blueText } },
          { content: 'Aprovado', colSpan: 2, styles: { halign: 'center', fillColor: greenSuccess } },
          { content: 'Rejeitado', colSpan: 2, styles: { halign: 'center', fillColor: redDanger } },
          { content: 'Pago', colSpan: 2, styles: { halign: 'center', fillColor: [5, 150, 105] } },
        ], [
          { content: 'Tipo', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Qtd', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Valor', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Qtd', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Valor', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Qtd', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Valor', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Qtd', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
          { content: 'Valor', styles: { fillColor: [241, 245, 249], textColor: subHeaderColor } },
        ]],
        body: [
          ['Geral', s.total, formatCurrency(s.totalAmount), s.approved, formatCurrency(s.approvedAmount), s.rejected, formatCurrency(s.rejectedAmount || 0), s.paidCount || 0, formatCurrency(s.paidAmount)],
          ['Cartão Corp.', s.corporateCardCount || 0, formatCurrency(s.corporateCardTotal), s.corporateCardApprovedCount || 0, formatCurrency(s.corporateCardApproved || 0), s.corporateCardRejectedCount || 0, formatCurrency(s.corporateCardRejected || 0), s.corporateCardPaidCount || 0, formatCurrency(s.corporateCardPaid || 0)],
          ['Adiantamento', s.advanceCount || 0, formatCurrency(s.advanceTotal), s.advanceApprovedCount || 0, formatCurrency(s.advanceApproved || 0), s.advanceRejectedCount || 0, formatCurrency(s.advanceRejected || 0), s.advancePaidCount || 0, formatCurrency(s.advancePaid || 0)],
          ['Reembolso', s.reimbursementCount || 0, formatCurrency(s.reimbursementTotal), s.reimbursementApprovedCount || 0, formatCurrency(s.reimbursementApproved || 0), s.reimbursementRejectedCount || 0, formatCurrency(s.reimbursementRejected || 0), s.reimbursementPaidCount || 0, formatCurrency(s.reimbursementPaid || 0)],
        ],
        theme: 'grid',
        styles: {
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.3,
        },
        headStyles: {
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2.5,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [51, 65, 85], // slate-700
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: darkBlue },
          1: { halign: 'center' }, // Qtd Total
          2: { halign: 'right' }, // Valor Total
          3: { halign: 'center', textColor: greenSuccess }, // Qtd Aprovado
          4: { halign: 'right', textColor: greenSuccess }, // Valor Aprovado
          5: { halign: 'center', textColor: redDanger }, // Qtd Rejeitado
          6: { halign: 'right', textColor: redDanger }, // Valor Rejeitado
          7: { halign: 'center', textColor: [5, 150, 105] }, // Qtd Pago
          8: { halign: 'right', textColor: [5, 150, 105] }, // Valor Pago
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
        margin: { left: marginX, right: marginX },
        tableWidth: 'auto', // Preenche toda a largura disponível
      })
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cardY2 = (doc as any).lastAutoTable?.finalY || startY + 40
      
      // ========== TABELAS DE RESUMO NA PRIMEIRA PÁGINA (após a tabela de resumo) ==========
      // Título da seção de resumos - mais espaço entre as seções
      let currentY = cardY2 + 14
      doc.setFontSize(11)
      doc.setTextColor(...darkBlue)
      doc.setFont("helvetica", "bold")
      doc.text("Resumos por Agrupamento", pageWidth / 2, currentY, { align: "center" })
      currentY += 8
      
      // Função auxiliar para criar mini tabela e retornar a posição Y final
      const createSummaryTable = (title: string, headers: string[], data: string[][], startY: number, marginLeft: number, colWidths: number[]): number => {
        doc.setFontSize(9)
        doc.setTextColor(30, 58, 138) // blue-900
        doc.setFont("helvetica", "bold")
        doc.text(title, marginLeft, startY)
        
        autoTable(doc, {
          startY: startY + 2,
          head: [headers],
          body: data,
          theme: 'plain',
          headStyles: { 
            fillColor: [219, 234, 254], // blue-100
            textColor: [30, 58, 138], // blue-900
            fontSize: 7,
            fontStyle: 'bold',
            cellPadding: 1.5
          },
          bodyStyles: { 
            fontSize: 7,
            cellPadding: 1.5
          },
          columnStyles: {
            0: { cellWidth: colWidths[0] },
            1: { cellWidth: colWidths[1], halign: 'center' },
            2: { cellWidth: colWidths[2], halign: 'right' }
          },
          tableWidth: colWidths.reduce((a, b) => a + b, 0),
          margin: { left: marginLeft }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (doc as any).lastAutoTable?.finalY || startY + 25
      }
      
      const leftCol = 14
      const rightCol = 110
      const colWidths = [40, 12, 28]
      
      // Linha 1: Resumo por Categoria (esquerda) e Resumo por Tipo (direita)
      let leftY1 = currentY
      let rightY1 = currentY
      
      if (reportData.byCategory && reportData.byCategory.length > 0) {
        const catData = reportData.byCategory.map(cat => [
          cat.label, String(cat.count), formatCurrency(cat.total)
        ])
        leftY1 = createSummaryTable("Resumo por Categoria", ['Categoria', 'Qtd', 'Total'], catData, currentY, leftCol, colWidths)
      }
      
      if (reportData.byType && reportData.byType.length > 0) {
        const typeData = reportData.byType.map(type => [
          type.label, String(type.count), formatCurrency(type.total)
        ])
        rightY1 = createSummaryTable("Resumo por Tipo", ['Tipo', 'Qtd', 'Total'], typeData, currentY, rightCol, colWidths)
      }
      
      // Avançar para a maior altura entre as duas tabelas + margem
      currentY = Math.max(leftY1, rightY1) + 6
      
      // Linha 2: Resumo por Status (esquerda) e Resumo por Funcionário (direita)
      let leftY2 = currentY
      let rightY2 = currentY
      
      if (reportData.byStatus && reportData.byStatus.length > 0) {
        const statusData = reportData.byStatus.map(s => [
          s.label, String(s.count), formatCurrency(s.total)
        ])
        leftY2 = createSummaryTable("Resumo por Status", ['Status', 'Qtd', 'Total'], statusData, currentY, leftCol, colWidths)
      }
      
      if (reportData.byEmployee && reportData.byEmployee.length > 0) {
        const empData = reportData.byEmployee.map(emp => [
          emp.employee, String(emp.count), formatCurrency(emp.total)
        ])
        rightY2 = createSummaryTable("Resumo por Funcionário", ['Funcionário', 'Qtd', 'Total'], empData, currentY, rightCol, colWidths)
      }
      
      // Posição final após resumos
      currentY = Math.max(leftY2, rightY2)
      
      // ========== NOVA PÁGINA PARA TABELA GERAL DE DESPESAS ==========
      doc.addPage()
      
      // Cabeçalho simplificado na segunda página (azul)
      doc.setFillColor(...primaryBlue)
      doc.rect(0, 0, pageWidth, 20, 'F')
      doc.setFontSize(12)
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.text("Detalhamento Geral (por Data)", pageWidth / 2, 13, { align: "center" })
      
      // Função auxiliar para formatar data (corrigido para evitar problema de timezone)
      const formatDate = (dateValue: string | Date | null | undefined): string => {
        if (!dateValue) return '-'
        try {
          // Se for string, extrair apenas a parte da data (YYYY-MM-DD) ignorando timezone
          if (typeof dateValue === 'string') {
            // Se for ISO string (2026-03-09T00:00:00.000Z), pegar só a data
            const dateOnly = dateValue.split('T')[0]
            // Verificar se está no formato YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
              const [year, month, day] = dateOnly.split('-').map(Number)
              return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
            }
          }
          // Fallback: Date object
          if (dateValue instanceof Date) {
            const day = dateValue.getDate()
            const month = dateValue.getMonth() + 1
            const year = dateValue.getFullYear()
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
          }
          return '-'
        } catch {
          return '-'
        }
      }
      
      // Tabela de despesas
      const tableData = expenses.map((exp: ExpenseItem) => [
        formatDate(exp.expense_date),
        exp.user_name || '-',
        typeLabels[exp.expense_type] || exp.expense_type,
        categoryLabels[exp.category] || exp.category,
        exp.municipality ? `${exp.municipality}/${exp.state}` : (exp.state || '-'),
        statusLabels[exp.status] || exp.status,
        formatCurrency(exp.amount)
      ])
      
      // Função auxiliar para criar tabela de despesas
      const createExpenseTable = (data: ExpenseItem[], startY: number) => {
        const tblData = data.map((exp: ExpenseItem) => [
          formatDate(exp.expense_date),
          exp.user_name || '-',
          typeLabels[exp.expense_type] || exp.expense_type,
          categoryLabels[exp.category] || exp.category,
          exp.municipality ? `${exp.municipality}/${exp.state}` : (exp.state || '-'),
          statusLabels[exp.status] || exp.status,
          formatCurrency(exp.amount)
        ])
        
        autoTable(doc, {
          startY,
          head: [['Data', 'Funcionário', 'Tipo', 'Categoria', 'Local', 'Status', 'Valor']],
          body: tblData,
          theme: 'grid',
          headStyles: { 
            fillColor: [30, 58, 138], // blue-900
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            cellPadding: 3,
            halign: 'center'
          },
          bodyStyles: { 
            fontSize: 7.5,
            cellPadding: 2.5,
            lineColor: [191, 219, 254], // blue-200
            lineWidth: 0.1
          },
          alternateRowStyles: {
            fillColor: [239, 246, 255] // blue-50
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 'auto', halign: 'center' },
            6: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 },
          tableWidth: 'auto',
          didParseCell: (cellData) => {
            // Colorir status
            if (cellData.section === 'body' && cellData.column.index === 5) {
              const status = data[cellData.row.index]?.status
              if (status === 'approved' || status === 'aprovado') {
                cellData.cell.styles.textColor = [34, 197, 94]
              } else if (status === 'rejected' || status === 'rejeitado') {
                cellData.cell.styles.textColor = [239, 68, 68]
              } else if (status === 'pending' || status === 'submitted' || status === 'enviado') {
                cellData.cell.styles.textColor = [234, 179, 8]
              }
            }
          }
        })
      }

      // Função para adicionar cabeçalho de seção (azul)
      const addSectionHeader = (title: string) => {
        doc.addPage()
        doc.setFillColor(...primaryBlue)
        doc.rect(0, 0, pageWidth, 20, 'F')
        doc.setFontSize(12)
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.text(title, pageWidth / 2, 13, { align: "center" })
      }

      // Tabela Geral (ordenada por data)
      createExpenseTable(expenses, 28)
      
      // ========== TABELAS SEPARADAS POR TIPO ==========
      // Agrupar despesas por tipo
      const expenseTypes = [...new Set(expenses.map(e => e.expense_type))]
      for (const expType of expenseTypes) {
        const typeExpenses = expenses
          .filter(e => e.expense_type === expType)
          .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        
        if (typeExpenses.length > 0) {
          const typeLabel = typeLabels[expType] || expType
          addSectionHeader(`Despesas: ${typeLabel}`)
          createExpenseTable(typeExpenses, 28)
        }
      }
      
      // ========== TABELAS SEPARADAS POR STATUS ==========
      // Agrupar despesas por status
      const expenseStatuses = [...new Set(expenses.map(e => e.status))]
      for (const expStatus of expenseStatuses) {
        const statusExpenses = expenses
          .filter(e => e.status === expStatus)
          .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        
        if (statusExpenses.length > 0) {
          const statusLabel = statusLabels[expStatus] || expStatus
          addSectionHeader(`Despesas: ${statusLabel}`)
          createExpenseTable(statusExpenses, 28)
        }
      }
      
      // ========== TABELAS SEPARADAS POR FUNCIONÁRIO ==========
      // Agrupar despesas por funcionário
      const employeeNames = [...new Set(expenses.map(e => e.user_name || 'Sem nome'))]
      for (const empName of employeeNames) {
        const empExpenses = expenses
          .filter(e => (e.user_name || 'Sem nome') === empName)
          .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        
        if (empExpenses.length > 0) {
          addSectionHeader(`Despesas: ${empName}`)
          createExpenseTable(empExpenses, 28)
        }
      }
      
      // ========== TABELAS SEPARADAS POR CATEGORIA ==========
      // Agrupar despesas por categoria
      const expenseCategories = [...new Set(expenses.map(e => e.category))]
      for (const expCat of expenseCategories) {
        const catExpenses = expenses
          .filter(e => e.category === expCat)
          .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        
        if (catExpenses.length > 0) {
          const catLabel = categoryLabels[expCat] || expCat
          addSectionHeader(`Despesas: ${catLabel}`)
          createExpenseTable(catExpenses, 28)
        }
      }
      
      // ========== RODAPÉ EM TODAS AS PÁGINAS ==========
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        
        // Linha do rodapé
        doc.setDrawColor(229, 231, 235)
        doc.setLineWidth(0.5)
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15)
        
        // Texto do rodapé
        doc.setFontSize(7)
        doc.setTextColor(156, 163, 175)
        doc.setFont("helvetica", "normal")
        doc.text(
          `Sistema Financeiro Rarotec - Documento gerado em ${new Date().toLocaleString('pt-BR')}`,
          14,
          pageHeight - 8
        )
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth - 14,
          pageHeight - 8,
          { align: "right" }
        )
      }
      
      // Salvar PDF
      doc.save(`relatorio-despesas-${startDate}-${endDate}.pdf`)
      toast.success("PDF gerado com sucesso")
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)
      toast.error("Erro ao gerar PDF")
    } finally {
      setLoading(false)
    }
  }

  function toggleCategory(category: string) {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  function toggleType(type: string) {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const canViewReports = user?.role === "manager" || user?.role === "director" || user?.role === "admin" || user?.role === "financial"

  if (!canViewReports) {
    return (
      <div className="flex h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar os relatórios.
              Apenas administradores, gestores, diretoria e financeiro podem visualizar esta área.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios detalhados das despesas com filtros personalizados
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Período */}
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Data Inicial</FieldLabel>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">Data Final</FieldLabel>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>

          <Separator />

          {/* Categorias */}
          <FieldSet>
            <FieldLegend>Categorias</FieldLegend>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {categories.map((cat) => (
                <label
                  key={cat.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat.value)}
                    onCheckedChange={() => toggleCategory(cat.value)}
                  />
                  {cat.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Deixe vazio para incluir todas as categorias
            </p>
          </FieldSet>

          <Separator />

          {/* Tipos de despesa */}
          <FieldSet>
            <FieldLegend>Tipos de Despesa</FieldLegend>
            <div className="flex flex-wrap gap-4">
              {expenseTypes.map((type) => (
                <label
                  key={type.value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedTypes.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value)}
                  />
                  {type.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Deixe vazio para incluir todos os tipos
            </p>
          </FieldSet>

          <Separator />

          {/* Status e Funcionário */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="aprovado">Apenas aprovadas</SelectItem>
                  <SelectItem value="enviado">Apenas pendentes</SelectItem>
                  <SelectItem value="rejeitado">Apenas rejeitadas</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Funcionário</FieldLabel>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button onClick={generateReport} disabled={loading}>
              {loading ? <Spinner className="mr-2 h-4 w-4" /> : <BarChart3 className="mr-2 h-4 w-4" />}
              Gerar Relatório
            </Button>
            <Button variant="outline" onClick={downloadPDF} disabled={loading || !reportData}>
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {reportData && (
        <>
          {/* Cards de resumo */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.total}</div>
                <p className="text-xs text-muted-foreground">
                  no período selecionado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(reportData.summary.totalAmount)}</div>
                <p className="text-xs text-muted-foreground">
                  soma de todas as despesas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">{reportData.summary.approved}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(reportData.summary.approvedAmount)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pendentes / Rejeitadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.summary.pending} / {reportData.summary.rejected}
                </div>
                <p className="text-xs text-muted-foreground">
                  aguardando / negadas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gr��ficos */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChart className="h-4 w-4" />
                  Despesas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={reportData.byCategory}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {reportData.byCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Por Tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Despesas por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.byType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => `R$${value/1000}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Por Mês */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `R$${value/1000}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="total" name="Valor Total" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
