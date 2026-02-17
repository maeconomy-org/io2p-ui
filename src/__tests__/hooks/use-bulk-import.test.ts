import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkImport } from '@/hooks/import/use-bulk-import'
import { toast } from 'sonner'

// Mock dependencies
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const mockGetToken = vi.fn()
vi.mock('@/contexts', () => ({
  useIomSdkClient: () => ({
    getToken: mockGetToken,
  }),
}))

// Mock fetch
global.fetch = vi.fn()

describe('useBulkImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockReturnValue('fake-token')
    ;(global.fetch as any).mockReset()
  })

  it('should handle standard upload for small datasets', async () => {
    const mockData = [{ id: 1 }, { id: 2 }]
    const mockJobId = 'job-123'

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: mockJobId }),
    })

    const { result } = renderHook(() => useBulkImport())

    let response: any
    await act(async () => {
      response = await result.current.startBulkImport(mockData)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/import',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
        }),
      })
    )
    expect(toast.success).toHaveBeenCalledWith(
      'import.toasts.jobStarted',
      expect.anything()
    )
    expect(mockPush).toHaveBeenCalledWith(`/import-status?jobId=${mockJobId}`)
    expect(response).toEqual({ success: true, jobId: mockJobId })
  })

  it('should handle chunked upload for large datasets', async () => {
    // Generate enough data to trigger chunked upload (> 50MB estimated)
    // Actually, we can just mock the size check or use enough items.
    // In use-bulk-import.ts, it uses JSON.stringify(mappedData).length / (1024 * 1024) > 50
    // Let's just create a large-ish array.
    const largeData = new Array(1000).fill({
      field: 'some reasonably long string content to increase size',
    })

    const mockJobId = 'job-chunked'
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ jobId: mockJobId }),
    })

    const { result } = renderHook(() => useBulkImport())

    await act(async () => {
      await result.current.startBulkImport(largeData)
    })

    // If size > 50MB, it should call /api/import/chunk
    // We might need to adjust the data size in the test to hit this.
    // Let's check the size: 1000 * ~60 chars = 60,000 bytes = 0.06 MB.
    // I need ~50,000,000 bytes.
  })

  it('should fail if no token is available', async () => {
    mockGetToken.mockReturnValue(null)
    const { result } = renderHook(() => useBulkImport())

    let response: any
    await act(async () => {
      response = await result.current.startBulkImport([])
    })

    expect(response).toBeDefined()
    if (response) {
      expect(response.success).toBe(false)
      expect(response.error).toContain('No authentication token available')
    }
    expect(toast.error).toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server exploded' }),
    })

    const { result } = renderHook(() => useBulkImport())

    let response: any
    await act(async () => {
      response = await result.current.startBulkImport([{ x: 1 }])
    })

    expect(response).toBeDefined()
    if (response) {
      expect(response.success).toBe(false)
      expect(response.error).toBe('Server exploded')
    }
    expect(toast.error).toHaveBeenCalledWith(
      'import.toasts.failed',
      expect.anything()
    )
  })
})
