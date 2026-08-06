import { logger } from '@/lib/observability/logger'
import { tripwire } from '@/lib/http/tripwire'
import { checkSimpleRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { NextRequest, NextResponse } from 'next/server'

const AUTOCOMPLETE_URL =
  'https://autocomplete.search.hereapi.com/v1/autocomplete'
const LOOKUP_URL = 'https://lookup.search.hereapi.com/v1/lookup'

const WINDOW_SECONDS = 60
/** Generous on purpose: keyed on IP, so one office NAT is one bucket and several people typing
 *  addresses at once must still fit. A script blows through it in seconds. */
const PER_IP_PER_MINUTE = 300
/** The per-IP limit slows ONE source; it does not bound the bill, because N sources cost N × the
 *  limit. This does. Sized well above any plausible real load so it only ever trips on abuse. */
const GLOBAL_PER_MINUTE = 3000
/** HERE ignores anything longer, and the value is forwarded verbatim. */
const MAX_QUERY_LENGTH = 100

/**
 * Proxy for HERE, so the API key never reaches the client. Two modes:
 *
 * - `?q=` — autocomplete, one request per debounced keystroke.
 * - `?id=` — resolve ONE picked suggestion to its coordinates.
 *
 * They are separate endpoints at HERE, not a flag: `/autocomplete` is tuned for per-keystroke
 * latency and omits geometry entirely (`show=position` is rejected with a 400). The `id` it returns
 * is the handoff token to `/lookup`. So coordinates cost one request per address SELECTED.
 *
 * Serves no private data — HERE's index is public. The thing being protected is the API key's
 * QUOTA, which is why both a per-caller and a global limit sit in front of it.
 */
export async function GET(request: NextRequest) {
  const blocked = tripwire(request)
  if (blocked) return blocked

  const ip = getClientIp(request)
  if (
    !checkSimpleRateLimit('address', ip, PER_IP_PER_MINUTE, WINDOW_SECONDS)
      .allowed
  ) {
    return tooManyRequests()
  }
  if (
    !checkSimpleRateLimit(
      'address-global',
      '*',
      GLOBAL_PER_MINUTE,
      WINDOW_SECONDS
    ).allowed
  ) {
    logger.warn('address_global_rate_limit', { ip })
    return tooManyRequests()
  }

  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')
  const query = searchParams.get('q')?.slice(0, MAX_QUERY_LENGTH)

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
    logger.error('HERE API error:', { err: error })
    return NextResponse.json(
      { error: 'Address lookup failed' },
      { status: 500 }
    )
  }
}

function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(WINDOW_SECONDS) } }
  )
}
