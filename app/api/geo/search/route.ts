import { type NextRequest, NextResponse } from 'next/server'

// Busca de endereços e estabelecimentos usando Photon (OpenStreetMap).
// Não requer chave de API. Documentação: https://photon.komoot.io
//
// Retorna uma lista normalizada de locais com coordenadas (lat/lng),
// usada pelo autocomplete de localização das despesas de combustível.

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
const BRAZIL_BIAS = { lat: -8.05, lon: -34.9 } // Região Nordeste (área de operação)

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

function toUf(stateName: string | undefined): string {
  if (!stateName) return ''
  if (stateName.length === 2) return stateName.toUpperCase()
  return STATE_TO_UF[stateName] || stateName
}

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

function buildLabel(p: PhotonFeature['properties']): { name: string; label: string; city: string } {
  const city = p.city || p.district || p.county || ''
  const uf = toUf(p.state)

  // O OSM às vezes retorna nomes multivalorados separados por ";" (ex: "Posto Shell;Shell").
  // Mantemos apenas o primeiro valor, que costuma ser o mais descritivo.
  const cleanName = p.name ? p.name.split(';')[0].trim() : ''

  // Nome principal: estabelecimento nomeado, ou rua+número, ou cidade
  let streetPart = ''
  if (p.street) {
    streetPart = p.housenumber ? `${p.street}, ${p.housenumber}` : p.street
  }

  const name = cleanName || streetPart || city || 'Local'

  const parts = [
    cleanName ? streetPart : '', // se tem nome, mostra a rua como complemento
    city,
    uf,
  ].filter(Boolean)

  const label = parts.length > 0 ? `${name} — ${parts.join(', ')}` : name

  return { name, label, city }
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

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '10')
    url.searchParams.set('lang', 'default')
    url.searchParams.set('lat', String(bias.lat))
    url.searchParams.set('lon', String(bias.lon))

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'RarotecExpenses/1.0' },
      next: { revalidate: 3600 },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Photon retornou ${response.status}`)
    }

    const data = await response.json()
    const features: PhotonFeature[] = Array.isArray(data.features) ? data.features : []

    const results: GeoSearchResult[] = features
      // Prioriza resultados do Brasil
      .filter((f) => !f.properties.countrycode || f.properties.countrycode === 'BR')
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates
        const { name, label, city } = buildLabel(f.properties)
        return {
          id: `${f.properties.osm_id ?? ''}-${lat}-${lng}`,
          name,
          label,
          lat,
          lng,
          city,
          state: toUf(f.properties.state),
          type: f.properties.osm_value || f.properties.osm_key || 'place',
        }
      })

    return NextResponse.json(results)
  } catch (error) {
    console.error('[v0] Erro na busca de localização (Photon):', error)
    return NextResponse.json({ error: 'Erro ao buscar localização' }, { status: 500 })
  }
}
