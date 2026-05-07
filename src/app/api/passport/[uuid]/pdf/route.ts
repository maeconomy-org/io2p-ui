import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement, JSXElementConstructor } from 'react'
import React from 'react'

import { requireAuth } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { PassportPdfDocument } from '@/lib/pdf/passport-pdf-document'
import type { PassportDataResult } from '@/lib/pdf/passport-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PdfRequestBody extends PassportDataResult {
  qrDataUrl: string
  locale: 'en' | 'nl'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const guard = requireAuth(req)
  if (guard.error) return guard.error

  const { uuid } = await params

  if (!uuid) {
    return NextResponse.json({ error: 'Missing uuid' }, { status: 400 })
  }

  let body: PdfRequestBody
  try {
    body = (await req.json()) as PdfRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { object, properties, files, addressInfo, qrDataUrl, locale } = body

  if (!object || !qrDataUrl) {
    return NextResponse.json(
      { error: 'Missing required fields: object, qrDataUrl' },
      { status: 400 }
    )
  }

  try {
    const element = React.createElement(PassportPdfDocument, {
      object,
      properties: properties ?? [],
      files: files ?? [],
      addressInfo: addressInfo ?? null,
      qrDataUrl,
      locale: locale ?? 'en',
    }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>

    const buffer = await renderToBuffer(element)

    const safeName = (object.name || uuid)
      .replace(/[^a-z0-9\-_]/gi, '-')
      .replace(/-{2,}/g, '-')
      .slice(0, 80)

    return new Response((buffer as Buffer).buffer as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="passport-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
        'Content-Length': String((buffer as Buffer).byteLength),
      },
    })
  } catch (err) {
    logger.error('passport_pdf_error', {
      uuid,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
