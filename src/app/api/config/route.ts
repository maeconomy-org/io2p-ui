import { NextResponse } from 'next/server'

// Runtime config API - serves env vars to client at runtime
// This allows one Docker image to work on multiple VMs with different configs
export async function GET() {
  return NextResponse.json({
    // API endpoints
    baseApiUrl: process.env.BASE_API_URL || '',
    uuidApiUrl: process.env.UUID_API_URL || '',
    // Sentry config (client-side)
    sentryDsn: process.env.SENTRY_DSN || '',
    sentryEnabled: process.env.SENTRY_ENABLED || 'false',
    sentryRelease: process.env.SENTRY_RELEASE || '',
    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',
  })
}
