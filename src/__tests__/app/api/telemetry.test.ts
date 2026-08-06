import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/telemetry/route'

// Synchronous, like the real limiter: it counts in process memory, so there is nothing to
// await. An async mock here would hand the route a Promise to destructure and every request
// would read as rate-limited.
const rateLimit = vi.fn(() => ({ allowed: true, current: 1 }))
vi.mock('@/lib/http/rate-limit', () => ({
  checkSimpleRateLimit: () => rateLimit(),
  getClientIdentifier: () => 'client-hash',
  getClientIp: () => '10.0.0.1',
}))

const ndjsonWrite = vi.fn()
vi.mock('@/lib/observability/logger/server', () => ({
  ndjsonSink: { write: (rec: unknown) => ndjsonWrite(rec) },
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new NextRequest('https://app.test/api/telemetry', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // The route requires a declared length (chunked bodies are rejected
      // with 411); real fetch/sendBeacon always set this.
      'content-length': String(Buffer.byteLength(text, 'utf8')),
      ...headers,
    },
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

  it('rejects a request without Content-Length with 411', async () => {
    // NextRequest keeps a caller-supplied header set verbatim; omit the
    // length to model a chunked upload.
    const req = new NextRequest('https://app.test/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"records":[]}',
    })
    req.headers.delete('content-length')
    const res = await POST(req)
    expect(res.status).toBe(411)
  })

  it('clamps attacker-controlled record time to the server clock window', async () => {
    await POST(
      post({
        records: [
          {
            level: 'error',
            time: '1999-01-01T00:00:00.000Z',
            msg: 'backdated',
          },
        ],
      })
    )
    const rec = ndjsonWrite.mock.calls[0][0] as Record<string, unknown>
    const drift = Math.abs(Date.parse(rec.time as string) - Date.now())
    expect(drift).toBeLessThan(60_000)
  })

  it("gates NDJSON writes by the server's LOG_LEVEL", async () => {
    vi.stubEnv('NODE_ENV', 'production') // default threshold: info
    await POST(
      post({
        records: [
          { level: 'debug', time: new Date().toISOString(), msg: 'chatty' },
          { level: 'info', time: new Date().toISOString(), msg: 'kept' },
        ],
      })
    )
    vi.unstubAllEnvs()
    const written = ndjsonWrite.mock.calls.map(
      (c) => (c[0] as Record<string, unknown>).msg
    )
    expect(written).toEqual(['kept'])
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

  // Regression: the route scrubbed the record and then copied the RAW client
  // `msg` back over the scrubbed one, defeating the re-scrub in the single
  // field most likely to carry a credential — a presigned URL reaches a log
  // through interpolation far more often than through a named key.
  it('scrubs a presigned URL interpolated into msg, not just into context', async () => {
    await POST(
      post({
        records: [
          {
            level: 'error',
            time: '2026-08-05T10:00:00.000Z',
            msg: 'upload failed for https://b.s3.amazonaws.com/k?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA',
          },
        ],
      })
    )
    const rec = ndjsonWrite.mock.calls[0][0] as Record<string, unknown>
    expect(rec.msg).not.toContain('deadbeef')
    expect(rec.msg).not.toContain('AKIA')
    expect(rec.msg).toContain('X-Amz-Signature=REDACTED')
  })

  // The clamp used to walk only the top level, so the longest strings a record
  // carries (err.stack above all) skipped it entirely and the 64KB payload cap
  // was their only bound.
  it('clamps oversized strings nested inside err, not only top-level fields', async () => {
    await POST(
      post({
        records: [
          {
            level: 'error',
            time: '2026-08-05T10:00:00.000Z',
            msg: 'boom',
            err: {
              name: 'Error',
              message: 'm',
              stack: 'x'.repeat(10_000),
              cause: { name: 'Error', message: 'y'.repeat(10_000) },
            },
          },
        ],
      })
    )
    const rec = ndjsonWrite.mock.calls[0][0] as Record<string, unknown>
    const err = rec.err as Record<string, unknown>
    expect((err.stack as string).length).toBe(4 * 1024)
    const cause = err.cause as Record<string, unknown>
    expect((cause.message as string).length).toBe(4 * 1024)
  })

  it('tells a throttled caller when the window rolls over', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false, current: 61 })
    const res = await POST(
      post({
        records: [
          { level: 'info', time: new Date().toISOString(), msg: 'dropped' },
        ],
      })
    )
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    expect(ndjsonWrite).not.toHaveBeenCalled()
  })

  it('forwards as OTLP logs when an endpoint is configured', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.test'
    const res = await POST(
      post({
        records: [
          { level: 'info', time: new Date().toISOString(), msg: 'hello' },
        ],
      })
    )
    // Fire-and-forget: 204 first, forward settles after.
    expect(res.status).toBe(204)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(ndjsonWrite).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string; signal?: AbortSignal },
    ]
    expect(url).toBe('https://collector.test/v1/logs')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const payload = JSON.parse(init.body)
    const logRecord = payload.resourceLogs[0].scopeLogs[0].logRecords[0]
    expect(logRecord.body.stringValue).toBe('hello')
    expect(logRecord.severityText).toBe('INFO')
  })

  it('degrades a failed OTLP forward to the NDJSON sink instead of dropping', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://collector.test'
    fetchMock.mockRejectedValueOnce(new Error('collector down'))
    const res = await POST(
      post({
        records: [
          { level: 'error', time: new Date().toISOString(), msg: 'precious' },
        ],
      })
    )
    expect(res.status).toBe(204)
    await vi.waitFor(() => expect(ndjsonWrite).toHaveBeenCalledTimes(1))
    expect((ndjsonWrite.mock.calls[0][0] as Record<string, unknown>).msg).toBe(
      'precious'
    )
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
