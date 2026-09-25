// Neutral scrubbing primitives, consumed by BOTH the Sentry beforeSend hook
// (sentry-config.ts) and the logger sinks (NDJSON, ship, console). Nothing in
// here is Sentry-shaped — Sentry-only concerns (event adapters, the
// ECONNREFUSED/ETIMEDOUT noise filter) stay in sentry-config.ts, because a
// core outage must never be filtered out of the NDJSON/ship paths.

/**
 * Redact S3 presigned-URL credentials wherever they may appear. Presigned
 * URLs are self-authenticating for their full TTL (5 min on upload PUTs,
 * 15 min on previews), so leaking the `X-Amz-Signature` / `X-Amz-Credential`
 * query string into any sink is equivalent to leaking short-lived write
 * access to the bucket. We also redact AWS SigV4 `Authorization` header
 * values in case a future direct-call code path ever surfaces one in an
 * exception message.
 */
const AMZ_QUERY_PARAMS = [
  'X-Amz-Signature',
  'X-Amz-Credential',
  'X-Amz-Security-Token',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-SignedHeaders',
  'X-Amz-Algorithm',
]

export function redactPresignedUrlString(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return input
  let out = input
  // Strip X-Amz-* query params (case-insensitive).
  for (const key of AMZ_QUERY_PARAMS) {
    const pattern = new RegExp(`([?&])${key}=[^&\\s"'<>]*`, 'gi')
    out = out.replace(pattern, '$1' + key + '=REDACTED')
  }
  // Strip SigV4 Authorization values.
  out = out.replace(
    /AWS4-HMAC-SHA256\s+Credential=[^,\s]+,\s*SignedHeaders=[^,\s]+,\s*Signature=[A-Fa-f0-9]+/g,
    'AWS4-HMAC-SHA256 REDACTED'
  )
  return out
}

/**
 * Field names whose VALUES must never reach a sink, whatever the sink.
 * Matched case-insensitively against the key name alone (any depth).
 * Shared convention with io2p-core/io2p-auth (observability plan §2).
 */
const REDACT_KEYS = [
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'api_key',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
]

const REDACTED = '[REDACTED]'

function isRedactedKey(key: string): boolean {
  const k = key.toLowerCase()
  return REDACT_KEYS.includes(k)
}

/**
 * Walk a plain object/array up to `depth` levels deep, replacing string
 * leaves IN PLACE via `redactPresignedUrlString`. Cycle-safe via `seen`.
 * Used by sentry-config.ts against event fragments Sentry owns (mutation is
 * the Sentry beforeSend contract).
 */
export function redactDeep(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): void {
  if (depth <= 0 || value === null || value === undefined) return
  if (typeof value === 'object') {
    if (seen.has(value as object)) return
    seen.add(value as object)
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const v = value[i]
        if (typeof v === 'string') value[i] = redactPresignedUrlString(v)
        else redactDeep(v, depth - 1, seen)
      }
      return
    }
    const obj = value as Record<string, unknown>
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (isRedactedKey(k)) {
        obj[k] = REDACTED
      } else if (typeof v === 'string') {
        obj[k] = redactPresignedUrlString(v)
      } else {
        redactDeep(v, depth - 1, seen)
      }
    }
  }
}

/**
 * Pure (copying) variant for log records: returns a redacted clone, never
 * mutates the caller's fields. Secret-named keys are replaced with
 * '[REDACTED]', string leaves are scrubbed for presigned-URL credentials.
 */
export function redactValue(value: unknown, depth = 6): unknown {
  return redactValueInner(value, depth, new WeakSet())
}

function redactValueInner(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (typeof value === 'string') return redactPresignedUrlString(value)
  if (value === null || typeof value !== 'object') return value
  if (depth <= 0) return undefined
  // `seen` tracks the CURRENT PATH, not every visited node: entries are
  // removed after their subtree is processed, so a shared (diamond)
  // reference is copied normally at each occurrence and only a genuine
  // ancestor cycle is labeled '[Circular]'.
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  let out: unknown
  if (Array.isArray(value)) {
    out = value.map((v) => redactValueInner(v, depth - 1, seen))
  } else {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = isRedactedKey(k)
        ? REDACTED
        : redactValueInner(v, depth - 1, seen)
    }
    out = obj
  }
  seen.delete(value)
  return out
}
