import type { Page } from '@playwright/test'

/**
 * Whether the server under test has certificate sign-in configured. Read from the page, not from
 * this process's env: the dev server and Playwright do not share one `.env`.
 */
export async function certSignInEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Boolean(
      (window as unknown as { __IOM_CONFIG__?: { mtlsBaseUrl?: string } })
        .__IOM_CONFIG__?.mtlsBaseUrl
    )
  )
}

/** The test id that must be on the login page: the button, or the note that replaces it. */
export async function certSignInTestId(page: Page): Promise<string> {
  return (await certSignInEnabled(page))
    ? 'auth-certificate'
    : 'auth-certificate-unavailable'
}
