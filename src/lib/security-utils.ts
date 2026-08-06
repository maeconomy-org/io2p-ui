// Everything here now serves ONE caller: the telemetry ingest route. The import half of this
// file — payload validation, the import rate limiter, the per-user job cap and its tracking —
// went with the pipeline that used it; the node runs bulk imports now and enforces its own caps.
//
// In-memory fallback rate limiter when Redis is unavailable
const memoryRateLimit = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 60 seconds. unref() so this housekeeping
// timer never keeps the process alive on shutdown.
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryRateLimit) {
      if (now >= entry.resetAt) {
        memoryRateLimit.delete(key)
      }
    }
  }, 60_000)
  ;(cleanupTimer as { unref?: () => void }).unref?.()
}

/**
 * How many proxies in front of this app append to `x-forwarded-for`.
 * `TRUSTED_PROXY_HOPS`, default 1. Invalid or below 1 falls back to 1 rather
 * than trusting more of the header than intended.
 */
function trustedProxyHops(): number {
  const parsed = parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

export interface SecurityValidationResult {
  allowed: boolean
  warning?: string
  error?: string
  rateLimitInfo?: {
    current: number
    max: number
    windowMinutes: number
    resetTime: number
  }
}

/**
 * Generic fixed-window rate limiter, in process memory.
 *
 * This was Redis-backed with an in-memory fallback, because Redis was already here for the old
 * import pipeline. That pipeline is gone and the node runs bulk imports now, so the only caller
 * left is the telemetry ingest route — and keeping a Redis container alive to throttle it would
 * be the tail wagging the dog. The fallback path was already the one that ran whenever Redis was
 * unavailable; it is now the only path.
 *
 * The window is FIXED, not sliding: an entry keeps its original `resetAt` as the count rises.
 * Refreshing the expiry on every hit would slide the window forever — sustained traffic (the ship
 * sink flushes every 5s) would accumulate to the cap and then be 429'd permanently.
 *
 * The trade this makes: the counter is per PROCESS, so N replicas allow N × the cap between them.
 * That is the same behaviour the fallback always had, and the deployment runs a single UI
 * container. Revisit if the UI is ever scaled out.
 *
 * Deliberately does NOT log: the telemetry route is a caller, and a security-event log per
 * throttled telemetry batch would feed the very pipeline being throttled.
 */
export function checkSimpleRateLimit(
  scope: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; current: number } {
  const key = `rate_limit:${scope}:${identifier}`
  const now = Date.now()
  const entry = memoryRateLimit.get(key)

  if (entry && now < entry.resetAt) {
    entry.count += 1
    return { allowed: entry.count <= maxRequests, current: entry.count }
  }
  memoryRateLimit.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
  return { allowed: 1 <= maxRequests, current: 1 }
}

/**
 * Get client identifier for rate limiting (IP or session-based)
 */
export function getClientIdentifier(req: Request): string {
  // GDPR compliant - don't store actual IPs, use hash for rate limiting
  const forwardedFor = req.headers.get('x-forwarded-for')
  const realIP = req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent') || ''

  // Read x-forwarded-for from the RIGHT, by trusted-hop count. Each proxy
  // appends the peer address it accepted the connection from, so entries to
  // the left of our own infrastructure are client-supplied and trivially
  // spoofable — keying a rate limit on the first entry lets an attacker
  // rotate identities (or pin someone else's) with a header.
  //
  // Both directions fail, so this is configuration, not a constant:
  //   too few hops → you read a proxy's address, and EVERY client behind it
  //     collapses into one rate-limit bucket (one noisy tab throttles all)
  //   too many hops → you read a spoofable client-supplied entry
  // Default 1 = a single trusted proxy in front of the app. Raise it to 2
  // when nginx fronts a platform ingress that also appends.
  const hops = forwardedFor
    ?.split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  const index = hops ? hops.length - trustedProxyHops() : -1
  // Below zero means fewer hops arrived than configured (a direct request, a
  // misconfigured count): the leftmost entry is the best available answer.
  const clientIP = (hops && (hops[index] ?? hops[0])) || realIP

  if (clientIP && clientIP !== 'unknown') {
    // Create a hash for rate limiting without storing actual IP
    const crypto = require('crypto')
    return crypto
      .createHash('sha256')
      .update(clientIP + userAgent)
      .digest('hex')
      .substring(0, 16)
  }

  return 'anonymous'
}
