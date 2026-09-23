import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rollupRules = { list: vi.fn() }

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ rollupRules }),
}))

import { ruleMultipliers, useRollupRules } from '@/hooks/api/rollup-rules'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

const rule = (propertyKey: string, by?: string) => ({
  propertyKey,
  ...(by && { multiplyBy: { propertyKey: by } }),
})

describe('ruleMultipliers', () => {
  it('maps each rule to the key it multiplies by, in lower case', () => {
    expect(ruleMultipliers([], [rule('Mass', 'Quantity')])).toEqual(
      new Map([['mass', 'quantity']])
    )
  })

  // A user's own rule REPLACES the built-in on that user's objects.
  it('lets the user’s own rule replace the built-in on the same key', () => {
    expect(
      ruleMultipliers([rule('mass', 'count')], [rule('mass', 'quantity')])
    ).toEqual(new Map([['mass', 'count']]))
  })

  it('drops the built-in’s multiplier when the user’s rule has none', () => {
    expect(ruleMultipliers([rule('mass')], [rule('mass', 'quantity')])).toEqual(
      new Map()
    )
  })
})

describe('useRollupRules().useMultipliers', () => {
  beforeEach(() => {
    rollupRules.list.mockReset()
    rollupRules.list.mockImplementation(async (q: { system: boolean }) => ({
      data: q.system ? [rule('mass', 'quantity')] : [],
    }))
  })

  it('reads the caller’s rules and the built-ins', async () => {
    const { result } = renderHook(() => useRollupRules().useMultipliers(true), {
      wrapper,
    })
    await waitFor(() =>
      expect(result.current).toEqual(new Map([['mass', 'quantity']]))
    )
  })

  // Another owner's objects are totalled by that owner's rules: asking would warn about the wrong
  // ones, so a grantee's sheet asks nothing.
  it('asks nothing and answers nothing when switched off', () => {
    const { result } = renderHook(
      () => useRollupRules().useMultipliers(false),
      { wrapper }
    )
    expect(result.current).toBeUndefined()
    expect(rollupRules.list).not.toHaveBeenCalled()
  })
})
