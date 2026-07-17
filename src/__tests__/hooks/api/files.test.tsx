import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useFileUpload, useFileDelete, useFileUrls } from '@/hooks/api/files'

const files = {
  upload: vi.fn(),
  delete: vi.fn(),
  preview: vi.fn(),
  download: vi.fn(),
}

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ files }),
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('file hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('useFileUpload uploads to the target with progress', async () => {
    files.upload.mockResolvedValue({ file: { id: 'f1' } })
    const target = { entityId: 'o1', propertyId: 'p1', valueId: 'v1' }
    const onProgress = vi.fn()
    const file = new File(['x'], 'a.txt')

    const { result } = renderHook(() => useFileUpload(), {
      wrapper: makeWrapper(),
    })
    await result.current.mutateAsync({ file, target, onProgress })

    expect(files.upload).toHaveBeenCalledWith(file, target, {
      onProgress,
      signal: undefined,
    })
  })

  it('useFileDelete deletes by id', async () => {
    files.delete.mockResolvedValue({ id: 'f1' })
    const { result } = renderHook(() => useFileDelete(), {
      wrapper: makeWrapper(),
    })
    await result.current.mutateAsync({ id: 'f1', entityId: 'o1' })
    expect(files.delete).toHaveBeenCalledWith('f1')
  })

  it('useFileUrls resolves presigned preview/download urls', async () => {
    files.preview.mockResolvedValue({ url: 'https://s3/preview' })
    files.download.mockResolvedValue({ url: 'https://s3/download' })

    const { result } = renderHook(() => useFileUrls(), {
      wrapper: makeWrapper(),
    })
    expect(await result.current.getPreviewUrl('f1')).toBe('https://s3/preview')
    expect(await result.current.getDownloadUrl('f1')).toBe(
      'https://s3/download'
    )
  })
})
