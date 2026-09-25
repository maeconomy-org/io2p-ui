import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OwnerCell } from '@/components/entity-list/owner-cell'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))

describe('OwnerCell', () => {
  it('says Me for your own things, without naming you', () => {
    render(<OwnerCell ownerUserId="me" />)

    expect(screen.getByText('common.me')).toBeTruthy()
  })

  it('marks a built-in as built-in, whoever nominally owns it', () => {
    render(<OwnerCell system ownerUserId="someone" />)

    expect(screen.getByText('common.builtIn')).toBeTruthy()
  })

  it('names a foreign owner from the read', () => {
    render(<OwnerCell ownerUserId="u1" ownerName="Anna Roos" />)

    expect(screen.getByText('Anna Roos')).toBeTruthy()
  })

  /**
   * Every read carrying an owner now carries `ownerName`, so absent means the NODE could not
   * resolve that user — a client-side lookup could not have resolved them either. The id keeps an
   * unresolvable owner visible; a blank cell would read as "no owner", which is a different claim.
   */
  it('falls back to the id when the node could not resolve a name', () => {
    render(<OwnerCell ownerUserId="u1" />)

    expect(screen.getByText('u1')).toBeTruthy()
  })
})
