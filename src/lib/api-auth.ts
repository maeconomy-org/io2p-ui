import { NextRequest, NextResponse } from 'next/server'
import { decodeJWTPayload } from './jwt-utils'
import { logger } from './logger'

export interface AuthResult {
  valid: boolean
  userUUID?: string
  token?: string
  error?: string
}

/**
 * Validate JWT from the Authorization header of an API request.
 * Decodes the token to extract userUUID — actual signature
 * verification is delegated to the backend services.
 */
export function validateApiAuth(req: NextRequest | Request): AuthResult {
  const authorization = req.headers.get('authorization')

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authorization.substring(7)

  if (!token || token.split('.').length !== 3) {
    return { valid: false, error: 'Malformed JWT token' }
  }

  const payload = decodeJWTPayload(token)

  // better-auth JWTs carry the user id as the standard `sub` claim; old uuobject tokens used `userUUID`.
  const userId = payload?.sub ?? payload?.userUUID
  if (!userId) {
    return { valid: false, error: 'Invalid token: missing subject' }
  }

  // Check token expiry (if exp claim exists)
  if (payload?.exp) {
    const now = Math.floor(Date.now() / 1000)
    if (now >= payload.exp) {
      return { valid: false, error: 'Token expired' }
    }
  }

  return { valid: true, userUUID: userId, token }
}

/**
 * Guard helper — returns a 401 NextResponse if auth fails, or null if valid.
 * Usage:
 *   const guard = requireAuth(req)
 *   if (guard.error) return guard.error
 *   // guard.userUUID and guard.token are available
 */
export function requireAuth(req: NextRequest | Request): {
  error: NextResponse | null
  userUUID: string
  token: string
} {
  const auth = validateApiAuth(req)

  if (!auth.valid) {
    logger.security('api_auth_failed', {
      error: auth.error,
      url: new URL(req.url).pathname,
    })

    return {
      error: NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      ),
      userUUID: '',
      token: '',
    }
  }

  return {
    error: null,
    userUUID: auth.userUUID!,
    token: auth.token!,
  }
}
