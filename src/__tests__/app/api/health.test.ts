import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { GET } from '@/app/api/health/route'

describe('/api/health', () => {
  const originalVersion = process.env.APP_VERSION

  beforeEach(() => {
    delete process.env.APP_VERSION
  })

  afterEach(() => {
    if (originalVersion === undefined) {
      delete process.env.APP_VERSION
    } else {
      process.env.APP_VERSION = originalVersion
    }
  })

  it('returns 200 with ok: true', async () => {
    const res = await GET()

    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('reports the APP_VERSION when set', async () => {
    process.env.APP_VERSION = '9.9.9-test'

    const res = await GET()
    const body = await res.json()

    expect(body.version).toBe('9.9.9-test')
  })

  it('falls back to "unknown" when APP_VERSION is not set', async () => {
    const res = await GET()
    const body = await res.json()

    expect(body.version).toBe('unknown')
  })
})
