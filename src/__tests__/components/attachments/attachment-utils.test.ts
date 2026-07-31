import { describe, it, expect } from 'vitest'

import { resolveFileContentType } from '@/components/attachments/attachment-utils'

function makeFile(name: string, type: string): File {
  // `File` is available in the jsdom test environment.
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

describe('resolveFileContentType', () => {
  it('returns the browser-provided MIME type when present', () => {
    expect(resolveFileContentType(makeFile('a.png', 'image/png'))).toBe(
      'image/png'
    )
  })

  it('falls back to application/octet-stream when File.type is empty (.gcode)', () => {
    // Browsers leave `type` empty for unregistered extensions like .gcode.
    expect(
      resolveFileContentType(makeFile('Lemonchik_PLA_2h20m.gcode', ''))
    ).toBe('application/octet-stream')
  })

  it('treats a whitespace-only type as missing', () => {
    expect(resolveFileContentType(makeFile('model.stl', '   '))).toBe(
      'application/octet-stream'
    )
  })
})
