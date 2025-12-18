import { NextRequest } from 'next/server'

/**
 * Extract certificate info from request headers (set by nginx/reverse proxy)
 */
export function getCertificateInfo(req: NextRequest): {
  fingerprint: string | null
  serialNumber: string | null
  subject: string | null
} {
  return {
    fingerprint: req.headers.get('x-ssl-client-fingerprint'),
    serialNumber: req.headers.get('x-ssl-client-serial'),
    subject: req.headers.get('x-ssl-client-s-dn'),
  }
}

/**
 * Validate admin access based on certificate fingerprint/serial
 * Uses HEALTH_ALLOWED_CERTS env var (comma-separated list)
 */
export function validateAdminAccess(req: NextRequest): boolean {
  const allowedFingerprints = process.env.HEALTH_ALLOWED_CERTS || ''

  // In development without configured fingerprints, allow localhost access
  if (!allowedFingerprints.trim()) {
    return process.env.NODE_ENV === 'development' && isLocalhost(req)
  }

  // Parse allowed fingerprints/serials
  const allowedList = allowedFingerprints
    .split(',')
    .map((f) => f.trim().toLowerCase())

  // Get certificate info from request
  const certInfo = getCertificateInfo(req)

  // Check if fingerprint or serial matches
  if (
    certInfo.fingerprint &&
    allowedList.includes(certInfo.fingerprint.toLowerCase())
  ) {
    return true
  }
  if (
    certInfo.serialNumber &&
    allowedList.includes(certInfo.serialNumber.toLowerCase())
  ) {
    return true
  }

  return false
}

/**
 * Check if request is from localhost (for development)
 */
export function isLocalhost(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  return host.includes('localhost') || host.includes('127.0.0.1')
}

/**
 * Validate internal service access (for health endpoints)
 * Uses certificate-based auth in production, localhost in development
 */
export function validateInternalAccess(req: NextRequest): boolean {
  // Allow if admin cert is valid
  if (validateAdminAccess(req)) {
    return true
  }

  // Allow from localhost in development
  if (process.env.NODE_ENV === 'development' && isLocalhost(req)) {
    return true
  }

  return false
}
