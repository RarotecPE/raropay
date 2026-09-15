'use client'

import * as React from 'react'
import { MapPin, Search, X, Loader2, Fuel, Store, Building2, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Extrai um número de logradouro digitado ao final da busca (ex: "rua dom vital, 221")
function extractHouseNumber(query: string): string {
  const match = query.match(/,?\s*(\d{1,6})\s*$/)
  return match ? match[1] : ''
}

// Anexa o número do endereço ao nome e ao rótulo do local, sem duplicar
function applyHouseNumber(place: GeoPlace, houseNumber: string): GeoPlace {
  const n = houseNumber.trim()
  if (!n) return place

  // Evita duplicar se o número já estiver presente no nome
  const alreadyHas = new RegExp(`,\\s*${n}(\\D|$)`).test(place.name)
  const newName = alreadyHas ? place.name : `${place.name}, ${n}`

  // O label segue o formato "Nome — cidade, UF"; preserva o sufixo após " — "
  const [, ...rest] = place.label.split(' — ')
  const suffix = rest.length > 0 ? ` — ${rest.join(' — ')}` : ''
  const newLabel = `${newName}${suffix}`

  return { ...place, name: newName, label: newLabel }
}

export interface GeoPlace {
  id?: string
  name: string
  label: string
  lat: number
  lng: number
  city: string
  state: string
  type: string
}

interface LocationSearchProps {
  value: string // rótulo atual selecionado (para exibição)
  onSelect: (place: GeoPlace) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  // Coordenadas do local atualmente selecionado (indicação visual de "confirmado")
  coords?: { lat: number; lng: number } | null
  // Viés opcional de localização (ex: coordenadas da partida) para priorizar resultados próximos
  biasLat?: number | null
  biasLng?: number | null
}

// Ícone conforme o tipo de local retornado pelo OSM
function TypeIcon({ type }: { type: string }) {
  if (type === 'fuel') return <Fuel className="h-4 w-4 shrink-0 text-muted-foreground" />
  if (['restaurant', 'cafe', 'fast_food', 'supermarket', 'shop'].includes(type))
    return <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
  if (['hotel', 'commercial', 'office', 'industrial'].includes(type))
    return <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
  return <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
}

export function LocationSearch({
  value,
  onSelect,
  onClear,
  placeholder = 'Buscar endereço ou estabelecimento...',
  disabled = false,
  coords,
  biasLat,
  biasLng,
}: LocationSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<GeoPlace[]>([])
  const [loading, setLoading] = React.useState(false)
  // Local base selecionado nesta sessão (sem o número) para permitir editar o número depois
  const [selectedPlace, setSelectedPlace] = React.useState<GeoPlace | null>(null)
  const [houseNumber, setHouseNumber] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Confirma a seleção de um local, aplicando o número (detectado na busca) ao endereço
  function handleSelect(place: GeoPlace) {
    const detected = extractHouseNumber(search)
    setSelectedPlace(place)
    setHouseNumber(detected)
    onSelect(applyHouseNumber(place, detected))
    setOpen(false)
  }

  // Atualiza o número do endereço e reemite o local com o rótulo ajustado
  function handleNumberChange(value: string) {
    const digits = value.replace(/\D/g, '')
    setHouseNumber(digits)
    if (selectedPlace) {
      onSelect(applyHouseNumber(selectedPlace, digits))
    }
  }

  // Busca com debounce
  React.useEffect(() => {
    const term = search.trim()
    if (term.length < 3) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term })
        if (typeof biasLat === 'number' && typeof biasLng === 'number') {
          params.set('lat', String(biasLat))
          params.set('lon', String(biasLng))
        }
        const res = await fetch(`/api/geo/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (Array.isArray(data)) setResults(data)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[v0] Erro na busca de local:', error)
        }
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [search, biasLat, biasLng])

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setSearch('')
      setResults([])
    }
  }, [open])

  return (
    <div className="space-y-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-11 sm:h-10"
          disabled={disabled}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className={cn('h-4 w-4 shrink-0', coords ? 'text-green-600 dark:text-emerald-400 opacity-100' : 'opacity-50')} />
            {value ? (
              <span className="truncate">{value}</span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </span>
          {value && onClear ? (
            <X
              className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPlace(null)
                setHouseNumber('')
                onClear()
              }}
            />
          ) : (
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              placeholder="Digite ao menos 3 letras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />}
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {search.trim().length < 3 ? (
              <div className="py-6 px-3 text-center text-sm text-muted-foreground">
                Digite o nome de um estabelecimento, rua ou ponto de referência.
              </div>
            ) : loading && results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum local encontrado.
              </div>
            ) : (
              results.map((place) => (
                <button
                  type="button"
                  key={place.id ?? `${place.lat}-${place.lng}`}
                  className={cn(
                    'flex w-full cursor-pointer select-none items-start gap-2 px-3 py-2.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => handleSelect(place)}
                >
                  <span className="mt-0.5">
                    <TypeIcon type={place.type} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{place.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[place.city, place.state].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            <Navigation className="h-3 w-3" />
            Dados de localização por OpenStreetMap
          </div>
        </div>
      </PopoverContent>
    </Popover>

    {selectedPlace && (
      <div className="flex items-center gap-2">
        <Label htmlFor="house-number" className="text-xs text-muted-foreground whitespace-nowrap">
          Número
        </Label>
        <Input
          id="house-number"
          value={houseNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder="Ex: 221"
          inputMode="numeric"
          autoComplete="off"
          className="h-9 w-28"
        />
        <span className="text-xs text-muted-foreground">Opcional, se o local não tiver número exato.</span>
      </div>
    )}
    </div>
  )
}
