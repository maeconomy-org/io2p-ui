// The details sheet's footer. Recompute costs the node a fan-out across every entity holding the
// key, so it stays in the row menu where it is deliberate; the sheet ends in the action that
// changes what the sheet is showing.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RollupRuleDTO } from 'io2p-client'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ dateTime: (d: Date) => d.toISOString() }),
}))

vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

import { RollupRuleSheet } from '@/app/rollup-rules/components/rollup-rule-sheet'

const rule = (over: Partial<RollupRuleDTO> = {}) =>
  ({
    id: 'r-1',
    propertyKey: 'mass',
    aggregation: 'sum',
    system: false,
    ownerUserId: 'me',
    deleted: false,
    createdBy: 'me',
    createdAt: '2026-09-09T15:51:37.000Z',
    ...over,
  }) as RollupRuleDTO

function renderView(onEdit?: (r: RollupRuleDTO) => void) {
  render(
    <RollupRuleSheet
      open
      onOpenChange={vi.fn()}
      mode="view"
      rule={rule()}
      onEdit={onEdit}
    />
  )
}

describe('rollup rule details footer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no longer offers a recompute', () => {
    renderView(vi.fn())

    expect(screen.queryByTestId('rollup-rule-recompute')).toBeNull()
    expect(screen.queryByText('rollupRules.recompute')).toBeNull()
  })

  it('offers edit when the viewer may change the rule', async () => {
    const onEdit = vi.fn()
    renderView(onEdit)

    await userEvent.setup().click(screen.getByTestId('rollup-rule-view-edit'))

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-1' }))
  })

  it('offers only Close when the rule is not the viewer’s to change', () => {
    // A system rule, another account's rule, and a deleted one all arrive the same way: the page
    // withholds the callback rather than the sheet re-deriving the permission.
    renderView(undefined)

    expect(screen.queryByTestId('rollup-rule-view-edit')).toBeNull()
    expect(screen.getByText('common.close')).toBeInTheDocument()
  })
})
