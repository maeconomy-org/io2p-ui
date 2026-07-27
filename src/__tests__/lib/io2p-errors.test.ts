import { describe, it, expect } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  IomError,
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
  ValidationError,
} from 'io2p-client'

import { iomDetail, iomStatus, saveErrorMessage } from '@/lib/io2p-errors'

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
    expect(iomStatus(new IomError(problem(500)))).toBe(500)
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
    expect(saveErrorMessage(new IomError(problem(500))).key).toBe(
      'common.saveFailed'
    )
    expect(saveErrorMessage(new Error('Failed to fetch')).key).toBe(
      'common.saveFailed'
    )
  })
})
