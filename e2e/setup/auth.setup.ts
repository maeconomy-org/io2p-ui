import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const authFile = 'e2e/.auth/user.json'

/**
 * Authentication setup for E2E tests
 * This performs the complete certificate-based authentication flow
 * and saves the authenticated state for other tests to use
 */
setup('authenticate with certificate', async ({ page }) => {
  // Check if we already have a valid auth state file with non-expired tokens
  const authFilePath = path.resolve(authFile)
  if (fs.existsSync(authFilePath)) {
    try {
      const authState = JSON.parse(fs.readFileSync(authFilePath, 'utf-8'))
      // Check if we have localStorage with auth token
      const authOrigin = authState.origins?.find(
        (origin: { localStorage?: Array<{ name: string; value: string }> }) =>
          origin.localStorage?.some(
            (item: { name: string }) => item.name === 'iom-auth-state'
          )
      )

      if (authOrigin) {
        // Check if token is expired
        const authItem = authOrigin.localStorage?.find(
          (item: { name: string }) => item.name === 'iom-auth-state'
        )
        if (authItem) {
          try {
            const authData = JSON.parse(authItem.value)
            // Check if token exists and is not expired (with 5 min buffer)
            if (authData.token) {
              const tokenParts = authData.token.split('.')
              if (tokenParts.length === 3) {
                const payload = JSON.parse(
                  Buffer.from(tokenParts[1], 'base64').toString()
                )
                const expiry = payload.exp * 1000 // Convert to ms
                const now = Date.now()
                const bufferMs = 5 * 60 * 1000 // 5 minutes buffer

                if (expiry > now + bufferMs) {
                  // Ensure onboarding key is in the saved state
                  const hasOnboardingKey = authOrigin.localStorage?.some(
                    (item: { name: string }) =>
                      item.name === 'onboarding:initial-login:v1'
                  )
                  if (!hasOnboardingKey) {
                    authOrigin.localStorage = authOrigin.localStorage || []
                    authOrigin.localStorage.push({
                      name: 'onboarding:initial-login:v1',
                      value: 'done',
                    })
                    fs.writeFileSync(
                      authFilePath,
                      JSON.stringify(authState, null, 2)
                    )
                    console.log(
                      'Patched auth state with onboarding:initial-login:v1=done'
                    )
                  }
                  console.log(
                    'Valid non-expired auth state found, skipping authentication flow'
                  )
                  return
                } else {
                  console.log(
                    'Auth token expired, proceeding with re-authentication'
                  )
                }
              }
            }
          } catch {
            console.log(
              'Could not parse auth token, proceeding with authentication'
            )
          }
        }
      }
    } catch {
      console.log(
        'Could not parse existing auth file, proceeding with authentication'
      )
    }
  }

  // Navigate to the auth page
  await page.goto('/')

  // Wait for the auth page to load
  await page.waitForLoadState('networkidle')

  // Check if we're already authenticated (redirected to /objects)
  if (page.url().includes('/objects')) {
    console.log('Already authenticated, saving state...')
    await page.evaluate(() => {
      localStorage.setItem('onboarding:initial-login:v1', 'done')
    })
    await page.context().storageState({ path: authFile })
    return
  }

  // Check for API connection error (missing env vars)
  const apiError = page.getByText(/API Connection Error/i)
  if (await apiError.isVisible({ timeout: 2000 }).catch(() => false)) {
    throw new Error(
      'API Connection Error detected. Make sure the dev server is running with proper environment variables. ' +
        'Start the dev server manually with: npm run dev'
    )
  }

  // Look for the auth page elements
  await expect(page.getByText('Welcome to IoM').first()).toBeVisible({
    timeout: 10000,
  })

  // Click the "Authorize with Certificate" button
  const authorizeButton = page.getByRole('button', {
    name: /authorize with certificate/i,
  })
  await expect(authorizeButton).toBeVisible()
  await authorizeButton.click()

  // Wait for authentication to complete - handle both success and error states
  try {
    await Promise.race([
      // Success path: redirect to /objects
      page.waitForURL('**/objects', { timeout: 30000 }),
      // Error path: error message appears
      page.getByText(/authentication failed/i).waitFor({ timeout: 30000 }),
    ])

    // Check if we're on the objects page (success)
    if (page.url().includes('/objects')) {
      await expect(page.getByText(/objects/i)).toBeVisible({ timeout: 10000 })

      // Mark onboarding as completed so the tour overlay doesn't block tests
      await page.evaluate(() => {
        localStorage.setItem('onboarding:initial-login:v1', 'done')
      })

      await page.context().storageState({ path: authFile })
      console.log('Authentication successful, state saved to', authFile)
    } else {
      // We're still on auth page, check for error
      const errorVisible = await page
        .getByText(/authentication failed/i)
        .isVisible()
      if (errorVisible) {
        throw new Error(
          'Authentication failed - certificate may be invalid or not selected'
        )
      } else {
        throw new Error('Authentication did not complete within expected time')
      }
    }
  } catch (error) {
    // Take a screenshot for debugging
    await page.screenshot({
      path: `test-results/auth-setup-error-${Date.now()}.png`,
    })

    // Log the current page state for debugging
    console.log('Authentication failed. Current URL:', page.url())
    console.log('Page title:', await page.title())

    throw error
  }
})
