import { type NextRequest, NextResponse } from 'next/server'
import https from 'node:https'

// Cache em memória para municípios já resolvidos por estado
const memoryCache = new Map<string, { id: number; name: string }[]>()

// Cache em memória do payload completo de constantes do RaroNexus (TTL de 1 hora)
let raronexusAllData: any = null
let raronexusCacheTime = 0
const RARONEXUS_CACHE_TTL_MS = 60 * 60 * 1000

const RARONEXUS_CONSTANTS_URL =
  process.env.RARONEXUS_CONSTANTS_MUNICIPIOS_URL ||
  'http://localhost:3000/api/constants/municipios'

/**
 * Consulta a API oficial do IBGE contornando a rejeição de certificados ICP-Brasil no Node.js
 */
function fetchIbgeMunicipalities(state: string, timeoutMs = 6000): Promise<{ id: number; name: string }[]> {
  return new Promise((resolve, reject) => {
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios?orderBy=nome`

    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Raropay/1.0',
          'Accept': 'application/json',
        },
      },
      (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`IBGE retornou status ${res.statusCode}`))
        }
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          try {
            const data = JSON.parse(raw)
            if (!Array.isArray(data)) {
              return reject(new Error('IBGE não retornou array'))
            }
            const list = data.map((m: any) => ({
              id: Number(m.id || 0),
              name: String(m.nome || '').trim(),
            })).filter((m) => Boolean(m.name))
            resolve(list)
          } catch (e) {
            reject(e)
          }
        })
      }
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout de ${timeoutMs}ms ao consultar IBGE`))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Extrai os municípios de um determinado estado a partir do payload de constantes do RaroNexus
 */
function extractMunicipalitiesFromRaronexus(data: any, state: string): { id: number; name: string }[] {
  const uf = state.toUpperCase()
  let list: any[] | null = null

  if (Array.isArray(data)) {
    // Formato 1: Array de objetos por UF [{ "RO": [...] }, { "PE": [...] }]
    const found = data.find((item) => item && typeof item === 'object' && Array.isArray(item[uf]))
    if (found) {
      list = found[uf]
    } else {
      // Formato 2: Array plano de municípios [{ codigoIbge, nome, uf }, ...]
      const filtered = data.filter((item) => item && (item.uf?.toUpperCase() === uf || item.state?.toUpperCase() === uf))
      if (filtered.length > 0) list = filtered
    }
  } else if (data && typeof data === 'object') {
    // Formato 3: Objeto com UFs como chaves { "RO": [...], "PE": [...] }
    if (Array.isArray(data[uf])) {
      list = data[uf]
    }
  }

  if (!Array.isArray(list)) return []

  return list
    .map((m: any) => ({
      id: Number(m.codigoIbge || m.id || m.codigo || 0),
      name: String(m.nome || m.name || '').trim(),
    }))
    .filter((m) => Boolean(m.name))
}

/**
 * Consulta a API de constantes do RaroNexus para obter o catálogo de municípios
 */
async function fetchRaronexusConstants(request: NextRequest): Promise<any> {
  // Se já tiver em cache na memória, reutiliza
  if (raronexusAllData && Date.now() - raronexusCacheTime < RARONEXUS_CACHE_TTL_MS) {
    return raronexusAllData
  }

  const token =
    request.cookies.get('raropay_global_session')?.value ||
    request.cookies.get('raronexus_global_session')?.value ||
    process.env.RARONEXUS_SESSION_TOKEN

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Raropay/1.0',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    headers['Cookie'] = `raronexus_global_session=${token}`
  }

  // Faz a requisição inicial com redirecionamento manual para preservar tokens se necessário
  let res = await fetch(RARONEXUS_CONSTANTS_URL, {
    method: 'GET',
    headers,
    redirect: 'manual',
    cache: 'no-store',
  })

  // Segue redirecionamentos (HTTP 301, 302, 307, 308) com os cabeçalhos preservados
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) {
      const redirectUrl = new URL(location, RARONEXUS_CONSTANTS_URL).toString()
      res = await fetch(redirectUrl, {
        method: 'GET',
        headers,
      })
    }
  }

  if (!res.ok) {
    throw new Error(`RaroNexus retornou status ${res.status}`)
  }

  const data = await res.json()
  raronexusAllData = data
  raronexusCacheTime = Date.now()
  return data
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')?.trim()

  if (!state) {
    return NextResponse.json({ error: 'Estado é obrigatório' }, { status: 400 })
  }

  const normalizedState = state.toUpperCase()

  // 1. Verifica cache em memória para resposta instantânea
  const cached = memoryCache.get(normalizedState)
  if (cached && cached.length > 0) {
    return NextResponse.json(cached)
  }

  // 2. Tenta buscar da API oficial do IBGE
  try {
    const municipalities = await fetchIbgeMunicipalities(normalizedState)
    if (municipalities.length > 0) {
      memoryCache.set(normalizedState, municipalities)
      return NextResponse.json(municipalities)
    }
  } catch (error) {
    console.warn(`[ibge] Falha na consulta de municípios no IBGE para ${normalizedState}, buscando no RaroNexus:`, error)
  }

  // 3. Fallback: Consulta a API de constantes do RaroNexus
  try {
    const raronexusData = await fetchRaronexusConstants(request)
    const municipalities = extractMunicipalitiesFromRaronexus(raronexusData, normalizedState)

    if (municipalities.length > 0) {
      memoryCache.set(normalizedState, municipalities)
      return NextResponse.json(municipalities)
    }
  } catch (error) {
    console.warn(`[ibge] Falha ao consultar constante de municípios no RaroNexus:`, error)
  }

  // Se nenhum provedor retornou dados, retorna lista vazia para evitar quebrar o frontend
  return NextResponse.json([])
}
