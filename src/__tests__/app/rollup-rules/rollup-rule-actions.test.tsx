// The row menu against the node's ladder. Recompute is the first action here that costs the node
// real work — a fan-out across every entity holding the key — so who may press it matters as much
// as what it does.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RollupRuleDTO } from 'io2p-client'

// The actions cell reads the viewer from context; the real hook needs a QueryClient.
const authState = { userId: 'me', authLoading: false }
vi.mock('@/contexts', () => ({ useAuth: () => authState }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

import { buildRollupRuleColumns } from '@/app/rollup-rules/components/rollup-rule-columns'

const actions = {
  onViewDetails: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
  onRecompute: vi.fn(),
  onEdit: vi.fn(),
}

const rule = (over: Partial<RollupRuleDTO> = {}) =>
  ({
    id: 'r-1',
    propertyKey: 'mass',
    aggregation: 'sum',
    system: false,
    ownerUserId: 'me',
    deleted: false,
    createdBy: 'me',
    ...over,
  }) as RollupRuleDTO

const renderCell = (r: RollupRuleDTO) => {
  const columns = buildRollupRuleColumns({
    t: (key: string) => key,
    locale: 'en',
    actions,
  })
  const cell = columns.at(-1)!.cell as (ctx: unknown) => React.ReactNode
  render(<>{cell({ row: { original: r } })}</>)
}

const openMenu = async (r: RollupRuleDTO) => {
  renderCell(r)
  await userEvent
    .setup()
    .click(screen.getByTestId('rollup-rule-actions-dropdown'))
}

describe('rollup rule row actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers recompute on a live rule you own', async () => {
    await openMenu(rule())
    expect(
      screen.getByTestId('rollup-rule-action-recompute')
    ).toBeInTheDocument()
  })

  it('runs the recompute for that rule', async () => {
    await openMenu(rule())
    await userEvent
      .setup()
      .click(screen.getByTestId('rollup-rule-action-recompute'))
    expect(actions.onRecompute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r-1' })
    )
  })

  // A system rule fans out across every object on the node, so it is not a user-triggerable lever
  // — the node answers 403 and the menu never offers it.
  it('offers nothing at all on a system rule', () => {
    renderCell(rule({ system: true, ownerUserId: undefined }))
    expect(screen.queryByTestId('rollup-rule-actions-dropdown')).toBeNull()
  })

  // A deleted rule computes nothing, so recomputing it would queue a fan-out that only sweeps its
  // state rows away. Restore is the one move that makes sense.
  it('offers only restore on a deleted rule, never recompute', async () => {
    await openMenu(rule({ deleted: true }))
    expect(screen.getByTestId('rollup-rule-action-restore')).toBeInTheDocument()
    expect(screen.queryByTestId('rollup-rule-action-recompute')).toBeNull()
  })

  // Edit reaches exactly one field. Share has no route at all: a rule is the node's or yours.
  it('offers edit, but never share', async () => {
    await openMenu(rule())
    expect(screen.getByTestId('rollup-rule-action-edit')).toBeInTheDocument()
    expect(screen.queryByTestId('rollup-rule-action-share')).toBeNull()
  })

  it('offers no edit on a deleted rule either', async () => {
    await openMenu(rule({ deleted: true }))
    expect(screen.queryByTestId('rollup-rule-action-edit')).toBeNull()
  })
})
