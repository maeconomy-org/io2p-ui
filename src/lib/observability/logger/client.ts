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
import { LOG_LEVELS, normalizeLevel, rawError } from './core'

export const LOG_LEVEL_STORAGE_KEY = 'iom:log-level'

const isProduction = process.env.NODE_ENV === 'production'

// Read the override fresh on every call: it only runs when a record is
// actually emitted, a localStorage read is nanoseconds at that scale, and it
// makes a same-tab `localStorage.setItem('iom:log-level', ...)` take effect
// immediately — the `storage` event only fires in OTHER tabs, so a cache
// keyed on it forced a reload in the tab doing the debugging.
function readOverride(): string | null {
  try {
    return window.localStorage.getItem(LOG_LEVEL_STORAGE_KEY)
  } catch {
    return null
  }
}

/** A configured level value: a real level, or 'off' to silence the sink. */
function validConfigured(value: unknown): LogLevel | 'off' | null {
  if (value === 'off') return 'off'
  if (LOG_LEVELS.includes(value as LogLevel)) return value as LogLevel
  return null
}

/**
 * Browser console level precedence:
 *   localStorage['iom:log-level'] > config.logLevel > 'warn' dev / OFF prod
 * Only a VALID override counts — an invalid value falls through to the
 * config/default path rather than turning the prod console on via a
 * fallback level.
 */
export function consoleThreshold(): LogLevel | 'off' {
  const override = validConfigured(readOverride())
  if (override !== null) return override
  if (isProduction) return 'off'
  const config = getCachedConfig()
  return normalizeLevel(config?.logLevel, 'info')
}

/**
 * Ship threshold — config-driven (`logShipLevel` via __IOM_CONFIG__).
 * `off` is a first-class value: LOG_SHIP_LEVEL=off must disable shipping in
 * production too, not fall back to 'info'. Prod default: 'info' (plan §5
 * config matrix). Dev default: off — the dev server would only echo what the
 * browser console already shows.
 */
export function shipThreshold(): LogLevel | 'off' {
  const configured = validConfigured(getCachedConfig()?.logShipLevel)
  if (configured !== null) return configured
  return isProduction ? 'info' : 'off'
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
