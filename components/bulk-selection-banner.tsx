'use client'

import * as React from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface BulkSelectionBannerProps {
  selectedCount: number
  pageCount: number
  totalCount: number
  isAllMatchingSelected: boolean
  onSelectAllMatching?: () => void
  onClearSelection: () => void
  itemName?: string
  className?: string
}

export function BulkSelectionBanner({
  selectedCount,
  pageCount,
  totalCount,
  isAllMatchingSelected,
  onSelectAllMatching,
  onClearSelection,
  itemName = 'despesas',
  className,
}: BulkSelectionBannerProps) {
  if (selectedCount === 0) return null

  const hasMoreAcrossPages = totalCount > pageCount && onSelectAllMatching

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg border bg-blue-50/80 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200 text-sm transition-all animate-in fade-in slide-in-from-top-1 duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        {isAllMatchingSelected ? (
          <span>
            Todas as <strong>{totalCount}</strong> {itemName} deste filtro estão selecionadas.
          </span>
        ) : (
          <span>
            <strong>{selectedCount}</strong> {itemName} selecionada(s) nesta página.
            {hasMoreAcrossPages && (
              <span className="hidden md:inline ml-1 text-muted-foreground dark:text-blue-300/80">
                (Total de {totalCount} correspondentes)
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isAllMatchingSelected && hasMoreAcrossPages && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSelectAllMatching}
            className="h-7 text-xs bg-white dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-800 dark:text-blue-100 font-medium"
          >
            Selecionar todas as {totalCount} {itemName}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-7 px-2 text-xs text-blue-700 hover:text-blue-950 hover:bg-blue-200/50 dark:text-blue-300 dark:hover:bg-blue-900/50 gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>Limpar seleção</span>
        </Button>
      </div>
    </div>
  )
}

