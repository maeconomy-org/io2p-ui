import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement, JSXElementConstructor } from 'react'
import React from 'react'

import { tripwire } from '@/lib/http/tripwire'
import { checkSimpleRateLimit, getClientIp } from '@/lib/http/rate-limit'
import { logger } from '@/lib/observability/logger'
import { PassportPdfDocument } from './passport-pdf-document'
import type { PassportDataResult } from './passport-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_SECONDS = 60
const PER_IP_PER_MINUTE = 5
/** The QR arrives as a data URL, so a legitimate body is tens of KB. 2 MB is far above that and
 *  far below what would make renderToBuffer expensive. */
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_PROPERTIES = 500
const MAX_FILES = 200

interface PdfRequestBody extends PassportDataResult {
  qrDataUrl: string
  locale: 'en' | 'nl'
}

/**
 * Renders a passport PDF from the body it is given. It fetches NOTHING — `object`, `properties`,
 * `files` and `addressInfo` all arrive from the caller, and `uuid` only names the download. So a
 * caller can only ever get back a document built from data they already had, which is why this
 * route is safe behind a tripwire rather than real verification.
 *
 * The exposure it does have is CPU: `renderToBuffer` is the one expensive thing this app does on
 * demand. The caps below bound the input, and the rate limit bounds the frequency.
 *
 * Corollary worth stating: the PDF's CONTENT is attacker-controlled. It is served as an
 * `attachment` from this origin, so treat it as untrusted if anything ever renders it inline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const blocked = tripwire(req)
  if (blocked) return blocked

  const ip = getClientIp(req)
  if (
    !checkSimpleRateLimit('passport-pdf', ip, PER_IP_PER_MINUTE, WINDOW_SECONDS)
      .allowed
  ) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(WINDOW_SECONDS) } }
    )
  }

  const { uuid } = await params

  if (!uuid) {
    return NextResponse.json({ error: 'Missing uuid' }, { status: 400 })
  }

  // Content-Length first so an oversized body is refused before it is buffered — but it is a
  // client-supplied header and may be absent or lie, so the actual bytes are measured too.
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return payloadTooLarge()
  }

  let body: PdfRequestBody
  try {
    const raw = await req.text()
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return payloadTooLarge()
    body = JSON.parse(raw) as PdfRequestBody
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

  // Byte size alone does not bound the render: 2 MB of short property rows is far more layout work
  // than 2 MB of one base64 image.
  if (
    (properties?.length ?? 0) > MAX_PROPERTIES ||
    (files?.length ?? 0) > MAX_FILES
  ) {
    return payloadTooLarge()
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
      err: err,
    })
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

function payloadTooLarge(): NextResponse {
  return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
}
