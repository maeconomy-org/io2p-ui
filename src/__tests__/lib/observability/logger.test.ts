import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  LOG_LEVELS,
  buildRecord,
  createLogger,
  levelPasses,
  normalizeLevel,
  rawError,
  serializeError,
  type LogRecord,
  type Sink,
} from '@/lib/observability/logger/core'
import { ndjsonSink } from '@/lib/observability/logger/server'

describe('normalizeLevel', () => {
  it('accepts every valid level', () => {
    for (const level of LOG_LEVELS) {
      expect(normalizeLevel(level, 'info')).toBe(level)
    }
  })

  it('falls back on an invalid level instead of logging everything', () => {
    // The old logger's indexOf returned -1 for a typo, which made the gate
    // `>= -1` — always true. A typo'd LOG_LEVEL must fall back, not open up.
    expect(normalizeLevel('debgu', 'info')).toBe('info')
    expect(normalizeLevel('verbose', 'warn')).toBe('warn')
    expect(normalizeLevel('', 'info')).toBe('info')
    expect(normalizeLevel(undefined, 'error')).toBe('error')
    expect(normalizeLevel(42, 'info')).toBe('info')
  })
})

describe('levelPasses', () => {
  it('gates records below the threshold', () => {
    expect(levelPasses('debug', 'info')).toBe(false)
    expect(levelPasses('info', 'info')).toBe(true)
    expect(levelPasses('warn', 'info')).toBe(true)
    expect(levelPasses('error', 'debug')).toBe(true)
    expect(levelPasses('info', 'error')).toBe(false)
  })
})

describe('serializeError', () => {
  it('serializes a plain Error with name, message, and stack', () => {
    const out = serializeError(new TypeError('boom'))
    expect(out.name).toBe('TypeError')
    expect(out.message).toBe('boom')
    expect(out.stack).toContain('boom')
  })

  it('serializes ApiError-shaped errors with status/title/detail/problem', () => {
    const err = Object.assign(new Error('Missing permission: WRITE'), {
      status: 403,
      title: 'Forbidden',
      detail: 'Missing permission: WRITE',
      problem: { type: 'about:blank', status: 403 },
    })
    const out = serializeError(err)
    expect(out.status).toBe(403)
    expect(out.title).toBe('Forbidden')
    expect(out.detail).toBe('Missing permission: WRITE')
    expect(out.problem).toEqual({ type: 'about:blank', status: 403 })
  })

  it('walks cause chains recursively', () => {
    const root = new Error('connection refused')
    const mid = new Error('fetch failed', { cause: root })
    const top = new Error('save failed', { cause: mid })
    const out = serializeError(top)
    expect(out.message).toBe('save failed')
    expect(out.cause?.message).toBe('fetch failed')
    expect(out.cause?.cause?.message).toBe('connection refused')
  })

  it('handles non-Error throwables', () => {
    expect(serializeError('plain string')).toEqual({
      name: 'Error',
      message: 'plain string',
    })
    expect(serializeError({ message: 'objecty', status: 500 })).toMatchObject({
      message: 'objecty',
      status: 500,
    })
    expect(serializeError(undefined).name).toBe('NonError')
  })

  it('redacts presigned-URL credentials in message and stack', () => {
    const sig = 'a'.repeat(64)
    const err = new Error(
      `PUT failed: https://b.s3.amazonaws.com/k?X-Amz-Signature=${sig}`
    )
    const out = serializeError(err)
    expect(out.message).not.toContain(sig)
    expect(out.message).toContain('X-Amz-Signature=REDACTED')
  })
})

