import { describe, it, expect } from 'vitest'

import {
  DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
  MAX_LIST_PAGE_SIZE,
} from '@/constants'

/**
 * The node caps a list `size` at 100 and answers 400 above it — it does not clamp.
 *
 * This has now been got wrong twice. `/v1/users` once asked for 200 and 400'd on every render, and
 * the Owner column showed uuids as if the API had no names. Four more callers were then found
 * asking 200 for `/v1/constants`, so the formula editor's constant list was empty on every screen
 * that used it, with nothing on screen to say why.
 *
 * The value is asserted here rather than only at each call site, because the recurrence was never a
 * typo — it was four people independently picking "a big number" with nothing to pick from.
 */
describe('MAX_LIST_PAGE_SIZE', () => {
  it('matches the ceiling the node actually enforces', () => {
    expect(MAX_LIST_PAGE_SIZE).toBe(100)
  })

  it('is not smaller than the largest size a user can choose', () => {
    // A page-size option above the ceiling would 400 the moment it was selected — the control would
    // offer a value the node refuses.
    expect(Math.max(...DEFAULT_TABLE_PAGE_SIZE_OPTIONS)).toBeLessThanOrEqual(
      MAX_LIST_PAGE_SIZE
    )
  })
})
