// A user rule on a seeded key is ACCEPTED and REPLACES the built-in on that user's own objects,
// so the totals there move. The form can only warn: replacing is usually the point, because a
// built-in cannot be edited and a second rule is the only way to scale a seeded key.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const ownRules = { data: [] as { propertyKey: string }[] }
const systemRules = { data: [] as { propertyKey: string }[] }

vi.mock('@/hooks/api/rollup-rules', () => ({
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
    // The rule is valid; replacing the built-in is the node's answer, not a mistake to prevent.
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
    // Describing what a rule would replace, when that rule cannot be created at all, would read
    // as the reason the key was refused.
    ownRules.data = [{ propertyKey: 'weight' }]
    typeKey('weight')

    expect(screen.getByTestId('rollup-rule-duplicate-key')).toBeInTheDocument()
    expect(warning()).toBeNull()
  })
})
