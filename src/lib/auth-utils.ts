import { NextRequest } from 'next/server'

/**
 * Check if request is from localhost (for development)
 */
export function isLocalhost(req: NextRequest): boolean {
  const host = req.headers.get('host') || ''
  return host.includes('localhost') || host.includes('127.0.0.1')
}