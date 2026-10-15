import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import LoginPage from '@/app/(auth)/page'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}))
vi.mock('@/lib/observability/logger', () => ({ logger: { error: vi.fn() } }))

const mockHandleAuth = vi.fn()
let config: Record<string, unknown>
vi.mock('@/contexts', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    authLoading: false,
    handleAuth: mockHandleAuth,
    handleEmailLogin: vi.fn(),
    handleSocialLogin: vi.fn(),
  }),
  useAppConfig: () => config,
}))

const baseConfig = {
  appAcronym: 'IoM',
  appName: 'Internet of Materials',
  appDescription: 'x',
  emailLoginEnabled: 'true',
  socialProviders: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  config = { ...baseConfig }
})

describe('LoginPage — certificate sign-in', () => {
  it('shows the certificate button, and no note, when mtlsBaseUrl is set', () => {
    config.mtlsBaseUrl = 'https://mtls-auth.example.com'
    render(<LoginPage />)
    expect(screen.getByTestId('auth-certificate')).toBeInTheDocument()
    expect(
      screen.queryByTestId('auth-certificate-unavailable')
    ).not.toBeInTheDocument()
  })

  it('replaces the button with a note when mtlsBaseUrl is unset', () => {
    render(<LoginPage />)
    expect(screen.queryByTestId('auth-certificate')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('auth-certificate-unavailable')
    ).toHaveTextContent('auth.certificate.unavailable')
  })

  it('drops the "or continue with" divider when nothing follows the email form', () => {
    render(<LoginPage />)
    expect(screen.queryByText('auth.orContinueWith')).not.toBeInTheDocument()
  })

  it('keeps the divider when the certificate button follows the email form', () => {
    config.mtlsBaseUrl = 'https://mtls-auth.example.com'
    render(<LoginPage />)
    expect(screen.getByText('auth.orContinueWith')).toBeInTheDocument()
  })

  it('shows a translated error and stays on the page when the certificate is refused', async () => {
    config.mtlsBaseUrl = 'https://mtls-auth.example.com'
    mockHandleAuth.mockResolvedValueOnce({
      success: false,
      error: 'Certificate authentication failed.',
    })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByTestId('auth-certificate'))

    await waitFor(() =>
      expect(screen.getByTestId('auth-error')).toHaveTextContent(
        'auth.errors.authFailed'
      )
    )
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
