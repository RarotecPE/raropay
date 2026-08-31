import { NextRequest, NextResponse } from 'next/server'

// API para calcular distância de um percurso.
//
// Estratégia:
// 1. Cada ponto da rota pode vir com coordenadas precisas (lat/lng) — vindas do
//    autocomplete de endereços/estabelecimentos (Photon) — ou apenas com
//    município/estado (fluxo antigo).
// 2. Pontos sem coordenadas são geocodificados (Nominatim/OSM) pelo centro do município.
// 3. Com todas as coordenadas em mãos, calculamos a rota REAL de estrada via OSRM.
//    Se o OSRM falhar, caímos no cálculo por linha reta (Haversine) com fator 1.3x.
//
// Nenhuma das APIs usadas exige chave de acesso.

interface Coordinate {
  lat: number
  lng: number
}

interface RoutePoint {
  municipality?: string
  state?: string
  lat?: number | null
  lng?: number | null
}

// Cache simples em memória para coordenadas de municípios
const coordinatesCache: Map<string, Coordinate> = new Map()

async function getMunicipalityCoordinates(municipality: string, state: string): Promise<Coordinate | null> {
  const cacheKey = `${municipality}-${state}`

  if (coordinatesCache.has(cacheKey)) {
    return coordinatesCache.get(cacheKey)!
  }

  try {
    const searchQuery = encodeURIComponent(`${municipality}, ${state}, Brasil`)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${searchQuery}&format=json&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'Raropay/1.0' } }
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data && data.length > 0) {
      const coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      coordinatesCache.set(cacheKey, coord)
      return coord
    }
    return null
  } catch (error) {
    console.error('[v0] Erro ao geocodificar município:', error)
    return null
  }
}

// Distância em linha reta (Haversine) com fator de correção rodoviária
function haversine(a: Coordinate, b: Coordinate): number {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1.3
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Reduz o número de pontos da geometria para não sobrecarregar o front
function downsample<T>(arr: T[], max = 300): T[] {
  if (arr.length <= max) return arr
  const step = Math.ceil(arr.length / max)
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1)
}

// Rota real de estrada via OSRM (retorna distância em km e geometria [{lat,lng}])
async function getOsrmRoute(
  coords: Coordinate[]
): Promise<{ distanceKm: number; geometry: Coordinate[] } | null> {
  try {
    const path = coords.map((c) => `${c.lng},${c.lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Raropay/1.0' },
    })
    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()
    const route = data?.routes?.[0]
    if (!route) return null

    const geometry: Coordinate[] = (route.geometry?.coordinates || []).map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    )

    return {
      distanceKm: route.distance / 1000,
      geometry: downsample(geometry),
    }
  } catch (error) {
    console.error('[v0] Erro no roteamento OSRM:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { route, roundTrip = false } = body as { route: RoutePoint[]; roundTrip?: boolean }

    if (!route || !Array.isArray(route) || route.length < 2) {
      return NextResponse.json({ error: 'Rota inválida' }, { status: 400 })
    }

    // Resolve as coordenadas de cada ponto: usa lat/lng se existir, senão geocodifica
    const coordinates: (Coordinate | null)[] = await Promise.all(
      route.map(async (point) => {
        if (typeof point.lat === 'number' && typeof point.lng === 'number') {
          return { lat: point.lat, lng: point.lng }
        }
        if (point.municipality && point.state) {
          return getMunicipalityCoordinates(point.municipality, point.state)
        }
        return null
      })
    )

    const validCoordinates = coordinates.filter((c): c is Coordinate => c !== null)

    if (validCoordinates.length < 2) {
      return NextResponse.json({
        error: 'Não foi possível determinar as coordenadas do percurso',
        estimated_distance: null,
      })
    }

    // 1ª tentativa: rota real de estrada via OSRM
    const osrm = await getOsrmRoute(validCoordinates)

    let totalDistance: number
    let routeSource: 'osrm' | 'haversine'
    let geometry: Coordinate[] = []

    if (osrm) {
      totalDistance = osrm.distanceKm
      geometry = osrm.geometry
      routeSource = 'osrm'
    } else {
      // Fallback: soma dos segmentos em linha reta com fator rodoviário
      totalDistance = 0
      for (let i = 0; i < validCoordinates.length - 1; i++) {
        totalDistance += haversine(validCoordinates[i], validCoordinates[i + 1])
      }
      geometry = validCoordinates
      routeSource = 'haversine'
    }

    if (roundTrip) {
      totalDistance *= 2
    }

    return NextResponse.json({
      estimated_distance: Math.round(totalDistance),
      route_source: routeSource,
      geometry,
      points: validCoordinates,
      roundTrip,
      note:
        routeSource === 'osrm'
          ? roundTrip
            ? 'Distância real de estrada (ida e volta)'
            : 'Distância real de estrada calculada pela rota'
          : 'Distância aproximada (linha reta com fator rodoviário 1.3x)',
    })
  } catch (error) {
    console.error('[v0] Erro ao calcular distância:', error)
    return NextResponse.json({ error: 'Erro ao calcular distância' }, { status: 500 })
  }
}
