'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  MapPin,
  Search,
  X,
  Loader2,
  Fuel,
  Store,
  Building2,
  Navigation,
  Star,
  Clock,
  Pencil,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  buildPlaceKey,
  matchesPlaceQuery,
  type SavedPlace,
  type UserPlacesResponse,
} from '@/lib/user-places'

const USER_PLACES_KEY = '/api/geo/user-places'

const userPlacesFetcher = async (url: string): Promise<UserPlacesResponse> => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    return { favorites: [], recents: [] }
  }
  const data = await res.json().catch(() => null)
  return {
    favorites: Array.isArray(data?.favorites) ? data.favorites : [],
    recents: Array.isArray(data?.recents) ? data.recents : [],
  }
}

// Extrai um número de logradouro digitado ao final da busca (ex: "rua dom vital, 221")
function extractHouseNumber(query: string): string {
  const match = query.match(/,?\s*(\d{1,6})\s*$/)
  return match ? match[1] : ''
}

// Remove o número ao final do nome para permitir edição limpa do campo "Número"
function stripTrailingHouseNumber(place: GeoPlace): { basePlace: GeoPlace; number: string } {
  const match = place.name.match(/,\s*(\d{1,6})$/)
  if (!match) return { basePlace: place, number: '' }
  const number = match[1]
  const baseName = place.name.slice(0, -match[0].length).trim()
  const [, ...rest] = place.label.split(' — ')
  const suffix = rest.length > 0 ? ` — ${rest.join(' — ')}` : ''
  return {
    basePlace: { ...place, name: baseName, label: `${baseName}${suffix}` },
    number,
  }
}

