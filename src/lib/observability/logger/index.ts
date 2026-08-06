// Public logger surface. Call sites keep `import { logger } from '@/lib/observability/logger'`.
//
// API (error-first): logger.error(msg, fields?) with the Error under
// `fields.err`. Old shapes (Error-as-context, `{ error }`) are tolerated by
// the serializer so stragglers degrade gracefully instead of losing stacks.
//
// Sink matrix:
//   server   → NDJSON stdout (always) + OTel bridge (when OTEL_ENABLED)
//   browser  → console (dev / localStorage opt-in), Sentry (errors, real
//              exception), ship sink → /api/telemetry (registered by ship.ts)

import type { LogLevel } from './core'
import { createLogger, normalizeLevel } from './core'
import { ndjsonSink, otelBridgeActive, otelBridgeSink } from './server'
import {
  consoleSink,
  consoleThreshold,
  sentrySink,
  shipThreshold,
} from './client'
import { shipSink } from './ship'

const isServer = typeof window === 'undefined'
const isProduction = process.env.NODE_ENV === 'production'

// Server emit gate: LOG_LEVEL env var (a real env read is fine here — this
// branch only runs in Node). Invalid values fall back instead of logging
// everything. Browser thresholds live in client.ts and read __IOM_CONFIG__ —
// process.env compiles away in the browser, which was the old F1 bug.
function serverThreshold(): LogLevel {
  return normalizeLevel(process.env.LOG_LEVEL, isProduction ? 'info' : 'debug')
}

export const logger = createLogger(
  isServer
    ? [
        { sink: ndjsonSink, threshold: serverThreshold },
        {
          sink: otelBridgeSink,
          threshold: () => (otelBridgeActive() ? serverThreshold() : 'off'),
        },
      ]
    : [
        { sink: consoleSink, threshold: consoleThreshold },
        { sink: sentrySink, threshold: () => 'error' },
        { sink: shipSink, threshold: shipThreshold },
      ]
)

export { shipThreshold, LOG_LEVEL_STORAGE_KEY } from './client'
export type {
  LogFields,
  LogLevel,
  LogRecord,
  SerializedError,
  Sink,
} from './core'
