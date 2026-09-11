import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  useAuth: () => ({
    userId: USER,
    preferences,
    authLoading: false,
    isAuthenticated: true,
  }),
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

  // The rows are dropdowns: the trigger shows the current value, and the options only exist once
  // it is opened. userEvent, not fireEvent — Radix opens on a full pointer sequence.
  const choose = async (testId: string, option: string) => {
    const user = userEvent.setup()
    await user.click(screen.getByTestId(`${testId}-trigger`))
    await user.click(await screen.findByTestId(`${testId}-${option}`))
  }

  it('shows the default properties view on the trigger', () => {
    renderPrefs()
    expect(screen.getByTestId('pref-properties-trigger')).toHaveTextContent(
      'detailed'
    )
  })

  it('persists the properties view to the account when chosen', async () => {
    renderPrefs()
    await choose('pref-properties', 'grid')

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { propertiesView: 'grid' },
      })
    )
  })

  it('persists the objects view when chosen', async () => {
    renderPrefs()
    await choose('pref-objects', 'columns')

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { objectsView: 'columns' },
      })
    )
  })

  it('persists the process view when chosen', async () => {
    renderPrefs()
    await choose('pref-processes', 'sankey')

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith({
        ui: { processView: 'sankey' },
      })
    )
  })

  it('renders a labelled row for every preference', () => {
    renderPrefs()
    for (const id of [
      'pref-objects',
      'pref-processes',
      'pref-properties',
      'pref-objectsScope',
      'pref-processScope',
      'pref-formulaScope',
      'pref-constantScope',
      'pref-templateScope',
      'pref-page-size',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('offers only process views that exist', async () => {
    // A stored preference for a retired view is what makes this matter: the option list is the
    // single source of what the page can actually render.
    renderPrefs()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('pref-processes-trigger'))

    expect(
      await screen.findByTestId('pref-processes-table')
    ).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes-sankey')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes-network')).toBeInTheDocument()
    // Dashboard was retired with the statement-era analytics it computed.
    expect(screen.queryByTestId('pref-processes-dashboard')).toBeNull()
  })

  it('falls back to a real option when the stored view was retired', () => {
    // Without the fallback the trigger renders empty, which reads as "no default".
    preferences = { ui: { processView: 'dashboard' } }
    renderPrefs()

    expect(screen.getByTestId('pref-processes-trigger')).toHaveTextContent(
      'table'
    )
  })

  it('defaults every access row to the whole slice', () => {
    renderPrefs()
    expect(screen.getByTestId('pref-objectsScope-trigger')).toHaveTextContent(
      'scopeAll'
    )
  })
})
