// Route error boundary behavior: the boundary must hand the REAL Error to the
// logger under `err` (no flattening to { message, digest }) and include
// `digest` only when it exists — it is only populated for errors that crossed
// the server boundary, so logging it unconditionally made every client-side
// boundary hit look half-broken.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import ErrorBoundary from '@/app/error'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

const mockError = vi.fn()
vi.mock('@/lib/observability/logger', () => ({
  logger: { error: (...args: unknown[]) => mockError(...args) },
}))

beforeEach(() => vi.clearAllMocks())

describe('route error boundary', () => {
  it('logs the real Error under err', () => {
    const error = new Error('useObjectListFilters is not defined')
    render(<ErrorBoundary error={error} reset={() => {}} />)

    expect(mockError).toHaveBeenCalledTimes(1)
    const [msg, fields] = mockError.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(msg).toBe('Unhandled error in route segment')
    // Identity: the boundary must not rebuild or flatten the Error.
    expect(fields.err).toBe(error)
    expect('message' in fields).toBe(false)
  })

  it('includes digest only when present', () => {
    const clientError = new Error('client render error')
    render(<ErrorBoundary error={clientError} reset={() => {}} />)
    expect(
      'digest' in (mockError.mock.calls[0][1] as Record<string, unknown>)
    ).toBe(false)

    mockError.mockClear()
    const serverError = Object.assign(new Error('server error'), {
      digest: 'abc123',
    })
    render(<ErrorBoundary error={serverError} reset={() => {}} />)
    expect((mockError.mock.calls[0][1] as Record<string, unknown>).digest).toBe(
      'abc123'
    )
  })
})
