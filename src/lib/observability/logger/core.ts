// Isomorphic logger core: level gate, error serializer, redaction, record
// shape, sink interface. No I/O in this module — sinks own the output
// (server.ts → NDJSON stdout, client.ts → console/Sentry/ship). This is what
// keeps `@/lib/observability/logger` safe inside the client module graph: 46 of the 58
// importers are 'use client' components.

import { redactValue, redactPresignedUrlString } from '../redact'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: readonly LogLevel[] = [
  'debug',
  'info',
  'warn',
  'error',
]

/**
 * Normalize an untrusted level value. An invalid value falls back to the
 * given default — the previous logger's `indexOf` returned -1 for a typo'd
 * LOG_LEVEL, which made `>= -1` always true and logged EVERYTHING.
 */
export function normalizeLevel(value: unknown, fallback: LogLevel): LogLevel {
  return LOG_LEVELS.includes(value as LogLevel) ? (value as LogLevel) : fallback
}

/** true when a record at `recordLevel` passes a sink gated at `threshold`. */
export function levelPasses(
  recordLevel: LogLevel,
  threshold: LogLevel
): boolean {
  return LOG_LEVELS.indexOf(recordLevel) >= LOG_LEVELS.indexOf(threshold)
}

export interface SerializedError {
  name: string
  message: string
  stack?: string
  // ApiError / problem+json enrichment
  status?: number
  title?: string
  detail?: string
  problem?: unknown
  cause?: SerializedError
}

export type LogFields = Record<string, unknown> & { err?: unknown }

/**
 * The one record shape every sink receives. NDJSON on the server, the same
 * keys in browser records — pino's key convention ({ level, time, msg, err })
 * so core/auth/UI logs are byte-comparable and any OTel log bridge maps 1:1.
 */
export type LogRecord = {
  level: LogLevel
  time: string
  msg: string
  err?: SerializedError
} & Record<string, unknown>

export interface Sink {
  write(rec: LogRecord): void
}

/**
 * The original (unserialized) error travels on the record under this symbol.
 * JSON.stringify skips symbol keys, so NDJSON/ship sinks never see it, while
 * the console sink can render a real source-mapped stack and the Sentry sink
 * can capture the REAL exception instead of fabricating one.
 */
export const rawError = Symbol('io2p.rawError')

export type LogRecordWithRaw = LogRecord & { [rawError]?: unknown }

function serializeCause(cause: unknown, depth: number): SerializedError {
  return serializeErrorInner(cause, depth)
}

function serializeErrorInner(err: unknown, depth: number): SerializedError {
  if (err instanceof Error) {
    const out: SerializedError = {
      name: err.name,
      message: redactPresignedUrlString(err.message),
    }
    if (typeof err.stack === 'string') {
      out.stack = redactPresignedUrlString(err.stack)
    }
    // ApiError enrichment by shape, not instanceof — a duplicated module copy
    // (ESM + CJS in one graph) makes instanceof silently false.
    const anyErr = err as unknown as Record<string, unknown>
    if (typeof anyErr.status === 'number') out.status = anyErr.status
    if (typeof anyErr.title === 'string') out.title = anyErr.title
    if (typeof anyErr.detail === 'string') {
      out.detail = redactPresignedUrlString(anyErr.detail)
    }
    if (anyErr.problem !== undefined) {
      out.problem = redactValue(anyErr.problem)
    }
    if (anyErr.cause !== undefined && depth > 0) {
      out.cause = serializeCause(anyErr.cause, depth - 1)
    }
    return out
  }
  if (typeof err === 'string') {
    return { name: 'Error', message: redactPresignedUrlString(err) }
  }
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    const message =
      typeof anyErr.message === 'string' ? anyErr.message : safeString(err)
    const out: SerializedError = {
      name: typeof anyErr.name === 'string' ? anyErr.name : 'NonError',
      message: redactPresignedUrlString(message),
    }
    if (typeof anyErr.status === 'number') out.status = anyErr.status
    if (typeof anyErr.detail === 'string') {
      out.detail = redactPresignedUrlString(anyErr.detail)
    }
    if (anyErr.cause !== undefined && depth > 0) {
      out.cause = serializeCause(anyErr.cause, depth - 1)
    }
    return out
  }
  return { name: 'NonError', message: safeString(err) }
}

