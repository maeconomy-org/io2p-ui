import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/telemetry/route'

const rateLimit = vi.fn(async () => ({ allowed: true, current: 1 }))
vi.mock('@/lib/security-utils', () => ({
  checkSimpleRateLimit: () => rateLimit(),
  getClientIdentifier: () => 'client-hash',
}))

const ndjsonWrite = vi.fn()
vi.mock('@/lib/logger/server', () => ({
  ndjsonSink: { write: (rec: unknown) => ndjsonWrite(rec) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new NextRequest('https://app.test/api/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: text,
  })
}

describe('POST /api/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  })

  afterEach(() => vi.unstubAllGlobals())

  it('accepts a valid batch and lands it in the NDJSON sink tagged browser', async () => {
    const res = await POST(
      post({
        records: [
          {
            level: 'error',
            time: '2026-08-05T10:00:00.000Z',
            msg: 'Boundary hit',
            err: { name: 'Error', message: 'x' },
          },
        ],
      })
    )
    expect(res.status).toBe(204)
    expect(ndjsonWrite).toHaveBeenCalledTimes(1)
    const rec = ndjsonWrite.mock.calls[0][0] as Record<string, unknown>
    expect(rec.msg).toBe('Boundary hit')
    expect(rec.source).toBe('browser')
  })

  it('rejects an oversize payload with 413', async () => {
    const res = await POST(post('{}', { 'content-length': String(200 * 1024) }))
    expect(res.status).toBe(413)
    expect(ndjsonWrite).not.toHaveBeenCalled()
  })

  it('returns 429 when the rate limiter says no', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false, current: 999 })
    const res = await POST(post({ records: [] }))
    expect(res.status).toBe(429)
  })

  it('silently drops garbage without erroring to the client', async () => {
    expect((await POST(post('not json at all'))).status).toBe(204)
    expect((await POST(post({ nope: true }))).status).toBe(204)
    expect(
      (await POST(post({ records: [{ level: 'bogus', msg: 'x' }] }))).status
    ).toBe(204)
    expect(ndjsonWrite).not.toHaveBeenCalled()
  })

  it('re-scrubs secrets server-side', async () => {
    await POST(
      post({
        records: [
          {
            level: 'warn',
            time: '2026-08-05T10:00:00.000Z',
            msg: 'ctx',
            token: 'supersecret',
          },
        ],
      })
    )
    const rec = ndjsonWrite.mock.calls[0][0] as Record<string, unknown>
    expect(rec.token).toBe('[REDACTED]')
  })

  it('forwards as OTLP logs when an endpoint is configured', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.test'
    const res = await POST(
      post({
        records: [
          { level: 'info', time: '2026-08-05T10:00:00.000Z', msg: 'hello' },
        ],
      })
    )
    expect(res.status).toBe(204)
    expect(ndjsonWrite).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    expect(url).toBe('https://collector.test/v1/logs')
    const payload = JSON.parse(init.body)
    const logRecord = payload.resourceLogs[0].scopeLogs[0].logRecords[0]
    expect(logRecord.body.stringValue).toBe('hello')
    expect(logRecord.severityText).toBe('INFO')
  })

  it('caps the records taken from one batch', async () => {
    const records = Array.from({ length: 80 }, (_, i) => ({
      level: 'info',
      time: '2026-08-05T10:00:00.000Z',
      msg: `r${i}`,
    }))
    await POST(post({ records }))
    expect(ndjsonWrite).toHaveBeenCalledTimes(50)
  })
})
