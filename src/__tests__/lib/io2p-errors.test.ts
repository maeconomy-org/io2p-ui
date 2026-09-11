import { describe, it, expect } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  ApiError,
  NetworkError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
  ValidationError,
} from 'io2p-client'

import {
  iomDetail,
  iomStatus,
  isCallerAbort,
  isCallerCancelled,
  isMintInterrupted,
  isUnreadable,
  markErrorReported,
  saveErrorMessage,
  wasErrorReported,
} from '@/lib/io2p-errors'

function problem(status: number, detail?: string) {
  return { type: 'about:blank', title: 'Error', status, detail }
}

describe('iomStatus', () => {
  it('reads the status off each SDK error class', () => {
    expect(iomStatus(new UnauthorizedError(problem(401)))).toBe(401)
    expect(iomStatus(new ForbiddenError(problem(403)))).toBe(403)
    expect(iomStatus(new NotFoundError(problem(404)))).toBe(404)
    expect(iomStatus(new ConflictError(problem(409)))).toBe(409)
    expect(iomStatus(new PreconditionFailedError(problem(412)))).toBe(412)
    expect(iomStatus(new ValidationError(problem(422)))).toBe(422)
    expect(iomStatus(new ApiError(problem(500)))).toBe(500)
  })

  it('reads a plain object identically (guards a duplicated module copy)', () => {
    expect(iomStatus({ status: 412 })).toBe(412)
  })

  it('returns undefined for a non-io2p error', () => {
    expect(iomStatus(new Error('network'))).toBeUndefined()
    expect(iomStatus(null)).toBeUndefined()
    expect(iomStatus({ status: 'nope' })).toBeUndefined()
  })
})

describe('iomDetail', () => {
  it('returns the problem detail when present', () => {
    expect(
      iomDetail(new ValidationError(problem(422, 'key must be unique')))
    ).toBe('key must be unique')
  })

  it('ignores an absent or blank detail', () => {
    expect(iomDetail(new ValidationError(problem(422)))).toBeUndefined()
    expect(iomDetail({ detail: '   ' })).toBeUndefined()
    expect(iomDetail(new Error('boom'))).toBeUndefined()
  })
})

describe('saveErrorMessage', () => {
  it('maps a stale If-Match and a plain conflict to the same message', () => {
    expect(saveErrorMessage(new PreconditionFailedError(problem(412)))).toEqual(
      {
        key: 'objects.saveError.conflict',
      }
    )
    expect(saveErrorMessage(new ConflictError(problem(409)))).toEqual({
      key: 'objects.saveError.conflict',
    })
  })

  it('surfaces the server detail on a validation failure', () => {
    expect(
      saveErrorMessage(new ValidationError(problem(422, 'name is required')))
    ).toEqual({
      key: 'objects.saveError.invalid',
      values: { detail: 'name is required' },
    })
  })

  it('falls back to the generic message when a 422 carries no detail', () => {
    expect(saveErrorMessage(new ValidationError(problem(422)))).toEqual({
      key: 'common.saveFailed',
    })
  })

  it('maps the remaining statuses', () => {
    expect(saveErrorMessage(new ForbiddenError(problem(403))).key).toBe(
      'objects.permissionDenied'
    )
    expect(saveErrorMessage(new NotFoundError(problem(404))).key).toBe(
      'objects.saveError.notFound'
    )
    expect(saveErrorMessage(new UnauthorizedError(problem(401))).key).toBe(
      'common.sessionExpired'
    )
  })

  it('falls back to saveFailed for an unmapped status or a network error', () => {
    expect(saveErrorMessage(new ApiError(problem(500))).key).toBe(
      'common.saveFailed'
    )
    expect(saveErrorMessage(new Error('Failed to fetch')).key).toBe(
      'common.saveFailed'
    )
  })
})

