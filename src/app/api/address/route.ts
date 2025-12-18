import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib'

// Proxy HERE API requests to hide API key from client
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ items: [] })
  }

  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) {
    logger.error('HERE_API_KEY not configured')
    return NextResponse.json(
      { error: 'Address service not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `https://autocomplete.search.hereapi.com/v1/autocomplete?q=${encodeURIComponent(query)}&apiKey=${apiKey}`
    )
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error('HERE API error:', error)
    return NextResponse.json(
      { error: 'Address lookup failed' },
      { status: 500 }
    )
  }
}
