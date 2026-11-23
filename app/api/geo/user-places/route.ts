import { type NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getUserPlaces,
  removeUserFavoritePlace,
  renameUserFavoritePlace,
  upsertUserFavoritePlace,
} from '@/lib/user-places-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const data = await getUserPlaces(session.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[geo/user-places] Erro ao listar endereços do usuário:', error)
    return NextResponse.json({ error: 'Erro ao carregar endereços salvos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const data = await upsertUserFavoritePlace(session.id, {
      name: body.name,
      label: body.label,
      lat: Number(body.lat),
      lng: Number(body.lng),
      city: body.city,
      state: body.state,
      type: body.type,
      alias: body.alias,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[geo/user-places] Erro ao favoritar endereço:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao favoritar endereço' },
      { status: 400 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.key !== 'string' || !body.key.trim()) {
      return NextResponse.json({ error: 'Chave do endereço obrigatória' }, { status: 400 })
    }

    const data = await renameUserFavoritePlace(
      session.id,
      body.key,
      typeof body.alias === 'string' ? body.alias : null,
    )

    return NextResponse.json(data)
  } catch (error) {
    console.error('[geo/user-places] Erro ao renomear favorito:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao renomear favorito' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    let key = request.nextUrl.searchParams.get('key')?.trim() || ''
    if (!key) {
      const body = await request.json().catch(() => null)
      if (body && typeof body.key === 'string') {
        key = body.key.trim()
      }
    }

    if (!key) {
      return NextResponse.json({ error: 'Chave do endereço obrigatória' }, { status: 400 })
    }

    const data = await removeUserFavoritePlace(session.id, key)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[geo/user-places] Erro ao remover favorito:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover favorito' },
      { status: 400 },
    )
  }
}
