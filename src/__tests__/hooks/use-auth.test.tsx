import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/contexts/auth-context'
import React from 'react'

// Mock next/navigation
const mockReplace = vi.fn()
const mockPush = vi.fn()
let mockPathname = '/'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}))

describe('AuthProvider & useAuth', () => {
  const mockClient: any = {
    ready: Promise.resolve(),
    onAuthStateChange: vi.fn(),
    logout: vi.fn(),
    login: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname = '/'
    mockClient.ready = Promise.resolve()
    mockClient.onAuthStateChange.mockImplementation((cb: any) => {
      cb({ isAuthenticated: false, isRefreshing: false, user: null })
      return () => {}
    })
  })

  it('should initialize with loading state then stop loading', async () => {
    let resolveReady: any
    mockClient.ready = new Promise((resolve) => {
      resolveReady = resolve
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider client={mockClient}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    // It should be loading initially because ready is not resolved and we are not refreshing
    // Wait, onAuthStateChange is called immediately in my refactored AuthProvider.
    // If isRefreshing is false, it sets loading to false.
    // Let's mock it correctly.

    mockClient.onAuthStateChange.mockImplementation((cb: any) => {
      cb({ isAuthenticated: false, isRefreshing: true, user: null })
      return () => {}
    })

    const { result: result2 } = renderHook(() => useAuth(), { wrapper })
    expect(result2.current.authLoading).toBe(true)

    await waitFor(() => {
      resolveReady()
    })

    await waitFor(() => {
      expect(result2.current.authLoading).toBe(false)
    })
  })

  it('should redirect to home if not authenticated on private page', async () => {
    mockPathname = '/objects'

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider client={mockClient}>{children}</AuthProvider>
    )

    renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('should handle logout', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider client={mockClient}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    result.current.logout()

    expect(mockPush).toHaveBeenCalledWith('/')
    expect(mockClient.logout).toHaveBeenCalled()
  })
})
