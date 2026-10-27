import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))
vi.mock('@/hooks/api/use-linked-accounts', () => ({
  useLinkedAccounts: () => ({ data: [], isPending: false }),
}))
vi.mock('@/hooks/api/use-sign-in-options', () => ({
  useSignInOptions: () => ({ providers: [], signUp: 'off', approval: 'none' }),
}))
vi.mock('@/lib/auth/client', () => ({ authClient: { linkSocial: vi.fn() } }))

import { ConnectedAccountsCard } from '@/app/settings/components/security/connected-accounts-card'

const nextTick = () => act(() => new Promise((r) => setTimeout(r, 0)))

describe('ConnectedAccountsCard link error', () => {
  beforeEach(async () => {
    // Lets the deferred forget from the previous test's unmount run.
    await nextTick()
    window.history.replaceState(
      null,
      '',
      '/settings?tab=security&error=email_does_not_match'
    )
  })

  it('shows the ?error code once and not again after a client-side return', async () => {
    const first = render(<ConnectedAccountsCard />)
    expect(screen.getByTestId('connect-account-error')).toHaveTextContent(
      'linkErrors.emailDoesNotMatch'
    )
    expect(window.location.search).toBe('?tab=security')
    first.unmount()
    await nextTick()

    render(<ConnectedAccountsCard />)
    expect(screen.queryByTestId('connect-account-error')).toBeNull()
  })

  it('keeps the error through the StrictMode effect re-run', async () => {
    const view = render(
      <StrictMode>
        <ConnectedAccountsCard />
      </StrictMode>
    )
    await nextTick()
    view.rerender(
      <StrictMode>
        <ConnectedAccountsCard />
      </StrictMode>
    )
    expect(screen.getByTestId('connect-account-error')).toBeInTheDocument()
  })
})
