import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useAuth, AuthEffects } from '@/contexts/auth-context'

// --- next/navigation ---
const mockReplace = vi.fn()
const mockPush = vi.fn()
let mockPathname = '/'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => mockPathname,
}))

// --- better-auth client (personal account identity) ---
let sessionState: { data: any; isPending: boolean } = {
  data: null,
  isPending: false,
}
const mockSignInEmail = vi.fn(async (_input?: any) => ({ error: null }) as any)
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockClearCoreToken = vi.fn()

vi.mock('@/lib/auth/client', () => ({
  useSession: () => sessionState,
  clearCoreToken: () => mockClearCoreToken(),
  authClient: {
    signIn: { email: (input: any) => mockSignInEmail(input) },
    signOut: () => mockSignOut(),
    getSession: () => mockGetSession(),
  },
}))

// --- io2p-client (/me = operational identity) ---
const mockMe = vi.fn(async () => ({
  id: 'core-1',
  email: 'a@b.com',
  identities: [],
}))
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { me: () => mockMe() } }),
}))

// AuthEffects clears legacy drafts — stub it (localStorage-heavy).
vi.mock('@/hooks/drafts/use-object-drafts', () => ({
  clearLegacyDrafts: vi.fn(),
}))

// jsdom's `location` is non-configurable and its assign() throws "not implemented".
const mockAssign = vi.fn()
Object.defineProperty(window, 'location', {
  configurable: true,
  value: { ...window.location, assign: mockAssign },
})

let queryClient: QueryClient
let cancelSpy: ReturnType<typeof vi.spyOn>

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPathname = '/'
  sessionState = { data: null, isPending: false }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  cancelSpy = vi.spyOn(queryClient, 'cancelQueries')
})

describe('useAuth', () => {
  it('is unauthenticated with no session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.userId).toBeUndefined()
  })

  it('reflects session loading', () => {
    sessionState = { data: null, isPending: true }
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.authLoading).toBe(true)
  })

  it('does not query /me when unauthenticated', () => {
    renderHook(() => useAuth(), { wrapper })
    expect(mockMe).not.toHaveBeenCalled()
  })

  it('exposes account from the session and id from core /me', async () => {
    sessionState = {
      data: { user: { id: 'issuer-1', email: 'a@b.com', name: 'Alice' } },
      isPending: false,
    }
    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isAuthenticated).toBe(true)
    // account info is available immediately from the session
    expect(result.current.userInfo?.username).toBe('Alice')
    expect(result.current.userInfo?.identifier).toBe('a@b.com')
    // the operational id comes from /me (core), resolves async
    await waitFor(() => expect(result.current.userId).toBe('core-1'))
    expect(mockMe).toHaveBeenCalled()
    // authLoading only clears once /me resolves too
    await waitFor(() => expect(result.current.authLoading).toBe(false))
  })

  it('logout signs out at the issuer and leaves via a full document load', async () => {
    sessionState = { data: { user: { id: 'issuer-1' } }, isPending: false }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await result.current.logout()
    expect(mockSignOut).toHaveBeenCalled()
    // A client-side push would leave the protected page mounted, and every query
    // on it refetches against the session being torn down.
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockAssign).toHaveBeenCalledWith('/')
  })

  it('logout cancels in-flight queries before dropping the token', async () => {
    sessionState = { data: { user: { id: 'issuer-1' } }, isPending: false }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await result.current.logout()
    expect(cancelSpy).toHaveBeenCalled()
    expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockClearCoreToken.mock.invocationCallOrder[0]
    )
  })

  it('handleEmailLogin delegates to authClient.signIn.email', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    const res = await result.current.handleEmailLogin('a@b.com', 'pw')
    expect(mockSignInEmail).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
    })
    expect(res.success).toBe(true)
  })

  it('handleEmailLogin surfaces the issuer error message', async () => {
    mockSignInEmail.mockResolvedValueOnce({
      error: { message: 'bad creds' },
    } as any)
    const { result } = renderHook(() => useAuth(), { wrapper })
    const res = await result.current.handleEmailLogin('a@b.com', 'pw')
    expect(res.success).toBe(false)
    expect(res.error).toBe('bad creds')
  })
})

describe('AuthEffects', () => {
  it('redirects to / when unauthenticated on a private page', async () => {
    mockPathname = '/objects'
    sessionState = { data: null, isPending: false }
    render(<AuthEffects />, { wrapper })
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })

  it('does not redirect on a public page', async () => {
    mockPathname = '/'
    sessionState = { data: null, isPending: false }
    render(<AuthEffects />, { wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect while the session is still pending', async () => {
    mockPathname = '/objects'
    sessionState = { data: null, isPending: true }
    render(<AuthEffects />, { wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
