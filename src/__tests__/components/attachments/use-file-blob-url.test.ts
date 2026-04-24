import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import {
  extractFileUuid,
  useFileBlobUrl,
} from '@/components/attachments/use-file-blob-url'

const downloadFile = vi.fn()
const sdkClient = { node: { downloadFile } }

vi.mock('@/contexts', () => ({
  useIomSdkClient: () => sdkClient,
}))

const createObjectURL = vi.fn(() => 'blob:stub')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(global.URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
  })
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
  })
})

describe('extractFileUuid', () => {
  it('parses the uuid from an internal file reference', () => {
    expect(extractFileUuid('/api/UUFile/abc-123/download')).toBe('abc-123')
    expect(
      extractFileUuid('https://host.tld/api/UUFile/xyz/download?v=2')
    ).toBe('xyz')
  })

  it('returns null for external or missing references', () => {
    expect(extractFileUuid('https://cdn.example/files/photo.png')).toBeNull()
    expect(extractFileUuid(undefined)).toBeNull()
    expect(extractFileUuid('')).toBeNull()
  })
})

describe('useFileBlobUrl', () => {
  it('fetches once and returns a blob URL', async () => {
    downloadFile.mockResolvedValue(new ArrayBuffer(8))

    const { result } = renderHook(() => useFileBlobUrl('u-1', 'image/png'))

    await waitFor(() => expect(result.current.url).toBe('blob:stub'))
    expect(downloadFile).toHaveBeenCalledTimes(1)
    expect(downloadFile).toHaveBeenCalledWith('u-1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useFileBlobUrl('u-1', 'image/png', false))
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('revokes the URL on unmount', async () => {
    downloadFile.mockResolvedValue(new ArrayBuffer(4))
    const { result, unmount } = renderHook(() =>
      useFileBlobUrl('u-1', 'image/png')
    )
    await waitFor(() => expect(result.current.url).toBe('blob:stub'))
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub')
  })

  it('surfaces errors from the SDK', async () => {
    downloadFile.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useFileBlobUrl('u-1', 'image/png'))
    await waitFor(() => expect(result.current.error?.message).toBe('boom'))
    expect(result.current.url).toBeNull()
  })

  it('does not fetch when uuid is missing', () => {
    renderHook(() => useFileBlobUrl(null, 'image/png'))
    expect(downloadFile).not.toHaveBeenCalled()
  })
})
