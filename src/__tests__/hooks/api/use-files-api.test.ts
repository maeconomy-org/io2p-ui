import { describe, it, expect } from 'vitest'

import { presignedStaleTime } from '@/hooks/api/use-files-api'

function fakeQuery(expiresAt: string | undefined, dataUpdatedAt: number) {
  return {
    state: {
      data: expiresAt ? { url: 'https://x', expiresAt } : undefined,
      dataUpdatedAt,
    },
  }
}

describe('presignedStaleTime', () => {
  it('derives staleTime from expiresAt minus a 60s refresh lead', () => {
    const now = 1_700_000_000_000
    // Server says URL expires 15 min after fetch.
    const expiresAt = new Date(now + 15 * 60_000).toISOString()
    const stale = presignedStaleTime(fakeQuery(expiresAt, now))
    // 15min - 60s = 14min = 840_000ms.
    expect(stale).toBe(14 * 60_000)
  })

  it('respects the 60s minimum even when server issues a very short TTL', () => {
    const now = 1_700_000_000_000
    // Server issues a tiny 30-second TTL — derived stale would be negative.
    const expiresAt = new Date(now + 30_000).toISOString()
    const stale = presignedStaleTime(fakeQuery(expiresAt, now))
    expect(stale).toBe(60_000)
  })

  it('falls back to 14 min when no expiresAt is present yet (initial fetch)', () => {
    const stale = presignedStaleTime(fakeQuery(undefined, Date.now()))
    expect(stale).toBe(14 * 60_000)
  })

  it('falls back to 14 min when expiresAt is unparseable', () => {
    const stale = presignedStaleTime(fakeQuery('not-a-date', Date.now()))
    expect(stale).toBe(14 * 60_000)
  })
})