function safeString(value: unknown): string {
  try {
    return String(value)
  } catch {
    return '[Unserializable]'
  }
}

/** Serialize anything a catch block can produce. Walks `cause` chains. */
export function serializeError(err: unknown): SerializedError {
  return serializeErrorInner(err, 5)
}

/**
 * Build the record. Error-first API: the Error travels under `fields.err`.
 * Old call shapes are tolerated so the migration stays mechanical:
 *   logger.error('msg', error)          → treated as { err: error }
 *   logger.error('msg', { error })      → `error` promoted to `err`
 *   logger.error('msg', 'some string')  → { data: 'some string' }
 */
export function buildRecord(
  level: LogLevel,
  msg: string,
  fields?: unknown
): LogRecordWithRaw {
  let err: unknown
  let ctx: Record<string, unknown> = {}

  if (fields instanceof Error) {
    err = fields
  } else if (fields !== undefined && fields !== null) {
    if (typeof fields === 'object' && !Array.isArray(fields)) {
      const {
        err: e,
        error: legacyErr,
        ...rest
      } = fields as LogFields & {
        error?: unknown
      }
      if (e !== undefined) {
        err = e
        if (legacyErr !== undefined) rest.error = legacyErr
      } else if (
        legacyErr instanceof Error ||
        (legacyErr !== undefined && level === 'error')
      ) {
        // Legacy `{ error }` shape — promote so the stack survives.
        err = legacyErr
      } else if (legacyErr !== undefined) {
        rest.error = legacyErr
      }
      ctx = rest
    } else {
      ctx = { data: fields }
    }
  }

  // Strip reserved keys from context BEFORE spreading: a ctx field named
  // `level`/`time`/`msg`/`err` must never overwrite the record's core fields
  // (and the core fields stay first, which keeps the NDJSON key order).
  const {
    level: _ctxLevel,
    time: _ctxTime,
    msg: _ctxMsg,
    err: _ctxErr,
    ...safeCtx
  } = redactValue(ctx) as Record<string, unknown>

  const rec: LogRecordWithRaw = {
    level,
    time: new Date().toISOString(),
    msg,
    // Which page the record came from. Sentry derives this itself via
    // httpContextIntegration; every other sink (NDJSON, ship → /api/telemetry,
    // OTel) had no page context at all, so triaging from server logs could not
    // say where an error happened. `pathname` only — a query string is a
    // credential until proven otherwise (redact.ts cannot see inside a value).
    ...(typeof window !== 'undefined'
      ? { page: window.location.pathname }
      : {}),
    ...(err !== undefined ? { err: serializeError(err) } : {}),
    ...safeCtx,
  }
  if (err !== undefined) rec[rawError] = err
  return rec
}

interface SinkRegistration {
  sink: Sink
  /** Called per record — thresholds can change at runtime (localStorage). */
  threshold: () => LogLevel | 'off'
}

export interface CoreLogger {
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  /** Registration seam — the ship sink (browser) and OTel bridge (server) attach here. */
  addSink(sink: Sink, threshold: () => LogLevel | 'off'): void
}

export function createLogger(
  registrations: SinkRegistration[] = []
): CoreLogger {
  const sinks: SinkRegistration[] = [...registrations]

  function emit(level: LogLevel, message: string, fields?: unknown): void {
    // Build the record lazily: only if at least one sink accepts the level.
    let rec: LogRecordWithRaw | null = null
    for (const { sink, threshold } of sinks) {
      const t = threshold()
      if (t === 'off' || !levelPasses(level, t)) continue
      rec = rec ?? buildRecord(level, message, fields)
      try {
        sink.write(rec)
      } catch {
        // A sink must never break the app. Swallow — there is no safe
        // logger to report a logger failure to.
      }
    }
  }

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    addSink: (sink, threshold) => {
      sinks.push({ sink, threshold })
    },
  }
}
