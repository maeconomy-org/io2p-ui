import { NextRequest, NextResponse } from 'next/server'

import { LOG_LEVELS, type LogLevel, type LogRecord } from '@/lib/logger/core'
import { ndjsonSink } from '@/lib/logger/server'
import { logger } from '@/lib/logger'
import { redactValue } from '@/lib/redact'
import { checkSimpleRateLimit, getClientIdentifier } from '@/lib/security-utils'

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

function clampString(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_FIELD_STRING) {
    return value.slice(0, MAX_FIELD_STRING)
  }
  return value
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
  const scrubbed = redactValue(rec) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(scrubbed)) {
    out[k] = clampString(v)
  }
  out.level = rec.level
  out.msg = clampString(rec.msg)
  out.time = typeof rec.time === 'string' ? rec.time : new Date().toISOString()
  out.source = 'browser'
  return out as LogRecord
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
    })
    return res.ok
  } catch {
    return false
  }
}

// One line per process for repeated forward failures, not one per batch.
let loggedForwardFailure = false

export async function POST(request: NextRequest) {
  try {
    // Payload cap before reading the body when the client declared a length.
    const declared = parseInt(request.headers.get('content-length') || '0')
    if (declared > MAX_PAYLOAD_BYTES) {
      return new NextResponse(null, { status: 413 })
    }

    const identifier = getClientIdentifier(request)
    const { allowed } = await checkSimpleRateLimit(
      'telemetry',
      identifier,
      RATE_LIMIT_MAX_BATCHES,
      RATE_LIMIT_WINDOW_SECONDS
    )
    if (!allowed) {
      return new NextResponse(null, { status: 429 })
    }

    const text = await request.text()
    if (text.length > MAX_PAYLOAD_BYTES) {
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
      const ok = await forwardToOtlp(endpoint, records)
      if (!ok && !loggedForwardFailure) {
        loggedForwardFailure = true
        logger.warn('Telemetry OTLP forward failing; will not repeat this log')
      }
      if (ok) loggedForwardFailure = false
    } else {
      // No collector configured: land browser records in the server NDJSON
      // stream, tagged source: 'browser' (set in sanitizeRecord).
      for (const rec of records) {
        ndjsonSink.write(rec)
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Never surface telemetry failures to the client.
    logger.warn('Telemetry ingest failed', { err: error })
    return new NextResponse(null, { status: 204 })
  }
}
