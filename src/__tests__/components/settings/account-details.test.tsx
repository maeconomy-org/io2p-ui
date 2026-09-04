import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AccountDetails } from '@/app/settings/components/account-details'

// next-intl mock echoes the key (namespace arg ignored), so labels render as
// their bare key, e.g. t('certificate') -> 'certificate'.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

let mockAccounts: { id: string; providerId: string; createdAt: string }[] = []
vi.mock('@/hooks/api/use-linked-accounts', () => ({
  useLinkedAccounts: () => ({ data: mockAccounts }),
}))

let mockUserInfo: Record<string, unknown> | null = null
vi.mock('@/contexts', () => ({
  useAuth: () => ({
    userInfo: mockUserInfo,
    // The id column now reads the top-level userId (core /me.id); tests carry it
    // on the mock fixture under `userUUID` for brevity.
    userId: mockUserInfo?.userUUID as string | undefined,
  }),
}))

describe('AccountDetails', () => {
  beforeEach(() => {
    mockUserInfo = null
    mockAccounts = []
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

describe('AccountDetails auth type', () => {
  beforeEach(() => {
    mockUserInfo = null
    mockAccounts = []
  })

  it('names the social provider instead of falling back to email', () => {
    mockUserInfo = {
      userUUID: 'ghi-789',
      identifierType: 'UserAuthUP',
      createdAt: '2026-01-04T10:00:00Z',
    }
    mockAccounts = [
      { id: 'a1', providerId: 'microsoft', createdAt: '2026-08-21T10:00:00Z' },
    ]
    render(<AccountDetails />)

    expect(screen.getByText('microsoft')).toBeInTheDocument()
    expect(screen.queryByText('email')).not.toBeInTheDocument()
  })

  it('still says email when the only credential is a password', () => {
    mockUserInfo = {
      userUUID: 'jkl-012',
      identifierType: 'UserAuthUP',
      createdAt: '2026-01-04T10:00:00Z',
    }
    mockAccounts = [
      { id: 'a2', providerId: 'credential', createdAt: '2026-08-21T10:00:00Z' },
    ]
    render(<AccountDetails />)

    expect(screen.getByText('email')).toBeInTheDocument()
  })

  // A cert user can also carry a social account row; the certificate is the
  // stronger claim and its detail rows are what the rest of the card renders.
  it('keeps certificate identity ahead of a linked social account', () => {
    mockUserInfo = {
      userUUID: 'mno-345',
      identifierType: 'mTLS',
      createdAt: '2026-01-04T10:00:00Z',
      certificateInfo: {
        subjectFields: { CN: 'Jane Doe' },
        issuerFields: { CN: 'Acme CA' },
        validTo: '2027-01-01T00:00:00Z',
      },
    }
    mockAccounts = [
      { id: 'a3', providerId: 'microsoft', createdAt: '2026-08-21T10:00:00Z' },
    ]
    render(<AccountDetails />)

    expect(screen.getByText('certificate')).toBeInTheDocument()
    expect(screen.queryByText('microsoft')).not.toBeInTheDocument()
  })
})
