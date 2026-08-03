import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

const AUTOCOMPLETE_URL =
  'https://autocomplete.search.hereapi.com/v1/autocomplete'
const LOOKUP_URL = 'https://lookup.search.hereapi.com/v1/lookup'

/**
 * Proxy for HERE, so the API key never reaches the client. Two modes:
 *
 * - `?q=` — autocomplete, one request per debounced keystroke.
 * - `?id=` — resolve ONE picked suggestion to its coordinates.
 *
 * They are separate endpoints at HERE, not a flag: `/autocomplete` is tuned for per-keystroke
 * latency and omits geometry entirely (`show=position` is rejected with a 400). The `id` it returns
 * is the handoff token to `/lookup`. So coordinates cost one request per address SELECTED.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth.error) return auth.error

  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')
  const query = searchParams.get('q')

  if (!id && (!query || query.length < 2)) {
    return NextResponse.json({ items: [] })
  }

  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    logger.error('HERE_API_KEY not configured')
    return NextResponse.json(
      { error: 'Address service not configured' },
      { status: 500 }
    )
  }

  try {
    if (id) {
      const response = await fetch(
        `${LOOKUP_URL}?id=${encodeURIComponent(id)}&apiKey=${apiKey}`
      )
      // Checked here but not on the autocomplete path below: an error body would otherwise be
      // returned as a successful lookup carrying no position, which the client cannot tell from an
      // address HERE genuinely has no coordinates for.
      if (!response.ok) {
        throw new Error(`HERE lookup responded ${response.status}`)
      }
      const data = await response.json()
      // Narrowed rather than passed through: the contract with the client becomes explicit instead
      // of "whatever HERE sent", and the payload drops the mapView/access/scoring HERE includes.
      return NextResponse.json({
        title: data.title,
        address: data.address,
        position: data.position,
      })
    }

    const response = await fetch(
      `${AUTOCOMPLETE_URL}?q=${encodeURIComponent(query!)}&apiKey=${apiKey}`
    )
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('HERE API error:', error)
    return NextResponse.json(
      { error: 'Address lookup failed' },
      { status: 500 }
    )
  }
}
