import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AccountDetails } from '@/app/settings/components/account-details'

// next-intl mock echoes the key (namespace arg ignored), so labels render as
// their bare key, e.g. t('certificate') -> 'certificate'.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

let mockUserInfo: Record<string, unknown> | null = null
vi.mock('@/contexts', () => ({
  useAuth: () => ({ userInfo: mockUserInfo }),
}))

describe('AccountDetails', () => {
  beforeEach(() => {
    mockUserInfo = null
  })

  it('renders certificate identity fields for a certificate-authenticated user', () => {
    mockUserInfo = {
      userUUID: 'abc-123',
      identifierType: 'mTLS',
      createdAt: '2026-01-04T10:00:00Z',
      certificateInfo: {
        subjectFields: { CN: 'Jane Doe' },
        issuerFields: { CN: 'Acme CA' },
        validFrom: '2025-01-01T00:00:00Z',
        validTo: '2027-01-01T00:00:00Z',
      },
    }
    render(<AccountDetails />)

    expect(screen.getByText('certificate')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Acme CA')).toBeInTheDocument()
    expect(screen.getByText('abc-123')).toBeInTheDocument()
    // Email-only label must not appear for a cert user.
    expect(screen.queryByText('email')).not.toBeInTheDocument()
  })

  it('renders email identity for an email/password user and hides cert fields', () => {
    mockUserInfo = {
      userUUID: 'def-456',
      identifierType: 'UserAuthUP',
      username: 'jane@acme.io',
      createdAt: '2026-01-04T10:00:00Z',
    }
    render(<AccountDetails />)

    expect(screen.getByText('email')).toBeInTheDocument()
    expect(screen.getByText('jane@acme.io')).toBeInTheDocument()
    expect(screen.queryByText('certificate')).not.toBeInTheDocument()
    expect(screen.queryByText('certificateName')).not.toBeInTheDocument()
  })

  it('formats createdAt using the active locale', () => {
    mockUserInfo = {
      userUUID: 'abc-123',
      identifierType: 'mTLS',
      createdAt: '2026-01-04T10:00:00Z',
    }
    render(<AccountDetails />)
    // en-US long date for 2026-01-04
    expect(screen.getByText(/January 4, 2026/)).toBeInTheDocument()
  })

  it('shows the not-available label when createdAt is missing', () => {
    mockUserInfo = {
      userUUID: 'abc-123',
      identifierType: 'mTLS',
    }
    render(<AccountDetails />)
    expect(screen.getByText('notAvailable')).toBeInTheDocument()
  })
})
