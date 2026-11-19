import { describe, expect, it } from 'vitest'
import type { ImportJobDTO } from 'io2p-client'

import { endedWithoutRunning, isTerminal } from '@/hooks/api/imports'

const job = (over: Partial<ImportJobDTO>): ImportJobDTO =>
  ({
    id: 'j1',
    status: 'completed',
    total: 500,
    staged: 500,
    processed: 0,
    ok: 0,
    failed: 0,
    skipped: 0,
    levels: 1,
    currentLevel: 0,
    ...over,
  }) as ImportJobDTO

describe('endedWithoutRunning', () => {
  // Discarding a draft made this state reachable: core deletes the staged rows and keeps `total`
  // as the history entry, so every counter is zero while `total` is not. Read as an outcome it is
  // "no failures", which renders as total success — "0 objects created. Every row was created."
  it('is true for a discarded draft', () => {
    expect(
      endedWithoutRunning(job({ status: 'cancelled', processed: 0 }))
    ).toBe(true)
  })

  it('is true for a job that failed before attempting a row', () => {
    expect(endedWithoutRunning(job({ status: 'failed', processed: 0 }))).toBe(
      true
    )
  })

  it('is false for a job cancelled part-way, which has a real outcome', () => {
    const partial = job({ status: 'cancelled', processed: 120, ok: 118 })
    expect(endedWithoutRunning(partial)).toBe(false)
  })

  it('is false while a job can still attempt rows', () => {
    // A draft has zero processed too, and is NOT over — it has its own headline.
    expect(endedWithoutRunning(job({ status: 'draft', processed: 0 }))).toBe(
      false
    )
    expect(endedWithoutRunning(job({ status: 'queued', processed: 0 }))).toBe(
      false
    )
    expect(endedWithoutRunning(job({ status: 'running', processed: 0 }))).toBe(
      false
    )
  })

  it('is false for a completed job that attempted everything', () => {
    const done = job({ status: 'completed', processed: 500, ok: 500 })
    expect(endedWithoutRunning(done)).toBe(false)
  })
})

describe('isTerminal', () => {
  it('covers exactly the four states the worker will not move again', () => {
    expect(
      ['completed', 'completed_with_errors', 'failed', 'cancelled'].every(
        isTerminal
      )
    ).toBe(true)
    expect(['draft', 'queued', 'running'].some(isTerminal)).toBe(false)
  })
})
