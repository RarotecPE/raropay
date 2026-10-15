'use client'

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface PaginationControlProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalCount: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  itemName?: string
  className?: string
  disabled?: boolean
}

export function PaginationControl({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  pageSizeOptions = [15, 30, 50],
  onPageChange,
  onPageSizeChange,
  itemName = 'itens',
  className,
  disabled = false,
}: PaginationControlProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const shouldScrollToBottomRef = React.useRef(false)
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const safeTotalPages = Math.max(1, totalPages)
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages)

  const startItem = totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
  const endItem = totalCount === 0 ? 0 : Math.min(safeCurrentPage * pageSize, totalCount)

  const triggerScrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (typeof window === 'undefined') return
    requestAnimationFrame(() => {
      try {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({
            behavior,
            block: 'end',
            inline: 'nearest',
          })
        }
        const scrollHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        )
        window.scrollTo({
          top: scrollHeight,
          behavior,
        })
      } catch {
        try {
          window.scrollTo(0, document.body.scrollHeight)
        } catch {
          // ignore
        }
      }
    })
  }, [])

  const handlePageChange = React.useCallback(
    (newPage: number, scrollToBottom = true) => {
      if (disabled || newPage === safeCurrentPage) return

      if (scrollToBottom) {
        shouldScrollToBottomRef.current = true

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }

        scrollTimeoutRef.current = setTimeout(() => {
          shouldScrollToBottomRef.current = false
        }, 1200)

        triggerScrollToBottom('smooth')
      } else {
        shouldScrollToBottomRef.current = false
      }

      onPageChange(newPage)
    },
    [disabled, safeCurrentPage, onPageChange, triggerScrollToBottom]
  )

  // Cancela o scroll automático se o usuário interagir manualmente rolando para cima
  React.useEffect(() => {
    const handleUserScroll = (e: Event) => {
      if (e instanceof WheelEvent && e.deltaY < 0) {
        shouldScrollToBottomRef.current = false
      } else if (e.type === 'touchmove') {
        shouldScrollToBottomRef.current = false
      }
    }

    window.addEventListener('wheel', handleUserScroll, { passive: true })
    window.addEventListener('touchmove', handleUserScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleUserScroll)
      window.removeEventListener('touchmove', handleUserScroll)
    }
  }, [])

  // Dispara scroll quando a página ou dados mudam durante a navegação
  React.useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      triggerScrollToBottom('smooth')

      const t1 = setTimeout(() => {
        if (shouldScrollToBottomRef.current) triggerScrollToBottom('smooth')
      }, 100)
      const t2 = setTimeout(() => {
        if (shouldScrollToBottomRef.current) triggerScrollToBottom('smooth')
      }, 300)
      const t3 = setTimeout(() => {
        if (shouldScrollToBottomRef.current) triggerScrollToBottom('smooth')
      }, 600)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [safeCurrentPage, totalCount, disabled, triggerScrollToBottom])

  // Observa mudanças de dimensões no corpo da página durante a transição
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return

    let lastHeight = document.body.scrollHeight

    const resizeObserver = new ResizeObserver(() => {
      if (shouldScrollToBottomRef.current) {
        const currentHeight = document.body.scrollHeight
        if (currentHeight !== lastHeight) {
          lastHeight = currentHeight
          triggerScrollToBottom('smooth')
        }
      }
    })

    resizeObserver.observe(document.body)

    return () => {
      resizeObserver.disconnect()
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [triggerScrollToBottom])

  // Gerar números de páginas com reticências
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const delta = 1 // quantidade de páginas adjacentes à página atual

    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    pages.push(1)

    const leftBound = safeCurrentPage - delta
    const rightBound = safeCurrentPage + delta

    if (leftBound > 2) {
      pages.push('ellipsis')
    }

    const start = Math.max(2, leftBound)
    const end = Math.min(safeTotalPages - 1, rightBound)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (rightBound < safeTotalPages - 1) {
      pages.push('ellipsis')
    }

    pages.push(safeTotalPages)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-sm select-none',
        className
      )}
    >
      {/* Lado Esquerdo: Resumo de itens e Seletor de tamanho */}
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <div>
          {totalCount === 0 ? (
            <span>Nenhum {itemName} encontrado</span>
          ) : (
            <span>
              Exibindo <strong className="text-foreground font-semibold">{startItem}</strong> a{' '}
              <strong className="text-foreground font-semibold">{endItem}</strong> de{' '}
              <strong className="text-foreground font-semibold">{totalCount}</strong> {itemName}
            </span>
          )}
        </div>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-xs hidden md:inline">Por pág:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                const nextSize = Number(val)
                onPageSizeChange(nextSize)
              }}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="h-8 w-[72px] text-xs">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)} className="text-xs">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Lado Direito: Navegação entre páginas */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        {/* Primeira Página */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 hidden md:inline-flex"
          onClick={() => handlePageChange(1, false)}
          disabled={disabled || safeCurrentPage <= 1}
          title="Primeira página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Anterior */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 text-xs gap-1"
          onClick={() => handlePageChange(safeCurrentPage - 1, true)}
          disabled={disabled || safeCurrentPage <= 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Números de Página */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <div
                  key={`ellipsis-${idx}`}
                  className="h-8 w-8 flex items-center justify-center text-muted-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </div>
              )
            }

            const isActive = p === safeCurrentPage
            return (
              <Button
                key={p}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-8 w-8 p-0 text-xs font-medium', isActive && 'pointer-events-none')}
                onClick={() => handlePageChange(p, true)}
                disabled={disabled}
              >
                {p}
              </Button>
            )
          })}
        </div>

        {/* Próxima */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 text-xs gap-1"
          onClick={() => handlePageChange(safeCurrentPage + 1, true)}
          disabled={disabled || safeCurrentPage >= safeTotalPages}
        >
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>

        {/* Última Página */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 hidden md:inline-flex"
          onClick={() => handlePageChange(safeTotalPages, true)}
          disabled={disabled || safeCurrentPage >= safeTotalPages}
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

