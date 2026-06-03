import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { FileData } from '@/types'

// `useFileThumbnail`'s only hook dependency is `usePreviewUrl`. Mocking it to a
// plain function (no real React Query) turns the hook into a pure mapping we can
// call directly and assert — including the gate it passes downstream.
const usePreviewUrl = vi.fn()
vi.mock('@/hooks', () => ({
  usePreviewUrl: (...args: unknown[]) => usePreviewUrl(...args),
}))

import { useFileThumbnail } from '@/components/object-sheets/hooks/use-file-thumbnail'

function makeFile(overrides: Partial<FileData> = {}): FileData {
  return {
    uuid: 'u1',
    fileName: 'photo.png',
    fileReference: 'ref-1',
    contentType: 'image/png',
    ...overrides,
  }
}

const queryResult = (over: Record<string, unknown> = {}) => ({
  data: undefined,
  isError: false,
  isLoading: false,
  ...over,
})

beforeEach(() => {
  usePreviewUrl.mockReset()
})

describe('useFileThumbnail', () => {
  it('returns a ready img state with the presigned url for a visible image', () => {
    usePreviewUrl.mockReturnValue(
      queryResult({ data: { url: 'https://s3/photo.png' } })
    )

    const state = useFileThumbnail(makeFile(), true)

    expect(state).toEqual({
      status: 'ready',
      src: 'https://s3/photo.png',
      tag: 'img',
    })
    // Gate is open: (fileReference, enabled && isImage) === (ref, true)
    expect(usePreviewUrl).toHaveBeenCalledWith('ref-1', true)
  })

  it('reports loading while the preview url is unresolved', () => {
    usePreviewUrl.mockReturnValue(queryResult({ isLoading: true }))
    expect(useFileThumbnail(makeFile(), true)).toEqual({ status: 'loading' })
  })

  it('reports error when the preview url query fails', () => {
    usePreviewUrl.mockReturnValue(queryResult({ isError: true }))
    expect(useFileThumbnail(makeFile(), true)).toEqual({ status: 'error' })
  })

  it('falls back to icon (and never fetches) for a non-image file', () => {
    usePreviewUrl.mockReturnValue(queryResult())

    const state = useFileThumbnail(
      makeFile({
        fileName: 'model.gcode',
        fileReference: 'ref-2',
        contentType: 'application/octet-stream',
      }),
      true
    )

    expect(state).toEqual({ status: 'icon' })
    // Gate is closed even though the tile is visible.
    expect(usePreviewUrl).toHaveBeenCalledWith('ref-2', false)
  })

  it('treats an external image reference as a non-thumbnailable icon', () => {
    usePreviewUrl.mockReturnValue(queryResult())

    const state = useFileThumbnail(
      makeFile({ fileReference: 'https://example.com/remote.png' }),
      true
    )

    expect(state).toEqual({ status: 'icon' })
    expect(usePreviewUrl).toHaveBeenCalledWith(
      'https://example.com/remote.png',
      false
    )
  })

  it('keeps the gate closed for an off-screen image (enabled=false)', () => {
    usePreviewUrl.mockReturnValue(queryResult())

    const state = useFileThumbnail(makeFile(), false)

    expect(state).toEqual({ status: 'loading' })
    expect(usePreviewUrl).toHaveBeenCalledWith('ref-1', false)
  })
})
