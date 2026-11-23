import { sql } from '@/lib/db'
import { getSetting, setSetting } from '@/lib/settings'
import {
  buildPlaceKey,
  extractRecentPlacesFromExpenses,
  type ExpenseAddressRow,
  type SavedPlace,
  type UserPlacesResponse,
} from '@/lib/user-places'

const MAX_RECENT_PLACES = 5
const MAX_FAVORITE_PLACES = 30
const TABLE_CACHE_FALSE_TTL_MS = 60_000

let hasFavoritesTableCache: { value: boolean; checkedAt: number } | null = null

async function hasFavoritesTable(): Promise<boolean> {
  if (hasFavoritesTableCache) {
    if (hasFavoritesTableCache.value) return true
    if (Date.now() - hasFavoritesTableCache.checkedAt < TABLE_CACHE_FALSE_TTL_MS) {
      return false
    }
  }

  try {
    const rows = (await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'user_favorite_places'
      ) AS exists
    `) as { exists: boolean }[]
    const exists = Boolean(rows[0]?.exists)
    hasFavoritesTableCache = { value: exists, checkedAt: Date.now() }
    return exists
  } catch (error) {
    console.error('[user-places] Erro ao verificar tabela user_favorite_places:', error)
    return false
  }
}

function getFallbackKey(userId: number): string {
  return `favorite_places_user_${userId}`
}

function sanitizeAlias(alias?: string | null): string | null {
  if (!alias) return null
  const trimmed = alias.trim().slice(0, 60)
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeFavoriteRecord(raw: any): SavedPlace | null {
  if (!raw || typeof raw !== 'object') return null
  const label = String(raw.label || '').trim()
  const name = String(raw.name || '').trim() || label.split(' — ')[0]?.trim() || ''
  const lat = Number(raw.lat)
  const lng = Number(raw.lng)
  if (!label || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const city = String(raw.city || '').trim()
  const state = String(raw.state || '').trim().toUpperCase().slice(0, 10)
  const key = String(raw.key || raw.place_key || buildPlaceKey({ label, name, city, state })).trim()
  if (!key) return null

  return {
    id: String(raw.id || `fav-${key}`),
    key,
    name,
    label,
    alias: sanitizeAlias(raw.alias),
    lat,
    lng,
    city,
    state,
    type: String(raw.type || 'place').slice(0, 60),
    createdAt: raw.created_at ? String(raw.created_at) : raw.createdAt ? String(raw.createdAt) : undefined,
  }
}

async function listFavoritesFromFallback(userId: number): Promise<SavedPlace[]> {
  try {
    const raw = await getSetting(getFallbackKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeFavoriteRecord).filter((item): item is SavedPlace => item !== null)
  } catch {
    return []
  }
}

async function saveFavoritesToFallback(userId: number, favorites: SavedPlace[]): Promise<void> {
  await setSetting(getFallbackKey(userId), JSON.stringify(favorites.slice(0, MAX_FAVORITE_PLACES)), userId)
}

export async function listUserFavoritePlaces(userId: number): Promise<SavedPlace[]> {
  if (await hasFavoritesTable()) {
    const rows = await sql`
      SELECT id, place_key, alias, name, label, lat, lng, city, state, type, created_at
      FROM user_favorite_places
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC, id DESC
      LIMIT ${MAX_FAVORITE_PLACES}
    `
    return rows
      .map((row: any) =>
        sanitizeFavoriteRecord({
          id: `fav-${row.id}`,
          key: row.place_key,
          alias: row.alias,
          name: row.name,
          label: row.label,
          lat: row.lat,
          lng: row.lng,
          city: row.city,
          state: row.state,
          type: row.type,
          created_at: row.created_at,
        }),
      )
      .filter((item): item is SavedPlace => item !== null)
  }

  return listFavoritesFromFallback(userId)
}

export async function getUserPlaces(userId: number): Promise<UserPlacesResponse> {
  const favorites = await listUserFavoritePlaces(userId)
  const favoriteKeys = new Set(favorites.map((f) => f.key))

  let expenseRows: ExpenseAddressRow[] = []
  try {
    expenseRows = (await sql`
      SELECT
        id,
        origin_place, origin_lat, origin_lng, departure_city, departure_state, origin,
        destination_place, destination_lat, destination_lng, arrival_city, arrival_state, destination,
        stops, created_at, updated_at
      FROM expenses
      WHERE user_id = ${userId}
        AND (
          origin_place IS NOT NULL
          OR destination_place IS NOT NULL
          OR stops IS NOT NULL
        )
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      LIMIT 60
    `) as unknown as ExpenseAddressRow[]
  } catch (error) {
    console.error('[user-places] Erro ao carregar histórico de endereços das despesas:', error)
    expenseRows = []
  }

  const recents = extractRecentPlacesFromExpenses(expenseRows, favoriteKeys, MAX_RECENT_PLACES)
  return { favorites, recents }
}

export interface UpsertFavoritePlaceInput {
  name: string
  label: string
  lat: number
  lng: number
  city?: string
  state?: string
  type?: string
  alias?: string | null
}

export async function upsertUserFavoritePlace(
  userId: number,
  input: UpsertFavoritePlaceInput,
): Promise<UserPlacesResponse> {
  const label = String(input.label || '').trim()
  const name = String(input.name || '').trim() || label.split(' — ')[0]?.trim() || 'Local'
  const lat = Number(input.lat)
  const lng = Number(input.lng)
  const city = String(input.city || '').trim()
  const state = String(input.state || '').trim().toUpperCase().slice(0, 10)
  const type = String(input.type || 'place').slice(0, 60)
  const alias = sanitizeAlias(input.alias)

  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Endereço inválido para favoritar')
  }

  const key = buildPlaceKey({ label, name, city, state })
  if (!key) {
    throw new Error('Chave do endereço inválida')
  }

  if (await hasFavoritesTable()) {
    await sql`
      INSERT INTO user_favorite_places (
        user_id, place_key, alias, name, label, lat, lng, city, state, type
      ) VALUES (
        ${userId}, ${key}, ${alias}, ${name}, ${label}, ${lat}, ${lng}, ${city}, ${state}, ${type}
      )
      ON CONFLICT (user_id, place_key) DO UPDATE
      SET name = EXCLUDED.name,
          label = EXCLUDED.label,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          type = EXCLUDED.type,
          alias = COALESCE(EXCLUDED.alias, user_favorite_places.alias),
          updated_at = NOW()
    `
  } else {
    const existing = await listFavoritesFromFallback(userId)
    const prev = existing.find((item) => item.key === key)
    const nextItem: SavedPlace = {
      id: prev?.id || `fav-${key}`,
      key,
      name,
      label,
      alias: alias ?? prev?.alias ?? null,
      lat,
      lng,
      city,
      state,
      type,
      createdAt: new Date().toISOString(),
    }
    const filtered = existing.filter((item) => item.key !== key)
    await saveFavoritesToFallback(userId, [nextItem, ...filtered])
  }

  return getUserPlaces(userId)
}

export async function renameUserFavoritePlace(
  userId: number,
  placeKey: string,
  alias: string | null,
): Promise<UserPlacesResponse> {
  const key = String(placeKey || '').trim()
  if (!key) throw new Error('Endereço não informado')
  const cleanAlias = sanitizeAlias(alias)

  if (await hasFavoritesTable()) {
    await sql`
      UPDATE user_favorite_places
      SET alias = ${cleanAlias}, updated_at = NOW()
      WHERE user_id = ${userId} AND place_key = ${key}
    `
  } else {
    const existing = await listFavoritesFromFallback(userId)
    const updated = existing.map((item) =>
      item.key === key ? { ...item, alias: cleanAlias } : item,
    )
    await saveFavoritesToFallback(userId, updated)
  }

  return getUserPlaces(userId)
}

export async function removeUserFavoritePlace(
  userId: number,
  placeKey: string,
): Promise<UserPlacesResponse> {
  const key = String(placeKey || '').trim()
  if (!key) throw new Error('Endereço não informado')

  if (await hasFavoritesTable()) {
    await sql`
      DELETE FROM user_favorite_places
      WHERE user_id = ${userId} AND place_key = ${key}
    `
  } else {
    const existing = await listFavoritesFromFallback(userId)
    await saveFavoritesToFallback(
      userId,
      existing.filter((item) => item.key !== key),
    )
  }

  return getUserPlaces(userId)
}
