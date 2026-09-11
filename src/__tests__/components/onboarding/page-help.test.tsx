import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { PageHelp } from '@/components/onboarding/page-help'
import { queryKeys } from '@/lib/query-keys'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const USER = { id: 'user-a', identities: [], preferences: {} }

let authLoading = false

/**
 * Reads out of the query cache, exactly as the real `useAuth` does. A frozen
 * object here would hide the optimistic update, which is the whole point of the
 * "dot clears immediately" case.
 */
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    preferences: (
      queryClient.getQueryData(queryKeys.users.current) as
        | { preferences?: unknown }
        | undefined
    )?.preferences,
    authLoading,
    isAuthenticated: true,
  }),
}))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

let queryClient: QueryClient

const setStored = (preferences: Record<string, Record<string, unknown>>) =>
  queryClient.setQueryData(queryKeys.users.current, { ...USER, preferences })
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const dot = () => screen.queryByTestId('concept-hint-unread')
const trigger = () => screen.getByRole('button')

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  authLoading = false
  queryClient.setQueryData(queryKeys.users.current, USER)
  // The node echoes the FULL merged bag; resolving `{}` would wipe the flag the
  // optimistic update just set and make every assertion below lie.
  updatePreferences.mockResolvedValue({ onboarding: { 'hint-object': true } })
})

describe('PageHelp unread dot', () => {
  it('shows the dot for a concept the account has never opened', () => {
    render(<PageHelp concept="object" />, { wrapper })
    expect(dot()).toBeInTheDocument()
  })

  it('hides the dot once the flag is stored', () => {
    setStored({ onboarding: { 'hint-object': true } })
    render(<PageHelp concept="object" />, { wrapper })
    expect(dot()).not.toBeInTheDocument()
  })

  it('records the concept the first time the hint opens', async () => {
    render(<PageHelp concept="object" />, { wrapper })

    await userEvent.hover(trigger())

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        onboarding: { 'hint-object': true },
      })
    )
  })

  it('clears the dot after opening', async () => {
    render(<PageHelp concept="object" />, { wrapper })

    await userEvent.hover(trigger())

    await waitFor(() => expect(dot()).not.toBeInTheDocument())
  })

  // The latch: a second open while the PATCH is in flight must not write again.
  it('writes once however many times it is opened', async () => {
    render(<PageHelp concept="object" />, { wrapper })

    await userEvent.hover(trigger())
    await userEvent.unhover(trigger())
    await userEvent.hover(trigger())

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledTimes(1))
  })

  it('writes nothing when the concept was already read', async () => {
    setStored({ onboarding: { 'hint-object': true } })
    render(<PageHelp concept="object" />, { wrapper })

    await userEvent.hover(trigger())

    expect(updatePreferences).not.toHaveBeenCalled()
  })

  // The dot must not appear and then vanish on every cold load.
  it('shows no dot until auth resolves', () => {
    authLoading = true
    render(<PageHelp concept="object" />, { wrapper })
    expect(dot()).not.toBeInTheDocument()
  })
})
