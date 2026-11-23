export interface SavedPlace {
  id: string
  key: string
  name: string
  label: string
  alias?: string | null
  lat: number
  lng: number
  city: string
  state: string
  type: string
  createdAt?: string
}

export interface UserPlacesResponse {
  favorites: SavedPlace[]
  recents: SavedPlace[]
}

export interface ExpenseAddressRow {
  id?: number
  origin_place?: string | null
  origin_lat?: number | string | null
  origin_lng?: number | string | null
  departure_city?: string | null
  departure_state?: string | null
  origin?: string | null
  destination_place?: string | null
  destination_lat?: number | string | null
  destination_lng?: number | string | null
  arrival_city?: string | null
  arrival_state?: string | null
  destination?: string | null
  stops?: unknown
  created_at?: string | Date | null
  updated_at?: string | Date | null
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildPlaceKey(place: {
  label?: string | null
  name?: string | null
  city?: string | null
  state?: string | null
}): string {
  const base = (place.label || '').trim() || [place.name, place.city, place.state].filter(Boolean).join(', ')
  return normalizeText(base).slice(0, 240)
}

function parseNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseCityStateFallback(
  city?: string | null,
  state?: string | null,
  citySlashState?: string | null,
  label?: string | null,
): { city: string; state: string } {
  let resolvedCity = (city || '').trim()
  let resolvedState = (state || '').trim().toUpperCase()

  if ((!resolvedCity || !resolvedState) && citySlashState) {
    const parts = citySlashState.split('/').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      if (!resolvedCity) resolvedCity = parts[0]
      if (!resolvedState) resolvedState = parts[1].toUpperCase()
    }
  }

  if ((!resolvedCity || !resolvedState) && label && label.includes(' — ')) {
    const suffix = label.split(' — ').slice(1).join(' — ')
    const chunks = suffix.split(',').map((p) => p.trim()).filter(Boolean)
    if (chunks.length >= 2) {
      const last = chunks[chunks.length - 1]
      if (!resolvedState && /^[A-Za-z]{2}$/.test(last)) {
        resolvedState = last.toUpperCase()
      }
      if (!resolvedCity) {
        resolvedCity = chunks[chunks.length - 2] || ''
      }
    }
  }

  return { city: resolvedCity, state: resolvedState }
}

function extractNameFromLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return 'Local'
  return trimmed.split(' — ')[0].trim() || trimmed
}

function parseStops(raw: unknown): Array<{
  place?: string | null
  lat?: number | string | null
  lng?: number | string | null
  municipality?: string | null
  state?: string | null
}> {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * Extrai os últimos `limit` endereços únicos utilizados pelo usuário a partir das despesas salvas,
 * ignorando locais já presentes em `excludeKeys` (ex: favoritos).
 */
export function extractRecentPlacesFromExpenses(
  rows: ExpenseAddressRow[],
  excludeKeys: Set<string>,
  limit = 5,
): SavedPlace[] {
  const recents: SavedPlace[] = []
  const seen = new Set<string>(excludeKeys)

  const pushCandidate = (candidate: {
    place?: string | null
    lat?: unknown
    lng?: unknown
    city?: string | null
    state?: string | null
    citySlashState?: string | null
    timestamp?: string | Date | null
  }) => {
    if (recents.length >= limit) return
    const label = (candidate.place || '').trim()
    if (!label) return

    const lat = parseNumber(candidate.lat)
    const lng = parseNumber(candidate.lng)
    if (lat === null || lng === null) return

    const { city, state } = parseCityStateFallback(
      candidate.city,
      candidate.state,
      candidate.citySlashState,
      label,
    )
    const name = extractNameFromLabel(label)
    const key = buildPlaceKey({ label, name, city, state })
    if (!key || seen.has(key)) return

    seen.add(key)
    recents.push({
      id: `recent-${key}`,
      key,
      name,
      label,
      alias: null,
      lat,
      lng,
      city,
      state,
      type: 'place',
      createdAt: candidate.timestamp ? String(candidate.timestamp) : undefined,
    })
  }

  for (const row of rows) {
    if (recents.length >= limit) break
    const ts = row.updated_at || row.created_at || null

    pushCandidate({
      place: row.destination_place,
      lat: row.destination_lat,
      lng: row.destination_lng,
      city: row.arrival_city,
      state: row.arrival_state,
      citySlashState: row.destination,
      timestamp: ts,
    })

    const stops = parseStops(row.stops)
    for (let i = stops.length - 1; i >= 0; i--) {
      if (recents.length >= limit) break
      const stop = stops[i]
      pushCandidate({
        place: stop?.place,
        lat: stop?.lat,
        lng: stop?.lng,
        city: stop?.municipality,
        state: stop?.state,
        timestamp: ts,
      })
    }

    pushCandidate({
      place: row.origin_place,
      lat: row.origin_lat,
      lng: row.origin_lng,
      city: row.departure_city,
      state: row.departure_state,
      citySlashState: row.origin,
      timestamp: ts,
    })
  }

  return recents
}

export function matchesPlaceQuery(place: SavedPlace, query: string): boolean {
  const q = normalizeText(query)
  if (!q) return true
  const haystack = normalizeText(
    [place.alias, place.name, place.label, place.city, place.state].filter(Boolean).join(' '),
  )
  return haystack.includes(q)
}