describe('buildRecord', () => {
  it('produces { level, time, msg, err, ...ctx } with err serialized', () => {
    const error = new Error('kaput')
    const rec = buildRecord('error', 'Save failed', { err: error, id: 'x1' })
    expect(rec.level).toBe('error')
    expect(typeof rec.time).toBe('string')
    expect(rec.msg).toBe('Save failed')
    expect(rec.err?.message).toBe('kaput')
    expect(rec.id).toBe('x1')
    // The original Error rides along under a symbol for console/Sentry...
    expect(rec[rawError]).toBe(error)
    // ...which JSON.stringify skips by language rules (NDJSON/ship safety).
    expect(JSON.parse(JSON.stringify(rec)).err.message).toBe('kaput')
  })

  it('tolerates the legacy Error-as-context shape', () => {
    const error = new Error('legacy')
    const rec = buildRecord('error', 'Old call site', error)
    expect(rec.err?.message).toBe('legacy')
    expect(rec[rawError]).toBe(error)
  })

  it('promotes the legacy { error } wrapper so the stack survives', () => {
    const error = new Error('wrapped')
    const rec = buildRecord('error', 'Old wrapper', { error, id: 7 })
    expect(rec.err?.message).toBe('wrapped')
    expect(rec.id).toBe(7)
  })

  it('keeps a non-Error `error` field as context below error level', () => {
    const rec = buildRecord('warn', 'Soft failure', { error: 'just a reason' })
    expect(rec.err).toBeUndefined()
    expect(rec.error).toBe('just a reason')
  })

  it('redacts secret-named keys and presigned URLs in context', () => {
    const rec = buildRecord('info', 'ctx scrub', {
      token: 'abc123',
      apiKey: 'k',
      nested: { authorization: 'Bearer xyz' },
      url: 'https://b.s3.amazonaws.com/k?X-Amz-Credential=AKIA123',
    })
    expect(rec.token).toBe('[REDACTED]')
    expect(rec.apiKey).toBe('[REDACTED]')
    expect((rec.nested as Record<string, unknown>).authorization).toBe(
      '[REDACTED]'
    )
    expect(rec.url).toContain('X-Amz-Credential=REDACTED')
  })

  it('wraps a non-object, non-Error second argument as data', () => {
    const rec = buildRecord('info', 'odd shape', 'stringy')
    expect(rec.data).toBe('stringy')
  })

  it('never lets context overwrite the core record fields', () => {
    const rec = buildRecord('error', 'real message', {
      err: new Error('real error'),
      level: 'debug', // hostile/accidental collisions
      time: 'not-a-time',
      msg: 'spoofed',
    } as never)
    expect(rec.level).toBe('error')
    expect(rec.msg).toBe('real message')
    expect(Number.isNaN(Date.parse(rec.time))).toBe(false)
    expect(rec.err?.message).toBe('real error')
  })

  it('copies shared (diamond) references without mislabeling them circular', () => {
    const shared = { host: 'core.internal' }
    const rec = buildRecord('info', 'diamond', { a: shared, b: shared })
    expect(rec.a).toEqual({ host: 'core.internal' })
    expect(rec.b).toEqual({ host: 'core.internal' })
    // A genuine cycle IS labeled.
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const rec2 = buildRecord('info', 'cycle', { c: cyclic })
    expect((rec2.c as Record<string, unknown>).self).toBe('[Circular]')
  })
})

describe('createLogger sink routing', () => {
  function collectorSink(): { sink: Sink; records: LogRecord[] } {
    const records: LogRecord[] = []
    return { sink: { write: (rec) => records.push(rec) }, records }
  }

  it('routes records only to sinks whose threshold passes', () => {
    const all = collectorSink()
    const errorsOnly = collectorSink()
    const off = collectorSink()
    const logger = createLogger([
      { sink: all.sink, threshold: () => 'debug' },
      { sink: errorsOnly.sink, threshold: () => 'error' },
      { sink: off.sink, threshold: () => 'off' },
    ])

    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    expect(all.records.map((r) => r.level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ])
    expect(errorsOnly.records.map((r) => r.msg)).toEqual(['e'])
    expect(off.records).toHaveLength(0)
  })

  it('re-evaluates thresholds per record (runtime level changes)', () => {
    let level: 'off' | 'debug' = 'off'
    const c = collectorSink()
    const logger = createLogger([{ sink: c.sink, threshold: () => level }])
    logger.error('dark')
    level = 'debug'
    logger.error('lit')
    expect(c.records.map((r) => r.msg)).toEqual(['lit'])
  })

  it('never lets a sink failure escape to the caller', () => {
    const c = collectorSink()
    const logger = createLogger([
      {
        sink: {
          write: () => {
            throw new Error('sink exploded')
          },
        },
        threshold: () => 'debug',
      },
      { sink: c.sink, threshold: () => 'debug' },
    ])
    expect(() => logger.error('still logs')).not.toThrow()
    expect(c.records).toHaveLength(1)
  })

  it('supports addSink as a registration seam (ship sink, OTel bridge)', () => {
    const c = collectorSink()
    const logger = createLogger([])
    logger.error('before')
    logger.addSink(c.sink, () => 'info')
    logger.info('after')
    expect(c.records.map((r) => r.msg)).toEqual(['after'])
  })
})

describe('ndjsonSink (server)', () => {
  let lines: string[]
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lines = []
    spy = vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: string
    ) => {
      lines.push(chunk)
      return true
    }) as never)
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('writes exactly one JSON line with pino-compatible keys', () => {
    const rec = buildRecord('error', 'Server boom', {
      err: new Error('x'),
      reqPath: '/api/config',
    })
    ndjsonSink.write(rec)
    expect(lines).toHaveLength(1)
    expect(lines[0].endsWith('\n')).toBe(true)
    const parsed = JSON.parse(lines[0])
    expect(Object.keys(parsed).slice(0, 3)).toEqual(['level', 'time', 'msg'])
    expect(parsed.err.message).toBe('x')
    expect(parsed.reqPath).toBe('/api/config')
  })

  it('never throws, even for an unserializable record', () => {
    const cyclic: Record<string, unknown> = {
      level: 'info',
      time: 't',
      msg: 'm',
    }
    cyclic.self = cyclic
    expect(() => ndjsonSink.write(cyclic as never)).not.toThrow()
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]).logError).toBe('unserializable')
  })
})
