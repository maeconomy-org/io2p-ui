/**
 * The two library tours that open a sheet.
 *
 * Both pages hold their sheet in local state, so the tour can only reach the
 * steps inside it by asking the page to open one. And both need the reverse:
 * stepping back leaves the sheet covering the button the earlier step points at.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'

import { TOUR_ACTION_EVENT } from '@/components/onboarding/constants'
import { TOUR_ACTIONS } from '@/components/onboarding/use-tour-action'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number) => String(n) }),
}))

vi.mock('@/components/onboarding/page-help', () => ({ PageHelp: () => null }))

// The list is not what is under test, and it pulls the whole query stack.
vi.mock('@/components/entity-list', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/entity-list')
  >('@/components/entity-list')
  return {
    ...actual,
    EntityTable: () => <div data-testid="stub-table" />,
    useEntityListActions: () => ({
      rowSelection: {},
      setRowSelection: vi.fn(),
      selectedRows: [],
      actionableRows: [],
      clearSelection: vi.fn(),
      anyLive: false,
      anyDeleted: false,
      isBusy: false,
      deletableCount: 0,
      confirmBulk: false,
      setConfirmBulk: vi.fn(),
      runBulk: vi.fn(),
      toDelete: null,
      setToDelete: vi.fn(),
      confirmDelete: vi.fn(),
      handleRestore: vi.fn(),
    }),
  }
})

vi.mock('@/app/rollup-rules/components/rollup-rule-sheet', () => ({
  RollupRuleSheet: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="sheet-open" /> : null,
}))
vi.mock('@/app/constants/components/constant-sheet', () => ({
  ConstantSheet: ({ open }: { open?: boolean }) =>
    open ? <div data-testid="sheet-open" /> : null,
}))

const list = { data: undefined, isFetching: false }
vi.mock('@/app/rollup-rules/hooks/use-rollup-rules', () => ({
  useRollupRules: () => ({
    useList: () => list,
    useRemove: () => ({}),
    useRestore: () => ({}),
    useRecompute: () => ({ mutateAsync: vi.fn() }),
  }),
}))
vi.mock('@/hooks/api/leaves', () => ({
  useConstants: () => ({
    useList: () => list,
    useRemove: () => ({}),
    useRestore: () => ({}),
  }),
}))
vi.mock('@/hooks/ui/use-scope-preference', () => ({
  useScopePreference: () => ['all', vi.fn(), 'all'],
}))
vi.mock('@/hooks/ui/use-preference', () => ({
  usePreference: () => [undefined, vi.fn(), true],
  useFlagPreference: () => [false, vi.fn(), true],
}))
vi.mock('@/lib/io2p', () => ({ useIomClient: () => ({}) }))
vi.mock('@/contexts', () => ({
  useAuth: () => ({ userId: 'u1' }),
  useSearch: () => ({
    isSearchMode: false,
    searchQuery: '',
    clearSearch: vi.fn(),
  }),
}))

const fire = (action: string) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(TOUR_ACTION_EVENT, { detail: { action } })
    )
  })

beforeEach(() => vi.clearAllMocks())

describe.each([
  {
    name: 'rollup rules',
    load: () => import('@/app/rollup-rules/page'),
    open: TOUR_ACTIONS.createRollupRule,
  },
  {
    name: 'constants',
    load: () => import('@/app/constants/page'),
    open: TOUR_ACTIONS.createConstant,
  },
])('$name — the tour gate', ({ load, open }) => {
  const mount = async () => {
    const { default: Page } = await load()
    render(<Page />)
  }

  const sheetField = () => screen.queryByTestId('sheet-open')

  it('starts with no sheet open', async () => {
    await mount()

    expect(sheetField()).toBeNull()
  })

  // `waitFor`, because every sheet here is `next/dynamic` — it resolves a tick
  // after the state flips, and a bare assertion races the import.
  it('opens the sheet when the tour asks', async () => {
    await mount()

    fire(open)

    await waitFor(() => expect(sheetField()).not.toBeNull())
  })

  /**
   * Without this, Previous highlights the Create button while the sheet renders
   * on top of it — a bright rectangle framing nothing.
   */
  it('closes it again when the tour steps back over the gate', async () => {
    await mount()
    fire(open)
    await waitFor(() => expect(sheetField()).not.toBeNull())

    fire(TOUR_ACTIONS.closeSheet)

    await waitFor(() => expect(sheetField()).toBeNull())
  })

  it('ignores an action meant for another page', async () => {
    await mount()

    fire(TOUR_ACTIONS.createObject)
    await act(async () => {})

    expect(sheetField()).toBeNull()
  })
})

// The two openers must stay distinct, or starting either tour opens both sheets
// the moment both pages are reachable from one another.
it('gives each library page its own opener', () => {
  expect(TOUR_ACTIONS.createConstant).not.toBe(TOUR_ACTIONS.createRollupRule)
})
