import { type NextRequest, NextResponse } from 'next/server'

// Busca de endereços e estabelecimentos usando OpenStreetMap (Nominatim com fallback Photon).
// Retorna uma lista normalizada de locais com coordenadas (lat/lng),
// usada pelo autocomplete de localização das despesas.

export interface GeoSearchResult {
  id: string
  name: string // Nome do estabelecimento/rua principal
  label: string // Rótulo completo legível
  lat: number
  lng: number
  city: string
  state: string // Sigla (UF) quando possível
  type: string // Tipo OSM (ex: fuel, restaurant, place)
}

// Centro aproximado do Brasil para enviesar resultados quando não houver bias específico
const BRAZIL_BIAS = { lat: -8.05, lon: -34.9 } // Região Nordeste (área de operação principal)

// Mapeia nomes de estado retornados pelo OSM para siglas (UF)
const STATE_TO_UF: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES',
  'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', 'Rondônia': 'RO',
  'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP',
  'Sergipe': 'SE', 'Tocantins': 'TO',
}

function toUf(stateName: string | undefined, isoCode?: string): string {
  if (isoCode && isoCode.startsWith('BR-')) {
    return isoCode.slice(3).toUpperCase()
  }
  if (!stateName) return ''
  if (stateName.length === 2) return stateName.toUpperCase()
  return STATE_TO_UF[stateName] || stateName
}

// Cache em memória para buscas recentes (10 minutos)
const geoCache = new Map<string, { timestamp: number; data: GeoSearchResult[] }>()
const CACHE_TTL_MS = 10 * 60 * 1000

interface PhotonFeature {
  geometry: { coordinates: [number, number] } // [lon, lat]
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    district?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    postcode?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    type?: string
  }
}

function buildPhotonLabel(p: PhotonFeature['properties']): { name: string; label: string; city: string } {
  const city = p.city || p.district || p.county || ''
  const uf = toUf(p.state)
  const cleanName = p.name ? p.name.split(';')[0].trim() : ''

  let streetPart = ''
  if (p.street) {
    streetPart = p.housenumber ? `${p.street}, ${p.housenumber}` : p.street
  }

  const name = cleanName || streetPart || city || 'Local'

  const parts = [
    cleanName ? streetPart : '',
    city,
    uf,
  ].filter(Boolean)

  const label = parts.length > 0 ? `${name} — ${parts.join(', ')}` : name
  return { name, label, city }
}

async function searchNominatim(q: string, bias: { lat: number; lon: number }): Promise<GeoSearchResult[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', q)
    url.searchParams.set('format', 'json')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '10')
    url.searchParams.set('countrycodes', 'br')

    // Enviesa a busca em torno da localização atual/padrão
    const delta = 1.0
    const viewbox = `${bias.lon - delta},${bias.lat + delta},${bias.lon + delta},${bias.lat - delta}`
    url.searchParams.set('viewbox', viewbox)
    url.searchParams.set('bounded', '0')

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Raropay/1.0 (contato@rarotec.com.br)',
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Nominatim retornou status ${response.status}`)
    }

    const data = await response.json()
    if (!Array.isArray(data)) return []

    return data.map((item: any) => {
      const addr = item.address || {}
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.city_district || ''
      const uf = toUf(addr.state, addr['ISO3166-2-lvl4'])

      const rawName = item.name || addr.road || addr.amenity || (item.display_name ? item.display_name.split(',')[0].trim() : 'Local')
      const cleanName = String(rawName).split(';')[0].trim()

      const streetPart = addr.road ? (addr.house_number ? `${addr.road}, ${addr.house_number}` : addr.road) : ''
      const parts = [
        cleanName !== streetPart ? streetPart : '',
        addr.suburb && addr.suburb !== city ? addr.suburb : '',
        city,
        uf,
      ].filter(Boolean)

      const label = parts.length > 0 ? `${cleanName} — ${parts.join(', ')}` : cleanName

      return {
        id: `nom-${item.osm_type || ''}-${item.osm_id || item.place_id}`,
        name: cleanName,
        label,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        city,
        state: uf,
        type: item.type || item.class || 'place',
      }
    })
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

async function searchPhoton(q: string, bias: { lat: number; lon: number }): Promise<GeoSearchResult[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '10')
    url.searchParams.set('lang', 'default')
    url.searchParams.set('lat', String(bias.lat))
    url.searchParams.set('lon', String(bias.lon))

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Raropay/1.0' },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Photon retornou status ${response.status}`)
    }

    const data = await response.json()
    const features: PhotonFeature[] = Array.isArray(data.features) ? data.features : []

    return features
      .filter((f) => !f.properties.countrycode || f.properties.countrycode === 'BR')
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const { name, label, city } = buildPhotonLabel(f.properties)
        return {
          id: `pho-${f.properties.osm_id ?? ''}-${lat}-${lng}`,
          name,
          label,
          lat,
          lng,
          city,
          state: toUf(f.properties.state),
          type: f.properties.osm_value || f.properties.osm_key || 'place',
        }
      })
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const latParam = request.nextUrl.searchParams.get('lat')
  const lonParam = request.nextUrl.searchParams.get('lon')

  if (!q || q.length < 3) {
    return NextResponse.json([])
  }

  const bias = {
    lat: latParam ? parseFloat(latParam) : BRAZIL_BIAS.lat,
    lon: lonParam ? parseFloat(lonParam) : BRAZIL_BIAS.lon,
  }

  // Chave de cache
  const cacheKey = `${q.toLowerCase()}__${bias.lat.toFixed(2)}_${bias.lon.toFixed(2)}`
  const cached = geoCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  // 1. Tenta Nominatim (OpenStreetMap oficial - alta disponibilidade e precisão)
  try {
    const results = await searchNominatim(q, bias)
    if (results.length > 0) {
      geoCache.set(cacheKey, { timestamp: Date.now(), data: results })
      return NextResponse.json(results)
    }
  } catch (error) {
    console.warn('[geo] Nominatim falhou ou atingiu timeout, tentando Photon fallback:', error)
  }

  // 2. Fallback: Tenta Photon (Komoot)
  try {
    const results = await searchPhoton(q, bias)
    if (results.length > 0) {
      geoCache.set(cacheKey, { timestamp: Date.now(), data: results })
      return NextResponse.json(results)
    }
  } catch (error) {
    console.warn('[geo] Photon também falhou ou atingiu timeout:', error)
  }

  // Se ambos falharem ou não encontrarem, retorna array vazio para não quebrar o frontend
  return NextResponse.json([])
}
