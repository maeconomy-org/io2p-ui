import { after, NextRequest, NextResponse } from 'next/server'

import {
  LOG_LEVELS,
  levelPasses,
  normalizeLevel,
  type LogLevel,
  type LogRecord,
} from '@/lib/observability/logger/core'
import { ndjsonSink } from '@/lib/observability/logger/server'
import { logger } from '@/lib/observability/logger'
import { redactValue } from '@/lib/observability/redact'
import {
  checkSimpleRateLimit,
  getClientIdentifier,
} from '@/lib/http/rate-limit'

// Same-origin telemetry ingest for the browser ship sink (observability plan
// §1.6): ad-blocker-proof, the OTLP ingest key stays server-side, and this is
// the rate-limit chokepoint. Anonymous records are accepted on purpose —
// login-page errors are worth having — which is exactly why the limiter and
// the payload cap are strict.
//
// Contract with the browser: the client only ever sees 204, 413 or 429.
// Every other failure is a silent drop with one server log line — telemetry
// must never become an error source of its own.

const MAX_PAYLOAD_BYTES = 64 * 1024
const MAX_RECORDS_PER_BATCH = 50
const MAX_FIELD_STRING = 4 * 1024
// Generous for real usage, cheap to hold against a hostile loop: the ship
// sink already self-throttles at 60 records/min per page.
const RATE_LIMIT_MAX_BATCHES = 60
const RATE_LIMIT_WINDOW_SECONDS = 60

const SEVERITY_NUMBER: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
}

// Clamp EVERY string leaf, not just top-level fields. The longest strings a
// record carries — `err.stack`, `err.message`, a nested ctx blob — are never
// at depth 0, so a top-level-only pass left the 64KB payload cap as their
// only bound. The browser clamps too, but this function exists precisely
// because the browser is not trusted. Runs on the output of `redactValue`,
// which is already an acyclic copy, so no cycle guard is needed here.
const CLAMP_DEPTH = 6

function clampDeep(value: unknown, depth = CLAMP_DEPTH): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_FIELD_STRING
      ? value.slice(0, MAX_FIELD_STRING)
      : value
  }
  if (value === null || typeof value !== 'object') return value
  if (depth <= 0) return undefined
  if (Array.isArray(value)) return value.map((v) => clampDeep(v, depth - 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = clampDeep(v, depth - 1)
  }
  return out
}

function sanitizeRecord(raw: unknown): LogRecord | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const rec = raw as Record<string, unknown>
  if (!LOG_LEVELS.includes(rec.level as LogLevel)) return null
  if (typeof rec.msg !== 'string' || rec.msg.length === 0) return null

  // Re-scrub server-side: the browser scrubbed at record build time, but the
  // proxy must not trust its callers.
  const out = clampDeep(redactValue(rec)) as Record<string, unknown>

  // Overwrite ONLY the fields this route owns. `msg` is deliberately left as
  // the scrubbed value — taking `rec.msg` back would defeat the re-scrub in
  // the one field most likely to carry a secret, because a presigned URL
  // reaches a log through interpolation (`upload failed for ${url}`) far more
  // often than through a named context key.
  out.level = rec.level
  // `time` is client-supplied and therefore attacker-controlled: clamp it to
  // now ± 1h so a hostile batch cannot backdate or future-date log lines
  // (which would poison time-ordered queries in the collector).
  out.time = clampTime(rec.time)
  out.source = 'browser'
  return out as LogRecord
}

const MAX_TIME_SKEW_MS = 60 * 60 * 1000

function clampTime(value: unknown): string {
  const now = Date.now()
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN
  if (Number.isNaN(parsed)) return new Date(now).toISOString()
  if (Math.abs(parsed - now) > MAX_TIME_SKEW_MS) {
    return new Date(now).toISOString()
  }
  return new Date(parsed).toISOString()
}

// The NDJSON path bypasses the logger's level gate (records are written to
// the sink directly), so re-apply the server's LOG_LEVEL here — a browser
// configured to ship debug must not flood a prod server that logs at info.
function serverLevelAdmits(level: LogLevel): boolean {
  const threshold = normalizeLevel(
    process.env.LOG_LEVEL,
    process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  )
  return levelPasses(level, threshold)
}

function toOtlpLogsPayload(records: LogRecord[]): unknown {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'io2p-ui' } },
            {
              key: 'service.version',
              value: { stringValue: process.env.APP_VERSION || 'unknown' },
            },
            {
              key: 'deployment.environment',
              value: {
                stringValue: process.env.DEPLOYMENT_ENVIRONMENT || 'unknown',
              },
            },
            { key: 'io2p.telemetry.source', value: { stringValue: 'browser' } },
          ],
        },
        scopeLogs: [
          {
            scope: { name: 'io2p-ui-browser' },
            logRecords: records.map((rec) => {
              const { level, time, msg, ...rest } = rec
              const timeMs = Date.parse(time)
              return {
                timeUnixNano: String(
                  (Number.isNaN(timeMs) ? Date.now() : timeMs) * 1_000_000
                ),
                severityNumber: SEVERITY_NUMBER[level],
                severityText: level.toUpperCase(),
                body: { stringValue: msg },
                attributes: Object.entries(rest).map(([key, value]) => ({
                  key,
                  value: {
                    stringValue:
                      typeof value === 'string' ? value : JSON.stringify(value),
                  },
                })),
              }
            }),
          },
        ],
      },
    ],
  }
}

