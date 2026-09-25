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

const renderColumn = (
  columnId: string,
  r: RollupRuleDTO,
  replacedKeys: ReadonlySet<string> = new Set()
) => {
  const columns = buildRollupRuleColumns({
    t: (key: string) => key,
    locale: 'en',
    actions,
    replacedKeys,
  })
  const column = columns.find((c) => c.id === columnId)!
  const cell = column.cell as (ctx: unknown) => React.ReactNode
  render(<>{cell({ row: { original: r } })}</>)
}

const renderCell = (r: RollupRuleDTO) => renderColumn('actions', r)

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

/**
 * A built-in rule a user rule replaces still EXISTS — the node's uniqueness index is per tier, so
 * both rows come back — but it no longer computes on that user's own objects. Without the mark the
 * list shows a total they will never see, beside one they will.
 */
describe('the built-in a user rule replaces', () => {
  const replaced = new Set(['mass'])
  const badge = () => screen.queryByTestId('rollup-rule-replaced')

  it('marks the built-in whose key the viewer owns a rule for', () => {
    renderColumn('propertyKey', rule({ system: true }), replaced)
    expect(badge()).toBeInTheDocument()
  })

  it('leaves a built-in on an untouched key alone', () => {
    renderColumn(
      'propertyKey',
      rule({ system: true, propertyKey: 'volume' }),
      replaced
    )
    expect(badge()).toBeNull()
  })

  // The viewer's OWN rule is the one doing the replacing; marking it would say the opposite.
  it('never marks the rule doing the replacing', () => {
    renderColumn('propertyKey', rule({ system: false }), replaced)
    expect(badge()).toBeNull()
  })

  // A deleted user rule brings the built-in total back, and a deleted built-in computes nothing
  // either way — a row struck through is not the place to claim a live relationship.
  it('says nothing about a deleted built-in', () => {
    renderColumn('propertyKey', rule({ system: true, deleted: true }), replaced)
    expect(badge()).toBeNull()
  })
})
