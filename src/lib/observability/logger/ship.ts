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
// Per-record ceilings so one huge record (a deep ctx, a monster stack) can't
// exceed the route's payload cap on its own and become guaranteed-lost.
const MAX_STRING_FIELD_CHARS = 8 * 1024
const MAX_RECORD_BYTES = 32 * 1024

const TELEMETRY_URL = '/api/telemetry'

const encoder = new TextEncoder()

/** Byte length as the wire will see it — NOT the UTF-16 char count. */
function byteLength(s: string): number {
  return encoder.encode(s).length
}

interface QueuedRecord {
  rec: Record<string, unknown>
  key: string
}

let queue: QueuedRecord[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

// HMR guard: module state resets on hot replace, but the old listeners stay
// attached — install the listeners once (flag on globalThis) and route them
// through a globalThis function pointer that every module instance refreshes,
// so post-HMR flushes hit the LIVE queue, not the orphaned one.
const LISTENERS_KEY = Symbol.for('io2p.shipListenersInstalled')
const FLUSH_KEY = Symbol.for('io2p.shipFlush')

type GlobalWithShip = typeof globalThis & {
  [LISTENERS_KEY]?: boolean
  [FLUSH_KEY]?: (useBeacon?: boolean) => void
}

// Dedupe: identical record repeated inside the window increments a counter on
// the queued copy instead of enqueuing again.
const seen = new Map<string, { at: number; queued: QueuedRecord | null }>()

// Hard throttle: at most MAX_RECORDS_PER_MINUTE enqueued records per minute.
let minuteWindowStart = 0
let minuteCount = 0

function dedupeKey(rec: LogRecordWithRaw): string | null {
  // Web vitals are measurements, not repeats: CLS/INP legitimately re-report
  // within seconds and each report matters — exempt them from dedupe (the
  // per-minute cap still applies).
  if (rec.category === 'web-vital') return null
  const err = rec.err as { name?: string; message?: string } | undefined
  return [rec.level, rec.msg, err?.name ?? '', err?.message ?? ''].join('|')
}

function toWireRecord(rec: LogRecordWithRaw): Record<string, unknown> {
  // The raw error rides under a symbol key, which JSON.stringify skips — but
  // strip it anyway so the wire shape is exactly the serializable record.
  const { [rawError]: _ignored, ...copy } = rec
  return truncateRecord(copy)
}

// Clamp message/detail/title/stack RECURSIVELY through the cause chain
// (mirrors auth-ui's truncateStacks) — a single error with a giant message
// used to sail through the stack-only clamp and produce a >64KB wire record,
// which the route rejects wholesale.
function truncateErr(
  err: Record<string, unknown>,
  depth = 6
): Record<string, unknown> {
  const out = { ...err }
  for (const k of ['message', 'detail', 'title', 'stack'] as const) {
    const v = out[k]
    if (typeof v === 'string' && v.length > MAX_STRING_FIELD_CHARS) {
      out[k] = v.slice(0, MAX_STRING_FIELD_CHARS)
    }
  }
  if (depth > 0 && out.cause && typeof out.cause === 'object') {
    out.cause = truncateErr(out.cause as Record<string, unknown>, depth - 1)
  }
  return out
}

// Clamp oversized string fields (stacks, blobs of ctx), then — if the record
// is still over the per-record byte budget — degrade in tiers rather than
// lose the record: first drop the context, finally drop everything but a
// bare name/message error. Better a clipped record than a whole lost batch.
function truncateRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const clamped: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'string' && v.length > MAX_STRING_FIELD_CHARS) {
      clamped[k] = v.slice(0, MAX_STRING_FIELD_CHARS)
    } else if (k === 'err' && v && typeof v === 'object') {
      clamped[k] = truncateErr(v as Record<string, unknown>)
    } else {
      clamped[k] = v
    }
  }
  try {
    if (byteLength(JSON.stringify(clamped)) <= MAX_RECORD_BYTES) {
      return clamped
    }
  } catch {
    // Unserializable ctx — fall through to the minimal shape.
  }
  // Tier 2: keep the spine — the CLAMPED err (no re-inclusion of the raw
  // one), losing someone's giant context beats losing the error.
  const { level, time, msg } = clamped
  const err = clamped.err as Record<string, unknown> | undefined
  const minimal = { level, time, msg, err, truncated: true }
  try {
    if (byteLength(JSON.stringify(minimal)) <= MAX_RECORD_BYTES) {
      return minimal
    }
  } catch {
    // Fall through.
  }
  // Tier 3: pathological err (deep cause chain, huge `problem` object) —
  // bare name/message is always bounded (message is already clamped).
  return {
    level,
    time,
    msg,
    ...(err ? { err: { name: err.name, message: err.message } } : {}),
    truncated: true,
  }
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
    const size = byteLength(JSON.stringify(next.rec))
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

