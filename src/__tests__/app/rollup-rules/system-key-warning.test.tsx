// Core's uniqueness is per TIER, so a user rule on a seeded key is ACCEPTED and the object then
// carries two totals for it. The form can only warn — whether a user rule should shadow the
// built-in is core item 11, and it is undecided.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const ownRules = { data: [] as { propertyKey: string }[] }
const systemRules = { data: [] as { propertyKey: string }[] }

vi.mock('@/app/rollup-rules/hooks/use-rollup-rules', () => ({
  useRollupRules: () => ({
    useOwnRules: () => ({ data: ownRules }),
    useSystemRules: () => ({ data: systemRules }),
    useCreate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { RollupRuleSheet } from '@/app/rollup-rules/components/rollup-rule-sheet'

function typeKey(value: string) {
  render(<RollupRuleSheet open onOpenChange={vi.fn()} mode="create" />)
  fireEvent.change(screen.getByTestId('rollup-rule-property-key'), {
    target: { value },
  })
}

const warning = () => screen.queryByTestId('rollup-rule-system-key-warning')

describe('a key the node already totals', () => {
  beforeEach(() => {
    ownRules.data = []
    systemRules.data = [{ propertyKey: 'weight' }]
  })

  it('warns without blocking the key', () => {
    typeKey('weight')

    expect(warning()).toBeInTheDocument()
    // The rule is valid; the pair is the node's answer, not a mistake to prevent.
    expect(screen.getByTestId('rollup-rule-add-key')).toBeEnabled()
  })

  it('warns on a key that only normalizes onto a built-in', () => {
    // Keys are stored lowercase, so the check has to run on the normalized draft or "Weight"
    // sails past the very rule it collides with.
    typeKey('Weight')

    expect(warning()).toBeInTheDocument()
  })

  it('stays silent on a key no built-in covers', () => {
    typeKey('qaweight')

    expect(warning()).toBeNull()
  })

  it('yields to your own duplicate, which is refused outright', () => {
    // "You will get two totals" describes a rule that cannot be created — it would read as the
    // reason the key was refused.
    ownRules.data = [{ propertyKey: 'weight' }]
    typeKey('weight')

    expect(screen.getByTestId('rollup-rule-duplicate-key')).toBeInTheDocument()
    expect(warning()).toBeNull()
  })
})
