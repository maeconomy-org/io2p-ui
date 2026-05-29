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

describe('PreferencesSettings', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('renders a labelled row for each of the three preferences', () => {
    render(<PreferencesSettings />)
    expect(screen.getByTestId('pref-objects')).toBeInTheDocument()
    expect(screen.getByTestId('pref-processes')).toBeInTheDocument()
    expect(screen.getByTestId('pref-properties')).toBeInTheDocument()
  })
})
