import { describe, it, expect } from 'vitest'
import { ForbiddenError, NotFoundError, ValidationError } from 'io2p-client'

import { retryQuery } from '@/contexts/query-context'

function problem(status: number) {
  return { type: 'about:blank', title: 'Error', status }
}

describe('retryQuery', () => {
  it('does not retry a verdict the node will repeat', () => {
    expect(retryQuery(0, new NotFoundError(problem(404)))).toBe(false)
    expect(retryQuery(0, new ForbiddenError(problem(403)))).toBe(false)
    expect(retryQuery(0, new ValidationError(problem(422)))).toBe(false)
  })

  it('retries once on a server fault', () => {
    const error = problem(503)
    expect(retryQuery(0, error)).toBe(true)
    expect(retryQuery(1, error)).toBe(false)
  })

  it('retries a failure that carries no status, such as a network drop', () => {
    expect(retryQuery(0, new Error('offline'))).toBe(true)
  })

  it('retries the two 4xx that invite a second try', () => {
    expect(retryQuery(0, problem(408))).toBe(true)
    expect(retryQuery(0, problem(429))).toBe(true)
  })

  it('stops at one attempt for anything retryable', () => {
    expect(retryQuery(1, problem(429))).toBe(false)
    expect(retryQuery(1, undefined)).toBe(false)
  })
})
