import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ResetPasswordPage from '@/app/(auth)/reset-password/page'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

const mockReplace = vi.fn()
let searchParams = new URLSearchParams('')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}))

const mockResetPassword = vi.fn(
  async (_input?: any) => ({ error: null }) as any
)
vi.mock('@/lib/auth/client', () => ({
  authClient: { resetPassword: (input: any) => mockResetPassword(input) },
}))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  searchParams = new URLSearchParams('')
})

describe('ResetPasswordPage', () => {
  it('shows the invalid-token state when no token is present', () => {
    render(<ResetPasswordPage />)
    expect(
      screen.getByText('auth.resetPassword.invalidToken')
    ).toBeInTheDocument()
  })

  it('resets the password with a valid token and matching passwords', async () => {
    searchParams = new URLSearchParams('token=abc')
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    await user.type(
      screen.getByPlaceholderText('auth.password.placeholder'),
      'Passw0rd!'
    )
    await user.type(
      screen.getByPlaceholderText('auth.resetPassword.confirmPlaceholder'),
      'Passw0rd!'
    )
    await user.click(
      screen.getByRole('button', { name: 'auth.resetPassword.submit' })
    )

    await waitFor(() => expect(mockResetPassword).toHaveBeenCalled())
    expect(mockResetPassword.mock.calls[0][0]).toMatchObject({
      token: 'abc',
      newPassword: 'Passw0rd!',
    })
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('blocks submission when passwords do not match', async () => {
    searchParams = new URLSearchParams('token=abc')
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    await user.type(
      screen.getByPlaceholderText('auth.password.placeholder'),
      'Passw0rd!'
    )
    await user.type(
      screen.getByPlaceholderText('auth.resetPassword.confirmPlaceholder'),
      'Different1!'
    )
    await user.click(
      screen.getByRole('button', { name: 'auth.resetPassword.submit' })
    )

    await waitFor(() =>
      expect(
        screen.getByText('auth.validation.passwordsMustMatch')
      ).toBeInTheDocument()
    )
    expect(mockResetPassword).not.toHaveBeenCalled()
  })
})
