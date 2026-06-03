import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { PreferencesSettings } from '@/app/settings/components/preferences-settings'
import { keyFor } from '@/hooks/ui/use-preference'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const USER = 'user-a-uuid'
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ userUUID: USER }),
}))

const cfg = vi.hoisted(() => ({ processDashboardEnabled: 'true' }))
vi.mock('@/contexts', () => ({
  useAppConfig: () => cfg,
}))

describe('PreferencesSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    cfg.processDashboardEnabled = 'true'
  })

  it('reflects the default properties view (detailed) on first render', () => {
    render(<PreferencesSettings />)
    expect(screen.getByTestId('pref-properties-detailed')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('pref-properties-grid')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('persists the properties view to the account blob when toggled', () => {
    render(<PreferencesSettings />)
    fireEvent.click(screen.getByTestId('pref-properties-grid'))

    expect(screen.getByTestId('pref-properties-grid')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const blob = JSON.parse(localStorage.getItem(keyFor(USER)) as string)
    expect(blob.propertiesView).toBe('grid')
  })

  it('persists the objects view when a segment is chosen', () => {
    render(<PreferencesSettings />)
    fireEvent.click(screen.getByTestId('pref-objects-columns'))

    const blob = JSON.parse(localStorage.getItem(keyFor(USER)) as string)
    expect(blob.objectsView).toBe('columns')
  })

  it('persists the process view when a segment is chosen', () => {
    render(<PreferencesSettings />)
    fireEvent.click(screen.getByTestId('pref-processes-sankey'))

    const blob = JSON.parse(localStorage.getItem(keyFor(USER)) as string)
    expect(blob.processView).toBe('sankey')
  })

  it('reflects the default files view (list) on first render', () => {
    render(<PreferencesSettings />)
    expect(screen.getByTestId('pref-files-list')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByTestId('pref-files-grid')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('persists the files view to the account blob when toggled', () => {
    render(<PreferencesSettings />)
    fireEvent.click(screen.getByTestId('pref-files-grid'))

    expect(screen.getByTestId('pref-files-grid')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const blob = JSON.parse(localStorage.getItem(keyFor(USER)) as string)
    expect(blob.filesView).toBe('grid')
  })

  it('renders a labelled row for each of the four preferences', () => {
    render(<PreferencesSettings />)
    expect(screen.getByTestId('pref-objects')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes')).toBeInTheDocument()
    expect(screen.getByTestId('pref-properties')).toBeInTheDocument()
    expect(screen.getByTestId('pref-files')).toBeInTheDocument()
  })

  it('shows the dashboard process option when the flag is enabled', () => {
    render(<PreferencesSettings />)
    expect(screen.getByTestId('pref-processes-dashboard')).toBeInTheDocument()
  })

  it('hides the dashboard process option when PROCESS_DASHBOARD_ENABLED is off', () => {
    cfg.processDashboardEnabled = 'false'
    render(<PreferencesSettings />)
    expect(
      screen.queryByTestId('pref-processes-dashboard')
    ).not.toBeInTheDocument()
    // the other process views remain available
    expect(screen.getByTestId('pref-processes-sankey')).toBeInTheDocument()
  })
})
