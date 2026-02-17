import React, { ReactNode } from 'react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, RenderHookOptions } from '@testing-library/react'

/**
 * Creates a mock QueryClient for testing
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

/**
 * A wrapper component that provides necessary context for testing hooks
 */
export const createTestWrapper = (queryClient = createTestQueryClient()) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

/**
 * Helper to render a hook with common providers
 */
export const renderHookWithProviders = <Result, Props>(
  render: (props: Props) => Result,
  options?: RenderHookOptions<Props>
) => {
  return renderHook(render, {
    wrapper: createTestWrapper(),
    ...options,
  })
}

/**
 * Creates a mock IOM SDK Client
 */
export const createMockSdkClient = () => ({
  ready: Promise.resolve(),
  onAuthStateChange: vi.fn(() => vi.fn()),
  login: vi.fn(),
  logout: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
})

/**
 * Mock Auth State for testing
 */
export const createMockAuthContext = (overrides = {}) => ({
  isAuthenticated: true,
  authLoading: false,
  isRefreshing: false,
  userUUID: 'test-user-uuid',
  userInfo: {
    userUUID: 'test-user-uuid',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
  logout: vi.fn(),
  handleAuth: vi.fn(),
  handleEmailLogin: vi.fn(),
  handleForgotPassword: vi.fn(),
  handleEmailVerification: vi.fn(),
  handleResendVerification: vi.fn(),
  ...overrides,
})
