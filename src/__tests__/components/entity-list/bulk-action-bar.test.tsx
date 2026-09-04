import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Share2 } from 'lucide-react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { BulkActionBar } from '@/components/entity-list/bulk-action-bar'

const shareAction = (extra: Record<string, unknown> = {}) => ({
  key: 'share',
  label: 'Share',
  icon: Share2,
  onSelect: vi.fn(),
  ...extra,
})

describe('BulkActionBar generic actions', () => {
  it('renders an action that applies to the whole selection', () => {
    render(
      <BulkActionBar count={3} onClear={vi.fn()} actions={[shareAction()]} />
    )
    expect(screen.getByTestId('bulk-share')).toBeInTheDocument()
  })

  it('omits an action the viewer cannot perform on anything', () => {
    // Omitted, not disabled: a greyed button claims the feature exists and gives no reason.
    render(
      <BulkActionBar
        count={3}
        onClear={vi.fn()}
        actions={[shareAction({ hidden: true })]}
      />
    )
    expect(screen.queryByTestId('bulk-share')).not.toBeInTheDocument()
  })

  it('names the subset when the action covers fewer rows than are selected', () => {
    render(
      <BulkActionBar
        count={5}
        onClear={vi.fn()}
        actions={[shareAction({ actionable: 2 })]}
      />
    )
    expect(screen.getByTestId('bulk-share').textContent).toContain(
      'common.bulk.partial'
    )
  })

  it('leaves the label alone when every selected row is covered', () => {
    render(
      <BulkActionBar
        count={2}
        onClear={vi.fn()}
        actions={[shareAction({ actionable: 2 })]}
      />
    )
    expect(screen.getByTestId('bulk-share').textContent).toContain('Share')
    expect(screen.getByTestId('bulk-share').textContent).not.toContain(
      'partial'
    )
  })
})
