import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatClock, formatDuration, n } from '@/app/import/components/format'

/**
 * These went untested for as long as they shared a file with two React components: reaching them
 * meant rendering, so nobody did. Nothing here needs a DOM.
 */

const START = new Date('2026-08-07T12:00:00Z').getTime()
const at = (seconds: number) => START + seconds * 1000

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDuration', () => {
  it('renders seconds under a minute', () => {
    expect(formatDuration(START, at(42))).toBe('42s')
  })

  it('pads the seconds once minutes appear, so the column stays aligned', () => {
    expect(formatDuration(START, at(63))).toBe('1m 03s')
    expect(formatDuration(START, at(600))).toBe('10m 00s')
  })

  it('measures a RUNNING job against the wall clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(at(30)))
    expect(formatDuration(START, undefined)).toBe('30s')
  })

  it('shows an em dash rather than a number when the job never started', () => {
    // `startedAt` is `number | undefined` on the DTO, so absent means undefined. The guard is
    // `!from`, which also swallows 0 — harmless, because epoch 0 is not a time any job has.
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(undefined, at(5))).toBe('—')
    expect(formatDuration(0, at(5))).toBe('—')
  })

  it('never reports negative time when the clocks disagree', () => {
    expect(formatDuration(at(10), at(5))).toBe('0s')
  })
})

describe('formatClock', () => {
  it('shows an em dash for a missing instant', () => {
    expect(formatClock(undefined)).toBe('—')
  })

  it('renders a two-digit hour and minute', () => {
    expect(formatClock(new Date('2026-08-07T09:05:00').getTime())).toMatch(
      /\b09[:.]05\b/
    )
  })
})

describe('n', () => {
  it('groups thousands', () => {
    // Assert the GROUPING, not the separator character: it comes from the browser locale, so
    // pinning "1,847" would fail under a Dutch one for the right reason.
    expect(n(1847)).toMatch(/^1\D847$/)
    expect(n(0)).toBe('0')
    expect(n(999)).toBe('999')
  })
})
