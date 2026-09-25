import { describe, it, expect } from 'vitest'

import {
  detectMimeType,
  detectPreviewKind,
} from '@/components/entity-sheet/files/mime-type'

describe('detectMimeType', () => {
  it('prefers a non-octet-stream contentType over extension', () => {
    const mime = detectMimeType({
      contentType: 'image/png',
      fileName: 'thing.txt',
    })
    expect(mime).toBe('image/png')
  })

  it('falls back to extension when contentType is missing', () => {
    expect(detectMimeType({ fileName: 'photo.jpeg' })).toBe('image/jpeg')
    expect(detectMimeType({ fileName: 'doc.pdf' })).toBe('application/pdf')
    expect(detectMimeType({ fileName: 'log.md' })).toBe('text/markdown')
  })

  it('falls back to extension when contentType is application/octet-stream', () => {
    expect(
      detectMimeType({
        contentType: 'application/octet-stream',
        fileName: 'clip.mp4',
      })
    ).toBe('video/mp4')
  })

  it('is case-insensitive on extension', () => {
    expect(detectMimeType({ fileName: 'CAPS.PNG' })).toBe('image/png')
  })

  it('defaults to application/octet-stream for unknown types', () => {
    expect(detectMimeType({ fileName: 'weird.xyz' })).toBe(
      'application/octet-stream'
    )
    expect(detectMimeType({})).toBe('application/octet-stream')
  })

  it('ignores query strings and fragments when reading extensions', () => {
    expect(
      detectMimeType({ fileReference: '/api/UUFile/abc/download?foo=bar' })
    ).toBe('application/octet-stream')
    expect(
      detectMimeType({ fileReference: 'thing.png?version=42#preview' })
    ).toBe('image/png')
  })
})

describe('detectPreviewKind', () => {
  it('maps image/* to image', () => {
    expect(detectPreviewKind('image/png')).toBe('image')
    expect(detectPreviewKind('image/svg+xml')).toBe('image')
  })

  it('maps application/pdf to pdf', () => {
    expect(detectPreviewKind('application/pdf')).toBe('pdf')
  })

  it('maps text/* and json/xml/yaml to text', () => {
    expect(detectPreviewKind('text/plain')).toBe('text')
    expect(detectPreviewKind('application/json')).toBe('text')
    expect(detectPreviewKind('application/xml')).toBe('text')
  })

  it('maps video/* and audio/*', () => {
    expect(detectPreviewKind('video/mp4')).toBe('video')
    expect(detectPreviewKind('audio/mpeg')).toBe('audio')
  })

  it('returns unsupported for anything else', () => {
    expect(detectPreviewKind('application/zip')).toBe('unsupported')
    expect(detectPreviewKind('application/octet-stream')).toBe('unsupported')
  })
})
