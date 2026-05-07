import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement, JSXElementConstructor } from 'react'

import { PassportPdfDocument } from '@/lib/pdf/passport-pdf-document'
import type { PassportPdfDocumentProps } from '@/lib/pdf/passport-pdf-document'

// 1×1 transparent PNG — small but a valid image @react-pdf can decode for the
// hero QR slot. Avoids hitting the network or generating a real QR per test.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function buildFixture(
  overrides: Partial<PassportPdfDocumentProps> = {}
): PassportPdfDocumentProps {
  return {
    object: {
      uuid: 'test-uuid',
      name: 'Test Window Frame',
      abbreviation: 'WF',
      description: 'Steel window frame for unit-test fixture.',
    },
    properties: [
      {
        uuid: 'p-manuf',
        key: 'manufacturer',
        label: 'Manufacturer',
        values: [{ value: 'Reynaers Aluminium' }],
      },
      {
        uuid: 'p-height',
        key: 'height',
        label: 'Height',
        values: [{ value: '1624 mm' }],
      },
      {
        uuid: 'p-status',
        key: 'status',
        label: 'Status',
        values: [{ value: 'Operational' }],
      },
    ],
    files: [],
    addressInfo: null,
    qrDataUrl: TINY_PNG_DATA_URL,
    locale: 'en',
    ...overrides,
  }
}

async function renderPdf(props: PassportPdfDocumentProps): Promise<Uint8Array> {
  const element = React.createElement(
    PassportPdfDocument,
    props
  ) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>
  const buffer = await renderToBuffer(element)
  return new Uint8Array(buffer as Buffer)
}

function startsWithPdfMagic(bytes: Uint8Array): boolean {
  // %PDF- in ASCII = 0x25 0x50 0x44 0x46 0x2D
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
}

describe('PassportPdfDocument', () => {
  it('renders a non-empty PDF buffer for a populated passport', async () => {
    const bytes = await renderPdf(buildFixture())
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(startsWithPdfMagic(bytes)).toBe(true)
  }, 30_000)

  it('renders without throwing when properties and files are empty', async () => {
    const bytes = await renderPdf(buildFixture({ properties: [], files: [] }))
    expect(bytes.byteLength).toBeGreaterThan(500)
    expect(startsWithPdfMagic(bytes)).toBe(true)
  }, 30_000)

  it('renders with an addressInfo block attached', async () => {
    const bytes = await renderPdf(
      buildFixture({
        addressInfo: {
          fullAddress: 'Herengracht 182, 1016 BR Amsterdam',
          street: 'Herengracht',
          houseNumber: '182',
          city: 'Amsterdam',
          postalCode: '1016 BR',
          country: 'Netherlands',
        },
      })
    )
    expect(startsWithPdfMagic(bytes)).toBe(true)
  }, 30_000)
})
