/**
 * JWT utility functions for server-side token handling
 */

interface JWTPayload {
  userUUID: string
  credentials?: string
  authorities?: string[]
  enabled?: boolean
  accountNonExpired?: boolean
  credentialsNonExpired?: boolean
  accountNonLocked?: boolean
  iat?: number
  exp?: number
}

/**
 * Decode JWT token payload without verification
 * Note: This is for extracting user info from trusted tokens
 * Token validation should be handled by the auth service
 */
export function decodeJWTPayload(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode the payload (base64url)
    const payload = parts[1]

    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - (payload.length % 4)) % 4)

    // Decode from base64url (replace URL-safe chars)
    const base64 = paddedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')

    return JSON.parse(decoded) as JWTPayload
  } catch (error) {
    console.error('Failed to decode JWT payload:', error)
    return null
  }
}

/**
 * Extract userUUID from JWT token
 */
export function getUserUUIDFromJWT(token: string): string | null {
  const payload = decodeJWTPayload(token)
  return payload?.userUUID || null
}
