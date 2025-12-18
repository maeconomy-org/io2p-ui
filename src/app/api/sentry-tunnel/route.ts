import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib'

// Sentry tunnel endpoint to bypass ad blockers
// This proxies Sentry events through your own domain

// Extract project ID from SENTRY_DSN env var
function getAllowedProjectId(): string | null {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return null
  try {
    const url = new URL(dsn)
    return url.pathname.replace('/', '')
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text()
    const pieces = envelope.split('\n')

    // Parse the envelope header to get the DSN
    const header = JSON.parse(pieces[0])
    const dsn = new URL(header.dsn)
    const projectId = dsn.pathname.replace('/', '')

    // Validate that this is for your Sentry project
    const allowedProjectId = getAllowedProjectId()
    if (!allowedProjectId || projectId !== allowedProjectId) {
      return NextResponse.json(
        { error: 'Invalid Sentry project' },
        { status: 403 }
      )
    }

    // Forward to Sentry
    const sentryUrl = `https://${dsn.host}/api/${projectId}/envelope/`

    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
      body: envelope,
    })

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Sentry tunnel error:', error)
    return NextResponse.json(
      { error: 'Failed to forward to Sentry' },
      { status: 500 }
    )
  }
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
