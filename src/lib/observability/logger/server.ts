// Server sink: hand-rolled NDJSON to stdout. NOT pino, on purpose — 46 of the
// 58 files importing `@/lib/observability/logger` are client components, so anything
// reachable from the logger's module graph ships to the browser. ~40 lines of
// NDJSON cost nothing there; pino would need a second import path plus a
// server-only guard and would stay one careless import away from shipping.
//
// stdout is the only file-like sink by design (Azure Container Apps;
// 12-factor). The platform log driver owns files/rotation. Key shape
// { level, time, msg, err, ...ctx } matches pino/io2p-core so lines are
// byte-comparable across repos.

import type { LogRecord, Sink } from './core'

export const ndjsonSink: Sink = {
  write(rec: LogRecord): void {
    // JSON.stringify skips the rawError symbol key by language rules, so the
    // original Error object never reaches the wire — only the serialized
    // `err` field does.
    try {
      process.stdout.write(JSON.stringify(rec) + '\n')
    } catch {
      // Never let logging throw. Last-ditch fallback for circular leftovers.
      try {
        const { level, time, msg } = rec
        process.stdout.write(
          JSON.stringify({ level, time, msg, logError: 'unserializable' }) +
            '\n'
        )
      } catch {
        // stdout itself is gone — nothing left to do.
      }
    }
  },
}

// OTel bridge seam (observability phase 3): instrumentation.node.ts sets a
// log emitter on globalThis when OTEL_ENABLED=true. A globalThis handoff —
// not a module-level registry — because Next bundles instrumentation.ts
// separately from route code, so module instances are not guaranteed shared.
// NDJSON stays on regardless of the bridge.
export const OTEL_LOG_SINK = Symbol.for('io2p.otelLogSink')

type GlobalWithOtel = typeof globalThis & {
  [OTEL_LOG_SINK]?: Sink
}

export const otelBridgeSink: Sink = {
  write(rec: LogRecord): void {
    ;(globalThis as GlobalWithOtel)[OTEL_LOG_SINK]?.write(rec)
  },
}

export function otelBridgeActive(): boolean {
  return (globalThis as GlobalWithOtel)[OTEL_LOG_SINK] !== undefined
}
