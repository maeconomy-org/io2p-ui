import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/address/route'

const tripwire = vi.fn()
const rateLimit = vi.fn()

vi.mock('@/lib/http/tripwire', () => ({
  tripwire: (req: NextRequest) => tripwire(req),
}))

vi.mock('@/lib/http/rate-limit', () => ({
  checkSimpleRateLimit: (scope: string) => rateLimit(scope),
  getClientIp: () => '10.0.0.1',
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

const fetchMock = vi.fn()

const LOOKUP_BODY = {
  title: 'Stadhuisplein 1, 3811 LM Amersfoort, Nederland',
  resultType: 'houseNumber',
  address: { city: 'Amersfoort', countryName: 'Nederland' },
  position: { lat: 52.15672, lng: 5.38416 },
  // HERE also sends these; the route is expected to drop them.
  access: [{ lat: 52.15696, lng: 5.38484 }],
  mapView: { west: 5.38464, south: 52.15628 },
  scoring: { queryScore: 1 },
}

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
})

const request = (query: string) =>
  new NextRequest(`https://app.test/api/address${query}`)

describe('GET /api/address', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tripwire.mockReturnValue(null)
    rateLimit.mockReturnValue({ allowed: true, current: 1 })
    vi.stubGlobal('fetch', fetchMock)
    process.env.HERE_API_KEY = 'test-key'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('refuses a request the tripwire rejected, before calling out', async () => {
    const blocked = new Response('nope', { status: 401 })
    tripwire.mockReturnValue(blocked)

    expect(await GET(request('?q=amersfoort'))).toBe(blocked)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Both limits guard the same thing — HERE's quota — but at different scopes: per-IP stops one
  // caller, global stops the bill when the callers are many.
  it.each(['address', 'address-global'])(
    'returns 429 with Retry-After when the %s limit trips, without calling HERE',
    async (tripped) => {
      rateLimit.mockImplementation((scope: string) => ({
        allowed: scope !== tripped,
        current: 1,
      }))

      const response = await GET(request('?q=amersfoort'))

      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('60')
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('clamps an overlong query before forwarding it', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }))

    await GET(request(`?q=${'a'.repeat(500)}`))

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain(`q=${'a'.repeat(100)}&`)
    expect(url).not.toContain('a'.repeat(101))
  })

  describe('?q= autocomplete', () => {
    it('proxies the query and returns what HERE sent', async () => {
      fetchMock.mockResolvedValue(ok({ items: [{ id: 'here:1' }] }))

      const body = await (await GET(request('?q=amersfoort'))).json()

      expect(fetchMock.mock.calls[0][0]).toContain(
        'autocomplete.search.hereapi.com'
      )
      expect(body.items).toHaveLength(1)
    })

    it('short-circuits a query too short to be worth a request', async () => {
      const body = await (await GET(request('?q=a'))).json()

      expect(body).toEqual({ items: [] })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('short-circuits when neither parameter is given', async () => {
      const body = await (await GET(request(''))).json()

      expect(body).toEqual({ items: [] })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('?id= lookup', () => {
    it('hits the LOOKUP host, not autocomplete', async () => {
      fetchMock.mockResolvedValue(ok(LOOKUP_BODY))

      await GET(request('?id=here%3Aaf%3Astreet%3A123'))

      const url = fetchMock.mock.calls[0][0]
      expect(url).toContain('lookup.search.hereapi.com')
      // `/autocomplete` structurally cannot return a position — that is the whole reason for a
      // second mode rather than a flag.
      expect(url).not.toContain('autocomplete')
      expect(url).toContain('id=here%3Aaf%3Astreet%3A123')
    })

    it('narrows the response to the three fields the client uses', async () => {
      fetchMock.mockResolvedValue(ok(LOOKUP_BODY))

      const body = await (await GET(request('?id=here:1'))).json()

      expect(body).toEqual({
        title: LOOKUP_BODY.title,
        address: LOOKUP_BODY.address,
        position: { lat: 52.15672, lng: 5.38416 },
      })
      // `access` is the ROUTABLE point, not the rooftop — dropping it keeps the contract explicit
      // and stops anyone assuming the stored point routes.
      expect(body.access).toBeUndefined()
      expect(body.mapView).toBeUndefined()
      expect(body.scoring).toBeUndefined()
    })

    it('takes precedence over q, so one request goes out', async () => {
      fetchMock.mockResolvedValue(ok(LOOKUP_BODY))

      await GET(request('?id=here:1&q=amersfoort'))

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock.mock.calls[0][0]).toContain('lookup.search')
    })

    it('fails loudly on a non-2xx rather than returning a position-less success', async () => {
      // The client cannot tell "HERE errored" from "this address has no coordinates" — so the
      // route must not let an error body through as a successful lookup.
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'bad id' }),
      })

      const response = await GET(request('?id=broken'))

      expect(response.status).toBe(500)
      expect((await response.json()).error).toBeTruthy()
    })

    it('reports a network failure as 500', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))

      expect((await GET(request('?id=here:1'))).status).toBe(500)
    })
  })

  it('500s when the API key is missing, for either mode', async () => {
    delete process.env.HERE_API_KEY

    expect((await GET(request('?q=amersfoort'))).status).toBe(500)
    expect((await GET(request('?id=here:1'))).status).toBe(500)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
