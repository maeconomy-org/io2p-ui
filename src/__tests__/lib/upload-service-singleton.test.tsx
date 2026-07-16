import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the SDK client + auth providers — the hook reads from both contexts. By
// re-importing the hook fresh in each test (with vi.resetModules) we also
// reset the module-level singleton state inside upload-service.ts.
let mockClient: any
let mockUserUUID: string | undefined
vi.mock('@/contexts', () => ({
  useIomSdkClient: () => mockClient,
  useAuth: () => ({ userId: mockUserUUID }),
}))

// Mock the logger so test output stays clean.
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

function makeClient(token: string | null) {
  return {
    node: { uploadFileByReference: vi.fn() },
    fileStorage: { uploadFile: vi.fn() },
    getToken: () => token,
  }
}

describe('useUploadService — singleton keying', () => {
  beforeEach(() => {
    vi.resetModules()
    mockUserUUID = 'user-1'
  })

  it('returns the same service across re-renders when (client, identity) is unchanged', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const first = result.current
    rerender()
    const second = result.current

    expect(second).toBe(first)
  })

  it('preserves the service across a background token refresh (same user, new JWT)', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const before = result.current

    // The SDK auto-refreshes the access token while keeping the same user.
    // The service MUST survive so any in-flight upload keeps notifying the UI
    // instead of being orphaned on the old instance (the bug that left the
    // upload-center stuck at "uploading 0%").
    mockClient.getToken = () => 'jwt-B'
    rerender()
    const after = result.current

    expect(after).toBe(before)
  })

  it('rebuilds the service on identity change (logout / user switch)', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const before = result.current

    // Different user now — must NOT reuse the old service so the previous
    // session's queue is dropped.
    mockUserUUID = 'user-2'
    rerender()
    const after = result.current

    expect(after).not.toBe(before)
  })

  it('rebuilds the service when the client instance changes', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const before = result.current

    mockClient = makeClient('jwt-A') // new client instance, same identity
    rerender()
    const after = result.current

    expect(after).not.toBe(before)
  })
})