// Anexa o número do endereço ao nome e ao rótulo do local, sem duplicar
function applyHouseNumber(place: GeoPlace, houseNumber: string): GeoPlace {
  const n = houseNumber.trim()
  if (!n) return place

  const alreadyHas = new RegExp(`,\\s*${n}(\\D|$)`).test(place.name)
  const newName = alreadyHas ? place.name : `${place.name}, ${n}`

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
  // Edição inline de apelido de favorito
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [aliasDraft, setAliasDraft] = React.useState('')
  const [mutatingKey, setMutatingKey] = React.useState<string | null>(null)

  const inputRef = React.useRef<HTMLInputElement>(null)
  const houseNumberId = React.useId()

  const { data: userPlaces, mutate: mutateUserPlaces } = useSWR<UserPlacesResponse>(
    USER_PLACES_KEY,
    userPlacesFetcher,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  )

  const favorites = userPlaces?.favorites ?? []
  const recents = userPlaces?.recents ?? []

  const favoriteByKey = React.useMemo(() => {
    const map = new Map<string, SavedPlace>()
    for (const fav of favorites) map.set(fav.key, fav)
    return map
  }, [favorites])

  const trimmedSearch = search.trim()

  const filteredFavorites = React.useMemo(
    () => (trimmedSearch ? favorites.filter((p) => matchesPlaceQuery(p, trimmedSearch)) : favorites),
    [favorites, trimmedSearch],
  )

  const filteredRecents = React.useMemo(
    () => (trimmedSearch ? recents.filter((p) => matchesPlaceQuery(p, trimmedSearch)) : recents),
    [recents, trimmedSearch],
  )

  // Evita repetir nos resultados OSM um local que já apareceu nos blocos Favoritos/Recentes filtrados
  const filteredOsmResults = React.useMemo(() => {
    const shownKeys = new Set<string>([
      ...filteredFavorites.map((p) => p.key),
      ...filteredRecents.map((p) => p.key),
    ])
    return results.filter((place) => !shownKeys.has(buildPlaceKey(place)))
  }, [results, filteredFavorites, filteredRecents])

  // Confirma a seleção de um resultado da busca OSM
  function handleSelectSearchResult(place: GeoPlace) {
    const detected = extractHouseNumber(search)
    setSelectedPlace(place)
    setHouseNumber(detected)
    onSelect(applyHouseNumber(place, detected))
    setOpen(false)
  }

  // Confirma a seleção de um favorito ou recente (preservando o número já salvo)
  function handleSelectSavedPlace(place: SavedPlace) {
    const geo: GeoPlace = {
      id: place.id,
      name: place.name,
      label: place.label,
      lat: place.lat,
      lng: place.lng,
      city: place.city,
      state: place.state,
      type: place.type,
    }
    const { basePlace, number } = stripTrailingHouseNumber(geo)
    setSelectedPlace(basePlace)
    setHouseNumber(number)
    onSelect(geo)
    setOpen(false)
  }

  // Atualiza o número do endereço e reemite o local com o rótulo ajustado
  function handleNumberChange(nextValue: string) {
    const digits = nextValue.replace(/\D/g, '')
    setHouseNumber(digits)
    if (selectedPlace) {
      onSelect(applyHouseNumber(selectedPlace, digits))
    }
  }

  async function handleToggleFavorite(place: GeoPlace, e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    const key = buildPlaceKey(place)
    if (!key || mutatingKey === key) return

    const isFav = favoriteByKey.has(key)
    setMutatingKey(key)
    try {
      const res = isFav
        ? await fetch(`${USER_PLACES_KEY}?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
        : await fetch(USER_PLACES_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: place.name,
              label: place.label,
              lat: place.lat,
              lng: place.lng,
              city: place.city,
              state: place.state,
              type: place.type,
            }),
          })

      const updated = await res.json().catch(() => null)
      if (!res.ok) throw new Error(updated?.error || 'Erro ao atualizar favorito')
      await mutateUserPlaces(updated, false)
      if (isFav && editingKey === key) {
        setEditingKey(null)
      }
      toast.success(isFav ? 'Removido dos favoritos' : 'Adicionado aos favoritos')
    } catch (error) {
      console.error('[location-search] Erro ao alternar favorito:', error)
      toast.error('Não foi possível atualizar o favorito')
    } finally {
      setMutatingKey(null)
    }
  }

  async function handleSaveAlias(key: string) {
    if (mutatingKey === key) return
    setMutatingKey(key)
    try {
      const res = await fetch(USER_PLACES_KEY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, alias: aliasDraft.trim() || null }),
      })
      const updated = await res.json().catch(() => null)
      if (!res.ok) throw new Error(updated?.error || 'Erro ao salvar apelido')
      await mutateUserPlaces(updated, false)
      setEditingKey(null)
      setAliasDraft('')
    } catch (error) {
      console.error('[location-search] Erro ao salvar apelido:', error)
      toast.error('Não foi possível salvar o apelido')
    } finally {
      setMutatingKey(null)
    }
  }

  // Busca OSM com debounce (apenas a partir de 3 letras)
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
      setEditingKey(null)
      setAliasDraft('')
    }
  }, [open])

  // Local atual completo (com número aplicado) para permitir favoritar direto abaixo do campo
  const currentEffectivePlace = React.useMemo(
    () => (selectedPlace ? applyHouseNumber(selectedPlace, houseNumber) : null),
    [selectedPlace, houseNumber],
  )
  const currentPlaceKey = currentEffectivePlace ? buildPlaceKey(currentEffectivePlace) : ''
  const isCurrentPlaceFavorite = Boolean(currentPlaceKey && favoriteByKey.has(currentPlaceKey))

  const hasSavedMatches = filteredFavorites.length > 0 || filteredRecents.length > 0
  const showEmptyPrompt =
    trimmedSearch.length < 3 && !hasSavedMatches

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
              <MapPin
                className={cn(
                  'h-4 w-4 shrink-0',
                  coords ? 'text-green-600 dark:text-emerald-400 opacity-100' : 'opacity-50',
                )}
              />
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
                placeholder="Buscar endereço ou filtrar salvos..."
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

            <div className="max-h-[300px] overflow-y-auto">
              {/* Favoritos */}
              {filteredFavorites.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                    <span>Favoritos</span>
                  </div>
                  {filteredFavorites.map((place) => {
                    const isEditing = editingKey === place.key
                    const isBusy = mutatingKey === place.key
                    return (
                      <div
                        key={place.key}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-accent/70"
                      >
                        {isEditing ? (
                          <div
                            className="flex flex-1 items-center gap-1.5 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              value={aliasDraft}
                              onChange={(e) => setAliasDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  void handleSaveAlias(place.key)
                                } else if (e.key === 'Escape') {
                                  setEditingKey(null)
                                }
                              }}
                              placeholder="Apelido (ex: Casa, Escritório)"
                              className="h-7 text-xs"
                              maxLength={60}
                              autoFocus
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleSaveAlias(place.key)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-500/15"
                              title="Salvar apelido"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                              title="Cancelar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="flex flex-1 min-w-0 cursor-pointer select-none items-start gap-2 text-left outline-none"
                              onClick={() => handleSelectSavedPlace(place)}
                            >
                              <span className="mt-0.5">
                                <MapPin className="h-4 w-4 shrink-0 text-amber-500" />
                              </span>
                              <span className="flex flex-col min-w-0">
                                <span className="font-medium truncate">
                                  {place.alias || place.name}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {place.alias
                                    ? place.label
                                    : [place.city, place.state].filter(Boolean).join(', ') || place.label}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingKey(place.key)
                                setAliasDraft(place.alias || '')
                              }}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                              title={place.alias ? 'Editar apelido' : 'Dar um apelido'}
                              aria-label={place.alias ? 'Editar apelido' : 'Dar um apelido'}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={(e) => void handleToggleFavorite(place, e)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-amber-500 hover:bg-background"
                              title="Remover dos favoritos"
                              aria-label="Remover dos favoritos"
                            >
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Recentes (até 5) */}
              {filteredRecents.length > 0 && (
                <div className={filteredFavorites.length > 0 ? 'border-t' : undefined}>
                  <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Recentes</span>
                  </div>
                  {filteredRecents.map((place) => {
                    const isBusy = mutatingKey === place.key
                    return (
                      <div
                        key={place.key}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-accent/70"
                      >
                        <button
                          type="button"
                          className="flex flex-1 min-w-0 cursor-pointer select-none items-start gap-2 text-left outline-none"
                          onClick={() => handleSelectSavedPlace(place)}
                        >
                          <span className="mt-0.5">
                            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{place.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {[place.city, place.state].filter(Boolean).join(', ') || place.label}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => void handleToggleFavorite(place, e)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-amber-500"
                          title="Salvar nos favoritos"
                          aria-label="Salvar nos favoritos"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Resultados da busca OSM (>= 3 letras) */}
              {trimmedSearch.length >= 3 && (
                <div className={hasSavedMatches ? 'border-t' : undefined}>
                  {hasSavedMatches && (
                    <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                      <Search className="h-3 w-3" />
                      <span>Resultados da busca</span>
                    </div>
                  )}
                  {loading && filteredOsmResults.length === 0 ? (
                    <div className="py-5 text-center text-sm text-muted-foreground">Buscando...</div>
                  ) : filteredOsmResults.length === 0 && !hasSavedMatches ? (
                    <div className="py-5 text-center text-sm text-muted-foreground">
                      Nenhum local encontrado.
                    </div>
                  ) : (
                    filteredOsmResults.map((place) => {
                      const placeWithNum = applyHouseNumber(place, extractHouseNumber(search))
                      const key = buildPlaceKey(placeWithNum)
                      const isFav = favoriteByKey.has(key)
                      const isBusy = mutatingKey === key
                      return (
                        <div
                          key={place.id ?? `${place.lat}-${place.lng}`}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-accent/70"
                        >
                          <button
                            type="button"
                            className="flex flex-1 min-w-0 cursor-pointer select-none items-start gap-2 text-left outline-none"
                            onClick={() => handleSelectSearchResult(place)}
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
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={(e) => void handleToggleFavorite(placeWithNum, e)}
                            className={cn(
                              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-background',
                              isFav ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500',
                            )}
                            title={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                            aria-label={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                          >
                            <Star
                              className={cn(
                                'h-3.5 w-3.5',
                                isFav && 'fill-amber-400 text-amber-500',
                              )}
                            />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Estado inicial sem salvos ou texto curto sem correspondência */}
              {showEmptyPrompt && (
                <div className="py-6 px-3 text-center text-sm text-muted-foreground">
                  {trimmedSearch.length > 0
                    ? 'Digite ao menos 3 letras para buscar novos endereços.'
                    : 'Digite o nome de um estabelecimento, rua ou ponto de referência.'}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
              <Navigation className="h-3 w-3" />
              Dados de localização por OpenStreetMap
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedPlace && currentEffectivePlace && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={houseNumberId} className="text-xs text-muted-foreground whitespace-nowrap">
            Número
          </Label>
          <Input
            id={houseNumberId}
            value={houseNumber}
            onChange={(e) => handleNumberChange(e.target.value)}
            placeholder="Ex: 221"
            inputMode="numeric"
            autoComplete="off"
            className="h-9 w-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={mutatingKey === currentPlaceKey}
            onClick={(e) => void handleToggleFavorite(currentEffectivePlace, e)}
            className={cn(
              'h-9 gap-1.5 px-2.5 text-xs',
              isCurrentPlaceFavorite
                ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Star
              className={cn(
                'h-3.5 w-3.5',
                isCurrentPlaceFavorite && 'fill-amber-400 text-amber-500',
              )}
            />
            {isCurrentPlaceFavorite ? 'Favorito' : 'Favoritar'}
          </Button>
        </div>
      )}
    </div>
  )
}
