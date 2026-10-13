export interface PaginationParams {
  page: number
  pageSize: number
  offset: number
  limit: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface PaginatedResponse<T, S = Record<string, any>> {
  data: T[]
  pagination: PaginationMeta
  summary?: S
}

/**
 * Lê e sanitiza page e pageSize da URLSearchParams
 */
export function parsePaginationParams(
  searchParams: { get: (name: string) => string | null },
  defaultPageSize: number = 15,
  maxPageSize: number = 100
): PaginationParams {
  const pageParam = searchParams.get('page')
  const pageSizeParam = searchParams.get('pageSize') || searchParams.get('limit')

  const parsedPage = pageParam ? parseInt(pageParam, 10) : 1
  const parsedPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : defaultPageSize

  const page = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const pageSize =
    isNaN(parsedPageSize) || parsedPageSize < 1
      ? defaultPageSize
      : Math.min(parsedPageSize, maxPageSize)

  const offset = (page - 1) * pageSize
  const limit = pageSize

  return { page, pageSize, offset, limit }
}

/**
 * Monta os metadados de paginação com cálculo correto de totalPages
 */
export function buildPaginationMeta(
  totalCount: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const safeTotal = Math.max(0, totalCount)
  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / pageSize)
  return {
    page: Math.max(1, Math.min(page, totalPages)),
    pageSize,
    totalCount: safeTotal,
    totalPages,
  }
}

