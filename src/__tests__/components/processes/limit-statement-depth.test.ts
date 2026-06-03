import { describe, it, expect } from 'vitest'
import {
  limitStatementDepth,
  getMaxStatementDepth,
  computeStatementDepths,
} from '@/components/processes/utils'

describe('limitStatementDepth', () => {
  it('keeps nodes within the depth limit on a simple chain', () => {
    const statements = [
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'd' },
    ]
    const kept = limitStatementDepth(statements, 2)
    // a (0), b (1) are within depth < 2; c (2), d (3) are not
    expect(kept.has('a')).toBe(true)
    expect(kept.has('b')).toBe(true)
    expect(kept.has('c')).toBe(false)
  })

  it('uses LONGEST path, so a shortcut edge does not make a deep node shallow', () => {
    // a -> b -> c -> d  (d is 3 deep) AND a -> d (a one-hop shortcut to d).
    // d's longest depth is 3, so at limit 3 it must be excluded — the shortcut
    // must not pull it in. (This was the bug: shortest-path kept everything.)
    const statements = [
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'd' },
      { subject: 'a', object: 'd' },
    ]
    const kept = limitStatementDepth(statements, 3)
    expect(kept.has('a')).toBe(true) // 0
    expect(kept.has('b')).toBe(true) // 1
    expect(kept.has('c')).toBe(true) // 2
    expect(kept.has('d')).toBe(false) // longest depth 3 → excluded
  })

  it('terminates on a cyclic graph (regression: used to hang)', () => {
    // a -> b -> c -> a  (a recycling-style cycle)
    const statements = [
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'a' },
    ]
    // The bug here was an unbounded longest-path relaxation that never
    // terminated. If it regresses, this test hangs (and the suite times out).
    const kept = limitStatementDepth(statements, 3)
    expect(kept.size).toBeGreaterThan(0)
  })

  it('handles a cycle reachable from a root without hanging', () => {
    // root -> a -> b -> c -> a (cycle downstream of a root)
    const statements = [
      { subject: 'root', object: 'a' },
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'a' },
    ]
    const kept = limitStatementDepth(statements, 5)
    expect(kept.has('root')).toBe(true)
  })

  it('returns empty for no statements', () => {
    expect(limitStatementDepth([], 3).size).toBe(0)
  })

  describe('depth window (minLevel offset)', () => {
    // a(0) -> b(1) -> c(2) -> d(3) -> e(4)
    const chain = [
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'd' },
      { subject: 'd', object: 'e' },
    ]

    it('slides the window deeper: minLevel 2, size 2 keeps levels 2–3 only', () => {
      const kept = limitStatementDepth(chain, 2, undefined, 2)
      expect(kept.has('a')).toBe(false) // 0
      expect(kept.has('b')).toBe(false) // 1
      expect(kept.has('c')).toBe(true) // 2
      expect(kept.has('d')).toBe(true) // 3
      expect(kept.has('e')).toBe(false) // 4
    })

    it('a deeper window does NOT re-pin rootless cycle/isolated nodes', () => {
      // x <-> y is an isolated 2-cycle (no depth); it should only appear in the
      // base window (minLevel 0), never in a slid one.
      const withCycle = [
        ...chain,
        { subject: 'x', object: 'y' },
        { subject: 'y', object: 'x' },
      ]
      const base = limitStatementDepth(withCycle, 2, undefined, 0)
      expect(base.has('x')).toBe(true)
      const deeper = limitStatementDepth(withCycle, 2, undefined, 2)
      expect(deeper.has('x')).toBe(false)
      expect(deeper.has('y')).toBe(false)
    })
  })

  describe('min-span layering (computeStatementDepths)', () => {
    // a→b→c→d is the long chain; x is a leaf input that feeds ONLY the deep node d.
    // Source-justify would strand x at column 0 (far from d); the min-span rule must
    // place it right before d so it isn't orphaned in the first depth slice.
    const statements = [
      { subject: 'a', object: 'b' },
      { subject: 'b', object: 'c' },
      { subject: 'c', object: 'd' },
      { subject: 'x', object: 'd' },
    ]

    it('places a leaf input next to its deep consumer, not at column 0', () => {
      const depths = computeStatementDepths(statements)
      expect(depths.get('a')).toBe(0)
      expect(depths.get('d')).toBe(3)
      expect(depths.get('x')).toBe(2) // just before d (3), NOT stranded at 0
    })

    it('pulls an interior node tight when a parallel longer path deepens its consumer', () => {
      // g→w→f is a short path; r→c→l→f is longer, so the shared consumer f is deep.
      // w (a Hotel-Window analogue) has a producer, so it isn't a leaf — it must still
      // be pulled next to f (span 1), not left stranded at its asap of 1.
      const statements = [
        { subject: 'r', object: 'c' },
        { subject: 'c', object: 'l' },
        { subject: 'l', object: 'f' },
        { subject: 'g', object: 'w' },
        { subject: 'w', object: 'f' },
        { subject: 'f', object: 't' },
      ]
      const depths = computeStatementDepths(statements)
      expect(depths.get('f')).toBe(3)
      expect(depths.get('w')).toBe(2) // pulled to just before f (3), NOT asap (1)
      expect(depths.get('g')).toBe(1)
    })

    it('keeps an early-produced sink next to its producer, not pushed right', () => {
      // a→b→c→d→e is the long chain (e deepest at 4); s is a terminal output
      // produced early, off c. Sink-justify (ALAP) would shove s to column 4 and
      // draw a long c→s edge; min-span keeps it right after c.
      const withEarlySink = [
        { subject: 'a', object: 'b' },
        { subject: 'b', object: 'c' },
        { subject: 'c', object: 'd' },
        { subject: 'd', object: 'e' },
        { subject: 'c', object: 's' },
      ]
      const depths = computeStatementDepths(withEarlySink)
      expect(depths.get('c')).toBe(2)
      expect(depths.get('e')).toBe(4)
      expect(depths.get('s')).toBe(3) // right after c (2), NOT at the far edge (4)
    })

    it('windows the leaf input together with its consumer', () => {
      // Deep slice [2,4) holds both x and d — they travel together.
      const deep = limitStatementDepth(statements, 2, undefined, 2)
      expect(deep.has('x')).toBe(true)
      expect(deep.has('d')).toBe(true)
      // Base slice [0,2) must NOT contain x anymore (the old stranding bug).
      const base = limitStatementDepth(statements, 2, undefined, 0)
      expect(base.has('x')).toBe(false)
    })

    it('keeps every edge valid: depth(parent) < depth(child)', () => {
      const depths = computeStatementDepths(statements)
      for (const { subject, object } of statements) {
        expect(depths.get(subject)!).toBeLessThan(depths.get(object)!)
      }
    })
  })

  describe('getMaxStatementDepth', () => {
    it('reports the longest-path depth (0-based)', () => {
      const statements = [
        { subject: 'a', object: 'b' },
        { subject: 'b', object: 'c' },
        { subject: 'c', object: 'd' },
      ]
      expect(getMaxStatementDepth(statements)).toBe(3) // d is 3 deep → 4 levels
    })

    it('is 0 for an empty graph', () => {
      expect(getMaxStatementDepth([])).toBe(0)
    })

    it('does not hang on a cycle', () => {
      const cyclic = [
        { subject: 'a', object: 'b' },
        { subject: 'b', object: 'a' },
      ]
      expect(getMaxStatementDepth(cyclic)).toBe(0)
    })
  })
})
