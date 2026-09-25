/**
 * External fileReference allowlist.
 *
 * A non-empty `fileReference` on a UUFile points at bytes the user supplied
 * directly (e.g. a public photo URL) instead of an S3-backed internal file.
 * Before we paint that URL into `<img src>` / `<a href>` / a fetch, we have
 * to be confident it's safe — an attacker who controls the string can:
 *   - run script (`javascript:` URLs in anchors),
 *   - exfiltrate cookies via `data:` URLs that wrap HTML,
 *   - smuggle credentials through `https://user:pass@host`,
 *   - or use the browser to probe internal hosts (`http://10.0.0.1/...`)
 *     for an SSRF-style side channel.
 *
 * This module is the single point of truth for what "external reference"
 * means. `isAllowedExternalFileReference()` returns `true` only for:
 *   - `https:` scheme (no http:, no javascript:, no data:, no file:, no blob:)
 *   - no userinfo
 *   - host is a registered name (not a literal IP) and not a loopback /
 *     localhost / *.local / *.localdomain
 *
 * Callers should treat `null` / empty / failing strings as "internal file —
 * resolve via the file-storage service".
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
])

const BLOCKED_HOSTNAME_SUFFIXES = ['.local', '.localdomain', '.internal']

export function isAllowedExternalFileReference(
  value: string | null | undefined
): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  if (parsed.username !== '' || parsed.password !== '') return false

  const host = parsed.hostname.toLowerCase()
  if (host === '') return false
  if (BLOCKED_HOSTNAMES.has(host)) return false
  if (BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))) return false
  if (isIpLiteral(host)) return false

  return true
}

function isIpLiteral(host: string): boolean {
  // IPv6 literals are surrounded by brackets when parsed via URL.hostname
  // strips them, leaving e.g. "::1" or "fe80::1". Anything containing ':'
  // we treat as IPv6.
  if (host.includes(':')) return true
  // IPv4 dotted-quad: four numeric octets.
  const parts = host.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}
