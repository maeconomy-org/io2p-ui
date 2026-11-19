import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotFoundError } from 'io2p-client'

import {
  useFileUpload,
  useFileDelete,
  useFileDownload,
  useSignedUrlPrefetch,
  signedFileUrlQuery,
  triggerBrowserDownload,
  signedUrlStaleTime,
} from '@/hooks/api/files'
import { queryKeys } from '@/lib/query-keys'

const files = {
  upload: vi.fn(),
  delete: vi.fn(),
  preview: vi.fn(),
  download: vi.fn(),
}

const toastError = vi.fn()

vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ files }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function problem(status: number) {
  return { type: 'about:blank', title: 'Not Found', status }
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
})

describe('signedFileUrlQuery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the variant to preview and omits options when there is none', async () => {
    files.preview.mockResolvedValue({ url: 'https://s3/thumb' })
    const client = { files } as never

    await signedFileUrlQuery(client, 'f1', 'preview', 'thumbnail').queryFn()
    expect(files.preview).toHaveBeenCalledWith('f1', { variant: 'thumbnail' })

    await signedFileUrlQuery(client, 'f1', 'preview').queryFn()
    expect(files.preview).toHaveBeenLastCalledWith('f1', undefined)
  })

  it('derives staleness from the server expiry, with a refresh lead', () => {
    const now = 1_000_000
    const stale = signedUrlStaleTime({
      state: {
        data: { url: 'u', expiresAt: now + 900_000 },
        dataUpdatedAt: now,
      },
    })
    // Under the full TTL — a url handed out on the boundary would 403.
    expect(stale).toBeLessThan(900_000)
    expect(stale).toBeGreaterThan(0)
  })

  it('never returns a negative window for an already-expired url', () => {
    const now = 1_000_000
    expect(
      signedUrlStaleTime({
        state: {
          data: { url: 'u', expiresAt: now - 5_000 },
          dataUpdatedAt: now,
        },
      })
    ).toBeGreaterThan(0)
  })

  it('falls back before any response has reported an expiry', () => {
    expect(
      signedUrlStaleTime({ state: { data: undefined, dataUpdatedAt: 0 } })
    ).toBeGreaterThan(0)
  })

  it('keys preview and download separately, and by variant', () => {
    expect(queryKeys.files.url('f1', 'preview')).not.toEqual(
      queryKeys.files.url('f1', 'download')
    )
    expect(queryKeys.files.url('f1', 'preview', 'thumbnail')).not.toEqual(
      queryKeys.files.url('f1', 'preview')
    )
  })
})

describe('useFileDownload', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })
  afterEach(() => clickSpy.mockRestore())

  it('mints a url then navigates an anchor carrying it', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download?sig=abc' })
    let href = ''
    let downloadAttr = ''
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      href = this.href
      downloadAttr = this.download
    })

    const { result } = renderHook(() => useFileDownload(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 'f1', fileName: 'spec.pdf' })
    })

    expect(files.download).toHaveBeenCalledWith('f1')
    expect(href).toBe('https://s3/download?sig=abc')
    expect(downloadAttr).toBe('spec.pdf')
  })

  it('never fetches the bytes — the JWT must not reach S3', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const { result } = renderHook(() => useFileDownload(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 'f1' })
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('reuses a hover-prefetched url instead of minting a second one', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const wrapper = makeWrapper()

    const { result } = renderHook(
      () => ({
        prefetch: useSignedUrlPrefetch('f1', 'download'),
        download: useFileDownload(),
      }),
      { wrapper }
    )

    await act(async () => {
      result.current.prefetch.onMouseEnter()
    })
    await act(async () => {
      await result.current.download.mutateAsync({ id: 'f1' })
    })

    expect(files.download).toHaveBeenCalledTimes(1)
  })

  it('does not let a prefetched preview satisfy a download', async () => {
    files.preview.mockResolvedValue({ url: 'https://s3/preview' })
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const wrapper = makeWrapper()

    const { result } = renderHook(
      () => ({
        prefetch: useSignedUrlPrefetch('f1', 'preview'),
        download: useFileDownload(),
      }),
      { wrapper }
    )

    await act(async () => {
      result.current.prefetch.onMouseEnter()
    })
    await act(async () => {
      await result.current.download.mutateAsync({ id: 'f1' })
    })

    expect(files.download).toHaveBeenCalledTimes(1)
  })

  it('toasts and does not navigate when minting fails', async () => {
    files.download.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useFileDownload(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 'f1' }).catch(() => undefined)
    })

    expect(clickSpy).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('common.downloadFailed')
  })

  it('reports a deleted or not-ready file distinctly on 404', async () => {
    files.download.mockRejectedValue(new NotFoundError(problem(404)))

    const { result } = renderHook(() => useFileDownload(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 'f1' }).catch(() => undefined)
    })

    expect(toastError).toHaveBeenCalledWith('objects.files.unavailable')
  })
})

describe('useSignedUrlPrefetch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mints once when the pointer enters nested children', async () => {
    files.download.mockResolvedValue({ url: 'https://s3/download' })
    const { result } = renderHook(
      () => useSignedUrlPrefetch('f1', 'download'),
      { wrapper: makeWrapper() }
    )

    await act(async () => {
      result.current.onMouseEnter()
      result.current.onFocus()
      result.current.onMouseEnter()
    })

    expect(files.download).toHaveBeenCalledTimes(1)
  })

  it('does nothing without an id or when disabled', async () => {
    const { result } = renderHook(
      () => ({
        noId: useSignedUrlPrefetch(undefined, 'download'),
        disabled: useSignedUrlPrefetch('f1', 'download', { enabled: false }),
      }),
      { wrapper: makeWrapper() }
    )

    await act(async () => {
      result.current.noId.onMouseEnter()
      result.current.disabled.onMouseEnter()
    })

    expect(files.download).not.toHaveBeenCalled()
  })
})

describe('triggerBrowserDownload', () => {
  it('removes the anchor after clicking it', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.isConnected).toBe(true)
      })

    triggerBrowserDownload('https://s3/x', 'a.txt')

    expect(clickSpy).toHaveBeenCalled()
    expect(document.querySelector('a[href="https://s3/x"]')).toBeNull()
    clickSpy.mockRestore()
  })
})
