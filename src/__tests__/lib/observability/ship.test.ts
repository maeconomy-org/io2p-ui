// Ship sink behavior: batching, dedupe (repeat → counter), the per-minute
// hard cap, and beacon flush when the page is going away.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { buildRecord } from '@/lib/observability/logger/core'
import {
  resetShipStateForTests,
  shipRecord,
  shipSink,
} from '@/lib/observability/logger/ship'

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
const beaconMock = vi.fn(() => true)

function sentBatches(): { records: Record<string, unknown>[] }[] {
  return fetchMock.mock.calls.map((call) =>
    JSON.parse((call as unknown as [string, { body: string }])[1].body)
  )
}

describe('ship sink', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetShipStateForTests()
    fetchMock.mockClear()
    beaconMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    resetShipStateForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('batches records and flushes on the interval', () => {
    shipRecord(buildRecord('error', 'first'))
    shipRecord(buildRecord('warn', 'second'))
    expect(fetchMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [batch] = sentBatches()
    expect(batch.records.map((r) => r.msg)).toEqual(['first', 'second'])
  })

  it('never puts the raw error on the wire, only the serialized err', () => {
    shipRecord(buildRecord('error', 'boom', { err: new Error('kaput') }))
    vi.advanceTimersByTime(5_000)
    const [batch] = sentBatches()
    const rec = batch.records[0]
    expect((rec.err as { message: string }).message).toBe('kaput')
  })

  it('dedupes identical records into a repeat counter', () => {
    shipRecord(buildRecord('error', 'same failure', { err: new Error('x') }))
    shipRecord(buildRecord('error', 'same failure', { err: new Error('x') }))
    shipRecord(buildRecord('error', 'same failure', { err: new Error('x') }))
    vi.advanceTimersByTime(5_000)

    const [batch] = sentBatches()
    expect(batch.records).toHaveLength(1)
    expect(batch.records[0].repeats).toBe(2)
  })

  it('hard-caps records per minute so an error loop cannot flood', () => {
    for (let i = 0; i < 200; i++) {
      shipRecord(buildRecord('error', `distinct failure ${i}`))
    }
    // Drain every scheduled flush inside the same minute.
    vi.advanceTimersByTime(30_000)
    const total = sentBatches().reduce((n, b) => n + b.records.length, 0)
    expect(total).toBeLessThanOrEqual(60)
    expect(total).toBeGreaterThan(0)
  })

  it('exempts web-vital records from dedupe — re-reports are measurements', () => {
    const vital = (value: number) => ({
      ...buildRecord('info', 'web-vital CLS', {
        category: 'web-vital',
        metric: 'CLS',
        value,
      }),
    })
    shipRecord(vital(0.01))
    shipRecord(vital(0.05))
    shipRecord(vital(0.09))
    vi.advanceTimersByTime(5_000)

    const [batch] = sentBatches()
    expect(batch.records).toHaveLength(3)
    expect(batch.records.map((r) => r.value)).toEqual([0.01, 0.05, 0.09])
  })

  it('truncates oversized records instead of losing the whole batch', () => {
    const err = new Error('big')
    err.stack = 'x'.repeat(100_000)
    shipRecord(buildRecord('error', 'huge', { err, blob: 'y'.repeat(100_000) }))
    vi.advanceTimersByTime(5_000)

    const [batch] = sentBatches()
    const rec = batch.records[0]
    expect((rec.err as { stack: string }).stack.length).toBeLessThanOrEqual(
      8 * 1024
    )
    expect(
      new TextEncoder().encode(JSON.stringify(rec)).length
    ).toBeLessThanOrEqual(32 * 1024)
    expect(rec.msg).toBe('huge')
  })

  it('uses sendBeacon for records produced while the page is hidden', () => {
    const spy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    shipRecord(buildRecord('error', 'parting words'))
    expect(beaconMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('falls back to keepalive fetch when sendBeacon refuses the batch', () => {
    beaconMock.mockReturnValueOnce(false)
    const spy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    shipRecord(buildRecord('error', 'refused by beacon'))
    expect(beaconMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, { keepalive: boolean }]
    )[1]
    expect(init.keepalive).toBe(true)
    spy.mockRestore()
  })

  it('splits a 413-rejected batch in half once, never recursively', async () => {
    // All three sends get a 413 — the halves must NOT split again.
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 413 }) as never)
      .mockResolvedValueOnce(new Response(null, { status: 413 }) as never)
      .mockResolvedValueOnce(new Response(null, { status: 413 }) as never)
    shipRecord(buildRecord('error', 'first'))
    shipRecord(buildRecord('error', 'second'))
    vi.advanceTimersByTime(5_000)
    // Original send + two halves — and although the halves ALSO got 413,
    // no further splits (retry loops are the flood this sink prevents).
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const halves = fetchMock.mock.calls
      .slice(1)
      .map(
        (c) =>
          JSON.parse((c as unknown as [string, { body: string }])[1].body)
            .records
      )
    expect(halves[0].map((r: { msg: string }) => r.msg)).toEqual(['first'])
    expect(halves[1].map((r: { msg: string }) => r.msg)).toEqual(['second'])
  })

  it('clamps a giant err.message through the cause chain — batch survives', () => {
    // Control the stacks (V8 embeds the message in .stack) so this pins the
    // MESSAGE clamp, recursively — the old code clamped only stacks.
    const cause = new Error('y'.repeat(100_000))
    cause.stack = 'Error: cause frame'
    const err = new Error('x'.repeat(100_000), { cause })
    err.stack = 'Error: top frame'
    shipRecord(buildRecord('error', 'monster message', { err }))
    vi.advanceTimersByTime(5_000)

    const [batch] = sentBatches()
    expect(batch.records).toHaveLength(1)
    const rec = batch.records[0]
    const recErr = rec.err as { message: string; cause?: { message: string } }
    expect(recErr.message.length).toBeLessThanOrEqual(8 * 1024)
    expect(recErr.cause?.message.length).toBeLessThanOrEqual(8 * 1024)
    expect(
      new TextEncoder().encode(JSON.stringify(rec)).length
    ).toBeLessThanOrEqual(32 * 1024)
  })

  it('degrades a pathological record to a bare err instead of losing it', () => {
    // Message AND stack both huge on every level: even clamped, the record
    // exceeds the per-record budget — the bare name/message tier must ship.
    const cause = new Error('y'.repeat(100_000))
    const err = new Error('x'.repeat(100_000), { cause })
    shipRecord(buildRecord('error', 'beyond salvage', { err }))
    vi.advanceTimersByTime(5_000)

    const [batch] = sentBatches()
    expect(batch.records).toHaveLength(1)
    const rec = batch.records[0]
    expect(rec.truncated).toBe(true)
    expect(rec.msg).toBe('beyond salvage')
    const recErr = rec.err as { name: string; message: string }
    expect(recErr.name).toBe('Error')
    expect(recErr.message.length).toBeLessThanOrEqual(8 * 1024)
    expect(
      new TextEncoder().encode(JSON.stringify(rec)).length
    ).toBeLessThanOrEqual(32 * 1024)
  })

  it('exposes a Sink whose write enqueues', () => {
    shipSink.write(buildRecord('info', 'via sink'))
    vi.advanceTimersByTime(5_000)
    expect(sentBatches()[0].records[0].msg).toBe('via sink')
  })
})
