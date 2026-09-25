import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const mockRequestReset = vi.fn(async (_input?: any) => ({ error: null }) as any)
vi.mock('@/lib/auth/client', () => ({
  authClient: { requestPasswordReset: (input: any) => mockRequestReset(input) },
}))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

describe('ForgotPasswordPage', () => {
  it('renders the email form', () => {
    render(<ForgotPasswordPage />)
    expect(screen.getByText('auth.forgotPassword.title')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('auth.email.placeholder')
    ).toBeInTheDocument()
  })

  it('sends a reset request and shows the success state', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(
      screen.getByPlaceholderText('auth.email.placeholder'),
      'a@b.com'
    )
    await user.click(screen.getByRole('button'))

    await waitFor(() => expect(mockRequestReset).toHaveBeenCalled())
    expect(mockRequestReset.mock.calls[0][0]).toMatchObject({
      email: 'a@b.com',
    })
    await waitFor(() =>
      expect(
        screen.getByText('auth.forgotPassword.success')
      ).toBeInTheDocument()
    )
  })

  it('surfaces an error when the request fails', async () => {
    mockRequestReset.mockResolvedValueOnce({ error: { message: 'boom' } })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(
      screen.getByPlaceholderText('auth.email.placeholder'),
      'a@b.com'
    )
    await user.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByText('auth.forgotPassword.error')).toBeInTheDocument()
    )
  })
})