function sendViaFetch(
  records: Record<string, unknown>[],
  allowSplit: boolean
): void {
  void fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
    // Lets an in-flight batch outlive its page on same-tab navigations.
    keepalive: true,
  })
    .then((res) => {
      // A 413 means the server's byte cap and our budget disagree (a proxy
      // with a smaller cap, a misjudged truncation limit). Halving once
      // recovers everything except a single monster record; no recursion —
      // a cap we misjudged once we may misjudge again, and retry loops are
      // the flood this sink exists to prevent.
      if (res.status === 413 && allowSplit && records.length > 1) {
        const mid = Math.ceil(records.length / 2)
        sendViaFetch(records.slice(0, mid), false)
        sendViaFetch(records.slice(mid), false)
      }
    })
    .catch(() => {
      // Telemetry must never break the app — silent drop.
    })
}

function flush(useBeacon = false): void {
  while (queue.length > 0) {
    const batch = takeBatch()
    if (batch.length === 0) return
    try {
      if (useBeacon && typeof navigator.sendBeacon === 'function') {
        // sendBeacon can REFUSE synchronously (queue full, size cap) and
        // says so in its return value — on false, fall through to keepalive
        // fetch, which also survives most unloads.
        const accepted = navigator.sendBeacon(
          TELEMETRY_URL,
          new Blob([JSON.stringify({ records: batch })], {
            type: 'application/json',
          })
        )
        if (!accepted) sendViaFetch(batch, true)
      } else {
        sendViaFetch(batch, true)
      }
    } catch {
      // Silent drop.
    }
    if (!useBeacon) break // one batch per tick; the rest re-schedules
  }
  if (queue.length > 0) scheduleFlush()
}

function installLifecycleFlush(): void {
  if (typeof window === 'undefined') return
  const g = globalThis as GlobalWithShip
  g[FLUSH_KEY] = flush // always point at THIS module instance's flush
  if (g[LISTENERS_KEY]) return
  g[LISTENERS_KEY] = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') g[FLUSH_KEY]?.(true)
  })
  window.addEventListener('pagehide', () => g[FLUSH_KEY]?.(true))
}

/**
 * Enqueue a record directly (bypasses the logger's level gate — used by the
 * web-vitals reporter). Dedupe and the per-minute cap still apply.
 */
export function shipRecord(rec: LogRecordWithRaw): void {
  if (typeof window === 'undefined') return
  installLifecycleFlush()

  const now = Date.now()
  const key = dedupeKey(rec) // null = dedupe-exempt (web vitals)
  if (key !== null) {
    const entry = seen.get(key)
    if (entry && now - entry.at < DEDUPE_WINDOW_MS) {
      // Repeat inside the window: count it on the queued copy if one is
      // still waiting, otherwise drop it — an error loop becomes one record
      // plus a count.
      if (entry.queued) {
        entry.queued.rec.repeats =
          ((entry.queued.rec.repeats as number) || 0) + 1
      }
      return
    }
  }
  if (throttled(now)) return

  const queued: QueuedRecord = { rec: toWireRecord(rec), key: key ?? '' }
  if (key !== null) seen.set(key, { at: now, queued })
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
