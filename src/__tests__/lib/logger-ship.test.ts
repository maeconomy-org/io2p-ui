// Ship sink behavior: batching, dedupe (repeat → counter), the per-minute
// hard cap, and beacon flush when the page is going away.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { buildRecord } from '@/lib/logger/core'
import { resetShipStateForTests, shipRecord, shipSink } from '@/lib/logger/ship'

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

  it('uses sendBeacon for records produced while the page is hidden', () => {
    const spy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    shipRecord(buildRecord('error', 'parting words'))
    expect(beaconMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exposes a Sink whose write enqueues', () => {
    shipSink.write(buildRecord('info', 'via sink'))
    vi.advanceTimersByTime(5_000)
    expect(sentBatches()[0].records[0].msg).toBe('via sink')
  })
})
