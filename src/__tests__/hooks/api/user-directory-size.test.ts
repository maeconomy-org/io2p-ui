import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Regression: the directory asked for `size: 200` while the node caps `size` at 100, so
 * `GET /v1/users` 400'd every time. Nothing surfaced — `nameOf` just fell back to raw ids and the
 * Owner column quietly showed uuids, which reads as "the API has no names" rather than as a bug.
 *
 * Asserted against the source rather than a mocked client because the value is a module constant:
 * the thing worth pinning is the literal, not a call that happens to use it.
 */
describe('user directory page size', () => {
  const source = readFileSync(
    resolve(__dirname, '../../../hooks/api/users.ts'),
    'utf8'
  )

  const sizesIn = (text: string) =>
    [...text.matchAll(/size:\s*(\d+)/g)].map((m) => Number(m[1]))

  it('never requests more than the node ceiling of 100', () => {
    const sizes = sizesIn(source)
    expect(sizes.length).toBeGreaterThan(0)
    for (const size of sizes) {
      expect(size).toBeLessThanOrEqual(100)
      expect(size).toBeGreaterThan(0)
    }
  })

  it('searches server-side, so a picker can reach past the first page', () => {
    // Filtering a fixed page client-side cannot find the 101st user; `q` can.
    expect(source).toContain('q: trimmed || undefined')
  })
})
