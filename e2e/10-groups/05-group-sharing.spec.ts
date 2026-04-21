import { test, expect } from '@playwright/test'

/**
 * Cross-User Group Sharing E2E Tests
 *
 * Coverage for:
 * - Add/remove shared users on a group
 * - Logout primary (cert) user
 * - Login as email/password user
 * - Verify shared group visibility and READ-only restrictions
 * - Cleanup logout
 */

const runId = Date.now()
const otherUserUUID = '4885b7fe-0a19-4151-84a6-1c3c1944a409'
const loginUserUUID = '339dd7c0-6c30-4445-bdca-20d0cf90040b'
const loginUserEmail = 'test@account.bg'
const loginUserPassword = 'Password1!'

test.describe('05 - Group Sharing (Cross-User)', () => {
  test.describe.configure({ mode: 'serial' })

  let groupName = ''

  // TC001: Create group for sharing tests
  test('TC001: Setup - create group', async ({ page }) => {
    groupName = `E2E Sharing Group ${runId}`

    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByTestId('create-group-button').click()
    await expect(page.getByText(/create new group/i)).toBeVisible()

    await page.getByLabel(/name/i).fill(groupName)
    await page.getByRole('button', { name: /create group/i }).click()
    await expect(page.getByText(/create new group/i)).toBeHidden({
      timeout: 10000,
    })

    // Reload groups page and search for the newly created group
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })
  })

  // TC002: Add first user (will be removed later)
  test('TC002: Add first user (to remove later)', async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /add user/i }).click()
    await dialog.getByPlaceholder(/enter user uuid/i).fill(otherUserUUID)
    await dialog
      .locator('div.space-y-2.p-3')
      .getByRole('button')
      .filter({ has: page.locator('.lucide-plus') })
      .click()

    await expect(dialog.getByText(otherUserUUID).first()).toBeVisible({
      timeout: 10000,
    })

    await page.keyboard.press('Escape')
  })

  // TC003: Add second user (the one we will login as)
  test('TC003: Add second user (to login as)', async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: /add user/i }).click()
    await dialog.getByPlaceholder(/enter user uuid/i).fill(loginUserUUID)
    await dialog
      .locator('div.space-y-2.p-3')
      .getByRole('button')
      .filter({ has: page.locator('.lucide-plus') })
      .click()

    await expect(dialog.getByText(loginUserUUID).first()).toBeVisible({
      timeout: 10000,
    })

    await page.keyboard.press('Escape')
  })

  // TC004: Verify user count is 2
  test('TC004: Verify user count is 2', async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await expect(groupCard.getByText(/2 users/i)).toBeVisible()
  })

  // TC005: Remove first user
  test('TC005: Remove first user', async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Scope to the otherUserUUID row and remove
    const userRow = dialog
      .locator('div.flex.items-center.justify-between')
      .filter({ hasText: otherUserUUID })
    await userRow.locator('button.text-destructive').click()

    // Verify otherUser is removed but loginUser still present
    await expect(dialog.getByText(otherUserUUID)).toBeHidden({
      timeout: 10000,
    })
    await expect(dialog.getByText(loginUserUUID).first()).toBeVisible()

    await page.keyboard.press('Escape')
  })

  // TC006: Verify user count is 1
  test('TC006: Verify user count is 1', async ({ page }) => {
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible()

    await page.getByPlaceholder(/search groups/i).fill(groupName)
    await page.waitForLoadState('networkidle')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    await expect(groupCard.getByText(/1 user/i)).toBeVisible()
  })

  // TC007: Logout primary user, login as email user, verify sharing
  // Combined into one test because Playwright creates a new browser context
  // per test with the cert user's storageState — email login state cannot
  // persist across separate serial tests.
  test('TC007: Login as shared user and verify READ-only access', async ({
    page,
  }) => {
    test.setTimeout(180000) // 3 min — this test covers logout, login, and multiple verifications
    // --- Logout primary (cert) user ---
    await page.goto('/objects')
    await expect(
      page.getByRole('heading', { level: 1, name: /objects/i })
    ).toBeVisible()

    await page.locator('[data-tour="user-menu-trigger"]').click()
    await page
      .getByRole('menuitem')
      .filter({ hasText: /sign out/i })
      .click()

    await page.waitForURL('/', { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /welcome to iom/i })
    ).toBeVisible({ timeout: 10000 })

    // --- Login as email/password user ---
    // Check if email login is available
    const emailInput = page.getByRole('textbox', { name: /email/i })
    const emailLoginAvailable = await emailInput
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (!emailLoginAvailable) {
      test.skip(true, 'Email login not enabled in this environment')
      return
    }

    await emailInput.fill(loginUserEmail)
    await page
      .getByRole('textbox', { name: /password/i })
      .fill(loginUserPassword)
    await page.getByRole('button', { name: /sign in with email/i }).click()

    // Check if login succeeded
    const loginSucceeded = await page
      .waitForURL('/objects', { timeout: 15000 })
      .then(() => true)
      .catch(() => false)
    if (!loginSucceeded) {
      test.skip(
        true,
        'Email login failed — test user may not exist in this environment'
      )
      return
    }

    // Dismiss onboarding overlay
    await page.evaluate(() => {
      localStorage.setItem('onboarding:initial-login:v1', 'done')
    })

    // Do NOT save storageState — it would overwrite the cert user's auth

    // --- Verify shared filter shows the group ---
    await page.goto('/groups')
    await expect(
      page.getByRole('heading', { level: 1, name: /groups/i })
    ).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /filter/i }).click()
    await page
      .locator('[cmdk-item]')
      .filter({ hasText: /shared/i })
      .click()
    await page.keyboard.press('Escape')

    const groupCard = page
      .locator('[data-testid^="group-card-"]')
      .filter({ hasText: groupName })
    await expect(groupCard).toBeVisible({ timeout: 10000 })

    // --- Card shows READ permission badge, no Owner badge ---
    await expect(groupCard.getByText(/read/i).first()).toBeVisible()
    await expect(groupCard.getByText(/owner/i)).toBeHidden()

    // --- Card has no edit/delete buttons ---
    await groupCard.getByRole('heading').filter({ hasText: groupName }).hover()

    await expect(
      groupCard.locator('button').filter({
        has: page.locator('.lucide-pencil'),
      })
    ).toBeHidden()

    await expect(
      groupCard.locator('button').filter({
        has: page.locator('.lucide-trash-2'),
      })
    ).toBeHidden()

    // --- Detail sheet has READ-only restrictions ---
    await groupCard.getByRole('button', { name: /group details/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // No "Add User" button
    await expect(dialog.getByRole('button', { name: /add user/i })).toBeHidden()

    // No pencil (edit name) button on title
    await expect(
      dialog.locator('button').filter({
        has: page.locator('.lucide-pencil'),
      })
    ).toBeHidden()

    // No trash (delete) buttons on user rows
    await expect(dialog.locator('button.text-destructive')).toBeHidden()

    // Switch to Info tab
    await page.getByRole('tab', { name: /info/i }).click()

    // Visibility switch should not be present (read-only shows badge only)
    await expect(page.getByRole('switch')).toBeHidden()

    // Verify permission section shows "Read"
    await expect(dialog.getByText(/read/i).first()).toBeVisible()

    await page.keyboard.press('Escape')

    // --- Cleanup: logout test user ---
    await page.locator('[data-tour="user-menu-trigger"]').click()
    await page
      .getByRole('menuitem')
      .filter({ hasText: /sign out/i })
      .click()

    await page.waitForURL('/', { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /welcome to iom/i })
    ).toBeVisible({ timeout: 10000 })
  })
})
