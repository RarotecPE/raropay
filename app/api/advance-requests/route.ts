import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getBooleanSetting } from "@/lib/settings"
import { SETTING_ADVANCE_PIX_ENABLED } from "@/lib/advance-constants"

import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination"

// GET - Listar solicitações de adiantamento
// Financeiro e Admin vêem todas; funcionário vê apenas as suas
export async function GET(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("pageSize") || searchParams.get("limit")
    const shouldPaginate = Boolean(pageParam || pageSizeParam || searchParams.get("paginate") === "true")
    const { page, pageSize, offset, limit } = parsePaginationParams(searchParams, 10)

    let requests

    if (shouldPaginate) {
      if (user.role === "financial" || user.role === "admin") {
        requests = await sql`
          SELECT ar.*,
                 u.name as employee_name,
                 u.department as employee_department,
                 rev.name as reviewed_by_name,
                 (SELECT COUNT(*) FROM advance_request_messages m WHERE m.request_id = ar.id) as message_count,
                 COUNT(*) OVER()::int as full_count
          FROM advance_requests ar
          JOIN users u ON u.id = ar.user_id
          LEFT JOIN users rev ON rev.id = ar.reviewed_by
          ORDER BY ar.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      } else {
        requests = await sql`
          SELECT ar.*,
                 u.name as employee_name,
                 u.department as employee_department,
                 rev.name as reviewed_by_name,
                 (SELECT COUNT(*) FROM advance_request_messages m WHERE m.request_id = ar.id) as message_count,
                 COUNT(*) OVER()::int as full_count
          FROM advance_requests ar
          JOIN users u ON u.id = ar.user_id
          LEFT JOIN users rev ON rev.id = ar.reviewed_by
          WHERE ar.user_id = ${user.id}
          ORDER BY ar.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      }

      const totalItems = requests.length > 0 ? (requests[0] as any).full_count : 0
      const pagination = buildPaginationMeta(totalItems, page, pageSize)
      const data = requests.map(({ full_count, ...r }) => r)

      return NextResponse.json({
        data,
        pagination
      })
    }

    if (user.role === "financial" || user.role === "admin") {
      requests = await sql`
        SELECT ar.*,
               u.name as employee_name,
               u.department as employee_department,
               rev.name as reviewed_by_name,
               (SELECT COUNT(*) FROM advance_request_messages m WHERE m.request_id = ar.id) as message_count
        FROM advance_requests ar
        JOIN users u ON u.id = ar.user_id
        LEFT JOIN users rev ON rev.id = ar.reviewed_by
        ORDER BY ar.created_at DESC
      `
    } else {
      requests = await sql`
        SELECT ar.*,
               u.name as employee_name,
               u.department as employee_department,
               rev.name as reviewed_by_name,
               (SELECT COUNT(*) FROM advance_request_messages m WHERE m.request_id = ar.id) as message_count
        FROM advance_requests ar
        JOIN users u ON u.id = ar.user_id
        LEFT JOIN users rev ON rev.id = ar.reviewed_by
        WHERE ar.user_id = ${user.id}
        ORDER BY ar.created_at DESC
      `
    }

    return NextResponse.json(requests)
  } catch (error) {
    console.error("Erro ao buscar solicitações de adiantamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// POST - Criar nova solicitação de adiantamento (qualquer usuário autenticado)
export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const {
      amount,
      payment_method,
      categories,
      reason,
      city,
      usage_start,
      usage_end,
      boleto_code,
    } = body

    // Validações básicas
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json({ error: "Informe um valor válido" }, { status: 400 })
    }
    if (!["pix", "bank_account", "boleto"].includes(payment_method)) {
      return NextResponse.json({ error: "Método de recebimento inválido" }, { status: 400 })
    }

    // PIX só é permitido se o administrador tiver habilitado nas configurações
    if (payment_method === "pix") {
      const pixEnabled = await getBooleanSetting(SETTING_ADVANCE_PIX_ENABLED, false)
      if (!pixEnabled) {
        return NextResponse.json({ error: "O recebimento via PIX não está habilitado" }, { status: 400 })
      }
    }

    // Categorias (múltiplas, ao menos uma)
    const categoryList = Array.isArray(categories) ? categories.filter((c: unknown) => typeof c === "string" && c) : []
    if (categoryList.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um tipo de despesa" }, { status: 400 })
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "Informe o motivo/objetivo" }, { status: 400 })
    }

    // Boleto exige o código
    if (payment_method === "boleto" && (!boleto_code || !String(boleto_code).trim())) {
      return NextResponse.json({ error: "Informe o código do boleto" }, { status: 400 })
    }

    // Buscar dados bancários salvos no perfil (snapshot na solicitação)
    const bankingRows = await sql`
      SELECT pix_key, bank_agency, bank_account FROM users WHERE id = ${user.id}
    `
    const banking = bankingRows[0] || {}

    if (payment_method === "pix" && !banking.pix_key) {
      return NextResponse.json(
        { error: "Cadastre sua chave PIX no perfil antes de solicitar por PIX" },
        { status: 400 }
      )
    }
    if (payment_method === "bank_account" && (!banking.bank_agency || !banking.bank_account)) {
      return NextResponse.json(
        { error: "Cadastre sua agência e conta no perfil antes de solicitar por conta-corrente" },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO advance_requests (
        user_id, amount, payment_method,
        pix_key, bank_agency, bank_account, boleto_code,
        category, categories, reason, city, usage_start, usage_end, status
      ) VALUES (
        ${user.id}, ${numericAmount}, ${payment_method},
        ${payment_method === "pix" ? banking.pix_key : null},
        ${payment_method === "bank_account" ? banking.bank_agency : null},
        ${payment_method === "bank_account" ? banking.bank_account : null},
        ${payment_method === "boleto" ? String(boleto_code).trim() : null},
        ${categoryList[0]}, ${categoryList}, ${reason.trim()}, ${city || null},
        ${usage_start || null}, ${usage_end || null}, 'pending'
      )
      RETURNING *
    `

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("Erro ao criar solicitação de adiantamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
