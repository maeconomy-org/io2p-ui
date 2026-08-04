import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OwnerCell } from '@/components/tables/owner-cell'

const useUserDirectory = vi.fn((_options: { enabled?: boolean }) => ({
  nameOf: (id: string) => `directory:${id}`,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/contexts', () => ({ useAuth: () => ({ userId: 'me' }) }))
vi.mock('@/hooks/api/users', () => ({
  useUserDirectory: (options: { enabled?: boolean }) =>
    useUserDirectory(options),
}))

describe('OwnerCell', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says Me for your own things, without naming you', () => {
    render(<OwnerCell ownerUserId="me" />)

    expect(screen.getByText('common.me')).toBeTruthy()
  })

  it('marks a built-in as built-in, whoever nominally owns it', () => {
    render(<OwnerCell system ownerUserId="someone" />)

    expect(screen.getByText('common.builtIn')).toBeTruthy()
  })

  it('prefers the name the node resolved over the directory', () => {
    render(<OwnerCell ownerUserId="u1" ownerName="Anna Roos" />)

    expect(screen.getByText('Anna Roos')).toBeTruthy()
  })

  /**
   * The point of the prop. The directory is ONE page, so it names the first N users and no more —
   * fetching it when the read already carried the answer is a request that can only make the label
   * worse, never better.
   */
  it('does not fetch the directory at all when the read carried a name', () => {
    render(<OwnerCell ownerUserId="u1" ownerName="Anna Roos" />)

    expect(useUserDirectory).toHaveBeenCalledWith({ enabled: false })
  })

  it('still falls back to the directory while a read carries no name', () => {
    render(<OwnerCell ownerUserId="u1" />)

    expect(useUserDirectory).toHaveBeenCalledWith({ enabled: true })
    expect(screen.getByText('directory:u1')).toBeTruthy()
  })
})