describe('isCallerAbort', () => {
  it('treats a raw AbortError as a cancellation', () => {
    expect(
      isCallerAbort(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    ).toBe(true)
  })

  it('unwraps an AbortError carried as the SDK wrapper error cause', () => {
    const wrapped = Object.assign(new Error('request failed'), {
      cause: Object.assign(new Error('aborted'), { name: 'AbortError' }),
    })
    expect(isCallerAbort(wrapped)).toBe(true)
  })

  // A request that ran out of its budget is a real failure. TimeoutError is a
  // NetworkError subclass and shares status 0 with aborts, so only the name
  // separates them — getting this backwards silences genuine node trouble.
  it('does NOT treat a timeout as a cancellation', () => {
    expect(
      isCallerAbort(
        Object.assign(new Error('timed out'), { name: 'TimeoutError' })
      )
    ).toBe(false)
  })

  it('says no for ordinary errors and non-objects', () => {
    expect(isCallerAbort(new Error('boom'))).toBe(false)
    expect(isCallerAbort('AbortError')).toBe(false)
    expect(isCallerAbort(null)).toBe(false)
    expect(isCallerAbort(undefined)).toBe(false)
  })
})

describe('error reported marker', () => {
  it('reports false until marked', () => {
    const err = new Error('boom')
    expect(wasErrorReported(err)).toBe(false)
    markErrorReported(err)
    expect(wasErrorReported(err)).toBe(true)
  })

  // The mark must never reach a sink: the ship/NDJSON paths serialize with
  // JSON.stringify, and the log record is assembled by spreading context.
  it('stays invisible to JSON.stringify, spreads and key enumeration', () => {
    const err: Record<string, unknown> = { name: 'Error', message: 'boom' }
    markErrorReported(err)
    expect(JSON.stringify(err)).toBe('{"name":"Error","message":"boom"}')
    expect(Object.keys(err)).toEqual(['name', 'message'])
    expect(wasErrorReported({ ...err })).toBe(false)
  })

  it('survives a frozen error without throwing', () => {
    const frozen = Object.freeze(new Error('boom'))
    expect(() => markErrorReported(frozen)).not.toThrow()
    // Worst case the failure is logged twice — never a crash in a log path.
    expect(wasErrorReported(frozen)).toBe(false)
  })

  it('ignores non-objects', () => {
    expect(() => markErrorReported('boom')).not.toThrow()
    expect(wasErrorReported('boom')).toBe(false)
    expect(wasErrorReported(null)).toBe(false)
  })
})

describe('isUnreadable', () => {
  it('treats a forbidden or missing GET as an expected outcome', () => {
    expect(isUnreadable('GET', 403)).toBe(true)
    expect(isUnreadable('GET', 404)).toBe(true)
    expect(isUnreadable('HEAD', 404)).toBe(true)
  })

  it('is case-insensitive about the method', () => {
    expect(isUnreadable('get', 404)).toBe(true)
  })

  it('keeps a failed WRITE at error level', () => {
    expect(isUnreadable('PATCH', 404)).toBe(false)
    expect(isUnreadable('DELETE', 404)).toBe(false)
    expect(isUnreadable('POST', 403)).toBe(false)
  })

  it('does not swallow other read failures', () => {
    expect(isUnreadable('GET', 500)).toBe(false)
    expect(isUnreadable('GET', 401)).toBe(false)
    expect(isUnreadable('GET', 0)).toBe(false)
    expect(isUnreadable('GET', undefined)).toBe(false)
  })
})

describe('isMintInterrupted', () => {
  const mintAborted = () =>
    new NetworkError('token mint interrupted', {
      method: 'GET',
      url: 'https://node.test/api/v1/me',
    })

  it('recognises a mint the browser killed mid-navigation', () => {
    expect(isMintInterrupted(mintAborted())).toBe(true)
  })

  // The distinction the whole branch rests on: a real outage is ALSO a status-0
  // NetworkError, and it must keep reaching Sentry at error level.
  it('does NOT match a genuine outage', () => {
    const nodeDown = new NetworkError('network request failed', {
      method: 'GET',
      url: 'https://node.test/api/v1/objects',
    })
    expect(isMintInterrupted(nodeDown)).toBe(false)
  })

  it('does not match an HTTP failure that happens to mention the mint', () => {
    expect(
      isMintInterrupted(new ApiError(problem(500, 'token mint interrupted')))
    ).toBe(false)
  })

  it('is safe on non-errors', () => {
    expect(isMintInterrupted(undefined)).toBe(false)
    expect(isMintInterrupted('token mint interrupted')).toBe(false)
  })
})

describe('isCallerCancelled', () => {
  it('covers both routes a caller can cancel by', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const mint = new NetworkError('token mint interrupted', {
      method: 'GET',
      url: 'https://node.test/api/v1/me',
    })
    expect(isCallerCancelled(abort)).toBe(true)
    expect(isCallerCancelled(mint)).toBe(true)
  })

  // The whole point of the predicate: a real outage is still a failure to report.
  it('does not swallow a genuine outage', () => {
    const nodeDown = new NetworkError('network request failed', {
      method: 'GET',
      url: 'https://node.test/api/v1/objects',
    })
    expect(isCallerCancelled(nodeDown)).toBe(false)
    expect(isCallerCancelled(new ApiError(problem(500)))).toBe(false)
  })
})

// Guards the omission that leaked four records per suite run: `isMintInterrupted` was added and
// only ONE of three handlers learned about it. Every cancellation check must go through the shared
// predicate, so widening the vocabulary widens everywhere at once.
describe('cancellation checks stay in one place', () => {
  it('no handler asks isCallerAbort directly', async () => {
    const { readFileSync } = await import('node:fs')
    const files = ['src/contexts/query-context.tsx', 'src/lib/io2p.ts']
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} should use isCallerCancelled`).not.toMatch(
        /isCallerAbort\(/
      )
    }
  })
})
