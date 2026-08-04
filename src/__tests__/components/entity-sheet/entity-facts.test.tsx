import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  EntityFacts,
  type EntityFactsShape,
} from '@/components/entity-sheet/fields/entity-facts'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => '24 Jun 2026, 09:00' }),
}))
vi.mock('@/components/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  CopyButton: () => null,
}))

const facts = (over: Partial<EntityFactsShape> = {}): EntityFactsShape => ({
  id: 'obj-1',
  currentVersion: 3,
  createdAt: 1719230000000,
  updatedAt: 1719240000000,
  ...over,
})

describe('EntityFacts authorship', () => {
  it('names the author from the read', () => {
    render(
      <EntityFacts
        entity={facts({ createdBy: 'u1', createdByName: 'Anna Roos' })}
      />
    )

    expect(screen.getByText(/Anna Roos/)).toBeTruthy()
  })

  it('falls back to the id when the node could not resolve the author', () => {
    render(<EntityFacts entity={facts({ createdBy: 'u1' })} />)

    expect(screen.getByText(/u1/)).toBeTruthy()
  })

  it('shows no author line at all when there is no author', () => {
    const { container } = render(<EntityFacts entity={facts()} />)

    expect(container.textContent).not.toContain('·')
  })

  /**
   * The deleted line only exists because nothing here is ever hard-deleted: the entity stays,
   * struck through, with a Restore. That is what creates somewhere to name a deleter at all.
   */
  it('names the deleter on a soft-deleted entity', () => {
    render(
      <EntityFacts
        entity={facts({
          deleted: true,
          deletedAt: 1719250000000,
          deletedBy: 'u2',
          deletedByName: 'Ben Aker',
        })}
      />
    )

    expect(screen.getByText(/Ben Aker/)).toBeTruthy()
  })

  it('falls back to the id when the deleter no longer resolves', () => {
    render(
      <EntityFacts
        entity={facts({
          deleted: true,
          deletedAt: 1719250000000,
          deletedBy: 'u2',
        })}
      />
    )

    expect(screen.getByText(/u2/)).toBeTruthy()
  })

  it('hides the deleted line entirely while the entity is live', () => {
    const { container } = render(
      <EntityFacts
        entity={facts({ deletedBy: 'u2', deletedByName: 'Ben Aker' })}
      />
    )

    expect(container.textContent).not.toContain('Ben Aker')
  })
})
