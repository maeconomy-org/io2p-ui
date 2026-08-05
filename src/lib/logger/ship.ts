// Browser ship sink: batches log records and POSTs them to the same-origin
// /api/telemetry proxy (observability plan §1.6). This is what makes the prod
// browser observable while its console stays dark: records at/above
// `logShipLevel` leave the page in small batches, with client-side dedupe and
// a hard per-minute cap so an error loop cannot flood the endpoint.

import type { LogRecordWithRaw, Sink } from './core'
import { rawError } from './core'

const FLUSH_INTERVAL_MS = 5_000
const MAX_BATCH_RECORDS = 20
const MAX_BATCH_BYTES = 60_000 // stay under the route's 64KB payload cap
const DEDUPE_WINDOW_MS = 30_000
const MAX_RECORDS_PER_MINUTE = 60

const TELEMETRY_URL = '/api/telemetry'

interface QueuedRecord {
  rec: Record<string, unknown>
  key: string
}

let queue: QueuedRecord[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersInstalled = false

// Dedupe: identical record repeated inside the window increments a counter on
// the queued copy instead of enqueuing again.
const seen = new Map<string, { at: number; queued: QueuedRecord | null }>()

// Hard throttle: at most MAX_RECORDS_PER_MINUTE enqueued records per minute.
let minuteWindowStart = 0
let minuteCount = 0

function dedupeKey(rec: LogRecordWithRaw): string {
  const err = rec.err as { name?: string; message?: string } | undefined
  return [rec.level, rec.msg, err?.name ?? '', err?.message ?? ''].join('|')
}

function toWireRecord(rec: LogRecordWithRaw): Record<string, unknown> {
  // The raw error rides under a symbol key, which JSON.stringify skips — but
  // strip it anyway so the wire shape is exactly the serializable record.
  const { [rawError]: _ignored, ...copy } = rec
  return copy
}

function throttled(now: number): boolean {
  if (now - minuteWindowStart >= 60_000) {
    minuteWindowStart = now
    minuteCount = 0
  }
  if (minuteCount >= MAX_RECORDS_PER_MINUTE) return true
  minuteCount++
  return false
}

function scheduleFlush(): void {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

function takeBatch(): Record<string, unknown>[] {
  const batch: Record<string, unknown>[] = []
  let bytes = 0
  while (queue.length > 0 && batch.length < MAX_BATCH_RECORDS) {
    const next = queue[0]
    const size = JSON.stringify(next.rec).length
    if (bytes + size > MAX_BATCH_BYTES && batch.length > 0) break
    queue.shift()
    if (next.key && seen.get(next.key)?.queued === next) {
      const entry = seen.get(next.key)
      if (entry) entry.queued = null
    }
    batch.push(next.rec)
    bytes += size
  }
  return batch
}

function flush(useBeacon = false): void {
  while (queue.length > 0) {
    const batch = takeBatch()
    if (batch.length === 0) return
    const body = JSON.stringify({ records: batch })
    try {
      if (useBeacon && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(
          TELEMETRY_URL,
          new Blob([body], { type: 'application/json' })
        )
      } else {
        void fetch(TELEMETRY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          // Telemetry must never break the app — silent drop.
        })
      }
    } catch {
      // Silent drop.
    }
    if (!useBeacon) break // one batch per tick; the rest re-schedules
  }
  if (queue.length > 0) scheduleFlush()
}

function installLifecycleFlush(): void {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true)
  })
  window.addEventListener('pagehide', () => flush(true))
}

/**
 * Enqueue a record directly (bypasses the logger's level gate — used by the
 * web-vitals reporter). Dedupe and the per-minute cap still apply.
 */
export function shipRecord(rec: LogRecordWithRaw): void {
  if (typeof window === 'undefined') return
  installLifecycleFlush()

  const now = Date.now()
  const key = dedupeKey(rec)
  const entry = seen.get(key)
  if (entry && now - entry.at < DEDUPE_WINDOW_MS) {
    // Repeat inside the window: count it on the queued copy if one is still
    // waiting, otherwise drop it — an error loop becomes one record + count.
    if (entry.queued) {
      entry.queued.rec.repeats = ((entry.queued.rec.repeats as number) || 0) + 1
    }
    return
  }
  if (throttled(now)) return

  const queued: QueuedRecord = { rec: toWireRecord(rec), key }
  seen.set(key, { at: now, queued })
  // Opportunistic GC of expired dedupe entries.
  if (seen.size > 200) {
    for (const [k, v] of seen) {
      if (now - v.at >= DEDUPE_WINDOW_MS) seen.delete(k)
    }
  }
  queue.push(queued)
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    // Records produced while the page is going away (web-vitals finalize on
    // visibilitychange) cannot wait for the timer — beacon them now.
    flush(true)
  } else if (queue.length >= MAX_BATCH_RECORDS) {
    flush()
  } else {
    scheduleFlush()
  }
}

export const shipSink: Sink = {
  write(rec) {
    shipRecord(rec)
  },
}

/** Test seam. */
export function resetShipStateForTests(): void {
  queue = []
  seen.clear()
  minuteWindowStart = 0
  minuteCount = 0
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}
