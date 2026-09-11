import { createHash } from 'crypto'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/**
 * Ceiling on distinct buckets. Every key is attacker-influenced (IP, and for telemetry the
 * user-agent too), so without a cap a spray of forged headers grows the Map without bound between
 * cleanup passes. Evicting expired entries first keeps live limits intact under that pressure.
 */
const MAX_BUCKETS = 10_000

if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of buckets) {
      if (now >= entry.resetAt) buckets.delete(key)
    }
  }, 60_000)
  // unref so this housekeeping never keeps the process alive on shutdown.
  ;(cleanupTimer as { unref?: () => void }).unref?.()
}

function evictIfFull(): void {
  if (buckets.size < MAX_BUCKETS) return
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key)
  }
  // Still full: every bucket is live, so drop the oldest insertions. Map iterates in insertion
  // order, and an entry's position is its creation time — the ones nearest their reset.
  if (buckets.size >= MAX_BUCKETS) {
    let toDrop = Math.ceil(MAX_BUCKETS / 10)
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (--toDrop <= 0) break
    }
  }
}

/**
 * Generic fixed-window rate limiter, in process memory.
 *
 * The window is FIXED, not sliding: an entry keeps its original `resetAt` as the count rises.
 * Refreshing the expiry on every hit would slide the window forever — sustained traffic (the ship
 * sink flushes every 5s) would accumulate to the cap and then be 429'd permanently.
 *
 * The trade: the counter is per PROCESS, so N replicas allow N × the cap between them. The
 * deployment runs a single UI container. Revisit if the UI is ever scaled out.
 *
 * Deliberately does NOT log: the telemetry route is a caller, and a security event per throttled
 * telemetry batch would feed the very pipeline being throttled.
 */
export function checkSimpleRateLimit(
  scope: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; current: number } {
  const key = `${scope}:${identifier}`
  const now = Date.now()
  const entry = buckets.get(key)

  if (entry && now < entry.resetAt) {
    entry.count += 1
    return { allowed: entry.count <= maxRequests, current: entry.count }
  }
  evictIfFull()
  buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
  return { allowed: 1 <= maxRequests, current: 1 }
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

/**
 * The caller's IP, read from `x-forwarded-for` from the RIGHT by trusted-hop count.
 *
 * Each proxy appends the peer address it accepted the connection from, so entries to the left of
 * our own infrastructure are client-supplied and trivially spoofable — keying a limit on the first
 * entry lets a caller rotate identities (or pin someone else's) with a header.
 *
 * Both directions fail, so this is configuration, not a constant:
 *   too few hops → you read a proxy's address, and EVERY client behind it collapses into one
 *     bucket (one noisy tab throttles all)
 *   too many hops → you read a spoofable client-supplied entry
 * Default 1 = a single trusted proxy in front of the app. Raise it to 2 when nginx fronts a
 * platform ingress that also appends.
 */
export function getClientIp(req: Request): string {
  const hops = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  const index = hops ? hops.length - trustedProxyHops() : -1
  // Below zero means fewer hops arrived than configured (a direct request, a misconfigured count):
  // the leftmost entry is the best available answer.
  const ip = (hops && (hops[index] ?? hops[0])) || req.headers.get('x-real-ip')
  return ip && ip !== 'unknown' ? ip : 'anonymous'
}

/**
 * Rate-limit key for TELEMETRY, which mixes in the user-agent.
 *
 * That is deliberate and is NOT what protection wants. Telemetry's goal is fairness between
 * clients, so splitting one NAT into per-browser buckets is a feature. A protection limit must use
 * `getClientIp` instead — a caller controls their own user-agent, so including it hands them a
 * free way to mint fresh buckets.
 *
 * Hashed to keep raw addresses out of map keys and any log that ever prints one. That is key
 * hygiene, not anonymisation: a SHA-256 over the IPv4 space is exhaustively searchable.
 */
export function getClientIdentifier(req: Request): string {
  const ip = getClientIp(req)
  if (ip === 'anonymous') return 'anonymous'
  const userAgent = req.headers.get('user-agent') || ''
  return createHash('sha256')
    .update(ip + userAgent)
    .digest('hex')
    .substring(0, 16)
}
