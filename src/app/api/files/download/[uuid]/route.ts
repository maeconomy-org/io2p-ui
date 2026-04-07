import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { logger } from '@/lib/logger'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  // Authenticate via Authorization header
  const auth = requireAuth(request)
  if (auth.error) return auth.error

  try {
    // Validate UUID format
    const { uuid } = await params
    if (!UUID_REGEX.test(uuid)) {
      return NextResponse.json(
        { error: 'Invalid UUID format' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.BASE_URL
    const nodeApiUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/node-network`
      : undefined

    if (!nodeApiUrl) {
      return NextResponse.json(
        { error: 'BASE_URL not configured' },
        { status: 500 }
      )
    }

    // Get file metadata first
    const fileResponse = await fetch(`${nodeApiUrl}/api/UUFile?uuid=${uuid}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!fileResponse.ok) {
      throw new Error(`Failed to get file metadata: ${fileResponse.status}`)
    }

    const fileData = await fileResponse.json()

    // Download file content
    const downloadResponse = await fetch(
      `${nodeApiUrl}/api/UUFile/${uuid}/download`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      }
    )

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file: ${downloadResponse.status}`)
    }

    const arrayBuffer = await downloadResponse.arrayBuffer()

    // Sanitize filename to prevent header injection
    const rawFileName = fileData.fileName || 'download'
    const safeFileName = rawFileName.replace(/[^\w\s.-]/g, '_')

    // Set appropriate headers for download
    const headers = new Headers()
    headers.set(
      'Content-Type',
      fileData.contentType || 'application/octet-stream'
    )
    headers.set('Content-Disposition', `attachment; filename="${safeFileName}"`)
    headers.set('Content-Length', arrayBuffer.byteLength.toString())

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    logger.error('Download error:', { error })
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
