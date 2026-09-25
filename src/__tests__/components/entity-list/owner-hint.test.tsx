import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const authState = { userId: 'me-1' }

vi.mock('@/contexts', () => ({
  useAuth: () => authState,
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { OwnerHint } from '@/components/entity-list/owner-hint'

describe('OwnerHint', () => {
  beforeEach(() => {
    authState.userId = 'me-1'
  })

  it('names the owner of a row that is not yours', () => {
    render(<OwnerHint ownerUserId="them-1" ownerName="Ana Visser" />)
    expect(screen.getByText('Ana Visser')).toBeInTheDocument()
  })

  it('says nothing about your own rows', () => {
    const { container } = render(
      <OwnerHint ownerUserId="me-1" ownerName="My Name" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says nothing about a built-in, which belongs to no one', () => {
    const { container } = render(
      <OwnerHint system ownerUserId="them-1" ownerName="Ana Visser" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says nothing when there is no owner to name', () => {
    const { container } = render(<OwnerHint />)
    expect(container).toBeEmptyDOMElement()
  })

  it('falls back to a neutral label when the node could not resolve the name', () => {
    render(<OwnerHint ownerUserId="them-1" />)
    expect(screen.getByText('common.sharedWithYou')).toBeInTheDocument()
  })
})
