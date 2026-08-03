import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { PreferencesSettings } from '@/app/settings/components/preferences-settings'
import { queryKeys } from '@/lib/query-keys'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const USER = 'user-a-uuid'
let preferences: Record<string, Record<string, unknown>> | undefined
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userId: USER, preferences, authLoading: false }),
}))

const updatePreferences = vi.fn()
vi.mock('@/lib/io2p', () => ({
  useIomClient: () => ({ users: { updatePreferences } }),
}))

let queryClient: QueryClient
const renderPrefs = () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<PreferencesSettings />, { wrapper })
}

describe('PreferencesSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preferences = undefined
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(queryKeys.users.current, {
      id: USER,
      identities: [],
      preferences: {},
    })
    updatePreferences.mockResolvedValue({})
  })

  it('reflects the default properties view (detailed) on first render', () => {
    renderPrefs()
    expect(screen.getByTestId('pref-properties-detailed')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('pref-properties-grid')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('persists the properties view to the account when toggled', async () => {
    renderPrefs()
    fireEvent.click(screen.getByTestId('pref-properties-grid'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { propertiesView: 'grid' },
      })
    )
  })

  it('persists the objects view when a segment is chosen', async () => {
    renderPrefs()
    fireEvent.click(screen.getByTestId('pref-objects-columns'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { objectsView: 'columns' },
      })
    )
  })

  it('persists the process view when a segment is chosen', async () => {
    renderPrefs()
    fireEvent.click(screen.getByTestId('pref-processes-sankey'))

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { processView: 'sankey' },
      })
    )
  })

  it('renders a labelled row for each of the three preferences', () => {
    renderPrefs()
    expect(screen.getByTestId('pref-objects')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes')).toBeInTheDocument()
    expect(screen.getByTestId('pref-properties')).toBeInTheDocument()
  })

  it('offers only process views that exist', () => {
    // A stored preference for a retired view is what makes this matter: the option list is the
    // single source of what the page can actually render.
    renderPrefs()
    expect(screen.getByTestId('pref-processes-table')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes-sankey')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes-network')).toBeInTheDocument()
    // Dashboard was retired with the statement-era analytics it computed.
    expect(
      screen.queryByTestId('pref-processes-dashboard')
    ).not.toBeInTheDocument()
  })

  it('falls back to a real option when the stored view was retired', () => {
    // Without the fallback the control renders with nothing selected, which reads as "no default".
    preferences = { ui: { processView: 'dashboard' } }
    renderPrefs()

    expect(screen.getByTestId('pref-processes-table')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
