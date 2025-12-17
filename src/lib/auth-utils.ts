import { NextRequest } from 'next/server'

/**
 * Simple admin authentication for internal endpoints
 * In production, this should be replaced with proper authentication
 */
export function validateAdminAccess(req: NextRequest): boolean {
  // Check for admin token in headers
  const adminToken = req.headers.get('x-admin-token')
  const expectedToken = process.env.ADMIN_TOKEN

  // If no admin token is configured, allow access (development mode)
  if (!expectedToken) {
    return process.env.NODE_ENV === 'development'
  }

  return adminToken === expectedToken
}

/**
 * Check if request is from localhost (for development)
 */
export function isLocalhost(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  return host.includes('localhost') || host.includes('127.0.0.1')
}

/**
 * Validate internal service access
 */
export function validateInternalAccess(req: NextRequest): boolean {
  // Allow if admin token is provided
  if (validateAdminAccess(req)) {
    return true
  }

  // Allow from localhost in development
  if (process.env.NODE_ENV === 'development' && isLocalhost(req)) {
    return true
  }

  // Check for internal service header
  const internalToken = req.headers.get('x-internal-service')
  const expectedInternalToken = process.env.INTERNAL_SERVICE_TOKEN

  if (expectedInternalToken && internalToken === expectedInternalToken) {
    return true
  }

  return false
}
