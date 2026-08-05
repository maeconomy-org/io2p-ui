// Browser sinks: console (dev, or explicit localStorage opt-in), Sentry
// (error-level records, real exception). The ship sink (→ /api/telemetry)
// registers through `logger.addSink` from ship.ts.
//
// Prod browser policy (observability plan §1.7): console sink OFF by design;
// ship sink ON. The localStorage override `iom:log-level` is the opt-in
// escape hatch that re-enables console on a production session without a
// redeploy — default dark.

import * as Sentry from '@sentry/nextjs'

import { getCachedConfig } from '@/constants/client'
import type { LogLevel, LogRecordWithRaw, Sink } from './core'
import { normalizeLevel, rawError } from './core'

export const LOG_LEVEL_STORAGE_KEY = 'iom:log-level'

const isProduction = process.env.NODE_ENV === 'production'

// The override is read once and re-read on the `storage` event, so a second
// tab can flip it without reloading this one.
let storedOverride: string | null | undefined
function readOverride(): string | null {
  if (storedOverride !== undefined) return storedOverride
  try {
    storedOverride = window.localStorage.getItem(LOG_LEVEL_STORAGE_KEY)
  } catch {
    storedOverride = null
  }
  return storedOverride
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOG_LEVEL_STORAGE_KEY || e.key === null) {
      storedOverride = undefined
    }
  })
}

/**
 * Browser console level precedence:
 *   localStorage['iom:log-level'] > config.logLevel > 'warn' prod / 'info' dev
 * In production the console sink is OFF unless the localStorage override is
 * present (explicit debug opt-in).
 */
export function consoleThreshold(): LogLevel | 'off' {
  const override = readOverride()
  if (override) return normalizeLevel(override, isProduction ? 'warn' : 'info')
  if (isProduction) return 'off'
  const config = getCachedConfig()
  return normalizeLevel(config?.logLevel, 'info')
}

/** Ship threshold — config-driven (`logShipLevel` via __IOM_CONFIG__). */
export function shipThreshold(): LogLevel | 'off' {
  const config = getCachedConfig()
  return normalizeLevel(config?.logShipLevel, 'info')
}

export const consoleSink: Sink = {
  write(rec: LogRecordWithRaw): void {
    const { level, time, msg, err: _err, ...ctx } = rec
    const prefix = `[${time}] [${level.toUpperCase()}]`
    // Pass the REAL error as its own argument so devtools renders a live,
    // source-mapped stack — the serialized copy is for the wire sinks.
    const raw = rec[rawError]
    const args: unknown[] = [prefix, msg]
    if (Object.keys(ctx).length > 0) args.push(ctx)
    if (raw !== undefined) args.push(raw)

    switch (level) {
      case 'debug':
        console.debug(...args)
        break
      case 'info':
        console.info(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  },
}

/**
 * Sentry sink: error-level records only (threshold pinned to 'error' at
 * registration). Captures the REAL error — never `new Error(message)`, which
 * used to group every error in the app under logger.ts frames. The message
 * travels as context. When Sentry is not initialized (dev without the flag),
 * capture calls are SDK no-ops.
 */
export const sentrySink: Sink = {
  write(rec: LogRecordWithRaw): void {
    const { level: _l, time: _t, msg, err: _e, ...ctx } = rec
    const raw = rec[rawError]
    if (raw !== undefined) {
      Sentry.captureException(raw, {
        level: 'error',
        extra: { message: msg, ...ctx },
      })
    } else {
      Sentry.captureMessage(msg, {
        level: 'error',
        extra: ctx,
      })
    }
  },
}
