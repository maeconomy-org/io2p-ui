import { describe, it, expect } from 'vitest'

import { base64ToBlob } from '@/components/attachments/base64'

const toBase64 = (input: string): string =>
  Buffer.from(input, 'utf-8').toString('base64')

describe('base64ToBlob', () => {
  it('decodes a base64 payload into a Blob with the requested mime type', async () => {
    const blob = await base64ToBlob(toBase64('hello world'), 'text/plain')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/plain')
    expect(blob.size).toBe('hello world'.length)
  })

  it('falls back to application/octet-stream when mime type is empty', async () => {
    const blob = await base64ToBlob(toBase64('x'), '')
    expect(blob.type).toBe('application/octet-stream')
  })

  it('produces a blob whose size matches the decoded byte length for binary payloads', async () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255])
    const base64 = Buffer.from(bytes).toString('base64')

    const blob = await base64ToBlob(base64, 'application/octet-stream')
    expect(blob.size).toBe(bytes.length)
    expect(blob.type).toBe('application/octet-stream')
  })

  it('handles an empty payload without throwing', async () => {
    const blob = await base64ToBlob('', 'text/plain')
    expect(blob.size).toBe(0)
    expect(blob.type).toBe('text/plain')
  })

  it('throws a descriptive error when the input is not valid base64', async () => {
    await expect(
      base64ToBlob('not*valid*base64!!', 'text/plain')
    ).rejects.toThrow(/Failed to decode base64 payload/)
  })
})
