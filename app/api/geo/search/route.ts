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

/**
 * Higieniza e decompõe textos de endereços colados (ex: vindos de WhatsApp, Maps ou NF)
 * gerando variações de busca progressivas para maximizar a taxa de acerto no OpenStreetMap.
 */
function buildSearchCandidates(rawInput: string): string[] {
  const input = rawInput.trim()

  // Se for uma busca simples curta (ex: "Recife", "Posto Shell"), usa diretamente
  if (!input.includes(',') && !input.includes('-') && !/\d{5}/.test(input) && !/\b\d+\b/.test(input)) {
    return [input]
  }

  const candidates: string[] = []

  // 1. Extrai CEP se existir (ex: 51160-030 ou 51160030)
  const cepMatch = input.match(/\b\d{5}-?\d{3}\b/)
  const cep = cepMatch ? cepMatch[0] : null

  // 2. Extrai Estado/UF (ex: PE, SP, etc.)
  const ufMatch = input.match(/(?:[-/,]\s*|\b)([A-Za-z]{2})\b/)
  const uf = ufMatch ? ufMatch[1].toUpperCase() : null

  // 3. Normaliza espaçamentos e remove ruídos globais
  let cleaned = input
    .replace(/\bBrasil\b/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/,([^\s])/g, ', $1')
    .replace(/-([^\s])/g, '- $1')
    .replace(/\bCEP:?\s*\d{5}-?\d{3}\b/gi, '')
    .replace(/\b\d{5}-?\d{3}\b/g, '')
    .trim()

  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return candidates

  // Primeira parte é normalmente o logradouro
  let streetPart = parts[0] || ''

  // Remove número predial (ex: "90", "nº 90", "s/n", "1000A")
  streetPart = streetPart
    .replace(/\s+(?:n[ºo°]?\s*)?\d+[a-zA-Z]?\b/gi, '')
    .replace(/\b(?:s\/n|sn)\b/gi, '')
    .trim()

  // Expande abreviações comuns de logradouro
  const expandedStreet = streetPart
    .replace(/\bR\.\s*/gi, 'Rua ')
    .replace(/\bAv\.\s*/gi, 'Avenida ')
    .replace(/\bRod\.\s*/gi, 'Rodovia ')
    .replace(/\bAl\.\s*/gi, 'Alameda ')
    .replace(/\bPç\.\s*/gi, 'Praça ')
    .replace(/\bTrav\.\s*/gi, 'Travessa ')
    .trim()

  // Nome do logradouro sem "Rua", "Avenida", etc. (ótimo para tolerar conectivos como "da Silva" vs "Silva")
  const coreStreet = expandedStreet
    .replace(/^(Rua|Avenida|Rodovia|Alameda|Praça|Travessa)\s+/i, '')
    .trim()

  // Identifica a cidade entre as outras partes (ex: "Recife - PE" -> "Recife")
  let cityPart = ''
  for (let i = 1; i < parts.length; i++) {
    let candidate = parts[i]
      .replace(/[-/]\s*[A-Za-z]{2}\b/gi, '')
      .replace(/\b(?:n[ºo°]?\s*)?\d+[a-zA-Z]?\b/gi, '')
      .replace(/\b(?:s\/n|sn)\b/gi, '')
      .trim()

    if (candidate.includes('-')) {
      const sub = candidate.split('-').map((s) => s.trim()).filter(Boolean)
      candidate = sub[sub.length - 1] || candidate
    }

    if (candidate && candidate.length > 2 && !/^\d+$/.test(candidate)) {
      cityPart = candidate
    }
  }

  // 1º Candidato inteligente: "Moisés Correia Silva, Recife, PE" (máxima tolerância a preposições ausentes)
  if (coreStreet) {
    const q1 = [coreStreet, cityPart, uf].filter(Boolean).join(', ')
    if (q1 && !candidates.includes(q1)) candidates.push(q1)
  }

  // 2º Candidato estruturado: "Rua Moisés Correia Silva, Recife, PE"
  if (expandedStreet) {
    const q2 = [expandedStreet, cityPart, uf].filter(Boolean).join(', ')
    if (q2 && !candidates.includes(q2)) candidates.push(q2)
  }

  // 3º Candidato: Logradouro expandido com cidade
  if (expandedStreet && cityPart) {
    const q3 = `${expandedStreet}, ${cityPart}`
    if (!candidates.includes(q3)) candidates.push(q3)
  }

  // 4º Candidato: CEP (para localizar com precisão a via ou o bairro)
  if (cep && !candidates.includes(cep)) {
    candidates.push(cep)
  }

  // Fallback final: tenta a busca bruta original
  if (!candidates.includes(input)) {
    candidates.push(input)
  }

  return candidates
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

  // Gera lista de queries candidatas (original + versões higienizadas e estruturadas)
  const candidates = buildSearchCandidates(q)

  // Percorre as queries candidatas até encontrar resultados
  for (const candidateQuery of candidates) {
    // 1. Tenta Nominatim (OpenStreetMap oficial)
    try {
      const results = await searchNominatim(candidateQuery, bias)
      if (results.length > 0) {
        geoCache.set(cacheKey, { timestamp: Date.now(), data: results })
        return NextResponse.json(results)
      }
    } catch (error) {
      console.warn(`[geo] Nominatim falhou para "${candidateQuery}":`, error)
    }

    // 2. Se Nominatim não trouxe resultados, tenta Photon para esta query
    try {
      const results = await searchPhoton(candidateQuery, bias)
      if (results.length > 0) {
        geoCache.set(cacheKey, { timestamp: Date.now(), data: results })
        return NextResponse.json(results)
      }
    } catch (error) {
      console.warn(`[geo] Photon falhou para "${candidateQuery}":`, error)
    }
  }

  // Se nenhum candidato retornar resultados, devolve array vazio
  return NextResponse.json([])
}
