import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    // Get auth token from query parameter
    const { searchParams } = new URL(request.url)
    const authToken = searchParams.get('token')

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get backend URLs from environment
    const nodeApiUrl = process.env.NODE_API_URL

    // Get file metadata first
    const fileResponse = await fetch(
      `${nodeApiUrl}/api/UUFile/${params.uuid}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!fileResponse.ok) {
      throw new Error(`Failed to get file metadata: ${fileResponse.status}`)
    }

    const fileData = await fileResponse.json()

    // Download file content
    const downloadResponse = await fetch(
      `${nodeApiUrl}/api/UUFile/${params.uuid}/download`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file: ${downloadResponse.status}`)
    }

    const arrayBuffer = await downloadResponse.arrayBuffer()

    // Set appropriate headers for download
    const headers = new Headers()
    headers.set(
      'Content-Type',
      fileData.contentType || 'application/octet-stream'
    )
    headers.set(
      'Content-Disposition',
      `attachment; filename="${fileData.fileName || 'download'}"`
    )
    headers.set('Content-Length', arrayBuffer.byteLength.toString())

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
