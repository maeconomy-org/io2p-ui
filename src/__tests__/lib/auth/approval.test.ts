import { describe, expect, it } from 'vitest'

import { isPendingApproval } from '@/lib/auth/approval'

describe('isPendingApproval', () => {
  it('holds a social account until it is active', () => {
    expect(isPendingApproval({ origin: 'social', status: 'pending' })).toBe(
      true
    )
    expect(isPendingApproval({ origin: 'social' })).toBe(true)
    expect(isPendingApproval({ origin: 'social', status: 'active' })).toBe(
      false
    )
  })

  it('never holds an account an operator created, or no account', () => {
    expect(isPendingApproval({ origin: 'invite' })).toBe(false)
    expect(isPendingApproval({})).toBe(false)
    expect(isPendingApproval(null)).toBe(false)
  })
})
