/**
 * The choice a multiplying rule makes about an object that has no such value.
 *
 * `one` counts it once and is the node's own default; `skip` leaves it out of the total and
 * reports it as skipped instead. The node has supported both since the multiplier shipped, but
 * the app could only ever produce `one`, so no user could express the second at all.
 *
 * The PATCH cases are the load-bearing half. The node `$set`s the whole `multiplyBy`
 * sub-document, so an OMITTED flag resets the rule to `one`. Sending the form's value outright is
 * what keeps a `skip` rule from reverting on an edit that never touched it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const ownRules = { data: [] as { propertyKey: string }[] }
const systemRules = { data: [] as { propertyKey: string }[] }
const createMutate = vi.fn()
const updateMutate = vi.fn()

vi.mock('@/hooks/api/rollup-rules', () => ({
  useRollupRules: () => ({
    useOwnRules: () => ({ data: ownRules }),
    useSystemRules: () => ({ data: systemRules }),
    useCreate: () => ({ mutateAsync: createMutate, isPending: false }),
    useUpdate: () => ({ mutateAsync: updateMutate, isPending: false }),
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import { RollupRuleSheet } from '@/app/rollup-rules/components/rollup-rule-sheet'
import type { RollupRuleDTO } from 'io2p-client'
import type { WhenMissing } from '@/app/rollup-rules/lib/rollup-rule'

const control = () => screen.queryByTestId('rollup-rule-when-missing')
const option = (which: 'one' | 'skip') =>
  screen.getByRole('radio', {
    name:
      which === 'one'
        ? 'rollupRules.whenMissingOne'
        : 'rollupRules.whenMissingSkip',
  })

const set = (testId: string, value: string) =>
  fireEvent.change(screen.getByTestId(testId), { target: { value } })

const rule = (over: Partial<RollupRuleDTO> = {}) =>
  ({
    id: 'r-1',
    propertyKey: 'mass',
    aggregation: 'sum',
    system: false,
    ownerUserId: 'me',
    deleted: false,
    createdBy: 'me',
    createdAt: 1_754_898_000_000,
    ...over,
  }) as RollupRuleDTO

beforeEach(() => {
  vi.clearAllMocks()
  ownRules.data = []
  systemRules.data = []
  cleanup()
})

// A stored rule may carry no flag at all, so the bare alias admits `undefined`. Handing that
// to the control would render a radio group with NOTHING selected — the empty third state the
// node does not have. The prop is NonNullable so the compiler refuses it at the call site.
describe('the control refuses an unresolved flag', () => {
  it('does not accept a stored rule’s optional flag unresolved', () => {
    const stored: RollupRuleDTO['multiplyBy'] = { propertyKey: 'quantity' }
    // @ts-expect-error — `undefined` must not reach the control; resolve it to 'one' first.
    const unresolved: NonNullable<WhenMissing> = stored?.whenMissing
    expect(unresolved).toBeUndefined()
  })
})

describe('creating a rule', () => {
  const openCreate = () =>
    render(<RollupRuleSheet open onOpenChange={vi.fn()} mode="create" />)

  const queueKeyAndMultiplier = () => {
    openCreate()
    set('rollup-rule-property-key', 'mass')
    fireEvent.click(screen.getByTestId('rollup-rule-add-key'))
    set('rollup-rule-multiply-by', 'quantity')
  }

  // Nothing can be "missing" the property a rule never scales by, so the question only exists
  // once a key is named — asking it beforehand would be a setting with no effect.
  it('asks nothing until the multiplier names a key', () => {
    openCreate()
    expect(control()).toBeNull()

    set('rollup-rule-multiply-by', 'quantity')
    expect(control()).toBeInTheDocument()
  })

  it('starts on count-once, the node’s own default', () => {
    queueKeyAndMultiplier()

    expect(option('one')).toBeChecked()
    expect(option('skip')).not.toBeChecked()
  })

  // `one` is the node's default, so writing it would store our copy of a default that is not
  // ours to hold — and every rule made before this control would look different from one made
  // with it, for the same behaviour.
  it('sends no flag while the rule counts a missing value once', async () => {
    queueKeyAndMultiplier()
    fireEvent.click(screen.getByTestId('rollup-rule-submit'))

    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].body.multiplyBy).toEqual({
      propertyKey: 'quantity',
    })
  })

  it('sends skip when the rule leaves a missing value out', async () => {
    queueKeyAndMultiplier()
    fireEvent.click(option('skip'))
    fireEvent.click(screen.getByTestId('rollup-rule-submit'))

    await vi.waitFor(() => expect(createMutate).toHaveBeenCalled())
    expect(createMutate.mock.calls[0][0].body.multiplyBy).toEqual({
      propertyKey: 'quantity',
      whenMissing: 'skip',
    })
  })
})

describe('editing a rule', () => {
  const openEdit = (r: RollupRuleDTO) =>
    render(<RollupRuleSheet open onOpenChange={vi.fn()} mode="edit" rule={r} />)

  const scaled = (whenMissing?: 'one' | 'skip') =>
    rule({
      multiplyBy: {
        propertyKey: 'quantity',
        ...(whenMissing && { whenMissing }),
      },
    } as Partial<RollupRuleDTO>)

  // A rule stored before the control has no flag at all. The node reads that as `one`, so the
  // form must show `one` rather than an empty third state.
  it('reads an absent flag as count-once', () => {
    openEdit(scaled())
    expect(option('one')).toBeChecked()
  })

  it('shows a stored skip as chosen', () => {
    openEdit(scaled('skip'))
    expect(option('skip')).toBeChecked()
  })

  // Changing ONLY this is a real change: before, Save stayed disabled unless the key moved.
  it('enables Save when the flag alone changes', () => {
    openEdit(scaled())
    expect(screen.getByTestId('rollup-rule-edit-submit')).toBeDisabled()

    fireEvent.click(option('skip'))
    expect(screen.getByTestId('rollup-rule-edit-submit')).toBeEnabled()
  })

  it('sends the flag the form shows, not the one that was stored', async () => {
    openEdit(scaled('skip'))
    fireEvent.click(option('one'))
    fireEvent.click(screen.getByTestId('rollup-rule-edit-submit'))

    await vi.waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0].body.multiplyBy).toEqual({
      propertyKey: 'quantity',
      whenMissing: 'one',
    })
  })

  // Editing the KEY of a skip rule must not quietly revert the flag — the omission the node
  // reads as `one` is exactly the accident this guards. (`volume`, not `count`: the dictionary
  // resolves `count` to `quantity`, so that edit changes nothing and Save stays disabled.)
  it('carries skip through an edit that only changes the key', async () => {
    openEdit(scaled('skip'))
    set('rollup-rule-edit-multiply-by', 'volume')
    fireEvent.click(screen.getByTestId('rollup-rule-edit-submit'))

    await vi.waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0].body.multiplyBy).toEqual({
      propertyKey: 'volume',
      whenMissing: 'skip',
    })
  })

  // Clearing the key sends `null`, which takes the whole sub-document with it. The flag has
  // nothing left to qualify, and the control goes with it.
  it('drops the whole multiplier, flag included, when the key is cleared', async () => {
    openEdit(scaled('skip'))
    set('rollup-rule-edit-multiply-by', '')

    expect(control()).toBeNull()
    fireEvent.click(screen.getByTestId('rollup-rule-edit-submit'))

    await vi.waitFor(() => expect(updateMutate).toHaveBeenCalled())
    expect(updateMutate.mock.calls[0][0].body.multiplyBy).toBeNull()
  })
})