function parseOtlpHeaders(): Record<string, string> {
  // OTEL_EXPORTER_OTLP_HEADERS uses the W3C Baggage-ish `k=v,k2=v2` format.
  const raw = process.env.OTEL_EXPORTER_OTLP_HEADERS
  const headers: Record<string, string> = {}
  if (!raw) return headers
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=')
    if (idx > 0) {
      headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
    }
  }
  return headers
}

const OTLP_FORWARD_TIMEOUT_MS = 3_000

async function forwardToOtlp(
  endpoint: string,
  records: LogRecord[]
): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...parseOtlpHeaders(),
      },
      body: JSON.stringify(toOtlpLogsPayload(records)),
      // A hung collector must not hold request handlers open.
      signal: AbortSignal.timeout(OTLP_FORWARD_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

// One line per process for repeated forward failures, not one per batch.
let loggedForwardFailure = false

function writeToNdjson(records: LogRecord[]): void {
  for (const rec of records) {
    // The direct sink write bypasses the logger's gate — re-apply LOG_LEVEL
    // so browser debug shipping cannot flood a prod server's stdout.
    if (serverLevelAdmits(rec.level)) {
      ndjsonSink.write(rec)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require a declared length: a chunked body would have to be buffered in
    // full BEFORE any size check could run, which hands a memory-pressure
    // lever to anonymous callers. fetch/sendBeacon always set Content-Length
    // for string/Blob bodies, so legitimate ship-sink traffic is unaffected.
    // nginx client_max_body_size remains the backstop in front of this.
    const declaredHeader = request.headers.get('content-length')
    if (!declaredHeader) {
      return new NextResponse(null, { status: 411 })
    }
    const declared = parseInt(declaredHeader)
    if (Number.isNaN(declared) || declared > MAX_PAYLOAD_BYTES) {
      return new NextResponse(null, { status: 413 })
    }

    const identifier = getClientIdentifier(request)
    const { allowed } = checkSimpleRateLimit(
      'telemetry',
      identifier,
      RATE_LIMIT_MAX_BATCHES,
      RATE_LIMIT_WINDOW_SECONDS
    )
    if (!allowed) {
      // Retry-After tells a well-behaved client when the fixed window rolls
      // over; the ship sink drops rather than retries, but proxies and any
      // future caller read it.
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) },
      })
    }

    const text = await request.text()
    // Byte length, not UTF-16 char count — the cap and the wire must agree.
    if (Buffer.byteLength(text, 'utf8') > MAX_PAYLOAD_BYTES) {
      return new NextResponse(null, { status: 413 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return new NextResponse(null, { status: 204 }) // silent drop
    }

    const rawRecords = (parsed as { records?: unknown })?.records
    if (!Array.isArray(rawRecords)) {
      return new NextResponse(null, { status: 204 })
    }

    const records = rawRecords
      .slice(0, MAX_RECORDS_PER_BATCH)
      .map(sanitizeRecord)
      .filter((r): r is LogRecord => r !== null)

    if (records.length === 0) {
      return new NextResponse(null, { status: 204 })
    }

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    if (endpoint) {
      // Fire-and-forget: the 204 does not wait on the collector, and a
      // failed forward degrades to the NDJSON stream instead of losing the
      // batch (stdout is always available; the collector is not).
      const forward = () =>
        forwardToOtlp(endpoint, records)
          .then((ok) => {
            if (ok) {
              loggedForwardFailure = false
              return
            }
            writeToNdjson(records)
            if (!loggedForwardFailure) {
              loggedForwardFailure = true
              logger.warn(
                'Telemetry OTLP forward failing, degrading to NDJSON; will not repeat this log'
              )
            }
          })
          .catch(() => {
            // forwardToOtlp never rejects, but telemetry must never throw.
          })
      try {
        // Next's sanctioned post-response mechanism: a bare floating promise
        // dies with the process (a SIGTERM inside the 3s window would lose
        // both the forward AND the NDJSON degrade); `after` keeps the
        // handler's work alive until it settles.
        after(forward)
      } catch {
        // Outside a request scope (unit tests) — run it directly.
        void forward()
      }
    } else {
      // No collector configured: land browser records in the server NDJSON
      // stream, tagged source: 'browser' (set in sanitizeRecord).
      writeToNdjson(records)
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Never surface telemetry failures to the client.
    logger.warn('Telemetry ingest failed', { err: error })
    return new NextResponse(null, { status: 204 })
  }
}
