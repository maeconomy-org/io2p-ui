import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the SDK client provider — the hook reads from this context. By
// re-importing the hook fresh in each test (with vi.resetModules) we also
// reset the module-level singleton state inside upload-service.ts.
let mockClient: any
vi.mock('@/contexts', () => ({
  useIomSdkClient: () => mockClient,
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
  })

  it('returns the same service across re-renders when (client, token) is unchanged', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const first = result.current
    rerender()
    const second = result.current

    expect(second).toBe(first)
  })

  it('rebuilds the service when the token changes (re-auth on same client)', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const before = result.current

    // Same client object, new JWT — must NOT reuse the old service so any
    // in-flight queue tied to the previous session is dropped.
    mockClient.getToken = () => 'jwt-B'
    rerender()
    const after = result.current

    expect(after).not.toBe(before)
  })

  it('rebuilds the service when the client instance changes', async () => {
    mockClient = makeClient('jwt-A')
    const { useUploadService } = await import('@/lib/upload-service')

    const { result, rerender } = renderHook(() => useUploadService())
    const before = result.current

    mockClient = makeClient('jwt-A') // new identity, same token value
    rerender()
    const after = result.current

    expect(after).not.toBe(before)
  })
})
