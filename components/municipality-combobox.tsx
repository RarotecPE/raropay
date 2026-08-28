'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Municipality {
  id: number
  name: string
}

interface MunicipalityComboboxProps {
  value: string
  onValueChange: (value: string) => void
  municipalities: Municipality[]
  disabled?: boolean
  loading?: boolean
  placeholder?: string
}

export function MunicipalityCombobox({
  value,
  onValueChange,
  municipalities,
  disabled = false,
  loading = false,
  placeholder = 'Selecione o município',
}: MunicipalityComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Filtrar municípios baseado na pesquisa
  const filteredMunicipalities = React.useMemo(() => {
    if (!search.trim()) return municipalities
    const searchLower = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return municipalities.filter((mun) => {
      const nameLower = mun.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return nameLower.includes(searchLower)
    })
  }, [municipalities, search])

  // Focar no input quando o popover abrir
  React.useEffect(() => {
    if (open && inputRef.current) {
      // Pequeno delay para garantir que o popover esteja visível
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      setSearch('')
    }
  }, [open])

  const selectedMunicipality = municipalities.find((mun) => mun.name === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {loading ? (
            'Carregando...'
          ) : value ? (
            selectedMunicipality?.name || value
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-col">
          {/* Campo de pesquisa com input real para acionar teclado mobile */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              placeholder="Pesquisar município..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              // Atributos importantes para mobile
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
            />
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Lista de municípios */}
          <div className="max-h-[200px] overflow-y-auto">
            {filteredMunicipalities.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum município encontrado.
              </div>
            ) : (
              filteredMunicipalities.map((mun) => (
                <div
                  key={mun.id}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === mun.name && 'bg-accent'
                  )}
                  onClick={() => {
                    onValueChange(mun.name)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === mun.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {mun.name}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
